import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppCategory } from "@/types/finance";

export function useCategories(userId: string | undefined) {
  return useQuery<AppCategory[]>({
    queryKey: ["categories", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("categorias")
        .select("*")
        .or(`user_id.eq.${userId},user_id.is.null`)
        .order("nome");
      
      if (error) throw error;
      return data as AppCategory[];
    },
    enabled: !!userId,
  });
}
