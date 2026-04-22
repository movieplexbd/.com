import { useNavigate, useParams, Link } from "react-router-dom";
import { useFirebaseValue } from "@/hooks/useFirebase";
import { Lock, ArrowLeft, Crown, Check, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";
import type { Movie } from "@/lib/types";

const FEATURES = [
  "সকল নতুন মুভির বাংলা ডাবিং",
  "এক ক্লিকে ডাউনলোড সুবিধা",
  "অনলাইন প্লে সাপোর্ট",
  "শর্ট ভিডিও দেখে মুভি সিলেক্ট",
  "আনলিমিটেড মুভি কালেকশন",
  "Animal, বাহুবালি, Spiderman, Avengers বাংলা ডাবিং",
  "Hindi / South / Korean / Hollywood Bangla Dubbed",
];

export default function LockScreen() {
  const { id } = useParams();
  const nav = useNavigate();
  const { data: movie } = useFirebaseValue<Movie>(id ? `movies/${id}` : null);
  const [plan, setPlan] = useState<"monthly" | "yearly">("monthly");

  const banner = movie?.bannerImageUrl || movie?.posterUrl || "/placeholder.svg";

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Soft tinted background — no blur */}
      <div className="absolute inset-0 bg-muted" />

      <div className="relative">
        <button onClick={() => nav(-1)} className="absolute top-4 left-4 grid h-10 w-10 place-items-center rounded-full bg-card shadow-soft safe-top z-10">
          <ArrowLeft size={18} />
        </button>

        <div className="px-5 pt-12 pb-6 safe-top text-center">
          {/* Lock icon — static, no infinite animations */}
          <div className="mx-auto mb-4 grid h-20 w-20 place-items-center rounded-full bg-gradient-premium shadow-premium relative">
            <Lock size={32} className="text-premium-foreground" />
            <div className="absolute -top-2 -right-2">
              <Sparkles size={20} className="text-premium" />
            </div>
          </div>

          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <div className="inline-block rounded-full bg-destructive/10 px-3 py-1 text-[11px] font-bold text-destructive font-bangla">
              সীমিত অফার 🔥
            </div>
            <h1 className="mt-3 text-2xl font-extrabold tracking-tight font-bangla">এক্সক্লুসিভ চা প্যাক</h1>
            <div className="mt-2 flex items-baseline justify-center gap-1">
              <span className="text-4xl font-extrabold text-primary">৳১০</span>
              <span className="text-xs text-muted-foreground font-bangla">/ এককালীন</span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed font-bangla max-w-xs mx-auto">
              সদ্য মুক্তি পাওয়া নতুন সকল মুভি গুলোর বাংলা ডাবিং পেয়ে যান মাত্র ১০ টাকায় এক মাসের অ্যাক্সেস। মাত্র একটি চায়ের দামে!
            </p>
          </motion.div>
        </div>

        {/* Features */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="mx-4 mb-5">
          <div className="rounded-3xl bg-card p-5 shadow-card">
            <h3 className="mb-3 text-sm font-bold flex items-center gap-1.5 font-bangla">
              <Crown size={16} className="text-premium" /> আপনি যা পাবেন:
            </h3>
            <ul className="space-y-2">
              {FEATURES.map((f, i) => (
                <motion.li
                  key={f}
                  initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + i * 0.04 }}
                  className="flex items-start gap-2 text-xs font-bangla"
                >
                  <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-success/20 text-success">
                    <Check size={10} strokeWidth={3.5} />
                  </span>
                  {f}
                </motion.li>
              ))}
            </ul>
          </div>
        </motion.div>

        {/* Plans */}
        <div className="px-4 grid grid-cols-2 gap-3 mb-3">
          <PlanCard
            title="1 Month" price="৳10" subtitle="Monthly Pack"
            selected={plan === "monthly"} onClick={() => setPlan("monthly")}
          />
          <PlanCard
            title="1 Year" price="৳50" subtitle="Best Value · Save 90%"
            selected={plan === "yearly"} onClick={() => setPlan("yearly")} popular
          />
        </div>

        <div className="px-4 pb-8 safe-bottom">
          <Link
            to={`/subscribe?plan=${plan}&movie=${id}`}
            className="block w-full rounded-2xl bg-gradient-primary py-4 text-center text-sm font-extrabold text-primary-foreground shadow-premium active:scale-[0.98] transition"
          >
            SUBSCRIBE NOW
          </Link>
          <p className="mt-3 text-center text-[10px] text-muted-foreground">
            Secure payment via bKash · Nagad · Rocket
          </p>
        </div>
      </div>
    </div>
  );
}

function PlanCard({ title, price, subtitle, selected, onClick, popular }: any) {
  return (
    <button
      onClick={onClick}
      className={`relative rounded-2xl border-2 p-3 text-left transition ${
        selected ? "border-primary bg-primary/5 shadow-premium" : "border-border bg-card"
      }`}
    >
      {popular && (
        <span className="absolute -top-2 right-2 rounded-full bg-gradient-premium px-2 py-0.5 text-[9px] font-bold text-premium-foreground">
          POPULAR
        </span>
      )}
      <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{title}</div>
      <div className="text-2xl font-extrabold mt-1">{price}</div>
      <div className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</div>
      <div className={`mt-2 grid h-5 w-5 place-items-center rounded-full ${selected ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
        {selected && <Check size={12} strokeWidth={3} />}
      </div>
    </button>
  );
}
