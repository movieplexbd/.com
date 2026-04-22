import { useState, useMemo, useEffect, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Search as SearchIcon, X, TrendingUp, Sparkles, Clock, Film, Star, Play,
  SlidersHorizontal, ArrowUpDown, MessageSquarePlus, ThumbsUp, Send,
} from "lucide-react";
import { useFirebaseList } from "@/hooks/useFirebase";
import { push, ref, runTransaction, set } from "firebase/database";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import type { Movie } from "@/lib/types";
import { motion, AnimatePresence } from "framer-motion";

const RECENT_KEY = "mpx_recent_searches";

type MovieRequest = {
  id: string;
  title: string;
  note?: string;
  votes?: number;
  voters?: Record<string, boolean>;
  status?: "pending" | "fulfilled" | "rejected";
  createdBy?: string;
  createdByName?: string;
  createdAt?: number;
  fulfilledMovieId?: string;
};

type SortKey = "relevance" | "rating" | "year_desc" | "year_asc" | "views" | "title";

// Lightweight fuzzy scoring: contiguous match → high; subsequence → medium; word boundary bonus.
function fuzzyScore(text: string, q: string): number {
  if (!text || !q) return 0;
  const t = text.toLowerCase();
  const s = q.toLowerCase().trim();
  if (!s) return 0;
  if (t === s) return 1000;
  if (t.startsWith(s)) return 800;
  const idx = t.indexOf(s);
  if (idx >= 0) {
    // word-boundary bonus
    const prev = idx === 0 ? " " : t[idx - 1];
    const wb = /\W|_/.test(prev) ? 100 : 0;
    return 500 - idx + wb;
  }
  // subsequence
  let i = 0, j = 0, last = -1, gaps = 0;
  while (i < t.length && j < s.length) {
    if (t[i] === s[j]) {
      if (last >= 0) gaps += i - last - 1;
      last = i;
      j++;
    }
    i++;
  }
  if (j === s.length) return Math.max(50, 200 - gaps);
  return 0;
}

function scoreMovie(m: Movie, q: string): number {
  const titleScore = fuzzyScore(m.title || "", q) * 3;
  const catScore = fuzzyScore(m.category || "", q) * 1.2
    + fuzzyScore(m.subCategory || "", q) * 1.2
    + fuzzyScore(m.language || "", q) * 1.2;
  const tagScore = (m.tags || []).reduce((a, t) => a + fuzzyScore(t, q), 0) * 0.8;
  const descScore = fuzzyScore(m.description || "", q) * 0.4;
  const yearScore = m.year && String(m.year) === q.trim() ? 600 : 0;
  return titleScore + catScore + tagScore + descScore + yearScore;
}

