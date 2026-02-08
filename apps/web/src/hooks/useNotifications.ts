"use client";

import { useState, useEffect, useCallback } from "react";
import { api, PushSubscriptionData } from "@/lib/api";

export type NotificationPermission = "default" | "granted" | "denied" | "unsupported";

interface UseNotificationsReturn {
  permission: NotificationPermission;
  isSubscribed: boolean;
  isLoading: boolean;
  isSupported: boolean;
  subscribe: () => Promise<boolean>;
  unsubscribe: () => Promise<boolean>;
}

/**
 * Hook to manage push notification subscriptions
 * Safe to use - won't break anything if notifications aren't supported
 */
export function useNotifications(): UseNotificationsReturn {
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSupported, setIsSupported] = useState(false);

  // Check if notifications are supported
  useEffect(() => {
    const supported = 
      typeof window !== "undefined" &&
      "Notification" in window &&
      "serviceWorker" in navigator &&
      "PushManager" in window;

    setIsSupported(supported);

    if (supported) {
      setPermission(Notification.permission as NotificationPermission);
    } else {
      setPermission("unsupported");
      setIsLoading(false);
    }
  }, []);

  // Check current subscription status
  useEffect(() => {
    async function checkSubscription() {
      if (!isSupported) return;

      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        setIsSubscribed(!!subscription);
      } catch (error) {
        console.error("Error checking push subscription:", error);
      } finally {
        setIsLoading(false);
      }
    }

    checkSubscription();
  }, [isSupported]);

  // Subscribe to push notifications
  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported) return false;

    setIsLoading(true);

    try {
      // Request permission
      const permissionResult = await Notification.requestPermission();
      setPermission(permissionResult as NotificationPermission);

      if (permissionResult !== "granted") {
        setIsLoading(false);
        return false;
      }

      // Get VAPID key from server
      const { data: vapidData, error: vapidError } = await api.notifications.getVapidKey();
      
      if (vapidError || !vapidData?.publicKey) {
        console.error("Failed to get VAPID key:", vapidError);
        setIsLoading(false);
        return false;
      }

      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;

      // Subscribe to push manager
      // Pass VAPID key as string - modern browsers accept base64 URL-encoded strings directly
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidData.publicKey,
      });

      // Send subscription to server
      const subscriptionJSON = subscription.toJSON() as unknown as PushSubscriptionData;
      const { error: subscribeError } = await api.notifications.subscribe(subscriptionJSON);

      if (subscribeError) {
        console.error("Failed to save subscription:", subscribeError);
        // Unsubscribe from push manager if server save failed
        await subscription.unsubscribe();
        setIsLoading(false);
        return false;
      }

      setIsSubscribed(true);
      setIsLoading(false);
      return true;
    } catch (error) {
      console.error("Error subscribing to notifications:", error);
      setIsLoading(false);
      return false;
    }
  }, [isSupported]);

  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported) return false;

    setIsLoading(true);

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // Unsubscribe from server
        await api.notifications.unsubscribe(subscription.endpoint);
        
        // Unsubscribe from push manager
        await subscription.unsubscribe();
      }

      setIsSubscribed(false);
      setIsLoading(false);
      return true;
    } catch (error) {
      console.error("Error unsubscribing from notifications:", error);
      setIsLoading(false);
      return false;
    }
  }, [isSupported]);

  return {
    permission,
    isSubscribed,
    isLoading,
    isSupported,
    subscribe,
    unsubscribe,
  };
}
