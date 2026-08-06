import { useEffect, useState } from "react";
import { createBrowserRouter, RouterProvider } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { Routes } from "./routes/AppRoutes";
import { SplashScreen } from "./components/ui/splash-screen";
import { AppRuntimeErrorBoundary } from "./components/AppRuntimeErrorBoundary";
import { GupioOverlayLoader } from "./components/ui/gupio-loader";
import { useGlobalApiLoader } from "./hooks/use-global-api-loader";
import { preloadMockTechParkDashboard } from "./lib/dashboard-preload";
import { refreshUserAccess } from "./lib/auth";

const USER_ACCESS_REFRESH_INTERVAL_MS = 3 * 60 * 1000;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const router = createBrowserRouter(Routes);

export function App() {
  const [isLoading, setIsLoading] = useState(true);
  const { isLoading: isApiLoading } = useGlobalApiLoader();
  const parsedSplashDelay = Number.parseInt(
    import.meta.env.VITE_SPLASH_DELAY_MS ?? "120",
    10,
  );
  const splashDelayMs =
    Number.isFinite(parsedSplashDelay) && parsedSplashDelay >= 0
      ? parsedSplashDelay
      : 120;

  useEffect(() => {
    void preloadMockTechParkDashboard();

    const timer = setTimeout(() => {
      setIsLoading(false);
    }, splashDelayMs);

    return () => clearTimeout(timer);
  }, [splashDelayMs]);

  useEffect(() => {
    // Keeps a logged-in user's cached role/permissions in sync with RBAC changes
    // an admin makes elsewhere, without requiring this user to log out and back in.
    void refreshUserAccess();
    const interval = setInterval(() => void refreshUserAccess(), USER_ACCESS_REFRESH_INTERVAL_MS);
    const onFocus = () => void refreshUserAccess();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  if (isLoading) {
    return <SplashScreen />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AppRuntimeErrorBoundary>
        <RouterProvider router={router} />
        {isApiLoading ? <GupioOverlayLoader text="Please wait..." /> : null}
      </AppRuntimeErrorBoundary>
      <Toaster position="top-right" />
    </QueryClientProvider>
  );
}
