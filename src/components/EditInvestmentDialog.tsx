import React, { useMemo, useState } from "react";
import { DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Investment, AppCategory, InvestmentConsolidatedMetrics } from "@/types/finance";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import DynamicIcon from "./DynamicIcon";
import {
  cn,
  formatCurrency,
  calcularRendimentoComCDI,
  getTipoTributacao,
  IndexadorHistorico,
  formatVencimentoDate,
  calcularIPCA12M,
  calcularRentabilidadeIPCAPlus,
} from "@/lib/utils";
import { ContributionsHistoryDialog } from "./investments/ContributionsHistoryDialog";

interface EditInvestmentDialogProps {
  investmentToEdit: Investment;
  consolidated?: InvestmentConsolidatedMetrics;
  onUpdateSuccess?: () => void;
  onCancelEdit: () => void;
  user?: User | null;
  investmentTypes: { value: string; label: string; icon?: string }[];
  isMobile: boolean;
  allSubcategories: AppCategory[];
  incomeInvestmentSubcategories?: AppCategory[];
  indexadorMapCDI: Map<string, number>;
  indexadorMapIPCA: Map<string, number>;
  onRescueClick?: () => void;
  onNewContributionClick?: () => void;
}

export const EditInvestmentDialog: React.FC<EditInvestmentDialogProps> = ({
  investmentToEdit,
  consolidated,
  onCancelEdit,
  investmentTypes,
  isMobile,
  allSubcategories,
  indexadorMapCDI,
  indexadorMapIPCA,
  onRescueClick,
  onNewContributionClick,
}) => {
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const { data: indexadores = [] } = useQuery({
    queryKey: ["indexadores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("indexadores")
        .select("tipo, taxa_anual, data_inicio, taxa_diaria, taxa_mensal");
      if (error) throw error;
      return data as IndexadorHistorico[];
    },
  });

  const cdi = useMemo(() => {
    const cdis = indexadores.filter((i) => i.tipo === "CDI");
    if (cdis.length === 0) return 11.15;
    return [...cdis].sort((a, b) => b.data_inicio.localeCompare(a.data_inicio))[0].taxa_anual;
  }, [indexadores]);

  const ipca12M = useMemo(() => {
    return calcularIPCA12M(indexadores);
  }, [indexadores]);

  const taxaEstimada = useMemo(() => {
    if (investmentToEdit.tipo_rentabilidade === "fixo") return investmentToEdit.taxa_fixa || 0;
    if (investmentToEdit.indexador === "CDI") {
      return (cdi * (investmentToEdit.percentual_indexador || 100)) / 100;
    }
    return calcularRentabilidadeIPCAPlus(ipca12M, investmentToEdit.percentual_indexador || 0);
  }, [investmentToEdit, cdi, ipca12M]);

  // Fallback se não for fornecido o objeto consolidado
  const fallbackMetrics = useMemo(() => {
    let idxMap: Map<string, number> | undefined;
    if (investmentToEdit.tipo_rentabilidade === "indexado") {
      if (investmentToEdit.indexador === "CDI") idxMap = indexadorMapCDI;
      else if (investmentToEdit.indexador === "IPCA") idxMap = indexadorMapIPCA;
    }

    const tipoTributacao = getTipoTributacao({ nome: investmentToEdit.nome }, allSubcategories);

    const {
      valorAtual: valorLiquido,
      rendimentoBrutoAcumulado: rendimentoBruto,
      irProvisionado: valorIR,
      aliquotaAplicada,
    } = calcularRendimentoComCDI({
      valorInicial: investmentToEdit.valor || 0,
      dataInicio: investmentToEdit.data,
      dataFim: investmentToEdit.data_resgate || null,
      dataVencimento: investmentToEdit.data_vencimento || null,
      indexadorMap: idxMap || new Map<string, number>(),
      indexador: investmentToEdit.indexador ?? "CDI",
      percentualIndexador:
        investmentToEdit.tipo_rentabilidade === "indexado"
          ? investmentToEdit.percentual_indexador || 100
          : 100,
      taxaFixaAnual:
        investmentToEdit.tipo_rentabilidade === "fixo" ? investmentToEdit.taxa_fixa || 0 : null,
      tipoTributacao,
    });

    const rendimentoLiquido = valorLiquido - (investmentToEdit.valor || 0);

    return {
      tipoTributacao,
      aliquota: aliquotaAplicada,
      rendimentoBruto,
      rendimentoLiquido,
      valorTotalLiquido: valorLiquido,
      imposto: valorIR,
      taxaLiquida: taxaEstimada * (1 - aliquotaAplicada / 100),
      valorAplicado: investmentToEdit.valor || 0,
      dataAplicacao: investmentToEdit.data,
    };
  }, [investmentToEdit, taxaEstimada, allSubcategories, indexadorMapCDI, indexadorMapIPCA]);

  // Valores consolidados (preferência pelo consolidated fornecido pela nova arquitetura)
  const valorAplicadoExibido = consolidated
    ? consolidated.valorAplicadoTotal
    : fallbackMetrics.valorAplicado;

  const dataAplicacaoExibida = consolidated
    ? consolidated.dataPrimeiroAporte
    : fallbackMetrics.dataAplicacao;

  const taxaLiquidaExibida = consolidated
    ? consolidated.rentabilidadeLiquidaAnual
    : fallbackMetrics.taxaLiquida;

  const impostoExibido = consolidated
    ? consolidated.irProvisionadoTotal
    : fallbackMetrics.imposto;

  const rendimentoLiquidoExibido = consolidated
    ? consolidated.rendimentoLiquidoTotal
    : fallbackMetrics.rendimentoLiquido;

  const valorTotalLiquidoExibido = consolidated
    ? consolidated.saldoLiquidoTotal
    : fallbackMetrics.valorTotalLiquido;

  const tipoTributacao = getTipoTributacao({ nome: investmentToEdit.nome }, allSubcategories);
  const totalAportes = consolidated ? consolidated.totalAportes : 1;
  const categoryDisplayName =
    allSubcategories.find((c) => c.id === investmentToEdit.nome)?.nome || investmentToEdit.nome;

  return (
    <div className={cn(isMobile ? "space-y-3.5" : "space-y-4", isMobile && "w-full mx-auto")}>
      {/* Cabeçalho: Ícone alinhado ao topo do botão fechar + Bloco de identificação (Nome + Categoria) */}
      <div className="flex items-start gap-2.5 w-full !mt-0 pr-9">
        {/* Ícone do investimento: topo alinhado com o botão de fechar e acompanhando visualmente as duas linhas de identificação */}
        <div
          className="flex items-center justify-center shrink-0 rounded-[12px] h-[38px] w-[38px] bg-white border border-[rgba(0,0,0,0.06)] shadow-sm"
        >
          <DynamicIcon
            name={allSubcategories.find((c) => c.id === investmentToEdit.nome)?.icone || "MoreHorizontal"}
            className="h-8 w-8 text-[28px] leading-none text-[#0556C3]"
            style={{ filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.15))" }}
          />
        </div>

        {/* Bloco de identificação: Nome na 1ª linha + Categoria compacta na 2ª linha */}
        <div className="flex flex-col justify-center min-h-[38px] flex-1 min-w-0">
          <h2
            className="text-base font-bold text-slate-800 leading-tight line-clamp-2 break-words text-left"
            style={{ fontFamily: "'Inter', sans-serif" }}
          >
            {categoryDisplayName}
          </h2>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider leading-none mt-1">
            {investmentTypes.find((t) => t.value === investmentToEdit.tipo)?.label || investmentToEdit.tipo}
          </span>
        </div>
      </div>

      <DialogDescription className="sr-only">Resumo e detalhes do investimento.</DialogDescription>

      {/* Cartão com Informações e Resultados Financeiros */}
      <div className="space-y-3">
        <div
          className="rounded-[18px] flex flex-col overflow-hidden"
          style={{
            backgroundColor: "#FFFFFF",
            border: "1px solid rgba(0,0,0,0.08)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.95), inset 0 -1px 0 rgba(0,0,0,0.03)",
          }}
        >
          {/* List Items */}
          <div className="flex flex-col p-4 gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <DynamicIcon name="DollarSign" className="h-[18px] w-[18px] text-slate-500" />
                <span className="text-[13px] font-semibold text-slate-500">Valor Aplicado Total</span>
              </div>
              <span className="text-sm font-black text-slate-800">
                {formatCurrency(valorAplicadoExibido)}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <DynamicIcon name="TrendingUp" className="h-[18px] w-[18px] text-slate-500" />
                <span className="text-[13px] font-semibold text-slate-500">Rentabilidade</span>
              </div>
              <span className="text-sm font-bold text-slate-700">
                {investmentToEdit.tipo_rentabilidade === "fixo" ? "Fixa" : "Indexada"}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <DynamicIcon name="BarChart3" className="h-[18px] w-[18px] text-slate-500" />
                <span className="text-[13px] font-semibold text-slate-500">Indexador</span>
              </div>
              <span className="text-sm font-bold text-slate-700">
                {investmentToEdit.tipo_rentabilidade === "fixo"
                  ? `${Number(investmentToEdit.taxa_fixa || 0).toFixed(2)}% a.a.`
                  : investmentToEdit.percentual_indexador
                  ? investmentToEdit.indexador === "IPCA"
                    ? `${investmentToEdit.indexador} + ${investmentToEdit.percentual_indexador}%`
                    : `${investmentToEdit.percentual_indexador}% ${investmentToEdit.indexador}`
                  : investmentToEdit.indexador || ""}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <DynamicIcon name="Calendar" className="h-[18px] w-[18px] text-slate-500" />
                <span className="text-[13px] font-semibold text-slate-500">Data da 1ª Aplicação</span>
              </div>
              <span className="text-sm font-bold text-slate-700">
                {dataAplicacaoExibida
                  ? format(parseISO(dataAplicacaoExibida.split("T")[0]), "dd/MM/yyyy", {
                      locale: ptBR,
                    })
                  : ""}
              </span>
            </div>

            {/* Data de Vencimento: Exibida APENAS quando preenchida */}
            {investmentToEdit.data_vencimento && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <DynamicIcon name="Calendar" className="h-[18px] w-[18px] text-slate-500" />
                  <span className="text-[13px] font-semibold text-slate-500">Data de Vencimento</span>
                </div>
                <span className="text-sm font-bold text-slate-700">
                  {formatVencimentoDate(investmentToEdit.data_vencimento)}
                </span>
              </div>
            )}
          </div>

          {/* Divisor Visual */}
          <div className="h-[1px] bg-slate-100 mx-4" />

          {/* Resumo Financeiro Consolidado */}
          <div className="flex flex-col p-4 pt-3 gap-3 select-none">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-semibold text-slate-500">Rentabilidade líquida</span>
              <span className="text-success text-sm font-bold leading-tight">
                {taxaLiquidaExibida.toFixed(2)}% a.a.
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[13px] font-semibold text-slate-500">Imposto de renda total</span>
              {tipoTributacao === "isento" ? (
                <span className="text-[#218C5C] text-sm font-black uppercase tracking-wider">Isento</span>
              ) : (
                <span className="text-red-500 text-sm font-bold">
                  -{formatCurrency(impostoExibido)}
                </span>
              )}
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[13px] font-semibold text-slate-500">Rendimento líquido total</span>
              <span className="text-success text-sm font-bold leading-none">
                + {formatCurrency(rendimentoLiquidoExibido)}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[13px] font-semibold text-slate-500">Saldo líquido total</span>
              <span className="text-[#0556C3] text-sm font-black tracking-tight leading-none">
                {formatCurrency(valorTotalLiquidoExibido)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Controles de Ação do Modal */}
      {((investmentToEdit.origem_investimento === "saldo_atual" &&
        investmentToEdit.status !== "resgatado" &&
        onRescueClick) ||
        consolidated) && (
        <div className="flex flex-row items-center w-full pt-2 gap-2 mt-2">
          {investmentToEdit.origem_investimento === "saldo_atual" &&
            investmentToEdit.status !== "resgatado" &&
            onRescueClick && (
              <Button
                type="button"
                onClick={onRescueClick}
                className="flex-1 rounded-[14px] btn-3d font-black !text-[#9A3412] border-none transition-all active:scale-95 shadow-[0_1px_2px_rgba(0,0,0,0.03)] text-[16px] sm:text-[19px] h-11 flex items-center justify-center gap-1.5 px-1"
                style={{ "--cor-topo": "#FFEDD5", "--cor-base": "#FED7AA" } as any}
              >
                <span>💰</span> <span className="truncate">Resgatar</span>
              </Button>
            )}
          {consolidated && (
            <Button
              type="button"
              onClick={() => setIsHistoryOpen(true)}
              className="flex-1 rounded-[14px] btn-3d font-black !text-[#2447A5] transition-all active:scale-95 text-[16px] sm:text-[18px] h-11 flex items-center justify-center gap-1 px-2 !border-[1px] !border-[#BFDBFE]/70 shadow-[inset_0_2px_2px_rgba(255,255,255,0.8),inset_1.5px_0_1.5px_rgba(255,255,255,0.4),inset_-1.5px_0_1.5px_rgba(255,255,255,0.4),0_1px_2px_rgba(36,71,165,0.08)]"
              style={{ "--cor-topo": "#EFF6FF", "--cor-base": "#DBEAFE" } as any}
              title="Ver histórico de aportes"
            >
              <span className="truncate">Aportes ({totalAportes})</span>
              <DynamicIcon name="ChevronRight" className="h-4 w-4 text-[#2447A5] shrink-0" strokeWidth={2.8} />
            </Button>
          )}
        </div>
      )}

      {/* Modal de Histórico de Aportes */}
      {consolidated && (
        <ContributionsHistoryDialog
          isOpen={isHistoryOpen}
          onOpenChange={setIsHistoryOpen}
          investment={investmentToEdit}
          consolidated={consolidated}
          categoryName={categoryDisplayName}
          categoryIcon={allSubcategories.find((c) => c.id === investmentToEdit.nome)?.icone || "TrendingUp"}
          isMobile={isMobile}
        />
      )}
    </div>
  );
};
