import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

/**
 * Remove a Splash Screen institucional com fade-out suave.
 * Chamada quando o React está pronto (auth resolvida, rota decidida).
 */
function dismissSplashScreen() {
  const splash = document.getElementById("splash-screen");
  if (!splash) return;
  splash.style.opacity = "0";
  splash.style.pointerEvents = "none";
  setTimeout(() => splash.remove(), 400);
}

export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        navigate("/auth");
      }
      // Auth resolvida → app pronto → remover splash screen
      dismissSplashScreen();
    }
  }, [user, loading, navigate]);

  if (loading) {
    // Splash screen cobre tudo — não precisamos renderizar nada visível aqui
    return null;
  }

  return user ? <>{children}</> : null;
};
