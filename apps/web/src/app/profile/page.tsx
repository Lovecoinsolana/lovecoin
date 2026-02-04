"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { api, CreateProfileInput, UpdateProfileInput, PhotoUploadResponse } from "@/lib/api";
import { isAuthenticated, removeToken } from "@/lib/auth";

type PageStatus = "loading" | "creating" | "editing" | "saving" | "error";

interface PhotoWithUrl extends PhotoUploadResponse {
  url: string;
}

const GENDER_OPTIONS = ["Man", "Woman", "Non-binary", "Other"];
const LOOKING_FOR_OPTIONS = ["Men", "Women", "Everyone"];

const S3_PUBLIC_URL = process.env.NEXT_PUBLIC_S3_URL || "";
const S3_BUCKET = process.env.NEXT_PUBLIC_S3_BUCKET || "lovecoin-photos";
const S3_REGION = process.env.NEXT_PUBLIC_S3_REGION || "us-east-1";

function getPhotoUrl(storageKey: string): string {
  if (S3_PUBLIC_URL) {
    return `${S3_PUBLIC_URL}/${storageKey}`;
  }
  return `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${storageKey}`;
}

export default function ProfilePage() {
  const router = useRouter();
  const { disconnect } = useWallet();

  const [status, setStatus] = useState<PageStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState<string>("");

  // Form state
  const [displayName, setDisplayName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [bio, setBio] = useState("");
  const [gender, setGender] = useState("");
  const [lookingFor, setLookingFor] = useState<string[]>([]);
  const [interests, setInterests] = useState<string[]>([]);
  const [interestInput, setInterestInput] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [photos, setPhotos] = useState<PhotoWithUrl[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const checkAuth = async () => {
      if (!isAuthenticated()) {
        router.push("/login");
        return;
      }

      // Get session to check verification
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

      setWalletAddress(sessionRes.data.user.walletAddress);

      // Check if profile exists
      const profileRes = await api.profile.get();

      if (profileRes.error) {
        // No profile exists, show creation form
        setStatus("creating");
        return;
      }

      if (profileRes.data?.profile) {
        // Profile exists, populate form for editing
        const p = profileRes.data.profile;
        setDisplayName(p.displayName);
        setBirthDate(p.birthDate);
        setBio(p.bio || "");
        setGender(p.gender || "");
        setLookingFor(p.lookingFor || []);
        setInterests(p.interests || []);
        setCity(p.city || "");
        setCountry(p.country || "");
        // Load photos with URLs
        if (p.photos && p.photos.length > 0) {
          const photosWithUrls: PhotoWithUrl[] = p.photos.map((photo) => ({
            id: photo.id,
            url: getPhotoUrl(photo.storageKey),
            position: photo.position,
            isPrimary: photo.isPrimary,
          }));
          setPhotos(photosWithUrls);
        }
        setStatus("editing");
      }
    };

    checkAuth();
  }, [router]);

  const handleLookingForToggle = (option: string) => {
    setLookingFor((prev) =>
      prev.includes(option)
        ? prev.filter((o) => o !== option)
        : [...prev, option]
    );
  };

  const handleAddInterest = () => {
    const trimmed = interestInput.trim();
    if (trimmed && !interests.includes(trimmed) && interests.length < 10) {
      setInterests((prev) => [...prev, trimmed]);
      setInterestInput("");
    }
  };

  const handleRemoveInterest = (interest: string) => {
    setInterests((prev) => prev.filter((i) => i !== interest));
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!validTypes.includes(file.type)) {
      setPhotoError("Invalid file type. Use JPEG, PNG, WebP, or GIF.");
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setPhotoError("File too large. Maximum size is 5MB.");
      return;
    }

    setPhotoError(null);
    setUploadingPhoto(true);

    try {
      const res = await api.profile.uploadPhoto(file);

      if (res.error) {
        throw new Error(res.error);
      }

      if (res.data?.photo) {
        setPhotos((prev) => [...prev, res.data!.photo]);
      }
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : "Failed to upload photo");
    } finally {
      setUploadingPhoto(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDeletePhoto = async (photoId: string) => {
    try {
      const res = await api.profile.deletePhoto(photoId);

      if (res.error) {
        throw new Error(res.error);
      }

      setPhotos((prev) => prev.filter((p) => p.id !== photoId));
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : "Failed to delete photo");
    }
  };

  const handleSetPrimary = async (photoId: string) => {
    try {
      const res = await api.profile.setPhotoPrimary(photoId);

      if (res.error) {
        throw new Error(res.error);
      }

      setPhotos((prev) =>
        prev.map((p) => ({
          ...p,
          isPrimary: p.id === photoId,
        }))
      );
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : "Failed to set primary photo");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setStatus("saving");

    try {
      if (status === "creating" || !displayName) {
        // Create new profile
        const data: CreateProfileInput = {
          displayName,
          birthDate,
          bio: bio || undefined,
          gender: gender || undefined,
          lookingFor: lookingFor.length > 0 ? lookingFor : undefined,
          interests: interests.length > 0 ? interests : undefined,
          city: city || undefined,
          country: country || undefined,
        };

        const res = await api.profile.create(data);

        if (res.error) {
          throw new Error(res.error);
        }

        // Redirect to discover after creating profile
        router.push("/discover");
      } else {
        // Update existing profile
        const data: UpdateProfileInput = {
          displayName,
          bio: bio || undefined,
          gender: gender || undefined,
          lookingFor,
          interests,
          city: city || undefined,
          country: country || undefined,
        };

        const res = await api.profile.update(data);

        if (res.error) {
          throw new Error(res.error);
        }

        setStatus("editing");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save profile");
      setStatus(status === "creating" ? "creating" : "editing");
    }
  };

  const handleLogout = async () => {
    await api.auth.logout();
    removeToken();
    await disconnect();
    router.push("/login");
  };

  if (status === "loading") {
    return (
      <main className="container-mobile flex min-h-dvh flex-col items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      </main>
    );
  }

  const isCreating = status === "creating";

  return (
    <main className="container-mobile min-h-dvh py-6 safe-top safe-bottom">
      <header className="mb-6">
        <h1 className="text-xl font-bold">
          {isCreating ? "Create Profile" : "Edit Profile"}
        </h1>
        <p className="text-sm text-neutral-400">
          {isCreating
            ? "Set up your dating profile to start matching"
            : "Update your profile information"}
        </p>
      </header>

      {error && (
        <div className="mb-4 rounded-xl border border-red-900 bg-red-950/50 p-4">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Photos Section */}
        {!isCreating && (
          <div>
            <label className="mb-2 block text-sm font-medium">
              Photos ({photos.length}/6)
            </label>
            {photoError && (
              <div className="mb-3 rounded-lg border border-red-900 bg-red-950/50 p-3">
                <p className="text-xs text-red-400">{photoError}</p>
              </div>
            )}
            <div className="grid grid-cols-3 gap-3">
              {photos.map((photo) => (
                <div
                  key={photo.id}
                  className="relative aspect-square overflow-hidden rounded-xl bg-neutral-800"
                >
                  <img
                    src={photo.url}
                    alt="Profile photo"
                    className="h-full w-full object-cover"
                  />
                  {photo.isPrimary && (
                    <div className="absolute left-2 top-2 rounded-full bg-brand-600 px-2 py-0.5 text-xs font-medium">
                      Primary
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 flex gap-1 bg-gradient-to-t from-black/80 to-transparent p-2">
                    {!photo.isPrimary && (
                      <button
                        type="button"
                        onClick={() => handleSetPrimary(photo.id)}
                        className="flex-1 rounded bg-neutral-700 px-2 py-1 text-xs hover:bg-neutral-600"
                      >
                        Set Primary
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDeletePhoto(photo.id)}
                      className="rounded bg-red-900/80 px-2 py-1 text-xs hover:bg-red-800"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
              {photos.length < 6 && (
                <label
                  className={`flex aspect-square cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-neutral-700 bg-neutral-900 transition-colors hover:border-neutral-600 ${
                    uploadingPhoto ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                >
                  {uploadingPhoto ? (
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
                  ) : (
                    <>
                      <svg
                        className="mb-1 h-8 w-8 text-neutral-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 4v16m8-8H4"
                        />
                      </svg>
                      <span className="text-xs text-neutral-500">Add Photo</span>
                    </>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={handlePhotoUpload}
                    disabled={uploadingPhoto}
                    className="hidden"
                  />
                </label>
              )}
            </div>
            <p className="mt-2 text-xs text-neutral-500">
              Add up to 6 photos. First photo or primary will be shown in discovery.
            </p>
          </div>
        )}

        {/* Display Name */}
        <div>
          <label className="mb-2 block text-sm font-medium">Display Name *</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your name"
            required
            maxLength={50}
            className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-sm focus:border-brand-500 focus:outline-none"
          />
        </div>

        {/* Birth Date */}
        {isCreating && (
          <div>
            <label className="mb-2 block text-sm font-medium">Birth Date *</label>
            <input
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              required
              max={new Date(new Date().setFullYear(new Date().getFullYear() - 18))
                .toISOString()
                .split("T")[0]}
              className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-sm focus:border-brand-500 focus:outline-none"
            />
            <p className="mt-1 text-xs text-neutral-500">Must be 18 or older</p>
          </div>
        )}

        {/* Bio */}
        <div>
          <label className="mb-2 block text-sm font-medium">Bio</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Tell others about yourself..."
            maxLength={500}
            rows={4}
            className="w-full resize-none rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-sm focus:border-brand-500 focus:outline-none"
          />
          <p className="mt-1 text-xs text-neutral-500">{bio.length}/500</p>
        </div>

        {/* Gender */}
        <div>
          <label className="mb-2 block text-sm font-medium">I am a</label>
          <div className="flex flex-wrap gap-2">
            {GENDER_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setGender(gender === option ? "" : option)}
                className={`rounded-full px-4 py-2 text-sm transition-colors ${
                  gender === option
                    ? "bg-brand-600 text-white"
                    : "border border-neutral-700 bg-neutral-900 text-neutral-300 hover:border-neutral-600"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        {/* Looking For */}
        <div>
          <label className="mb-2 block text-sm font-medium">Looking for</label>
          <div className="flex flex-wrap gap-2">
            {LOOKING_FOR_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => handleLookingForToggle(option)}
                className={`rounded-full px-4 py-2 text-sm transition-colors ${
                  lookingFor.includes(option)
                    ? "bg-brand-600 text-white"
                    : "border border-neutral-700 bg-neutral-900 text-neutral-300 hover:border-neutral-600"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        {/* Interests */}
        <div>
          <label className="mb-2 block text-sm font-medium">Interests</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={interestInput}
              onChange={(e) => setInterestInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddInterest();
                }
              }}
              placeholder="Add an interest"
              maxLength={50}
              className="flex-1 rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-sm focus:border-brand-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={handleAddInterest}
              disabled={interests.length >= 10}
              className="rounded-xl bg-neutral-800 px-4 py-3 text-sm font-medium hover:bg-neutral-700 disabled:opacity-50"
            >
              Add
            </button>
          </div>
          {interests.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {interests.map((interest) => (
                <span
                  key={interest}
                  className="flex items-center gap-1 rounded-full bg-neutral-800 px-3 py-1 text-sm"
                >
                  {interest}
                  <button
                    type="button"
                    onClick={() => handleRemoveInterest(interest)}
                    className="ml-1 text-neutral-400 hover:text-white"
                  >
                    &times;
                  </button>
                </span>
              ))}
            </div>
          )}
          <p className="mt-1 text-xs text-neutral-500">{interests.length}/10</p>
        </div>

        {/* Location */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-2 block text-sm font-medium">City</label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Your city"
              maxLength={100}
              className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-sm focus:border-brand-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium">Country</label>
            <input
              type="text"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder="Your country"
              maxLength={100}
              className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-sm focus:border-brand-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Wallet Info */}
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
          <p className="text-xs text-neutral-500">Wallet Address</p>
          <p className="font-mono text-sm text-neutral-300">{walletAddress}</p>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={status === "saving" || !displayName || (isCreating && !birthDate)}
          className={`w-full rounded-full py-3 font-medium text-white transition-colors ${
            status === "saving" || !displayName || (isCreating && !birthDate)
              ? "bg-brand-600/50 cursor-not-allowed"
              : "bg-brand-600 hover:bg-brand-700"
          }`}
        >
          {status === "saving"
            ? "Saving..."
            : isCreating
            ? "Create Profile"
            : "Save Changes"}
        </button>
      </form>

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="mt-6 w-full text-center text-sm text-neutral-500 transition-colors hover:text-neutral-300"
      >
        Sign out
      </button>
    </main>
  );
}
