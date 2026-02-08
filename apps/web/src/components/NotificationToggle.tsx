"use client";

import { useNotifications } from "@/hooks/useNotifications";

export function NotificationToggle() {
  const { permission, isSubscribed, isLoading, isSupported, subscribe, unsubscribe } = useNotifications();

  // Don't show if not supported
  if (!isSupported) {
    return null;
  }

  const handleToggle = async () => {
    if (isSubscribed) {
      await unsubscribe();
    } else {
      await subscribe();
    }
  };

  return (
    <div className="flex items-center justify-between py-3 border-b border-theme">
      <div>
        <p className="text-sm font-medium text-theme">Push Notifications</p>
        <p className="text-xs text-theme-secondary">
          {permission === "denied" 
            ? "Blocked in browser settings" 
            : isSubscribed 
              ? "Enabled - You'll receive notifications" 
              : "Enable to get notified of new matches and messages"}
        </p>
      </div>
      <button
        onClick={handleToggle}
        disabled={isLoading || permission === "denied"}
        className={`relative w-12 h-6 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:opacity-50 ${
          isSubscribed ? "bg-brand-600" : "bg-neutral-600"
        }`}
        aria-label={isSubscribed ? "Disable notifications" : "Enable notifications"}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
            isSubscribed ? "translate-x-6" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}
