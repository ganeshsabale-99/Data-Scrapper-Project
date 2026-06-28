import { useEffect } from "react";
import { useNavigate } from "react-router";
import { getUserCity, getUserState, isAuthenticated } from "@/lib/token";
import { GupioOverlayLoader } from "@/components/ui/gupio-loader";
import { CITY_TO_STATE_MAP } from "../dashboard/constants";
import { preloadMockTechParkDashboard } from "@/lib/dashboard-preload";

export function CityBasedRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    const redirectToCityPage = () => {
      if (isAuthenticated()) {
        void preloadMockTechParkDashboard();
        const userCity = getUserCity();
        if (!userCity) {
          navigate("/dashboard/city", { replace: true });
          return;
        }

        const city = userCity.trim();
        const userState = getUserState()?.trim();
        const inferredState = userState || CITY_TO_STATE_MAP[city.toLowerCase()];
        if (!inferredState) {
          navigate("/dashboard/city", { replace: true });
          return;
        }

        const cityParam = encodeURIComponent(city);
        const stateParam = encodeURIComponent(inferredState);

        navigate(`/dashboard/city/${stateParam}/${cityParam}`, { replace: true });
      } else {
        navigate("/login", { replace: true });
      }
    };

    redirectToCityPage();
  }, [navigate]);

  return <GupioOverlayLoader text="Redirecting to your city dashboard..." />;
}
