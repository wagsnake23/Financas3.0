import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading) {
      // Remove a classe temporária do PWA quando o React assumir
      document.documentElement.classList.remove('pwa-mobile-loading');
      
      if (!user) {
        navigate("/auth");
      }
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="pwa-auth-loading-text animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  return user ? <>{children}</> : null;
};
