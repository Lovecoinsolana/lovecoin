"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useToast } from "@/components/Toast";
import { PageLoader } from "@/components/Skeleton";
import { api, Message } from "@/lib/api";
import { useTheme } from "@/context/ThemeContext";

export default function ChatConversationPage() {
  const params = useParams();
  const router = useRouter();
  const conversationId = params.conversationId as string;
  const { user, loading: authLoading } = useAuth({
    requireVerified: true,
    requireProfile: true,
  });

  const { showToast } = useToast();

  const [otherUser, setOtherUser] = useState<{
    userId: string;
    walletAddress: string;
    displayName: string;
  } | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingConversation, setLoadingConversation] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);

  // Use global theme
  const { isDark, toggleTheme } = useTheme();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const hasJoinedRoom = useRef(false);

  // Handle incoming WebSocket messages
  const handleWsMessage = useCallback(
    (wsMessage: { type: string; payload?: unknown }) => {
      if (wsMessage.type === "message:new") {
        const payload = wsMessage.payload as {
          conversationId: string;
          message: {
            id: string;
            content: string;
            contentType: string;
            senderId: string;
            paymentTx: string;
            sentAt: string;
          };
        };

        if (payload.conversationId !== conversationId) return;

        setMessages((prev) => {
          const exists = prev.some((m) => m.id === payload.message.id);
          if (exists) return prev;

          const newMessage: Message = {
            id: payload.message.id,
            content: payload.message.content,
            contentType: payload.message.contentType as "TEXT" | "PHOTO",
            senderId: payload.message.senderId,
            isFromMe: payload.message.senderId === user?.id,
            paymentTx: payload.message.paymentTx,
            sentAt: payload.message.sentAt,
            readAt: null,
          };

          return [...prev, newMessage];
        });
      }
    },
    [conversationId, user?.id]
  );

  const { isConnected, isAuthenticated, joinRoom, leaveRoom } = useWebSocket({
    onMessage: handleWsMessage,
    autoConnect: true,
  });

  useEffect(() => {
    if (isAuthenticated && conversationId && !hasJoinedRoom.current) {
      joinRoom(`conversation:${conversationId}`);
      hasJoinedRoom.current = true;
    }

    return () => {
      if (hasJoinedRoom.current && conversationId) {
        leaveRoom(`conversation:${conversationId}`);
        hasJoinedRoom.current = false;
      }
    };
  }, [isAuthenticated, conversationId, joinRoom, leaveRoom]);

  const fetchConversation = useCallback(async () => {
    if (!conversationId) return;

    const { data, error } = await api.conversations.get(conversationId);

    if (error) {
      setError(error);
      setLoadingConversation(false);
      return;
    }

    if (data?.conversation) {
      setOtherUser(data.conversation.otherUser);
      setMessages(data.conversation.messages);
    }

    setLoadingConversation(false);
  }, [conversationId]);

  useEffect(() => {
    if (!authLoading && user) {
      fetchConversation();
    }
  }, [authLoading, user, fetchConversation]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Fallback polling
  useEffect(() => {
    if (!conversationId || authLoading || !user) return;

    const pollInterval = isConnected ? 30000 : 5000;

    const interval = setInterval(async () => {
      const { data } = await api.conversations.get(conversationId);
      if (data?.conversation?.messages) {
        setMessages(data.conversation.messages);
      }
    }, pollInterval);

    return () => clearInterval(interval);
  }, [conversationId, authLoading, user, isConnected]);

  // Send message - FREE (no payment required)
  const handleSendMessage = async () => {
    if (!messageText.trim() || sending) {
      return;
    }

    setSending(true);

    try {
      const { data: messageData, error: messageError } =
        await api.conversations.sendMessage(
          conversationId,
          messageText.trim(),
          "free" // No payment tx needed
        );

      if (messageError) {
        showToast(messageError, "error");
        setSending(false);
        return;
      }

      if (messageData?.message) {
        setMessages((prev) => {
          const exists = prev.some((m) => m.id === messageData.message.id);
          if (exists) return prev;
          return [...prev, messageData.message];
        });
        setMessageText("");
        inputRef.current?.focus();
      }
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to send message";
      showToast(errorMessage, "error");
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (authLoading || loadingConversation) {
    return <PageLoader />;
  }

  if (error) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center p-4">
        <p className="text-red-400 mb-4">{error}</p>
        <button
          onClick={() => router.push("/matches")}
          className="text-brand-500 hover:underline"
        >
          Back to Matches
        </button>
      </main>
    );
  }

  // Theme classes using CSS variables
  const theme = {
    bg: "bg-theme",
    header: "bg-theme-secondary border-theme",
    headerText: "text-theme",
    headerSubtext: "text-theme-secondary",
    messageArea: "bg-theme",
    myMessage: "bg-brand-500 text-white",
    theirMessage: "bg-theme-tertiary text-theme",
    inputBg: "input-theme border border-theme-light",
    footer: "bg-theme-secondary border-theme",
    emptyText: "text-theme-muted",
    timestamp: "text-theme-secondary",
  };

  return (
    <main className={`flex h-dvh flex-col ${theme.bg}`}>
      {/* Header */}
      <header className={`border-b px-4 py-3 flex-shrink-0 ${theme.header}`}>
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/matches")}
            className={`${theme.headerSubtext} hover:${theme.headerText} transition-colors`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white font-semibold">
            {otherUser?.displayName?.[0]?.toUpperCase() || "?"}
          </div>
          <div className="flex-1 min-w-0">
            <p className={`font-medium truncate ${theme.headerText}`}>
              {otherUser?.displayName || "Unknown"}
            </p>
            <p className={`text-xs font-mono truncate ${theme.headerSubtext}`}>
              {otherUser?.walletAddress
                ? `${otherUser.walletAddress.slice(0, 4)}...${otherUser.walletAddress.slice(-4)}`
                : ""}
            </p>
          </div>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-full transition-colors bg-theme-tertiary hover:bg-theme-card"
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {isDark ? (
              <svg className="h-5 w-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z"
                  clipRule="evenodd"
                />
              </svg>
            ) : (
              <svg className="h-5 w-5 text-theme-secondary" fill="currentColor" viewBox="0 0 20 20">
                <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
              </svg>
            )}
          </button>

          {/* Connection indicator */}
          <div
            className={`h-2 w-2 rounded-full ${
              isConnected ? "bg-green-500" : "bg-yellow-500"
            }`}
            title={isConnected ? "Real-time connected" : "Using polling"}
          />
        </div>
      </header>

      {/* Messages */}
      <div className={`flex-1 overflow-y-auto p-4 space-y-3 ${theme.messageArea}`}>
        {messages.length === 0 ? (
          <div className={`flex flex-col items-center justify-center h-full ${theme.emptyText}`}>
            <p className="text-center text-sm">No messages yet.</p>
            <p className="text-center text-xs mt-1 opacity-70">
              Send the first message to start the conversation.
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.isFromMe ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                  message.isFromMe
                    ? `${theme.myMessage} rounded-br-sm`
                    : `${theme.theirMessage} rounded-bl-sm`
                }`}
              >
                <p className="text-sm whitespace-pre-wrap break-words">
                  {message.content}
                </p>
                <div
                  className={`text-[10px] mt-1 ${
                    message.isFromMe ? "text-white/70" : theme.timestamp
                  }`}
                >
                  {new Date(message.sentAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <footer className={`border-t p-4 flex-shrink-0 ${theme.footer}`}>
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            disabled={sending}
            className={`flex-1 rounded-full border px-4 py-3 text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 disabled:opacity-50 ${theme.inputBg}`}
          />
          <button
            onClick={handleSendMessage}
            disabled={!messageText.trim() || sending}
            className="rounded-full bg-brand-500 px-6 py-3 text-sm font-medium text-white transition-all hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              "Send"
            )}
          </button>
        </div>
      </footer>
    </main>
  );
}
