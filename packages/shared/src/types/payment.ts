export interface PaymentDetails {
  recipientWallet: string;
  amountLamports: number;
  amountSol: number;
  memo: string;
}

export interface VerificationPaymentDetails extends PaymentDetails {
  type: "verification";
}

export interface MessagePaymentDetails extends PaymentDetails {
  type: "message" | "photo_message";
  conversationId: string;
}

export interface PaymentConfirmation {
  transactionSignature: string;
}

export interface VerificationStatus {
  isVerified: boolean;
  verificationTx: string | null;
  verificationAt: Date | null;
}
