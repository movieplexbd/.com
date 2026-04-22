import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useFirebaseList } from "@/hooks/useFirebase";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";
import { MovieCard } from "@/components/MovieCard";
import type { Movie } from "@/lib/types";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "bangla", label: "Bangla Dub", match: ["bangla"] },
  { id: "hindi", label: "Hindi Dub", match: ["hindi"] },
  { id: "south", label: "South", match: ["south", "tamil", "telugu"] },
  { id: "korean", label: "Korean", match: ["korean"] },
  { id: "hollywood", label: "Hollywood", match: ["hollywood", "english"] },
  { id: "action", label: "Action", match: ["action"] },
  { id: "drama", label: "Drama", match: ["drama"] },
  { id: "thriller", label: "Thriller", match: ["thriller"] },
  { id: "comedy", label: "Comedy", match: ["comedy"] },
  { id: "horror", label: "Horror", match: ["horror"] },
  { id: "animation", label: "Animation", match: ["animation", "anime"] },
];

export default function Movies() {
  const [params, setParams] = useSearchParams();
  const [filter, setFilter] = useState<string>(params.get("cat") || "all");
  const { data: movies, loading } = useFirebaseList<Movie>("movies");

  const filtered = useMemo(() => {
    if (filter === "all") return movies;
    const f = FILTERS.find((x) => x.id === filter);
    if (!f?.match) return movies;
    return movies.filter((m) => {
      const blob = `${m.language || ""} ${m.category || ""} ${m.subCategory || ""} ${(m.tags || []).join(" ")}`.toLowerCase();
      return f.match!.some((kw) => blob.includes(kw));
    });
  }, [movies, filter]);

  const { visible, hasMore, sentinelRef } = useInfiniteScroll(filtered, 18);

  const onFilter = (id: string) => {
    setFilter(id);
    if (id === "all") setParams({});
    else setParams({ cat: id });
  };

  return (
    <div className="space-y-4">
      <header className="sticky top-0 z-40 glass safe-top px-4 pt-3 pb-2 border-b border-border/50">
        <h1 className="text-xl font-extrabold">All Movies</h1>
        <p className="text-xs text-muted-foreground font-bangla">সকল মুভি কালেকশন</p>
      </header>

      <div className="flex gap-2 overflow-x-auto no-scrollbar px-4">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => onFilter(f.id)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-bold transition ${
              filter === f.id ? "bg-primary text-primary-foreground shadow-premium" : "bg-muted text-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="px-4">
        {loading ? (
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="aspect-[2/3] rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">No movies in this category yet.</p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3">
              {visible.map((m, i) => <MovieCard key={m.id} movie={m} idx={i} />)}
            </div>
            {hasMore && (
              <div ref={sentinelRef} className="grid grid-cols-3 gap-3 pt-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="aspect-[2/3] rounded-xl bg-muted animate-pulse" />
                ))}
              </div>
            )}
            <p className="text-center text-[10px] text-muted-foreground py-4">
              {visible.length} / {filtered.length} movies
            </p>
          </>
        )}
      </div>
    </div>
  );
}
