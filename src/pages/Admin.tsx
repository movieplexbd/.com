import { useState, useEffect, useMemo } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useFirebaseList, useFirebaseValue } from "@/hooks/useFirebase";
import { ref, set, remove, push, update, get } from "firebase/database";
import { db } from "@/lib/firebase";
import { ArrowLeft, Film, Image as ImageIcon, CreditCard, Users, Plus, Trash2, Check, X, Edit, Search, UserCircle2, Shield, ShieldAlert, Database, Sparkles, KeyRound, Eye, EyeOff, MessageSquarePlus, ThumbsUp, ArrowUpDown, Activity, Share2, RefreshCw, Filter, Megaphone, Send, Smartphone, Save } from "lucide-react";
import type { Movie, Banner, Subscription, UserProfile, Reel, Actor, AppPromo } from "@/lib/types";
import { motion } from "framer-motion";
import { formatViews, timeAgo } from "@/lib/utils";
import { fetchOmdbByTitle, clearOmdbKeyCache } from "@/lib/omdb";
import Analytics from "@/components/admin/Analytics";
import RequestsAdmin from "@/components/admin/RequestsAdmin";
import { AdminBottomNav } from "@/components/AdminBottomNav";

type Tab = "dashboard" | "analytics" | "movies" | "banners" | "subs" | "users" | "reels" | "actors" | "requests" | "apppromo" | "update" | "master";

