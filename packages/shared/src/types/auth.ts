export interface AuthChallenge {
  message: string;
  nonce: string;
  expiresAt: number;
}

export interface AuthChallengeRequest {
  walletAddress: string;
}

export interface AuthVerifyRequest {
  walletAddress: string;
  signature: string;
  message: string;
}

export interface AuthSession {
  token: string;
  expiresAt: number;
  user: {
    id: string;
    walletAddress: string;
    isVerified: boolean;
  };
}

export interface AuthSessionCheck {
  valid: boolean;
  user?: {
    id: string;
    walletAddress: string;
    isVerified: boolean;
  };
}
