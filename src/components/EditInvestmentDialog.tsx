import React, { useState, useEffect, useMemo } from "react";
import {
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useProfile } from "@/hooks/useProfile";
import CurrencyBR from "@/components/ui/currency-br";
import { NumericInput } from "@/components/ui/numeric-input";
import { useToast } from "@/contexts/ToastContext";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Investment, AppCategory } from "@/types/finance";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import DynamicIcon from "./DynamicIcon";
import { cn, getBorderClass, formatCurrency, formatInTimeZone, TARGET_TIMEZONE, getAliquotaIR, calcularRendimentoComCDI, getTipoTributacao, IndexadorHistorico } from "@/lib/utils";
import { Lock } from "lucide-react";

interface EditInvestmentDialogProps {
  investmentToEdit: Investment;
  onUpdateSuccess: () => void;
  onCancelEdit: () => void;
  user: User | null;
  investmentTypes: { value: string; label: string; icon?: string }[];
  isMobile: boolean;
  allSubcategories: AppCategory[];
  incomeInvestmentSubcategories: AppCategory[];
  indexadorMapCDI: Map<string, number>;
  indexadorMapIPCA: Map<string, number>;
  onRescueClick?: () => void;
}

const UNSELECTED_VALUE = "unselected";
// Removido toast styles isolados

