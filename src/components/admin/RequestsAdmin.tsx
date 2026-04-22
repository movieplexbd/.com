import { useMemo, useState } from "react";
import { useFirebaseList } from "@/hooks/useFirebase";
import { ref, remove, update } from "firebase/database";
import { db } from "@/lib/firebase";
import type { Movie } from "@/lib/types";
import { MessageSquarePlus, ThumbsUp, Trash2, Check, Clock, Search as SearchIcon } from "lucide-react";
import { timeAgo } from "@/lib/utils";

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

type Filter = "pending" | "fulfilled" | "rejected" | "all";

export default function RequestsAdmin() {
  const { data: requests, loading } = useFirebaseList<MovieRequest>("movie_requests");
  const { data: movies } = useFirebaseList<Movie>("movies");
  const [filter, setFilter] = useState<Filter>("pending");
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    let list = [...requests];
    if (filter !== "all") list = list.filter((r) => (r.status || "pending") === filter);
    const s = q.trim().toLowerCase();
    if (s) list = list.filter((r) => r.title?.toLowerCase().includes(s));
    list.sort((a, b) => (b.votes || 0) - (a.votes || 0) || (b.createdAt || 0) - (a.createdAt || 0));
    return list;
  }, [requests, filter, q]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { pending: 0, fulfilled: 0, rejected: 0 };
    requests.forEach((r) => {
      const s = r.status || "pending";
      c[s] = (c[s] || 0) + 1;
    });
    return c;
  }, [requests]);

  const fulfill = async (r: MovieRequest, movieId: string) => {
    await update(ref(db, `movie_requests/${r.id}`), {
      status: "fulfilled",
      fulfilledMovieId: movieId,
      fulfilledAt: Date.now(),
    });
  };

  const reject = async (id: string) => {
    await update(ref(db, `movie_requests/${id}`), { status: "rejected" });
  };

  const reopen = async (id: string) => {
    await update(ref(db, `movie_requests/${id}`), { status: "pending", fulfilledMovieId: null });
  };

  const del = async (id: string) => {
    if (!confirm("Delete this request?")) return;
    await remove(ref(db, `movie_requests/${id}`));
  };

  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-card p-4 shadow-card">
        <div className="flex items-center gap-2 mb-3">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10">
            <MessageSquarePlus size={16} className="text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-extrabold">Movie Requests</h2>
            <p className="text-[10px] text-muted-foreground">User-submitted, vote-ranked wishlist</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-3">
          {(["pending", "fulfilled", "rejected"] as const).map((k) => (
            <div key={k} className="rounded-xl bg-muted/50 p-2 text-center">
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold">{k}</p>
              <p className="text-lg font-extrabold">{counts[k] || 0}</p>
            </div>
          ))}
        </div>

        <div className="relative mb-2">
          <SearchIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search request titles…"
            className="w-full rounded-lg border border-border bg-background pl-8 pr-3 py-2 text-xs font-semibold outline-none focus:border-primary/60"
          />
        </div>

        <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
          {(["pending", "fulfilled", "rejected", "all"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider transition ${
                filter === f ? "bg-primary text-primary-foreground" : "bg-muted text-foreground/70"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 rounded-2xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl bg-card p-8 text-center text-xs text-muted-foreground">
          No {filter} requests.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => (
            <RequestItem
              key={r.id}
              r={r}
              movies={movies}
              onFulfill={fulfill}
              onReject={reject}
              onReopen={reopen}
              onDelete={del}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RequestItem({
  r, movies, onFulfill, onReject, onReopen, onDelete,
}: {
  r: MovieRequest;
  movies: Movie[];
  onFulfill: (r: MovieRequest, movieId: string) => Promise<void>;
  onReject: (id: string) => Promise<void>;
  onReopen: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [picking, setPicking] = useState(false);
  const [pick, setPick] = useState("");

  const matches = useMemo(() => {
    const t = r.title.toLowerCase();
    return movies
      .filter((m) => m.title?.toLowerCase().includes(t.split(" ")[0] || t))
      .slice(0, 8);
  }, [movies, r.title]);

  const status = r.status || "pending";
  const statusColors: Record<string, string> = {
    pending: "bg-amber-500/15 text-amber-600",
    fulfilled: "bg-emerald-500/15 text-emerald-600",
    rejected: "bg-destructive/15 text-destructive",
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <div className="flex items-start gap-3">
        <div className="flex flex-col items-center gap-0.5 rounded-xl bg-primary/10 px-3 py-2 shrink-0">
          <ThumbsUp size={14} className="text-primary" />
          <span className="text-base font-extrabold text-primary leading-none">{r.votes || 0}</span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h4 className="text-sm font-bold line-clamp-1 flex-1">{r.title}</h4>
            <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase ${statusColors[status]}`}>
              {status}
            </span>
          </div>
          {r.note && <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{r.note}</p>}
          <div className="flex items-center gap-2 mt-1.5 text-[10px] text-muted-foreground">
            <span>by {r.createdByName || "User"}</span>
            <span className="inline-flex items-center gap-0.5">
              <Clock size={10} />
              {r.createdAt ? timeAgo(r.createdAt) : "—"}
            </span>
          </div>
        </div>
      </div>

      {picking && (
        <div className="mt-3 rounded-xl bg-muted/50 p-2.5 space-y-2">
          <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
            Link to existing movie
          </p>
          <select
            value={pick}
            onChange={(e) => setPick(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-2 py-2 text-xs font-bold outline-none"
          >
            <option value="">— Select a movie —</option>
            {matches.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title} {m.year ? `(${m.year})` : ""}
              </option>
            ))}
            {matches.length === 0 && (
              <option disabled>No close matches found in library</option>
            )}
          </select>
          <div className="flex gap-1.5">
            <button
              onClick={() => { setPicking(false); setPick(""); }}
              className="flex-1 rounded-lg bg-muted py-1.5 text-[11px] font-bold"
            >
              Cancel
            </button>
            <button
              disabled={!pick}
              onClick={async () => {
                await onFulfill(r, pick);
                setPicking(false);
                setPick("");
              }}
              className="flex-1 rounded-lg bg-primary py-1.5 text-[11px] font-bold text-primary-foreground disabled:opacity-50"
            >
              Mark Fulfilled
            </button>
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-1.5">
        {status !== "fulfilled" ? (
          <button
            onClick={() => setPicking((v) => !v)}
            className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/10 px-2.5 py-1.5 text-[11px] font-bold text-emerald-600 hover:bg-emerald-500/20"
          >
            <Check size={11} /> Fulfill
          </button>
        ) : (
          <button
            onClick={() => onReopen(r.id)}
            className="inline-flex items-center gap-1 rounded-lg bg-muted px-2.5 py-1.5 text-[11px] font-bold text-foreground"
          >
            Reopen
          </button>
        )}
        {status === "pending" && (
          <button
            onClick={() => onReject(r.id)}
            className="inline-flex items-center gap-1 rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-[11px] font-bold text-amber-600 hover:bg-amber-500/20"
          >
            Reject
          </button>
        )}
        <button
          onClick={() => onDelete(r.id)}
          className="ml-auto inline-flex items-center gap-1 rounded-lg bg-destructive/10 px-2.5 py-1.5 text-[11px] font-bold text-destructive hover:bg-destructive/20"
        >
          <Trash2 size={11} /> Delete
        </button>
      </div>
    </div>
  );
}
