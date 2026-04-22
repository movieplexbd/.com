import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { onAuthStateChanged, signInWithPopup, signOut, User } from "firebase/auth";
import { ref, get, set, update, onValue, off } from "firebase/database";
import { auth, db, googleProvider, isAdminEmail } from "@/lib/firebase";
import { getDeviceId } from "@/lib/utils";
import type { UserProfile } from "@/lib/types";

interface AuthCtx {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  isPremium: boolean;
  signInGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const profileUnsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);

      // Tear down any existing profile listener when auth changes
      if (profileUnsubRef.current) {
        profileUnsubRef.current();
        profileUnsubRef.current = null;
      }

      if (u) {
        const userRef = ref(db, `users/${u.uid}`);
        const snap = await get(userRef);
        const now = Date.now();
        const deviceId = getDeviceId();

        if (!snap.exists()) {
          const newProfile: UserProfile = {
            uid: u.uid,
            email: u.email || "",
            displayName: u.displayName || "",
            photoUrl: u.photoURL || "",
            role: isAdminEmail(u.email) ? "admin" : "user",
            subscriptionStatus: "free",
            subscriptionPlan: "none",
            joinedAt: now,
            lastLogin: now,
            deviceCount: 1,
          };
          await set(userRef, newProfile);
        } else {
          await update(userRef, { lastLogin: now });
        }

        // Real-time profile listener — keeps subscription state in sync
        // so admin approve/reject and auto-expiry are reflected immediately.
        const handler = onValue(userRef, async (s) => {
          const p = s.val() as UserProfile | null;
          if (!p) { setProfile(null); return; }
          // Auto-expire premium if expiry passed
          if (
            p.subscriptionStatus === "premium" &&
            p.subscriptionExpiry &&
            p.subscriptionExpiry < Date.now()
          ) {
            const expired: Partial<UserProfile> = {
              subscriptionStatus: "free",
              subscriptionPlan: "none",
              subscriptionExpiry: 0,
              subscriptionProvisional: false,
            };
            try {
              await update(userRef, expired);
              await update(ref(db, `subscriptions/${u.uid}`), { status: "EXPIRED" });
            } catch {/* ignore */}
            setProfile({ ...p, ...expired });
          } else {
            setProfile(p);
          }
        });
        profileUnsubRef.current = () => off(userRef, "value", handler);

        // device tracking
        await set(ref(db, `devices/${u.uid}/${deviceId}`), {
          model: navigator.userAgent.slice(0, 80),
          loginAt: now,
          lastActive: now,
        });
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return () => {
      if (profileUnsubRef.current) profileUnsubRef.current();
      unsub();
    };
  }, []);

  const isAdmin = !!user && (isAdminEmail(user.email) || profile?.role === "admin");
  const isPremium =
    !!profile &&
    profile.subscriptionStatus === "premium" &&
    !!profile.subscriptionExpiry &&
    profile.subscriptionExpiry > Date.now();

  const signInGoogle = async () => {
    await signInWithPopup(auth, googleProvider);
  };
  const logout = async () => {
    await signOut(auth);
  };

  return (
    <Ctx.Provider value={{ user, profile, loading, isAdmin, isPremium, signInGoogle, logout }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth outside provider");
  return c;
};
