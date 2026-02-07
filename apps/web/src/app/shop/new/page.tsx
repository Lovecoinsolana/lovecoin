"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api, ListingCategory, ListingPhoto } from "@/lib/api";
import { isAuthenticated, removeToken } from "@/lib/auth";

const CATEGORIES: { value: ListingCategory; label: string }[] = [
  { value: "ELECTRONICS", label: "Electronics" },
  { value: "FASHION", label: "Fashion" },
  { value: "HOME", label: "Home" },
  { value: "SPORTS", label: "Sports" },
  { value: "VEHICLES", label: "Vehicles" },
  { value: "COLLECTIBLES", label: "Collectibles" },
  { value: "SERVICES", label: "Services" },
  { value: "OTHER", label: "Other" },
];

export default function NewListingPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<ListingCategory>("OTHER");
  const [priceSol, setPriceSol] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");

  const [photos, setPhotos] = useState<ListingPhoto[]>([]);
  const [listingId, setListingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      if (!isAuthenticated()) {
        router.push("/login");
        return;
      }

      const session = await api.auth.getSession();
      if (session.error || !session.data?.user) {
        removeToken();
        router.push("/login");
        return;
      }

      if (!session.data.user.isVerified) {
        router.push("/verify");
        return;
      }
    };

    checkAuth();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const price = parseFloat(priceSol);
      if (isNaN(price) || price <= 0) {
        throw new Error("Invalid price");
      }

      if (listingId) {
        // Update existing listing
        const { error } = await api.listings.update(listingId, {
          title,
          description: description || undefined,
          category,
          priceSol: price,
          city: city || undefined,
          country: country || undefined,
        });

        if (error) throw new Error(error);
      } else {
        // Create new listing
        const { data, error } = await api.listings.create({
          title,
          description: description || undefined,
          category,
          priceSol: price,
          city: city || undefined,
          country: country || undefined,
        });

        if (error) throw new Error(error);
        if (data?.listing) {
          setListingId(data.listing.id);
        }
      }

      router.push("/shop");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save listing");
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!validTypes.includes(file.type)) {
      setError("Invalid file type. Use JPEG, PNG, WebP, or GIF.");
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError("File too large. Maximum size is 5MB.");
      return;
    }

    // Need to create listing first if not exists
    if (!listingId) {
      const price = parseFloat(priceSol) || 0.01;
      const { data, error } = await api.listings.create({
        title: title || "Draft Listing",
        priceSol: price,
        category,
      });

      if (error || !data?.listing) {
        setError("Failed to create listing for photo upload");
        return;
      }

      setListingId(data.listing.id);

      // Now upload the photo
      setUploading(true);
      const uploadRes = await api.listings.uploadPhoto(data.listing.id, file);

      if (uploadRes.error) {
        setError(uploadRes.error);
      } else if (uploadRes.data?.photo) {
        setPhotos((prev) => [...prev, uploadRes.data!.photo]);
      }
      setUploading(false);
    } else {
      setUploading(true);
      const uploadRes = await api.listings.uploadPhoto(listingId, file);

      if (uploadRes.error) {
        setError(uploadRes.error);
      } else if (uploadRes.data?.photo) {
        setPhotos((prev) => [...prev, uploadRes.data!.photo]);
      }
      setUploading(false);
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDeletePhoto = async (photoId: string) => {
    if (!listingId) return;

    const { error } = await api.listings.deletePhoto(listingId, photoId);

    if (error) {
      setError(error);
    } else {
      setPhotos((prev) => prev.filter((p) => p.id !== photoId));
    }
  };

  return (
    <main className="min-h-dvh bg-theme">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-theme-secondary border-b border-theme px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="text-theme-secondary hover:text-theme transition-colors"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="flex-1 font-medium text-theme">Create Listing</span>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="p-4 space-y-5">
        {error && (
          <div className="rounded-xl border border-red-900 bg-red-950/50 p-4">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Photos */}
        <div>
          <label className="mb-2 block text-sm font-medium text-theme">
            Photos ({photos.length}/5)
          </label>
          <div className="grid grid-cols-3 gap-2">
            {photos.map((photo) => (
              <div
                key={photo.id}
                className="relative aspect-square rounded-xl overflow-hidden bg-theme-tertiary"
              >
                <img
                  src={photo.url}
                  alt="Listing photo"
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => handleDeletePhoto(photo.id)}
                  className="absolute top-1 right-1 bg-red-500 rounded-full p-1 hover:bg-red-600"
                >
                  <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
            {photos.length < 5 && (
              <label
                className={`aspect-square flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-theme-light bg-theme-tertiary cursor-pointer hover:border-brand-500/50 transition-colors ${
                  uploading ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                {uploading ? (
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
                ) : (
                  <>
                    <svg className="h-8 w-8 text-theme-muted mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span className="text-xs text-theme-muted">Add Photo</span>
                  </>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={handlePhotoUpload}
                  disabled={uploading}
                  className="hidden"
                />
              </label>
            )}
          </div>
        </div>

        {/* Title */}
        <div>
          <label className="mb-2 block text-sm font-medium text-theme">Title *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What are you selling?"
            required
            maxLength={100}
            className="w-full rounded-xl border border-theme bg-theme-tertiary px-4 py-3 text-sm text-theme placeholder:text-theme-muted focus:border-brand-500 focus:outline-none"
          />
        </div>

        {/* Price */}
        <div>
          <label className="mb-2 block text-sm font-medium text-theme">Price (SOL) *</label>
          <input
            type="number"
            value={priceSol}
            onChange={(e) => setPriceSol(e.target.value)}
            placeholder="0.00"
            required
            min="0.001"
            step="0.001"
            className="w-full rounded-xl border border-theme bg-theme-tertiary px-4 py-3 text-sm text-theme placeholder:text-theme-muted focus:border-brand-500 focus:outline-none"
          />
        </div>

        {/* Category */}
        <div>
          <label className="mb-2 block text-sm font-medium text-theme">Category</label>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                type="button"
                onClick={() => setCategory(cat.value)}
                className={`rounded-full px-4 py-2 text-sm transition-colors ${
                  category === cat.value
                    ? "bg-brand-500 text-white"
                    : "bg-theme-tertiary text-theme-secondary hover:bg-theme-card"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="mb-2 block text-sm font-medium text-theme">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe your item..."
            maxLength={1000}
            rows={4}
            className="w-full rounded-xl border border-theme bg-theme-tertiary px-4 py-3 text-sm text-theme placeholder:text-theme-muted focus:border-brand-500 focus:outline-none resize-none"
          />
          <p className="mt-1 text-xs text-theme-muted">{description.length}/1000</p>
        </div>

        {/* Location */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-theme">City</label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="City"
              maxLength={100}
              className="w-full rounded-xl border border-theme bg-theme-tertiary px-4 py-3 text-sm text-theme placeholder:text-theme-muted focus:border-brand-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-theme">Country</label>
            <input
              type="text"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder="Country"
              maxLength={100}
              className="w-full rounded-xl border border-theme bg-theme-tertiary px-4 py-3 text-sm text-theme placeholder:text-theme-muted focus:border-brand-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={saving || !title || !priceSol}
          className={`w-full rounded-full py-3 font-medium text-white transition-colors ${
            saving || !title || !priceSol
              ? "bg-brand-500/50 cursor-not-allowed"
              : "bg-brand-500 hover:bg-brand-600"
          }`}
        >
          {saving ? "Publishing..." : "Publish Listing"}
        </button>
      </form>
    </main>
  );
}
