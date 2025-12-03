import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export function usePendingShoppingItemsCount(user: User | null) {
  return useQuery({
    queryKey: ["shopping_items_pending_count", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      if (!user?.id) return 0;

      const { count, error } = await supabase
        .from("shopping_items")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("status", false); // apenas pendentes

      if (error) throw error;
      return count ?? 0;
    },
    staleTime: 60 * 1000, // 1 minuto
    refetchOnWindowFocus: false,
  });
}