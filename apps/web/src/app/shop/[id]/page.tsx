"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api, Listing } from "@/lib/api";
import { isAuthenticated, getToken } from "@/lib/auth";

export default function ListingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const listingId = params.id as string;

  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    const loadListing = async () => {
      const { data, error } = await api.listings.get(listingId);

      if (error) {
        setError(error);
        setLoading(false);
        return;
      }

      if (data?.listing) {
        setListing(data.listing);
      }
      setLoading(false);
    };

    const checkUser = async () => {
      if (isAuthenticated()) {
        const session = await api.auth.getSession();
        if (session.data?.user) {
          setCurrentUserId(session.data.user.id);
        }
      }
    };

    loadListing();
    checkUser();
  }, [listingId]);

  const handleNextPhoto = () => {
    if (listing && listing.photos.length > 1) {
      setCurrentPhotoIndex((prev) =>
        prev < listing.photos.length - 1 ? prev + 1 : 0
      );
    }
  };

  const handlePrevPhoto = () => {
    if (listing && listing.photos.length > 1) {
      setCurrentPhotoIndex((prev) =>
        prev > 0 ? prev - 1 : listing.photos.length - 1
      );
    }
  };

  const isOwner = currentUserId && listing?.seller.id === currentUserId;

  if (loading) {
    return (
      <main className="min-h-dvh bg-theme flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      </main>
    );
  }

  if (error || !listing) {
    return (
      <main className="min-h-dvh bg-theme flex flex-col items-center justify-center p-4">
        <p className="text-red-400 mb-4">{error || "Listing not found"}</p>
        <button
          onClick={() => router.push("/shop")}
          className="text-brand-500 hover:underline"
        >
          Back to Shop
        </button>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-theme">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-theme-secondary/80 backdrop-blur-lg border-b border-theme px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="text-theme-secondary hover:text-theme transition-colors"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="flex-1 font-medium text-theme truncate">{listing.title}</span>
          {isOwner && (
            <Link
              href={`/shop/${listing.id}/edit`}
              className="text-brand-500 text-sm font-medium"
            >
              Edit
            </Link>
          )}
        </div>
      </header>

      {/* Photo Gallery */}
      <div className="relative aspect-square bg-theme-tertiary">
        {listing.photos.length > 0 ? (
          <>
            <img
              src={listing.photos[currentPhotoIndex].url}
              alt={listing.title}
              className="w-full h-full object-cover"
            />
            {/* Photo indicators */}
            {listing.photos.length > 1 && (
              <>
                <div className="absolute top-3 left-0 right-0 flex justify-center gap-1 px-4">
                  {listing.photos.map((_, idx) => (
                    <div
                      key={idx}
                      className={`h-1 flex-1 rounded-full transition-all ${
                        idx === currentPhotoIndex ? "bg-white" : "bg-white/30"
                      }`}
                    />
                  ))}
                </div>
                {/* Navigation zones */}
                <button
                  onClick={handlePrevPhoto}
                  className="absolute top-0 left-0 bottom-0 w-1/3"
                  aria-label="Previous photo"
                />
                <button
                  onClick={handleNextPhoto}
                  className="absolute top-0 right-0 bottom-0 w-1/3"
                  aria-label="Next photo"
                />
              </>
            )}
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-theme-muted">
            <svg className="h-20 w-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
      </div>

      {/* Details */}
      <div className="p-4 space-y-4">
        {/* Price & Title */}
        <div>
          <div className="text-3xl font-bold text-brand-500 mb-1">
            {listing.priceSol} SOL
          </div>
          <h1 className="text-xl font-bold text-theme">{listing.title}</h1>
        </div>

        {/* Location */}
        {(listing.city || listing.country) && (
          <div className="flex items-center gap-2 text-theme-secondary">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>{[listing.city, listing.country].filter(Boolean).join(", ")}</span>
          </div>
        )}

        {/* Category Badge */}
        <div>
          <span className="inline-block rounded-full bg-theme-tertiary px-3 py-1 text-xs font-medium text-theme-secondary">
            {listing.category}
          </span>
          {listing.status === "SOLD" && (
            <span className="inline-block ml-2 rounded-full bg-red-500/20 px-3 py-1 text-xs font-medium text-red-400">
              SOLD
            </span>
          )}
        </div>

        {/* Description */}
        {listing.description && (
          <div className="border-t border-theme pt-4">
            <h3 className="font-medium text-theme mb-2">Description</h3>
            <p className="text-theme-secondary whitespace-pre-wrap">
              {listing.description}
            </p>
          </div>
        )}

        {/* Seller Info */}
        <div className="border-t border-theme pt-4">
          <h3 className="font-medium text-theme mb-3">Seller</h3>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white font-bold text-lg">
              {listing.seller.displayName.charAt(0)}
            </div>
            <div>
              <p className="font-medium text-theme">{listing.seller.displayName}</p>
              <p className="text-xs text-theme-muted font-mono">
                {listing.seller.walletAddress.slice(0, 6)}...{listing.seller.walletAddress.slice(-4)}
              </p>
            </div>
          </div>
        </div>

        {/* Posted date */}
        <p className="text-xs text-theme-muted">
          Posted {new Date(listing.createdAt).toLocaleDateString()}
        </p>
      </div>

      {/* Bottom Action Bar */}
      {!isOwner && listing.status === "ACTIVE" && (
        <div className="sticky bottom-0 border-t border-theme bg-theme-secondary p-4">
          <a
            href={`https://solscan.io/account/${listing.seller.walletAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full rounded-full bg-brand-500 py-3 text-center font-medium text-white hover:bg-brand-600 transition-colors"
          >
            Contact Seller
          </a>
          <p className="text-xs text-center text-theme-muted mt-2">
            Send SOL directly to the seller&apos;s wallet
          </p>
        </div>
      )}
    </main>
  );
}
