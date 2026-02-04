"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { isAuthenticated, removeToken } from "@/lib/auth";

interface User {
  id: string;
  walletAddress: string;
  isVerified: boolean;
}

interface UseAuthOptions {
  requireVerified?: boolean;
  requireProfile?: boolean;
}

interface UseAuthResult {
  user: User | null;
  hasProfile: boolean;
  loading: boolean;
  error: string | null;
}

export function useAuth(options: UseAuthOptions = {}): UseAuthResult {
  const { requireVerified = false, requireProfile = false } = options;
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [hasProfile, setHasProfile] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      // Check if token exists
      if (!isAuthenticated()) {
        router.push("/login");
        return;
      }

      // Verify session with API
      const res = await api.auth.getSession();

      if (res.error || !res.data?.user) {
        removeToken();
        router.push("/login");
        return;
      }

      const userData = res.data.user;

      // Check verification requirement
      if (requireVerified && !userData.isVerified) {
        router.push("/verify");
        return;
      }

      // Check profile requirement
      if (requireProfile && userData.isVerified) {
        const profileRes = await api.profile.exists();
        if (profileRes.data?.exists) {
          setHasProfile(true);
        } else {
          router.push("/profile");
          return;
        }
      }

      setUser(userData);
      setLoading(false);
    };

    checkAuth();
  }, [router, requireVerified, requireProfile]);

  return { user, hasProfile, loading, error };
}
