import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useProfile = (userId: string | undefined) => {
  return useQuery({
    queryKey: ["profile", userId],
    queryFn: async () => {
      if (!userId) return null;
      const [profileRes, subRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
        supabase.from("subscriptions" as any).select("subscription_type, subscription_status, payment_status, expires_at").eq("user_id", userId).maybeSingle()
      ]);

      if (profileRes.error) throw profileRes.error;
      
      if (subRes.error) {
        console.error("Erro ao buscar subscription separadamente:", subRes.error);
      }
      
      const subscriptions = (subRes.data as any) || null;
      let isExpired = false;
      let hasActiveSubscription = false;
      
      if (subscriptions) {
        const type = subscriptions.subscription_type || 'trial';
        const isTrial = type === 'trial';
        const trialExpired = isTrial && subscriptions.expires_at && new Date(subscriptions.expires_at) < new Date();
        
        hasActiveSubscription = subscriptions.subscription_status === "active" && subscriptions.payment_status === "approved";
        
        // Se for plano Premium/Lifetime, só libera se a assinatura estiver ativa E aprovada.
        // Se estiver pendente, expirada, cancelada etc., o usuário fica bloqueado (isExpired = true),
        // a não ser que ainda estivesse num trial válido (mas isso não ocorre se a role já mudou no banco).
        if (!hasActiveSubscription) {
          if (isTrial && trialExpired) {
             isExpired = true;
          } else if (!isTrial) {
             isExpired = true;
          }
        }
      }

      return {
        ...profileRes.data,
        subscriptions,
        isExpired,
        hasActiveSubscription
      } as any;
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // Cache por 5 minutos para evitar refetches desnecessários
  });
};
