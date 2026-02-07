"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, Match } from "@/lib/api";
import { isAuthenticated, removeToken } from "@/lib/auth";
import { BottomNav } from "@/components/BottomNav";

type PageStatus = "loading" | "ready" | "empty";

export default function ChatPage() {
  const router = useRouter();
  const [status, setStatus] = useState<PageStatus>("loading");
  const [conversations, setConversations] = useState<Match[]>([]);

  useEffect(() => {
    const loadConversations = async () => {
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

      // Load matches (which have conversations)
      const matchesRes = await api.matches.getAll();

      if (matchesRes.error) {
        setStatus("empty");
        return;
      }

      // Filter to only show matches with conversations (has messages)
      const withMessages = matchesRes.data?.matches?.filter(
        (m) => m.conversationId && m.lastMessage
      ) || [];

      if (withMessages.length > 0) {
        // Sort by most recent message
        withMessages.sort((a, b) => {
          const aTime = a.lastMessage ? new Date(a.lastMessage.sentAt).getTime() : 0;
          const bTime = b.lastMessage ? new Date(b.lastMessage.sentAt).getTime() : 0;
          return bTime - aTime;
        });
        setConversations(withMessages);
        setStatus("ready");
      } else {
        setStatus("empty");
      }
    };

    loadConversations();
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
      <main className="container-mobile min-h-dvh pt-4 safe-top safe-bottom bg-theme">
        <header className="mb-4">
          <div className="h-7 w-24 animate-pulse bg-theme-tertiary rounded" />
        </header>
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-theme-tertiary" />
          ))}
        </div>
      </main>
    );
  }

  return (
    <main className="container-mobile min-h-dvh pt-4 safe-top safe-bottom bg-theme">
      <header className="mb-4">
        <h1 className="text-xl font-bold text-theme">Messages</h1>
      </header>

      {status === "empty" ? (
        <div className="flex flex-1 flex-col items-center justify-center py-20">
          <svg className="mb-4 h-16 w-16 text-theme-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <p className="mb-2 text-lg font-medium text-theme">No messages yet</p>
          <p className="mb-6 text-sm text-theme-muted text-center">
            Match with someone and start a conversation
          </p>
          <Link
            href="/discover"
            className="rounded-full bg-brand-600 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700"
          >
            Find People
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {conversations.map((conv) => (
            <Link
              key={conv.matchId}
              href={`/chat/${conv.conversationId}`}
              className="flex items-center gap-3 rounded-xl border border-theme bg-theme-card p-3 transition-colors hover:bg-theme-tertiary"
            >
              {/* Avatar */}
              <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-xl font-bold text-white">
                {conv.otherUser.displayName.charAt(0)}
              </div>

              {/* Info */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-theme">
                    {conv.otherUser.displayName}
                  </span>
                  {conv.lastMessage && (
                    <span className="text-xs text-theme-muted">
                      {formatTime(conv.lastMessage.sentAt)}
                    </span>
                  )}
                </div>

                {conv.lastMessage && (
                  <p className="truncate text-sm text-theme-secondary">
                    {conv.lastMessage.isFromMe && (
                      <span className="text-theme-muted">You: </span>
                    )}
                    {conv.lastMessage.content || "[Photo]"}
                  </p>
                )}
              </div>

              {/* Arrow */}
              <div className="text-theme-muted text-xl">&rsaquo;</div>
            </Link>
          ))}
        </div>
      )}

      <BottomNav />
    </main>
  );
}
