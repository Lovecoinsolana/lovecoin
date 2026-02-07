"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, Listing, ListingCategory } from "@/lib/api";
import { BottomNav } from "@/components/BottomNav";
import { isAuthenticated } from "@/lib/auth";

type PageStatus = "loading" | "ready" | "empty";

const CATEGORIES: { value: ListingCategory | "ALL"; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "ELECTRONICS", label: "Electronics" },
  { value: "FASHION", label: "Fashion" },
  { value: "HOME", label: "Home" },
  { value: "SPORTS", label: "Sports" },
  { value: "VEHICLES", label: "Vehicles" },
  { value: "COLLECTIBLES", label: "Collectibles" },
  { value: "SERVICES", label: "Services" },
  { value: "OTHER", label: "Other" },
];

export default function ShopPage() {
  const router = useRouter();
  const [status, setStatus] = useState<PageStatus>("loading");
  const [listings, setListings] = useState<Listing[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<ListingCategory | "ALL">("ALL");
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const loadListings = useCallback(async () => {
    setStatus("loading");

    const params: { category?: string } = {};
    if (selectedCategory !== "ALL") {
      params.category = selectedCategory;
    }

    const { data, error } = await api.listings.getAll(params);

    if (error) {
      console.error("Failed to load listings:", error);
      setStatus("empty");
      return;
    }

    if (data?.listings && data.listings.length > 0) {
      setListings(data.listings);
      setStatus("ready");
    } else {
      setListings([]);
      setStatus("empty");
    }
  }, [selectedCategory]);

  useEffect(() => {
    setIsLoggedIn(isAuthenticated());
    loadListings();
  }, [loadListings]);

  return (
    <main className="min-h-dvh bg-theme">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-theme-secondary border-b border-theme px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="Lovecoin" className="h-8 w-8" />
            <span className="text-xl font-bold text-brand-500">Shop</span>
          </div>
          {isLoggedIn && (
            <Link
              href="/shop/new"
              className="rounded-full bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 transition-colors"
            >
              + Sell
            </Link>
          )}
        </div>

        {/* Category Filter */}
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setSelectedCategory(cat.value)}
              className={`flex-shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                selectedCategory === cat.value
                  ? "bg-brand-500 text-white"
                  : "bg-theme-tertiary text-theme-secondary hover:bg-theme-card"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </header>

      {/* Content */}
      <div className="p-4">
        {status === "loading" ? (
          <div className="grid grid-cols-2 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="rounded-xl bg-theme-tertiary animate-pulse">
                <div className="aspect-square rounded-t-xl bg-theme-card" />
                <div className="p-3 space-y-2">
                  <div className="h-4 bg-theme-card rounded w-3/4" />
                  <div className="h-3 bg-theme-card rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : status === "empty" ? (
          <div className="flex flex-col items-center justify-center py-20">
            <svg className="h-16 w-16 text-theme-muted mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
            <p className="text-lg font-medium text-theme mb-2">No listings yet</p>
            <p className="text-sm text-theme-muted mb-6 text-center">
              Be the first to sell something!
            </p>
            {isLoggedIn ? (
              <Link
                href="/shop/new"
                className="rounded-full bg-brand-500 px-6 py-2 text-sm font-medium text-white hover:bg-brand-600"
              >
                Create Listing
              </Link>
            ) : (
              <Link
                href="/login"
                className="rounded-full bg-brand-500 px-6 py-2 text-sm font-medium text-white hover:bg-brand-600"
              >
                Sign in to Sell
              </Link>
            )}
          </div>
        ) : (
          <>
            {/* Section Title */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-theme">
                {selectedCategory === "ALL" ? "Nearby Deals" : CATEGORIES.find(c => c.value === selectedCategory)?.label}
              </h2>
              <span className="text-sm text-theme-muted">{listings.length} items</span>
            </div>

            {/* Listings Grid */}
            <div className="grid grid-cols-2 gap-3">
              {listings.map((listing) => (
                <Link
                  key={listing.id}
                  href={`/shop/${listing.id}`}
                  className="rounded-xl border border-theme bg-theme-card overflow-hidden hover:border-brand-500/50 transition-colors"
                >
                  {/* Image */}
                  <div className="relative aspect-square bg-theme-tertiary">
                    {listing.photos.length > 0 ? (
                      <img
                        src={listing.photos[0].url}
                        alt={listing.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-theme-muted">
                        <svg className="h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                    {/* Price Badge */}
                    <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm rounded-full px-2 py-1 text-xs font-bold text-white">
                      {listing.priceSol} SOL
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-3">
                    <h3 className="font-medium text-theme text-sm line-clamp-1">
                      {listing.title}
                    </h3>
                    {listing.city && (
                      <p className="text-xs text-theme-muted flex items-center gap-1 mt-1">
                        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        </svg>
                        {listing.city}
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>

            {/* Promo Banner */}
            {isLoggedIn && (
              <div className="mt-6 rounded-2xl bg-gradient-to-r from-brand-600 to-purple-600 p-5 text-white">
                <span className="inline-block rounded-full bg-white/20 px-2 py-0.5 text-xs font-medium mb-2">
                  SELL NOW
                </span>
                <h3 className="text-lg font-bold mb-1">List your items</h3>
                <p className="text-sm text-white/80 mb-3">
                  Reach buyers in your area. Quick and easy!
                </p>
                <Link
                  href="/shop/new"
                  className="inline-block rounded-full bg-white px-4 py-2 text-sm font-medium text-brand-600 hover:bg-white/90"
                >
                  Start Selling
                </Link>
              </div>
            )}
          </>
        )}
      </div>

      <BottomNav />
    </main>
  );
}
