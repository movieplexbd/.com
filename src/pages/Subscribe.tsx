import { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { ArrowLeft, ArrowDown, Copy, Check, Loader2, Crown, Sparkles, Play } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { ref, set, update } from "firebase/database";
import { db } from "@/lib/firebase";
import { getDeviceId } from "@/lib/utils";
import { motion } from "framer-motion";
import { useFirebaseList } from "@/hooks/useFirebase";
import type { Movie } from "@/lib/types";

const PAYMENT_NUMBER = "01913305107";

export default function Subscribe() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const { user, profile, isPremium } = useAuth();
  const { data: movies } = useFirebaseList<Movie>("movies");
  const freePreviews = useMemo(
    () => movies.filter((m) => m.testMovie).slice(0, 6),
    [movies],
  );
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const [form, setForm] = useState({
    fullName: user?.displayName || "",
    email: user?.email || "",
    plan: (params.get("plan") as "monthly" | "yearly") || "monthly",
    txn: "",
    method: "bkash" as "bkash" | "nagad" | "rocket",
  });

  // Redirect to login if unauthenticated — use effect (not setTimeout-in-render).
  useEffect(() => {
    if (!user) nav("/login", { state: { from: "/subscribe" } });
  }, [user, nav]);

  // Always start at the top of the page on mount — prevents the page
  // from briefly appearing scrolled when arriving from another route.
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, []);

  if (!user) return null;

  const amount = form.plan === "monthly" ? 10 : 50;
  const deviceId = getDeviceId();

  const copyNum = () => { navigator.clipboard.writeText(PAYMENT_NUMBER); setCopied(true); setTimeout(() => setCopied(false), 1500); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.txn.trim() || !form.fullName.trim() || !form.email.trim()) return;
    setSubmitting(true);
    try {
      // Grant provisional premium access immediately. Admin can still
      // approve or reject afterwards from the admin panel — on reject,
      // access is revoked. Auto-expires when the plan period ends.
      const days = form.plan === "yearly" ? 365 : 30;
      const expiry = Date.now() + days * 86400 * 1000;

      const sub = {
        uid: user.uid,
        email: form.email.trim(),
        fullName: form.fullName.trim(),
        plan: form.plan,
        amount,
        transactionId: form.txn.trim(),
        paymentMethod: form.method,
        deviceId,
        status: "PENDING" as const,
        submittedAt: Date.now(),
        provisionalExpiry: expiry,
      };
      await set(ref(db, `subscriptions/${user.uid}`), sub);
      await update(ref(db, `users/${user.uid}`), {
        // Premium NOW (provisional). Admin review happens in the background.
        subscriptionStatus: "premium",
        subscriptionPlan: form.plan,
        subscriptionExpiry: expiry,
        subscriptionProvisional: true,
      });
      setDone(true);
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center safe-top">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" }} className="grid h-20 w-20 place-items-center rounded-full bg-success text-success-foreground shadow-premium">
          <Check size={40} strokeWidth={3} />
        </motion.div>
        <h2 className="mt-5 text-xl font-extrabold">Premium Activated!</h2>
        <p className="mt-2 text-sm text-muted-foreground font-bangla max-w-xs">
          আপনার Premium access এখনই চালু হয়েছে! সব মুভি দেখতে ও ডাউনলোড করতে পারবেন। অ্যাডমিন payment verify করবে — verify না হলে access বন্ধ হয়ে যেতে পারে।
        </p>
        <button onClick={() => nav("/")} className="mt-8 rounded-2xl bg-primary px-8 py-3 text-sm font-bold text-primary-foreground shadow-premium">
          Start Watching
        </button>
      </div>
    );
  }

  // Block duplicate subscription if already premium or pending review
  const pendingExisting = profile?.subscriptionStatus === "pending";
  if (isPremium || pendingExisting) {
    const expiryDate = profile?.subscriptionExpiry
      ? new Date(profile.subscriptionExpiry).toLocaleDateString()
      : null;
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center safe-top">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring" }}
          className="grid h-20 w-20 place-items-center rounded-full bg-gradient-premium text-premium-foreground shadow-premium"
        >
          {pendingExisting ? <Loader2 size={36} className="animate-spin" /> : <Crown size={36} />}
        </motion.div>
        <h2 className="mt-5 text-xl font-extrabold">
          {pendingExisting ? "Request Pending" : "Subscription Active"}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground font-bangla max-w-xs">
          {pendingExisting
            ? "আপনার আগের সাবস্ক্রিপশন রিকোয়েস্ট এখনো review হচ্ছে। Admin approve করার পর Premium চালু হবে।"
            : `আপনার Premium সাবস্ক্রিপশন active হয়েছে${expiryDate ? `। মেয়াদ থাকবে ${expiryDate} পর্যন্ত` : ""}। এখন সব Premium মুভি দেখতে ও ডাউনলোড করতে পারবেন।`}
        </p>
        <div className="mt-8 flex gap-2">
          <Link to="/profile" className="rounded-2xl bg-muted px-6 py-3 text-sm font-bold text-foreground">
            Profile
          </Link>
          <Link to="/" className="rounded-2xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-premium">
            Start Watching
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative pb-8">
      <header className="sticky top-0 z-40 glass safe-top px-4 pt-3 pb-3 flex items-center gap-3 border-b border-border/50">
        <button onClick={() => nav(-1)} className="grid h-10 w-10 place-items-center rounded-full bg-muted">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-base font-extrabold">Premium Membership</h1>
          <p className="text-[11px] text-muted-foreground font-bangla">পেমেন্ট সম্পন্ন করুন</p>
        </div>
      </header>

      <div className="px-4 pt-4 space-y-4">
        <button
          type="button"
          onClick={() => bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })}
          aria-label="Scroll to bottom"
          className="fixed bottom-24 right-4 z-30 grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground shadow-premium active:scale-95 transition"
        >
          <ArrowDown size={18} strokeWidth={3} />
        </button>

        <section className="rounded-2xl border border-premium/30 bg-card p-3 shadow-card">
          <p className="text-[12px] font-extrabold leading-relaxed font-bangla text-foreground">
            সদ্য মুক্তি পাওয়া নতুন সকল মুভির বাংলা ডাবিং পেয়ে যান মাত্র ১০ টাকায় এক মাসের অ্যাক্সেস। মাত্র একটি চায়ের দামে! 🔥
          </p>
          <div className="mt-3 rounded-xl bg-muted/40 p-3">
            <h3 className="text-[11px] font-extrabold font-bangla text-foreground">মূল সুবিধাসমূহ:</h3>
            <ul className="mt-2 grid grid-cols-1 gap-1.5 text-[11px] font-semibold leading-tight text-muted-foreground font-bangla">
              {[
                "মোবাইল অ্যাপ (ফুল এক্সপেরিন্স)",
                "সম্পূর্ণ বিজ্ঞাপনমুক্ত ওয়েবসাইট",
                "ওয়েবসাইটেই রিলস দেখে মুভি সিলেকশন সুবিধা",
                "এক ক্লিকে ডাউনলোড সুবিধা",
                "সকল মুভির বাংলা ডাবিং",
                "আনলিমিটেড মুভি কালেকশন",
                "Animal, Spiderman, Avengers টাইপ সকল ইন্ডিয়ান, হলিউড ও কোরিয়ান মুভির বাংলা ডাবিং",
              ].map((text) => (
                <li key={text} className="flex gap-1.5">
                  <Check size={12} className="mt-0.5 shrink-0 text-premium" strokeWidth={3} />
                  <span>{text}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Free preview — small & simple */}
        {freePreviews.length > 0 && (
          <section className="rounded-2xl border border-success/30 bg-success/5 p-3">
            <div className="flex items-center gap-2 mb-2.5">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-success text-success-foreground">
                <Sparkles size={13} strokeWidth={2.5} />
              </span>
              <div className="flex-1 min-w-0">
                <h3 className="text-[13px] font-extrabold leading-tight">Try Before You Pay</h3>
                <p className="text-[10px] text-muted-foreground font-bangla leading-tight mt-0.5">
                  ফ্রি-তে এই মুভিগুলো দেখে টেস্ট করুন
                </p>
              </div>
            </div>
            <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1">
              {freePreviews.map((m) => {
                const poster = m.posterUrl || m.detailThumbnailUrl || m.bannerImageUrl || "/placeholder.svg";
                return (
                  <Link
                    key={m.id}
                    to={`/movie/${m.id}`}
                    className="shrink-0 w-[72px] active:scale-95 transition"
                  >
                    <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-muted">
                      <img
                        src={poster}
                        alt={m.title}
                        loading="lazy"
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                      <span className="absolute top-0.5 left-0.5 rounded bg-success px-1 py-px text-[7px] font-extrabold text-success-foreground leading-none">
                        FREE
                      </span>
                    </div>
                    <p className="mt-1 text-[9px] font-bold line-clamp-1 text-foreground/80">
                      {m.title}
                    </p>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* Payment instructions */}
        <div className="rounded-3xl bg-gradient-card p-5 shadow-card">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Send Money to</p>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-2xl font-extrabold tracking-wider">{PAYMENT_NUMBER}</span>
            <button onClick={copyNum} className="grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground">
              {copied ? <Check size={16} /> : <Copy size={16} />}
            </button>
          </div>
          <div className="mt-3 flex gap-2">
            {(["bkash", "nagad", "rocket"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setForm((f) => ({ ...f, method: m }))}
                className={`flex-1 rounded-xl py-2 text-xs font-bold capitalize transition ${
                  form.method === m ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* Steps */}
        <div className="rounded-2xl bg-muted/50 p-4">
          <h4 className="text-xs font-bold mb-2 font-bangla">পেমেন্টের ধাপ:</h4>
          <ol className="space-y-1.5 text-[11px] font-bangla">
            {[
              "Send Money করুন উপরের নাম্বারে",
              "নিচে Transaction ID দিন",
              "Plan select করুন",
              "Submit করুন — সাথে সাথে Premium চালু",
              "Admin verify করবে। ভুল payment হলে access বন্ধ হবে",
            ].map((s, i) => (
              <li key={i} className="flex gap-2">
                <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground text-[9px] font-bold">{i + 1}</span>
                {s}
              </li>
            ))}
          </ol>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <Field label="Full Name" value={form.fullName} onChange={(v) => setForm({ ...form, fullName: v })} required />
          <Field label="Gmail" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} required />

          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Select Plan</label>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              {(["monthly", "yearly"] as const).map((p) => (
                <button
                  type="button" key={p}
                  onClick={() => setForm({ ...form, plan: p })}
                  className={`rounded-xl border-2 py-3 text-xs font-bold transition ${
                    form.plan === p ? "border-primary bg-primary/5" : "border-border bg-card"
                  }`}
                >
                  <div className="text-base font-extrabold">৳{p === "monthly" ? 10 : 50}</div>
                  <div className="text-[10px] text-muted-foreground capitalize">{p === "monthly" ? "1 Month" : "1 Year"}</div>
                </button>
              ))}
            </div>
          </div>

          <Field label="Transaction ID" value={form.txn} onChange={(v) => setForm({ ...form, txn: v })} required placeholder="e.g. 8K9X4M2P" />

          <div className="rounded-xl bg-muted/50 p-3 text-[11px] text-muted-foreground">
            <span className="font-semibold">Device ID:</span> <span className="font-mono text-[10px]">{deviceId}</span>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-primary py-4 text-sm font-extrabold text-primary-foreground shadow-premium disabled:opacity-50 active:scale-[0.98] transition"
          >
            {submitting ? <Loader2 className="animate-spin" size={18} /> : null}
            Submit · ৳{amount}
          </button>
        </form>
        <div ref={bottomRef} aria-hidden="true" />
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", required, placeholder }: any) {
  return (
    <div>
      <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</label>
      <input
        type={type}
        value={value}
        required={required}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/20 transition"
      />
    </div>
  );
}
