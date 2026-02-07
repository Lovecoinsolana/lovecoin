import "dotenv/config";

// Environment detection
const isProduction = process.env.NODE_ENV === "production";

// Validate required secrets in production
function requireEnv(key: string, defaultValue?: string): string {
  const value = process.env[key] || defaultValue;
  if (!value && isProduction) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value || "";
}

// Validate JWT secret is not default in production
function validateJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  const defaultSecrets = [
    "development-secret",
    "dev-secret",
    "secret",
    "change-me",
    "development-secret-key-change-in-production",
  ];
  
  if (isProduction && (!secret || defaultSecrets.includes(secret.toLowerCase()))) {
    throw new Error(
      "JWT_SECRET must be set to a secure random value in production. " +
      "Generate with: openssl rand -base64 32"
    );
  }
  
  return secret || "development-secret-key-change-in-production";
}

export const config = {
  // Server
  port: parseInt(process.env.API_PORT || "3001", 10),
  host: process.env.API_HOST || "0.0.0.0",
  isProduction,

  // Database
  databaseUrl: requireEnv("DATABASE_URL", "postgresql://lovecoin:lovecoin_password@localhost:5432/lovecoin"),

  // Solana
  solanaRpcUrl: process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com",
  solanaNetwork: process.env.SOLANA_NETWORK || "devnet",
  platformWalletAddress: requireEnv("PLATFORM_WALLET_ADDRESS"),

  // JWT - validated for production
  jwtSecret: validateJwtSecret(),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",

  // Pricing (in lamports: 1 SOL = 1,000,000,000 lamports)
  // Verification: 0.01 SOL = 10,000,000 lamports
  verificationFeeLamports: parseInt(
    process.env.VERIFICATION_FEE_LAMPORTS || "10000000",
    10
  ),
  // Message: 0.0005 SOL = 500,000 lamports
  messageFeeLamports: parseInt(
    process.env.MESSAGE_FEE_LAMPORTS || "500000",
    10
  ),
  // Photo message: 0.001 SOL = 1,000,000 lamports
  photoMessageFeeLamports: parseInt(
    process.env.PHOTO_MESSAGE_FEE_LAMPORTS || "1000000",
    10
  ),

  // Marketplace platform fee (percentage)
  marketplaceFeePercent: parseFloat(
    process.env.MARKETPLACE_FEE_PERCENT || "3"
  ),

  // S3 Storage
  s3Bucket: process.env.S3_BUCKET || "lovecoin-photos",
  s3Region: process.env.S3_REGION || "us-east-1",
  s3Endpoint: process.env.S3_ENDPOINT || "", // Leave empty for AWS, set for MinIO/R2
  s3AccessKeyId: process.env.S3_ACCESS_KEY_ID || "",
  s3SecretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
  s3PublicUrl: process.env.S3_PUBLIC_URL || "", // CDN or public bucket URL

  // API URL (for generating URLs in responses)
  apiBaseUrl: process.env.API_BASE_URL || "", // e.g., https://api.lovecoin.app
} as const;

// Validate S3 in production
if (isProduction && (!process.env.S3_ACCESS_KEY_ID || !process.env.S3_SECRET_ACCESS_KEY)) {
  console.error(
    "ERROR: S3 credentials required in production. " +
    "Set S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY environment variables."
  );
}

// Log config summary on startup (not secrets)
if (!isProduction) {
  console.log("Config loaded:", {
    port: config.port,
    host: config.host,
    solanaNetwork: config.solanaNetwork,
    platformWallet: config.platformWalletAddress ? 
      `${config.platformWalletAddress.slice(0, 4)}...${config.platformWalletAddress.slice(-4)}` : 
      "NOT SET",
    verificationFee: `${config.verificationFeeLamports / 1e9} SOL`,
    messageFee: `${config.messageFeeLamports / 1e9} SOL`,
    s3Storage: config.s3AccessKeyId ? "S3 configured" : "Local storage (dev only)",
  });
}
