"use client";

// Base skeleton component with shimmer animation
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse bg-neutral-800 rounded ${className}`}
      aria-hidden="true"
    />
  );
}

// Profile card skeleton for discovery feed
export function ProfileCardSkeleton() {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900 overflow-hidden">
      {/* Photo placeholder */}
      <Skeleton className="aspect-[3/4] w-full" />
      
      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Name and age */}
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-6 w-10" />
        </div>
        
        {/* Location */}
        <Skeleton className="h-4 w-24" />
        
        {/* Bio */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
        
        {/* Interests */}
        <div className="flex gap-2 flex-wrap">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-6 w-14 rounded-full" />
        </div>
      </div>
    </div>
  );
}

// Match card skeleton for matches list
export function MatchCardSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-neutral-800 bg-neutral-900 p-3">
      {/* Avatar */}
      <Skeleton className="h-14 w-14 rounded-full flex-shrink-0" />
      
      {/* Info */}
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-3 w-10" />
        </div>
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  );
}

// Message skeleton for chat
export function MessageSkeleton({ isFromMe = false }: { isFromMe?: boolean }) {
  return (
    <div className={`flex ${isFromMe ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[75%] space-y-1 ${isFromMe ? "items-end" : "items-start"}`}>
        <Skeleton className={`h-10 ${isFromMe ? "w-40" : "w-48"} rounded-2xl`} />
        <Skeleton className="h-3 w-12" />
      </div>
    </div>
  );
}

// Chat list skeleton
export function ChatListSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(5)].map((_, i) => (
        <MatchCardSkeleton key={i} />
      ))}
    </div>
  );
}

// Profile form skeleton
export function ProfileFormSkeleton() {
  return (
    <div className="space-y-6">
      {/* Display name */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-12 w-full rounded-lg" />
      </div>
      
      {/* Bio */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-24 w-full rounded-lg" />
      </div>
      
      {/* Row fields */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-12 w-full rounded-lg" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-12 w-full rounded-lg" />
        </div>
      </div>
      
      {/* Interests */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-20" />
        <div className="flex gap-2 flex-wrap">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-8 w-20 rounded-full" />
          ))}
        </div>
      </div>
      
      {/* Button */}
      <Skeleton className="h-12 w-full rounded-full" />
    </div>
  );
}

// Full page loading spinner
export function PageLoader() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </main>
  );
}

// Button loading state
export function ButtonSpinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <span className={`animate-spin rounded-full border-2 border-current border-t-transparent ${className}`} />
  );
}
