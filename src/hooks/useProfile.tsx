import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useProfile = (userId: string | undefined) => {
  return useQuery({
    queryKey: ["profile", userId],
    queryFn: async () => {
      if (!userId) return null;
      const [profileRes, subRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
        supabase.from("subscriptions" as any).select("subscription_type, subscription_status, expires_at").eq("user_id", userId).maybeSingle()
      ]);
      
      console.log("================ DEBUG SUBSCRIPTIONS ================");
      console.log("USER_ID", userId);
      console.log("PROFILE", profileRes.data);
      console.log("SUBSCRIPTION", subRes.data);
      console.log("=====================================================");

      if (profileRes.error) throw profileRes.error;
      
      if (subRes.error) {
        console.error("Erro ao buscar subscription separadamente:", subRes.error);
      }
      
      const subscriptions = (subRes.data as any) || null;
      let isExpired = false;
      
      if (subscriptions) {
        const type = subscriptions.subscription_type || 'trial';
        isExpired = subscriptions.subscription_status === 'expired' || 
          (type === 'trial' && subscriptions.expires_at && new Date(subscriptions.expires_at) < new Date());
      }

      return {
        ...profileRes.data,
        subscriptions,
        isExpired
      } as any;
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // Cache por 5 minutos para evitar refetches desnecessários
  });
};
