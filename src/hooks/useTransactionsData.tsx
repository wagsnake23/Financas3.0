import { useMemo, useRef } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Tables } from "@/integrations/supabase/types";
import { AppCategory, Transaction } from "@/types/finance";
import { format, startOfMonth, endOfMonth, isWithinInterval, addMonths } from "date-fns";
import { isValidUuid } from "@/lib/utils";

interface UseTransactionsDataProps {
  user: User | null;
  selectedMonth: Date;
  enabled: boolean;
}

export const useTransactionsData = ({ user, selectedMonth, enabled }: UseTransactionsDataProps) => {
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

      // Normalização: Garante que "Família e Filhos" seja exibido sempre como "Família"
      const normalizedData = (data as AppCategory[]).map(cat => {
        if (cat.id === "familia_filhos") {
          return { ...cat, nome: "Família" };
        }
        return cat;
      });

      return normalizedData;
    },
    enabled: enabled,
    placeholderData: keepPreviousData,
  });

  const { data: revenues = [], isLoading: isLoadingRevenues, isPlaceholderData: isPlaceholderRevenues } = useQuery<Tables<'receitas'>[]>({
    queryKey: ["revenues", user?.id, format(selectedMonth, 'yyyy-MM')],
    queryFn: async () => {
      if (!user?.id) return [];

      const startOfMonthStr = format(startOfMonth(selectedMonth), "yyyy-MM-01");
      const nextMonthStr = format(addMonths(startOfMonth(selectedMonth), 1), "yyyy-MM-01");

      const { data, error } = await supabase
        .from("receitas")
        .select("*, status, is_recurring_master, recurrence_id, recurrence_day")
        .eq("user_id", user.id)
        .gte("data", startOfMonthStr)
        .lt("data", nextMonthStr)
        .order("data", { ascending: false });
      if (error) throw error;
      return data.filter(r => r.data !== '1900-01-01');
    },
    enabled: enabled,
    placeholderData: keepPreviousData,
  });

  const { data: expenseInstallments = [], isLoading: isLoadingExpenses, isPlaceholderData: isPlaceholderExpenses } = useQuery<
    (Tables<'despesas_parcelas'> & { despesas: Pick<Tables<'despesas'>, 'id' | 'categoria_id' | 'user_id' | 'descricao' | 'forma_pagamento' | 'tipo_pagamento' | 'cartao_id' | 'is_recurring_master' | 'numero_parcelas' | 'valor_total'> | null })[]
  >({
    queryKey: ["expenseInstallments", user?.id, format(selectedMonth, 'yyyy-MM')],
    queryFn: async () => {
      if (!user?.id) return [];

      const startOfMonthStr = format(startOfMonth(selectedMonth), "yyyy-MM-01");
      const nextMonthStr = format(addMonths(startOfMonth(selectedMonth), 1), "yyyy-MM-01");

      const { data, error } = await supabase
        .from("despesas_parcelas")
        .select("*, despesas(id, categoria_id, user_id, descricao, forma_pagamento, tipo_pagamento, cartao_id, is_recurring_master, numero_parcelas, valor_total)")
        .filter("despesas.user_id", "eq", user.id)
        .gte("vencimento", startOfMonthStr)
        .lt("vencimento", nextMonthStr)
        .order("vencimento", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: enabled,
    placeholderData: keepPreviousData,
  });

  const { data: cartoes = [], isLoading: isLoadingCartoes, refetch: refetchCartoes } = useQuery<Tables<'cartoes'>[]>({
    queryKey: ["cartoes", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("cartoes")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: enabled,
    placeholderData: keepPreviousData,
  });

  // Removido totalInstallmentsMap pois agora buscamos numero_parcelas da despesa mestre


  // Use a ref to store the last stable filtered results to prevent flickering
  // during month changes when query data is placeholder (from previous month).
  const lastStableTransactions = useMemo(() => {
    if (!enabled) return [];

    const isPlaceholder = isPlaceholderRevenues || isPlaceholderExpenses;

    // Calculate current filtered transactions based on selectedMonth
    const startOfSelectedMonth = startOfMonth(selectedMonth);
    const startStr = format(startOfSelectedMonth, "yyyy-MM-01");
    const nextMonthStr = format(addMonths(startOfSelectedMonth, 1), "yyyy-MM-01");

    const monthlyIncomeTransactions: Transaction[] = revenues
      .filter(r => {
        const dateStr = r.data.substring(0, 10);
        return dateStr >= startStr && dateStr < nextMonthStr;
      })
      .map(r => ({
        id: r.id,
        type: "income",
        amount: r.valor,
        date: r.data,
        category: r.tipo_receita_id || "receitas_e_investimentos_extras",
        description: r.descricao || "Receita",
        status: r.status,
        forma_pagamento: null,
        cartao_id: null,
        is_recurring_master: Boolean(r.is_recurring_master),
        recurrence_id: r.recurrence_id ?? null,
        recurrence_day: r.recurrence_day ?? null,
        tipo_pagamento: (r.is_recurring_master || !!r.recurrence_id) ? "fixo" : "avista",
        paymentTimestamp: r.status === "Recebida" ? r.updated_at : null,
        created_at: r.created_at,
      }));

    const monthlyExpenseTransactions: Transaction[] = expenseInstallments
      .filter(p => {
        const dateStr = p.vencimento.substring(0, 10);
        return dateStr >= startStr && dateStr < nextMonthStr;
      })
      .map(p => {
        const parentDespesa = p.despesas;
        return {
          id: p.id,
          type: "expense",
          amount: p.valor_parcela,
          date: p.vencimento,
          category: parentDespesa?.categoria_id || "outros_diversos",
          description: parentDespesa?.descricao || "Despesa",
          status: p.pago ? 'Recebida' : 'Pendente',
          installmentNumber: p.numero_parcela,
          totalInstallments: parentDespesa?.numero_parcelas || 1,
          forma_pagamento: parentDespesa?.forma_pagamento,
          cartao_id: parentDespesa?.cartao_id,
          despesa_id: parentDespesa?.id,
          is_recurring_master: Boolean(parentDespesa?.is_recurring_master),
          recurrence_id: parentDespesa?.id ?? null,
          recurrence_day: null,
          tipo_pagamento: parentDespesa?.tipo_pagamento as "avista" | "parcelado" | "fixo",
          paymentTimestamp: p.data_pagamento,
          created_at: p.created_at,
        } as Transaction;
      });

    const combined = [...monthlyIncomeTransactions, ...monthlyExpenseTransactions].sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return dateA !== dateB ? dateB - dateA : a.id.localeCompare(b.id);
    });

    return combined;
  }, [selectedMonth, revenues, expenseInstallments, enabled, isPlaceholderRevenues, isPlaceholderExpenses]);

  // Handle stability: avoid clearing the list while placeholder data is active
  const stableResultsRef = useRef<Transaction[]>([]);
  const lastSelectedMonthRef = useRef("");
  const currentMonthKey = format(selectedMonth, 'yyyy-MM');

  const finalTransactions = useMemo(() => {
    const isPlaceholder = isPlaceholderRevenues || isPlaceholderExpenses;

    // If it's NOT a placeholder, we definitely update our stable reference
    if (!isPlaceholder) {
      stableResultsRef.current = lastStableTransactions;
      lastSelectedMonthRef.current = currentMonthKey;
      return lastStableTransactions;
    }

    // If it IS a placeholder, we check if our last stable data was for the current month
    if (lastSelectedMonthRef.current === currentMonthKey) {
      return stableResultsRef.current;
    }

    // If it's a placeholder AND the month changed, we keep the previous month's data 
    // to avoid showing a blank list while loading.
    return stableResultsRef.current;
  }, [lastStableTransactions, isPlaceholderRevenues, isPlaceholderExpenses, currentMonthKey]);

  const isLoading = (isLoadingRevenues || isLoadingExpenses || isLoadingCategories || isLoadingCartoes) &&
    revenues.length === 0 && expenseInstallments.length === 0;

  const isFetching = isLoadingRevenues || isLoadingExpenses || isPlaceholderRevenues || isPlaceholderExpenses;

  return {
    monthlyFilteredTransactions: finalTransactions,
    fetchedCategories,
    cartoes,
    isLoading,
    isFetching,
    isLoadingCategories,
    refetchCartoes,
  };
};