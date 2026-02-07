"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { useAuth } from "@/hooks/useAuth";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useToast } from "@/components/Toast";
import { MessageSkeleton, PageLoader } from "@/components/Skeleton";
import { api, Message } from "@/lib/api";

const MEMO_PROGRAM_ID = new PublicKey(
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"
);

export default function ChatConversationPage() {
  const params = useParams();
  const router = useRouter();
  const conversationId = params.conversationId as string;
  const { user, loading: authLoading } = useAuth({
    requireVerified: true,
    requireProfile: true,
  });

  const { publicKey, signTransaction, connected } = useWallet();
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
  const [paymentError, setPaymentError] = useState<string | null>(null);

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

        // Only handle messages for this conversation
        if (payload.conversationId !== conversationId) return;

        // Avoid duplicates - check if message already exists
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

  // WebSocket connection
  const { isConnected, isAuthenticated, joinRoom, leaveRoom } = useWebSocket({
    onMessage: handleWsMessage,
    autoConnect: true,
  });

  // Join conversation room when authenticated
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

  // Fetch conversation and messages
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

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Fallback polling (only when WebSocket is not connected)
  useEffect(() => {
    if (!conversationId || authLoading || !user) return;

    // If WebSocket is connected, use longer polling interval as fallback
    const pollInterval = isConnected ? 30000 : 5000;

    const interval = setInterval(async () => {
      const { data } = await api.conversations.get(conversationId);
      if (data?.conversation?.messages) {
        setMessages(data.conversation.messages);
      }
    }, pollInterval);

    return () => clearInterval(interval);
  }, [conversationId, authLoading, user, isConnected]);

  const handleSendMessage = async () => {
    if (!messageText.trim() || !publicKey || !signTransaction || sending) {
      return;
    }

    setSending(true);
    setPaymentError(null);

    try {
      // Get payment details
      const { data: paymentData, error: paymentDetailsError } =
        await api.conversations.getPaymentDetails(conversationId);

      if (paymentDetailsError || !paymentData) {
        const errorMsg = paymentDetailsError || "Failed to get payment details";
        setPaymentError(errorMsg);
        showToast(errorMsg, "error");
        setSending(false);
        return;
      }

      const { recipientWallet, amountLamports, memo } = paymentData;

      // Create transaction
      const connection = new Connection(
        process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
          "https://api.mainnet-beta.solana.com"
      );

      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash();

      const transaction = new Transaction({
        feePayer: publicKey,
        blockhash,
        lastValidBlockHeight,
      });

      // Add transfer instruction
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: new PublicKey(recipientWallet),
          lamports: amountLamports,
        })
      );

      // Add memo instruction
      transaction.add(
        new TransactionInstruction({
          keys: [],
          programId: MEMO_PROGRAM_ID,
          data: Buffer.from(memo, "utf-8"),
        })
      );

      // Sign transaction
      const signedTransaction = await signTransaction(transaction);

      // Send transaction
      const txSignature = await connection.sendRawTransaction(
        signedTransaction.serialize()
      );

      // Wait for confirmation
      await connection.confirmTransaction({
        signature: txSignature,
        blockhash,
        lastValidBlockHeight,
      });

      // Send message to API
      const { data: messageData, error: messageError } =
        await api.conversations.sendMessage(
          conversationId,
          messageText.trim(),
          txSignature
        );

      if (messageError) {
        setPaymentError(messageError);
        showToast(messageError, "error");
        setSending(false);
        return;
      }

      // Message will be added via WebSocket broadcast
      // But add it immediately for better UX if WS is slow
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
      setPaymentError(errorMessage);
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
          className="text-primary hover:underline"
        >
          Back to Matches
        </button>
      </main>
    );
  }

  return (
    <main className="flex h-dvh flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border px-4 py-3 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/matches")}
            className="text-text-light hover:text-text transition-colors"
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
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-semibold">
            {otherUser?.displayName?.[0]?.toUpperCase() || "?"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-text truncate">
              {otherUser?.displayName || "Unknown"}
            </p>
            <p className="text-xs text-text-light font-mono truncate">
              {otherUser?.walletAddress
                ? `${otherUser.walletAddress.slice(0, 4)}...${otherUser.walletAddress.slice(-4)}`
                : ""}
            </p>
          </div>
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
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-text-light">
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
                    ? "bg-primary text-white rounded-br-sm"
                    : "bg-border text-text rounded-bl-sm"
                }`}
              >
                <p className="text-sm whitespace-pre-wrap break-words">
                  {message.content}
                </p>
                <div
                  className={`text-[10px] mt-1 flex items-center gap-1 ${
                    message.isFromMe ? "text-white/70" : "text-text-light"
                  }`}
                >
                  <span>
                    {new Date(message.sentAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  {message.isFromMe && message.readAt && (
                    <span className="text-xs">Read</span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Payment error */}
      {paymentError && (
        <div className="px-4 py-2 bg-red-500/10 border-t border-red-500/20">
          <p className="text-red-400 text-sm text-center">{paymentError}</p>
        </div>
      )}

      {/* Input */}
      <footer className="border-t border-border p-4 flex-shrink-0">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            disabled={sending || !connected}
            className="flex-1 rounded-full border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 disabled:opacity-50"
          />
          <button
            onClick={handleSendMessage}
            disabled={!messageText.trim() || sending || !connected}
            className="rounded-full bg-primary px-5 py-3 text-sm font-medium text-white transition-all hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {sending ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <>
                <span>Send</span>
                <span className="text-xs opacity-80">0.0005</span>
              </>
            )}
          </button>
        </div>
        {!connected && (
          <p className="text-xs text-text-light text-center mt-2">
            Connect your wallet to send messages
          </p>
        )}
        <p className="text-xs text-text-light text-center mt-2 opacity-60">
          Each message costs 0.0005 SOL
        </p>
      </footer>
    </main>
  );
}
