import { useState, useRef, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { Heart, Share2, Play, Volume2, VolumeX, Film, Search } from "lucide-react";
import { useFirebaseList } from "@/hooks/useFirebase";
import { ref, runTransaction } from "firebase/database";
import { db } from "@/lib/firebase";
import { motion } from "framer-motion";
import type { Reel, Movie } from "@/lib/types";
import { formatViews } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

/** Pull a YouTube video ID out of any common URL form (Shorts / watch / youtu.be / embed). */
function getYouTubeId(url?: string): string | null {
  if (!url) return null;
  const patterns = [
    /youtube\.com\/shorts\/([A-Za-z0-9_-]{6,})/,
    /youtube\.com\/watch\?v=([A-Za-z0-9_-]{6,})/,
    /youtu\.be\/([A-Za-z0-9_-]{6,})/,
    /youtube\.com\/embed\/([A-Za-z0-9_-]{6,})/,
  ];
  for (const re of patterns) {
    const m = url.match(re);
    if (m?.[1]) return m[1];
  }
  return null;
}

/** Detect any URL that should be rendered as a generic <iframe> embed
 *  (Cloudinary player, Vimeo, Dailymotion, Streamable, etc.). */
function getIframeEmbedUrl(url?: string): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    // Cloudinary player embed — works as-is
    if (host.includes("player.cloudinary.com")) return url;
    // Vimeo
    if (host === "vimeo.com" || host === "www.vimeo.com") {
      const id = u.pathname.split("/").filter(Boolean)[0];
      if (id) return `https://player.vimeo.com/video/${id}?autoplay=1&muted=1&loop=1&background=1`;
    }
    if (host.includes("player.vimeo.com")) return url;
    // Dailymotion
    if (host.includes("dailymotion.com") || host === "dai.ly") {
      const id = u.pathname.replace("/video/", "").replace("/", "");
      if (id) return `https://www.dailymotion.com/embed/video/${id}?autoplay=1&mute=1`;
    }
    // Streamable
    if (host.includes("streamable.com")) {
      const id = u.pathname.split("/").filter(Boolean).pop();
      if (id) return `https://streamable.com/e/${id}?autoplay=1&muted=1&loop=1`;
    }
    return null;
  } catch {
    return null;
  }
}

