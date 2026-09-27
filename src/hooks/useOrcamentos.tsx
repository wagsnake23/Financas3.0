import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Orcamento } from "@/types/finance";
import { ORCAMENTO_HORIZON_MONTHS } from "./useFinancialProjection";

export function useOrcamentos(userId: string | undefined, mesAno: string) {
  const queryClient = useQueryClient();

  // Buscar orçamentos do mês
  const { data: orcamentos, isLoading, error } = useQuery({
    queryKey: ["orcamentos", userId, mesAno],
    queryFn: async () => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from("orcamentos")
        .select("*")
        .eq("user_id", userId)
        .eq("mes_ano", mesAno);

      if (error) throw error;
      return data as Orcamento[];
    },
    enabled: !!userId && !!mesAno,
  });

  // Mutação para adicionar ou atualizar orçamento
  const saveOrcamentoMutation = useMutation({
    mutationFn: async (orcamento: Omit<Orcamento, "id" | "created_at" | "updated_at"> & { id?: string; applyToFuture?: boolean }) => {
      if (!userId) throw new Error("User not authenticated");

      let currentData: Orcamento;

      if (orcamento.id && !orcamento.id.startsWith("virtual-")) {
        // Atualização

        const { data, error } = await supabase
          .from("orcamentos")
          .update({
            user_id: userId,
            tipo_planejamento: orcamento.tipo_planejamento,
            valor_planejado: orcamento.valor_planejado,
            percentual_planejado: orcamento.percentual_planejado,
            updated_at: new Date().toISOString(),
          })
          .eq("id", orcamento.id)
          .select()
          .single();
        if (error) {
          console.error("ERRO NO UPDATE MÊS ATUAL:", error);
          throw error;
        }
        currentData = data as Orcamento;
      } else {
        // Criação

        const { data, error } = await supabase
          .from("orcamentos")
          .insert({
            user_id: userId,
            categoria_id: orcamento.categoria_id,
            mes_ano: orcamento.mes_ano,
            tipo_planejamento: orcamento.tipo_planejamento,
            valor_planejado: orcamento.valor_planejado,
            percentual_planejado: orcamento.percentual_planejado,
          })
          .select()
          .single();
        if (error) {
          console.error("ERRO NO INSERT MÊS ATUAL:", error);
          throw error;
        }
        currentData = data as Orcamento;
      }

      // Se applyToFuture for true, cria ou atualiza os meses seguintes até completar o horizonte
      if (orcamento.applyToFuture) {
        // Gerar os meses futuros
        const [anoStr, mesStr] = orcamento.mes_ano.split("-");
        let baseDate = new Date(Number(anoStr), Number(mesStr) - 1, 1);
        
        const futureMonths = [];
        const futureCount = ORCAMENTO_HORIZON_MONTHS - 1;
        for (let i = 1; i <= futureCount; i++) {
          const nextDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + i, 1);
          futureMonths.push(`${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}`);
        }

        // Buscar orçamentos existentes nesses meses
        const { data: existingFuture, error: fetchError } = await supabase
          .from("orcamentos")
          .select("id, mes_ano, user_id, categoria_id")
          .eq("user_id", userId)
          .eq("categoria_id", orcamento.categoria_id)
          .in("mes_ano", futureMonths);

        if (fetchError) throw fetchError;

        const existingMap = new Map((existingFuture || []).map(o => [o.mes_ano, o]));

        const toUpdate = [];
        const toInsert = [];

        for (const fMes of futureMonths) {
          if (existingMap.has(fMes)) {
            const existingRecord = existingMap.get(fMes);
            toUpdate.push({
              id: existingRecord.id,
              user_id: existingRecord.user_id,
              categoria_id: existingRecord.categoria_id,
              mes_ano: existingRecord.mes_ano,
              tipo_planejamento: orcamento.tipo_planejamento,
              valor_planejado: orcamento.valor_planejado,
              percentual_planejado: orcamento.percentual_planejado,
              updated_at: new Date().toISOString(),
            });
          } else {
            toInsert.push({
              user_id: userId,
              categoria_id: orcamento.categoria_id,
              mes_ano: fMes,
              tipo_planejamento: orcamento.tipo_planejamento,
              valor_planejado: orcamento.valor_planejado,
              percentual_planejado: orcamento.percentual_planejado,
            });
          }
        }
        if (toUpdate.length > 0) {
        }
        if (toInsert.length > 0) {
        }
        
        // Executar upsert para atualizações
        if (toUpdate.length > 0) {
          
          const { error: updateError, data: updateData } = await supabase.from("orcamentos").upsert(toUpdate).select();
          
          if (updateError) {
            console.error("ERRO SUPABASE UPSERT:", {
              code: updateError.code,
              message: updateError.message,
              details: updateError.details,
              hint: updateError.hint
            });
            throw updateError;
          }
        }

        // Executar insert para novas criações
        if (toInsert.length > 0) {
          
          const { error: insertError, data: insertData } = await supabase.from("orcamentos").insert(toInsert).select();
          
          if (insertError) {
            console.error("ERRO SUPABASE INSERT:", {
              code: insertError.code,
              message: insertError.message,
              details: insertError.details,
              hint: insertError.hint
            });
            throw insertError;
          }
        }
      }

      return currentData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orcamentos", userId] });
    },
  });

  // Mutação para excluir orçamento
  const deleteOrcamentoMutation = useMutation({
    mutationFn: async (payload: string | { id: string; applyToFuture?: boolean; categoria_id?: string; mes_ano?: string }) => {
      const id = typeof payload === 'string' ? payload : payload.id;
      const { error } = await supabase.from("orcamentos").delete().eq("id", id);
      if (error) throw error;
      
      if (typeof payload === 'object' && payload.applyToFuture && payload.categoria_id && payload.mes_ano) {
        if (!userId) throw new Error("User not authenticated");
        const { error: futureError } = await supabase
          .from("orcamentos")
          .delete()
          .eq("user_id", userId)
          .eq("categoria_id", payload.categoria_id)
          .gt("mes_ano", payload.mes_ano);
          
        if (futureError) throw futureError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orcamentos", userId] });
    },
  });

  // Mutação para inserção em massa (usada na cópia/sincronização)
  const syncOrcamentosMutation = useMutation({
    mutationFn: async (orcamentosToInsert: any[]) => {
      if (!orcamentosToInsert.length) return;
      const { error } = await supabase
        .from("orcamentos")
        .insert(orcamentosToInsert);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orcamentos", userId] });
    },
  });

  // Mutação para exclusão em massa de orçamentos (limpeza do periodo)
  const deleteOrcamentosMassActionMutation = useMutation({
    mutationFn: async (payload: { mes_ano: string; applyToFuture: boolean }) => {
      if (!userId) throw new Error("User not authenticated");
      
      let query = supabase
        .from("orcamentos")
        .delete()
        .eq("user_id", userId);
        
      if (payload.applyToFuture) {
        query = query.gte("mes_ano", payload.mes_ano);
      } else {
        query = query.eq("mes_ano", payload.mes_ano);
      }
      
      const { error } = await query;
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orcamentos"] });
      queryClient.invalidateQueries({ queryKey: ["orcamentos-projection"] });
    },
  });

  return {
    orcamentos,
    isLoading,
    error,
    saveOrcamento: saveOrcamentoMutation.mutateAsync,
    isSaving: saveOrcamentoMutation.isPending,
    deleteOrcamento: deleteOrcamentoMutation.mutateAsync,
    isDeleting: deleteOrcamentoMutation.isPending,
    syncOrcamentos: syncOrcamentosMutation.mutateAsync,
    isSyncing: syncOrcamentosMutation.isPending,
    deleteOrcamentosMassAction: deleteOrcamentosMassActionMutation.mutateAsync,
    isDeletingMass: deleteOrcamentosMassActionMutation.isPending,
  };
}
