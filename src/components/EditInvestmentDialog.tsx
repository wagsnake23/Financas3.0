import React, { useMemo } from "react";
import { DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Investment, AppCategory } from "@/types/finance";
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

interface EditInvestmentDialogProps {
  investmentToEdit: Investment;
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
}

export const EditInvestmentDialog: React.FC<EditInvestmentDialogProps> = ({
  investmentToEdit,
  onCancelEdit,
  investmentTypes,
  isMobile,
  allSubcategories,
  indexadorMapCDI,
  indexadorMapIPCA,
  onRescueClick,
}) => {
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

  const metrics = useMemo(() => {
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
      percentualIndexador: investmentToEdit.tipo_rentabilidade === "indexado" ? (investmentToEdit.percentual_indexador || 100) : 100,
      taxaFixaAnual: investmentToEdit.tipo_rentabilidade === "fixo" ? (investmentToEdit.taxa_fixa || 0) : null,
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
    };
  }, [investmentToEdit, taxaEstimada, allSubcategories, indexadorMapCDI, indexadorMapIPCA]);

  return (
    <div className={cn(isMobile ? "space-y-4" : "space-y-5", isMobile && "w-full mx-auto")}>
      <DialogDescription className="sr-only">Resumo e detalhes do investimento.</DialogDescription>
      <div className={cn("space-y-3", isMobile ? "-mt-16" : "-mt-6")}>
        <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-[16px] shadow-sm flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 bg-slate-50/50 border-b border-slate-100">
            <div className="bg-white p-2 rounded-xl border border-[rgba(0,0,0,0.06)] shadow-sm">
              <DynamicIcon
                name={allSubcategories.find((c) => c.id === investmentToEdit.nome)?.icone || "MoreHorizontal"}
                className="h-[34px] w-[34px] text-[34px] leading-none text-[#0556C3]"
              />
            </div>
            <div className="flex flex-col">
              <span className="text-base font-black text-slate-800 leading-tight">
                {allSubcategories.find((c) => c.id === investmentToEdit.nome)?.nome || investmentToEdit.nome}
              </span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                {investmentTypes.find((t) => t.value === investmentToEdit.tipo)?.label || investmentToEdit.tipo}
              </span>
            </div>
          </div>

          {/* List Items */}
          <div className="flex flex-col p-4 gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <DynamicIcon name="DollarSign" className="h-[18px] w-[18px] text-slate-500" />
                <span className="text-[13px] font-semibold text-slate-500">Valor Aplicado</span>
              </div>
              <span className="text-sm font-black text-slate-800">{formatCurrency(investmentToEdit.valor || 0)}</span>
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
                <span className="text-[13px] font-semibold text-slate-500">Data da Aplicação</span>
              </div>
              <span className="text-sm font-bold text-slate-700">
                {investmentToEdit.data ? format(parseISO(investmentToEdit.data.split("T")[0]), "dd/MM/yyyy", { locale: ptBR }) : ""}
              </span>
            </div>

            {/* Data de Vencimento: Exibida APENAS quando preenchida (sem linha vazia se for null) */}
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

          {/* Resumo Financeiro */}
          <div className="flex flex-col p-4 pt-3 gap-3 select-none">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-semibold text-slate-500">Rentabilidade líquida</span>
              <span className="text-success text-sm font-bold leading-tight">{metrics.taxaLiquida.toFixed(2)}% a.a.</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[13px] font-semibold text-slate-500">Imposto de renda</span>
              {metrics.tipoTributacao === "isento" ? (
                <span className="text-[#218C5C] text-sm font-black uppercase tracking-wider">Isento</span>
              ) : (
                <span className="text-red-500 text-sm font-bold">
                  {metrics.aliquota}% <span className="text-red-500/50 mx-0.5">|</span> -{formatCurrency(metrics.imposto)}
                </span>
              )}
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[13px] font-semibold text-slate-500">Rendimento líquido</span>
              <span className="text-success text-sm font-bold leading-none">+ {formatCurrency(metrics.rendimentoLiquido)}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[13px] font-semibold text-slate-500">Saldo líquido total</span>
              <span className="text-[#0556C3] text-sm font-black tracking-tight leading-none">
                {formatCurrency(metrics.valorTotalLiquido)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Controles de Ação do Modal: Apenas Resgatar e Fechar (Sem botão Salvar) */}
      <div className="flex flex-row items-center w-full pt-2 gap-2 mt-2">
        {investmentToEdit.origem_investimento === "saldo_atual" && investmentToEdit.status !== "resgatado" && onRescueClick && (
          <Button
            type="button"
            onClick={onRescueClick}
            className="flex-1 rounded-[14px] btn-3d font-black !text-[#9A3412] border-none transition-all active:scale-95 shadow-[0_1px_2px_rgba(0,0,0,0.03)] text-[16px] sm:text-[19px] h-11 flex items-center justify-center gap-1.5 px-1"
            style={{ "--cor-topo": "#FFEDD5", "--cor-base": "#FED7AA" } as any}
          >
            <span>💰</span> <span className="truncate">Resgatar</span>
          </Button>
        )}
        <Button
          type="button"
          onClick={onCancelEdit}
          className="flex-1 rounded-[14px] btn-3d font-black !text-[#1E40AF] transition-all active:scale-95 text-[17px] sm:text-[19px] h-11 flex items-center justify-center !border-[1px] !border-[#A5B4FC]/40 shadow-[inset_0_2px_2px_rgba(255,255,255,0.8),inset_1.5px_0_1.5px_rgba(255,255,255,0.4),inset_-1.5px_0_1.5px_rgba(255,255,255,0.4),0_1px_2px_rgba(0,0,0,0.03)]"
          style={{ "--cor-topo": "#C7D2FE", "--cor-base": "#A5B4FC" } as any}
        >
          Fechar
        </Button>
      </div>
    </div>
  );
};
