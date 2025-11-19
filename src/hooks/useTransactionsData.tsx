import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Tables } from "@/integrations/supabase/types";
import { AppCategory, Transaction } from "@/types/finance";
import { useRecurringEntries, MaterializedRecurringTransaction } from "@/hooks/useRecurringEntries";
import { format, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";

const isValidUuid = (uuid: string) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

interface UseTransactionsDataProps {
  user: User | null;
  selectedMonth: Date; // Mantido para useRecurringEntries
}

export const useTransactionsData = ({ user, selectedMonth }: UseTransactionsDataProps) => {
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
    enabled: !!user?.id,
  });

  const { materializedRecurringTransactions, isLoading: isLoadingRecurring } = useRecurringEntries(user, selectedMonth, fetchedCategories);
  console.log("useTransactionsData: materializedRecurringTransactions from hook:", materializedRecurringTransactions);

  const { data: revenues = [], isLoading: isLoadingRevenues } = useQuery<Tables<'receitas'>[]>({
    queryKey: ["revenues", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("receitas")
        .select("*, is_fixed, recurrence_frequency, recurrence_installments_count, status")
        .eq("user_id", user.id)
        .order("data", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: expenseInstallments = [], isLoading: isLoadingExpenses } = useQuery<
    (Tables<'despesas_parcelas'> & { despesas: Pick<Tables<'despesas'>, 'id' | 'categoria_id' | 'user_id' | 'descricao' | 'forma_pagamento' | 'tipo_pagamento' | 'cartao_id' | 'is_fixed' | 'recurrence_frequency' | 'recurrence_installments_count'> | null })[]
  >({
    queryKey: ["expenseInstallments", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("despesas_parcelas")
        .select("*, despesas(id, categoria_id, user_id, descricao, forma_pagamento, tipo_pagamento, cartao_id, is_fixed, recurrence_frequency, recurrence_installments_count)")
        .filter("despesas.user_id", "eq", user.id)
        .order("vencimento", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: cartoes = [], isLoading: isLoadingCartoes } = useQuery<Tables<'cartoes'>[]>({
    queryKey: ["cartoes", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("cartoes")
        .select("*")
        .eq("user_id", user.id)
        .order("nome");
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const allRawTransactions: Transaction[] = useMemo(() => {
    console.log("allRawTransactions useMemo re-running...");
    const incomeTransactions: Transaction[] = [];

    revenues.forEach(r => {
      incomeTransactions.push({
        id: r.id,
        type: "income",
        amount: r.valor,
        date: r.data,
        category: r.tipo_receita_id || "receitas_e_investimentos_extras",
        description: r.descricao || "Receita",
        status: r.status,
        is_fixed: r.is_fixed,
        recurrence_frequency: r.recurrence_frequency,
        recurrence_installments_count: r.recurrence_installments_count,
        forma_pagamento: null,
        cartao_id: null,
      });
    });

    const expenseTransactions: Transaction[] = [];
    const processedFixedExpenseParentIds = new Set<string>();

    const totalInstallmentsMap = new Map<string, number>();
    expenseInstallments.forEach(p => {
      if (p.despesas) {
        const despesaId = p.despesas.id;
        totalInstallmentsMap.set(despesaId, (totalInstallmentsMap.get(despesaId) || 0) + 1);
      }
    });

    expenseInstallments.forEach(p => {
      const parentDespesa = p.despesas;

      const despesaId = parentDespesa?.id;
      const totalForNonFixed = despesaId ? totalInstallmentsMap.get(despesaId) : 1;
      expenseTransactions.push({
        id: p.id,
        type: "expense",
        amount: p.valor_parcela,
        date: p.vencimento,
        category: parentDespesa?.categoria_id || "outros_diversos",
        description: parentDespesa?.descricao || "Despesa",
        status: p.pago ? 'Recebida' : 'Pendente',
        is_fixed: parentDespesa?.is_fixed || false,
        recurrence_frequency: parentDespesa?.recurrence_frequency,
        recurrence_installments_count: parentDespesa?.recurrence_installments_count,
        installmentNumber: p.numero_parcela,
        totalInstallments: totalForNonFixed,
        forma_pagamento: parentDespesa?.forma_pagamento,
        cartao_id: parentDespesa?.cartao_id,
      });
    });

    console.log("useTransactionsData: Income transactions count:", incomeTransactions.length);
    console.log("useTransactionsData: Expense transactions count:", expenseTransactions.length);
    console.log("useTransactionsData: Materialized Recurring transactions count:", materializedRecurringTransactions.length);
    console.log("useTransactionsData: Combined allRawTransactions count:", [...incomeTransactions, ...expenseTransactions, ...materializedRecurringTransactions].length);
    
    return [...incomeTransactions, ...expenseTransactions, ...materializedRecurringTransactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [revenues, expenseInstallments, materializedRecurringTransactions]);

  const monthlyFilteredTransactions = useMemo(() => {
    console.log("monthlyFilteredTransactions useMemo re-running...");
    const startOfSelectedMonth = startOfMonth(selectedMonth);
    const endOfSelectedMonth = endOfMonth(selectedMonth);

    const filtered = allRawTransactions.filter(t => {
      const transactionDate = new Date(t.date);
      const isWithin = isWithinInterval(transactionDate, { start: startOfSelectedMonth, end: endOfSelectedMonth });
      return isWithin;
    });
    console.log("useTransactionsData: monthlyFilteredTransactions (after date filter) count:", filtered.length);
    return filtered;
  }, [allRawTransactions, selectedMonth]);

  const isLoading = isLoadingRevenues || isLoadingExpenses || isLoadingCategories || isLoadingCartoes || isLoadingRecurring;

  return {
    allRawTransactions,
    monthlyFilteredTransactions, // Retornando as transações filtradas pelo mês
    fetchedCategories,
    cartoes,
    expenseInstallments,
    isLoading,
    isLoadingCategories,
  };
};