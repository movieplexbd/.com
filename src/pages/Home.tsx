import { Link } from "react-router-dom";
import { Crown, Star, Play, Download } from "lucide-react";
import { useMemo } from "react";
import { useFirebaseList, useFirebaseValue } from "@/hooks/useFirebase";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";
import { useAuth } from "@/contexts/AuthContext";
import { MovieRow } from "@/components/MovieRow";
import { MovieCard } from "@/components/MovieCard";
import { MovieRowSkeleton } from "@/components/Loaders";
import type { Movie, Banner, AppPromo } from "@/lib/types";

function LazyMovieGrid({ movies, pageSize = 9 }: { movies: Movie[]; pageSize?: number }) {
  const { visible, hasMore, sentinelRef } = useInfiniteScroll(movies, pageSize);
  if (!movies.length) return null;
  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        {visible.map((m, i) => <MovieCard key={m.id} movie={m} idx={i} />)}
      </div>
      {hasMore && (
        <div ref={sentinelRef} className="grid grid-cols-3 gap-2 pt-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      )}
    </>
  );
}

export default function Home() {
  const { profile, isPremium } = useAuth();
  const { data: movies, loading } = useFirebaseList<Movie>("movies");
  const { data: banners } = useFirebaseList<Banner>("banners");
  const { data: appPromo } = useFirebaseValue<AppPromo>("app_promo");

  const { trending, banglaDub, hindi, south, korean, latest, recommended } = useMemo(() => {
    const trending = movies.filter((m) => m.trending);
    const banglaDub = movies.filter((m) => (m.category || m.subCategory || "").toLowerCase().includes("bangla"));
    const hindi = movies.filter((m) => (m.language || m.category || "").toLowerCase().includes("hindi"));
    const south = movies.filter((m) => (m.language || m.subCategory || "").toLowerCase().includes("south"));
    const korean = movies.filter((m) => (m.language || m.subCategory || "").toLowerCase().includes("korean"));
    const latest = [...movies].filter((m) => m.latest).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    const recommended = [...movies].sort((a, b) => (b.totalViews || 0) - (a.totalViews || 0));
    return { trending, banglaDub, hindi, south, korean, latest, recommended };
  }, [movies]);

  const heroBanner = useMemo(() => {
    // Only show banners whose linked movie still exists — otherwise tapping
    // "Watch Now" would navigate to /movie/{missingId} and (previously) cause
    // an empty movie node to be created via the view-counter transaction.
    const movieIds = new Set(movies.map((m) => m.id));
    const activeBanners = banners
      .filter((b) => b.active !== false)
      .filter((b) => {
        const target = b.movieId || b.id;
        return target && movieIds.has(target);
      })
      .sort((a, b) => (a.priority || 0) - (b.priority || 0));
    return activeBanners[0] || (movies[0] && {
      id: movies[0].id, movieId: movies[0].id, title: movies[0].title,
      subtitle: movies[0].shortDescription, imageUrl: movies[0].bannerImageUrl || movies[0].posterUrl,
      category: movies[0].category, imdbRating: movies[0].imdbRating,
    });
  }, [banners, movies]);

  return (
    <div className="space-y-2">
      {/* Top header */}
      <header className="sticky top-0 z-40 glass px-4 py-2.5 flex items-center justify-between border-b border-border/50" style={{ paddingTop: 'max(0.625rem, env(safe-area-inset-top))' }}>
        <Link to="/" className="flex items-center gap-1.5">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-primary shadow-premium">
            <Play size={16} className="fill-white text-white" />
          </div>
          <div className="leading-none">
            <div className="text-base font-extrabold tracking-tight">MOVIEPLEX<span className="text-primary">BD</span></div>
            <div className="text-[9px] font-medium text-muted-foreground">Bangla Dubbed OTT</div>
          </div>
        </Link>
        <div className="flex items-center gap-2">
          {!isPremium && (
            <Link to="/subscribe" className="flex items-center gap-1 rounded-full bg-gradient-premium px-2.5 py-1 text-[10px] font-bold text-premium-foreground shadow-sm">
              <Crown size={12} /> ৳10
            </Link>
          )}
          {appPromo?.enabled && appPromo?.downloadUrl ? (
            <a
              href={appPromo.downloadUrl}
              download
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Download our app"
              className="group inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 px-3 py-1.5 text-[10px] font-extrabold text-white shadow-premium active:scale-95 transition"
            >
              <Download size={12} strokeWidth={2.75} />
              <span className="leading-none">App<span className="hidden xs:inline"> Download</span></span>
            </a>
          ) : null}
          {profile?.photoUrl ? (
            <Link to="/profile">
              <img src={profile.photoUrl} alt="" className="h-9 w-9 rounded-full object-cover ring-2 ring-primary/20" />
            </Link>
          ) : null}
        </div>
      </header>

      {/* Hero Banner */}
      {heroBanner ? (
        <div className="animate-card-in">

          <Link to={`/movie/${heroBanner.movieId || heroBanner.id}`} className="block -mt-2">
            <div className="relative aspect-[16/10] overflow-hidden rounded-none shadow-sm">
              <img
                src={heroBanner.imageUrl || heroBanner.mobileImageUrl || "/placeholder.svg"}
                alt={heroBanner.title}
                fetchPriority="high"
                decoding="async"
                width="1600"
                height="1000"
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-overlay" />
              <div className="absolute inset-x-0 bottom-0 p-4 text-white">
                <div className="flex items-center gap-2 mb-1.5">
                  {heroBanner.category && (
                    <span className="rounded bg-primary/90 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                      {heroBanner.category}
                    </span>
                  )}
                  {heroBanner.imdbRating ? (
                    <span className="flex items-center gap-0.5 text-[11px] font-semibold">
                      <Star size={11} className="fill-premium text-premium" /> {heroBanner.imdbRating.toFixed(1)}
                    </span>
                  ) : null}
                </div>
                <h2 className="text-xl font-extrabold leading-tight line-clamp-1">{heroBanner.title}</h2>
                {heroBanner.subtitle && <p className="text-xs opacity-90 line-clamp-2 mt-0.5">{heroBanner.subtitle}</p>}
                <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-foreground text-xs font-bold shadow-premium">
                  <Play size={13} className="fill-current" /> Watch Now
                </div>
              </div>
            </div>
          </Link>
        </div>
      ) : loading ? (
        <div className="px-4"><div className="aspect-[16/10] w-full rounded-3xl bg-muted animate-pulse" /></div>
      ) : null}

      {loading ? (
        <>
          <MovieRowSkeleton />
          <MovieRowSkeleton />
        </>
      ) : (
        <>
          <MovieRow title="🔥 Trending Now" bangla="এখন জনপ্রিয়" movies={trending} />

          {banglaDub.length > 0 && (
            <section className="space-y-2.5 px-4">
              <div>
                <h2 className="text-base font-bold tracking-tight">Bangla Dubbed — All</h2>
                <p className="text-xs text-muted-foreground font-bangla">সকল বাংলা ডাবিং মুভি ({banglaDub.length})</p>
              </div>
              <LazyMovieGrid movies={banglaDub} pageSize={9} />
            </section>
          )}

          {hindi.length > 0 && (
            <section className="space-y-2.5 px-4">
              <div>
                <h2 className="text-base font-bold tracking-tight">Hindi Dubbed — All</h2>
                <p className="text-xs text-muted-foreground font-bangla">সকল হিন্দি ডাবিং মুভি ({hindi.length})</p>
              </div>
              <LazyMovieGrid movies={hindi} pageSize={9} />
            </section>
          )}

          <MovieRow title="South Indian" bangla="সাউথ ইন্ডিয়ান" movies={south} seeMoreTo="/movies?cat=south" />
          <MovieRow title="Korean" bangla="কোরিয়ান" movies={korean} seeMoreTo="/movies?cat=korean" />
          <MovieRow title="Latest Added" bangla="নতুন সংযোজন" movies={latest} seeMoreTo="/movies?sort=latest" />
          <MovieRow title="Recommended" bangla="আপনার জন্য" movies={recommended.slice(0, 12)} />

          {!movies.length && (
            <div className="px-4 py-12 text-center text-muted-foreground">
              <p className="text-sm">No movies yet. Add some from the admin panel.</p>
            </div>
          )}
        </>
      )}

      <div className="h-4" />
    </div>
  );
}
