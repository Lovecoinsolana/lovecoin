import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuidv4 } from "uuid";
import * as fs from "fs";
import * as path from "path";
import { config } from "../config.js";

// Check if we should use local storage (no S3 credentials)
const useLocalStorage = !config.s3AccessKeyId || !config.s3SecretAccessKey;

// Validate S3 configuration in production
if (config.isProduction && useLocalStorage) {
  console.warn(
    "WARNING: S3 credentials not configured. Photo uploads will fail in production. " +
    "Set S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY environment variables."
  );
}

// Local storage directory (relative to api folder)
const LOCAL_UPLOADS_DIR = path.join(process.cwd(), "uploads");

// Ensure local uploads directory exists (only in development)
if (useLocalStorage && !config.isProduction) {
  if (!fs.existsSync(LOCAL_UPLOADS_DIR)) {
    fs.mkdirSync(LOCAL_UPLOADS_DIR, { recursive: true });
  }
  console.log("Using local file storage for photos at:", LOCAL_UPLOADS_DIR);
}

// Initialize S3 client (only if credentials exist)
let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3Client) {
    if (!config.s3AccessKeyId || !config.s3SecretAccessKey) {
      throw new Error("S3 credentials not configured");
    }

    s3Client = new S3Client({
      region: config.s3Region,
      endpoint: config.s3Endpoint || undefined,
      credentials: {
        accessKeyId: config.s3AccessKeyId,
        secretAccessKey: config.s3SecretAccessKey,
      },
      forcePathStyle: !!config.s3Endpoint, // Required for MinIO/local S3
    });
  }
  return s3Client;
}

// Sanitize storage key to prevent path traversal
function sanitizeKey(key: string): string {
  // Remove any path traversal attempts
  return key.replace(/\.\./g, "").replace(/\/\//g, "/");
}

// Generate a unique storage key for a photo
export function generatePhotoKey(profileId: string, extension: string): string {
  // Sanitize inputs
  const safeProfileId = profileId.replace(/[^a-zA-Z0-9-]/g, "");
  const safeExtension = extension.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  const uuid = uuidv4();
  return `profiles/${safeProfileId}/${uuid}.${safeExtension}`;
}

// Upload a photo to S3 or local storage
export async function uploadPhoto(
  key: string,
  data: Buffer,
  contentType: string
): Promise<string> {
  const safeKey = sanitizeKey(key);

  if (useLocalStorage) {
    if (config.isProduction) {
      throw new Error("Local file storage not available in production. Configure S3.");
    }

    // Use local file storage
    const filePath = path.join(LOCAL_UPLOADS_DIR, safeKey);
    const dirPath = path.dirname(filePath);

    // Validate path is within uploads directory (prevent path traversal)
    const resolvedPath = path.resolve(filePath);
    if (!resolvedPath.startsWith(path.resolve(LOCAL_UPLOADS_DIR))) {
      throw new Error("Invalid file path");
    }

    // Create directory if it doesn't exist
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    fs.writeFileSync(filePath, data);
    return safeKey;
  }

  // Use S3
  const client = getS3Client();

  const command = new PutObjectCommand({
    Bucket: config.s3Bucket,
    Key: safeKey,
    Body: data,
    ContentType: contentType,
    // Cache for 1 year (photos are immutable - new uploads get new keys)
    CacheControl: "public, max-age=31536000, immutable",
    // Make publicly readable if using public bucket
    ...(config.s3PublicUrl ? {} : { ACL: "public-read" }),
  });

  await client.send(command);
  return safeKey;
}

// Delete a photo from S3 or local storage
export async function deletePhoto(key: string): Promise<void> {
  const safeKey = sanitizeKey(key);

  if (useLocalStorage) {
    if (config.isProduction) {
      throw new Error("Local file storage not available in production. Configure S3.");
    }

    const filePath = path.join(LOCAL_UPLOADS_DIR, safeKey);

    // Validate path is within uploads directory
    const resolvedPath = path.resolve(filePath);
    if (!resolvedPath.startsWith(path.resolve(LOCAL_UPLOADS_DIR))) {
      throw new Error("Invalid file path");
    }

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    return;
  }

  const client = getS3Client();

  const command = new DeleteObjectCommand({
    Bucket: config.s3Bucket,
    Key: safeKey,
  });

  await client.send(command);
}

// Get a signed URL for viewing a photo (for private buckets)
export async function getSignedPhotoUrl(
  key: string,
  expiresIn: number = 3600
): Promise<string> {
  const safeKey = sanitizeKey(key);

  if (useLocalStorage) {
    // For local storage, just return the static URL
    return getPhotoUrl(safeKey);
  }

  const client = getS3Client();

  const command = new GetObjectCommand({
    Bucket: config.s3Bucket,
    Key: safeKey,
  });

  return getSignedUrl(client, command, { expiresIn });
}

// Get the public URL for a photo
export function getPhotoUrl(key: string): string {
  const safeKey = sanitizeKey(key);

  if (useLocalStorage) {
    // Return URL served by API static route (development only)
    const baseUrl = config.apiBaseUrl || `http://localhost:${config.port}`;
    return `${baseUrl}/uploads/${safeKey}`;
  }

  // Use CDN/public URL if configured
  if (config.s3PublicUrl) {
    return `${config.s3PublicUrl}/${safeKey}`;
  }

  // Use custom S3 endpoint (MinIO, R2, etc.)
  if (config.s3Endpoint) {
    return `${config.s3Endpoint}/${config.s3Bucket}/${safeKey}`;
  }

  // Default AWS S3 URL
  return `https://${config.s3Bucket}.s3.${config.s3Region}.amazonaws.com/${safeKey}`;
}

// Validate file type by checking magic bytes (more secure than mime type)
export function isValidImageType(mimeType: string): boolean {
  const validTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  return validTypes.includes(mimeType);
}

// Validate image by checking magic bytes
export function validateImageBuffer(buffer: Buffer): { valid: boolean; type: string | null } {
  // Check magic bytes for common image formats
  if (buffer.length < 4) {
    return { valid: false, type: null };
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { valid: true, type: "image/jpeg" };
  }

  // PNG: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return { valid: true, type: "image/png" };
  }

  // GIF: 47 49 46 38
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) {
    return { valid: true, type: "image/gif" };
  }

  // WebP: 52 49 46 46 ... 57 45 42 50
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer.length > 11 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return { valid: true, type: "image/webp" };
  }

  return { valid: false, type: null };
}

// Get file extension from mime type
export function getExtensionFromMimeType(mimeType: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
  };
  return map[mimeType] || "jpg";
}

// Max file size: 5MB
export const MAX_PHOTO_SIZE = 5 * 1024 * 1024;

// Max photos per profile
export const MAX_PHOTOS_PER_PROFILE = 6;

// Check if S3 is configured
export function isS3Configured(): boolean {
  return !useLocalStorage;
}
