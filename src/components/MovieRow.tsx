import { ReactNode, memo } from "react";
import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { MovieCard } from "./MovieCard";
import type { Movie } from "@/lib/types";

function MovieRowImpl({
  title,
  movies,
  seeMoreTo,
  bangla,
}: {
  title: string;
  movies: Movie[];
  seeMoreTo?: string;
  bangla?: ReactNode;
}) {
  if (!movies.length) return null;
  return (
    <section className="space-y-2.5 px-4">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-base font-bold tracking-tight">{title}</h2>
          {bangla && <p className="text-xs text-muted-foreground font-bangla">{bangla}</p>}
        </div>
        {seeMoreTo && (
          <Link to={seeMoreTo} className="flex items-center gap-0.5 text-xs font-semibold text-primary">
            See all <ChevronRight size={14} />
          </Link>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {movies.map((m, i) => (
          <MovieCard key={m.id} movie={m} idx={i} />
        ))}
      </div>
    </section>
  );
}

// Memo so rows that don't change don't repaint while sibling rows update.
// `movies` arrays are stable when produced by the parent's `useMemo`.
export const MovieRow = memo(MovieRowImpl);
