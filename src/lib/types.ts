export interface DownloadLink {
  quality: string;
  url: string;
  size?: string;
}

export interface Movie {
  id: string;
  title: string;
  slug?: string;
  description?: string;
  shortDescription?: string;
  bannerImageUrl?: string;
  detailThumbnailUrl?: string;
  posterUrl?: string;
  trailerUrl?: string;
  videoStreamUrl?: string;
  downloadUrl?: string;
  category?: string;
  subCategory?: string;
  language?: string;
  quality?: string;
  imdbRating?: number;
  totalViews?: number;
  totalDownloads?: number;
  trending?: boolean;
  featured?: boolean;
  latest?: boolean;
  testMovie?: boolean;
  premiumOnly?: boolean;
  year?: number;
  duration?: string;
  country?: string;
  director?: string;
  actorIds?: string[];
  tags?: string[];
  createdAt?: number;
  updatedAt?: number;
  downloads?: DownloadLink[] | Record<string, DownloadLink>;
}

export interface Banner {
  id: string;
  imageUrl?: string;
  mobileImageUrl?: string;
  title?: string;
  subtitle?: string;
  category?: string;
  imdbRating?: number;
  movieId?: string;
  priority?: number;
  active?: boolean;
  testMovie?: boolean;
  createdAt?: number;
}

export interface Reel {
  id: string;
  movieId?: string;
  /** Linked movie title — sent by the Android admin app. */
  movieTitle?: string;
  title?: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  views?: number;
  likes?: number;
  shares?: number;
  createdAt?: number;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  photoUrl?: string;
  role?: "user" | "admin";
  subscriptionStatus?: "free" | "premium" | "pending" | "blocked";
  subscriptionPlan?: "monthly" | "yearly" | "none";
  subscriptionExpiry?: number;
  /** True while access has been auto-granted on submit but admin has not yet verified payment. */
  subscriptionProvisional?: boolean;
  joinedAt?: number;
  lastLogin?: number;
  deviceCount?: number;
  totalWatchTime?: number;
  favoriteGenres?: string[];
}

export interface Actor {
  id: string;
  name: string;
  imageUrl?: string;
  bio?: string;
  popularity?: number;
  createdAt?: number;
}

export interface AppPromo {
  enabled?: boolean;
  appName?: string;
  tagline?: string;
  description?: string;
  downloadUrl?: string;
  iconUrl?: string;
  screenshots?: string[];
  version?: string;
  sizeMb?: string;
  updatedAt?: number;
}

export interface Subscription {
  uid: string;
  email: string;
  plan: "monthly" | "yearly";
  amount: number;
  transactionId: string;
  paymentMethod: "bkash" | "nagad" | "rocket";
  deviceId: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  submittedAt: number;
  approvedAt?: number;
  expiry?: number;
  approvedBy?: string;
  fullName?: string;
}
