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
