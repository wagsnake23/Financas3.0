import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Tables } from "@/integrations/supabase/types";
import { AppCategory } from "@/types/finance";

const UNSELECTED_VALUE = "unselected";

export const useExpenseData = (user: User | null, selectedParentCategoryId: string, enabled: boolean) => {
  const { data: fetchedCategories = [], isLoading: isLoadingCategories } = useQuery<AppCategory[]>({
    queryKey: ["categories", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("categorias")
        .select("*")
        .or(`user_id.eq.${user.id},user_id.is.null`)
        .order("nome");
      if (error) throw error;
      return data as AppCategory[];
    },
    enabled: enabled,
  });

  const allSubcategories = fetchedCategories;

  const { data: expenses = [], isLoading: isLoadingExpenses } = useQuery<Tables<'despesas'>[]>({
    queryKey: ["expenses", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("despesas")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: enabled,
  });

  const { data: expenseInstallments = [], isLoading: isLoadingInstallments } = useQuery<
    (Tables<'despesas_parcelas'> & { despesas: Pick<Tables<'despesas'>, 'categoria_id'> | null })[]
  >({
    queryKey: ["expenseInstallments", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("despesas_parcelas")
        .select("*, despesas(categoria_id, user_id)")
        .filter("despesas.user_id", "eq", user.id)
        .order("vencimento", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: enabled,
  });

  const isLoading = isLoadingCategories || isLoadingExpenses || isLoadingInstallments;

  return {
    allSubcategories,
    expenses,
    expenseInstallments,
    isLoading,
  };
};