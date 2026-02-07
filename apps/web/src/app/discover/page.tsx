"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api, DiscoveryProfile } from "@/lib/api";
import { isAuthenticated, removeToken } from "@/lib/auth";
import { BottomNav } from "@/components/BottomNav";

type PageStatus = "loading" | "ready" | "empty" | "swiping" | "match";

const S3_PUBLIC_URL = process.env.NEXT_PUBLIC_S3_URL || "";
const S3_BUCKET = process.env.NEXT_PUBLIC_S3_BUCKET || "lovecoin-photos";
const S3_REGION = process.env.NEXT_PUBLIC_S3_REGION || "us-east-1";
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

function getPhotoUrl(storageKey: string): string {
  // Check if it's a local upload (starts with "uploads/")
  if (storageKey.startsWith("uploads/")) {
    return `${API_URL}/${storageKey}`;
  }
  // S3 URL
  if (S3_PUBLIC_URL) {
    return `${S3_PUBLIC_URL}/${storageKey}`;
  }
  return `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${storageKey}`;
}

export default function DiscoverPage() {
  const router = useRouter();
  const [status, setStatus] = useState<PageStatus>("loading");
  const [profiles, setProfiles] = useState<DiscoveryProfile[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [matchedProfile, setMatchedProfile] = useState<DiscoveryProfile | null>(null);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);

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
      setCurrentPhotoIndex(0);
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
    setCurrentPhotoIndex(0);
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

  const handleNextPhoto = () => {
    if (currentProfile && currentProfile.photos.length > 1) {
      setCurrentPhotoIndex((prev) => 
        prev < currentProfile.photos.length - 1 ? prev + 1 : 0
      );
    }
  };

  const handlePrevPhoto = () => {
    if (currentProfile && currentProfile.photos.length > 1) {
      setCurrentPhotoIndex((prev) => 
        prev > 0 ? prev - 1 : currentProfile.photos.length - 1
      );
    }
  };

  // Get primary photo or first photo
  const getPrimaryPhoto = (profile: DiscoveryProfile) => {
    if (!profile.photos || profile.photos.length === 0) return null;
    const primary = profile.photos.find(p => p.isPrimary);
    return primary || profile.photos[0];
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
    const matchPhoto = getPrimaryPhoto(matchedProfile);
    return (
      <main className="container-mobile flex min-h-dvh flex-col items-center justify-center">
        <div className="text-center">
          <h1 className="mb-2 text-3xl font-bold text-brand-500">It&apos;s a Match!</h1>
          <p className="mb-8 text-neutral-400">
            You and {matchedProfile.displayName} liked each other
          </p>

          <div className="mb-8 flex justify-center">
            <div className="h-32 w-32 overflow-hidden rounded-full bg-gradient-to-br from-brand-500 to-brand-700 p-1">
              {matchPhoto ? (
                <img
                  src={getPhotoUrl(matchPhoto.storageKey)}
                  alt={matchedProfile.displayName}
                  className="h-full w-full rounded-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center rounded-full bg-neutral-900 text-4xl font-bold">
                  {matchedProfile.displayName.charAt(0)}
                </div>
              )}
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
        <Header />
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

  const currentPhoto = currentProfile?.photos?.[currentPhotoIndex];
  const hasPhotos = currentProfile?.photos && currentProfile.photos.length > 0;
  const hasMultiplePhotos = currentProfile?.photos && currentProfile.photos.length > 1;

  // Main discovery view
  return (
    <main className="flex min-h-dvh flex-col bg-neutral-950">
      <Header />

      {currentProfile && (
        <div className="flex flex-1 flex-col px-4 pb-4">
          {/* Profile Card */}
          <div className="relative flex-1 overflow-hidden rounded-3xl bg-neutral-900 shadow-2xl">
            {/* Photo */}
            {hasPhotos && currentPhoto ? (
              <img
                src={getPhotoUrl(currentPhoto.storageKey)}
                alt={currentProfile.displayName}
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-neutral-800 via-neutral-900 to-neutral-950">
                <span className="text-[12rem] font-bold text-neutral-700/50">
                  {currentProfile.displayName.charAt(0)}
                </span>
              </div>
            )}

            {/* Photo navigation indicators */}
            {hasMultiplePhotos && (
              <div className="absolute left-0 right-0 top-3 flex justify-center gap-1 px-4">
                {currentProfile.photos.map((_, idx) => (
                  <div
                    key={idx}
                    className={`h-1 flex-1 rounded-full transition-all ${
                      idx === currentPhotoIndex
                        ? "bg-white"
                        : "bg-white/30"
                    }`}
                  />
                ))}
              </div>
            )}

            {/* Photo navigation tap zones */}
            {hasMultiplePhotos && (
              <>
                <button
                  onClick={handlePrevPhoto}
                  className="absolute bottom-0 left-0 top-0 w-1/3"
                  aria-label="Previous photo"
                />
                <button
                  onClick={handleNextPhoto}
                  className="absolute bottom-0 right-0 top-0 w-1/3"
                  aria-label="Next photo"
                />
              </>
            )}

            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />

            {/* Profile Info Overlay */}
            <div className="absolute bottom-0 left-0 right-0 p-5">
              {/* Name & Age */}
              <div className="mb-1 flex items-baseline gap-2">
                <h2 className="text-3xl font-bold text-white drop-shadow-lg">
                  {currentProfile.displayName}
                </h2>
                <span className="text-2xl font-light text-white/90">
                  {currentProfile.age}
                </span>
              </div>

              {/* Location */}
              {(currentProfile.city || currentProfile.country) && (
                <p className="mb-3 flex items-center gap-1 text-sm text-white/70">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {[currentProfile.city, currentProfile.country].filter(Boolean).join(", ")}
                </p>
              )}
            </div>
          </div>

          {/* Bio & Interests Card */}
          <div className="mt-3 rounded-2xl bg-white p-4">
            {currentProfile.bio && (
              <p className="mb-3 text-sm text-neutral-600">
                {currentProfile.bio}
              </p>
            )}

            {currentProfile.interests.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {currentProfile.interests.map((interest) => (
                  <span
                    key={interest}
                    className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs font-medium uppercase tracking-wide text-neutral-600"
                  >
                    {interest}
                  </span>
                ))}
              </div>
            )}

            {!currentProfile.bio && currentProfile.interests.length === 0 && (
              <p className="text-center text-sm text-neutral-400">
                No bio or interests yet
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-center gap-4 py-5">
            {/* Pass Button */}
            <button
              onClick={handlePass}
              disabled={status === "swiping"}
              className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-neutral-300 bg-white text-neutral-400 shadow-lg transition-all hover:scale-110 hover:border-red-400 hover:text-red-500 disabled:opacity-50"
            >
              <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Super Like Button */}
            <button
              disabled={status === "swiping"}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-500 text-white shadow-lg transition-all hover:scale-110 hover:bg-purple-400 disabled:opacity-50"
            >
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </button>

            {/* Like Button */}
            <button
              onClick={handleLike}
              disabled={status === "swiping"}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-600 shadow-lg shadow-brand-500/40 transition-all hover:scale-110 hover:shadow-brand-500/60 disabled:opacity-50"
            >
              <img src="/logo.png" alt="Like" className="h-8 w-8" />
            </button>
          </div>
        </div>
      )}

      <BottomNav />
    </main>
  );
}

function Header() {
  return (
    <header className="flex items-center justify-between px-4 py-3">
      <div className="flex items-center gap-2">
        <img src="/logo.png" alt="Lovecoin" className="h-8 w-8" />
        <span className="text-xl font-bold tracking-tight text-brand-500">LOVECOIN</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1 rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1 text-xs font-medium text-green-400">
          <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          VERIFIED
        </span>
      </div>
    </header>
  );
}
