import type { ProfileWithPhotos } from "./profile.js";

export interface DiscoveryPreferences {
  minAge: number;
  maxAge: number;
  genders: string[];
  maxDistance?: number;
}

export interface DiscoveryProfile extends ProfileWithPhotos {
  age: number;
  distance?: number;
}

export type SwipeAction = "LIKE" | "PASS";

export interface SwipeResult {
  action: SwipeAction;
  isMatch: boolean;
  matchId?: string;
}