export const EditInvestmentDialog: React.FC<EditInvestmentDialogProps> = ({
  investmentToEdit,
  onUpdateSuccess,
  onCancelEdit,
  user,
  investmentTypes,
  isMobile,
  allSubcategories,
  incomeInvestmentSubcategories,
  indexadorMapCDI,
  indexadorMapIPCA,
  onRescueClick,
}) => {
  const { data: profile } = useProfile(user?.id);
  const isExpired = profile?.isExpired;
  const { showErrorToast } = useToast();

  const handleBlockedClick = (e: React.MouseEvent) => {
    e.preventDefault();
    showErrorToast("🔒 Sua assinatura expirou. Renove para voltar a editar seus dados.");
    setTimeout(() => {
      window.dispatchEvent(new Event("open-subscription-modal"));
    }, 2000);
  };

  const [selectedInvestmentCategoryId, setSelectedInvestmentCategoryId] = useState(investmentToEdit.nome);
  const [type, setType] = useState(investmentToEdit.tipo);
  const [amount, setAmount] = useState<number | undefined>(investmentToEdit.valor);
  const [date, setDate] = useState<Date | undefined>(parseISO(investmentToEdit.data));
  const [profitability, setProfitability] = useState<number | undefined>(investmentToEdit.taxa_fixa || undefined);
  const [loading, setLoading] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [tipoRentabilidade, setTipoRentabilidade] = useState<"fixo" | "indexado">(investmentToEdit.tipo_rentabilidade || "fixo");
  const [indexador, setIndexador] = useState<"CDI" | "IPCA">(investmentToEdit.indexador || "CDI");
  const [percentualIndexador, setPercentualIndexador] = useState<number | undefined>(investmentToEdit.percentual_indexador || undefined);
  const [validationErrors, setValidationErrors] = useState<Record<string, boolean>>({});

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
    const cdis = indexadores.filter(i => i.tipo === "CDI");
    if (cdis.length === 0) return 11.15;
    return [...cdis].sort((a, b) => b.data_inicio.localeCompare(a.data_inicio))[0].taxa_anual;
  }, [indexadores]);

  const ipca = useMemo(() => {
    const ipcas = indexadores.filter(i => i.tipo === "IPCA");
    if (ipcas.length === 0) return 4.5;
    const latest = [...ipcas].sort((a, b) => b.data_inicio.localeCompare(a.data_inicio))[0];
    const mensal = latest.taxa_mensal || 0;
    // Anualizar IPCA mensal: (1 + ipcaMensal)^12 - 1
    return (Math.pow(1 + mensal, 12) - 1) * 100;
  }, [indexadores]);

  const taxaEstimada = useMemo(() => {
    if (tipoRentabilidade === "fixo") return profitability || 0;
    if (indexador === "CDI") {
      return (cdi * (percentualIndexador || 100) / 100);
    }
    // IPCA+ (composta conforme instrução): (1 + ipcaAnual) * (1 + taxaReal) - 1
    const ipcaAnualDec = ipca / 100;
    const taxaRealDec = (percentualIndexador || 0) / 100;
    return ((1 + ipcaAnualDec) * (1 + taxaRealDec) - 1) * 100;
  }, [tipoRentabilidade, indexador, percentualIndexador, profitability, cdi, ipca]);

  const metrics = useMemo(() => {
    // Determinar o mapa de indexador correto
    let idxMap: Map<string, number> | undefined;
    if (tipoRentabilidade === "indexado") {
      if (indexador === "CDI") idxMap = indexadorMapCDI;
      else if (indexador === "IPCA") idxMap = indexadorMapIPCA;
    }

    const tipoTributacao = getTipoTributacao({ nome: selectedInvestmentCategoryId }, allSubcategories);

    const { 
      valorAtual: valorLiquido, 
      ultimaTaxaAplicada: taxaDiaria,
      rendimentoBrutoAcumulado: rendimentoBruto,
      irProvisionado: valorIR
    } = calcularRendimentoComCDI({
      valorInicial: amount || 0,
      dataInicio: date || new Date(),
      indexadorMap: idxMap || new Map<string, number>(),
      indexador: indexador ?? "CDI",
      percentualIndexador: tipoRentabilidade === "indexado" ? (percentualIndexador || 100) : 100,
      taxaFixaAnual: tipoRentabilidade === "fixo" ? (profitability || 0) : null,
      tipoTributacao
    });

    const rendimentoLiquido = valorLiquido - (amount || 0);
    
    const investDate = date || new Date();
    const aliquotaIR = getAliquotaIR(investDate, new Date(), tipoTributacao);

    return { 
      tipoTributacao, 
      aliquota: aliquotaIR, 
      rendimentoBruto, 
      rendimentoLiquido, 
      valorTotalLiquido: valorLiquido,
      imposto: valorIR,
      taxaLiquida: taxaEstimada * (1 - aliquotaIR / 100) 
    };
  }, [amount, taxaEstimada, date, allSubcategories, selectedInvestmentCategoryId, indexadorMapCDI, indexadorMapIPCA, tipoRentabilidade, indexador, percentualIndexador, profitability]);

  useEffect(() => {
    setSelectedInvestmentCategoryId(investmentToEdit.nome);
    setType(investmentToEdit.tipo);
    setAmount(investmentToEdit.valor);
    setDate(parseISO(investmentToEdit.data));
    setProfitability(investmentToEdit.tipo_rentabilidade === "fixo" ? (investmentToEdit.taxa_fixa || undefined) : undefined);
    setTipoRentabilidade(investmentToEdit.tipo_rentabilidade || "fixo");
    setIndexador(investmentToEdit.indexador || "CDI");
    setPercentualIndexador(investmentToEdit.percentual_indexador || undefined);
    setValidationErrors({});
  }, [investmentToEdit]);

  const updateInvestmentMutation = useMutation({
    mutationFn: async (updatedInvestment: Investment) => {
      if (!user?.id) throw new Error("Usuário não autenticado.");
      const { data, error } = await supabase
        .from("investimentos")
        .update({
          nome: updatedInvestment.nome,
          tipo: updatedInvestment.tipo,
          valor: Number(updatedInvestment.valor),
          data: updatedInvestment.data,
          tipo_rentabilidade: updatedInvestment.tipo_rentabilidade,
          taxa_fixa: updatedInvestment.taxa_fixa ?? null,
          indexador: updatedInvestment.indexador ?? null,
          percentual_indexador: updatedInvestment.percentual_indexador ?? null,
        })
        .eq("id", updatedInvestment.id)
        .eq("user_id", user.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      onUpdateSuccess();
    },
    onError: (error) => {
      showErrorToast("Erro ao atualizar investimento", error.message);
    },
    onSettled: () => {
      setLoading(false);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const newErrors: Record<string, boolean> = {};
    let hasError = false;

    if (!user) {
      showErrorToast("Usuário não autenticado.");
      setLoading(false);
      return;
    }

    if (!selectedInvestmentCategoryId || selectedInvestmentCategoryId === UNSELECTED_VALUE) {
      newErrors.selectedInvestmentCategoryId = true;
      hasError = true;
    }
    if (amount === undefined || amount <= 0) {
      newErrors.amount = true;
      hasError = true;
    }
    if (tipoRentabilidade === "fixo" && (profitability === undefined || profitability < 0)) {
      newErrors.profitability = true;
      hasError = true;
    }
    if (tipoRentabilidade === "indexado") {
      if (percentualIndexador === undefined || percentualIndexador <= 0) {
        newErrors.percentualIndexador = true;
        hasError = true;
      }
    }
    if (!date) {
      newErrors.date = true;
      hasError = true;
    }

    setValidationErrors(newErrors);
    if (hasError) {
      showErrorToast("Preencha todos os campos obrigatórios");
      setLoading(false);
      return;
    }

    const formattedDate = date ? formatInTimeZone(date, TARGET_TIMEZONE, 'yyyy-MM-dd') : "";

    const updatedInvestment: Investment = {
      ...investmentToEdit,
      nome: selectedInvestmentCategoryId,
      tipo: type,
      valor: amount,
      data: formattedDate,
      tipo_rentabilidade: tipoRentabilidade,
      taxa_fixa: tipoRentabilidade === "fixo" ? profitability : null,
      indexador: tipoRentabilidade === "indexado" ? indexador : null,
      percentual_indexador: tipoRentabilidade === "indexado" ? percentualIndexador : null,
    };

    updateInvestmentMutation.mutate(updatedInvestment);
  };

  return (
    <div className={cn(isMobile ? "space-y-4" : "space-y-5", isMobile && "w-full mx-auto")}>
      <DialogDescription className="sr-only">Resumo e detalhes do investimento.</DialogDescription>
      <div className={cn("space-y-3", isMobile ? "-mt-16" : "-mt-6")}>
        <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-[16px] shadow-sm flex flex-col overflow-hidden">
          
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 bg-slate-50/50 border-b border-slate-100">
            <div className="bg-white p-2 rounded-xl border border-[rgba(0,0,0,0.06)] shadow-sm">
               <DynamicIcon name={allSubcategories.find(c => c.id === investmentToEdit.nome)?.icone || "MoreHorizontal"} className="h-[34px] w-[34px] text-[34px] leading-none text-[#0556C3]" />
            </div>
            <div className="flex flex-col">
              <span className="text-base font-black text-slate-800 leading-tight">
                {allSubcategories.find(c => c.id === investmentToEdit.nome)?.nome || investmentToEdit.nome}
              </span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                {investmentTypes.find(t => t.value === type)?.label || type}
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
              <span className="text-sm font-black text-slate-800">{formatCurrency(amount || 0)}</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                 <DynamicIcon name="TrendingUp" className="h-[18px] w-[18px] text-slate-500" />
                <span className="text-[13px] font-semibold text-slate-500">Rentabilidade</span>
              </div>
              <span className="text-sm font-bold text-slate-700">{tipoRentabilidade === "fixo" ? "Fixa" : "Indexada"}</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                 <DynamicIcon name="BarChart3" className="h-[18px] w-[18px] text-slate-500" />
                <span className="text-[13px] font-semibold text-slate-500">Indexador</span>
              </div>
              <span className="text-sm font-bold text-slate-700">
                {tipoRentabilidade === "fixo" 
                  ? `${Number(profitability || 0).toFixed(2)}% a.a.` 
                  : percentualIndexador 
                    ? (indexador === "IPCA" ? `${indexador} + ${percentualIndexador}%` : `${percentualIndexador}% ${indexador}`)
                    : (indexador || "")}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                 <DynamicIcon name="Calendar" className="h-[18px] w-[18px] text-slate-500" />
                <span className="text-[13px] font-semibold text-slate-500">Data da Aplicação</span>
              </div>
              <span className="text-sm font-bold text-slate-700">
                {date ? format(date, "dd/MM/yyyy", { locale: ptBR }) : ""}
              </span>
            </div>
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
              <span className="text-[#0556C3] text-sm font-black tracking-tight leading-none">{formatCurrency(metrics.valorTotalLiquido)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-row items-center w-full pt-2 gap-2 mt-2">
        {investmentToEdit.origem_investimento === 'saldo_atual' && investmentToEdit.status !== 'resgatado' && onRescueClick && (
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
