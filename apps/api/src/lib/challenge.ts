import crypto from "crypto";

// In-memory challenge store (use Redis in production)
const challenges = new Map<string, { message: string; expiresAt: number }>();

const CHALLENGE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

export function generateChallenge(walletAddress: string): {
  message: string;
  nonce: string;
} {
  const nonce = crypto.randomBytes(32).toString("hex");
  const timestamp = Date.now();

  const message = `Sign in to LOVECOIN

Wallet: ${walletAddress}
Timestamp: ${timestamp}
Nonce: ${nonce}`;

  // Store challenge for verification
  challenges.set(nonce, {
    message,
    expiresAt: timestamp + CHALLENGE_EXPIRY_MS,
  });

  // Cleanup expired challenges periodically
  cleanupExpiredChallenges();

  return { message, nonce };
}

export function verifyChallenge(
  nonce: string,
  walletAddress: string
): { valid: boolean; message: string | null } {
  const challenge = challenges.get(nonce);

  if (!challenge) {
    return { valid: false, message: null };
  }

  // Check expiry
  if (Date.now() > challenge.expiresAt) {
    challenges.delete(nonce);
    return { valid: false, message: null };
  }

  // Verify wallet address is in the message
  if (!challenge.message.includes(walletAddress)) {
    return { valid: false, message: null };
  }

  // Delete challenge after use (single use)
  challenges.delete(nonce);

  return { valid: true, message: challenge.message };
}

function cleanupExpiredChallenges() {
  const now = Date.now();
  for (const [nonce, challenge] of challenges.entries()) {
    if (now > challenge.expiresAt) {
      challenges.delete(nonce);
    }
  }
}
