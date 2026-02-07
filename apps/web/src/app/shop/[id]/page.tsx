"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import {
  Transaction,
  SystemProgram,
  PublicKey,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { api, Listing } from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";
import { useToast } from "@/components/Toast";
import { ButtonSpinner } from "@/components/Skeleton";
import { BottomNav } from "@/components/BottomNav";

// Platform fee percentage (must match backend)
const PLATFORM_FEE_PERCENT = 3;

// Platform wallet address - should match backend config
const PLATFORM_WALLET = process.env.NEXT_PUBLIC_PLATFORM_WALLET || "";

export default function ListingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const listingId = params.id as string;
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const { showToast } = useToast();

  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isContacting, setIsContacting] = useState(false);

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

  const handleBuyNow = useCallback(async () => {
    if (!listing || !publicKey || !PLATFORM_WALLET) {
      showToast("Unable to process payment", "error");
      return;
    }

    if (!isAuthenticated()) {
      router.push("/login");
      return;
    }

    setIsPurchasing(true);
    setError(null);

    try {
      const totalLamports = listing.priceSol * LAMPORTS_PER_SOL;
      const platformFeeLamports = Math.floor(totalLamports * (PLATFORM_FEE_PERCENT / 100));
      const sellerAmountLamports = totalLamports - platformFeeLamports;

      const sellerPubkey = new PublicKey(listing.seller.walletAddress);
      const platformPubkey = new PublicKey(PLATFORM_WALLET);

      // Create transaction with two transfers
      const transaction = new Transaction();

      // Transfer to seller (97%)
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: sellerPubkey,
          lamports: sellerAmountLamports,
        })
      );

      // Transfer platform fee (3%)
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: platformPubkey,
          lamports: platformFeeLamports,
        })
      );

      // Get latest blockhash
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      // Send transaction
      const signature = await sendTransaction(transaction, connection);

      // Wait for confirmation
      showToast("Transaction sent, waiting for confirmation...", "success");
      
      await connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight,
      }, "confirmed");

      // Record purchase on backend
      const { data, error: apiError } = await api.listings.purchase(listing.id, signature);

      if (apiError) {
        showToast(`Purchase recorded but verification failed: ${apiError}`, "error");
        setIsPurchasing(false);
        return;
      }

      showToast("Purchase successful!", "success");
      
      // Update listing status locally
      setListing({ ...listing, status: "SOLD" });
      
    } catch (err) {
      console.error("Purchase error:", err);
      const message = err instanceof Error ? err.message : "Transaction failed";
      showToast(message, "error");
      setError(message);
    } finally {
      setIsPurchasing(false);
    }
  }, [listing, publicKey, connection, sendTransaction, showToast, router]);

  const handleContactSeller = useCallback(async () => {
    if (!listing) return;

    if (!isAuthenticated()) {
      router.push("/login");
      return;
    }

    setIsContacting(true);

    try {
      const { data, error } = await api.listings.contact(listing.id);

      if (error) {
        showToast(error, "error");
        setIsContacting(false);
        return;
      }

      if (data?.conversationId) {
        router.push(`/chat/${data.conversationId}`);
      }
    } catch (err) {
      console.error("Contact error:", err);
      showToast("Failed to start conversation", "error");
      setIsContacting(false);
    }
  }, [listing, router, showToast]);

  const isOwner = currentUserId && listing?.seller.id === currentUserId;

  if (loading) {
    return (
      <main className="min-h-dvh bg-theme-background flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      </main>
    );
  }

  if (error || !listing) {
    return (
      <main className="min-h-dvh bg-theme-background flex flex-col items-center justify-center p-4">
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

  // Calculate fee breakdown for display
  const platformFee = listing.priceSol * (PLATFORM_FEE_PERCENT / 100);
  const sellerReceives = listing.priceSol - platformFee;

  return (
    <main className="min-h-dvh bg-theme-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-theme-background/80 backdrop-blur-lg border-b border-theme-border px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="text-theme-foreground/60 hover:text-theme-foreground transition-colors"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="flex-1 font-medium text-theme-foreground truncate">{listing.title}</span>
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
      <div className="relative aspect-square bg-theme-background">
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
          <div className="w-full h-full flex items-center justify-center text-theme-foreground/30">
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
          <h1 className="text-xl font-bold text-theme-foreground">{listing.title}</h1>
        </div>

        {/* Location */}
        {(listing.city || listing.country) && (
          <div className="flex items-center gap-2 text-theme-foreground/60">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>{[listing.city, listing.country].filter(Boolean).join(", ")}</span>
          </div>
        )}

        {/* Category Badge */}
        <div>
          <span className="inline-block rounded-full bg-theme-foreground/10 px-3 py-1 text-xs font-medium text-theme-foreground/70">
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
          <div className="border-t border-theme-border pt-4">
            <h3 className="font-medium text-theme-foreground mb-2">Description</h3>
            <p className="text-theme-foreground/70 whitespace-pre-wrap">
              {listing.description}
            </p>
          </div>
        )}

        {/* Seller Info */}
        <div className="border-t border-theme-border pt-4">
          <h3 className="font-medium text-theme-foreground mb-3">Seller</h3>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white font-bold text-lg">
              {listing.seller.displayName.charAt(0)}
            </div>
            <div>
              <p className="font-medium text-theme-foreground">{listing.seller.displayName}</p>
              <p className="text-xs text-theme-foreground/40 font-mono">
                {listing.seller.walletAddress.slice(0, 6)}...{listing.seller.walletAddress.slice(-4)}
              </p>
            </div>
          </div>
        </div>

        {/* Fee breakdown (only show for buyers) */}
        {!isOwner && listing.status === "ACTIVE" && (
          <div className="border-t border-theme-border pt-4">
            <h3 className="font-medium text-theme-foreground mb-2">Payment Breakdown</h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-theme-foreground/70">
                <span>Price</span>
                <span>{listing.priceSol} SOL</span>
              </div>
              <div className="flex justify-between text-theme-foreground/70">
                <span>Platform fee ({PLATFORM_FEE_PERCENT}%)</span>
                <span>{platformFee.toFixed(4)} SOL</span>
              </div>
              <div className="flex justify-between text-theme-foreground/70">
                <span>Seller receives</span>
                <span>{sellerReceives.toFixed(4)} SOL</span>
              </div>
            </div>
          </div>
        )}

        {/* Posted date */}
        <p className="text-xs text-theme-foreground/40">
          Posted {new Date(listing.createdAt).toLocaleDateString()}
        </p>
      </div>

      {/* Bottom Action Bar */}
      {!isOwner && listing.status === "ACTIVE" && (
        <div className="fixed bottom-16 left-0 right-0 border-t border-theme-border bg-theme-background p-4">
          <div className="flex gap-3">
            <button
              onClick={handleContactSeller}
              disabled={isContacting}
              className="flex-1 rounded-full border border-brand-500 py-3 text-center font-medium text-brand-500 hover:bg-brand-500/10 transition-colors disabled:opacity-50"
            >
              {isContacting ? <ButtonSpinner /> : "Message Seller"}
            </button>
            <button
              onClick={handleBuyNow}
              disabled={isPurchasing || !publicKey}
              className="flex-1 rounded-full bg-brand-500 py-3 text-center font-medium text-white hover:bg-brand-600 transition-colors disabled:opacity-50"
            >
              {isPurchasing ? <ButtonSpinner /> : `Buy Now - ${listing.priceSol} SOL`}
            </button>
          </div>
          {!publicKey && (
            <p className="text-xs text-center text-red-400 mt-2">
              Connect your wallet to purchase
            </p>
          )}
        </div>
      )}

      <BottomNav />
    </main>
  );
}
