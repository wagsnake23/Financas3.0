import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Tables } from "@/integrations/supabase/types";
import { useCategories } from "@/hooks/useCategories";

const UNSELECTED_VALUE = "unselected";

export const useExpenseData = (user: User | null, selectedParentCategoryId: string, enabled: boolean) => {
  const { data: rawCategories = [], isLoading: isLoadingCategories } = useCategories(user?.id);

  const fetchedCategories = useMemo(() => {
    return rawCategories.map(cat => {
      if (cat.id === "familia_filhos") {
        return { ...cat, nome: "Família" };
      }
      return cat;
    });
  }, [rawCategories]);

  const allSubcategories = fetchedCategories;

  const { data: expenses = [], isLoading: isLoadingExpenses } = useQuery<Tables<'despesas'>[]>({
    queryKey: ["expenses", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("despesas")
        .select("*")
        .eq("user_id", user.id)
        .order("data_competencia", { ascending: false });
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
