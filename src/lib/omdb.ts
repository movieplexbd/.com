import { get, ref } from "firebase/database";
import { db } from "@/lib/firebase";

let cachedKey: string | null = null;
let cachedAt = 0;

export async function getOmdbApiKey(): Promise<string | null> {
  // 5 min cache
  if (cachedKey && Date.now() - cachedAt < 5 * 60 * 1000) return cachedKey;
  try {
    const snap = await get(ref(db, "settings/omdbApiKey"));
    const v = snap.val();
    if (typeof v === "string" && v.trim()) {
      cachedKey = v.trim();
      cachedAt = Date.now();
      return cachedKey;
    }
  } catch {
    // ignore
  }
  return null;
}

export function clearOmdbKeyCache() {
  cachedKey = null;
  cachedAt = 0;
}

export interface OmdbResult {
  title?: string;
  year?: number;
  rated?: string;
  released?: string;
  runtime?: string;
  genre?: string;
  director?: string;
  actors?: string[];
  plot?: string;
  country?: string;
  language?: string;
  poster?: string;
  imdbRating?: number;
  imdbId?: string;
}

export async function fetchOmdbByTitle(
  title: string,
  year?: number
): Promise<OmdbResult> {
  const key = await getOmdbApiKey();
  if (!key) {
    throw new Error("OMDb API key not configured. Set it in Admin → Master Control.");
  }
  const params = new URLSearchParams({
    apikey: key,
    t: title,
    plot: "full",
  });
  if (year) params.set("y", String(year));
  const res = await fetch(`https://www.omdbapi.com/?${params.toString()}`);
  const data = await res.json();
  if (data?.Response === "False") {
    throw new Error(data?.Error || "Movie not found on OMDb.");
  }
  const ratingNum = parseFloat(data.imdbRating);
  return {
    title: data.Title,
    year: data.Year ? parseInt(String(data.Year).slice(0, 4), 10) : undefined,
    rated: data.Rated,
    released: data.Released,
    runtime: data.Runtime,
    genre: data.Genre,
    director: data.Director,
    actors: data.Actors ? String(data.Actors).split(",").map((s: string) => s.trim()).filter(Boolean) : [],
    plot: data.Plot,
    country: data.Country,
    language: data.Language,
    poster: data.Poster && data.Poster !== "N/A" ? data.Poster : undefined,
    imdbRating: isNaN(ratingNum) ? undefined : ratingNum,
    imdbId: data.imdbID,
  };
}
