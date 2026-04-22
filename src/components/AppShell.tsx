import { Outlet, useLocation } from "react-router-dom";
import { BottomNav } from "./BottomNav";

export function AppShell() {
  const loc = useLocation();
  const isFull = loc.pathname.startsWith("/watch/");
  return (
    <div className="mx-auto max-w-md min-h-screen bg-background relative">
      <main className={isFull ? "" : "pb-20"}>
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
