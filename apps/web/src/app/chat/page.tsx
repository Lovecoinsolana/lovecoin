"use client";

import { useAuth } from "@/hooks/useAuth";
import { BottomNav } from "@/components/BottomNav";

export default function ChatPage() {
  const { user, loading } = useAuth({ requireVerified: true, requireProfile: true });

  if (loading) {
    return (
      <main className="container-mobile flex min-h-dvh flex-col items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      </main>
    );
  }

  return (
    <main className="container-mobile flex min-h-dvh flex-col pt-4 safe-top">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Messages</h1>
        <a
          href="/profile"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-800 text-sm hover:bg-neutral-700"
        >
          {user?.walletAddress.slice(0, 2)}
        </a>
      </header>
      <div className="flex-1">
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4 text-center text-neutral-500">
          No conversations yet
        </div>
      </div>
      <BottomNav />
    </main>
  );
}
