import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { startOfMonth, format } from "date-fns";
import { Transaction } from "@/types/finance";

export const useFinancialNotifications = () => {
  const { user } = useAuth();
  
  // Base queries only run if user is authenticated
  const currentDate = new Date();
  const currentMonthStart = startOfMonth(currentDate);
  const startOfMonthStr = format(currentMonthStart, "yyyy-MM-01");

  const { data: pendingReceipts = [], isLoading: loadingReceipts } = useQuery({
    queryKey: ["pending-receipts-notifications", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from("receitas")
        .select("*, status, is_recurring_master, recurrence_id, recurrence_day")
        .eq("user_id", user.id)
        .eq("status", "Pendente")
        .lt("data", startOfMonthStr);

      if (error) {
        console.error("Error fetching pending receipts:", error);
        return [];
      }

      // Map to Transaction format
      return data.map((r): Transaction => ({
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
        paymentTimestamp: null,
        created_at: r.created_at,
      }));
    },
    enabled: !!user,
  });

  const { data: overdueExpenses = [], isLoading: loadingExpenses } = useQuery({
    queryKey: ["overdue-expenses-notifications", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from("despesas_parcelas")
        .select("*, despesas!inner(id, categoria_id, user_id, descricao, forma_pagamento, tipo_pagamento, cartao_id, is_recurring_master, numero_parcelas, valor_total)")
        .eq("despesas.user_id", user.id)
        .eq("pago", false)
        .lt("vencimento", startOfMonthStr);

      if (error) {
        console.error("Error fetching overdue expenses:", error);
        return [];
      }

      // Map to Transaction format
      return data.map((p: any): Transaction => {
        const parentDespesa = Array.isArray(p.despesas) ? p.despesas[0] : p.despesas;
        
        return {
          id: p.id,
          despesa_id: parentDespesa?.id,
          type: "expense",
          amount: p.valor_parcela,
          date: p.vencimento,
          category: parentDespesa?.categoria_id || "outros_diversos",
          description: parentDespesa?.descricao || "Despesa",
          status: 'Pendente',
          installmentNumber: p.numero_parcela,
          totalInstallments: parentDespesa?.numero_parcelas || 1,
          forma_pagamento: parentDespesa?.forma_pagamento,
          cartao_id: parentDespesa?.cartao_id,
          is_recurring_master: Boolean(parentDespesa?.is_recurring_master),
          tipo_pagamento: parentDespesa?.tipo_pagamento,
          paymentTimestamp: null,
          created_at: p.created_at,
        };
      });
    },
    enabled: !!user,
  });

  // Calculate totals
  const totalNotifications = pendingReceipts.length + overdueExpenses.length;
  const isLoading = loadingReceipts || loadingExpenses;
  
  // Sort oldest first
  const allNotifications = [...pendingReceipts, ...overdueExpenses].sort((a, b) => {
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });

  return {
    totalNotifications,
    overdueExpenses: overdueExpenses.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    pendingReceipts: pendingReceipts.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    allNotifications,
    isLoading
  };
};
