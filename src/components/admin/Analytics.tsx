import { useMemo, useState } from "react";
import { useFirebaseList } from "@/hooks/useFirebase";
import type { Movie, Subscription } from "@/lib/types";
import { motion } from "framer-motion";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip,
  CartesianGrid, BarChart, Bar,
} from "recharts";
import { TrendingUp, DollarSign, Search as SearchIcon, Eye, Film, AlertCircle } from "lucide-react";

interface SearchLog {
  id: string;
  uid?: string;
  keyword?: string;
  found?: boolean;
  createdAt?: number;
}

interface ViewLog {
  id: string;
  movieId?: string;
  uid?: string;
  title?: string;
  category?: string;
  createdAt?: number;
}

type Range = 7 | 30 | 90;

export default function Analytics() {
  const { data: subs } = useFirebaseList<Subscription>("subscriptions");
  const { data: movies } = useFirebaseList<Movie>("movies");
  const { data: searchLogs } = useFirebaseList<SearchLog>("search_logs");
  const { data: viewLogs } = useFirebaseList<ViewLog>("view_logs");
  const [range, setRange] = useState<Range>(30);

  const sinceMs = useMemo(() => Date.now() - range * 24 * 60 * 60 * 1000, [range]);

  // ----- Revenue -----
  const approved = useMemo(
    () => subs.filter((s) => s.status === "APPROVED" && (s.approvedAt || s.submittedAt) >= sinceMs),
    [subs, sinceMs]
  );
  const totalRevenue = approved.reduce((a, b) => a + (b.amount || 0), 0);
  const allTimeRevenue = subs.filter((s) => s.status === "APPROVED").reduce((a, b) => a + (b.amount || 0), 0);

  const revenueSeries = useMemo(() => {
    const buckets = new Map<string, number>();
    for (let i = range - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      buckets.set(d.toISOString().slice(0, 10), 0);
    }
    approved.forEach((s) => {
      const key = new Date(s.approvedAt || s.submittedAt).toISOString().slice(0, 10);
      if (buckets.has(key)) buckets.set(key, (buckets.get(key) || 0) + (s.amount || 0));
    });
    return Array.from(buckets.entries()).map(([d, v]) => ({
      date: d.slice(5),
      amount: v,
    }));
  }, [approved, range]);

  // ----- Trending (recent views) -----
  const trending = useMemo(() => {
    const counts = new Map<string, { count: number; title: string; category?: string }>();
    viewLogs
      .filter((v) => (v.createdAt || 0) >= sinceMs && v.movieId)
      .forEach((v) => {
        const cur = counts.get(v.movieId!) || { count: 0, title: v.title || "Unknown", category: v.category };
        cur.count += 1;
        counts.set(v.movieId!, cur);
      });
    return Array.from(counts.entries())
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [viewLogs, sinceMs]);

  // Fallback to all-time totalViews when no view_logs yet
  const allTimeTopMovies = useMemo(
    () => [...movies].sort((a, b) => (b.totalViews || 0) - (a.totalViews || 0)).slice(0, 10),
    [movies]
  );

  // ----- Search insights -----
  const recentSearches = useMemo(
    () => searchLogs.filter((s) => (s.createdAt || 0) >= sinceMs && s.keyword),
    [searchLogs, sinceMs]
  );
  const topSearches = useMemo(() => {
    const counts = new Map<string, number>();
    recentSearches.forEach((s) => {
      const k = s.keyword!.trim().toLowerCase();
      if (k) counts.set(k, (counts.get(k) || 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([keyword, count]) => ({ keyword, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [recentSearches]);

  const failedSearches = useMemo(() => {
    const counts = new Map<string, number>();
    recentSearches
      .filter((s) => s.found === false)
      .forEach((s) => {
        const k = s.keyword!.trim().toLowerCase();
        if (k) counts.set(k, (counts.get(k) || 0) + 1);
      });
    return Array.from(counts.entries())
      .map(([keyword, count]) => ({ keyword, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [recentSearches]);

  const totalViewsRange = viewLogs.filter((v) => (v.createdAt || 0) >= sinceMs).length;

  return (
    <div className="space-y-4">
      {/* Range selector */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold flex items-center gap-2">
          <TrendingUp size={15} className="text-primary" /> Analytics
        </h2>
        <div className="flex gap-1 rounded-full bg-card p-1 shadow-soft">
          {([7, 30, 90] as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`rounded-full px-3 py-1 text-[11px] font-bold transition ${
                range === r ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              {r}d
            </button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3">
        <KpiCard
          icon={<DollarSign size={14} />}
          label={`Revenue · ${range}d`}
          value={`৳${totalRevenue.toLocaleString()}`}
          sub={`All-time ৳${allTimeRevenue.toLocaleString()}`}
          gradient="from-violet-500 to-purple-600"
        />
        <KpiCard
          icon={<Eye size={14} />}
          label={`Views · ${range}d`}
          value={totalViewsRange.toLocaleString()}
          sub={`${trending.length} unique movies`}
          gradient="from-emerald-500 to-teal-600"
        />
        <KpiCard
          icon={<SearchIcon size={14} />}
          label={`Searches · ${range}d`}
          value={recentSearches.length.toLocaleString()}
          sub={`${failedSearches.length} zero-result`}
          gradient="from-blue-500 to-cyan-600"
        />
        <KpiCard
          icon={<Film size={14} />}
          label="Total Movies"
          value={movies.length.toLocaleString()}
          sub={`${approved.length} new subs`}
          gradient="from-amber-500 to-orange-600"
        />
      </div>

      {/* Revenue chart */}
      <Section title="Revenue Trend" icon={<DollarSign size={14} />}>
        <div className="h-52 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={revenueSeries} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                interval={Math.max(0, Math.floor(revenueSeries.length / 7) - 1)}
                tickLine={false}
                axisLine={false}
              />
              <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 12,
                  fontSize: 11,
                }}
                labelStyle={{ color: "hsl(var(--muted-foreground))" }}
                formatter={(v: number) => [`৳${v.toLocaleString()}`, "Revenue"]}
              />
              <Area
                type="monotone"
                dataKey="amount"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fill="url(#revFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Section>

      {/* Trending content */}
      <Section title={`Trending · ${range}d`} icon={<TrendingUp size={14} />}>
        {trending.length === 0 ? (
          <EmptyHint
            text="No view data yet for this period."
            sub="Showing all-time top movies by stored view count."
          />
        ) : null}
        {(trending.length > 0 ? trending : allTimeTopMovies.map((m) => ({
          id: m.id, count: m.totalViews || 0, title: m.title, category: m.category,
        }))).slice(0, 8).map((item, idx) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.02 }}
            className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0"
          >
            <span className={`grid h-7 w-7 place-items-center rounded-lg text-[10px] font-extrabold ${
              idx < 3 ? "bg-gradient-to-br from-primary to-primary-glow text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}>
              {idx + 1}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold line-clamp-1">{item.title}</p>
              {item.category && <p className="text-[10px] text-muted-foreground">{item.category}</p>}
            </div>
            <span className="text-[11px] font-mono font-bold text-primary tabular-nums">
              {item.count.toLocaleString()} <span className="text-muted-foreground font-normal">views</span>
            </span>
          </motion.div>
        ))}
      </Section>

      {/* Top searches */}
      <Section title="Top Searches" icon={<SearchIcon size={14} />}>
        {topSearches.length === 0 ? (
          <EmptyHint text="No searches yet for this period." />
        ) : (
          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topSearches} layout="vertical" margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                <YAxis
                  type="category"
                  dataKey="keyword"
                  width={90}
                  tick={{ fontSize: 10, fill: "hsl(var(--foreground))" }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 12,
                    fontSize: 11,
                  }}
                  cursor={{ fill: "hsl(var(--muted))" }}
                />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Section>

      {/* Failed searches */}
      <Section
        title="Zero-Result Searches"
        icon={<AlertCircle size={14} className="text-destructive" />}
        hint="Add these to grow your library"
      >
        {failedSearches.length === 0 ? (
          <EmptyHint text="No failed searches — your library covers what users want!" />
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {failedSearches.map((f) => (
              <span
                key={f.keyword}
                className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 border border-destructive/20 px-2.5 py-1 text-[11px] font-semibold text-destructive"
              >
                {f.keyword}
                <span className="rounded-full bg-destructive/20 px-1.5 py-0.5 text-[9px] font-mono">{f.count}</span>
              </span>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

function KpiCard({
  icon, label, value, sub, gradient,
}: { icon: React.ReactNode; label: string; value: string; sub?: string; gradient: string }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${gradient} p-3 text-white shadow-card`}>
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider opacity-90">
        {icon} {label}
      </div>
      <div className="text-xl font-extrabold mt-1 tabular-nums">{value}</div>
      {sub && <div className="text-[10px] opacity-80 mt-0.5">{sub}</div>}
    </div>
  );
}

function Section({
  title, icon, children, hint,
}: { title: string; icon?: React.ReactNode; children: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-2xl bg-card p-3.5 shadow-soft">
      <div className="flex items-center justify-between mb-2.5">
        <h3 className="flex items-center gap-1.5 text-xs font-bold">{icon} {title}</h3>
        {hint && <span className="text-[10px] text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function EmptyHint({ text, sub }: { text: string; sub?: string }) {
  return (
    <div className="py-3 text-center">
      <p className="text-[11px] text-muted-foreground">{text}</p>
      {sub && <p className="text-[10px] text-muted-foreground/70 mt-1">{sub}</p>}
    </div>
  );
}
