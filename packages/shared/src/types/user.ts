export interface User {
  id: string;
  walletAddress: string;
  isVerified: boolean;
  verificationTx: string | null;
  verificationAt: Date | null;
  isSuspended: boolean;
  createdAt: Date;
  lastActiveAt: Date;
}

export interface PublicUser {
  id: string;
  walletAddress: string;
  isVerified: boolean;
}