/** Best-effort: link a reel to a movie when only a title was provided. */
function findMovieByTitle(title: string | undefined, movies: Movie[]): Movie | undefined {
  if (!title) return undefined;
  const t = title.trim().toLowerCase();
  if (!t) return undefined;
  // Exact match first, then starts-with, then contains.
  return (
    movies.find((m) => m.title?.toLowerCase() === t) ||
    movies.find((m) => m.title?.toLowerCase().startsWith(t)) ||
    movies.find((m) => m.title?.toLowerCase().includes(t))
  );
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                       */
/* -------------------------------------------------------------------------- */

export default function Shorts() {
  const { data: rawReels, loading } = useFirebaseList<Reel>("reels");
  const { data: movies } = useFirebaseList<Movie>("movies");
  const [muted, setMuted] = useState(true);

  /**
   * Ranking algorithm — surfaces fresh + engaging reels first.
   *
   * Score = (likes * 3 + shares * 4 + views) * recency_boost
   * recency_boost decays from 1.0 (today) to ~0.4 over 30 days.
   * Reels without a playable URL are filtered out.
   * Identical videoUrls are deduplicated (keep the most engaged copy).
   */
  const reels = useMemo(() => {
    const now = Date.now();
    const byUrl = new Map<string, Reel>();

    for (const r of rawReels) {
      if (!r.videoUrl) continue;
      // Resolve missing movieId via movieTitle for legacy / Android admin entries.
      const linked = r.movieId ? undefined : findMovieByTitle(r.movieTitle, movies);
      const enriched: Reel = linked ? { ...r, movieId: linked.id } : r;

      const key = enriched.videoUrl!;
      const existing = byUrl.get(key);
      if (!existing) byUrl.set(key, enriched);
      else {
        // Keep the entry with more engagement
        const score = (x: Reel) => (x.likes || 0) + (x.shares || 0) + (x.views || 0);
        if (score(enriched) > score(existing)) byUrl.set(key, enriched);
      }
    }

    const scored = Array.from(byUrl.values()).map((r) => {
      const ageDays = r.createdAt ? Math.max(0, (now - r.createdAt) / 86_400_000) : 30;
      const recency = Math.max(0.4, 1 - ageDays / 60); // 1.0 → 0.4 over ~36 days
      const engagement = (r.likes || 0) * 3 + (r.shares || 0) * 4 + (r.views || 0);
      const base = engagement + 1; // ensure non-zero so brand-new reels still rank
      return { r, score: base * recency };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.map((s) => s.r);
  }, [rawReels, movies]);

  return (
    <div className="bg-black min-h-screen -mb-20">
      {loading ? (
        <div className="grid place-items-center h-screen text-white/60 text-sm">Loading shorts…</div>
      ) : reels.length === 0 ? (
        <div className="grid place-items-center h-screen text-white/60 text-sm px-8 text-center">
          <div>
            <p className="font-bangla mb-2">কোনো শর্ট ভিডিও নেই</p>
            <p className="text-xs">No reels uploaded yet.</p>
          </div>
        </div>
      ) : (
        <div className="snap-y snap-mandatory overflow-y-scroll h-screen no-scrollbar">
          {reels.map((reel) => (
            <ReelItem key={reel.id} reel={reel} muted={muted} setMuted={setMuted} />
          ))}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Single reel                                                                */
/* -------------------------------------------------------------------------- */

function ReelItem({ reel, muted, setMuted }: { reel: Reel; muted: boolean; setMuted: (v: boolean) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [active, setActive] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [liked, setLiked] = useState(false);

  const ytId = useMemo(() => getYouTubeId(reel.videoUrl), [reel.videoUrl]);
  const iframeUrl = useMemo(
    () => (ytId ? null : getIframeEmbedUrl(reel.videoUrl)),
    [ytId, reel.videoUrl],
  );
  const isYouTube = !!ytId;
  const isIframe = !!ytId || !!iframeUrl;
  const searchTerm = (reel.movieTitle || reel.title || "").trim();

  // Track visibility — used to start/pause video and mount/unmount iframe.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => setActive(e.isIntersecting && e.intersectionRatio > 0.7),
      { threshold: [0, 0.7, 1] },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Track pending play() promise so we never call pause() while play is still resolving
  // (that combination throws "AbortError" and leaves the video in a stuck paused state).
  const playPromiseRef = useRef<Promise<void> | null>(null);

  const safePlay = (v: HTMLVideoElement) => {
    const p = v.play();
    if (p && typeof p.then === "function") {
      playPromiseRef.current = p;
      p.then(() => { playPromiseRef.current = null; })
       .catch(() => { playPromiseRef.current = null; });
    }
    return p;
  };

  const safePause = async (v: HTMLVideoElement) => {
    // Wait for any in-flight play() to settle before pausing.
    if (playPromiseRef.current) {
      try { await playPromiseRef.current; } catch { /* ignore */ }
    }
    v.pause();
  };

  // Native video play/pause based on visibility
  useEffect(() => {
    if (isIframe) return;
    const v = videoRef.current;
    if (!v) return;
    if (active) {
      safePlay(v)?.catch(() => {/* autoplay blocked — overlay will show */});
    } else {
      safePause(v);
    }
  }, [active, isIframe]);

  // View counter — bump once when reel becomes active
  const countedRef = useRef(false);
  useEffect(() => {
    if (active && !countedRef.current && reel.id) {
      countedRef.current = true;
      runTransaction(ref(db, `reels/${reel.id}/views`), (v) => (v || 0) + 1).catch(() => {});
    }
  }, [active, reel.id]);

  const togglePlay = (e?: React.MouseEvent | React.SyntheticEvent) => {
    if (isIframe) return;
    e?.stopPropagation?.();
    const v = videoRef.current;
    if (!v) return;
    // Use the element's actual state (not React state, which can lag) to decide.
    if (v.paused || v.ended) {
      safePlay(v);
    } else {
      safePause(v);
    }
  };

  const onLike = () => {
    if (liked || !reel.id) return;
    setLiked(true);
    runTransaction(ref(db, `reels/${reel.id}/likes`), (v) => (v || 0) + 1).catch(() => {});
  };

  const onShare = async () => {
    const url = window.location.origin + "/shorts";
    try {
      if (navigator.share) {
        await navigator.share({ title: reel.title || "Watch this", url });
      } else {
        await navigator.clipboard.writeText(url);
      }
      if (reel.id) {
        runTransaction(ref(db, `reels/${reel.id}/shares`), (v) => (v || 0) + 1).catch(() => {});
      }
    } catch {/* dismissed */}
  };

  return (
    <div ref={containerRef} className="relative h-screen w-full snap-start snap-always overflow-hidden">
      {isIframe ? (
        active ? (
          <iframe
            key={reel.id}
            src={
              ytId
                ? `https://www.youtube.com/embed/${ytId}?autoplay=1&mute=${muted ? 1 : 0}&controls=0&playsinline=1&rel=0&modestbranding=1&loop=1&playlist=${ytId}`
                : iframeUrl!
            }
            title={reel.title || "Reel"}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            className="absolute inset-0 h-full w-full pointer-events-auto"
            style={{ border: 0 }}
          />
        ) : (
          // Lightweight placeholder — keeps memory low for off-screen reels
          <img
            src={
              reel.thumbnailUrl ||
              (ytId ? `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg` : "/placeholder.svg")
            }
            alt={reel.title || ""}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover"
          />
        )
      ) : (
        <video
          ref={videoRef}
          src={reel.videoUrl}
          poster={reel.thumbnailUrl}
          loop
          muted={muted}
          playsInline
          preload="metadata"
          className="absolute inset-0 h-full w-full object-cover"
          onClick={togglePlay}
          onPlay={() => setPlaying(true)}
          onPlaying={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
        />
      )}

      {/* Tap-to-play overlay — only shown when paused. */}
      {!isIframe && !playing && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); togglePlay(e); }}
          className="absolute inset-0 grid place-items-center z-10 bg-transparent"
          aria-label="Play"
        >
          <div className="grid h-16 w-16 place-items-center rounded-full bg-white/20 backdrop-blur pointer-events-none">
            <Play size={28} className="fill-white text-white" />
          </div>
        </button>
      )}

      {/* Top safe-area gradient so phone status bar stays readable */}
      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/50 to-transparent pointer-events-none safe-top" />

      {/* Bottom info overlay */}
      <div className="absolute inset-x-0 bottom-0 p-4 pb-24 bg-gradient-to-t from-black/85 via-black/40 to-transparent text-white pointer-events-none">
        {reel.title && (
          <h3 className="text-sm font-bold line-clamp-2 mb-2 max-w-[80%]">{reel.title}</h3>
        )}
        {reel.movieTitle && !reel.movieId && (
          <p className="text-[11px] text-white/70 mb-2 line-clamp-1">From: {reel.movieTitle}</p>
        )}
        {reel.movieId ? (
          <Link
            to={`/movie/${reel.movieId}`}
            className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full bg-white text-black px-3 py-1.5 text-xs font-bold active:scale-95 transition"
          >
            <Film size={12} /> Watch Movie
          </Link>
        ) : null}
        {searchTerm ? (
          <Link
            to={`/search?q=${encodeURIComponent(searchTerm)}`}
            className="pointer-events-auto ml-2 inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground shadow-lg active:scale-95 transition"
          >
            <Search size={12} /> Search
          </Link>
        ) : null}
      </div>

      {/* Side actions */}
      <div className="absolute right-3 bottom-32 flex flex-col gap-4 items-center text-white z-10">
        <motion.button
          whileTap={{ scale: 0.85 }}
          onClick={onLike}
          aria-label="Like"
          className="grid place-items-center"
        >
          <div className={`grid h-10 w-10 place-items-center rounded-full backdrop-blur transition ${liked ? "bg-primary" : "bg-white/15"}`}>
            <Heart size={18} className={liked ? "fill-white" : ""} />
          </div>
          <span className="text-[10px] font-semibold mt-0.5 tabular-nums">{formatViews((reel.likes || 0) + (liked ? 1 : 0))}</span>
        </motion.button>
        <motion.button whileTap={{ scale: 0.85 }} onClick={onShare} aria-label="Share" className="grid place-items-center">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-white/15 backdrop-blur">
            <Share2 size={18} />
          </div>
          <span className="text-[10px] font-semibold mt-0.5 tabular-nums">{formatViews(reel.shares)}</span>
        </motion.button>
        <motion.button whileTap={{ scale: 0.85 }} onClick={() => setMuted(!muted)} aria-label="Mute" className="grid place-items-center">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-white/15 backdrop-blur">
            {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </div>
        </motion.button>
      </div>
    </div>
  );
}
