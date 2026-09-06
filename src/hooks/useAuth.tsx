import { createContext, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log("AuthProvider: Initializing auth listener...");
    
    const updateAuthState = (newSession: Session | null) => {
      setSession((prev) => prev?.access_token === newSession?.access_token ? prev : newSession);
      setUser((prev) => {
        const newUser = newSession?.user ?? null;
        return prev?.id === newUser?.id ? prev : newUser;
      });
      setLoading((prev) => (prev === false ? prev : false));
    };

    // First, check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log("AuthProvider: getSession result - Session:", session);
      updateAuthState(session);
    });

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log("AuthProvider: Auth state changed - Event:", event, "Session:", session);
        updateAuthState(session);
      }
    );

    return () => {
      console.log("AuthProvider: Unsubscribing from auth listener.");
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  console.log("AuthProvider: Current state - User:", user?.id, "Loading:", loading);

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
