"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, Match } from "@/lib/api";
import { isAuthenticated, removeToken } from "@/lib/auth";
import { useToast } from "@/components/Toast";
import { MatchCardSkeleton } from "@/components/Skeleton";
import { BottomNav } from "@/components/BottomNav";

type PageStatus = "loading" | "ready" | "empty";

export default function MatchesPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [status, setStatus] = useState<PageStatus>("loading");
  const [matches, setMatches] = useState<Match[]>([]);

  useEffect(() => {
    const loadMatches = async () => {
      if (!isAuthenticated()) {
        router.push("/login");
        return;
      }

      // Check session
      const sessionRes = await api.auth.getSession();
      if (sessionRes.error || !sessionRes.data?.user) {
        removeToken();
        router.push("/login");
        return;
      }

      if (!sessionRes.data.user.isVerified) {
        router.push("/verify");
        return;
      }

      // Load matches
      const matchesRes = await api.matches.getAll();

      if (matchesRes.error) {
        showToast("Failed to load matches", "error");
        setStatus("empty");
        return;
      }

      if (matchesRes.data?.matches && matchesRes.data.matches.length > 0) {
        setMatches(matchesRes.data.matches);
        setStatus("ready");
      } else {
        setStatus("empty");
      }
    };

    loadMatches();
  }, [router]);

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "now";
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString();
  };

  if (status === "loading") {
    return (
      <main className="container-mobile min-h-dvh pt-4 safe-top safe-bottom">
        <header className="mb-4 flex items-center justify-between">
          <div className="h-7 w-24 animate-pulse bg-neutral-800 rounded" />
          <div className="h-8 w-8 animate-pulse bg-neutral-800 rounded-full" />
        </header>
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <MatchCardSkeleton key={i} />
          ))}
        </div>
      </main>
    );
  }

  return (
    <main className="container-mobile min-h-dvh pt-4 safe-top safe-bottom">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Matches</h1>
        <Link
          href="/profile"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-800 text-sm hover:bg-neutral-700"
        >
          P
        </Link>
      </header>

      {status === "empty" ? (
        <div className="flex flex-1 flex-col items-center justify-center py-20">
          <img src="/logo.png" alt="Lovecoin" className="mb-4 h-16 w-16 opacity-50" />
          <p className="mb-2 text-lg font-medium text-neutral-300">No matches yet</p>
          <p className="mb-6 text-sm text-neutral-500">
            Keep swiping to find your match
          </p>
          <Link
            href="/discover"
            className="rounded-full bg-brand-600 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700"
          >
            Discover People
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {matches.map((match) => (
            <Link
              key={match.matchId}
              href={`/chat/${match.conversationId}`}
              className="flex items-center gap-3 rounded-xl border border-neutral-800 bg-neutral-900 p-3 transition-colors hover:bg-neutral-800"
            >
              {/* Avatar */}
              <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-xl font-bold text-white">
                {match.otherUser.displayName.charAt(0)}
              </div>

              {/* Info */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium">
                    {match.otherUser.displayName}
                    {match.otherUser.age && (
                      <span className="ml-1 text-neutral-400">, {match.otherUser.age}</span>
                    )}
                  </span>
                  {match.lastMessage && (
                    <span className="text-xs text-neutral-500">
                      {formatTime(match.lastMessage.sentAt)}
                    </span>
                  )}
                </div>

                {match.lastMessage ? (
                  <p className="truncate text-sm text-neutral-400">
                    {match.lastMessage.isFromMe && (
                      <span className="text-neutral-500">You: </span>
                    )}
                    {match.lastMessage.content || "[Photo]"}
                  </p>
                ) : (
                  <p className="text-sm text-brand-400">
                    New match! Say hello
                  </p>
                )}

                {match.otherUser.city && (
                  <p className="text-xs text-neutral-500">
                    {match.otherUser.city}
                    {match.otherUser.country && `, ${match.otherUser.country}`}
                  </p>
                )}
              </div>

              {/* Arrow */}
              <div className="text-neutral-600">&rsaquo;</div>
            </Link>
          ))}
        </div>
      )}

      <BottomNav />
    </main>
  );
}