export default function Admin() {
  const { isAdmin, loading } = useAuth();
  const nav = useNavigate();
  const [tab, setTab] = useState<Tab>("dashboard");

  // Live counts for tab badges (Android-style)
  const { data: movies } = useFirebaseList<Movie>("movies");
  const { data: actors } = useFirebaseList<Actor>("actors");
  const { data: banners } = useFirebaseList<Banner>("banners");
  const { data: reels } = useFirebaseList<Reel>("reels");
  const { data: requests } = useFirebaseList<{ status?: string }>("movie_requests");
  const { data: subs } = useFirebaseList<Subscription>("subscriptions");
  const { data: users } = useFirebaseList<UserProfile>("users");

  const pendingSubs = subs.filter((s) => s.status === "PENDING").length;
  const pendingRequests = requests.filter((r) => (r.status || "pending") === "pending").length;

  if (loading) return <div className="grid place-items-center min-h-screen text-sm">Loading…</div>;
  if (!isAdmin) return <Navigate to="/" replace />;

  const tabs: { key: Tab; label: string; count?: number; alert?: boolean }[] = [
    { key: "dashboard", label: "Dashboard" },
    { key: "analytics", label: "Analytics" },
    { key: "movies", label: "Movies", count: movies.length },
    { key: "actors", label: "Actors", count: actors.length },
    { key: "banners", label: "Banners", count: banners.length },
    { key: "reels", label: "Reels", count: reels.length },
    { key: "requests", label: "Requests", count: pendingRequests, alert: pendingRequests > 0 },
    { key: "subs", label: "Subscriptions", count: pendingSubs, alert: pendingSubs > 0 },
    { key: "users", label: "Users", count: users.length },
    { key: "apppromo", label: "App Promo" },
    { key: "update", label: "Update" },
    { key: "master", label: "Master Control" },
  ];

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-40 glass safe-top px-4 pt-3 pb-3 flex items-center gap-3 border-b border-border">
        <button onClick={() => nav("/profile")} className="grid h-9 w-9 place-items-center rounded-full bg-card shadow-soft">
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-extrabold">Master Control</h1>
          <p className="text-[10px] text-muted-foreground truncate">
            {movies.length} movies · {users.length} users · {pendingSubs + pendingRequests > 0 ? `${pendingSubs + pendingRequests} pending` : "all clear"}
          </p>
        </div>
      </header>

      <nav className="flex gap-1.5 overflow-x-auto no-scrollbar p-3 sticky top-[60px] z-30 bg-muted/30 backdrop-blur">
        {tabs.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`relative shrink-0 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
                active ? "bg-primary text-primary-foreground shadow-premium" : "bg-card text-foreground"
              }`}
            >
              <span>{t.label}</span>
              {typeof t.count === "number" && (
                <span
                  className={`inline-flex min-w-[20px] items-center justify-center rounded-full px-1.5 py-0.5 text-[9px] font-extrabold tabular-nums ${
                    active
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : t.alert
                      ? "bg-destructive text-destructive-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="p-3 pb-24">
        {tab === "dashboard" && <Dashboard onJump={setTab} />}
        {tab === "analytics" && <Analytics />}
        {tab === "movies" && <MoviesAdmin />}
        {tab === "actors" && <ActorsAdmin />}
        {tab === "banners" && <BannersAdmin />}
        {tab === "reels" && <ReelsAdmin />}
        {tab === "requests" && <RequestsAdmin />}
        {tab === "subs" && <SubsAdmin />}
        {tab === "users" && <UsersAdmin />}
        {tab === "update" && <UpdateAdmin />}
        {tab === "apppromo" && <AppPromoAdmin />}
        {tab === "master" && <MasterControl />}
      </div>

      <AdminBottomNav
        active={tab}
        onChange={setTab}
        pendingSubs={pendingSubs}
        pendingRequests={pendingRequests}
      />
    </div>
  );
}

function Dashboard({ onJump }: { onJump: (t: Tab) => void }) {
  const { data: movies } = useFirebaseList<Movie>("movies");
  const { data: users } = useFirebaseList<UserProfile>("users");
  const { data: subs } = useFirebaseList<Subscription>("subscriptions");
  const { data: actors } = useFirebaseList<Actor>("actors");

  const premiumUsers = users.filter((u) => u.subscriptionStatus === "premium").length;
  const pending = subs.filter((s) => s.status === "PENDING").length;
  const revenue = subs.filter((s) => s.status === "APPROVED").reduce((a, b) => a + (b.amount || 0), 0);
  const views = movies.reduce((a, b) => a + (b.totalViews || 0), 0);

  const stats = [
    { label: "Total Movies", value: movies.length, color: "from-primary to-primary-glow" },
    { label: "Total Users", value: users.length, color: "from-blue-500 to-cyan-500" },
    { label: "Premium", value: premiumUsers, color: "from-amber-500 to-orange-500" },
    { label: "Pending Subs", value: pending, color: "from-red-500 to-pink-500" },
    { label: "Total Views", value: formatViews(views), color: "from-emerald-500 to-teal-500" },
    { label: "Revenue (৳)", value: revenue, color: "from-violet-500 to-purple-500" },
  ];

  const quickLinks: { key: Tab; label: string; icon: any; sub: string }[] = [
    { key: "movies", label: "Manage Movies", icon: Film, sub: `${movies.length} total` },
    { key: "actors", label: "Manage Actors", icon: UserCircle2, sub: `${actors.length} actors` },
    { key: "banners", label: "Banners", icon: ImageIcon, sub: "Hero & promos" },
    { key: "subs", label: "Subscriptions", icon: CreditCard, sub: `${pending} pending` },
    { key: "users", label: "Users", icon: Users, sub: `${users.length} signed up` },
    { key: "master", label: "Master Control", icon: Shield, sub: "Danger zone" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {stats.map((s) => (
          <div
            key={s.label}
            className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${s.color} p-4 text-white shadow-card`}
          >
            <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">{s.label}</div>
            <div className="text-2xl font-extrabold mt-1">{s.value}</div>
          </div>
        ))}
      </div>

      <div>
        <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Quick Access</h3>
        <div className="grid grid-cols-2 gap-2">
          {quickLinks.map((q) => {
            const Icon = q.icon;
            return (
              <button
                key={q.key}
                onClick={() => onJump(q.key)}
                className="rounded-2xl bg-card p-3 shadow-soft text-left active:scale-[0.98] transition flex items-start gap-2.5"
              >
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Icon size={16} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold leading-tight">{q.label}</p>
                  <p className="text-[10px] text-muted-foreground">{q.sub}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------- MOVIES ----------
type SortMode = "newest" | "rating" | "title" | "free_first" | "premium_first" | "most_viewed";
const SORT_LABELS: Record<SortMode, string> = {
  newest: "Newest",
  rating: "IMDb Rating",
  title: "Title (A–Z)",
  most_viewed: "Most Viewed",
  free_first: "Free First",
  premium_first: "Premium First",
};

function MoviesAdmin() {
  const { data: movies } = useFirebaseList<Movie>("movies");
  const { data: subs } = useFirebaseList<Subscription>("subscriptions");
  const [editing, setEditing] = useState<Movie | null>(null);
  const [creating, setCreating] = useState(false);
  const [q, setQ] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [showSort, setShowSort] = useState(false);
  const [showHealth, setShowHealth] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmBulk, setConfirmBulk] = useState(false);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    let list = !s
      ? movies
      : movies.filter(
          (m) =>
            m.title?.toLowerCase().includes(s) ||
            m.category?.toLowerCase().includes(s) ||
            m.description?.toLowerCase().includes(s) ||
            m.language?.toLowerCase().includes(s) ||
            String(m.year || "").includes(s)
        );
    list = [...list];
    switch (sortMode) {
      case "rating":
        list.sort((a, b) => (b.imdbRating || 0) - (a.imdbRating || 0));
        break;
      case "title":
        list.sort((a, b) => (a.title || "").toLowerCase().localeCompare((b.title || "").toLowerCase()));
        break;
      case "most_viewed":
        list.sort((a, b) => (b.totalViews || 0) - (a.totalViews || 0));
        break;
      case "free_first":
        list.sort(
          (a, b) =>
            Number(!!b.testMovie) - Number(!!a.testMovie) ||
            (a.title || "").localeCompare(b.title || "")
        );
        break;
      case "premium_first":
        list.sort(
          (a, b) =>
            Number(!!b.premiumOnly) - Number(!!a.premiumOnly) ||
            (a.title || "").localeCompare(b.title || "")
        );
        break;
      case "newest":
      default:
        list.sort((a, b) => (b.createdAt || b.year || 0) - (a.createdAt || a.year || 0));
    }
    return list;
  }, [movies, q, sortMode]);

  // Health check (Android `showHealthDialog`)
  const health = useMemo(() => {
    const noStream = movies.filter((m) => !m.videoStreamUrl?.trim());
    // Same fallback chain Home uses — only flag if ALL poster sources are empty
    const noPoster = movies.filter(
      (m) => !m.posterUrl?.trim() && !m.detailThumbnailUrl?.trim() && !m.bannerImageUrl?.trim()
    );
    const noActors = movies.filter((m) => !m.actorIds || m.actorIds.length === 0);
    const noDownloads = movies.filter(
      (m) =>
        !m.downloadUrl?.trim() &&
        (!m.downloads || (Array.isArray(m.downloads) ? m.downloads.length === 0 : Object.keys(m.downloads).length === 0))
    );
    const noBanner = movies.filter((m) => !m.bannerImageUrl?.trim());
    return { noStream, noPoster, noActors, noDownloads, noBanner };
  }, [movies]);

  const revenue = useMemo(
    () => subs.filter((s) => s.status === "APPROVED").reduce((a, b) => a + (b.amount || 0), 0),
    [subs]
  );
  const totalViews = useMemo(() => movies.reduce((a, b) => a + (b.totalViews || 0), 0), [movies]);

  const onDelete = async (id: string) => {
    if (!confirm("Delete this movie?")) return;
    await remove(ref(db, `movies/${id}`));
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((m) => m.id)));
  };

  const bulkDelete = async () => {
    const ids = Array.from(selected);
    await Promise.all(ids.map((id) => remove(ref(db, `movies/${id}`))));
    setSelected(new Set());
    setConfirmBulk(false);
  };

  const exportReport = async () => {
    const lines = [
      `MOVIEPLEXBD — Movie Report`,
      `Generated: ${new Date().toLocaleString()}`,
      ``,
      `Total movies: ${movies.length}`,
      `Total views: ${formatViews(totalViews)}`,
      `Revenue (approved subs): ৳${revenue.toLocaleString()}`,
      ``,
      `Top 20 by views:`,
      ...[...movies]
        .sort((a, b) => (b.totalViews || 0) - (a.totalViews || 0))
        .slice(0, 20)
        .map((m, i) => `${i + 1}. ${m.title} — ${formatViews(m.totalViews)} views (${m.year || "—"})`),
      ``,
      `Health:`,
      `  • Missing stream URL: ${health.noStream.length}`,
      `  • Missing poster: ${health.noPoster.length}`,
      `  • No actors linked: ${health.noActors.length}`,
      `  • No download links: ${health.noDownloads.length}`,
      `  • No banner image: ${health.noBanner.length}`,
    ].join("\n");
    const text = lines;
    try {
      if ((navigator as any).share) {
        await (navigator as any).share({ title: "MOVIEPLEXBD Movie Report", text });
      } else {
        await navigator.clipboard.writeText(text);
        alert("Report copied to clipboard.");
      }
    } catch {
      // user cancelled — no-op
    }
  };

  if (creating || editing) {
    return <MovieForm movie={editing} onClose={() => { setEditing(null); setCreating(false); }} />;
  }

  return (
    <div className="space-y-3">
      {/* Mini dashboard (Android-style) */}
      <div className="grid grid-cols-3 gap-2">
        <MiniStat label="Movies" value={movies.length.toString()} tone="primary" />
        <MiniStat label="Views" value={formatViews(totalViews)} tone="emerald" />
        <MiniStat label="Revenue" value={`৳${revenue.toLocaleString()}`} tone="violet" />
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search title, category, language…"
            className="w-full rounded-xl border border-border bg-card pl-9 pr-3 py-2.5 text-xs outline-none focus:border-primary/40"
          />
        </div>
        <button onClick={() => setCreating(true)} className="flex items-center gap-1 rounded-xl bg-primary px-3 py-2.5 text-xs font-bold text-primary-foreground">
          <Plus size={14} /> Add
        </button>
      </div>

      {/* Toolbar — sort, health, export */}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setShowSort((v) => !v)}
          className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-card px-2.5 py-1.5 text-[11px] font-bold shadow-soft"
        >
          <ArrowUpDown size={12} /> Sort: {SORT_LABELS[sortMode]}
        </button>
        <button
          onClick={() => setShowHealth(true)}
          className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-card px-2.5 py-1.5 text-[11px] font-bold shadow-soft"
        >
          <Activity size={12} /> Health
          {(health.noStream.length + health.noPoster.length + health.noActors.length) > 0 && (
            <span className="ml-1 rounded-full bg-destructive px-1.5 text-[9px] text-destructive-foreground">
              {health.noStream.length + health.noPoster.length + health.noActors.length}
            </span>
          )}
        </button>
        <button
          onClick={exportReport}
          className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-card px-2.5 py-1.5 text-[11px] font-bold shadow-soft"
        >
          <Share2 size={12} /> Export
        </button>
        <span className="ml-auto self-center text-[10px] text-muted-foreground shrink-0">
          {filtered.length} of {movies.length}
        </span>
      </div>

      {showSort && (
        <div className="rounded-xl bg-card p-2 shadow-soft grid grid-cols-2 gap-1.5">
          {(Object.keys(SORT_LABELS) as SortMode[]).map((k) => (
            <button
              key={k}
              onClick={() => { setSortMode(k); setShowSort(false); }}
              className={`rounded-lg px-2 py-1.5 text-[11px] font-bold ${
                sortMode === k ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
              }`}
            >
              {SORT_LABELS[k]}
            </button>
          ))}
        </div>
      )}

      {/* Bulk action bar */}
      <div className="flex items-center justify-between rounded-xl bg-card p-2.5 shadow-soft">
        <button onClick={toggleAll} className="flex items-center gap-2 text-xs font-bold">
          <span className={`grid h-5 w-5 place-items-center rounded border-2 ${
            selected.size > 0 && selected.size === filtered.length
              ? "bg-primary border-primary text-primary-foreground"
              : "border-border bg-background"
          }`}>
            {selected.size > 0 && selected.size === filtered.length && <Check size={12} />}
          </span>
          {selected.size === 0 ? "Select All" : `${selected.size} selected`}
        </button>
        {selected.size > 0 && (
          confirmBulk ? (
            <div className="flex items-center gap-1.5">
              <button onClick={bulkDelete} className="rounded-lg bg-destructive px-3 py-1.5 text-[11px] font-extrabold text-destructive-foreground">
                DELETE {selected.size}
              </button>
              <button onClick={() => setConfirmBulk(false)} className="grid h-7 w-7 place-items-center rounded-lg bg-muted">
                <X size={12} />
              </button>
            </div>
          ) : (
            <button onClick={() => setConfirmBulk(true)} className="flex items-center gap-1 rounded-lg bg-destructive/10 px-3 py-1.5 text-[11px] font-bold text-destructive">
              <Trash2 size={12} /> Delete Selected
            </button>
          )
        )}
      </div>

      {filtered.map((m) => {
        const isSelected = selected.has(m.id);
        const issues: string[] = [];
        if (!m.videoStreamUrl?.trim()) issues.push("No stream");
        // Match Home/MovieCard fallback chain so admin & home show the same image
        const posterImg = m.posterUrl || m.detailThumbnailUrl || m.bannerImageUrl || "/placeholder.svg";
        if (!m.posterUrl?.trim() && !m.detailThumbnailUrl?.trim() && !m.bannerImageUrl?.trim()) issues.push("No poster");
        return (
          <div key={m.id} className={`flex gap-3 rounded-2xl bg-card p-2 shadow-soft transition ${isSelected ? "ring-2 ring-primary" : ""}`}>
            <button onClick={() => toggleOne(m.id)} className="self-center">
              <span className={`grid h-5 w-5 place-items-center rounded border-2 ${
                isSelected ? "bg-primary border-primary text-primary-foreground" : "border-border bg-background"
              }`}>
                {isSelected && <Check size={12} />}
              </span>
            </button>
            <img
              src={posterImg}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/placeholder.svg"; }}
              className="h-16 w-12 rounded-lg object-cover bg-muted"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-bold line-clamp-1 flex-1">{m.title}</p>
                {m.premiumOnly && <span className="rounded bg-amber-500/15 px-1 text-[8px] font-bold text-amber-600">PREM</span>}
                {m.testMovie && <span className="rounded bg-emerald-500/15 px-1 text-[8px] font-bold text-emerald-600">FREE</span>}
              </div>
              <p className="text-[10px] text-muted-foreground">{m.year} · {m.language} · {m.quality}</p>
              <p className="text-[10px] text-muted-foreground">
                {formatViews(m.totalViews)} views
                {m.imdbRating ? ` · ★ ${m.imdbRating}` : ""}
              </p>
              {issues.length > 0 && (
                <p className="text-[10px] font-bold text-destructive">⚠ {issues.join(" · ")}</p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <button onClick={() => setEditing(m)} className="grid h-7 w-7 place-items-center rounded-lg bg-muted">
                <Edit size={12} />
              </button>
              <button onClick={() => onDelete(m.id)} className="grid h-7 w-7 place-items-center rounded-lg bg-destructive/10 text-destructive">
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        );
      })}
      {filtered.length === 0 && <p className="text-center py-8 text-xs text-muted-foreground">No movies.</p>}

      {/* Health dialog */}
      {showHealth && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-background/70 backdrop-blur-sm p-4"
          onClick={() => setShowHealth(false)}
        >
          <div
            className="w-full max-w-sm max-h-[80vh] overflow-y-auto rounded-2xl bg-card p-4 shadow-premium space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold flex items-center gap-1.5">
                <Activity size={14} className="text-primary" /> Library Health
              </h3>
              <button onClick={() => setShowHealth(false)} className="grid h-7 w-7 place-items-center rounded-lg bg-muted">
                <X size={12} />
              </button>
            </div>
            {[
              ["Missing stream URL", health.noStream],
              ["Missing poster", health.noPoster],
              ["No actors linked", health.noActors],
              ["No download links", health.noDownloads],
              ["No banner image", health.noBanner],
            ].map(([label, list]) => {
              const items = list as Movie[];
              return (
                <div key={label as string} className="rounded-xl bg-muted/40 p-2.5">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-bold">{label as string}</p>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      items.length === 0 ? "bg-emerald-500/15 text-emerald-600" : "bg-destructive/15 text-destructive"
                    }`}>
                      {items.length}
                    </span>
                  </div>
                  {items.length > 0 && (
                    <ul className="mt-1.5 space-y-0.5 text-[10px] text-muted-foreground">
                      {items.slice(0, 5).map((m) => (
                        <li key={m.id} className="truncate">• {m.title}</li>
                      ))}
                      {items.length > 5 && <li>… and {items.length - 5} more</li>}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone: "primary" | "emerald" | "violet" }) {
  const grad =
    tone === "primary"
      ? "from-primary to-primary-glow"
      : tone === "emerald"
      ? "from-emerald-500 to-teal-500"
      : "from-violet-500 to-purple-500";
  return (
    <div className={`rounded-xl bg-gradient-to-br ${grad} p-2.5 text-white shadow-soft`}>
      <p className="text-[9px] uppercase tracking-wider font-bold opacity-80">{label}</p>
      <p className="text-sm font-extrabold tabular-nums truncate">{value}</p>
    </div>
  );
}


function MovieForm({ movie, onClose }: { movie: Movie | null; onClose: () => void }) {
  const [f, setF] = useState<Partial<Movie>>(movie || {
    title: "", description: "", shortDescription: "", posterUrl: "", bannerImageUrl: "",
    videoStreamUrl: "", downloadUrl: "", category: "", language: "", quality: "HD",
    imdbRating: 0, year: new Date().getFullYear(), duration: "",
    trending: false, featured: false, latest: true, premiumOnly: true,
  });

  const save = async () => {
    if (!f.title) return;
    const id = movie?.id || push(ref(db, "movies")).key!;
    const now = Date.now();
    const payload: any = {
      ...f, id,
      createdAt: movie?.createdAt || now,
      updatedAt: now,
      imdbRating: Number(f.imdbRating) || 0,
      year: Number(f.year) || new Date().getFullYear(),
      totalViews: movie?.totalViews || 0,
      totalDownloads: movie?.totalDownloads || 0,
    };
    await set(ref(db, `movies/${id}`), payload);
    onClose();
  };

  const [fetching, setFetching] = useState(false);
  const [fetchMsg, setFetchMsg] = useState<string | null>(null);

  const autoFetch = async () => {
    if (!f.title?.trim()) {
      setFetchMsg("Enter a title first.");
      return;
    }
    setFetching(true);
    setFetchMsg(null);
    try {
      const m = await fetchOmdbByTitle(f.title.trim(), f.year);
      setF((prev) => ({
        ...prev,
        title: m.title || prev.title,
        description: m.plot || prev.description,
        shortDescription: prev.shortDescription || (m.plot ? m.plot.slice(0, 140) : prev.shortDescription),
        posterUrl: prev.posterUrl || m.poster || "",
        year: m.year || prev.year,
        duration: m.runtime && m.runtime !== "N/A" ? m.runtime : prev.duration,
        country: m.country || prev.country,
        director: m.director && m.director !== "N/A" ? m.director : prev.director,
        language: m.language || prev.language,
        category: prev.category || (m.genre ? m.genre.split(",")[0].trim() : prev.category),
        imdbRating: m.imdbRating ?? prev.imdbRating,
        tags: m.genre ? m.genre.split(",").map((s) => s.trim()).filter(Boolean) : prev.tags,
      }));
      setFetchMsg(`✓ Loaded from OMDb${m.actors?.length ? ` — Cast: ${m.actors.slice(0, 4).join(", ")}` : ""}`);
    } catch (e: any) {
      setFetchMsg(e?.message || "Failed to fetch metadata.");
    } finally {
      setFetching(false);
    }
  };

  return (
    <div className="space-y-3">
      <button onClick={onClose} className="text-xs text-muted-foreground flex items-center gap-1"><ArrowLeft size={12} /> Back</button>
      <h3 className="text-base font-extrabold">{movie ? "Edit" : "Add"} Movie</h3>

      <AdminField label="Title *" value={f.title} onChange={(v) => setF({ ...f, title: v })} />

      <div className="rounded-xl bg-card p-2.5 shadow-soft space-y-2">
        <button
          type="button"
          onClick={autoFetch}
          disabled={fetching}
          className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-primary to-primary-glow px-3 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50"
        >
          <Sparkles size={13} />
          {fetching ? "Fetching from OMDb…" : "Auto-Fetch Metadata (OMDb)"}
        </button>
        {fetchMsg && (
          <p className="text-[10px] text-muted-foreground leading-snug">{fetchMsg}</p>
        )}
      </div>

      <AdminField label="Short Description" value={f.shortDescription} onChange={(v) => setF({ ...f, shortDescription: v })} />
      <AdminField label="Description" value={f.description} onChange={(v) => setF({ ...f, description: v })} multiline />
      <AdminField label="Poster URL (2:3)" value={f.posterUrl} onChange={(v) => setF({ ...f, posterUrl: v })} />
      <AdminField label="Banner URL (16:10)" value={f.bannerImageUrl} onChange={(v) => setF({ ...f, bannerImageUrl: v })} />
      <AdminField label="Video Stream URL (HLS .m3u8 or MP4) *" value={f.videoStreamUrl} onChange={(v) => setF({ ...f, videoStreamUrl: v })} />
      <AdminField label="Download URL (single, optional fallback)" value={f.downloadUrl} onChange={(v) => setF({ ...f, downloadUrl: v })} />
      <DownloadLinksEditor
        value={Array.isArray(f.downloads) ? f.downloads : f.downloads ? Object.values(f.downloads) : []}
        onChange={(links) => setF({ ...f, downloads: links })}
      />
      <AdminField label="Trailer URL" value={f.trailerUrl} onChange={(v) => setF({ ...f, trailerUrl: v })} />

      <div className="grid grid-cols-2 gap-2">
        <AdminField label="Category" value={f.category} onChange={(v) => setF({ ...f, category: v })} placeholder="Action, Drama..." />
        <AdminField label="Sub Category" value={f.subCategory} onChange={(v) => setF({ ...f, subCategory: v })} placeholder="Bangla Dubbed" />
        <AdminField label="Language" value={f.language} onChange={(v) => setF({ ...f, language: v })} placeholder="Hindi, Bangla..." />
        <AdminField label="Quality" value={f.quality} onChange={(v) => setF({ ...f, quality: v })} />
        <AdminField label="Year" type="number" value={f.year as any} onChange={(v) => setF({ ...f, year: Number(v) })} />
        <AdminField label="Duration" value={f.duration} onChange={(v) => setF({ ...f, duration: v })} placeholder="2h 15m" />
        <AdminField label="IMDb Rating" type="number" value={f.imdbRating as any} onChange={(v) => setF({ ...f, imdbRating: Number(v) })} />
        <AdminField label="Country" value={f.country} onChange={(v) => setF({ ...f, country: v })} />
      </div>

      <ActorMultiSelect
        selectedIds={f.actorIds || []}
        onChange={(ids) => setF({ ...f, actorIds: ids })}
      />

      <div className="space-y-2 rounded-xl bg-card p-3 shadow-soft">
        <Toggle label="Trending" v={!!f.trending} on={(v) => setF({ ...f, trending: v })} />
        <Toggle label="Featured" v={!!f.featured} on={(v) => setF({ ...f, featured: v })} />
        <Toggle label="Latest" v={!!f.latest} on={(v) => setF({ ...f, latest: v })} />
        <Toggle label="Premium Only" v={!!f.premiumOnly} on={(v) => setF({ ...f, premiumOnly: v })} />
        <Toggle label="Test Movie" v={!!f.testMovie} on={(v) => setF({ ...f, testMovie: v })} />
      </div>

      <button onClick={save} className="w-full rounded-2xl bg-primary py-3 text-sm font-bold text-primary-foreground shadow-premium">
        {movie ? "Update" : "Create"} Movie
      </button>
    </div>
  );
}

function DownloadLinksEditor({
  value,
  onChange,
}: {
  value: import("@/lib/types").DownloadLink[];
  onChange: (v: import("@/lib/types").DownloadLink[]) => void;
}) {
  const links = value || [];
  const update = (i: number, patch: Partial<import("@/lib/types").DownloadLink>) => {
    const next = links.map((l, idx) => (idx === i ? { ...l, ...patch } : l));
    onChange(next);
  };
  const add = () => onChange([...links, { quality: "720p HD", url: "", size: "" }]);
  const removeAt = (i: number) => onChange(links.filter((_, idx) => idx !== i));

  const presets = ["360p SD", "480p SD", "720p HD", "1080p FHD", "1080p Web-DL", "2160p 4K"];

  return (
    <div className="rounded-xl bg-card p-3 shadow-soft space-y-2.5">
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Multi-Quality Download Links
        </label>
        <button
          type="button"
          onClick={add}
          className="flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-[10px] font-bold text-primary-foreground"
        >
          <Plus size={11} /> Add
        </button>
      </div>
      {links.length === 0 && (
        <p className="text-[10px] text-muted-foreground">
          No download links yet. Add 360p / 720p / 1080p etc.
        </p>
      )}
      {links.map((l, i) => (
        <div key={i} className="rounded-lg border border-border bg-background p-2.5 space-y-2">
          <div className="flex items-center gap-2">
            <select
              value={l.quality}
              onChange={(e) => update(i, { quality: e.target.value })}
              className="flex-1 rounded-lg border border-border bg-card px-2 py-1.5 text-[11px] font-bold"
            >
              {!presets.includes(l.quality) && <option value={l.quality}>{l.quality}</option>}
              {presets.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <input
              type="text"
              value={l.size || ""}
              onChange={(e) => update(i, { size: e.target.value })}
              placeholder="1.2 GB"
              className="w-20 rounded-lg border border-border bg-card px-2 py-1.5 text-[11px]"
            />
            <button
              type="button"
              onClick={() => removeAt(i)}
              className="grid h-7 w-7 place-items-center rounded-lg bg-destructive/10 text-destructive shrink-0"
            >
              <Trash2 size={11} />
            </button>
          </div>
          <input
            type="text"
            value={l.url}
            onChange={(e) => update(i, { url: e.target.value })}
            placeholder="https://drive.google.com/... or https://mega.nz/..."
            className="w-full rounded-lg border border-border bg-card px-2 py-1.5 text-[11px]"
          />
        </div>
      ))}
    </div>
  );
}

// ---------- BANNERS ----------
function BannersAdmin() {
  const { data: banners } = useFirebaseList<Banner>("banners");
  const { data: movies } = useFirebaseList<Movie>("movies");
  const [creating, setCreating] = useState(false);
  const [f, setF] = useState<Partial<Banner>>({ active: true, priority: 1 });

  const save = async () => {
    if (!f.imageUrl || !f.title) return;
    const id = push(ref(db, "banners")).key!;
    await set(ref(db, `banners/${id}`), { ...f, id, createdAt: Date.now() });
    setF({ active: true, priority: 1 }); setCreating(false);
  };

  return (
    <div className="space-y-3">
      <button onClick={() => setCreating(!creating)} className="w-full flex items-center justify-center gap-1 rounded-xl bg-primary py-2.5 text-xs font-bold text-primary-foreground">
        <Plus size={14} /> Add Banner
      </button>
      {creating && (
        <div className="space-y-2 rounded-2xl bg-card p-3 shadow-soft">
          <AdminField label="Title *" value={f.title} onChange={(v) => setF({ ...f, title: v })} />
          <AdminField label="Subtitle" value={f.subtitle} onChange={(v) => setF({ ...f, subtitle: v })} />
          <AdminField label="Image URL *" value={f.imageUrl} onChange={(v) => setF({ ...f, imageUrl: v })} />
          <AdminField label="Category" value={f.category} onChange={(v) => setF({ ...f, category: v })} />
          <AdminField label="Priority" type="number" value={f.priority as any} onChange={(v) => setF({ ...f, priority: Number(v) })} />
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Linked Movie</label>
            <select value={f.movieId || ""} onChange={(e) => setF({ ...f, movieId: e.target.value })}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-xs">
              <option value="">— Select —</option>
              {movies.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
            </select>
          </div>
          <button onClick={save} className="w-full rounded-xl bg-primary py-2.5 text-xs font-bold text-primary-foreground">Save</button>
        </div>
      )}
      {banners.map((b) => (
        <div key={b.id} className="rounded-2xl bg-card p-2 shadow-soft flex gap-3">
          <img src={b.imageUrl} alt="" className="h-14 w-24 rounded-lg object-cover" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold line-clamp-1">{b.title}</p>
            <p className="text-[10px] text-muted-foreground">Priority: {b.priority || 0} · {b.active ? "Active" : "Inactive"}</p>
          </div>
          <button onClick={() => remove(ref(db, `banners/${b.id}`))} className="grid h-7 w-7 place-items-center rounded-lg bg-destructive/10 text-destructive self-center">
            <Trash2 size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}

// ---------- REELS ----------
function ReelsAdmin() {
  const { data: reels } = useFirebaseList<Reel>("reels");
  const { data: movies } = useFirebaseList<Movie>("movies");
  const [f, setF] = useState<Partial<Reel>>({});
  const [creating, setCreating] = useState(false);

  const save = async () => {
    if (!f.videoUrl) return;
    const id = push(ref(db, "reels")).key!;
    await set(ref(db, `reels/${id}`), { ...f, id, views: 0, likes: 0, shares: 0, createdAt: Date.now() });
    setF({}); setCreating(false);
  };

  return (
    <div className="space-y-3">
      <button onClick={() => setCreating(!creating)} className="w-full flex items-center justify-center gap-1 rounded-xl bg-primary py-2.5 text-xs font-bold text-primary-foreground">
        <Plus size={14} /> Add Reel
      </button>
      {creating && (
        <div className="space-y-2 rounded-2xl bg-card p-3 shadow-soft">
          <AdminField label="Title *" value={f.title} onChange={(v) => setF({ ...f, title: v })} />
          <AdminField label="Video URL (mp4) *" value={f.videoUrl} onChange={(v) => setF({ ...f, videoUrl: v })} />
          <AdminField label="Thumbnail URL" value={f.thumbnailUrl} onChange={(v) => setF({ ...f, thumbnailUrl: v })} />
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Linked Movie</label>
            <select value={f.movieId || ""} onChange={(e) => setF({ ...f, movieId: e.target.value })}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-xs">
              <option value="">— Select —</option>
              {movies.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
            </select>
          </div>
          <button onClick={save} className="w-full rounded-xl bg-primary py-2.5 text-xs font-bold text-primary-foreground">Save Reel</button>
        </div>
      )}
      {reels.map((r) => (
        <div key={r.id} className="rounded-2xl bg-card p-2 shadow-soft flex gap-3">
          {r.thumbnailUrl ? <img src={r.thumbnailUrl} alt="" className="h-16 w-12 rounded-lg object-cover" /> : <div className="h-16 w-12 rounded-lg bg-muted" />}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold line-clamp-1">{r.title}</p>
            <p className="text-[10px] text-muted-foreground">{formatViews(r.views)} views · {formatViews(r.likes)} likes</p>
          </div>
          <button onClick={() => remove(ref(db, `reels/${r.id}`))} className="grid h-7 w-7 place-items-center rounded-lg bg-destructive/10 text-destructive self-center">
            <Trash2 size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}

// ---------- SUBSCRIPTIONS ----------
type SubFilter = "PENDING" | "APPROVED" | "REJECTED" | "ALL";

function SubsAdmin() {
  const { data: subs } = useFirebaseList<Subscription>("subscriptions");
  const [filter, setFilter] = useState<SubFilter>("PENDING");
  const [q, setQ] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const counts = useMemo(() => {
    const c = { PENDING: 0, APPROVED: 0, REJECTED: 0 } as Record<string, number>;
    subs.forEach((s) => { if (c[s.status] !== undefined) c[s.status] += 1; });
    return c;
  }, [subs]);

  const totalRevenue = useMemo(
    () => subs.filter((s) => s.status === "APPROVED").reduce((a, b) => a + (b.amount || 0), 0),
    [subs]
  );

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    let list = [...subs];
    if (filter !== "ALL") list = list.filter((x) => x.status === filter);
    if (s) {
      list = list.filter(
        (x) =>
          x.email?.toLowerCase().includes(s) ||
          (x as any).fullName?.toLowerCase()?.includes(s) ||
          x.transactionId?.toLowerCase().includes(s)
      );
    }
    list.sort((a, b) => (b.submittedAt || 0) - (a.submittedAt || 0));
    return list;
  }, [subs, filter, q]);

  const approve = async (s: Subscription) => {
    const days = s.plan === "yearly" ? 365 : 30;
    // Preserve any provisional expiry the user already received at submit time
    // so they don't lose paid days. Otherwise extend from now.
    const provisional = (s as any).provisionalExpiry as number | undefined;
    const expiry =
      provisional && provisional > Date.now()
        ? provisional
        : Date.now() + days * 86400 * 1000;
    await update(ref(db, `subscriptions/${s.uid}`), {
      status: "APPROVED",
      approvedAt: Date.now(),
      expiry,
      approvedBy: "admin",
    });
    await update(ref(db, `users/${s.uid}`), {
      subscriptionStatus: "premium",
      subscriptionPlan: s.plan,
      subscriptionExpiry: expiry,
      subscriptionProvisional: false,
    });
  };

  const reject = async (s: Subscription) => {
    await update(ref(db, `subscriptions/${s.uid}`), {
      status: "REJECTED",
      rejectedAt: Date.now(),
    });
    // Revoke access immediately — clears the provisional premium grant
    await update(ref(db, `users/${s.uid}`), {
      subscriptionStatus: "free",
      subscriptionPlan: "none",
      subscriptionExpiry: 0,
      subscriptionProvisional: false,
    });
  };

  const refresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 600);
  };

  return (
    <div className="space-y-3">
      {/* Mini stats */}
      <div className="grid grid-cols-4 gap-1.5">
        <MiniSubStat label="Pending" value={counts.PENDING} tone="amber" />
        <MiniSubStat label="Approved" value={counts.APPROVED} tone="emerald" />
        <MiniSubStat label="Rejected" value={counts.REJECTED} tone="destructive" />
        <MiniSubStat label="Revenue" value={`৳${totalRevenue.toLocaleString()}`} tone="primary" />
      </div>

      {/* Search + refresh */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search email, txn ID, name…"
            className="w-full rounded-xl border border-border bg-card pl-9 pr-3 py-2.5 text-xs outline-none focus:border-primary/40"
          />
        </div>
        <button
          onClick={refresh}
          className="grid h-10 w-10 place-items-center rounded-xl bg-card shadow-soft"
          aria-label="Refresh"
        >
          <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Filter pills */}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
        {(["PENDING", "APPROVED", "REJECTED", "ALL"] as SubFilter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`shrink-0 inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition ${
              filter === f ? "bg-primary text-primary-foreground" : "bg-card text-foreground"
            }`}
          >
            <Filter size={11} /> {f}
            {f !== "ALL" && (
              <span className={`rounded-full px-1.5 text-[9px] tabular-nums ${
                filter === f ? "bg-primary-foreground/20" : "bg-muted"
              }`}>{counts[f]}</span>
            )}
          </button>
        ))}
        <span className="ml-auto self-center text-[10px] text-muted-foreground shrink-0 pr-1">
          {filtered.length} shown
        </span>
      </div>

      {filtered.map((s) => (
        <div key={s.uid} className="rounded-2xl bg-card p-3 shadow-soft space-y-2">
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <p className="text-sm font-bold truncate">{(s as any).fullName || s.email}</p>
              <p className="text-[10px] text-muted-foreground truncate">{s.email}</p>
            </div>
            <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
              s.status === "APPROVED" ? "bg-success/15 text-success" :
              s.status === "REJECTED" ? "bg-destructive/15 text-destructive" :
              "bg-accent/20 text-accent-foreground"
            }`}>{s.status}</span>
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
            <div><span className="text-muted-foreground">Plan:</span> <b>{s.plan}</b></div>
            <div><span className="text-muted-foreground">Amount:</span> <b>৳{s.amount}</b></div>
            <div><span className="text-muted-foreground">Method:</span> <b>{s.paymentMethod}</b></div>
            <div><span className="text-muted-foreground">When:</span> <b>{timeAgo(s.submittedAt)}</b></div>
            <div className="col-span-2"><span className="text-muted-foreground">Txn:</span> <b className="font-mono">{s.transactionId}</b></div>
            <div className="col-span-2 truncate"><span className="text-muted-foreground">Device:</span> <span className="font-mono text-[9px]">{s.deviceId}</span></div>
            {s.expiry && s.status === "APPROVED" && (
              <div className="col-span-2"><span className="text-muted-foreground">Expires:</span> <b>{new Date(s.expiry).toLocaleDateString()}</b></div>
            )}
          </div>
          {s.status === "PENDING" && (
            <div className="flex gap-2 pt-1">
              <button onClick={() => approve(s)} className="flex-1 flex items-center justify-center gap-1 rounded-xl bg-success py-2 text-[11px] font-bold text-success-foreground">
                <Check size={12} /> Approve
              </button>
              <button onClick={() => reject(s)} className="flex-1 flex items-center justify-center gap-1 rounded-xl bg-destructive py-2 text-[11px] font-bold text-destructive-foreground">
                <X size={12} /> Reject
              </button>
            </div>
          )}
          {s.status !== "PENDING" && (
            <button
              onClick={() => update(ref(db, `subscriptions/${s.uid}`), { status: "PENDING" })}
              className="w-full rounded-lg bg-muted py-1.5 text-[10px] font-bold"
            >
              Reopen as Pending
            </button>
          )}
        </div>
      ))}
      {filtered.length === 0 && <p className="text-center py-8 text-xs text-muted-foreground">No {filter.toLowerCase()} subscriptions.</p>}
    </div>
  );
}

