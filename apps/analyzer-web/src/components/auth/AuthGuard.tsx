import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { isAuthenticated } from "@/lib/auth";
import { GupioOverlayLoader } from "@/components/ui/gupio-loader";

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = () => {
      if (!isAuthenticated()) {
        navigate("/login");
        return;
      }
      setIsLoading(false);
    };

    checkAuth();
  }, [navigate]);

  if (isLoading) {
    return <GupioOverlayLoader text="Verifying authentication..." />;
  }

  return <>{children}</>;
} 