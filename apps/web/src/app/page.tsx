"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { isAuthenticated } from "@/lib/auth";

const CONTRACT_ADDRESS = "4udCASKskpYNymxwXAwMR4En15vtUXwT7P5vc3fjpump";

export default function Home() {
  const router = useRouter();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isAuthenticated()) {
      router.push("/verify");
    }
  }, [router]);

  const copyCA = async () => {
    await navigator.clipboard.writeText(CONTRACT_ADDRESS);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <main className="container-mobile flex min-h-dvh flex-col items-center justify-center">
      <img src="/logo.png" alt="Lovecoin" className="mb-4 h-20 w-20" />
      <h1 className="mb-4 text-4xl font-bold tracking-tight">LOVECOIN</h1>
      <p className="mb-6 text-center text-neutral-400">
        Where every message means something
      </p>

      {/* Contract Address */}
      <button
        onClick={copyCA}
        className="mb-8 flex items-center gap-2 rounded-xl border border-brand-500/30 bg-brand-950/50 px-4 py-2 transition-all hover:border-brand-500/60 hover:bg-brand-950/80"
      >
        <span className="text-xs text-neutral-500">CA:</span>
        <span className="font-mono text-sm text-brand-400">
          {CONTRACT_ADDRESS.slice(0, 4)}...{CONTRACT_ADDRESS.slice(-4)}
        </span>
        <span className="text-xs text-neutral-500">
          {copied ? "✓ Copied!" : "Copy"}
        </span>
      </button>

      <Link
        href="/login"
        className="rounded-full bg-brand-600 px-8 py-3 font-medium text-white transition-colors hover:bg-brand-700"
      >
        Get Started
      </Link>
    </main>
  );
}
