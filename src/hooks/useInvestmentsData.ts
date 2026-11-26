import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCategories } from "@/hooks/useCategories";
import {
  Investment,
  InvestmentContribution,
  InvestmentRedemption,
  InvestmentRedemptionAllocation,
  InvestmentConsolidatedMetrics,
} from "@/types/finance";
import {
  IndexadorHistorico,
  buildIndexadorMap,
  calcularIPCA12M,
  getLatestIPCAMensal,
  getTipoTributacao,
} from "@/lib/utils";
import {
  calcularLotesInvestimento,
  roundCurrency,
} from "@/lib/investmentsFifo";

export function useInvestmentsData() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: allCategories = [], isLoading: isLoadingCategories } = useCategories(user?.id);

  // Subcategorias elegíveis
  const allSubcategories = useMemo(() => {
    return allCategories.filter((cat) => cat.parent_id !== null);
  }, [allCategories]);

  // 1. Fetch Indexadores (CDI / IPCA)
  const { data: indexadores = [], isLoading: isLoadingIndexadores } = useQuery<IndexadorHistorico[]>({
    queryKey: ["indexadores-cdi"],
    staleTime: 1000 * 60 * 30,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("indexadores")
        .select("tipo, taxa_anual, data_inicio, taxa_diaria, taxa_mensal, periodicidade")
        .order("data_inicio", { ascending: true });
      if (error) throw error;
      return data as IndexadorHistorico[];
    },
  });

  const cdi = useMemo(() => {
    const cdis = indexadores.filter((i) => i.tipo === "CDI");
    if (cdis.length === 0) return 10.65;
    return [...cdis].sort((a, b) => b.data_inicio.localeCompare(a.data_inicio))[0].taxa_anual;
  }, [indexadores]);

  const cdiDiario = useMemo(() => {
    const cdis = indexadores.filter((i) => i.tipo === "CDI");
    if (cdis.length === 0) return Math.pow(1 + 0.1065, 1 / 252) - 1;
    return [...cdis].sort((a, b) => b.data_inicio.localeCompare(a.data_inicio))[0].taxa_diaria;
  }, [indexadores]);

  const ipca12M = useMemo(() => {
    return calcularIPCA12M(indexadores);
  }, [indexadores]);

  const ipcaUltimoMensal = useMemo(() => {
    return getLatestIPCAMensal(indexadores);
  }, [indexadores]);

  const indexadorMapCDI = useMemo(() => {
    return buildIndexadorMap(indexadores.filter((i) => i.tipo === "CDI"));
  }, [indexadores]);

  const indexadorMapIPCA = useMemo(() => {
    return buildIndexadorMap(indexadores.filter((i) => i.tipo === "IPCA"));
  }, [indexadores]);

  // 2. Fetch Investimentos (Mestre)
  const {
    data: investments = [],
    isLoading: isLoadingInvestments,
    refetch: refetchInvestments,
  } = useQuery<Investment[]>({
    queryKey: ["investments", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("investimentos")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Investment[];
    },
    enabled: !!user?.id,
  });

  // 3. Fetch Aportes (Lotes)
  const {
    data: aportes = [],
    isLoading: isLoadingAportes,
  } = useQuery<InvestmentContribution[]>({
    queryKey: ["investments-aportes", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("investimentos_aportes")
        .select("*")
        .eq("user_id", user.id)
        .order("data_aporte", { ascending: true });
      if (error) throw error;
      return (data || []) as InvestmentContribution[];
    },
    enabled: !!user?.id,
  });

  // 4. Fetch Alocações de Resgates
  const {
    data: alocacoes = [],
    isLoading: isLoadingAlocacoes,
  } = useQuery<InvestmentRedemptionAllocation[]>({
    queryKey: ["investments-resgates-aportes", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("investimentos_resgates_aportes")
        .select("*")
        .eq("user_id", user.id);
      if (error) throw error;
      return (data || []) as InvestmentRedemptionAllocation[];
    },
    enabled: !!user?.id,
  });

  // 5. Fetch Resgates Históricos
  const {
    data: resgates = [],
    isLoading: isLoadingResgates,
  } = useQuery<InvestmentRedemption[]>({
    queryKey: ["investments-resgates", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("investimentos_resgates")
        .select("*")
        .eq("user_id", user.id)
        .order("data_resgate", { ascending: false });
      if (error) throw error;
      return (data || []) as InvestmentRedemption[];
    },
    enabled: !!user?.id,
  });

  // 6. Cálculo Individual por Lote e Consolidação
  const calculatedInvestments = useMemo(() => {
    if (!investments.length) return [];

    return investments.map((inv) => {
      const aportesDoInvestimento = aportes.filter((ap) => ap.investimento_id === inv.id);
      const tipoTributacao = getTipoTributacao(inv, allSubcategories);

      // Se por ventura um investimento ainda não tiver aporte cadastrado, criar lote virtual de fallback
      const aportesEfetivos =
        aportesDoInvestimento.length > 0
          ? aportesDoInvestimento
          : [
              {
                id: `virtual-${inv.id}`,
                investimento_id: inv.id,
                user_id: inv.user_id,
                valor_original: inv.valor,
                data_aporte: inv.data,
                created_at: inv.created_at || new Date().toISOString(),
              },
            ];

      return calcularLotesInvestimento({
        investimento: inv,
        aportes: aportesEfetivos,
        alocacoes,
        indexadorMapCDI,
        indexadorMapIPCA,
        tipoTributacao,
        cdi,
        ipca12M,
      });
    });
  }, [investments, aportes, alocacoes, allSubcategories, indexadorMapCDI, indexadorMapIPCA, cdi, ipca12M]);

  // Mapa de busca rápida por ID de investimento
  const consolidatedMap = useMemo(() => {
    const map = new Map<string, InvestmentConsolidatedMetrics>();
    for (const item of calculatedInvestments) {
      map.set(item.investimento.id, item);
    }
    return map;
  }, [calculatedInvestments]);

  // 7. Estatísticas da Carteira Total
  const stats = useMemo(() => {
    const activeConsolidated = calculatedInvestments.filter(
      (c) => c.investimento.status !== "resgatado"
    );

    const totalInvested = roundCurrency(
      activeConsolidated.reduce((sum, c) => sum + c.valorAplicadoTotal, 0)
    );
    const totalCurrentBalance = roundCurrency(
      activeConsolidated.reduce((sum, c) => sum + c.saldoLiquidoTotal, 0)
    );

    if (totalInvested === 0 || totalCurrentBalance === 0) {
      return {
        totalInvested: 0,
        totalCurrentBalance: 0,
        avgProfitability: 0,
        avgMonthlyProfitability: 0,
        totalDailyYieldRS: 0,
        totalMonthlyYieldRS: 0,
      };
    }

    // Taxa anual ponderada = Σ (saldoLiquidoTotal × (rentabilidadeLiquidaAnual / 100)) ÷ Σ saldoLiquidoTotal
    const weightedSum = activeConsolidated.reduce(
      (sum, c) => sum + c.saldoLiquidoTotal * (c.rentabilidadeLiquidaAnual / 100),
      0
    );
    const taxaAnualPonderada = weightedSum / totalCurrentBalance;
    const avgProfitability = taxaAnualPonderada * 100;

    // Rendimento diário total
    const totalDailyYieldRS = roundCurrency(
      activeConsolidated.reduce((sum, c) => sum + c.rendimentoHojeLiquidoTotal, 0)
    );

    // Indicadores mensais consolidados (capitalização composta em 21 dias úteis a partir do rendimento diário real)
    // Considera apenas o patrimônio ativo que efetivamente gera rendimento diário
    const DIAS_UTEIS_MES = 21;
    const activeYieldingInvestments = activeConsolidated.filter(
      (c) =>
        Number.isFinite(c.saldoLiquidoTotal) &&
        c.saldoLiquidoTotal > 0 &&
        Number.isFinite(c.rendimentoHojeLiquidoTotal) &&
        c.rendimentoHojeLiquidoTotal > 0
    );

    const patrimonioGerador = activeYieldingInvestments.reduce(
      (sum, c) => sum + c.saldoLiquidoTotal,
      0
    );
    const rendimentoDiarioGerador = activeYieldingInvestments.reduce(
      (sum, c) => sum + c.rendimentoHojeLiquidoTotal,
      0
    );

    let avgMonthlyProfitability = 0;
    let totalMonthlyYieldRS = 0;

    if (
      Number.isFinite(patrimonioGerador) &&
      Number.isFinite(rendimentoDiarioGerador) &&
      patrimonioGerador > 0 &&
      rendimentoDiarioGerador > 0
    ) {
      const taxaDiariaEfetiva = rendimentoDiarioGerador / patrimonioGerador;
      const rentabilidadeMensalComposta = Math.pow(1 + taxaDiariaEfetiva, DIAS_UTEIS_MES) - 1;
      const rendimentoMensalEstimado = patrimonioGerador * rentabilidadeMensalComposta;

      if (
        Number.isFinite(rentabilidadeMensalComposta) &&
        Number.isFinite(rendimentoMensalEstimado)
      ) {
        avgMonthlyProfitability = rentabilidadeMensalComposta * 100;
        totalMonthlyYieldRS = roundCurrency(rendimentoMensalEstimado);
      }
    }

    return {
      totalInvested,
      totalCurrentBalance,
      avgProfitability,
      avgMonthlyProfitability,
      totalDailyYieldRS,
      totalMonthlyYieldRS,
    };
  }, [calculatedInvestments]);

  // Função utilitária para invalidar todas as consultas do ecossistema de investimentos
  const invalidateAll = async () => {
    if (!user?.id) return;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["investments", user.id] }),
      queryClient.invalidateQueries({ queryKey: ["investments-aportes", user.id] }),
      queryClient.invalidateQueries({ queryKey: ["investments-resgates", user.id] }),
      queryClient.invalidateQueries({ queryKey: ["investments-resgates-aportes", user.id] }),
    ]);
  };

  return {
    investments,
    aportes,
    alocacoes,
    resgates,
    calculatedInvestments,
    consolidatedMap,
    stats,
    indexadores,
    cdi,
    cdiDiario,
    ipca12M,
    ipcaUltimoMensal,
    indexadorMapCDI,
    indexadorMapIPCA,
    allSubcategories,
    isLoading:
      isLoadingInvestments ||
      isLoadingAportes ||
      isLoadingAlocacoes ||
      isLoadingIndexadores ||
      isLoadingCategories,
    invalidateAll,
    refetchInvestments,
  };
}
