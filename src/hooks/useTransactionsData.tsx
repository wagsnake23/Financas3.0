import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Tables } from "@/integrations/supabase/types";
import { AppCategory, Transaction } from "@/types/finance";
import { format, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import { isValidUuid } from "@/lib/utils"; // Importar isValidUuid

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
        .not("parent_id", "is", null)
        .order("nome");
      if (error) throw error;
      return data as AppCategory[];
    },
    enabled: enabled,
  });

  const { data: revenues = [], isLoading: isLoadingRevenues } = useQuery<Tables<'receitas'>[]>({
    queryKey: ["revenues", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("receitas")
        .select("*, status, is_recurring_master, recurrence_id, recurrence_day") // Incluir novas colunas
        .eq("user_id", user.id)
        .order("data", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: enabled,
  });

  const { data: expenseInstallments = [], isLoading: isLoadingExpenses } = useQuery<
    (Tables<'despesas_parcelas'> & { despesas: Pick<Tables<'despesas'>, 'id' | 'categoria_id' | 'user_id' | 'descricao' | 'forma_pagamento' | 'tipo_pagamento' | 'cartao_id' | 'is_recurring_master'> | null })[] // Incluir is_recurring_master
  >({
    queryKey: ["expenseInstallments", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("despesas_parcelas")
        .select("*, despesas(id, categoria_id, user_id, descricao, forma_pagamento, tipo_pagamento, cartao_id, is_recurring_master)") // Incluir is_recurring_master
        .filter("despesas.user_id", "eq", user.id)
        .order("vencimento", { ascending: true });
      if (error) throw error;
      console.log("useTransactionsData: Raw expenseInstallments fetched:", data.map(p => ({ id: p.id, despesa_id: p.despesas?.id, forma_pagamento: p.despesas?.forma_pagamento, cartao_id: p.despesas?.cartao_id })));
      return data;
    },
    enabled: enabled,
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
    enabled: enabled,
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
    if (!enabled) return [];

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
        forma_pagamento: null,
        cartao_id: null,
        is_recurring_master: r.is_recurring_master, // Incluir
        recurrence_id: r.recurrence_id, // Incluir
        recurrence_day: r.recurrence_day, // Incluir
      }));

    // 2. Filter one-off expense installments for the selected month
    const monthlyExpenseTransactions: Transaction[] = expenseInstallments
      .filter(p => isWithinInterval(new Date(p.vencimento), { start: startOfSelectedMonth, end: endOfSelectedMonth }))
      .map(p => {
        const parentDespesa = p.despesas;
        const despesaId = parentDespesa?.id;
        const totalForNonFixed = despesaId ? totalInstallmentsMap.get(despesaId) : 1;
        const transaction: Transaction = {
          id: p.id,
          type: "expense",
          amount: p.valor_parcela,
          date: p.vencimento,
          category: parentDespesa?.categoria_id || "outros_diversos",
          description: parentDespesa?.descricao || "Despesa",
          status: p.pago ? 'Recebida' : 'Pendente',
          installmentNumber: p.numero_parcela,
          totalInstallments: totalForNonFixed,
          forma_pagamento: parentDespesa?.forma_pagamento,
          cartao_id: parentDespesa?.cartao_id,
          despesa_id: parentDespesa?.id,
          is_recurring_master: parentDespesa?.is_recurring_master, // Incluir
          recurrence_id: parentDespesa?.id, // Para despesas, o recurrence_id é o id da despesa mestra
          recurrence_day: null, // Não aplicável diretamente aqui, mas pode ser derivado de vencimento
        };
        console.log("useTransactionsData: Mapped expense installment to Transaction:", { id: transaction.id, forma_pagamento: transaction.forma_pagamento, cartao_id: transaction.cartao_id });
        return transaction;
      });

    // 3. Combine month-specific one-off transactions
    const combined = [...monthlyIncomeTransactions, ...monthlyExpenseTransactions].sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();

      if (dateA !== dateB) {
        return dateB - dateA;
      }
      // If dates are the same, sort by ID to ensure stable order
      return a.id.localeCompare(b.id);
    });
    
    console.log("useTransactionsData: Monthly Income transactions count:", monthlyIncomeTransactions.length);
    console.log("useTransactionsData: Monthly Expense transactions count:", monthlyExpenseTransactions.length);
    console.log("useTransactionsData: Combined monthlyFilteredTransactions count:", combined.length);
    
    return combined;
  }, [selectedMonth, revenues, expenseInstallments, totalInstallmentsMap, enabled]);

  const isLoading = isLoadingRevenues || isLoadingExpenses || isLoadingCategories || isLoadingCartoes;

  return {
    monthlyFilteredTransactions,
    fetchedCategories,
    cartoes,
    isLoading,
    isLoadingCategories,
  };
};