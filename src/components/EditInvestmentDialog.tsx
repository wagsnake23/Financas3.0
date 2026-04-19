import React, { useState, useEffect, useMemo } from "react";
import {
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import CurrencyBR from "@/components/ui/currency-br";
import { NumericInput } from "@/components/ui/numeric-input";
import { toast } from "sonner";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Investment, AppCategory } from "@/types/finance";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import DynamicIcon from "./DynamicIcon";
import { cn, getBorderClass, formatCurrency, formatInTimeZone, TARGET_TIMEZONE, getAliquotaIR, calcularRendimentoComCDI, getTipoTributacao, IndexadorHistorico } from "@/lib/utils";

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
}

const UNSELECTED_VALUE = "unselected";
const toastDuration = 1000;
const toastSuccessStyle = { backgroundColor: '#FFFFFF', color: '#006000', border: '1px solid #E5FFE5' };
const toastErrorStyle = { backgroundColor: '#FFFFFF', color: '#FF2929', border: '1px solid #FFE5E5' };

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
}) => {
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
      toast.error("Erro ao atualizar investimento", { description: error.message, duration: toastDuration, style: toastErrorStyle });
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
      toast.error("Usuário não autenticado.", { duration: toastDuration, style: toastErrorStyle });
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
      toast.error("Preencha todos os campos obrigatórios", { duration: toastDuration, style: toastErrorStyle });
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
    <form onSubmit={handleSubmit} className={cn(isMobile ? "space-y-2.5" : "space-y-4", isMobile && "w-full mx-auto")}>
      <DialogDescription className="sr-only">Formulário para editar os detalhes do investimento.</DialogDescription>
      <div className={cn("space-y-0.5", isMobile ? "-mt-16" : "-mt-6")}>
        <Label htmlFor="edit-investment-category" className={cn(isMobile && "text-xs")}>Nome do Investimento</Label>
        <Select
          value={selectedInvestmentCategoryId}
          onValueChange={(value) => {
            setSelectedInvestmentCategoryId(value);
            setValidationErrors(prev => ({ ...prev, selectedInvestmentCategoryId: false }));
          }}
          disabled={loading}
        >
          <SelectTrigger id="edit-investment-category" className={cn("rounded-xl w-full bg-white border-slate-400/30 font-bold", isMobile && "h-9 text-sm", getBorderClass({ isInvalid: validationErrors.selectedInvestmentCategoryId, isValid: validationErrors.selectedInvestmentCategoryId === false }))}>
            <SelectValue placeholder="Selecione o investimento" />
          </SelectTrigger>
          <SelectContent className="rounded-2xl border-none shadow-xl">
            <SelectItem value={UNSELECTED_VALUE} disabled className={cn(isMobile && "text-sm")}>Selecione o investimento</SelectItem>
            {incomeInvestmentSubcategories.map(cat => (
              <SelectItem key={cat.id} value={cat.id} className={cn(isMobile && "text-sm")}>
                <span className="flex items-center gap-2">
                  <span>{cat.icone}</span>
                  <span>{cat.nome}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className={cn("grid grid-cols-2 gap-x-4 gap-y-4")}>
        <div className="space-y-1">
          <Label className={cn(isMobile && "text-xs")}>Rentabilidade</Label>
          <Select
            value={tipoRentabilidade}
            onValueChange={(v: "fixo" | "indexado") => {
              setTipoRentabilidade(v);
              if (v === "fixo") setPercentualIndexador(undefined);
              else setProfitability(undefined);
            }}
          >
            <SelectTrigger className={cn("rounded-xl bg-white border-slate-400/30 transition-all duration-200 font-bold", isMobile && "h-10 text-sm")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-2xl border-none shadow-xl">
              <SelectItem value="fixo" className="text-sm">Fixa</SelectItem>
              <SelectItem value="indexado" className="text-sm">Indexada</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {tipoRentabilidade === "indexado" ? (
          <div className="space-y-1 animate-in fade-in slide-in-from-left-2 duration-300">
            <Label className={cn(isMobile && "text-xs")}>Indexador</Label>
            <Select value={indexador} onValueChange={(v) => setIndexador(v as "CDI" | "IPCA")}>
              <SelectTrigger className={cn("rounded-xl bg-white border-slate-400/30 transition-all duration-200 font-bold", isMobile && "h-10 text-sm")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-2xl border-none shadow-xl">
                <SelectItem value="CDI" className="text-sm">CDI</SelectItem>
                <SelectItem value="IPCA" className="text-sm">IPCA</SelectItem>
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div className="hidden sm:block" />
        )}

        <div className="space-y-0.5">
          <Label htmlFor="edit-amount" className={cn(isMobile && "text-xs")}>Valor Investido (R$)</Label>
          <CurrencyBR
            value={amount}
            onChange={(v) => {
              setAmount(v);
              setValidationErrors(prev => ({ ...prev, amount: false }));
            }}
            disabled={loading}
            className={cn("rounded-xl w-full bg-white border-slate-400/30 font-bold", isMobile && "h-10 text-sm", getBorderClass({ isInvalid: validationErrors.amount, isValid: validationErrors.amount === false }))}
          />
        </div>

        {tipoRentabilidade === "fixo" ? (
          <div className="space-y-0.5">
            <Label htmlFor="edit-profitability" className={cn(isMobile && "text-xs")}>Rentabilidade % a.a</Label>
            <NumericInput
              id="edit-profitability"
              value={profitability}
              onValueChange={(values) => {
                setProfitability(values.floatValue);
                setValidationErrors(prev => ({ ...prev, profitability: false }));
              }}
              required
              disabled={loading}
              decimalScale={4}
              fixedDecimalScale={false}
              maxLength={7}
              placeholder="0,0000"
              className={cn("rounded-xl w-full bg-white border-slate-400/30 text-sm font-bold placeholder:text-slate-300 placeholder:font-normal", isMobile && "h-10 text-sm", getBorderClass({ isInvalid: validationErrors.profitability, isValid: validationErrors.profitability === false }))}
            />
          </div>
        ) : (
          <div className="space-y-0.5">
            <Label className={cn(isMobile && "text-xs")}>% do {indexador || "Indexador"}</Label>
            <NumericInput
              value={percentualIndexador}
              onValueChange={(v) => setPercentualIndexador(v.floatValue)}
              placeholder="0,00"
              className={cn("h-10 rounded-xl w-full bg-white border-slate-400/30 text-sm font-bold placeholder:text-slate-300 placeholder:font-normal", getBorderClass({ isInvalid: validationErrors.percentualIndexador }))}
            />
          </div>
        )}

        <div className="space-y-0.5 col-span-2">
          <Label htmlFor="edit-date" className={cn(isMobile && "text-xs")}>Data do Investimento</Label>
          <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
            <PopoverTrigger asChild>
              <Button variant={"outline"} className={cn("w-full justify-start text-left font-bold h-10 rounded-xl bg-white border-slate-400/30", !date && "text-muted-foreground", isMobile && "h-9 text-sm", getBorderClass({ isInvalid: validationErrors.date, isValid: validationErrors.date === false }))} disabled={loading}>
                <DynamicIcon name="📅" className={cn("mr-2 h-4 w-4 text-primary", isMobile && "h-3.5 w-3.5")} />
                {date ? format(date, "PPP", { locale: ptBR }) : <span>Selecione uma data</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className={cn("w-auto p-0", isMobile && "p-1")}>
              <Calendar mode="single" selected={date} onSelect={(sd) => { setDate(sd); setIsCalendarOpen(false); setValidationErrors(p => ({ ...p, date: false })); }} initialFocus locale={ptBR} showOutsideDays={false} className={cn(isMobile && "text-sm")} />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-0.5 col-span-2">
          <div 
            className="rounded-xl w-full h-[84px] px-3 flex items-center font-bold select-none text-[10px] opacity-95 leading-tight relative z-0"
            style={{
              background: "linear-gradient(135deg, #f4f8f6 0%, #edf4f0 60%, rgba(34, 197, 94, 0.10) 100%)",
              backgroundBlendMode: "soft-light",
              backdropFilter: "blur(6px)",
              border: "1px solid rgba(0,0,0,0.06)",
              outline: "1px solid rgba(34, 197, 94, 0.08)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.6), inset 0 -4px 10px rgba(0,0,0,0.03), inset 0 0 12px rgba(34, 197, 94, 0.12)"
            }}
          >
            <div className="flex justify-between w-full items-center">
              {/* Coluna Esquerda */}
              <div className="flex flex-col gap-1.5 justify-center h-full text-left">
                <div className="flex flex-col">
                  <span className="text-slate-600 text-[9px] uppercase tracking-wider leading-none mb-0.5 font-black">Rentabilidade Líquida</span>
                  <span className="text-success text-sm font-bold leading-tight">{metrics.taxaLiquida.toFixed(2)}% a.a.</span>
                </div>
                <div className="flex flex-col pt-1 border-t border-blue-200/30">
                  <span className="text-slate-600 text-[9px] uppercase tracking-wider leading-none mb-0.5 font-black">Rendimento Líquido</span>
                  <span className="text-success text-sm font-bold leading-none">+ {formatCurrency(metrics.rendimentoLiquido)}</span>
                </div>
              </div>

              {/* Coluna Direita */}
              <div className="flex flex-col gap-1.5 items-end h-full justify-center text-right">
                <div className="flex flex-col items-end">
                  <span className="text-slate-600 text-[9px] uppercase tracking-wider leading-none mb-0.5 font-black">Imposto de Renda</span>
                  {metrics.tipoTributacao === "isento" ? (
                    <span className="text-[#218C5C] text-sm font-black uppercase tracking-wider">Isento</span>
                  ) : (
                    <span className="text-red-500 text-sm uppercase font-bold tracking-wider">
                      {metrics.aliquota}% <span className="text-red-500/50 mx-0.5">|</span> -{formatCurrency(metrics.imposto)}
                    </span>
                  )}
                </div>
                <div className="flex flex-col items-end pt-1 border-t border-blue-200/30">
                  <span className="text-slate-600 text-[9px] uppercase tracking-wider leading-none mb-0.5 font-black">Saldo Líquido Total</span>
                  <span className="text-[#0556C3] text-sm font-black tracking-tight leading-none">{formatCurrency(metrics.valorTotalLiquido)}</span>
                </div>
            </div>
          </div>
        </div>
      </div>
    </div>

      <div className={cn("grid grid-cols-2 gap-2 w-full pt-2")}>
        <Button 
          type="button" 
          onClick={onCancelEdit} 
          className={cn("flex-1 rounded-[14px] btn-3d font-black !text-slate-700 border border-slate-300 transition-all active:scale-95 text-lg h-11", isMobile && "h-11")} 
          style={{ 
            "--cor-topo": "#E2E8F0", 
            "--cor-base": "#CBD5E1",
            boxShadow: "inset 0px 1px 1px rgba(255, 255, 255, 0.4), inset 0px -1px 0px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0,0,0,0.05)"
          } as any} 
          disabled={loading}
        >
          Cancelar
        </Button>
        <Button type="submit" className={cn("flex-1 rounded-[14px] btn-3d font-black text-white border-none transition-all active:scale-95 shadow-[0_2px_4px_rgba(0,0,0,0.05)] text-lg h-11", isMobile && "h-11")} style={{ "--cor-topo": "#25AF6A", "--cor-base": "#1AA361" } as any} disabled={loading}>{loading ? "Salvando..." : "Salvar"}</Button>
      </div>
    </form>
  );
};