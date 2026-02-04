export type MessageContentType = "TEXT" | "PHOTO";

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  contentType: MessageContentType;
  content: string | null;
  mediaKey: string | null;
  paymentTx: string;
  paymentAmount: bigint;
  sentAt: Date;
  readAt: Date | null;
}

export interface MessageListItem {
  id: string;
  senderId: string;
  contentType: MessageContentType;
  content: string | null;
  mediaUrl: string | null;
  paymentTx: string;
  sentAt: Date;
  readAt: Date | null;
  isFromMe: boolean;
}

export interface SendMessageInput {
  contentType: MessageContentType;
  content?: string;
  paymentTx: string;
}

export interface Conversation {
  id: string;
  matchId: string;
  createdAt: Date;
  lastMessageAt: Date | null;
  otherUser: {
    id: string;
    displayName: string;
    primaryPhoto: string | null;
    isOnline: boolean;
  };
  messages: MessageListItem[];
}
