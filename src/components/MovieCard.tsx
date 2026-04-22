import { Link } from "react-router-dom";
import { Play, Star } from "lucide-react";
import { memo } from "react";
import type { Movie } from "@/lib/types";

/**
 * Performance-critical: rendered up to ~60 times per home view.
 *
 * - No framer-motion: a single CSS fade keeps mount work negligible.
 * - `memo` skips re-renders when the parent re-renders without changing the
 *   movie object (e.g. parent state updates that don't affect the row).
 * - Explicit width/height on the poster prevents layout shift and lets the
 *   browser reserve the slot before the image arrives.
 */
function MovieCardImpl({ movie }: { movie: Movie; idx?: number }) {
  const img = movie.posterUrl || movie.detailThumbnailUrl || movie.bannerImageUrl || "/placeholder.svg";
  return (
    <Link to={`/movie/${movie.id}`} className="group block animate-card-in">
      <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-muted shadow-card">
        <img
          src={img}
          alt={movie.title}
          loading="lazy"
          decoding="async"
          width="200"
          height="300"
          className="h-full w-full object-cover transition-transform duration-300 group-active:scale-95"
        />
        {movie.premiumOnly && (
          <div className="absolute top-1.5 left-1.5 rounded-md bg-gradient-premium px-1.5 py-0.5 text-[9px] font-bold text-premium-foreground shadow-sm">
            PREMIUM
          </div>
        )}
        {movie.quality && (
          <div className="absolute top-1.5 right-1.5 rounded-md bg-black/70 px-1.5 py-0.5 text-[9px] font-bold text-white">
            {movie.quality}
          </div>
        )}
        <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center justify-between">
          {movie.imdbRating ? (
            <div className="flex items-center gap-0.5 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white">
              <Star size={10} className="fill-premium text-premium" />
              {movie.imdbRating.toFixed(1)}
            </div>
          ) : <span />}
          <div className="grid h-7 w-7 place-items-center rounded-full bg-primary text-primary-foreground shadow-premium opacity-0 group-hover:opacity-100 transition-opacity">
            <Play size={12} className="fill-current" />
          </div>
        </div>
      </div>
      <div className="mt-1.5 px-0.5">
        <h3 className="text-xs font-semibold leading-tight line-clamp-1 text-foreground">{movie.title}</h3>
        <p className="text-[10px] text-muted-foreground line-clamp-1">
          {movie.year || ""}{movie.year && movie.language ? " · " : ""}{movie.language || ""}
        </p>
      </div>
    </Link>
  );
}

export const MovieCard = memo(MovieCardImpl, (a, b) => a.movie === b.movie);
