import { motion } from "framer-motion";
import { LayoutDashboard, Film, CreditCard, Users, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

export type AdminTab =
  | "dashboard"
  | "analytics"
  | "movies"
  | "banners"
  | "subs"
  | "users"
  | "reels"
  | "actors"
  | "requests"
  | "apppromo"
  | "update"
  | "master";

interface Props {
  active: AdminTab;
  onChange: (t: AdminTab) => void;
  pendingSubs?: number;
  pendingRequests?: number;
}

export function AdminBottomNav({ active, onChange, pendingSubs = 0, pendingRequests = 0 }: Props) {
  const tabs: { key: AdminTab; icon: any; label: string; badge?: number }[] = [
    { key: "dashboard", icon: LayoutDashboard, label: "Home" },
    { key: "movies", icon: Film, label: "Movies" },
    { key: "subs", icon: CreditCard, label: "Subs", badge: pendingSubs },
    { key: "users", icon: Users, label: "Users" },
    { key: "master", icon: Shield, label: "Master" },
  ];

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 glass border-t border-border safe-bottom">
      <div className="mx-auto max-w-md grid grid-cols-5">
        {tabs.map(({ key, icon: Icon, label, badge }) => {
          const isActive = active === key;
          return (
            <button
              key={key}
              onClick={() => onChange(key)}
              className={cn(
                "relative flex flex-col items-center justify-center py-2.5 gap-0.5 text-[10px] font-medium transition-colors",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="adminNavPill"
                  className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-primary"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <div className="relative">
                <Icon size={22} strokeWidth={isActive ? 2.4 : 2} />
                {badge && badge > 0 ? (
                  <span className="absolute -top-1.5 -right-2 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[9px] font-extrabold text-destructive-foreground tabular-nums">
                    {badge > 9 ? "9+" : badge}
                  </span>
                ) : null}
              </div>
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
