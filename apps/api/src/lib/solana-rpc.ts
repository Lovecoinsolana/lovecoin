import { Connection, PublicKey, ParsedTransactionWithMeta } from "@solana/web3.js";
import { config } from "../config.js";

const connection = new Connection(config.solanaRpcUrl, "confirmed");

export interface TransactionVerification {
  valid: boolean;
  error?: string;
  sender?: string;
  recipient?: string;
  amount?: number;
  memo?: string;
}

/**
 * Fetch and parse a transaction from Solana
 */
export async function getTransaction(
  signature: string
): Promise<ParsedTransactionWithMeta | null> {
  try {
    const tx = await connection.getParsedTransaction(signature, {
      maxSupportedTransactionVersion: 0,
      commitment: "confirmed",
    });
    return tx;
  } catch (error) {
    console.error("Failed to fetch transaction:", error);
    return null;
  }
}

/**
 * Verify a verification payment transaction
 */
export async function verifyVerificationPayment(
  signature: string,
  expectedSender: string,
  expectedUserId: string
): Promise<TransactionVerification> {
  // Fetch transaction
  const tx = await getTransaction(signature);

  if (!tx) {
    return { valid: false, error: "Transaction not found" };
  }

  if (tx.meta?.err) {
    return { valid: false, error: "Transaction failed on-chain" };
  }

  // Parse transaction instructions
  const instructions = tx.transaction.message.instructions;

  let transferAmount = 0;
  let sender = "";
  let recipient = "";
  let memo = "";

  for (const instruction of instructions) {
    // Check for system program transfer
    if ("parsed" in instruction) {
      const parsed = instruction.parsed;

      if (
        instruction.program === "system" &&
        parsed.type === "transfer"
      ) {
        sender = parsed.info.source;
        recipient = parsed.info.destination;
        transferAmount = parsed.info.lamports;
      }

      // Check for memo program
      if (instruction.program === "spl-memo") {
        memo = parsed;
      }
    }

    // Handle memo as unparsed instruction (some memo programs)
    if ("data" in instruction && !("parsed" in instruction)) {
      // Check if this is a memo program instruction
      const memoPrograms = [
        "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr", // Memo v2
        "Memo1UhkJRfHyvLMcVucJwxXeuD728EqVDDwQDxFMNo", // Memo v1
      ];
      if (memoPrograms.includes(instruction.programId.toString())) {
        try {
          memo = Buffer.from(instruction.data, "base64").toString("utf-8");
        } catch {
          // Try as raw string
          memo = instruction.data;
        }
      }
    }
  }

  // Also check log messages for memo
  if (!memo && tx.meta?.logMessages) {
    for (const log of tx.meta.logMessages) {
      if (log.includes("Memo (len")) {
        const memoMatch = log.match(/Memo \(len \d+\): "(.+)"/);
        if (memoMatch) {
          memo = memoMatch[1];
        }
      }
    }
  }

  // Verify sender
  if (sender !== expectedSender) {
    return {
      valid: false,
      error: `Sender mismatch. Expected ${expectedSender}, got ${sender}`,
      sender,
      recipient,
      amount: transferAmount,
      memo,
    };
  }

  // Verify recipient is platform wallet
  if (recipient !== config.platformWalletAddress) {
    return {
      valid: false,
      error: `Recipient must be platform wallet`,
      sender,
      recipient,
      amount: transferAmount,
      memo,
    };
  }

  // Verify amount (>= 0.01 SOL = 10,000,000 lamports)
  if (transferAmount < config.verificationFeeLamports) {
    return {
      valid: false,
      error: `Amount too low. Expected ${config.verificationFeeLamports} lamports, got ${transferAmount}`,
      sender,
      recipient,
      amount: transferAmount,
      memo,
    };
  }

  // Verify memo contains VERIFY:{userId}
  const expectedMemo = `VERIFY:${expectedUserId}`;
  if (!memo.includes(expectedMemo)) {
    return {
      valid: false,
      error: `Invalid memo. Expected to contain "${expectedMemo}", got "${memo}"`,
      sender,
      recipient,
      amount: transferAmount,
      memo,
    };
  }

  return {
    valid: true,
    sender,
    recipient,
    amount: transferAmount,
    memo,
  };
}
