import { Suspense, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Navigation } from "./Navigation";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { ProfileSubscriptionModal } from "@/components/profile/ProfileSubscriptionModal";

export const AppLayout = () => {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const { data: profile } = useProfile(user?.id);
  const sub = profile?.subscriptions;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <>
      <Navigation />
      <main>
        <Suspense fallback={null}>
          <Outlet />
        </Suspense>
      </main>
      
      {/* Modal Global de Assinatura */}
      <ProfileSubscriptionModal 
        currentPlanId={sub?.subscription_type} 
        subscriptionStatus={sub?.subscription_status === 'blocked' ? 'blocked' : (profile?.isExpired ? 'expired' : sub?.subscription_status)}
        expiresAt={sub?.expires_at}
        hideTrigger={true}
      />
    </>
  );
};
