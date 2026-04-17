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
import { cn, getBorderClass, formatCurrency, formatInTimeZone, TARGET_TIMEZONE, getAliquotaIR, calcularRendimentoComCDI } from "@/lib/utils";

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
        .select("tipo, taxa_anual, data_inicio, taxa_diaria");
      if (error) throw error;
      return data;
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
    return [...ipcas].sort((a, b) => b.data_inicio.localeCompare(a.data_inicio))[0].taxa_anual;
  }, [indexadores]);

  const taxaEstimada = useMemo(() => {
    if (tipoRentabilidade === "fixo") return profitability || 0;
    const taxaBase = indexador === "CDI" ? cdi : ipca;
    return (taxaBase * (percentualIndexador || 100) / 100);
  }, [tipoRentabilidade, indexador, percentualIndexador, profitability, cdi, ipca]);

  const metrics = useMemo(() => {
    // Determinar o mapa de indexador correto
    let idxMap: Map<string, number> | undefined;
    if (tipoRentabilidade === "indexado") {
      if (indexador === "CDI") idxMap = indexadorMapCDI;
      else if (indexador === "IPCA") idxMap = indexadorMapIPCA;
    }

    // Cálculo de rendimento usando dados históricos (Engine Real - MESMA DA LISTA)
    const { valorAtual: valorAtualVirtual, ultimaTaxaAplicada } = calcularRendimentoComCDI({
      valorInicial: amount || 0,
      dataInicio: date || new Date(),
      indexadorMap: idxMap || new Map<string, number>(),
      percentualIndexador: tipoRentabilidade === "indexado" ? (percentualIndexador || 100) : 100,
      taxaFixaAnual: tipoRentabilidade === "fixo" ? (profitability || 0) : null,
    });

    const rendimentoBruto = valorAtualVirtual - (amount || 0);

    const categoria = allSubcategories.find(c => c.id === selectedInvestmentCategoryId);
    const tipoTributacao = categoria?.tipo_tributacao ?? "regressivo";
    const investDate = date || new Date();
    
    // Aliquota real based on duration
    const hoje = new Date();
    hoje.setHours(0,0,0,0);
    const diffTime = Math.abs(hoje.getTime() - investDate.getTime());
    const diffDias = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    const aliquota = getAliquotaIR(investDate, tipoTributacao);

    // imposto apenas sobre lucro
    const imposto = (rendimentoBruto > 0 && diffDias > 0) ? rendimentoBruto * (aliquota / 100) : 0;
    const rendimentoLiquido = rendimentoBruto - imposto;

    const taxaLiquida = taxaEstimada * (1 - (rendimentoBruto > 0 ? aliquota : 0) / 100);
    const valorTotalLiquido = (amount || 0) + rendimentoLiquido;

    return { imposto, aliquota: (rendimentoBruto > 0 ? aliquota : 0), taxaLiquida, tipoTributacao, rendimentoLiquido, valorTotalLiquido };
  }, [amount, taxaEstimada, date, allSubcategories, selectedInvestmentCategoryId, indexadorMapCDI, indexadorMapIPCA]);

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
          <SelectTrigger id="edit-investment-category" className={cn("rounded-xl w-full bg-white border-slate-300", isMobile && "h-9 text-sm", getBorderClass({ isInvalid: validationErrors.selectedInvestmentCategoryId, isValid: validationErrors.selectedInvestmentCategoryId === false }))}>
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

      <div className={cn("grid gap-2 mb-2", tipoRentabilidade === "indexado" ? "grid-cols-2" : "grid-cols-1")}>
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
            <SelectTrigger className={cn("rounded-xl bg-white border-slate-300 transition-all duration-200", isMobile && "h-10 text-sm")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-2xl border-none shadow-xl">
              <SelectItem value="fixo" className="text-sm">Fixa</SelectItem>
              <SelectItem value="indexado" className="text-sm">Indexada</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {tipoRentabilidade === "indexado" && (
          <div className="space-y-1 animate-in fade-in slide-in-from-left-2 duration-300">
            <Label className={cn(isMobile && "text-xs")}>Indexador</Label>
            <Select value={indexador} onValueChange={(v) => setIndexador(v as "CDI" | "IPCA")}>
              <SelectTrigger className={cn("rounded-xl bg-white border-slate-300 transition-all duration-200", isMobile && "h-10 text-sm")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-2xl border-none shadow-xl">
                <SelectItem value="CDI" className="text-sm">CDI</SelectItem>
                <SelectItem value="IPCA" className="text-sm">IPCA</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className={cn("grid grid-cols-2 gap-x-4 gap-y-4")}>
        <div className="space-y-0.5">
          <Label htmlFor="edit-amount" className={cn(isMobile && "text-xs")}>Valor Investido (R$)</Label>
          <CurrencyBR
            value={amount}
            onChange={(v) => {
              setAmount(v);
              setValidationErrors(prev => ({ ...prev, amount: false }));
            }}
            disabled={loading}
            className={cn("rounded-xl w-full bg-white border-slate-300", isMobile && "h-10 text-sm", getBorderClass({ isInvalid: validationErrors.amount, isValid: validationErrors.amount === false }))}
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
              className={cn("rounded-xl w-full bg-white border-slate-300 text-sm font-bold placeholder:text-slate-300 placeholder:font-normal", isMobile && "h-10 text-sm", getBorderClass({ isInvalid: validationErrors.profitability, isValid: validationErrors.profitability === false }))}
            />
          </div>
        ) : (
          <div className="space-y-0.5">
            <Label className={cn(isMobile && "text-xs")}>% do {indexador || "Indexador"}</Label>
            <NumericInput
              value={percentualIndexador}
              onValueChange={(v) => setPercentualIndexador(v.floatValue)}
              placeholder="0,00"
              className={cn("h-10 rounded-xl w-full bg-white border-slate-300 text-sm font-bold placeholder:text-slate-300 placeholder:font-normal", getBorderClass({ isInvalid: validationErrors.percentualIndexador }))}
            />
          </div>
        )}

        <div className="space-y-0.5 col-span-2">
          <Label htmlFor="edit-date" className={cn(isMobile && "text-xs")}>Data do Investimento</Label>
          <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
            <PopoverTrigger asChild>
              <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal h-10 rounded-xl bg-white border-slate-300", !date && "text-muted-foreground", isMobile && "h-9 text-sm", getBorderClass({ isInvalid: validationErrors.date, isValid: validationErrors.date === false }))} disabled={loading}>
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
          <div className="rounded-xl w-full bg-blue-50/50 border border-blue-200/50 h-16 px-3 flex items-center font-bold select-none text-[10px] opacity-95 leading-tight">
            <div className="flex justify-between w-full items-center">
              <div className="flex flex-col gap-1 justify-center h-full text-left">
                <div className="flex flex-col">
                  <span className="text-[#218C5C]/60 text-[9px] uppercase tracking-wider leading-none">Bruta: {taxaEstimada.toFixed(2)}% a.a.</span>
                  <span className="text-[#218C5C] text-[11px] font-black leading-tight">Líquida: {metrics.taxaLiquida.toFixed(2)}% a.a.</span>
                </div>
                <div className="flex flex-col pt-0.5 border-t border-blue-200/30">
                  <span className="text-gray-400 text-[8px] uppercase tracking-[0.1em] leading-none mb-0.5">Saldo Líquido Total</span>
                  <span className="text-[#0556C3] text-[14px] font-black tracking-tight leading-none">{formatCurrency(metrics.valorTotalLiquido)}</span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 text-right">
                {metrics.tipoTributacao === "isento" ? (
                  <span className="text-[#218C5C] text-[9px] font-black uppercase tracking-wider">Isento de IR</span>
                ) : (
                  <span className="text-red-500 text-[10px] uppercase font-bold tracking-wider">IR {metrics.aliquota}% <span className="text-red-500/50 mx-0.5">|</span> -{formatCurrency(metrics.imposto)}</span>
                )}
                <div className="flex flex-col items-end pt-0.5">
                  <span className="text-gray-400 text-[8px] uppercase tracking-[0.1em] leading-none mb-0.5">Rendimento Líquido</span>
                  <span className="text-success text-[14px] font-black leading-none">+ {formatCurrency(metrics.rendimentoLiquido)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={cn("grid grid-cols-2 gap-2 w-full pt-0")}>
        <Button type="button" onClick={onCancelEdit} className={cn("flex-1 rounded-[14px] btn-3d font-black text-white border-none transition-all active:scale-95 shadow-[0_2px_4px_rgba(0,0,0,0.05)] text-lg h-11", isMobile && "h-11")} style={{ "--cor-topo": "#94A3B8", "--cor-base": "#64748B" } as any} disabled={loading}>Cancelar</Button>
        <Button type="submit" className={cn("flex-1 rounded-[14px] btn-3d font-black text-white border-none transition-all active:scale-95 shadow-[0_2px_4px_rgba(0,0,0,0.05)] text-lg h-11", isMobile && "h-11")} style={{ "--cor-topo": "#25AF6A", "--cor-base": "#1AA361" } as any} disabled={loading}>{loading ? "Salvando..." : "Salvar"}</Button>
      </div>
    </form>
  );
};