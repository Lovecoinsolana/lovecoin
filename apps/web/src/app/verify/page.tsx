"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import {
  Transaction,
  SystemProgram,
  PublicKey,
  TransactionInstruction,
} from "@solana/web3.js";
import { api } from "@/lib/api";
import { isAuthenticated, removeToken } from "@/lib/auth";
import { useToast } from "@/components/Toast";
import { PageLoader, ButtonSpinner } from "@/components/Skeleton";

interface User {
  id: string;
  walletAddress: string;
  isVerified: boolean;
}

interface PaymentDetails {
  recipientWallet: string;
  amountLamports: number;
  amountSol: number;
  memo: string;
}

type VerifyStatus = "loading" | "ready" | "paying" | "confirming" | "success" | "error";

// Memo program ID
const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

export default function VerifyPage() {
  const router = useRouter();
  const { publicKey, sendTransaction, disconnect } = useWallet();
  const { connection } = useConnection();
  const { showToast } = useToast();

  const [user, setUser] = useState<User | null>(null);
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetails | null>(null);
  const [status, setStatus] = useState<VerifyStatus>("loading");
  const [error, setError] = useState<string | null>(null);

  // Check session and verification status
  useEffect(() => {
    const checkSession = async () => {
      if (!isAuthenticated()) {
        router.push("/login");
        return;
      }

      const sessionRes = await api.auth.getSession();
      if (sessionRes.error || !sessionRes.data?.user) {
        removeToken();
        router.push("/login");
        return;
      }

      const userData = sessionRes.data.user;
      setUser(userData);

      // If already verified, redirect to discover
      if (userData.isVerified) {
        router.push("/discover");
        return;
      }

      // Fetch payment details
      const detailsRes = await api.verification.getPaymentDetails();
      if (detailsRes.error || !detailsRes.data) {
        const errorMsg = detailsRes.error || "Failed to get payment details";
        setError(errorMsg);
        setStatus("error");
        showToast(errorMsg, "error");
        return;
      }

      setPaymentDetails(detailsRes.data);
      setStatus("ready");
    };

    checkSession();
  }, [router]);

  const handlePayment = useCallback(async () => {
    if (!publicKey || !paymentDetails) {
      setError("Wallet not connected");
      showToast("Wallet not connected", "error");
      return;
    }

    setStatus("paying");
    setError(null);

    try {
      // Create transaction
      const transaction = new Transaction();

      // Add transfer instruction
      const transferInstruction = SystemProgram.transfer({
        fromPubkey: publicKey,
        toPubkey: new PublicKey(paymentDetails.recipientWallet),
        lamports: paymentDetails.amountLamports,
      });
      transaction.add(transferInstruction);

      // Add memo instruction
      const memoInstruction = new TransactionInstruction({
        keys: [],
        programId: MEMO_PROGRAM_ID,
        data: Buffer.from(paymentDetails.memo, "utf-8"),
      });
      transaction.add(memoInstruction);

      // Get recent blockhash
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      // Send transaction
      const signature = await sendTransaction(transaction, connection);

      // Wait for confirmation
      setStatus("confirming");

      const confirmation = await connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight,
      });

      if (confirmation.value.err) {
        throw new Error("Transaction failed on-chain");
      }

      // Verify with API
      const confirmRes = await api.verification.confirm(signature);

      if (confirmRes.error || !confirmRes.data?.success) {
        throw new Error(confirmRes.error || "Verification failed");
      }

      setStatus("success");

      // Redirect to discover after short delay
      setTimeout(() => {
        router.push("/discover");
      }, 1500);
    } catch (err) {
      console.error("Payment error:", err);
      setStatus("error");
      const errorMsg = err instanceof Error ? err.message : "Payment failed";
      setError(errorMsg);
      showToast(errorMsg, "error");
    }
  }, [publicKey, paymentDetails, connection, sendTransaction, router]);

  const handleLogout = async () => {
    await api.auth.logout();
    removeToken();
    await disconnect();
    router.push("/login");
  };

  if (status === "loading") {
    return (
      <main className="container-mobile flex min-h-dvh flex-col items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      </main>
    );
  }

  return (
    <main className="container-mobile flex min-h-dvh flex-col items-center justify-center">
      <div className="mb-8 text-center">
        <h1 className="mb-2 text-2xl font-bold">Verify Your Account</h1>
        <p className="text-sm text-neutral-400">
          One-time payment to unlock all features
        </p>
      </div>

      {user && (
        <div className="mb-6 text-center">
          <p className="text-xs text-neutral-500">Connected as</p>
          <p className="font-mono text-sm text-neutral-300">
            {user.walletAddress.slice(0, 4)}...{user.walletAddress.slice(-4)}
          </p>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="mb-4 w-full max-w-sm rounded-xl border border-red-900 bg-red-950/50 p-4">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Status Display */}
      {(status === "paying" || status === "confirming" || status === "success") && (
        <div className="mb-4 w-full max-w-sm rounded-xl border border-neutral-800 bg-neutral-900 p-4">
          <div className="flex items-center gap-3">
            {status !== "success" ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
            ) : (
              <div className="flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-xs text-white">
                &#10003;
              </div>
            )}
            <span className="text-sm text-neutral-300">
              {status === "paying" && "Waiting for wallet approval..."}
              {status === "confirming" && "Confirming transaction..."}
              {status === "success" && "Verified! Redirecting..."}
            </span>
          </div>
        </div>
      )}

      <div className="w-full max-w-sm rounded-xl border border-neutral-800 bg-neutral-900 p-6">
        <div className="mb-4 text-center">
          <span className="text-3xl font-bold text-brand-500">
            {paymentDetails?.amountSol || 0.01} SOL
          </span>
        </div>
        <ul className="mb-6 space-y-2 text-sm text-neutral-400">
          <li className="flex items-center gap-2">
            <span className="text-brand-500">+</span>
            Access to discovery feed
          </li>
          <li className="flex items-center gap-2">
            <span className="text-brand-500">+</span>
            Ability to send messages
          </li>
          <li className="flex items-center gap-2">
            <span className="text-brand-500">+</span>
            Verified badge on profile
          </li>
        </ul>

        <button
          onClick={handlePayment}
          disabled={status !== "ready" && status !== "error"}
          className={`w-full rounded-full py-3 font-medium text-white transition-colors ${
            status === "ready" || status === "error"
              ? "bg-brand-600 hover:bg-brand-700"
              : "bg-brand-600/50 cursor-not-allowed"
          }`}
        >
          {status === "ready" && "Pay to Verify"}
          {status === "error" && "Try Again"}
          {status === "paying" && "Approving..."}
          {status === "confirming" && "Confirming..."}
          {status === "success" && "Verified!"}
        </button>

        {paymentDetails && (
          <div className="mt-4 text-center">
            <p className="text-xs text-neutral-600">
              Payment to:{" "}
              <span className="font-mono">
                {paymentDetails.recipientWallet.slice(0, 4)}...
                {paymentDetails.recipientWallet.slice(-4)}
              </span>
            </p>
          </div>
        )}
      </div>

      <button
        onClick={handleLogout}
        className="mt-6 text-sm text-neutral-500 transition-colors hover:text-neutral-300"
      >
        Sign out
      </button>
    </main>
  );
}
