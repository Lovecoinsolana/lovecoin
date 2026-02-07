"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import bs58 from "bs58";
import { api } from "@/lib/api";
import { setToken, isAuthenticated } from "@/lib/auth";

type AuthStatus = "idle" | "connecting" | "signing" | "verifying" | "success" | "error";

export default function LoginPage() {
  const router = useRouter();
  const { publicKey, signMessage, connected, disconnect } = useWallet();
  const [status, setStatus] = useState<AuthStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated()) {
      router.push("/verify");
    }
  }, [router]);

  const handleSignIn = useCallback(async () => {
    if (!publicKey || !signMessage) {
      setError("Wallet not connected or does not support signing");
      return;
    }

    setStatus("signing");
    setError(null);

    try {
      const walletAddress = publicKey.toBase58();

      // Step 1: Get challenge from API
      const challengeRes = await api.auth.getChallenge(walletAddress);
      if (challengeRes.error || !challengeRes.data) {
        throw new Error(challengeRes.error || "Failed to get challenge");
      }

      const { message, nonce } = challengeRes.data;

      // Step 2: Sign the message with wallet
      const messageBytes = new TextEncoder().encode(message);
      const signatureBytes = await signMessage(messageBytes);
      const signature = bs58.encode(signatureBytes);

      // Step 3: Verify signature with API
      setStatus("verifying");
      const verifyRes = await api.auth.verify(walletAddress, signature, nonce);
      if (verifyRes.error || !verifyRes.data) {
        throw new Error(verifyRes.error || "Failed to verify signature");
      }

      // Step 4: Store token and redirect
      setToken(verifyRes.data.token);
      setStatus("success");

      // Redirect to verification page
      router.push("/verify");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Authentication failed");
    }
  }, [publicKey, signMessage, router]);

  // Auto-trigger sign-in when wallet connects
  useEffect(() => {
    if (connected && publicKey && status === "idle") {
      handleSignIn();
    }
  }, [connected, publicKey, status, handleSignIn]);

  const handleDisconnect = async () => {
    await disconnect();
    setStatus("idle");
    setError(null);
  };

  return (
    <main className="container-mobile flex min-h-dvh flex-col items-center justify-center">
      <div className="mb-8 text-center">
        <img src="/logo.png" alt="Lovecoin" className="mx-auto mb-4 h-16 w-16" />
        <h1 className="mb-2 text-3xl font-bold tracking-tight">LOVECOIN</h1>
        <p className="text-neutral-400">Connect your wallet to continue</p>
      </div>

      <div className="w-full max-w-sm space-y-4">
        {/* Status Display */}
        {status !== "idle" && status !== "error" && (
          <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
            <div className="flex items-center gap-3">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
              <span className="text-sm text-neutral-300">
                {status === "signing" && "Waiting for signature..."}
                {status === "verifying" && "Verifying signature..."}
                {status === "success" && "Success! Redirecting..."}
              </span>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="rounded-xl border border-red-900 bg-red-950/50 p-4">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Wallet Button */}
        <div className="flex flex-col items-center gap-3">
          <WalletMultiButton
            style={{
              width: "100%",
              height: "48px",
              borderRadius: "12px",
              backgroundColor: "#db2777",
              fontFamily: "inherit",
              fontSize: "14px",
              fontWeight: 500,
              justifyContent: "center",
            }}
          />

          {connected && status === "error" && (
            <button
              onClick={handleSignIn}
              className="w-full rounded-xl bg-brand-600 py-3 font-medium text-white transition-colors hover:bg-brand-700"
            >
              Try Again
            </button>
          )}

          {connected && (
            <button
              onClick={handleDisconnect}
              className="text-sm text-neutral-500 transition-colors hover:text-neutral-300"
            >
              Disconnect wallet
            </button>
          )}
        </div>

        {/* Info */}
        <div className="pt-4 text-center">
          <p className="text-xs text-neutral-500">
            By connecting, you agree to sign a message to verify your wallet
            ownership. No transaction will be made.
          </p>
        </div>
      </div>
    </main>
  );
}
