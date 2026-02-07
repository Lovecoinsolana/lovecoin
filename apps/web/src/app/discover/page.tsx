"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api, DiscoveryProfile } from "@/lib/api";
import { isAuthenticated, removeToken } from "@/lib/auth";
import { BottomNav } from "@/components/BottomNav";

type PageStatus = "loading" | "ready" | "empty" | "swiping" | "match";

export default function DiscoverPage() {
  const router = useRouter();
  const [status, setStatus] = useState<PageStatus>("loading");
  const [profiles, setProfiles] = useState<DiscoveryProfile[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [matchedProfile, setMatchedProfile] = useState<DiscoveryProfile | null>(null);

  // Load profiles
  const loadProfiles = useCallback(async () => {
    const res = await api.discovery.getProfiles();

    if (res.error) {
      if (res.error === "Profile required") {
        router.push("/profile");
        return;
      }
      console.error("Failed to load profiles:", res.error);
      setStatus("empty");
      return;
    }

    if (res.data?.profiles && res.data.profiles.length > 0) {
      setProfiles(res.data.profiles);
      setCurrentIndex(0);
      setStatus("ready");
    } else {
      setStatus("empty");
    }
  }, [router]);

  useEffect(() => {
    const checkAuth = async () => {
      if (!isAuthenticated()) {
        router.push("/login");
        return;
      }

      // Check session
      const sessionRes = await api.auth.getSession();
      if (sessionRes.error || !sessionRes.data?.user) {
        removeToken();
        router.push("/login");
        return;
      }

      if (!sessionRes.data.user.isVerified) {
        router.push("/verify");
        return;
      }

      // Check profile
      const profileRes = await api.profile.exists();
      if (!profileRes.data?.exists) {
        router.push("/profile");
        return;
      }

      // Load discovery profiles
      await loadProfiles();
    };

    checkAuth();
  }, [router, loadProfiles]);

  const currentProfile = profiles[currentIndex];

  const handleLike = async () => {
    if (!currentProfile || status === "swiping") return;

    setStatus("swiping");

    const res = await api.discovery.like(currentProfile.userId);

    if (res.error) {
      console.error("Like failed:", res.error);
      setStatus("ready");
      return;
    }

    if (res.data?.isMatch) {
      // Show match modal
      setMatchedProfile(currentProfile);
      setStatus("match");
    } else {
      // Move to next profile
      moveToNext();
    }
  };

  const handlePass = async () => {
    if (!currentProfile || status === "swiping") return;

    setStatus("swiping");

    const res = await api.discovery.pass(currentProfile.userId);

    if (res.error) {
      console.error("Pass failed:", res.error);
      setStatus("ready");
      return;
    }

    moveToNext();
  };

  const moveToNext = () => {
    if (currentIndex < profiles.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setStatus("ready");
    } else {
      // No more profiles, try to load more
      loadProfiles();
    }
  };

  const handleMatchContinue = () => {
    setMatchedProfile(null);
    moveToNext();
  };

  const handleGoToChat = () => {
    router.push("/matches");
  };

  if (status === "loading") {
    return (
      <main className="container-mobile flex min-h-dvh flex-col items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      </main>
    );
  }

  // Match modal
  if (status === "match" && matchedProfile) {
    return (
      <main className="container-mobile flex min-h-dvh flex-col items-center justify-center">
        <div className="text-center">
          <h1 className="mb-2 text-3xl font-bold text-brand-500">It&apos;s a Match!</h1>
          <p className="mb-8 text-neutral-400">
            You and {matchedProfile.displayName} liked each other
          </p>

          <div className="mb-8 flex justify-center">
            <div className="h-32 w-32 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 p-1">
              <div className="flex h-full w-full items-center justify-center rounded-full bg-neutral-900 text-4xl font-bold">
                {matchedProfile.displayName.charAt(0)}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={handleGoToChat}
              className="w-full rounded-full bg-brand-600 py-3 font-medium text-white transition-colors hover:bg-brand-700"
            >
              Send a Message
            </button>
            <button
              onClick={handleMatchContinue}
              className="w-full rounded-full border border-neutral-700 py-3 font-medium text-neutral-300 transition-colors hover:bg-neutral-800"
            >
              Keep Swiping
            </button>
          </div>
        </div>
      </main>
    );
  }

  // Empty state
  if (status === "empty") {
    return (
      <main className="container-mobile flex min-h-dvh flex-col pt-4 safe-top">
        <header className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-bold">Discover</h1>
          <a
            href="/profile"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-800 text-sm hover:bg-neutral-700"
          >
            P
          </a>
        </header>
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <p className="mb-2 text-lg font-medium text-neutral-300">No more profiles</p>
            <p className="mb-4 text-sm text-neutral-500">Check back later for new people</p>
            <button
              onClick={loadProfiles}
              className="rounded-full bg-brand-600 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700"
            >
              Refresh
            </button>
          </div>
        </div>
        <BottomNav />
      </main>
    );
  }

  // Main discovery view
  return (
    <main className="container-mobile flex min-h-dvh flex-col pt-4 safe-top">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Discover</h1>
        <a
          href="/profile"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-800 text-sm hover:bg-neutral-700"
        >
          P
        </a>
      </header>

      {currentProfile && (
        <div className="flex flex-1 flex-col">
          {/* Profile Card */}
          <div className="relative flex-1">
            <div className="absolute inset-0 overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900">
              {/* Profile Image Placeholder */}
              <div className="flex h-2/3 items-center justify-center bg-gradient-to-br from-neutral-800 to-neutral-900">
                <span className="text-8xl font-bold text-neutral-700">
                  {currentProfile.displayName.charAt(0)}
                </span>
              </div>

              {/* Profile Info */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-4 pt-16">
                <div className="mb-2">
                  <span className="text-2xl font-bold">{currentProfile.displayName}</span>
                  <span className="ml-2 text-xl text-neutral-300">{currentProfile.age}</span>
                </div>

                {(currentProfile.city || currentProfile.country) && (
                  <p className="mb-2 text-sm text-neutral-400">
                    {[currentProfile.city, currentProfile.country].filter(Boolean).join(", ")}
                  </p>
                )}

                {currentProfile.bio && (
                  <p className="mb-3 line-clamp-2 text-sm text-neutral-300">
                    {currentProfile.bio}
                  </p>
                )}

                {currentProfile.interests.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {currentProfile.interests.slice(0, 4).map((interest) => (
                      <span
                        key={interest}
                        className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-neutral-300"
                      >
                        {interest}
                      </span>
                    ))}
                    {currentProfile.interests.length > 4 && (
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-neutral-300">
                        +{currentProfile.interests.length - 4}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-center gap-6 py-6">
            <button
              onClick={handlePass}
              disabled={status === "swiping"}
              className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-neutral-600 bg-neutral-900 text-2xl text-neutral-400 transition-all hover:scale-105 hover:border-neutral-500 hover:text-white disabled:opacity-50"
            >
              X
            </button>
            <button
              onClick={handleLike}
              disabled={status === "swiping"}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-600 text-2xl text-white shadow-lg shadow-brand-600/30 transition-all hover:scale-105 hover:bg-brand-500 disabled:opacity-50"
            >
              &hearts;
            </button>
          </div>
        </div>
      )}

      <BottomNav />
    </main>
  );
}
