import { useEffect } from "react";
import { useNavigate } from "react-router";
import { getCityBasedLandingPage, isAuthenticated } from "@/lib/token";
import { GupioOverlayLoader } from "@/components/ui/gupio-loader";

export function RoleBasedRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    const redirectToLandingPage = () => {
      if (isAuthenticated()) {
        const landingPage = getCityBasedLandingPage();
        navigate(landingPage, { replace: true });
      } else {
        navigate("/login", { replace: true });
      }
    };

    redirectToLandingPage();
  }, [navigate]);

  return <GupioOverlayLoader text="Redirecting to your dashboard..." />;
} 