export default function Search() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [q, setQ] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  const [activeFilter, setActiveFilter] = useState<string>("All");
  const [language, setLanguage] = useState<string>("All");
  const [yearRange, setYearRange] = useState<string>("All");
  const [minRating, setMinRating] = useState<number>(0);
  const [sort, setSort] = useState<SortKey>("relevance");
  const [showFilters, setShowFilters] = useState(false);
  const [showRequest, setShowRequest] = useState(false);
  const debounceRef = useRef<number | null>(null);
  const [debouncedQ, setDebouncedQ] = useState("");

  const { user } = useAuth();
  const { data: movies } = useFirebaseList<Movie>("movies");
  const { data: requests } = useFirebaseList<MovieRequest>("movie_requests");

  useEffect(() => {
    const term = params.get("q") || "";
    if (term) setQ(term);
  }, [params]);

  useEffect(() => {
    try {
      const r = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
      if (Array.isArray(r)) setRecent(r.slice(0, 8));
    } catch {}
  }, []);

  // Debounce typing for smooth filtering
  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => setDebouncedQ(q), 120);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [q]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    movies.forEach((m) => m.category && set.add(m.category));
    return ["All", ...Array.from(set).sort()];
  }, [movies]);

  const languages = useMemo(() => {
    const set = new Set<string>();
    movies.forEach((m) => m.language && set.add(m.language));
    return ["All", ...Array.from(set).sort()];
  }, [movies]);

  const yearBuckets = ["All", "2024+", "2020-2023", "2015-2019", "2010-2014", "Older"];

  const inYear = (y?: number) => {
    if (yearRange === "All" || !y) return yearRange === "All";
    if (yearRange === "2024+") return y >= 2024;
    if (yearRange === "2020-2023") return y >= 2020 && y <= 2023;
    if (yearRange === "2015-2019") return y >= 2015 && y <= 2019;
    if (yearRange === "2010-2014") return y >= 2010 && y <= 2014;
    if (yearRange === "Older") return y < 2010;
    return true;
  };

  const results = useMemo(() => {
    const t = debouncedQ.trim();
    let list = movies as Movie[];

    if (activeFilter !== "All") list = list.filter((m) => m.category === activeFilter);
    if (language !== "All") list = list.filter((m) => m.language === language);
    if (yearRange !== "All") list = list.filter((m) => inYear(Number(m.year)));
    if (minRating > 0) list = list.filter((m) => (m.imdbRating || 0) >= minRating);

    let scored: Array<{ m: Movie; s: number }>;
    if (t) {
      scored = list
        .map((m) => ({ m, s: scoreMovie(m, t) }))
        .filter((x) => x.s > 0);
    } else {
      scored = list.map((m) => ({ m, s: 0 }));
    }

    const cmp: Record<SortKey, (a: any, b: any) => number> = {
      relevance: (a, b) => b.s - a.s || (b.m.imdbRating || 0) - (a.m.imdbRating || 0),
      rating: (a, b) => (b.m.imdbRating || 0) - (a.m.imdbRating || 0),
      year_desc: (a, b) => (Number(b.m.year) || 0) - (Number(a.m.year) || 0),
      year_asc: (a, b) => (Number(a.m.year) || 0) - (Number(b.m.year) || 0),
      views: (a, b) => (b.m.totalViews || 0) - (a.m.totalViews || 0),
      title: (a, b) => (a.m.title || "").localeCompare(b.m.title || ""),
    };
    scored.sort(cmp[sort]);
    return scored.map((x) => x.m);
  }, [debouncedQ, movies, activeFilter, language, yearRange, minRating, sort]);

  const isSearchingActive = debouncedQ.trim().length > 0
    || activeFilter !== "All" || language !== "All" || yearRange !== "All" || minRating > 0;

  const trending = useMemo(() => movies.filter((m) => m.trending).slice(0, 6), [movies]);
  const topRated = useMemo(
    () => [...movies].sort((a, b) => (b.imdbRating || 0) - (a.imdbRating || 0)).slice(0, 6),
    [movies],
  );

  const submitSearch = () => {
    if (!q.trim()) return;
    const term = q.trim();
    push(ref(db, "search_logs"), {
      uid: user?.uid || "guest",
      keyword: term,
      found: results.length > 0,
      createdAt: Date.now(),
    });
    const updated = [term, ...recent.filter((r) => r.toLowerCase() !== term.toLowerCase())].slice(0, 8);
    setRecent(updated);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(updated)); } catch {}
  };

  const clearRecent = () => { setRecent([]); try { localStorage.removeItem(RECENT_KEY); } catch {} };

  const resetFilters = () => {
    setActiveFilter("All"); setLanguage("All"); setYearRange("All"); setMinRating(0); setSort("relevance");
  };

  // Suggested matching requests for current query (so user can vote instead of duplicating)
  const matchingRequests = useMemo(() => {
    const t = debouncedQ.trim().toLowerCase();
    if (!t) return [];
    return (requests as MovieRequest[])
      .filter((r) => (r.status || "pending") === "pending")
      .map((r) => ({ r, s: fuzzyScore(r.title || "", t) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 3)
      .map((x) => x.r);
  }, [requests, debouncedQ]);

  const topRequests = useMemo(() => {
    return (requests as MovieRequest[])
      .filter((r) => (r.status || "pending") === "pending")
      .sort((a, b) => (b.votes || 0) - (a.votes || 0))
      .slice(0, 8);
  }, [requests]);

  const voteRequest = async (id: string) => {
    if (!user) { nav("/login"); return; }
    const reqRef = ref(db, `movie_requests/${id}`);
    await runTransaction(reqRef, (curr: any) => {
      if (!curr) return curr;
      curr.voters = curr.voters || {};
      if (curr.voters[user.uid]) {
        delete curr.voters[user.uid];
        curr.votes = Math.max(0, (curr.votes || 1) - 1);
      } else {
        curr.voters[user.uid] = true;
        curr.votes = (curr.votes || 0) + 1;
      }
      return curr;
    });
  };

  const submitNewRequest = async (title: string, note?: string) => {
    if (!user) { nav("/login"); return; }
    const t = title.trim();
    if (!t) return;
    // de-dupe: if a similar pending request exists, vote it up instead
    const existing = (requests as MovieRequest[]).find(
      (r) => (r.status || "pending") === "pending" && r.title.toLowerCase() === t.toLowerCase()
    );
    if (existing) {
      await voteRequest(existing.id);
      return;
    }
    const newRef = push(ref(db, "movie_requests"));
    await set(newRef, {
      title: t,
      note: note?.trim() || "",
      votes: 1,
      voters: { [user.uid]: true },
      status: "pending",
      createdBy: user.uid,
      createdByName: user.displayName || user.email || "Anonymous",
      createdAt: Date.now(),
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky search header */}
      <header className="sticky top-0 z-40 safe-top bg-background/85 backdrop-blur-xl border-b border-border/40">
        <div className="px-4 pt-3 pb-3">
          <div className="relative">
            <SearchIcon size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-primary" strokeWidth={2.5} />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onBlur={submitSearch}
              onKeyDown={(e) => { if (e.key === "Enter") { submitSearch(); (e.target as HTMLInputElement).blur(); } }}
              placeholder="Search by title, genre, year, language…"
              className="w-full rounded-2xl border border-border bg-card py-3.5 pl-11 pr-20 text-sm font-semibold outline-none focus:border-primary/60 focus:ring-4 focus:ring-primary/15 transition placeholder:text-muted-foreground/70"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {q && (
                <button onClick={() => setQ("")} className="grid h-7 w-7 place-items-center rounded-full bg-muted hover:bg-primary/15 transition">
                  <X size={13} strokeWidth={2.5} />
                </button>
              )}
              <button
                onClick={() => setShowFilters((v) => !v)}
                className={`grid h-7 w-7 place-items-center rounded-full transition ${
                  showFilters || activeFilter !== "All" || language !== "All" || yearRange !== "All" || minRating > 0
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted hover:bg-primary/15"
                }`}
                aria-label="Filters"
              >
                <SlidersHorizontal size={13} strokeWidth={2.5} />
              </button>
            </div>
          </div>

          {/* Filter row chips (collapsible) */}
          <AnimatePresence initial={false}>
            {showFilters && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-3 space-y-2.5">
                  <FilterRow
                    label="Genre"
                    items={categories}
                    value={activeFilter}
                    onChange={setActiveFilter}
                  />
                  <FilterRow
                    label="Language"
                    items={languages}
                    value={language}
                    onChange={setLanguage}
                  />
                  <FilterRow
                    label="Year"
                    items={yearBuckets}
                    value={yearRange}
                    onChange={setYearRange}
                  />
                  <div>
                    <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1.5">
                      Min IMDb {minRating > 0 ? `≥ ${minRating.toFixed(1)}` : ""}
                    </p>
                    <input
                      type="range"
                      min={0}
                      max={9}
                      step={0.5}
                      value={minRating}
                      onChange={(e) => setMinRating(Number(e.target.value))}
                      className="w-full accent-primary"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1.5">
                        Sort
                      </p>
                      <div className="relative">
                        <ArrowUpDown size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <select
                          value={sort}
                          onChange={(e) => setSort(e.target.value as SortKey)}
                          className="w-full rounded-lg border border-border bg-card pl-7 pr-2 py-2 text-xs font-bold outline-none focus:border-primary/60"
                        >
                          <option value="relevance">Relevance</option>
                          <option value="rating">Top Rated</option>
                          <option value="year_desc">Newest</option>
                          <option value="year_asc">Oldest</option>
                          <option value="views">Most Viewed</option>
                          <option value="title">Title (A-Z)</option>
                        </select>
                      </div>
                    </div>
                    <button
                      onClick={resetFilters}
                      className="self-end rounded-lg bg-muted px-3 py-2 text-[11px] font-bold text-foreground hover:bg-primary/10"
                    >
                      Reset
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </header>

      <AnimatePresence mode="wait">
        {!isSearchingActive ? (
          <motion.div
            key="discover"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="px-4 py-5 space-y-7 pb-28"
          >
            {/* Recent */}
            {recent.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="flex items-center gap-2 text-sm font-bold">
                    <Clock size={15} className="text-primary" /> Recent
                  </h3>
                  <button onClick={clearRecent} className="text-[11px] font-bold text-muted-foreground hover:text-primary">
                    Clear
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {recent.map((t) => (
                    <button
                      key={t}
                      onClick={() => setQ(t)}
                      className="group inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:border-primary/40 hover:bg-primary/5 transition"
                    >
                      <Clock size={11} className="text-muted-foreground group-hover:text-primary" />
                      {t}
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* Top community requests */}
            {topRequests.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="flex items-center gap-2 text-sm font-bold">
                    <MessageSquarePlus size={15} className="text-primary" /> Community Requests
                  </h3>
                  <button
                    onClick={() => setShowRequest(true)}
                    className="text-[11px] font-bold text-primary hover:underline"
                  >
                    + New
                  </button>
                </div>
                <div className="space-y-2">
                  {topRequests.map((r) => (
                    <RequestCard
                      key={r.id}
                      r={r}
                      voted={!!(user && r.voters?.[user.uid])}
                      onVote={() => voteRequest(r.id)}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Trending searches */}
            <section>
              <h3 className="flex items-center gap-2 text-sm font-bold mb-3">
                <TrendingUp size={15} className="text-primary" /> Trending Searches
              </h3>
              <div className="flex flex-wrap gap-2">
                {["Animal", "Bahubali", "Spiderman", "Avengers", "KGF", "Pushpa", "RRR", "Squid Game"].map((t, i) => (
                  <motion.button
                    key={t}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    onClick={() => setQ(t)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 px-3 py-1.5 text-xs font-bold text-foreground hover:from-primary/20 hover:to-primary/10 transition"
                  >
                    <span className="text-[10px] text-primary font-mono">#{i + 1}</span>
                    {t}
                  </motion.button>
                ))}
              </div>
            </section>

            {/* Top Rated grid */}
            {topRated.length > 0 && (
              <section>
                <div className="flex items-end justify-between mb-3">
                  <h3 className="flex items-center gap-2 text-sm font-bold">
                    <Star size={15} className="text-premium fill-premium" /> Top Rated
                  </h3>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">IMDb</span>
                </div>
                <div className="grid grid-cols-3 gap-2.5">
                  {topRated.map((m) => {
                    const img = m.posterUrl || m.detailThumbnailUrl || m.bannerImageUrl || "/placeholder.svg";
                    return (
                      <Link key={m.id} to={`/movie/${m.id}`} className="block group">
                        <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-muted">
                          <img
                            src={img}
                            alt={m.title}
                            className="h-full w-full object-cover group-active:scale-95 transition duration-300"
                            loading="lazy"
                            decoding="async"
                          />
                          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 to-transparent" />
                          {m.imdbRating ? (
                            <div className="absolute top-1.5 right-1.5 inline-flex items-center gap-0.5 rounded-md bg-black/60 backdrop-blur px-1.5 py-0.5 text-[9px] font-bold text-white">
                              <Star size={8} className="fill-premium text-premium" />
                              {m.imdbRating.toFixed(1)}
                            </div>
                          ) : null}
                          <div className="absolute bottom-1.5 left-1.5 right-1.5">
                            <p className="text-[10px] font-bold text-white line-clamp-1">{m.title}</p>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            )}

            {trending.length > 0 && (
              <section>
                <h3 className="flex items-center gap-2 text-sm font-bold mb-3">
                  <Sparkles size={15} className="text-primary" /> Popular Now
                </h3>
                <div className="grid grid-cols-3 gap-2.5">
                  {trending.map((m) => {
                    const img = m.posterUrl || m.detailThumbnailUrl || m.bannerImageUrl || "/placeholder.svg";
                    return (
                      <Link key={m.id} to={`/movie/${m.id}`} className="block">
                        <div className="aspect-[2/3] overflow-hidden rounded-xl bg-muted">
                          <img src={img} alt={m.title} className="h-full w-full object-cover" loading="lazy" decoding="async" />
                        </div>
                        <p className="mt-1.5 text-[11px] font-bold line-clamp-1">{m.title}</p>
                        <p className="text-[10px] text-muted-foreground line-clamp-1">{m.year} · {m.language}</p>
                      </Link>
                    );
                  })}
                </div>
              </section>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="px-4 py-4 pb-28"
          >
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs text-muted-foreground">
                <span className="font-bold text-foreground">{results.length}</span> result{results.length === 1 ? "" : "s"}
                {debouncedQ && (<> for <span className="font-bold text-foreground">"{debouncedQ}"</span></>)}
              </p>
            </div>

            {/* Suggest existing pending requests when query matches them */}
            {matchingRequests.length > 0 && (
              <div className="mb-4 space-y-2">
                <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                  Already Requested · Vote to bring it
                </p>
                {matchingRequests.map((r) => (
                  <RequestCard
                    key={r.id}
                    r={r}
                    voted={!!(user && r.voters?.[user.uid])}
                    onVote={() => voteRequest(r.id)}
                  />
                ))}
              </div>
            )}

            {results.length === 0 ? (
              <div className="py-12 text-center">
                <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-muted">
                  <Film size={28} className="text-muted-foreground" />
                </div>
                <p className="text-sm font-bold mb-1">No results found</p>
                <p className="text-xs text-muted-foreground mb-5">
                  Don't see what you want? Request it and let the community vote.
                </p>
                <button
                  onClick={() => setShowRequest(true)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-gradient-primary px-5 py-2.5 text-xs font-bold text-primary-foreground active:scale-95 transition"
                >
                  <MessageSquarePlus size={13} />
                  Request {debouncedQ ? `"${debouncedQ}"` : "a movie"}
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {results.map((m) => {
                  const img = m.posterUrl || m.detailThumbnailUrl || m.bannerImageUrl || "/placeholder.svg";
                  return (
                    <Link
                      key={m.id}
                      to={`/movie/${m.id}`}
                      className="group flex gap-3 rounded-2xl border border-border bg-card p-2.5 hover:border-primary/40 hover:bg-primary/[0.02] transition"
                    >
                      <div className="relative shrink-0">
                        <img
                          src={img}
                          alt={m.title}
                          className="h-[88px] w-[62px] rounded-xl object-cover"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 rounded-xl bg-black/0 group-hover:bg-black/30 transition grid place-items-center">
                          <Play size={20} className="opacity-0 group-hover:opacity-100 fill-white text-white transition" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0 py-0.5 flex flex-col">
                        <h4 className="text-sm font-bold line-clamp-1">{m.title}</h4>
                        <div className="mt-1 flex items-center gap-2 flex-wrap">
                          {m.imdbRating ? (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-foreground">
                              <Star size={10} className="fill-premium text-premium" />
                              {m.imdbRating.toFixed(1)}
                            </span>
                          ) : null}
                          {m.year && <span className="text-[10px] text-muted-foreground">{m.year}</span>}
                          {m.language && <span className="text-[10px] text-muted-foreground">· {m.language}</span>}
                          {m.quality && (
                            <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold text-primary uppercase">
                              {m.quality}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground line-clamp-2 mt-1">{m.shortDescription || m.description}</p>
                        {m.category && (
                          <span className="mt-auto pt-1 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                            {m.category}
                          </span>
                        )}
                      </div>
                    </Link>
                  );
                })}

                {/* Always allow requesting from results too */}
                <button
                  onClick={() => setShowRequest(true)}
                  className="mt-4 w-full inline-flex items-center justify-center gap-1.5 rounded-2xl border border-dashed border-border bg-card/50 px-5 py-3 text-xs font-bold text-muted-foreground hover:border-primary/40 hover:text-primary transition"
                >
                  <MessageSquarePlus size={13} />
                  Not finding what you want? Request a movie
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Request modal */}
      <RequestModal
        open={showRequest}
        defaultTitle={debouncedQ}
        onClose={() => setShowRequest(false)}
        onSubmit={async (title, note) => {
          await submitNewRequest(title, note);
          setShowRequest(false);
        }}
        signedIn={!!user}
        onSignIn={() => nav("/login")}
      />
    </div>
  );
}

function FilterRow({
  label, items, value, onChange,
}: { label: string; items: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1.5">{label}</p>
      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide -mx-4 px-4 pb-1">
        {items.map((c) => (
          <button
            key={c}
            onClick={() => onChange(c)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition ${
              value === c ? "bg-primary text-primary-foreground" : "bg-muted text-foreground/70 hover:bg-primary/10"
            }`}
          >
            {c}
          </button>
        ))}
      </div>
    </div>
  );
}

function RequestCard({
  r, voted, onVote,
}: { r: MovieRequest; voted: boolean; onVote: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
      <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 shrink-0">
        <Film size={16} className="text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold line-clamp-1">{r.title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] text-muted-foreground">
            by {r.createdByName || "User"}
          </span>
          {r.status === "fulfilled" && (
            <span className="rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-emerald-600">
              Added
            </span>
          )}
        </div>
      </div>
      <button
        onClick={onVote}
        disabled={r.status === "fulfilled"}
        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition disabled:opacity-50 ${
          voted ? "bg-primary text-primary-foreground" : "bg-muted text-foreground hover:bg-primary/10"
        }`}
      >
        <ThumbsUp size={12} className={voted ? "fill-primary-foreground" : ""} />
        {r.votes || 0}
      </button>
    </div>
  );
}

function RequestModal({
  open, onClose, onSubmit, defaultTitle, signedIn, onSignIn,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (title: string, note?: string) => Promise<void>;
  defaultTitle: string;
  signedIn: boolean;
  onSignIn: () => void;
}) {
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(defaultTitle || "");
      setNote("");
    }
  }, [open, defaultTitle]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 320 }}
            className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-md rounded-t-3xl bg-card border-t border-border p-5 pb-8 shadow-2xl"
          >
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-muted" />
            <div className="flex items-center gap-2 mb-4">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10">
                <MessageSquarePlus size={18} className="text-primary" />
              </div>
              <div>
                <h3 className="text-base font-extrabold">Request a movie</h3>
                <p className="text-[11px] text-muted-foreground">
                  Community votes — most-wanted gets added first.
                </p>
              </div>
            </div>

            {!signedIn ? (
              <div className="text-center py-6">
                <p className="text-sm font-bold mb-3">Sign in to request and vote</p>
                <button
                  onClick={onSignIn}
                  className="rounded-full bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground"
                >
                  Sign in
                </button>
              </div>
            ) : (
              <>
                <label className="block text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1.5">
                  Movie title
                </label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Inception (2010)"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-semibold outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
                />

                <label className="mt-3 block text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1.5">
                  Note (optional)
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Year, language preference, or anything we should know"
                  rows={2}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-xs outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 resize-none"
                />

                <div className="mt-4 flex gap-2">
                  <button
                    onClick={onClose}
                    className="flex-1 rounded-full bg-muted py-2.5 text-xs font-bold text-foreground"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={!title.trim() || busy}
                    onClick={async () => {
                      setBusy(true);
                      try { await onSubmit(title, note); } finally { setBusy(false); }
                    }}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full bg-gradient-primary py-2.5 text-xs font-bold text-primary-foreground disabled:opacity-50"
                  >
                    <Send size={12} />
                    {busy ? "Sending…" : "Submit Request"}
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
