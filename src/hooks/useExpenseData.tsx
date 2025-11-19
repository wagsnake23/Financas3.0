import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Tables } from "@/integrations/supabase/types";
import { AppCategory } from "@/types/finance";

const UNSELECTED_VALUE = "unselected";

export const useExpenseData = (user: User | null, selectedParentCategoryId: string) => {
  // Fetch ALL categories from Supabase (user-specific and default ones with user_id: null)
  const { data: fetchedCategories = [], isLoading: isLoadingCategories } = useQuery<AppCategory[]>({
    queryKey: ["categories", user?.id], // Unificado
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
    enabled: !!user?.id,
  });

  // Filter for root expense categories (parent_id is null and not 'receitas_e_investimentos')
  const rootExpenseCategories = useMemo(() => {
    return fetchedCategories.filter(cat => 
      cat.parent_id === null && cat.id !== 'receitas_e_investimentos'
    );
  }, [fetchedCategories]);

  // Filter for subcategories based on the selected parent category
  const filteredSubcategories = useMemo(() => {
    if (selectedParentCategoryId === UNSELECTED_VALUE || !selectedParentCategoryId) {
      return [];
    }
    return fetchedCategories.filter(cat => cat.parent_id === selectedParentCategoryId);
  }, [fetchedCategories, selectedParentCategoryId]);

  // Fetch despesas using Tanstack Query
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
      return data.filter(d => !d.is_fixed); // Filter out legacy fixed expenses
    },
    enabled: !!user?.id,
  });

  // Fetch despesas_parcelas using Tanstack Query
  const { data: expenseInstallments = [], isLoading: isLoadingInstallments } = useQuery<
    (Tables<'despesas_parcelas'> & { despesas: Pick<Tables<'despesas'>, 'categoria_id'> | null })[]
  >({
    queryKey: ["expenseInstallments", user?.id], // Unificado
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("despesas_parcelas")
        .select("*, despesas(categoria_id, user_id, is_fixed)")
        .filter("despesas.user_id", "eq", user.id)
        .order("vencimento", { ascending: true });
      if (error) throw error;
      return data.filter(p => !p.despesas?.is_fixed); // Filter out legacy fixed expenses
    },
    enabled: !!user?.id,
  });

  const isLoading = isLoadingCategories || isLoadingExpenses || isLoadingInstallments;

  return {
    fetchedCategories,
    rootExpenseCategories,
    filteredSubcategories,
    expenses,
    expenseInstallments,
    isLoading,
  };
};