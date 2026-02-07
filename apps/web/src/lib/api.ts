const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface ApiResponse<T> {
  data?: T;
  error?: string;
}

async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...options.headers,
    };

    if (token) {
      (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      return { error: data.error || "Request failed" };
    }

    return { data };
  } catch (error) {
    return { error: "Network error" };
  }
}

// Separate function for multipart uploads (no JSON Content-Type)
async function uploadFile<T>(
  endpoint: string,
  file: File
): Promise<ApiResponse<T>> {
  try {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

    const formData = new FormData();
    formData.append("file", file);

    const headers: HeadersInit = {};

    if (token) {
      (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
      method: "POST",
      headers,
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      return { error: data.error || "Upload failed" };
    }

    return { data };
  } catch (error) {
    return { error: "Network error" };
  }
}

export const api = {
  auth: {
    getChallenge: (wallet: string) =>
      fetchApi<{ message: string; nonce: string }>(
        `/auth/challenge?wallet=${wallet}`
      ),

    verify: (wallet: string, signature: string, nonce: string) =>
      fetchApi<{
        token: string;
        user: { id: string; walletAddress: string; isVerified: boolean };
      }>("/auth/verify", {
        method: "POST",
        body: JSON.stringify({ wallet, signature, nonce }),
      }),

    getSession: () =>
      fetchApi<{
        valid: boolean;
        user: { id: string; walletAddress: string; isVerified: boolean };
      }>("/auth/session"),

    logout: () =>
      fetchApi<{ success: boolean }>("/auth/logout", { method: "POST", body: JSON.stringify({}) }),
  },

  verification: {
    getStatus: () =>
      fetchApi<{
        isVerified: boolean;
        verificationTx: string | null;
        verificationAt: string | null;
      }>("/verification/status"),

    getPaymentDetails: () =>
      fetchApi<{
        recipientWallet: string;
        amountLamports: number;
        amountSol: number;
        memo: string;
      }>("/verification/payment-details"),

    confirm: (txSignature: string) =>
      fetchApi<{
        success: boolean;
        isVerified: boolean;
        verificationTx: string;
        verificationAt: string;
      }>("/verification/confirm", {
        method: "POST",
        headers: {
          "X-PAYMENT": txSignature,
        },
        body: JSON.stringify({}),
      }),
  },

  profile: {
    get: () =>
      fetchApi<{
        profile: Profile;
      }>("/profile"),

    exists: () =>
      fetchApi<{ exists: boolean }>("/profile/exists"),

    create: (data: CreateProfileInput) =>
      fetchApi<{ profile: Profile }>("/profile", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    update: (data: UpdateProfileInput) =>
      fetchApi<{ profile: Profile }>("/profile", {
        method: "PATCH",
        body: JSON.stringify(data),
      }),

    uploadPhoto: (file: File) =>
      uploadFile<{ photo: PhotoUploadResponse }>("/profile/photos", file),

    deletePhoto: (photoId: string) =>
      fetchApi<{ success: boolean }>(`/profile/photos/${photoId}`, {
        method: "DELETE",
        body: JSON.stringify({}),
      }),

    updatePhotoPosition: (photoId: string, position: number) =>
      fetchApi<{ photos: PhotoUploadResponse[] }>(`/profile/photos/${photoId}/position`, {
        method: "PATCH",
        body: JSON.stringify({ position }),
      }),

    setPhotoPrimary: (photoId: string) =>
      fetchApi<{ success: boolean }>(`/profile/photos/${photoId}/primary`, {
        method: "PATCH",
        body: JSON.stringify({}),
      }),
  },

  discovery: {
    getProfiles: () =>
      fetchApi<{ profiles: DiscoveryProfile[] }>("/discovery"),

    like: (userId: string) =>
      fetchApi<{ success: boolean; action: string; isMatch: boolean; matchId?: string }>(
        `/discovery/like/${userId}`,
        { method: "POST", body: JSON.stringify({}) }
      ),

    pass: (userId: string) =>
      fetchApi<{ success: boolean; action: string; isMatch: boolean }>(
        `/discovery/pass/${userId}`,
        { method: "POST", body: JSON.stringify({}) }
      ),
  },

  matches: {
    getAll: () =>
      fetchApi<{ matches: Match[] }>("/matches"),

    get: (matchId: string) =>
      fetchApi<{ match: MatchDetail }>(`/matches/${matchId}`),

    unmatch: (matchId: string) =>
      fetchApi<{ success: boolean }>(`/matches/${matchId}`, { method: "DELETE", body: JSON.stringify({}) }),
  },

  conversations: {
    getAll: () =>
      fetchApi<{ conversations: ConversationPreview[] }>("/conversations"),

    get: (conversationId: string) =>
      fetchApi<{ conversation: Conversation }>(`/conversations/${conversationId}`),

    getMessages: (conversationId: string, cursor?: string) =>
      fetchApi<{ messages: Message[]; nextCursor: string | null }>(
        `/conversations/${conversationId}/messages${cursor ? `?cursor=${cursor}` : ""}`
      ),

    getPaymentDetails: (conversationId: string) =>
      fetchApi<{
        recipientWallet: string;
        amountLamports: number;
        amountSol: number;
        memo: string;
      }>(`/conversations/${conversationId}/payment-details`),

    sendMessage: (conversationId: string, content: string, _txSignature?: string) =>
      fetchApi<{ message: Message }>(`/conversations/${conversationId}/messages`, {
        method: "POST",
        body: JSON.stringify({ content }),
      }),

    markRead: (conversationId: string) =>
      fetchApi<{ success: boolean }>(`/conversations/${conversationId}/read`, {
        method: "PATCH",
        body: JSON.stringify({}),
      }),
  },

  users: {
    block: (userId: string) =>
      fetchApi<{ success: boolean }>(`/users/${userId}/block`, {
        method: "POST",
        body: JSON.stringify({}),
      }),

    unblock: (userId: string) =>
      fetchApi<{ success: boolean }>(`/users/${userId}/block`, {
        method: "DELETE",
        body: JSON.stringify({}),
      }),

    isBlocked: (userId: string) =>
      fetchApi<{ isBlocked: boolean }>(`/users/${userId}/block`),

    getBlockedList: () =>
      fetchApi<{
        blockedUsers: {
          userId: string;
          walletAddress: string;
          displayName: string;
          blockedAt: string;
        }[];
      }>("/users/blocked"),

    report: (userId: string, reason: ReportReason, details?: string) =>
      fetchApi<{ success: boolean; reportId: string; message: string }>(
        `/users/${userId}/report`,
        {
          method: "POST",
          body: JSON.stringify({ reason, details }),
        }
      ),

    getReportReasons: () =>
      fetchApi<{ reasons: ReportReason[] }>("/users/report-reasons"),
  },
};

// Report types
export type ReportReason =
  | "SPAM"
  | "HARASSMENT"
  | "INAPPROPRIATE_CONTENT"
  | "FAKE_PROFILE"
  | "SCAM"
  | "OTHER";

// Profile types
export interface Profile {
  id: string;
  displayName: string;
  birthDate: string;
  bio: string | null;
  gender: string | null;
  lookingFor: string[];
  interests: string[];
  city: string | null;
  country: string | null;
  photos: ProfilePhoto[];
  createdAt: string;
  updatedAt: string;
}

export interface ProfilePhoto {
  id: string;
  storageKey: string;
  position: number;
  isPrimary: boolean;
}

export interface PhotoUploadResponse {
  id: string;
  url: string;
  position: number;
  isPrimary: boolean;
  createdAt?: string;
}

export interface CreateProfileInput {
  displayName: string;
  birthDate: string;
  bio?: string;
  gender?: string;
  lookingFor?: string[];
  interests?: string[];
  city?: string;
  country?: string;
}

export interface UpdateProfileInput {
  displayName?: string;
  bio?: string;
  gender?: string;
  lookingFor?: string[];
  interests?: string[];
  city?: string;
  country?: string;
}

// Discovery types
export interface DiscoveryProfile {
  userId: string;
  walletAddress: string;
  displayName: string;
  age: number;
  bio: string | null;
  gender: string | null;
  interests: string[];
  city: string | null;
  country: string | null;
  photos: ProfilePhoto[];
}

// Match types
export interface Match {
  matchId: string;
  conversationId: string | null;
  matchedAt: string;
  otherUser: {
    userId: string;
    walletAddress: string;
    displayName: string;
    age: number | null;
    bio: string | null;
    city: string | null;
    country: string | null;
    primaryPhoto: string | null;
  };
  lastMessage: {
    id: string;
    content: string | null;
    sentAt: string;
    isFromMe: boolean;
  } | null;
}

export interface MatchDetail {
  matchId: string;
  conversationId: string | null;
  matchedAt: string;
  otherUser: {
    userId: string;
    walletAddress: string;
    displayName: string;
    age: number | null;
    bio: string | null;
    gender: string | null;
    interests: string[];
    city: string | null;
    country: string | null;
    photos: ProfilePhoto[];
  };
}

// Conversation types
export interface ConversationPreview {
  id: string;
  matchId: string;
  otherUser: {
    userId: string;
    displayName: string;
  };
  lastMessage: {
    content: string;
    sentAt: string;
    isFromMe: boolean;
  } | null;
  lastMessageAt: string | null;
}

export interface Conversation {
  id: string;
  matchId: string;
  otherUser: {
    userId: string;
    walletAddress: string;
    displayName: string;
  };
  messages: Message[];
}

export interface Message {
  id: string;
  content: string;
  contentType: "TEXT" | "PHOTO";
  senderId: string;
  isFromMe: boolean;
  paymentTx: string;
  sentAt: string;
  readAt: string | null;
}
