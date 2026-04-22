import { Link } from "react-router-dom";
import { Crown, LogOut, Shield, ChevronRight, Heart, History, Settings, HelpCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { motion } from "framer-motion";

export default function Profile() {
  const { user, profile, isAdmin, isPremium, logout } = useAuth();

  const expiry = profile?.subscriptionExpiry
    ? new Date(profile.subscriptionExpiry).toLocaleDateString()
    : null;

  return (
    <div className="space-y-5">
      <header className="safe-top px-4 pt-4 pb-2">
        <h1 className="text-xl font-extrabold">Profile</h1>
      </header>

      {/* Profile card */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="px-4">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-card p-4 shadow-card">
          <div className="flex items-center gap-3">
            {profile?.photoUrl ? (
              <img src={profile.photoUrl} alt="" className="h-16 w-16 rounded-full ring-2 ring-primary/30 object-cover" />
            ) : (
              <div className="h-16 w-16 rounded-full bg-primary/20 grid place-items-center text-xl font-bold text-primary">
                {(profile?.displayName || user.email || "?")[0].toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-bold truncate">{profile?.displayName || "User"}</h2>
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              <div className="mt-1.5 flex items-center gap-1.5">
                {isPremium ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-gradient-premium px-2 py-0.5 text-[10px] font-bold text-premium-foreground">
                    <Crown size={10} /> PREMIUM
                  </span>
                ) : profile?.subscriptionStatus === "pending" ? (
                  <span className="rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-bold text-accent-foreground">
                    PENDING APPROVAL
                  </span>
                ) : (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">FREE</span>
                )}
                {isAdmin && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold text-secondary-foreground">
                    <Shield size={10} /> ADMIN
                  </span>
                )}
              </div>
            </div>
          </div>

          {!isPremium && (
            <Link to="/subscribe" className="mt-4 flex items-center justify-between rounded-2xl bg-gradient-premium p-3 text-premium-foreground shadow-sm">
              <div>
                <p className="text-xs font-bold">Upgrade to Premium</p>
                <p className="text-[10px] opacity-90 font-bangla">মাত্র ৳১০ থেকে শুরু</p>
              </div>
              <Crown size={20} />
            </Link>
          )}
          {isPremium && expiry && (
            <p className="mt-3 text-[11px] text-muted-foreground">Premium valid until <span className="font-semibold text-foreground">{expiry}</span></p>
          )}
        </div>
      </motion.div>

      {/* Admin entry */}
      {isAdmin && (
        <div className="px-4">
          <Link to="/admin" className="flex items-center justify-between rounded-2xl bg-secondary p-4 text-secondary-foreground shadow-card">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/10">
                <Shield size={18} />
              </div>
              <div>
                <p className="text-sm font-bold">ADMIN PANEL</p>
                <p className="text-[11px] opacity-70">Manage everything</p>
              </div>
            </div>
            <ChevronRight size={18} />
          </Link>
        </div>
      )}

      {/* Menu */}
      <div className="px-4 space-y-2">
        <MenuItem icon={History} label="Watch History" to="/history" />
        <MenuItem icon={Heart} label="My Favorites" to="/favorites" />
        <MenuItem icon={Settings} label="Settings" to="/settings" />
        <MenuItem icon={HelpCircle} label="Help & Support" to="/help" />
      </div>

      <div className="px-4 pt-4">
        <button onClick={logout} className="w-full flex items-center justify-center gap-2 rounded-2xl border border-border bg-card py-3 text-sm font-bold text-destructive">
          <LogOut size={16} /> Sign Out
        </button>
        <p className="mt-4 text-center text-[10px] text-muted-foreground">MOVIEPLEXBD v1.0 · Made for Bangladesh 🇧🇩</p>
      </div>
    </div>
  );
}

function MenuItem({ icon: Icon, label, to }: { icon: any; label: string; to: string }) {
  return (
    <Link to={to} className="flex items-center justify-between rounded-2xl bg-card p-3.5 shadow-soft hover:shadow-card transition">
      <div className="flex items-center gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-muted">
          <Icon size={16} />
        </div>
        <span className="text-sm font-semibold">{label}</span>
      </div>
      <ChevronRight size={16} className="text-muted-foreground" />
    </Link>
  );
}
