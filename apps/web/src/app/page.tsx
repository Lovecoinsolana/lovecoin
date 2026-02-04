"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { isAuthenticated } from "@/lib/auth";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated()) {
      router.push("/verify");
    }
  }, [router]);

  return (
    <main className="container-mobile flex min-h-dvh flex-col items-center justify-center">
      <h1 className="mb-4 text-4xl font-bold tracking-tight">LOVECOIN</h1>
      <p className="mb-8 text-center text-neutral-400">
        Where every message means something
      </p>
      <Link
        href="/login"
        className="rounded-full bg-brand-600 px-8 py-3 font-medium text-white transition-colors hover:bg-brand-700"
      >
        Get Started
      </Link>
    </main>
  );
}
