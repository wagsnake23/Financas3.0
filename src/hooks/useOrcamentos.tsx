import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Orcamento } from "@/types/finance";

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
    mutationFn: async (orcamento: Omit<Orcamento, "id" | "created_at" | "updated_at"> & { id?: string }) => {
      if (!userId) throw new Error("User not authenticated");

      if (orcamento.id) {
        // Atualização
        const { data, error } = await supabase
          .from("orcamentos")
          .update({
            tipo_planejamento: orcamento.tipo_planejamento,
            valor_planejado: orcamento.valor_planejado,
            percentual_planejado: orcamento.percentual_planejado,
            updated_at: new Date().toISOString(),
          })
          .eq("id", orcamento.id)
          .select()
          .single();
        if (error) throw error;
        return data;
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
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orcamentos", userId] });
    },
  });

  // Mutação para excluir orçamento
  const deleteOrcamentoMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("orcamentos").delete().eq("id", id);
      if (error) throw error;
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
  };
}
