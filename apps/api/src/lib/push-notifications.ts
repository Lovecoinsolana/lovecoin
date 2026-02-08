import webpush from "web-push";
import { prisma } from "./prisma.js";
import { config } from "../config.js";

// Initialize web-push with VAPID keys if configured
let pushEnabled = false;

if (config.vapidPublicKey && config.vapidPrivateKey) {
  webpush.setVapidDetails(
    config.vapidSubject,
    config.vapidPublicKey,
    config.vapidPrivateKey
  );
  pushEnabled = true;
  console.log("Push notifications enabled");
} else {
  console.log("Push notifications disabled - VAPID keys not configured");
}

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  url?: string;
  tag?: string;
  data?: Record<string, unknown>;
}

/**
 * Send a push notification to a specific user
 * Wrapped in try-catch to never affect core functionality
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload
): Promise<void> {
  if (!pushEnabled) {
    return;
  }

  try {
    // Get all push subscriptions for this user
    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId },
    });

    if (subscriptions.length === 0) {
      return;
    }

    const notification = JSON.stringify({
      title: payload.title,
      body: payload.body,
      icon: payload.icon || "/logo.png",
      badge: payload.badge || "/logo.png",
      url: payload.url || "/",
      tag: payload.tag,
      data: payload.data,
    });

    // Send to all devices, handle failures gracefully
    const sendPromises = subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          notification
        );
      } catch (error: unknown) {
        // If subscription is expired/invalid, remove it
        if (
          error instanceof webpush.WebPushError &&
          (error.statusCode === 404 || error.statusCode === 410)
        ) {
          await prisma.pushSubscription.delete({
            where: { id: sub.id },
          }).catch(() => {});
        }
        // Log but don't throw - notification failures shouldn't break anything
        console.error(`Push notification failed for subscription ${sub.id}:`, error);
      }
    });

    await Promise.allSettled(sendPromises);
  } catch (error) {
    // Never throw - notifications are a nice-to-have, not critical
    console.error("Error sending push notifications:", error);
  }
}

/**
 * Send notification for a new match
 */
export async function notifyNewMatch(
  userId: string,
  matchedUserName: string
): Promise<void> {
  await sendPushToUser(userId, {
    title: "New Match!",
    body: `${matchedUserName} liked you back`,
    url: "/matches",
    tag: "new-match",
    data: { type: "match" },
  });
}

/**
 * Send notification for a new message
 */
export async function notifyNewMessage(
  userId: string,
  senderName: string,
  conversationId: string,
  messagePreview: string
): Promise<void> {
  const preview = messagePreview.length > 50 
    ? messagePreview.slice(0, 47) + "..." 
    : messagePreview;

  await sendPushToUser(userId, {
    title: senderName,
    body: preview,
    url: `/chat/${conversationId}`,
    tag: `message-${conversationId}`,
    data: { type: "message", conversationId },
  });
}

/**
 * Send notification for a listing sale
 */
export async function notifyListingSold(
  sellerId: string,
  listingTitle: string,
  priceSol: number
): Promise<void> {
  await sendPushToUser(sellerId, {
    title: "Item Sold!",
    body: `${listingTitle} sold for ${priceSol} SOL`,
    url: "/shop?tab=sales",
    tag: "listing-sold",
    data: { type: "sale" },
  });
}

/**
 * Get VAPID public key for frontend subscription
 */
export function getVapidPublicKey(): string | null {
  return pushEnabled ? config.vapidPublicKey : null;
}

export { pushEnabled };
