import type { ProfileWithPhotos } from "./profile.js";

export interface Match {
  id: string;
  matchedAt: Date;
  isActive: boolean;
  conversationId: string;
  profile: ProfileWithPhotos;
}

export interface MatchListItem {
  id: string;
  matchedAt: Date;
  profile: {
    id: string;
    displayName: string;
    primaryPhoto: string | null;
  };
  lastMessage?: {
    content: string;
    sentAt: Date;
    isFromMe: boolean;
  };
}
