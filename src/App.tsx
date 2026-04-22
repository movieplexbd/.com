import { lazy, Suspense, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AppShell } from "@/components/AppShell";
import Home from "./pages/Home";

// Lazy-load non-initial routes to shrink the entry bundle and improve FCP/LCP.
const Search = lazy(() => import("./pages/Search"));
const Movies = lazy(() => import("./pages/Movies"));
const Shorts = lazy(() => import("./pages/Shorts"));
const Profile = lazy(() => import("./pages/Profile"));
const Login = lazy(() => import("./pages/Login"));
const MovieDetail = lazy(() => import("./pages/MovieDetail"));
const LockScreen = lazy(() => import("./pages/LockScreen"));
const Subscribe = lazy(() => import("./pages/Subscribe"));
const Watch = lazy(() => import("./pages/Watch"));
const Admin = lazy(() => import("./pages/Admin"));
const Actor = lazy(() => import("./pages/Actor"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Prefetch the routes a user is most likely to hit next while the browser is
// idle. Eliminates the chunk-download wait on first navigation.
const prefetchRoutes = () => {
  const idle = (window as any).requestIdleCallback || ((cb: any) => setTimeout(cb, 200));
  idle(() => {
    import("./pages/Search");
    import("./pages/Movies");
    import("./pages/MovieDetail");
    import("./pages/Profile");
    import("./pages/Login");
    import("./pages/Shorts");
    import("./pages/Subscribe");
    import("./pages/Watch");
  });
};

const queryClient = new QueryClient();

const RouteFallback = () => (
  <div className="min-h-screen bg-background" aria-hidden="true" />
);

const RoutePrefetcher = () => {
  useEffect(() => { prefetchRoutes(); }, []);
  return null;
};

const RequireAuth = ({ children }: { children: JSX.Element }) => {
  const { user, loading } = useAuth();
  if (loading) return <RouteFallback />;
  return user ? children : <Navigate to="/login" replace state={{ from: "/profile" }} />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <RoutePrefetcher />
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route element={<AppShell />}>
                <Route path="/" element={<Home />} />
                <Route path="/search" element={<Search />} />
                <Route path="/movies" element={<Movies />} />
                <Route path="/shorts" element={<Shorts />} />
                <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
                <Route path="/movie/:id" element={<MovieDetail />} />
                <Route path="/actor/:id" element={<Actor />} />
                <Route path="/lock/:id" element={<LockScreen />} />
                <Route path="/subscribe" element={<Subscribe />} />
                <Route path="/watch/:id" element={<Watch />} />
                <Route path="/favorites" element={<Navigate to="/profile" replace />} />
                <Route path="/history" element={<Navigate to="/profile" replace />} />
                <Route path="/settings" element={<Navigate to="/profile" replace />} />
                <Route path="/help" element={<Navigate to="/profile" replace />} />
              </Route>
              <Route path="/login" element={<Login />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
