import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { Play, ArrowLeft, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

export default function Login() {
  const { signInGoogle, user } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const from = (loc.state as any)?.from || "/";
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (user) nav(from, { replace: true });
  }, [user, from, nav]);

  const handle = async () => {
    setLoading(true); setErr("");
    try {
      await signInGoogle();
      nav(from, { replace: true });
    } catch (e: any) {
      setErr(e?.message || "Sign in failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col safe-top">
      <button onClick={() => nav(-1)} className="absolute top-4 left-4 grid h-10 w-10 place-items-center rounded-full bg-muted z-10">
        <ArrowLeft size={18} />
      </button>

      <div className="flex flex-col items-center px-8 text-center pt-16">
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 16 }}
          className="grid h-20 w-20 place-items-center rounded-3xl bg-gradient-primary shadow-premium mb-5"
        >
          <Play size={36} className="fill-white text-white" />
        </motion.div>
        <h1 className="text-2xl font-extrabold tracking-tight">Welcome to <span className="text-primary">MOVIEPLEXBD</span></h1>
        <p className="text-sm text-muted-foreground mt-2 font-bangla">গুগল দিয়ে দ্রুত লগইন করুন</p>

        <ul className="mt-6 space-y-2.5 text-left w-full max-w-xs">
          {[
            "এক ক্লিকে নিরাপদ লগইন",
            "সকল নতুন বাংলা ডাবিং মুভি",
            "এইচডি স্ট্রিমিং + ডাউনলোড",
          ].map((t) => (
            <li key={t} className="flex items-center gap-2 text-sm font-bangla">
              <span className="grid h-5 w-5 place-items-center rounded-full bg-success/15 text-success">✓</span>
              {t}
            </li>
          ))}
        </ul>

        {err && <p className="mt-4 text-xs text-destructive">{err}</p>}

        <div className="w-full max-w-xs mt-8 space-y-3">
          <button
            onClick={handle}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 rounded-2xl bg-foreground py-4 text-sm font-bold text-background shadow-card active:scale-[0.98] transition disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : <GoogleIcon />}
            {loading ? "Signing in..." : "Continue with Google"}
          </button>
          <p className="text-center text-[10px] text-muted-foreground">
            By continuing you agree to our Terms & Privacy Policy
          </p>
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path fill="#FFC107" d="M21.8 10H12v4h5.6c-.5 2.4-2.6 4-5.6 4a6 6 0 1 1 4-10.5l2.8-2.8A10 10 0 1 0 22 12c0-.7-.1-1.4-.2-2z"/>
      <path fill="#FF3D00" d="M3.2 7.3l3.3 2.4A6 6 0 0 1 12 6a6 6 0 0 1 4 1.5l2.8-2.8A10 10 0 0 0 3.2 7.3z"/>
      <path fill="#4CAF50" d="M12 22a10 10 0 0 0 6.8-2.6l-3.1-2.6c-1 .7-2.3 1.2-3.7 1.2-3 0-5.5-2-6.4-4.6l-3.3 2.5A10 10 0 0 0 12 22z"/>
      <path fill="#1976D2" d="M21.8 10H12v4h5.6a6 6 0 0 1-2 2.8l3.1 2.6c2-1.8 3.3-4.6 3.3-7.4 0-.7-.1-1.4-.2-2z"/>
    </svg>
  );
}
