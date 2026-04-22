import { motion, AnimatePresence } from "framer-motion";
import { X, Download, Smartphone, Sparkles, ChevronRight, Check, ShieldCheck, Wifi, Bell } from "lucide-react";
import { useFirebaseValue } from "@/hooks/useFirebase";
import type { AppPromo } from "@/lib/types";
import { useEffect } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Called when user chooses "Continue on web anyway" */
  onContinue: () => void;
  /** Heading hint, e.g. "ডাউনলোড" or "দেখুন" */
  intent?: "watch" | "download";
}

export function AppDownloadPrompt({ open, onClose, onContinue, intent = "watch" }: Props) {
  const { data: promo } = useFirebaseValue<AppPromo>("app_promo");

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // If promo disabled or no download URL, don't intercept — just continue
  useEffect(() => {
    if (!open) return;
    if (promo === null) return; // still loading
    if (!promo?.enabled || !promo?.downloadUrl) {
      onContinue();
    }
  }, [open, promo, onContinue]);

  if (!open || !promo?.enabled || !promo?.downloadUrl) return null;

  const screenshots = (promo.screenshots || []).filter(Boolean);
  const intentLabel = intent === "download" ? "ডাউনলোড" : "মুভি দেখার";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-secondary/80 flex items-end sm:items-center justify-center"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: "100%", opacity: 0.6 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 32, stiffness: 320 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md bg-background rounded-t-[2rem] sm:rounded-[2rem] max-h-[92vh] overflow-y-auto relative shadow-premium"
        >
          {/* Drag handle */}
          <div className="sticky top-0 z-10 bg-background pt-3 pb-2 flex items-center justify-center">
            <div className="h-1.5 w-12 rounded-full bg-muted-foreground/30" />
            <button
              onClick={onClose}
              className="absolute right-3 top-2 grid h-9 w-9 place-items-center rounded-full bg-muted active:scale-95 transition"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>

          {/* Hero */}
          <div className="px-5 pt-2 pb-4 text-center">
            <motion.div
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 220, damping: 16 }}
              className="mx-auto mb-3 grid h-20 w-20 place-items-center rounded-[1.6rem] bg-gradient-primary shadow-premium overflow-hidden ring-4 ring-primary/10"
            >
              {promo.iconUrl ? (
                <img src={promo.iconUrl} alt={promo.appName || "App"} className="h-full w-full object-cover" />
              ) : (
                <Smartphone size={36} className="text-primary-foreground" />
              )}
            </motion.div>

            <div className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-[10px] font-extrabold text-accent-foreground font-bangla">
              <Sparkles size={11} /> Premium App Experience
            </div>

            <h2 className="mt-3 text-2xl font-black leading-tight tracking-tight">
              {promo.appName || "MOVIEPLEXBD App"}
            </h2>
            {promo.tagline && (
              <p className="mt-1 text-xs text-muted-foreground font-bangla">{promo.tagline}</p>
            )}

            <p className="mt-3 text-sm text-foreground/85 leading-relaxed font-bangla px-2">
              {promo.description ||
                `ওয়েবসাইট খুঁজে বের করার ঝামেলা থেকে মুক্তি পেতে আমাদের অ্যাপ ডাউনলোড করুন। দ্রুত ${intentLabel} জন্য এক ক্লিকেই সব মুভি!`}
            </p>
          </div>

          {/* Screenshots — fit all in one row, no scroll */}
          {screenshots.length > 0 && (
            <div className="px-5 pb-4">
              <div className="flex gap-2 justify-center rounded-3xl bg-muted p-2">
                {screenshots.slice(0, 4).map((url, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 * i, duration: 0.3 }}
                    className="flex-1 min-w-0 aspect-[9/19] rounded-2xl overflow-hidden bg-background border border-border shadow-sm"
                  >
                    <img
                      src={url}
                      alt={`Screenshot ${i + 1}`}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/placeholder.svg"; }}
                      className="h-full w-full object-cover"
                    />
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Benefits */}
          <div className="px-5 pb-4">
            <div className="mb-3 rounded-2xl border border-premium/30 bg-card p-3 text-left">
              <p className="text-[11px] font-extrabold leading-relaxed font-bangla text-foreground">
                সদ্য মুক্তি পাওয়া নতুন সকল মুভির বাংলা ডাবিং পেয়ে যান মাত্র ১০ টাকায় এক মাসের অ্যাক্সেস। মাত্র একটি চায়ের দামে! 🔥
              </p>
              <ul className="mt-2 space-y-1.5 text-[10.5px] font-semibold leading-tight text-muted-foreground font-bangla">
                {[
                  "সম্পূর্ণ বিজ্ঞাপনমুক্ত ওয়েবসাইট",
                  "ওয়েবসাইটেই রিলস দেখে মুভি সিলেকশন সুবিধা",
                  "এক ক্লিকে ডাউনলোড সুবিধা",
                  "সকল মুভির বাংলা ডাবিং",
                  "আনলিমিটেড মুভি কালেকশন",
                  "Animal, Spiderman, Avengers টাইপ মুভির বাংলা ডাবিং",
                ].map((text) => (
                  <li key={text} className="flex gap-1.5">
                    <Check size={11} className="mt-0.5 shrink-0 text-premium" strokeWidth={3} />
                    <span>{text}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { icon: Check, text: "এক ক্লিকে সব মুভি" },
                { icon: Wifi, text: "দ্রুত স্ট্রিমিং" },
                { icon: Download, text: "সহজ ডাউনলোড" },
                { icon: Bell, text: "নতুন মুভির খবর" },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="rounded-2xl border border-border bg-card p-3">
                  <span className="grid h-8 w-8 place-items-center rounded-xl bg-primary/10 text-primary">
                    <Icon size={15} strokeWidth={2.75} />
                  </span>
                  <p className="mt-2 text-[12px] font-extrabold leading-tight font-bangla">{text}</p>
                </div>
              ))}
            </div>
            <div className="mt-2 flex items-center gap-2 rounded-2xl bg-success/10 px-3 py-2 text-success">
              <ShieldCheck size={16} strokeWidth={2.5} />
              <span className="text-[11px] font-extrabold font-bangla">নিরাপদ অ্যাপ ডাউনলোড লিংক</span>
            </div>
          </div>

          {/* Meta */}
          {(promo.version || promo.sizeMb) && (
            <div className="px-5 pb-3 flex items-center justify-center gap-3 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
              {promo.version && <span>v{promo.version}</span>}
              {promo.version && promo.sizeMb && <span>·</span>}
              {promo.sizeMb && <span>{promo.sizeMb} MB</span>}
            </div>
          )}

          {/* CTA */}
          <div className="sticky bottom-0 bg-background px-5 pb-6 pt-3 border-t border-border safe-bottom space-y-2">
            <a
              href={promo.downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-primary py-4 text-sm font-extrabold text-primary-foreground shadow-premium active:scale-[0.98] transition"
            >
              <Download size={18} strokeWidth={2.5} />
              <span className="font-bangla">অ্যাপ ডাউনলোড করুন</span>
            </a>
            <button
              onClick={onContinue}
              className="w-full flex items-center justify-center gap-1 rounded-2xl bg-muted py-3 text-xs font-bold text-muted-foreground active:scale-[0.98] transition"
            >
              <span className="font-bangla">ওয়েবেই চালিয়ে যান</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
