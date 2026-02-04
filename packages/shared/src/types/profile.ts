export interface Profile {
  id: string;
  userId: string;
  displayName: string;
  birthDate: Date;
  bio: string | null;
  city: string | null;
  country: string | null;
  gender: string | null;
  lookingFor: string[];
  interests: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ProfilePhoto {
  id: string;
  profileId: string;
  storageKey: string;
  position: number;
  isPrimary: boolean;
  createdAt: Date;
}

export interface CreateProfileInput {
  displayName: string;
  birthDate: string; // ISO date string
  bio?: string;
  city?: string;
  country?: string;
  gender?: string;
  lookingFor?: string[];
  interests?: string[];
}

export interface UpdateProfileInput {
  displayName?: string;
  bio?: string;
  city?: string;
  country?: string;
  gender?: string;
  lookingFor?: string[];
  interests?: string[];
}

export interface ProfileWithPhotos extends Profile {
  photos: ProfilePhoto[];
}
