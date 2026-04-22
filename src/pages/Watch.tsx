import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Hls from "hls.js";
import {
  ArrowLeft, Play, Pause, Volume2, VolumeX, Maximize, Minimize,
  RotateCcw, RotateCw, Loader2, Settings, PictureInPicture2, Download, SkipForward,
} from "lucide-react";
import { useFirebaseValue } from "@/hooks/useFirebase";
import { useAuth } from "@/contexts/AuthContext";
import { ref, set, runTransaction, push } from "firebase/database";
import { db } from "@/lib/firebase";
import { fmtDuration } from "@/lib/utils";
import type { Movie } from "@/lib/types";
import { motion, AnimatePresence } from "framer-motion";

export default function Watch() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user, isPremium } = useAuth();
  const { data: movie, loading } = useFirebaseValue<Movie>(id ? `movies/${id}` : null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const idleTimer = useRef<number | null>(null);

  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const [buffering, setBuffering] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [showCtrls, setShowCtrls] = useState(true);
  const [qualities, setQualities] = useState<{ height: number; index: number }[]>([]);
  const [currentQuality, setCurrentQuality] = useState(-1);
  const [showSettings, setShowSettings] = useState(false);
  const [speed, setSpeed] = useState(1);

  // Auth/premium guard — ALL movies require active subscription
  useEffect(() => {
    if (loading) return;
    if (!user) { nav(`/login`, { state: { from: `/watch/${id}` } }); return; }
    if (!isPremium) { nav(`/lock/${id}`, { replace: true }); }
  }, [user, isPremium, movie, loading, id, nav]);

  // Setup HLS
  useEffect(() => {
    const v = videoRef.current;
    const url = movie?.videoStreamUrl;
    if (!v || !url) return;

    v.preload = "auto";

    if (url.endsWith(".m3u8") && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        startLevel: 0,
        autoStartLoad: true,
        maxBufferLength: 20,
        maxMaxBufferLength: 40,
        maxBufferSize: 30 * 1000 * 1000,
        backBufferLength: 15,
        fragLoadingMaxRetry: 4,
        manifestLoadingMaxRetry: 4,
        levelLoadingMaxRetry: 4,
        fragLoadingTimeOut: 12000,
        manifestLoadingTimeOut: 8000,
        startFragPrefetch: true,
        testBandwidth: false,
        progressive: true,
      });
      hlsRef.current = hls;
      hls.loadSource(url);
      hls.attachMedia(v);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setQualities(hls.levels.map((l, i) => ({ height: l.height, index: i })));
        v.play().catch(() => {});
      });
      hls.on(Hls.Events.FRAG_BUFFERED, () => setBuffering(false));
      return () => { hls.destroy(); hlsRef.current = null; };
    } else {
      v.src = url;
      v.load();
      v.play().catch(() => {});
    }
  }, [movie?.videoStreamUrl]);

  // Increment view count + log view event (once per mount)
  useEffect(() => {
    if (!id || !movie?.videoStreamUrl) return;
    runTransaction(ref(db, `movies/${id}/totalViews`), (cur) => (cur || 0) + 1).catch(() => {});
    push(ref(db, "view_logs"), {
      movieId: id,
      uid: user?.uid || "guest",
      title: movie.title,
      category: movie.category || null,
      createdAt: Date.now(),
    }).catch(() => {});
  }, [id, movie?.videoStreamUrl]);

  // Resume position
  useEffect(() => {
    if (!user || !id || !movie?.videoStreamUrl) return;
    const r = ref(db, `watch_history/${user.uid}/${id}`);
    import("firebase/database").then(({ get }) => {
      get(r).then((snap) => {
        const v = snap.val();
        if (v?.watchedSeconds && videoRef.current && v.watchedSeconds < v.duration - 30) {
          videoRef.current.currentTime = v.watchedSeconds;
        }
      });
    });
  }, [user, id, movie?.videoStreamUrl]);

  // Save progress every 5s
  useEffect(() => {
    if (!user || !id) return;
    const t = setInterval(() => {
      const v = videoRef.current;
      if (!v || !v.duration) return;
      set(ref(db, `watch_history/${user.uid}/${id}`), {
        progress: v.duration ? v.currentTime / v.duration : 0,
        watchedSeconds: v.currentTime,
        duration: v.duration,
        lastWatchedAt: Date.now(),
      });
    }, 5000);
    return () => clearInterval(t);
  }, [user, id]);

  const togglePlay = useCallback(() => {
    const v = videoRef.current; if (!v) return;
    if (v.paused) v.play(); else v.pause();
  }, []);

  const seek = (delta: number) => {
    const v = videoRef.current; if (!v) return;
    v.currentTime = Math.max(0, Math.min(v.duration, v.currentTime + delta));
  };

  const toggleFs = async () => {
    const c = containerRef.current; if (!c) return;
    if (!document.fullscreenElement) await c.requestFullscreen?.();
    else await document.exitFullscreen?.();
  };

  const togglePip = async () => {
    const v = videoRef.current as any; if (!v) return;
    try {
      if (document.pictureInPictureElement) await (document as any).exitPictureInPicture();
      else await v.requestPictureInPicture?.();
    } catch {}
  };

  useEffect(() => {
    const onFs = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const resetIdle = useCallback(() => {
    setShowCtrls(true);
    if (idleTimer.current) window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => { if (playing) setShowCtrls(false); }, 3500);
  }, [playing]);

  useEffect(() => { resetIdle(); }, [resetIdle]);

  const setQuality = (idx: number) => {
    if (hlsRef.current) hlsRef.current.currentLevel = idx;
    setCurrentQuality(idx);
    setShowSettings(false);
  };
  const setPlaybackSpeed = (s: number) => {
    if (videoRef.current) videoRef.current.playbackRate = s;
    setSpeed(s);
    setShowSettings(false);
  };

  if (loading || !movie) {
    return <div className="grid place-items-center min-h-screen bg-black text-white/60 text-sm"><Loader2 className="animate-spin" /></div>;
  }
  if (!movie.videoStreamUrl) {
    return (
      <div className="min-h-screen bg-black text-white grid place-items-center px-6 text-center">
        <div>
          <p className="text-sm">No video stream available for this movie.</p>
          <button onClick={() => nav(-1)} className="mt-4 rounded-full bg-white text-black px-4 py-2 text-sm font-bold">Back</button>
        </div>
      </div>
    );
  }

  const progress = duration ? (current / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      className="relative h-screen w-full bg-black overflow-hidden select-none"
      onMouseMove={resetIdle}
      onTouchStart={resetIdle}
      onClick={resetIdle}
    >
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-contain"
        playsInline
        autoPlay
        preload="auto"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onWaiting={() => setBuffering(true)}
        onPlaying={() => setBuffering(false)}
        onCanPlay={() => setBuffering(false)}
        onLoadedData={() => setBuffering(false)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onVolumeChange={(e) => { setVolume(e.currentTarget.volume); setMuted(e.currentTarget.muted); }}
        onClick={togglePlay}
        onDoubleClick={toggleFs}
      />

      {/* Buffer */}
      {buffering && (
        <div className="absolute inset-0 grid place-items-center pointer-events-none">
          <Loader2 className="animate-spin text-white/90" size={48} />
        </div>
      )}

      {/* Controls */}
      <AnimatePresence>
        {showCtrls && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/60 pointer-events-none"
          >
            {/* Top bar */}
            <div className="absolute top-0 inset-x-0 p-4 flex items-center gap-3 pointer-events-auto safe-top">
              <button onClick={() => nav(-1)} className="grid h-10 w-10 place-items-center rounded-full bg-white/10 backdrop-blur text-white">
                <ArrowLeft size={18} />
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-bold line-clamp-1">{movie.title}</p>
                <p className="text-white/70 text-[10px]">{movie.year} · {movie.quality || "HD"}</p>
              </div>
              <button onClick={togglePip} className="grid h-10 w-10 place-items-center rounded-full bg-white/10 backdrop-blur text-white">
                <PictureInPicture2 size={16} />
              </button>
              {movie.downloadUrl && isPremium && (
                <a href={movie.downloadUrl} download className="grid h-10 w-10 place-items-center rounded-full bg-white/10 backdrop-blur text-white">
                  <Download size={16} />
                </a>
              )}
              <button onClick={() => setShowSettings(true)} className="grid h-10 w-10 place-items-center rounded-full bg-white/10 backdrop-blur text-white">
                <Settings size={16} />
              </button>
            </div>

            {/* Center play */}
            <div className="absolute inset-0 flex items-center justify-center gap-12 pointer-events-auto">
              <button onClick={() => seek(-10)} className="grid h-12 w-12 place-items-center rounded-full bg-white/10 backdrop-blur text-white">
                <RotateCcw size={20} />
              </button>
              <button onClick={togglePlay} className="grid h-16 w-16 place-items-center rounded-full bg-white/20 backdrop-blur text-white">
                {playing ? <Pause size={28} className="fill-white" /> : <Play size={28} className="fill-white ml-1" />}
              </button>
              <button onClick={() => seek(10)} className="grid h-12 w-12 place-items-center rounded-full bg-white/10 backdrop-blur text-white">
                <RotateCw size={20} />
              </button>
            </div>

            {/* Skip Intro — visible 5s..90s */}
            {current > 5 && current < 90 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (videoRef.current) videoRef.current.currentTime = Math.min(duration || 90, 90);
                }}
                className="absolute bottom-24 right-4 pointer-events-auto rounded-xl bg-white/95 px-4 py-2 text-xs font-bold text-foreground shadow-premium flex items-center gap-1.5 active:scale-95 transition"
              >
                <SkipForward size={14} /> Skip Intro
              </button>
            )}

            {/* Bottom controls */}
            <div className="absolute bottom-0 inset-x-0 p-4 pointer-events-auto safe-bottom">
              {/* Seek bar */}
              <div
                className="group relative h-1 rounded-full bg-white/30 cursor-pointer mb-2"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const pct = (e.clientX - rect.left) / rect.width;
                  if (videoRef.current) videoRef.current.currentTime = pct * duration;
                }}
              >
                <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${progress}%` }} />
                <div className="absolute top-1/2 -translate-y-1/2 h-3 w-3 rounded-full bg-primary shadow-glow" style={{ left: `calc(${progress}% - 6px)` }} />
              </div>
              <div className="flex items-center justify-between text-white">
                <div className="flex items-center gap-3">
                  <button onClick={() => { if (videoRef.current) videoRef.current.muted = !videoRef.current.muted; }}>
                    {muted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
                  </button>
                  <span className="text-[11px] font-mono tabular-nums">{fmtDuration(current)} / {fmtDuration(duration)}</span>
                </div>
                <button onClick={toggleFs}>
                  {fullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings sheet */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 z-50 flex items-end"
            onClick={() => setShowSettings(false)}
          >
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full bg-card text-foreground rounded-t-3xl p-5 max-h-[60vh] overflow-y-auto safe-bottom"
            >
              <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-muted-foreground/30" />
              <h3 className="text-sm font-bold mb-2">Quality</h3>
              <div className="grid grid-cols-3 gap-2 mb-5">
                <SettingChip label="Auto" active={currentQuality === -1} onClick={() => setQuality(-1)} />
                {qualities.length > 0 ? qualities.map((q) => (
                  <SettingChip key={q.index} label={`${q.height}p`} active={currentQuality === q.index} onClick={() => setQuality(q.index)} />
                )) : ["240p", "480p", "720p", "1080p"].map((l) => (
                  <SettingChip key={l} label={l} disabled />
                ))}
              </div>
              <h3 className="text-sm font-bold mb-2">Playback Speed</h3>
              <div className="grid grid-cols-4 gap-2">
                {[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((s) => (
                  <SettingChip key={s} label={`${s}x`} active={speed === s} onClick={() => setPlaybackSpeed(s)} />
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SettingChip({ label, active, onClick, disabled }: any) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-xl py-2 text-xs font-bold transition ${
        active ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
      } ${disabled ? "opacity-40" : ""}`}
    >
      {label}
    </button>
  );
}
