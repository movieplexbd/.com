import { useEffect, useRef, useState, useCallback } from "react";
import Hls from "hls.js";
import {
  Play, Pause, Volume2, VolumeX, Maximize, Minimize,
  RotateCcw, RotateCw, Loader2, Settings, X, SkipForward,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ref, set, get } from "firebase/database";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { fmtDuration } from "@/lib/utils";

interface InlinePlayerProps {
  movieId: string;
  src: string;
  poster?: string;
  title?: string;
  onClose?: () => void;
}

export function InlinePlayer({ movieId, src, poster, title, onClose }: InlinePlayerProps) {
  const { user } = useAuth();
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

  // Gesture state
  const lastTapRef = useRef<{ time: number; x: number } | null>(null);
  const gestureRef = useRef<{
    type: "none" | "horizontal" | "vertical-left" | "vertical-right";
    startX: number;
    startY: number;
    startTime: number;
    startCurrentTime: number;
    startVolume: number;
    startBrightness: number;
  }>({ type: "none", startX: 0, startY: 0, startTime: 0, startCurrentTime: 0, startVolume: 1, startBrightness: 1 });
  const [brightness, setBrightness] = useState(1);
  const [gestureFeedback, setGestureFeedback] = useState<{ kind: "seek" | "volume" | "brightness"; value: string } | null>(null);
  const [seekPreview, setSeekPreview] = useState<number | null>(null);
  const feedbackTimer = useRef<number | null>(null);

  const showFeedback = (kind: "seek" | "volume" | "brightness", value: string) => {
    setGestureFeedback({ kind, value });
    if (feedbackTimer.current) window.clearTimeout(feedbackTimer.current);
    feedbackTimer.current = window.setTimeout(() => setGestureFeedback(null), 700);
  };

  // Setup HLS / native source
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !src) return;

    v.preload = "auto";

    if (src.endsWith(".m3u8") && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        // Fast startup: pick lowest quality first, then ABR upgrades
        startLevel: 0,
        autoStartLoad: true,
        // Smaller initial buffer = faster first frame
        maxBufferLength: 20,
        maxMaxBufferLength: 40,
        maxBufferSize: 30 * 1000 * 1000, // 30MB
        backBufferLength: 15,
        // Aggressive fragment loading
        fragLoadingMaxRetry: 4,
        manifestLoadingMaxRetry: 4,
        levelLoadingMaxRetry: 4,
        fragLoadingTimeOut: 12000,
        manifestLoadingTimeOut: 8000,
        // Start playback ASAP
        startFragPrefetch: true,
        testBandwidth: false,
        progressive: true,
      });
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(v);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setQualities(hls.levels.map((l, i) => ({ height: l.height, index: i })));
        v.play().catch(() => {});
      });
      return () => { hls.destroy(); hlsRef.current = null; };
    } else {
      v.src = src;
      v.play().catch(() => {});
    }
  }, [src]);

  // Resume position
  useEffect(() => {
    if (!user || !movieId) return;
    const r = ref(db, `watch_history/${user.uid}/${movieId}`);
    get(r).then((snap) => {
      const v = snap.val();
      if (v?.watchedSeconds && videoRef.current && v.watchedSeconds < (v.duration || 0) - 30) {
        videoRef.current.currentTime = v.watchedSeconds;
      }
    }).catch(() => {});
  }, [user, movieId]);

  // Save progress every 5s
  useEffect(() => {
    if (!user || !movieId) return;
    const t = setInterval(() => {
      const v = videoRef.current;
      if (!v || !v.duration) return;
      set(ref(db, `watch_history/${user.uid}/${movieId}`), {
        progress: v.duration ? v.currentTime / v.duration : 0,
        watchedSeconds: v.currentTime,
        duration: v.duration,
        lastWatchedAt: Date.now(),
      }).catch(() => {});
    }, 5000);
    return () => clearInterval(t);
  }, [user, movieId]);

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

  useEffect(() => {
    const onFs = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const resetIdle = useCallback(() => {
    setShowCtrls(true);
    if (idleTimer.current) window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => { if (playing) setShowCtrls(false); }, 3000);
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

  // ===== Gesture handlers =====
  const onGestureStart = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const v = videoRef.current; if (!v) return;
    gestureRef.current = {
      type: "none",
      startX: e.clientX,
      startY: e.clientY,
      startTime: Date.now(),
      startCurrentTime: v.currentTime,
      startVolume: v.volume,
      startBrightness: brightness,
    };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onGestureMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = gestureRef.current;
    if (!g.startTime) return;
    const dx = e.clientX - g.startX;
    const dy = e.clientY - g.startY;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    if (g.type === "none") {
      if (absX < 12 && absY < 12) return;
      if (absX > absY) {
        g.type = "horizontal";
      } else {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const localX = e.clientX - rect.left;
        g.type = localX < rect.width / 2 ? "vertical-left" : "vertical-right";
      }
    }
    const v = videoRef.current; if (!v) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    if (g.type === "horizontal") {
      const seekDelta = (dx / rect.width) * 90;
      const newTime = Math.max(0, Math.min(v.duration || 0, g.startCurrentTime + seekDelta));
      setSeekPreview(newTime);
      const sign = seekDelta >= 0 ? "+" : "-";
      showFeedback("seek", `${sign}${Math.abs(Math.round(seekDelta))}s`);
    } else if (g.type === "vertical-right") {
      const delta = -dy / rect.height;
      const newVol = Math.max(0, Math.min(1, g.startVolume + delta));
      v.volume = newVol;
      v.muted = newVol === 0;
      showFeedback("volume", `${Math.round(newVol * 100)}%`);
    } else if (g.type === "vertical-left") {
      const delta = -dy / rect.height;
      const newB = Math.max(0.2, Math.min(1, g.startBrightness + delta));
      setBrightness(newB);
      showFeedback("brightness", `${Math.round(newB * 100)}%`);
    }
    resetIdle();
  };

  const onGestureEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = gestureRef.current;
    if (!g.startTime) return;
    const elapsed = Date.now() - g.startTime;
    const dx = e.clientX - g.startX;
    const dy = e.clientY - g.startY;
    const moved = Math.abs(dx) > 8 || Math.abs(dy) > 8;
    const v = videoRef.current;

    if (g.type === "horizontal" && v && seekPreview !== null) {
      v.currentTime = seekPreview;
    }

    if (!moved && elapsed < 300 && v) {
      const now = Date.now();
      const last = lastTapRef.current;
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const localX = e.clientX - rect.left;
      if (last && now - last.time < 300 && Math.abs(last.x - e.clientX) < 40) {
        // Double-tap → seek ±10s
        if (localX < rect.width / 2) {
          v.currentTime = Math.max(0, v.currentTime - 10);
          showFeedback("seek", "-10s");
        } else {
          v.currentTime = Math.min(v.duration || 0, v.currentTime + 10);
          showFeedback("seek", "+10s");
        }
        lastTapRef.current = null;
      } else {
        // Single tap → just toggle controls visibility (NO play/pause).
        // Play/pause is reserved for the dedicated center button.
        lastTapRef.current = { time: now, x: e.clientX };
        setTimeout(() => {
          if (lastTapRef.current && lastTapRef.current.time === now) {
            setShowCtrls((prev) => !prev);
            if (!showCtrls) resetIdle();
          }
        }, 280);
      }
    }

    setSeekPreview(null);
    gestureRef.current = { ...gestureRef.current, type: "none", startTime: 0 };
  };

  const progress = duration ? (current / duration) * 100 : 0;
  const previewProgress = seekPreview !== null && duration ? (seekPreview / duration) * 100 : null;

  return (
    <div
      ref={containerRef}
      className={`relative w-full bg-black overflow-hidden select-none touch-none ${fullscreen ? "h-screen" : "aspect-video"}`}
      onMouseMove={resetIdle}
      onPointerDown={onGestureStart}
      onPointerMove={onGestureMove}
      onPointerUp={onGestureEnd}
      onPointerCancel={onGestureEnd}
      style={{ filter: `brightness(${brightness})` }}
    >
      <video
        ref={videoRef}
        poster={poster}
        className="absolute inset-0 h-full w-full object-contain pointer-events-none"
        playsInline
        autoPlay
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onWaiting={() => setBuffering(true)}
        onPlaying={() => setBuffering(false)}
        onCanPlay={() => setBuffering(false)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onVolumeChange={(e) => { setVolume(e.currentTarget.volume); setMuted(e.currentTarget.muted); }}
      />

      {buffering && (
        <div className="absolute inset-0 grid place-items-center pointer-events-none">
          <Loader2 className="animate-spin text-white/90" size={40} />
        </div>
      )}

      {/* Gesture feedback */}
      <AnimatePresence>
        {gestureFeedback && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 grid place-items-center pointer-events-none z-30"
          >
            <div className="rounded-2xl bg-black/70 backdrop-blur px-5 py-3 text-white text-sm font-bold tabular-nums">
              {gestureFeedback.kind === "seek" && `⏱ ${gestureFeedback.value}`}
              {gestureFeedback.kind === "volume" && `🔊 ${gestureFeedback.value}`}
              {gestureFeedback.kind === "brightness" && `☀ ${gestureFeedback.value}`}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCtrls && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/50 pointer-events-none"
          >
            {/* Top bar */}
            <div className="absolute top-0 inset-x-0 p-2.5 flex items-center gap-2 pointer-events-auto">
              {onClose && (
                <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full bg-white/15 backdrop-blur text-white">
                  <X size={14} />
                </button>
              )}
              {title && (
                <p className="flex-1 min-w-0 text-white text-xs font-bold line-clamp-1">{title}</p>
              )}
              <button onClick={() => setShowSettings(true)} className="grid h-8 w-8 place-items-center rounded-full bg-white/15 backdrop-blur text-white">
                <Settings size={14} />
              </button>
            </div>

            {/* Center controls */}
            <div className="absolute inset-0 flex items-center justify-center gap-8 pointer-events-auto">
              <button onClick={() => seek(-10)} className="grid h-10 w-10 place-items-center rounded-full bg-white/15 backdrop-blur text-white">
                <RotateCcw size={16} />
              </button>
              <button onClick={togglePlay} className="grid h-14 w-14 place-items-center rounded-full bg-white/25 backdrop-blur text-white">
                {playing ? <Pause size={24} className="fill-white" /> : <Play size={24} className="fill-white ml-0.5" />}
              </button>
              <button onClick={() => seek(10)} className="grid h-10 w-10 place-items-center rounded-full bg-white/15 backdrop-blur text-white">
                <RotateCw size={16} />
              </button>
            </div>

            {/* Bottom bar */}
            <div className="absolute bottom-0 inset-x-0 p-3 pointer-events-auto">
              <div
                className="relative h-1 rounded-full bg-white/30 cursor-pointer mb-2"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const pct = (e.clientX - rect.left) / rect.width;
                  if (videoRef.current) videoRef.current.currentTime = pct * duration;
                }}
              >
                <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
                {previewProgress !== null && (
                  <div className="absolute top-0 h-full w-0.5 bg-white shadow-lg" style={{ left: `${previewProgress}%` }} />
                )}
                <div className="absolute top-1/2 -translate-y-1/2 h-2.5 w-2.5 rounded-full bg-primary" style={{ left: `calc(${progress}% - 5px)` }} />
              </div>
              <div className="flex items-center justify-between text-white">
                <div className="flex items-center gap-2.5">
                  <button onClick={() => { if (videoRef.current) videoRef.current.muted = !videoRef.current.muted; }}>
                    {muted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
                  </button>
                  <span className="text-[10px] font-mono tabular-nums">{fmtDuration(current)} / {fmtDuration(duration)}</span>
                </div>
                <button onClick={toggleFs}>
                  {fullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/70 z-50 flex items-end"
            onClick={() => setShowSettings(false)}
          >
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full bg-card text-foreground rounded-t-2xl p-4 max-h-[70%] overflow-y-auto"
            >
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-muted-foreground/30" />
              <h3 className="text-xs font-bold mb-2">Quality</h3>
              <div className="grid grid-cols-3 gap-1.5 mb-4">
                <Chip label="Auto" active={currentQuality === -1} onClick={() => setQuality(-1)} />
                {qualities.length > 0 ? qualities.map((q) => (
                  <Chip key={q.index} label={`${q.height}p`} active={currentQuality === q.index} onClick={() => setQuality(q.index)} />
                )) : null}
              </div>
              <h3 className="text-xs font-bold mb-2">Speed</h3>
              <div className="grid grid-cols-4 gap-1.5">
                {[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((s) => (
                  <Chip key={s} label={`${s}x`} active={speed === s} onClick={() => setPlaybackSpeed(s)} />
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Chip({ label, active, onClick }: { label: string; active?: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg py-1.5 text-[11px] font-bold transition ${
        active ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
      }`}
    >
      {label}
    </button>
  );
}
