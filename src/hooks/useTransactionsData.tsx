import { useMemo } from "react";
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
  selectedMonth: Date;
  enabled: boolean; // Adicionado 'enabled'
}

export const useTransactionsData = ({ user, selectedMonth, enabled }: UseTransactionsDataProps) => { // Adicionado 'enabled'
  // Modificado para buscar APENAS SUBCATEGORIAS (parent_id IS NOT NULL)
  const { data: fetchedCategories = [], isLoading: isLoadingCategories } = useQuery<AppCategory[]>({
    queryKey: ["categories", user?.id],
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

  const { materializedRecurringTransactions, isLoading: isLoadingRecurring } = useRecurringEntries(user, selectedMonth, fetchedCategories, enabled); // Passando 'enabled'
  console.log("useTransactionsData: materializedRecurringTransactions from hook:", materializedRecurringTransactions); // Corrigido o erro de digitação

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
      return data.filter(r => !r.is_fixed); // Filtrar receitas fixas legadas
    },
    enabled: enabled, // Usar o parâmetro 'enabled'
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
      console.log("useTransactionsData: Raw expenseInstallments fetched:", data.map(p => ({ id: p.id, despesa_id: p.despesas?.id, forma_pagamento: p.despesas?.forma_pagamento, cartao_id: p.despesas?.cartao_id }))); // LOG ADICIONADO
      return data.filter(p => !p.despesas?.is_fixed); // Filtrar despesas fixas legadas
    },
    enabled: enabled, // Usar o parâmetro 'enabled'
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
    enabled: enabled, // Usar o parâmetro 'enabled'
  });

  // Map to store total installments for each parent expense (used for `totalInstallments` in Transaction type)
  const totalInstallmentsMap = useMemo(() => {
    const map = new Map<string, number>();
    expenseInstallments.forEach(p => {
      if (p.despesas) {
        const despesaId = p.despesas.id;
        map.set(despesaId, (map.get(despesaId) || 0) + 1);
      }
    });
    return map;
  }, [expenseInstallments]);


  const monthlyFilteredTransactions = useMemo(() => {
    console.log("useTransactionsData: monthlyFilteredTransactions useMemo re-running...");
    if (!enabled) return []; // Adicionado para garantir que não materializa se não estiver enabled

    const startOfSelectedMonth = startOfMonth(selectedMonth);
    const endOfSelectedMonth = endOfMonth(selectedMonth);

    // 1. Filter one-off revenues for the selected month
    const monthlyIncomeTransactions: Transaction[] = revenues
      .filter(r => isWithinInterval(new Date(r.data), { start: startOfSelectedMonth, end: endOfSelectedMonth }))
      .map(r => ({
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
      }));

    // 2. Filter one-off expense installments for the selected month
    const monthlyExpenseTransactions: Transaction[] = expenseInstallments
      .filter(p => isWithinInterval(new Date(p.vencimento), { start: startOfSelectedMonth, end: endOfSelectedMonth }))
      .map(p => {
        const parentDespesa = p.despesas;
        const despesaId = parentDespesa?.id;
        const totalForNonFixed = despesaId ? totalInstallmentsMap.get(despesaId) : 1;
        const transaction: Transaction = { // Definir tipo para log
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
          despesa_id: parentDespesa?.id,
        };
        console.log("useTransactionsData: Mapped expense installment to Transaction:", { id: transaction.id, forma_pagamento: transaction.forma_pagamento, cartao_id: transaction.cartao_id }); // LOG ADICIONADO
        return transaction;
      });

    // 3. Combine month-specific one-off transactions with already month-specific recurring transactions
    //    materializedRecurringTransactions from useRecurringEntries is already filtered for `selectedMonth`
    const combined = [...monthlyIncomeTransactions, ...monthlyExpenseTransactions, ...materializedRecurringTransactions].sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();

      if (dateA !== dateB) {
        return dateB - dateA; // Descending date
      }
      // If dates are the same, sort by ID to ensure stable order
      return a.id.localeCompare(b.id);
    });
    
    console.log("useTransactionsData: Monthly Income transactions count:", monthlyIncomeTransactions.length);
    console.log("useTransactionsData: Monthly Expense transactions count:", monthlyExpenseTransactions.length);
    console.log("useTransactionsData: Materialized Recurring transactions count (already month-specific):", materializedRecurringTransactions.length);
    console.log("useTransactionsData: Combined monthlyFilteredTransactions count:", combined.length);
    
    return combined;
  }, [selectedMonth, revenues, expenseInstallments, materializedRecurringTransactions, totalInstallmentsMap, enabled]);

  const isLoading = isLoadingRevenues || isLoadingExpenses || isLoadingCategories || isLoadingCartoes || isLoadingRecurring;

  return {
    monthlyFilteredTransactions,
    fetchedCategories, // Agora contém apenas subcategorias
    cartoes,
    isLoading,
    isLoadingCategories,
  };
};