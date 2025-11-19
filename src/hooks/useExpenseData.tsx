import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Tables } from "@/integrations/supabase/types";
import { AppCategory } from "@/types/finance";

const UNSELECTED_VALUE = "unselected";

export const useExpenseData = (user: User | null, selectedParentCategoryId: string, enabled: boolean) => { // Adicionado 'enabled'
  // Fetch ALL categories from Supabase (user-specific and default ones with user_id: null)
  // Modificado para buscar APENAS SUBCATEGORIAS (parent_id IS NOT NULL)
  const { data: fetchedCategories = [], isLoading: isLoadingCategories } = useQuery<AppCategory[]>({
    queryKey: ["categories", user?.id], // Unificado
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("categorias")
        .select("*")
        .or(`user_id.eq.${user.id},user_id.is.null`)
        .not("parent_id", "is", null) // APENAS SUBCATEGORIAS
        .order("nome");
      if (error) throw error;
      return data as AppCategory[];
    },
    enabled: enabled, // Usar o parâmetro 'enabled'
  });

  // rootExpenseCategories e filteredSubcategories se tornam redundantes ou precisam ser reavaliados
  // Como agora só buscamos subcategorias, 'fetchedCategories' JÁ SÃO as subcategorias.
  // O 'selectedParentCategoryId' não será mais usado para filtrar subcategorias, mas sim para
  // pré-selecionar a categoria pai da subcategoria, se necessário, ou apenas para contexto.
  const allSubcategories = fetchedCategories;

  // O 'selectedParentCategoryId' não será mais usado para filtrar a lista de subcategorias,
  // mas pode ser útil para outras lógicas ou para preencher o formulário de edição.
  // Por enquanto, vamos manter a prop, mas ela não filtrará a lista de subcategorias aqui.

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
    enabled: enabled,
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
    enabled: enabled,
  });

  const isLoading = isLoadingCategories || isLoadingExpenses || isLoadingInstallments;

  return {
    allSubcategories, // Renomeado para clareza
    expenses,
    expenseInstallments,
    isLoading,
  };
};