import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Tables } from "@/integrations/supabase/types";
import { AppCategory, Transaction } from "@/types/finance";
import { format, startOfMonth, endOfMonth, isWithinInterval, getDate } from "date-fns"; // Adicionado getDate
import { isValidUuid } from "@/lib/utils";

interface UseTransactionsDataProps {
  user: User | null;
  selectedMonth: Date;
  enabled: boolean;
}

export const useTransactionsData = ({ user, selectedMonth, enabled }: UseTransactionsDataProps) => {
  const { data: fetchedCategories = [], isLoading: isLoadingCategories } =
    useQuery<AppCategory[]>({
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
      enabled,
      staleTime: 0,
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
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled,
    staleTime: 0,
  });

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
            recurrence_id,
            numero_parcelas,
            updated_at,
            valor_total,
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
    staleTime: 0,
  });

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
    staleTime: 0,
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
          updated_at: r.updated_at,
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

        if (!d) {
            console.warn(`[WARN] Expense installment ${p.id} has no associated despesas record. Skipping.`);
            return null;
        }

        let inferredTipoPagamento: "avista" | "parcelado" | "fixo" = "avista";
        if (d.tipo_pagamento) {
            inferredTipoPagamento = d.tipo_pagamento;
        } else if (d.is_recurring_master) {
            inferredTipoPagamento = "fixo";
        } else if (d.numero_parcelas && d.numero_parcelas > 1) {
            inferredTipoPagamento = "parcelado";
        }

        const transaction: Transaction = {
          id: p.id,
          type: "expense",
          amount: p.valor_parcela,
          date: p.vencimento,
          description: d.descricao || "Despesa",
          status: p.pago ? "Recebida" : "Pendente",
          installmentNumber: p.numero_parcela,
          totalInstallments: d.numero_parcelas || 1,
          forma_pagamento: d.forma_pagamento,
          cartao_id: d.cartao_id,
          despesa_id: d.id,
          is_recurring_master: Boolean(d.is_recurring_master),
          recurrence_id: d.recurrence_id ?? null,
          recurrence_day: d.recurrence_id ? getDate(new Date(p.vencimento)) : null, // ✅ CORREÇÃO: Derivar recurrence_day do vencimento se for recorrente
          tipo_pagamento: inferredTipoPagamento,
          category: d.categoria_id || "outros_diversos",
          updated_at: p.updated_at,
        };
        return transaction;
      })
      .filter(Boolean) as Transaction[];

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