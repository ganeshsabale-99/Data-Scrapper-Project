import { useEffect } from "react";
import { useNavigate } from "react-router";
import { getUserState, isAuthenticated } from "@/lib/token";
import { GupioOverlayLoader } from "@/components/ui/gupio-loader";

export function StateBasedRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    const redirectToStatePage = () => {
      if (isAuthenticated()) {
        const userState = getUserState();
        if (userState) {
          const stateParam = encodeURIComponent(userState);
          navigate(`/dashboard/state/${stateParam}`, { replace: true });
        } else {
          navigate("/dashboard/state", { replace: true });
        }
      } else {
        navigate("/login", { replace: true });
      }
    };

    redirectToStatePage();
  }, [navigate]);

  return <GupioOverlayLoader text="Redirecting to your state dashboard..." />;
}
