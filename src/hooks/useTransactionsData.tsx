import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Tables } from "@/integrations/supabase/types";
import { AppCategory, Transaction } from "@/types/finance";
import { format, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import { isValidUuid } from "@/lib/utils";

interface UseTransactionsDataProps {
  user: User | null;
  selectedMonth: Date;
  enabled: boolean;
}

export const useTransactionsData = ({ user, selectedMonth, enabled }: UseTransactionsDataProps) => {
  // ✅ CORREÇÃO: Carregar TODAS as categorias (principais e subcategorias)
  const { data: fetchedCategories = [], isLoading: isLoadingCategories } =
    useQuery<AppCategory[]>({
      queryKey: ["categories", user?.id],
      queryFn: async () => {
        if (!user?.id) return [];
        const { data, error } = await supabase
          .from("categorias")
          .select("*")
          .or(`user_id.eq.${user.id},user_id.is.null`)
          .order("nome"); // 🔥 REMOVIDO o .not("parent_id", "is", null)
        if (error) throw error;
        return data as AppCategory[];
      },
      enabled,
      staleTime: 0, // Adicionado para garantir que os dados sejam sempre considerados stale
    });

  const { data: revenues = [], isLoading: isLoadingRevenues } = useQuery<
    Tables<"receitas">[]
  >({
    queryKey: ["revenues", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("receitas")
        .select(`
          id,
          valor,
          data,
          tipo_receita_id,
          descricao,
          status,
          is_recurring_master,
          recurrence_id,
          recurrence_day,
          updated_at,
          user_id,
          created_at
        `) // ✅ Adicionado created_at ao select
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }); // ✅ CORREÇÃO: Alterado de 'data' para 'created_at'
      if (error) throw error;
      return data;
    },
    enabled,
    staleTime: 0, // Adicionado para garantir que os dados sejam sempre considerados stale
  });
  console.log("useTransactionsData: revenues data reference:", revenues); // Log para verificar a referência

  const { data: expenseInstallments = [], isLoading: isLoadingExpenses } =
    useQuery<
      (Tables<"despesas_parcelas"> & {
        despesas:
          | (Tables<"despesas"> & {
              categoria: {
                id: string;
                nome: string;
                cor: string;
                parent_id: string | null;
              } | null;
            })
          | null;
      })[]
    >({
      queryKey: ["expenseInstallments", user?.id],
      queryFn: async () => {
        if (!user?.id) return [];
        const { data, error } = await supabase
          .from("despesas_parcelas")
          .select(
            `
          id,
          valor_parcela,
          vencimento,
          pago,
          data_pagamento,
          updated_at,
          created_at,
          despesa_id,
          despesas:despesa_id (
            id,
            categoria_id,
            descricao,
            forma_pagamento,
            tipo_pagamento,
            cartao_id,
            is_recurring_master,
            updated_at,
            categoria:categoria_id (
              id,
              nome,
              cor,
              parent_id
            )
          )
        `
          )
          .filter("despesas.user_id", "eq", user.id)
          .order("vencimento", { ascending: true });

        if (error) throw error;
        return data;
    },
    enabled,
    staleTime: 0, // Adicionado para garantir que os dados sejam sempre considerados stale
  });
  console.log("useTransactionsData: expenseInstallments data reference:", expenseInstallments); // Log para verificar a referência

  const { data: cartoes = [], isLoading: isLoadingCartoes } = useQuery<
    Tables<"cartoes">[]
  >({
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
    enabled,
    staleTime: 0, // Adicionado para garantir que os dados sejam sempre considerados stale
  });

  const totalInstallmentsMap = useMemo(() => {
    const map = new Map<string, number>();
    expenseInstallments.forEach((p) => {
      if (p.despesas) {
        const id = p.despesas.id;
        map.set(id, (map.get(id) || 0) + 1);
      }
    });
    return map;
  }, [expenseInstallments]);

  const monthlyFilteredTransactions = useMemo(() => {
    console.log("useTransactionsData: Recalculating monthlyFilteredTransactions..."); // ADD THIS LOG
    if (!enabled) return [];

    const startDate = startOfMonth(selectedMonth);
    const endDate = endOfMonth(selectedMonth);

    const monthlyIncomeTransactions: Transaction[] = revenues
      .filter((r) =>
        isWithinInterval(new Date(r.data), {
          start: startDate,
          end: endDate,
        })
      )
      .map((r) => {
        return {
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
          tipo_pagamento:
            r.is_recurring_master || r.recurrence_id ? "fixo" : "avista",
          updated_at: r.updated_at, // Adicionado updated_at
        };
      });

    const monthlyExpenseTransactions: Transaction[] = expenseInstallments
      .filter((p) =>
        isWithinInterval(new Date(p.vencimento), {
          start: startDate,
          end: endDate,
        })
      )
      .map((p) => {
        const d = p.despesas;
        const totalForNonFixed = d?.id ? totalInstallmentsMap.get(d.id) : 1;
        
        const cacheKey =
          `${p.id}-${p.pago}-${p.data_pagamento ?? ""}-${p.updated_at ?? ""}`; // ✅ CORREÇÃO: Usar template literals e updated_at

        const transaction: Transaction = {
          id: p.id,
          type: "expense",
          amount: p.valor_parcela,
          date: p.vencimento,
          description: d?.descricao || "Despesa",
          status: p.pago ? "Recebida" : "Pendente",
          installmentNumber: p.numero_parcela,
          totalInstallments: totalForNonFixed,
          forma_pagamento: d?.forma_pagamento,
          cartao_id: d?.cartao_id,
          despesa_id: d?.id || p.despesa_id, // FIX CRÍTICO
          is_recurring_master: Boolean(d?.is_recurring_master),
          recurrence_id: d?.id ?? null,
          recurrence_day: null,
          tipo_pagamento: d?.tipo_pagamento,
          category: d?.categoria_id || "outros_diversos", // FIX CRÍTICO
          updated_at: p.updated_at, // ✅ CORREÇÃO: Adicionado updated_at
        };
        return transaction;
      });

    // Ordenar por data desc
    return [...monthlyIncomeTransactions, ...monthlyExpenseTransactions].sort(
      (a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime() ||
        a.id.localeCompare(b.id)
    );
  }, [
    selectedMonth,
    revenues,
    expenseInstallments,
    totalInstallmentsMap,
    enabled,
  ]);

  return {
    monthlyFilteredTransactions,
    fetchedCategories,
    cartoes,
    isLoading:
      isLoadingRevenues ||
      isLoadingExpenses ||
      isLoadingCategories ||
      isLoadingCartoes,
    isLoadingCategories,
  };
};