function MiniSubStat({ label, value, tone }: { label: string; value: number | string; tone: "amber" | "emerald" | "destructive" | "primary" }) {
  const cls =
    tone === "amber"
      ? "bg-amber-500/15 text-amber-600"
      : tone === "emerald"
      ? "bg-emerald-500/15 text-emerald-600"
      : tone === "destructive"
      ? "bg-destructive/15 text-destructive"
      : "bg-primary/15 text-primary";
  return (
    <div className={`rounded-xl ${cls} p-2 text-center`}>
      <p className="text-[8px] uppercase tracking-wider font-bold opacity-80">{label}</p>
      <p className="text-sm font-extrabold tabular-nums truncate">{value}</p>
    </div>
  );
}

// ---------- UPDATE / BROADCAST ----------
type AppUpdate = {
  version?: string;
  title?: string;
  message?: string;
  downloadUrl?: string;
  forceUpdate?: boolean;
  publishedAt?: number;
  publishedBy?: string;
};

function UpdateAdmin() {
  const { data: current, loading } = useFirebaseValue<AppUpdate>("settings/appUpdate");
  const [version, setVersion] = useState("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [downloadUrl, setDownloadUrl] = useState("");
  const [forceUpdate, setForceUpdate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (current) {
      setVersion(current.version || "");
      setTitle(current.title || "");
      setMessage(current.message || "");
      setDownloadUrl(current.downloadUrl || "");
      setForceUpdate(!!current.forceUpdate);
    }
  }, [current?.version, current?.publishedAt]);

  const publish = async () => {
    if (!version.trim() || !message.trim()) {
      setMsg("Version and message are required.");
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      const payload: AppUpdate = {
        version: version.trim(),
        title: title.trim() || `Version ${version.trim()} available`,
        message: message.trim(),
        downloadUrl: downloadUrl.trim(),
        forceUpdate,
        publishedAt: Date.now(),
        publishedBy: "admin",
      };
      await set(ref(db, "settings/appUpdate"), payload);
      setMsg("✓ Update published. All clients will see it on next launch.");
    } catch (e: any) {
      setMsg(e?.message || "Failed to publish.");
    } finally {
      setSaving(false);
    }
  };

  const clearUpdate = async () => {
    if (!confirm("Remove the active update notice?")) return;
    setSaving(true);
    try {
      await remove(ref(db, "settings/appUpdate"));
      setVersion(""); setTitle(""); setMessage(""); setDownloadUrl(""); setForceUpdate(false);
      setMsg("Update notice cleared.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-gradient-to-br from-primary to-primary-glow p-4 text-primary-foreground shadow-card">
        <div className="flex items-center gap-2 mb-1">
          <Megaphone size={18} />
          <h3 className="text-sm font-extrabold">App Update Broadcast</h3>
        </div>
        <p className="text-[11px] opacity-90">
          Push a new version notice to all users. Stored at <code className="font-mono">settings/appUpdate</code>.
        </p>
      </div>

      {current?.publishedAt && (
        <div className="rounded-2xl bg-card p-3 shadow-soft">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Currently Live</p>
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-bold text-emerald-600">
              ACTIVE
            </span>
          </div>
          <p className="text-sm font-extrabold">v{current.version} {current.forceUpdate && <span className="text-[9px] text-destructive">FORCED</span>}</p>
          <p className="text-[11px] text-muted-foreground line-clamp-2">{current.message}</p>
          <p className="text-[10px] text-muted-foreground mt-1">Published {timeAgo(current.publishedAt)}</p>
        </div>
      )}

      <div className="rounded-2xl bg-card p-3 shadow-soft space-y-2.5">
        <AdminField label="Version * (e.g. 2.4.1)" value={version} onChange={setVersion} placeholder="2.4.1" />
        <AdminField label="Title" value={title} onChange={setTitle} placeholder="What's new?" />
        <AdminField label="Message *" value={message} onChange={setMessage} multiline placeholder="• Bug fixes&#10;• New gestures in player&#10;• Faster loading" />
        <AdminField label="Download / APK URL" value={downloadUrl} onChange={setDownloadUrl} placeholder="https://..." />
        <Toggle label="Force Update (block app until updated)" v={forceUpdate} on={setForceUpdate} />

        <div className="flex gap-2 pt-1">
          <button
            onClick={publish}
            disabled={saving || !version.trim() || !message.trim()}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary py-2.5 text-xs font-bold text-primary-foreground disabled:opacity-50"
          >
            <Send size={13} /> {saving ? "Publishing…" : current?.publishedAt ? "Re-publish" : "Publish Update"}
          </button>
          {current?.publishedAt && (
            <button
              onClick={clearUpdate}
              disabled={saving}
              className="rounded-xl bg-destructive/10 px-3 text-xs font-bold text-destructive"
            >
              Clear
            </button>
          )}
        </div>
        {loading && <p className="text-[10px] text-muted-foreground">Loading current state…</p>}
        {msg && <p className="text-[10px] text-muted-foreground leading-snug">{msg}</p>}
      </div>
    </div>
  );
}


// ---------- USERS ----------
function UsersAdmin() {
  const { data: users } = useFirebaseList<UserProfile>("users");
  return (
    <div className="space-y-2">
      {users.map((u) => (
        <div key={u.uid} className="rounded-2xl bg-card p-3 shadow-soft flex items-center gap-3">
          {u.photoUrl ? <img src={u.photoUrl} alt="" className="h-10 w-10 rounded-full object-cover" /> :
            <div className="h-10 w-10 rounded-full bg-muted grid place-items-center text-sm font-bold">{(u.email || "?")[0].toUpperCase()}</div>}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold truncate">{u.displayName || u.email}</p>
            <p className="text-[10px] text-muted-foreground truncate">{u.email}</p>
          </div>
          <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
            u.subscriptionStatus === "premium" ? "bg-gradient-premium text-premium-foreground" :
            u.subscriptionStatus === "pending" ? "bg-accent/20" : "bg-muted"
          }`}>{u.subscriptionStatus || "free"}</span>
        </div>
      ))}
    </div>
  );
}

// ---------- helpers ----------
function AdminField({ label, value, onChange, type = "text", multiline, placeholder }: any) {
  return (
    <div>
      <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</label>
      {multiline ? (
        <textarea value={value || ""} onChange={(e) => onChange(e.target.value)} rows={3}
          className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs outline-none focus:border-primary/40" />
      ) : (
        <input type={type} value={value ?? ""} placeholder={placeholder} onChange={(e) => onChange(e.target.value)}
          className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-xs outline-none focus:border-primary/40" />
      )}
    </div>
  );
}

function Toggle({ label, v, on }: { label: string; v: boolean; on: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => on(!v)} className="w-full flex items-center justify-between text-xs font-semibold">
      <span>{label}</span>
      <span className={`relative h-5 w-9 rounded-full transition ${v ? "bg-primary" : "bg-muted-foreground/30"}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${v ? "left-[18px]" : "left-0.5"}`} />
      </span>
    </button>
  );
}

// ---------- ACTORS ADMIN ----------
function ActorsAdmin() {
  const { data: actors } = useFirebaseList<Actor>("actors");
  const [name, setName] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Actor | null>(null);

  const sorted = [...actors].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  const filtered = sorted.filter((a) => a.name?.toLowerCase().includes(q.toLowerCase()));

  const save = async () => {
    const trimmed = (editing?.name ?? name).trim();
    if (!trimmed) return;
    // De-dup on name (case-insensitive) when creating new
    if (!editing) {
      const exists = actors.find((a) => a.name?.toLowerCase().trim() === trimmed.toLowerCase());
      if (exists) {
        alert(`Actor "${exists.name}" already exists.`);
        return;
      }
    }
    const id = editing?.id || push(ref(db, "actors")).key!;
    const payload: Actor = {
      id,
      name: trimmed,
      imageUrl: (editing?.imageUrl ?? imageUrl).trim(),
      bio: editing?.bio || "",
      popularity: editing?.popularity || 0,
      createdAt: editing?.createdAt || Date.now(),
    };
    await set(ref(db, `actors/${id}`), payload);
    setName(""); setImageUrl(""); setEditing(null);
  };

  const onDelete = async (id: string) => {
    if (!confirm("Delete this actor? Movies will keep the reference but won't show them.")) return;
    await remove(ref(db, `actors/${id}`));
  };

  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-card p-3 shadow-soft space-y-2">
        <h3 className="text-sm font-bold flex items-center gap-1.5">
          <UserCircle2 size={14} /> {editing ? "Edit Actor" : "Add Actor"}
        </h3>
        <AdminField
          label="Name *"
          value={editing ? editing.name : name}
          onChange={(v: string) => editing ? setEditing({ ...editing, name: v }) : setName(v)}
          placeholder="e.g. Shah Rukh Khan"
        />
        <AdminField
          label="Image URL"
          value={editing ? editing.imageUrl : imageUrl}
          onChange={(v: string) => editing ? setEditing({ ...editing, imageUrl: v }) : setImageUrl(v)}
          placeholder="https://..."
        />
        {editing && (
          <AdminField
            label="Bio"
            value={editing.bio}
            onChange={(v: string) => setEditing({ ...editing, bio: v })}
            multiline
          />
        )}
        <div className="flex gap-2">
          <button onClick={save} className="flex-1 rounded-xl bg-primary py-2.5 text-xs font-bold text-primary-foreground">
            {editing ? "Update" : "Add Actor"}
          </button>
          {editing && (
            <button onClick={() => setEditing(null)} className="rounded-xl bg-muted px-4 text-xs font-bold">
              Cancel
            </button>
          )}
        </div>
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search actors"
          className="w-full rounded-xl border border-border bg-card pl-9 pr-3 py-2.5 text-xs outline-none focus:border-primary/40"
        />
      </div>

      <p className="text-[10px] text-muted-foreground">{filtered.length} of {actors.length} actors</p>

      <div className="grid grid-cols-2 gap-2">
        {filtered.map((a) => (
          <div key={a.id} className="rounded-2xl bg-card p-2.5 shadow-soft flex items-center gap-2">
            <img
              src={a.imageUrl || "/placeholder.svg"}
              alt={a.name}
              className="h-10 w-10 rounded-full object-cover border border-border"
              loading="lazy"
            />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold truncate">{a.name}</p>
            </div>
            <button onClick={() => setEditing(a)} className="grid h-7 w-7 place-items-center rounded-lg bg-muted">
              <Edit size={11} />
            </button>
            <button onClick={() => onDelete(a.id)} className="grid h-7 w-7 place-items-center rounded-lg bg-destructive/10 text-destructive">
              <Trash2 size={11} />
            </button>
          </div>
        ))}
      </div>
      {filtered.length === 0 && <p className="text-center py-8 text-xs text-muted-foreground">No actors yet.</p>}
    </div>
  );
}

// ---------- ACTOR MULTI-SELECT (used inside MovieForm) ----------
function ActorMultiSelect({ selectedIds, onChange }: { selectedIds: string[]; onChange: (ids: string[]) => void }) {
  const { data: actors } = useFirebaseList<Actor>("actors");
  const [q, setQ] = useState("");
  const sorted = [...actors].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  const filtered = sorted.filter((a) => a.name?.toLowerCase().includes(q.toLowerCase()));

  const toggle = (id: string) => {
    onChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);
  };

  return (
    <div className="rounded-xl bg-card p-3 shadow-soft space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Cast / Actors
        </label>
        <span className="text-[10px] text-muted-foreground">{selectedIds.length} selected</span>
      </div>
      {actors.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">
          No actors yet. Add some from the <b>Actors</b> tab.
        </p>
      ) : (
        <>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search actor"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs outline-none focus:border-primary/40"
          />
          <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto pt-1">
            {filtered.map((a) => {
              const active = selectedIds.includes(a.id);
              return (
                <button
                  type="button"
                  key={a.id}
                  onClick={() => toggle(a.id)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition border ${
                    active
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-foreground border-border"
                  }`}
                >
                  {a.name}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ---------- APP PROMO ADMIN ----------
function AppPromoAdmin() {
  const { data: promo, loading } = useFirebaseValue<AppPromo>("app_promo");
  const [form, setForm] = useState<AppPromo>({
    enabled: false,
    appName: "",
    tagline: "",
    description: "",
    downloadUrl: "",
    iconUrl: "",
    screenshots: [],
    version: "",
    sizeMb: "",
  });
  const [shotInput, setShotInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    if (promo) setForm({ ...form, ...promo, screenshots: promo.screenshots || [] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [promo?.updatedAt, loading]);

  const save = async () => {
    setSaving(true);
    try {
      await set(ref(db, "app_promo"), { ...form, updatedAt: Date.now() });
      setSavedAt(Date.now());
    } finally {
      setSaving(false);
    }
  };

  const addScreenshot = () => {
    const url = shotInput.trim();
    if (!url) return;
    setForm((f) => ({ ...f, screenshots: [...(f.screenshots || []), url] }));
    setShotInput("");
  };

  const removeScreenshot = (i: number) => {
    setForm((f) => ({ ...f, screenshots: (f.screenshots || []).filter((_, idx) => idx !== i) }));
  };

  return (
    <div className="space-y-4">
      {/* Header card */}
      <div className="rounded-2xl bg-card p-4 shadow-soft">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
            <Smartphone size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-extrabold">App Download Promo</h2>
            <p className="text-[10px] text-muted-foreground">Shown when non-premium users tap Watch / Download</p>
          </div>
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={!!form.enabled}
              onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
            />
            <div className="relative w-10 h-6 bg-muted rounded-full peer-checked:bg-primary transition">
              <div className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-background shadow transition-transform ${form.enabled ? "translate-x-4" : ""}`} />
            </div>
          </label>
        </div>
      </div>

      {/* Live Preview */}
      {form.enabled && (form.appName || form.iconUrl) && (
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-primary mb-2">Preview</p>
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-card overflow-hidden border border-border">
              {form.iconUrl ? (
                <img src={form.iconUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <Smartphone size={20} className="text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-extrabold truncate">{form.appName || "App Name"}</p>
              <p className="text-[10px] text-muted-foreground truncate font-bangla">{form.tagline || "Tagline"}</p>
            </div>
          </div>
        </div>
      )}

      {/* Form */}
      <div className="rounded-2xl bg-card p-4 shadow-soft space-y-3">
        <Field label="App Name">
          <input
            value={form.appName || ""}
            onChange={(e) => setForm({ ...form, appName: e.target.value })}
            placeholder="MOVIEPLEXBD App"
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Tagline (Bangla)">
          <input
            value={form.tagline || ""}
            onChange={(e) => setForm({ ...form, tagline: e.target.value })}
            placeholder="দ্রুত ও সহজ মুভি অ্যাপ"
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-bangla"
          />
        </Field>
        <Field label="Description (Bangla)">
          <textarea
            value={form.description || ""}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={3}
            placeholder="ওয়েবসাইট খুঁজে বের করার ঝামেলা থেকে মুক্তি পেতে আমাদের অ্যাপ ডাউনলোড করুন..."
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-bangla"
          />
        </Field>
        <Field label="Download URL (APK / Play Store)">
          <input
            value={form.downloadUrl || ""}
            onChange={(e) => setForm({ ...form, downloadUrl: e.target.value })}
            placeholder="https://example.com/app.apk"
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
          />
        </Field>
        <Field label="App Icon URL">
          <input
            value={form.iconUrl || ""}
            onChange={(e) => setForm({ ...form, iconUrl: e.target.value })}
            placeholder="https://example.com/icon.png"
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Version">
            <input
              value={form.version || ""}
              onChange={(e) => setForm({ ...form, version: e.target.value })}
              placeholder="1.0.0"
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Size (MB)">
            <input
              value={form.sizeMb || ""}
              onChange={(e) => setForm({ ...form, sizeMb: e.target.value })}
              placeholder="25"
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
          </Field>
        </div>
      </div>

      {/* Screenshots */}
      <div className="rounded-2xl bg-card p-4 shadow-soft">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-extrabold">App Screenshots</h3>
            <p className="text-[10px] text-muted-foreground">{(form.screenshots || []).length} added · 9:19 portrait recommended</p>
          </div>
        </div>
        <div className="flex gap-2 mb-3">
          <input
            value={shotInput}
            onChange={(e) => setShotInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addScreenshot(); } }}
            placeholder="Paste screenshot URL"
            className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm"
          />
          <button
            onClick={addScreenshot}
            className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground active:scale-95 transition"
          >
            <Plus size={16} />
          </button>
        </div>
        {(form.screenshots || []).length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {form.screenshots!.map((url, i) => (
              <div key={i} className="relative aspect-[9/19] rounded-xl overflow-hidden bg-muted border border-border">
                <img
                  src={url}
                  alt={`Screenshot ${i + 1}`}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/placeholder.svg"; }}
                  className="h-full w-full object-cover"
                />
                <button
                  onClick={() => removeScreenshot(i)}
                  className="absolute top-1 right-1 grid h-6 w-6 place-items-center rounded-full bg-destructive text-destructive-foreground active:scale-95 transition"
                >
                  <X size={12} />
                </button>
                <span className="absolute bottom-1 left-1 rounded bg-background/80 px-1.5 py-0.5 text-[9px] font-bold tabular-nums">
                  {i + 1}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Save Bar */}
      <div className="sticky bottom-20 z-30 -mx-3 px-3">
        <button
          onClick={save}
          disabled={saving}
          className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-primary py-3.5 text-sm font-extrabold text-primary-foreground shadow-premium active:scale-[0.98] transition disabled:opacity-50"
        >
          {saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
          {saving ? "Saving…" : "Save App Promo"}
        </button>
        {savedAt && (
          <p className="mt-2 text-center text-[10px] text-success font-semibold">
            ✓ Saved · {new Date(savedAt).toLocaleTimeString()}
          </p>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}

// ---------- MASTER CONTROL ----------
function MasterControl() {
  const { data: movies } = useFirebaseList<Movie>("movies");
  const { data: users } = useFirebaseList<UserProfile>("users");
  const { data: subs } = useFirebaseList<Subscription>("subscriptions");
  const { data: actors } = useFirebaseList<Actor>("actors");
  const { data: banners } = useFirebaseList<Banner>("banners");
  const { data: reels } = useFirebaseList<Reel>("reels");

  const [confirm, setConfirm] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const wipe = async (path: string, label: string) => {
    setWorking(true);
    try {
      await remove(ref(db, path));
      alert(`${label} cleared.`);
    } finally {
      setWorking(false);
      setConfirm(null);
    }
  };

  const expireAllPremium = async () => {
    setWorking(true);
    try {
      const updates: Record<string, any> = {};
      users.forEach((u) => {
        if (u.subscriptionStatus === "premium") {
          updates[`users/${u.uid}/subscriptionStatus`] = "free";
          updates[`users/${u.uid}/subscriptionExpiry`] = 0;
        }
      });
      const { update } = await import("firebase/database");
      await update(ref(db), updates);
      alert("All premium subscriptions expired.");
    } finally {
      setWorking(false);
      setConfirm(null);
    }
  };

  const clearTestMovies = async () => {
    setWorking(true);
    try {
      const tests = movies.filter((m) => m.testMovie);
      await Promise.all(tests.map((m) => remove(ref(db, `movies/${m.id}`))));
      alert(`${tests.length} test movies removed.`);
    } finally {
      setWorking(false);
      setConfirm(null);
    }
  };

  const sections: { key: string; label: string; icon: any; sub: string; danger?: boolean; action: () => void | Promise<void> }[] = [
    { key: "tests", label: "Remove Test Movies", icon: Film, sub: `${movies.filter((m) => m.testMovie).length} flagged`, action: clearTestMovies },
    { key: "expire", label: "Expire All Premium Users", icon: ShieldAlert, sub: `${users.filter((u) => u.subscriptionStatus === "premium").length} active`, danger: true, action: expireAllPremium },
    { key: "search_logs", label: "Clear Search Logs", icon: Search, sub: "Reset search analytics", action: () => wipe("search_logs", "Search logs") },
    { key: "watch_history", label: "Wipe All Watch History", icon: Database, sub: "All users — irreversible", danger: true, action: () => wipe("watch_history", "Watch history") },
    { key: "movie_requests", label: "Clear Movie Requests", icon: Film, sub: "Reset request queue", action: () => wipe("movie_requests", "Movie requests") },
    { key: "reels", label: "Delete All Reels", icon: ImageIcon, sub: `${reels.length} reels`, danger: true, action: () => wipe("reels", "Reels") },
    { key: "banners", label: "Delete All Banners", icon: ImageIcon, sub: `${banners.length} banners`, danger: true, action: () => wipe("banners", "Banners") },
  ];

  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-gradient-to-br from-destructive to-orange-500 p-4 text-white shadow-card">
        <div className="flex items-center gap-2 mb-1">
          <Shield size={18} />
          <h3 className="text-sm font-extrabold">Master Control</h3>
        </div>
        <p className="text-[11px] opacity-90">
          Bulk operations across the entire database. Actions here are irreversible — proceed with care.
        </p>
      </div>

      <OmdbKeyCard />

      <div className="grid grid-cols-2 gap-2 text-center">
        <Snap label="Movies" value={movies.length} />
        <Snap label="Actors" value={actors.length} />
        <Snap label="Users" value={users.length} />
        <Snap label="Subscriptions" value={subs.length} />
      </div>

      <div className="space-y-2">
        {sections.map((s) => {
          const Icon = s.icon;
          const isConfirming = confirm === s.key;
          return (
            <div key={s.key} className={`rounded-2xl bg-card p-3 shadow-soft ${s.danger ? "border border-destructive/20" : ""}`}>
              <div className="flex items-center gap-3">
                <div className={`grid h-9 w-9 place-items-center rounded-xl ${s.danger ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>
                  <Icon size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold leading-tight">{s.label}</p>
                  <p className="text-[10px] text-muted-foreground">{s.sub}</p>
                </div>
                {isConfirming ? (
                  <div className="flex items-center gap-1.5">
                    <button
                      disabled={working}
                      onClick={s.action}
                      className="rounded-lg bg-destructive px-3 py-1.5 text-[11px] font-extrabold text-destructive-foreground disabled:opacity-50"
                    >
                      {working ? "…" : "SURE"}
                    </button>
                    <button onClick={() => setConfirm(null)} className="grid h-7 w-7 place-items-center rounded-lg bg-muted">
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirm(s.key)}
                    className={`rounded-lg px-3 py-1.5 text-[11px] font-bold ${
                      s.danger ? "bg-destructive/10 text-destructive" : "bg-muted text-foreground"
                    }`}
                  >
                    Run
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Snap({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-card p-3 shadow-soft">
      <div className="text-lg font-extrabold">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</div>
    </div>
  );
}

function OmdbKeyCard() {
  const { data: existing, loading } = useFirebaseValue<string>("settings/omdbApiKey");
  const [key, setKey] = useState("");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (typeof existing === "string") setKey(existing);
  }, [existing]);

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      await set(ref(db, "settings/omdbApiKey"), key.trim());
      clearOmdbKeyCache();
      setMsg("✓ Saved. Auto-Fetch is now active.");
    } catch (e: any) {
      setMsg(e?.message || "Failed to save key.");
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    setSaving(true);
    setMsg(null);
    try {
      await set(ref(db, "settings/omdbApiKey"), key.trim());
      clearOmdbKeyCache();
      const r = await fetchOmdbByTitle("Inception");
      setMsg(`✓ Key works — fetched "${r.title}" (${r.year}).`);
    } catch (e: any) {
      setMsg(`✗ ${e?.message || "Test failed."}`);
    } finally {
      setSaving(false);
    }
  };

  const clear = async () => {
    if (!confirm("Remove OMDb API key?")) return;
    setSaving(true);
    try {
      await remove(ref(db, "settings/omdbApiKey"));
      clearOmdbKeyCache();
      setKey("");
      setMsg("Key removed.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl bg-card p-3 shadow-soft space-y-2.5">
      <div className="flex items-center gap-2">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
          <KeyRound size={14} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-extrabold leading-tight">OMDb API Key</p>
          <p className="text-[10px] text-muted-foreground">Powers Auto-Fetch on the Movie form</p>
        </div>
        {existing && (
          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold text-emerald-600">
            ACTIVE
          </span>
        )}
      </div>

      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder={loading ? "Loading…" : "Paste your OMDb API key"}
          className="w-full rounded-xl border border-border bg-background px-3 py-2.5 pr-10 text-xs font-mono"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute right-2 top-1/2 -translate-y-1/2 grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-muted"
          aria-label="Toggle visibility"
        >
          {show ? <EyeOff size={13} /> : <Eye size={13} />}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={save}
          disabled={saving || !key.trim()}
          className="rounded-lg bg-primary py-2 text-[11px] font-bold text-primary-foreground disabled:opacity-50"
        >
          {saving ? "…" : "Save"}
        </button>
        <button
          onClick={test}
          disabled={saving || !key.trim()}
          className="rounded-lg bg-muted py-2 text-[11px] font-bold text-foreground disabled:opacity-50"
        >
          Test
        </button>
        <button
          onClick={clear}
          disabled={saving || !existing}
          className="rounded-lg bg-destructive/10 py-2 text-[11px] font-bold text-destructive disabled:opacity-50"
        >
          Remove
        </button>
      </div>

      {msg && <p className="text-[10px] text-muted-foreground leading-snug">{msg}</p>}

      <p className="text-[10px] text-muted-foreground leading-snug">
        Get a free key at{" "}
        <a
          href="https://www.omdbapi.com/apikey.aspx"
          target="_blank"
          rel="noreferrer"
          className="font-bold text-primary underline"
        >
          omdbapi.com
        </a>
        . The key is stored in Firebase under <code className="font-mono">settings/omdbApiKey</code>.
      </p>
    </div>
  );
}

