import { useNavigate, useParams, Link } from "react-router-dom";
import { useFirebaseValue, useFirebaseList } from "@/hooks/useFirebase";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, Play, Star, Download, Heart, Share2, Clock, Calendar, Globe, Lock, Eye, Crown, Check, Sparkles, Zap, MonitorPlay, BadgeCheck, Smartphone } from "lucide-react";
import { motion } from "framer-motion";
import { ref, set, remove, runTransaction } from "firebase/database";
import { db } from "@/lib/firebase";
import { useEffect, useState } from "react";
import type { Movie, Actor, DownloadLink } from "@/lib/types";
import { MovieCard } from "@/components/MovieCard";
import { formatViews } from "@/lib/utils";
import { InlinePlayer } from "@/components/InlinePlayer";
import { AppDownloadPrompt } from "@/components/AppDownloadPrompt";

export default function MovieDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user, isPremium } = useAuth();
  const { data: movie, loading } = useFirebaseValue<Movie>(id ? `movies/${id}` : null);
  // Free preview movies — admin marks these as `testMovie` so users can
  // try the experience without an active subscription.
  const isFreePreview = !!movie?.testMovie;
  const canAccess = isPremium || isFreePreview;
  const { data: allMovies } = useFirebaseList<Movie>("movies");
  const { data: allActors } = useFirebaseList<Actor>("actors");
  const { data: favVal } = useFirebaseValue<boolean>(user && id ? `favorites/${user.uid}/${id}` : null);
  const [fav, setFav] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showDownloads, setShowDownloads] = useState(false);
  const [appPrompt, setAppPrompt] = useState<null | "watch" | "download">(null);
  useEffect(() => setFav(!!favVal), [favVal]);

  // Auto-show inline player at the top for everyone whenever a stream exists.
  // Subscription gating is handled by the Watch button / app prompt, not by hiding the player.
  useEffect(() => {
    if (movie?.videoStreamUrl) setIsPlaying(true);
  }, [movie?.videoStreamUrl]);

  // Only increment view count after the movie is confirmed to exist —
  // otherwise a transaction on an unknown id would create an empty
  // `movies/{id}` node (e.g. when a stale banner links to a missing movie).
  useEffect(() => {
    if (id && movie?.title) {
      runTransaction(ref(db, `movies/${id}/totalViews`), (v) => (v || 0) + 1).catch(() => {});
    }
  }, [id, movie?.title]);

  if (loading) {
    return (
      <div className="min-h-screen">
        <div className="aspect-[3/4] w-full bg-muted animate-pulse" />
        <div className="p-4 space-y-3">
          <div className="h-6 w-3/4 bg-muted rounded animate-pulse" />
          <div className="h-4 w-1/2 bg-muted rounded animate-pulse" />
          <div className="h-12 w-full bg-muted rounded-2xl animate-pulse mt-4" />
        </div>
      </div>
    );
  }
  if (!movie) {
    return (
      <div className="p-6 text-center pt-20">
        <p className="text-sm text-muted-foreground">Movie not found.</p>
        <Link to="/" className="mt-4 inline-block text-primary text-sm font-bold">← Back to Home</Link>
      </div>
    );
  }

  const startWatch = () => {
    if (!movie?.videoStreamUrl) { nav(`/watch/${id}`); return; }
    setIsPlaying(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleWatch = () => {
    if (!user) { nav("/login", { state: { from: `/movie/${id}` } }); return; }
    if (!canAccess) { nav(`/lock/${id}`); return; }
    startWatch();
  };

  const openDownloads = () => {
    if (!user) { nav("/login", { state: { from: `/movie/${id}` } }); return; }
    if (!canAccess) { nav(`/lock/${id}`); return; }
    setShowDownloads(true);
  };

  const toggleFav = async () => {
    if (!user) { nav("/login"); return; }
    const r = ref(db, `favorites/${user.uid}/${id}`);
    if (fav) await remove(r); else await set(r, true);
    setFav(!fav);
  };

  const share = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: movie.title, text: movie.shortDescription, url: location.href }); } catch {}
    } else { navigator.clipboard.writeText(location.href); alert("Link copied!"); }
  };

  const similar = allMovies
    .filter((m) => m.id !== movie.id && (m.category === movie.category || m.language === movie.language))
    .slice(0, 6);

  const banner = movie.bannerImageUrl || movie.detailThumbnailUrl || movie.posterUrl || "/placeholder.svg";
  const poster = movie.posterUrl || movie.detailThumbnailUrl || banner;

  return (
    <div className="pb-8 bg-background">
      {/* Hero — Player or Banner */}
      {isPlaying && movie.videoStreamUrl ? (
        <>
          <div className="relative w-full bg-black">
            {canAccess ? (
              <InlinePlayer
                movieId={movie.id}
                src={movie.videoStreamUrl}
                poster={poster}
                title={movie.title}
                onClose={() => nav(-1)}
              />
            ) : (
              // Locked preview — player frame is visible but playback is
              // blocked until the user subscribes.
              <div className="relative w-full aspect-video overflow-hidden bg-black">
                <img
                  src={poster}
                  alt={movie.title}
                  className="absolute inset-0 h-full w-full object-cover opacity-60"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/40" />
                <div className="absolute top-0 inset-x-0 p-2.5 flex items-center gap-2 z-10">
                  <button
                    onClick={() => nav(-1)}
                    aria-label="Back"
                    className="grid h-8 w-8 place-items-center rounded-full bg-white/15 backdrop-blur text-white"
                  >
                    <ArrowLeft size={14} />
                  </button>
                  <p className="flex-1 min-w-0 text-white text-xs font-bold line-clamp-1">{movie.title}</p>
                </div>
                <button
                  onClick={() => {
                    if (!user) { nav("/login", { state: { from: `/movie/${id}` } }); return; }
                    nav("/subscribe");
                  }}
                  className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 active:scale-[0.98] transition"
                >
                  <div className="grid h-16 w-16 place-items-center rounded-full bg-gradient-premium shadow-premium">
                    <Lock size={26} className="text-premium-foreground" strokeWidth={2.5} />
                  </div>
                  <div className="text-center px-6">
                    <p className="text-white text-sm font-extrabold tracking-tight">
                      Premium subscription required
                    </p>
                    <p className="mt-1 text-white/75 text-[11px] font-medium font-bangla">
                      দেখতে হলে সাবস্ক্রাইব করুন
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-premium px-4 py-2 text-[11px] font-extrabold text-premium-foreground shadow-premium">
                    <Lock size={11} strokeWidth={3} />
                    Subscribe Now
                  </span>
                </button>
              </div>
            )}
          </div>
          {/* Title + meta below player */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="px-4 pt-4"
          >
            <div className="flex items-center gap-1.5 mb-2 flex-wrap">
              {isFreePreview && (
                <span className="inline-flex items-center gap-1 rounded-full bg-success px-2.5 py-1 text-[10px] font-extrabold text-success-foreground">
                  <Sparkles size={9} strokeWidth={3} /> <span className="font-bangla">ফ্রি প্রিভিউ</span>
                </span>
              )}
              {movie.premiumOnly && !isFreePreview && (
                <span className="inline-flex items-center gap-1 rounded-full bg-gradient-premium px-2.5 py-1 text-[10px] font-bold text-premium-foreground">
                  <Lock size={9} strokeWidth={3} /> PREMIUM
                </span>
              )}
              {movie.category && (
                <span className="rounded-full bg-primary px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
                  {movie.category}
                </span>
              )}
              {movie.quality && (
                <span className="rounded-full bg-muted text-foreground px-2.5 py-1 text-[10px] font-bold border border-border">
                  {movie.quality}
                </span>
              )}
            </div>
            <div className="flex items-start gap-3">
              <h1 className="flex-1 text-2xl font-extrabold leading-[1.1] tracking-tight text-balance">
                {movie.title}
              </h1>
              <div className="flex gap-1.5 shrink-0 pt-1">
                <button
                  onClick={toggleFav}
                  aria-label={fav ? "Remove from saved" : "Save"}
                  className="grid h-9 w-9 place-items-center rounded-full bg-muted border border-border active:scale-95 transition"
                >
                  <Heart size={15} className={fav ? "fill-primary text-primary" : "text-foreground"} />
                </button>
                <button
                  onClick={share}
                  aria-label="Share"
                  className="grid h-9 w-9 place-items-center rounded-full bg-muted border border-border active:scale-95 transition"
                >
                  <Share2 size={15} className="text-foreground" />
                </button>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
              {movie.imdbRating ? (
                <span className="flex items-center gap-1 font-semibold text-foreground">
                  <Star size={13} className="fill-premium text-premium" />
                  {movie.imdbRating.toFixed(1)}
                  <span className="text-muted-foreground font-normal">/ 10</span>
                </span>
              ) : null}
              {movie.year && <span className="flex items-center gap-1"><Calendar size={11} />{movie.year}</span>}
              {movie.duration && <span className="flex items-center gap-1"><Clock size={11} />{movie.duration}</span>}
              {movie.language && <span className="flex items-center gap-1"><Globe size={11} />{movie.language}</span>}
            </div>
          </motion.div>
        </>
      ) : (
        <div className="relative aspect-[3/4] w-full overflow-hidden">
          <motion.img
            initial={{ scale: 1.08 }}
            animate={{ scale: 1 }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            src={banner}
            alt={movie.title}
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-background via-background/70 to-transparent" />
          <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/40 to-transparent" />

          {/* Top action bar */}
          <div className="absolute inset-x-0 top-0 safe-top px-4 pt-3 flex items-center justify-between z-10">
            <button
              onClick={() => nav(-1)}
              className="grid h-10 w-10 place-items-center rounded-full bg-white/15 backdrop-blur-xl text-white border border-white/20 active:scale-95 transition"
            >
              <ArrowLeft size={18} strokeWidth={2.5} />
            </button>
            <div className="flex gap-2">
              <button
                onClick={toggleFav}
                className="grid h-10 w-10 place-items-center rounded-full bg-white/15 backdrop-blur-xl text-white border border-white/20 active:scale-95 transition"
              >
                <Heart size={16} strokeWidth={2.5} className={fav ? "fill-primary text-primary" : ""} />
              </button>
              <button
                onClick={share}
                className="grid h-10 w-10 place-items-center rounded-full bg-white/15 backdrop-blur-xl text-white border border-white/20 active:scale-95 transition"
              >
                <Share2 size={16} strokeWidth={2.5} />
              </button>
            </div>
          </div>

          {/* Bottom overlay */}
          <div className="absolute inset-x-0 bottom-0 p-5 z-10">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                {isFreePreview && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-success px-2.5 py-1 text-[10px] font-extrabold text-success-foreground">
                    <Sparkles size={9} strokeWidth={3} /> <span className="font-bangla">ফ্রি প্রিভিউ</span>
                  </span>
                )}
                {movie.premiumOnly && !isFreePreview && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-gradient-premium px-2.5 py-1 text-[10px] font-bold text-premium-foreground">
                    <Lock size={9} strokeWidth={3} /> PREMIUM
                  </span>
                )}
                {movie.category && (
                  <span className="rounded-full bg-primary px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
                    {movie.category}
                  </span>
                )}
                {movie.quality && (
                  <span className="rounded-full bg-foreground/10 backdrop-blur-md text-foreground px-2.5 py-1 text-[10px] font-bold border border-foreground/10">
                    {movie.quality}
                  </span>
                )}
              </div>

              <h1 className="text-3xl font-extrabold leading-[1.05] tracking-tight text-balance">
                {movie.title}
              </h1>

              <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                {movie.imdbRating ? (
                  <span className="flex items-center gap-1 font-semibold text-foreground">
                    <Star size={13} className="fill-premium text-premium" />
                    {movie.imdbRating.toFixed(1)}
                  </span>
                ) : null}
                {movie.year && <span className="flex items-center gap-1"><Calendar size={11} />{movie.year}</span>}
                {movie.duration && <span className="flex items-center gap-1"><Clock size={11} />{movie.duration}</span>}
                {movie.language && <span className="flex items-center gap-1"><Globe size={11} />{movie.language}</span>}
              </div>

              {/* Watch CTA */}
              <button
                onClick={handleWatch}
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-extrabold text-primary-foreground shadow-premium active:scale-95 transition"
              >
                <Play size={16} className="fill-primary-foreground" strokeWidth={0} />
                <span className="font-bangla">এখন দেখুন</span>
                {!canAccess && <Lock size={12} className="opacity-80" />}
              </button>
            </motion.div>
          </div>
        </div>
      )}

      <div className="px-4 space-y-6 mt-4">
        {/* Separate App Download CTA */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <button
            onClick={() => setAppPrompt("download")}
            className="flex w-full items-center gap-3 rounded-2xl border border-primary/20 bg-primary/10 p-3 text-left active:scale-[0.98] transition"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-premium">
              <Smartphone size={19} strokeWidth={2.5} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-extrabold leading-tight font-bangla">MOVIEPLEXBD অ্যাপ ডাউনলোড</span>
              <span className="mt-0.5 block text-[11px] font-semibold leading-tight text-muted-foreground font-bangla">দ্রুত স্ট্রিমিং, ডাউনলোড ও নোটিফিকেশন</span>
            </span>
            <Download size={17} className="shrink-0 text-primary" strokeWidth={2.5} />
          </button>
        </motion.div>

        {/* Download CTA */}
        {(() => {
          const links: DownloadLink[] = Array.isArray(movie.downloads)
            ? movie.downloads
            : movie.downloads
            ? Object.values(movie.downloads)
            : [];
          const hasMulti = links.length > 0;
          if (!hasMulti && !movie.downloadUrl) return null;
          return (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
            >
              <button
                onClick={openDownloads}
                className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2 text-xs font-extrabold text-white shadow-premium active:scale-95 transition"
              >
                <Download size={14} strokeWidth={2.75} />
                <span>{!canAccess ? "Unlock & Download" : "Download"}</span>
                {hasMulti && (
                  <span className="rounded-full bg-white/25 px-1.5 py-0.5 text-[9px] font-extrabold tabular-nums">
                    {links.length}
                  </span>
                )}
              </button>
            </motion.div>
          );
        })()}

        {/* Premium Benefits — compact, simple, readable */}
        {!isPremium && !isFreePreview && (
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="rounded-2xl border border-premium/30 bg-card p-4"
          >
            {/* Header — clear price */}
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-premium">
                <Crown size={18} className="text-premium-foreground" strokeWidth={2.5} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-[15px] font-extrabold tracking-tight leading-tight">
                  Premium — only ৳10/month
                </h3>
                <p className="text-[11px] font-medium text-muted-foreground font-bangla leading-tight mt-0.5">
                  মাত্র ১০ টাকায় সব মুভি আনলক
                </p>
              </div>
            </div>

            <p className="mt-3 rounded-xl bg-muted/40 p-3 text-[11px] font-semibold leading-relaxed text-muted-foreground font-bangla">
              সদ্য মুক্তি পাওয়া নতুন সকল মুভির বাংলা ডাবিং পেয়ে যান মাত্র ১০ টাকায় এক মাসের অ্যাক্সেস। মাত্র একটি চায়ের দামে! 🔥
            </p>

            {/* Features — compact 2x2 grid */}
            <ul className="mt-4 grid grid-cols-1 gap-y-2">
              {[
                "মোবাইল অ্যাপ (ফুল এক্সপেরিন্স)",
                "সম্পূর্ণ বিজ্ঞাপনমুক্ত ওয়েবসাইট",
                "ওয়েবসাইটেই রিলস দেখে মুভি সিলেকশন সুবিধা",
                "এক ক্লিকে ডাউনলোড সুবিধা",
                "সকল মুভির বাংলা ডাবিং",
                "আনলিমিটেড মুভি কালেকশন",
                "Animal, Spiderman, Avengers টাইপ সকল ইন্ডিয়ান, হলিউড ও কোরিয়ান মুভির বাংলা ডাবিং",
              ].map((t) => (
                <li key={t} className="flex gap-1.5">
                  <Check size={13} className="mt-0.5 shrink-0 text-premium" strokeWidth={3} />
                  <span className="text-[12px] font-semibold text-foreground leading-tight font-bangla">{t}</span>
                </li>
              ))}
            </ul>

            {/* CTA */}
            <button
              onClick={() => {
                if (!user) { nav("/login", { state: { from: `/movie/${id}` } }); return; }
                nav("/subscribe");
              }}
              className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-gradient-premium px-5 py-2.5 text-sm font-extrabold text-premium-foreground shadow-premium active:scale-[0.98] transition"
            >
              <Crown size={14} strokeWidth={2.5} />
              Subscribe for ৳10
            </button>
          </motion.section>
        )}

        {/* Download Sheet */}
        <DownloadSheet
          open={showDownloads}
          onOpenChange={setShowDownloads}
          links={
            Array.isArray(movie.downloads)
              ? movie.downloads
              : movie.downloads
              ? Object.values(movie.downloads)
              : []
          }
          fallbackUrl={movie.downloadUrl}
          onPick={() => {
            if (id) runTransaction(ref(db, `movies/${id}/totalDownloads`), (v) => (v || 0) + 1).catch(() => {});
          }}
        />

        {/* Cast / Actors — horizontal scroll */}
        {(() => {
          const cast = (movie.actorIds || [])
            .map((aid) => allActors.find((a) => a.id === aid))
            .filter(Boolean) as Actor[];
          if (!cast.length) return null;
          return (
            <section>
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                Cast
              </h3>
              <div className="flex gap-4 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1">
                {cast.map((a) => (
                  <Link
                    key={a.id}
                    to={`/actor/${a.id}`}
                    className="shrink-0 flex flex-col items-center w-[72px] active:scale-95 transition"
                  >
                    <div className="h-[72px] w-[72px] rounded-full overflow-hidden border-2 border-border bg-muted">
                      <img
                        src={a.imageUrl || "/placeholder.svg"}
                        alt={a.name}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <p className="mt-2 text-[11px] font-semibold text-foreground text-center leading-tight line-clamp-2">
                      {a.name}
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          );
        })()}

        {movie.shortDescription && (
          <p className="text-sm text-foreground/80 leading-relaxed -mt-1">
            {movie.shortDescription}
          </p>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2">
          <StatCard
            icon={<Eye size={14} className="text-primary" />}
            label="Views"
            value={formatViews(movie.totalViews)}
          />
          <StatCard
            icon={<Download size={14} className="text-primary" />}
            label="Downloads"
            value={formatViews(movie.totalDownloads)}
          />
          <StatCard
            icon={<Star size={14} className="text-premium fill-premium" />}
            label="Rating"
            value={movie.imdbRating ? movie.imdbRating.toFixed(1) : "—"}
          />
        </div>

        {/* Storyline */}
        {movie.description && (
          <section>
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
              Storyline
            </h3>
            <p className="text-sm text-foreground/85 leading-relaxed">
              {movie.description}
            </p>
          </section>
        )}

        {/* Tags */}
        {movie.tags && movie.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {movie.tags.map((t) => (
              <span
                key={t}
                className="rounded-full border border-border bg-muted/50 px-3 py-1 text-[11px] font-semibold text-foreground/70"
              >
                {t}
              </span>
            ))}
          </div>
        )}

        {/* Cast / Director / Country */}
        {(movie.director || movie.country || movie.language) && (
          <section className="rounded-2xl border border-border bg-card p-4 space-y-3">
            {movie.director && <DetailRow label="Director" value={movie.director} />}
            {movie.country && <DetailRow label="Country" value={movie.country} />}
            {movie.language && <DetailRow label="Language" value={movie.language} />}
            {movie.year && <DetailRow label="Released" value={String(movie.year)} />}
          </section>
        )}

        {/* Similar */}
        {similar.length > 0 && (
          <section>
            <div className="flex items-end justify-between mb-3">
              <h3 className="text-base font-bold tracking-tight">More Like This</h3>
              <span className="text-[10px] font-bangla text-muted-foreground">আরও দেখুন</span>
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              {similar.map((m, i) => <MovieCard key={m.id} movie={m} idx={i} />)}
            </div>
          </section>
        )}
      </div>

      {/* App Download Prompt — gates non-premium watch/download */}
      <AppDownloadPrompt
        open={appPrompt !== null}
        onClose={() => setAppPrompt(null)}
        onContinue={() => {
          setAppPrompt(null);
        }}
        intent={appPrompt || "watch"}
      />
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3 text-center">
      <div className="flex justify-center mb-1">{icon}</div>
      <div className="text-sm font-bold leading-none">{value}</div>
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground mt-1 font-semibold">{label}</div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 text-xs">
      <div className="w-20 shrink-0 uppercase tracking-wider text-muted-foreground font-semibold text-[10px] pt-0.5">
        {label}
      </div>
      <div className="flex-1 font-semibold text-foreground/90">{value}</div>
    </div>
  );
}

function DownloadSheet({
  open,
  onOpenChange,
  links,
  fallbackUrl,
  onPick,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  links: DownloadLink[];
  fallbackUrl?: string;
  onPick: () => void;
}) {
  if (!open) return null;
  const all = links.length > 0
    ? links
    : fallbackUrl
    ? [{ quality: "Default", url: fallbackUrl } as DownloadLink]
    : [];
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/60 flex items-end"
      onClick={() => onOpenChange(false)}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full bg-card text-foreground rounded-t-3xl px-5 pt-5 max-h-[85svh] overflow-y-auto overscroll-contain"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 6rem)" }}
      >
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-muted-foreground/30" />
        <h3 className="text-base font-extrabold mb-1">Download</h3>
        <p className="text-[11px] text-muted-foreground mb-4">
          Choose your preferred quality
        </p>
        {all.length === 0 ? (
          <p className="text-center text-xs text-muted-foreground py-6">
            No download links available.
          </p>
        ) : (
          <div className="space-y-2">
            {all.map((l, i) => (
              <a
                key={i}
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => { onPick(); onOpenChange(false); }}
                className="flex items-center gap-3 rounded-2xl border border-border bg-background px-4 py-3 active:scale-[0.98] transition"
              >
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary shrink-0">
                  <Download size={16} strokeWidth={2.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold leading-tight">{l.quality}</p>
                  {l.size && (
                    <p className="text-[11px] text-muted-foreground mt-0.5">{l.size}</p>
                  )}
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Get
                </span>
              </a>
            ))}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

