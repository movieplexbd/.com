import { NavLink, useLocation } from "react-router-dom";
import { Home, Search, Film, Clapperboard, User } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const tabs = [
  { to: "/", icon: Home, label: "Home" },
  { to: "/search", icon: Search, label: "Search" },
  { to: "/movies", icon: Film, label: "Movies" },
  { to: "/shorts", icon: Clapperboard, label: "Shorts" },
  { to: "/profile", icon: User, label: "Profile" },
];

export function BottomNav() {
  const loc = useLocation();
  // hide on player + admin internal routes
  if (loc.pathname.startsWith("/watch/") || loc.pathname.startsWith("/admin")) return null;

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 glass border-t border-border safe-bottom">
      <div className="mx-auto max-w-md grid grid-cols-5">
        {tabs.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              cn(
                "relative flex flex-col items-center justify-center py-2.5 gap-0.5 text-[10px] font-medium transition-colors",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.div
                    layoutId="navPill"
                    className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-primary"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <Icon size={22} strokeWidth={isActive ? 2.4 : 2} />
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
