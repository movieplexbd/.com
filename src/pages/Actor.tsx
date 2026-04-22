import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Film } from "lucide-react";
import { useFirebaseList, useFirebaseValue } from "@/hooks/useFirebase";
import { MovieCard } from "@/components/MovieCard";
import type { Actor, Movie } from "@/lib/types";

export default function ActorPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { data: actor, loading } = useFirebaseValue<Actor>(id ? `actors/${id}` : null);
  const { data: movies } = useFirebaseList<Movie>("movies");

  const movieList = movies.filter((m) => Array.isArray(m.actorIds) && m.actorIds.includes(id || ""));

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  }
  if (!actor) {
    return (
      <div className="p-6 text-center pt-20">
        <p className="text-sm text-muted-foreground">Actor not found.</p>
        <Link to="/" className="mt-4 inline-block text-primary text-sm font-bold">← Back</Link>
      </div>
    );
  }

  return (
    <div className="pb-10">
      <header className="sticky top-0 z-30 glass safe-top px-4 pt-3 pb-3 flex items-center gap-3 border-b border-border/50">
        <button onClick={() => nav(-1)} className="grid h-9 w-9 place-items-center rounded-full bg-card shadow-soft">
          <ArrowLeft size={16} />
        </button>
        <h1 className="text-sm font-extrabold truncate">{actor.name}</h1>
      </header>

      <section className="px-4 pt-6 pb-4 flex flex-col items-center text-center">
        <div className="relative">
          <img
            src={actor.imageUrl || "/placeholder.svg"}
            alt={actor.name}
            loading="eager"
            className="h-32 w-32 rounded-full object-cover border-4 border-card shadow-card"
          />
        </div>
        <h2 className="mt-3 text-xl font-extrabold">{actor.name}</h2>
        <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
          <Film size={11} /> {movieList.length} {movieList.length === 1 ? "movie" : "movies"}
        </p>
        {actor.bio && (
          <p className="mt-3 text-xs text-foreground/80 leading-relaxed max-w-md">{actor.bio}</p>
        )}
      </section>

      <section className="px-4 mt-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
          Filmography
        </h3>
        {movieList.length === 0 ? (
          <p className="text-xs text-muted-foreground py-8 text-center">
            No movies tagged with this actor yet.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2.5">
            {movieList.map((m, i) => <MovieCard key={m.id} movie={m} idx={i} />)}
          </div>
        )}
      </section>
    </div>
  );
}
