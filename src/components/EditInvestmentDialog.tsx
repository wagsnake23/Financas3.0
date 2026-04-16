import React, { useState, useEffect, useMemo } from "react";
import {
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import CurrencyBR from "@/components/ui/currency-br"; // Importar CurrencyBR
import { NumericInput } from "@/components/ui/numeric-input";
import { toast } from "sonner";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Investment, AppCategory } from "@/types/finance"; // Importar AppCategory
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import DynamicIcon from "./DynamicIcon"; // Importar DynamicIcon
import { cn, getBorderClass, formatCurrency, formatInTimeZone, TARGET_TIMEZONE, getAliquotaIR } from "@/lib/utils"; // Importar getBorderClass, formatInTimeZone, TARGET_TIMEZONE, getAliquotaIR
// Removido: import { Card } from "@/components/ui/card"; // Importar Card

interface EditInvestmentDialogProps {
  investmentToEdit: Investment;
  onUpdateSuccess: () => void;
  onCancelEdit: () => void;
  user: User | null;
  investmentTypes: { value: string; label: string; icon?: string }[];
  isMobile: boolean;
  allSubcategories: AppCategory[]; // Nova prop
  incomeInvestmentSubcategories: AppCategory[]; // Nova prop
}

const UNSELECTED_VALUE = "unselected";
const toastDuration = 1000; // 1 segundo para todos os dispositivos
const toastSuccessStyle = { backgroundColor: '#FFFFFF', color: '#006000', border: '1px solid #E5FFE5' };
const toastErrorStyle = { backgroundColor: '#FFFFFF', color: '#FF2929', border: '1px solid #FFE5E5' };

export const EditInvestmentDialog: React.FC<EditInvestmentDialogProps> = ({
  investmentToEdit,
  onUpdateSuccess,
  onCancelEdit,
  user,
  investmentTypes,
  isMobile,
  allSubcategories, // Usar nova prop
  incomeInvestmentSubcategories, // Usar nova prop
}) => {
  const [selectedInvestmentCategoryId, setSelectedInvestmentCategoryId] = useState(investmentToEdit.nome); // Changed from 'name'
  const [type, setType] = useState(investmentToEdit.tipo);
  const [amount, setAmount] = useState<number | undefined>(investmentToEdit.valor);
  const [date, setDate] = useState<Date | undefined>(parseISO(investmentToEdit.data));
  const [profitability, setProfitability] = useState<number | undefined>(investmentToEdit.taxa_fixa || undefined);
  const [loading, setLoading] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [tipoRentabilidade, setTipoRentabilidade] = useState<"fixo" | "indexado">(investmentToEdit.tipo_rentabilidade || "fixo");
  const [indexador, setIndexador] = useState<"CDI" | "IPCA">(investmentToEdit.indexador || "CDI");
  const [percentualIndexador, setPercentualIndexador] = useState<number | undefined>(investmentToEdit.percentual_indexador || undefined);
  const [taxaAdicional, setTaxaAdicional] = useState<number | undefined>(investmentToEdit.taxa_adicional || 0);
  const [validationErrors, setValidationErrors] = useState<Record<string, boolean>>({}); // NOVO ESTADO

  // Fetch active indexers
  const { data: indexadores = [] } = useQuery({
    queryKey: ["indexadores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("indexadores")
        .select("*")
        .is("data_fim", null);
      if (error) throw error;
      return data;
    },
  });

  const cdi = useMemo(() => indexadores.find(i => i.tipo === "CDI")?.taxa_anual || 10.65, [indexadores]);
  const ipca = useMemo(() => indexadores.find(i => i.tipo === "IPCA")?.taxa_anual || 5.0, [indexadores]);

  const taxaEstimada = useMemo(() => {
    if (tipoRentabilidade === "fixo") return profitability || 0;
    const taxaBase = indexador === "CDI" ? cdi : ipca;
    return (taxaBase * (percentualIndexador || 0) / 100) + (taxaAdicional || 0);
  }, [tipoRentabilidade, indexador, percentualIndexador, taxaAdicional, profitability, cdi, ipca]);

  // Cálculo reativo da Rentabilidade Diária (R$) - Padrão Bancário
  const dailyProfitabilityRS = useMemo(() => {
    if (amount === undefined || taxaEstimada === undefined || amount <= 0) return 0;

    // 1) Taxa diária (juros compostos 252 dias úteis)
    const annualRate = taxaEstimada / 100;
    const dailyRate = Math.pow(1 + annualRate, 1 / 252) - 1;

    // 2) Truncar a taxa em 10 casas decimais (padrão financeiro)
    const factor10 = Math.pow(10, 10);
    const dailyRateTruncated = Math.trunc(dailyRate * factor10) / factor10;

    // 3) Cálculo da rentabilidade bruta
    const rawYield = amount * dailyRateTruncated;

    // 4) Arredondamento Bancário (Round Half Even) para 2 casas decimais
    const decimals = 2;
    const m = Math.pow(10, decimals);
    const n = +(rawYield * m).toFixed(8); // Evita erros de precisão do JS
    const i = Math.floor(n);
    const f = n - i;
    const e = 1e-8; // Tolerância para comparação

    const rounded = (f > 0.5 - e && f < 0.5 + e)
      ? (i % 2 === 0 ? i : i + 1)
      : Math.round(n);

    return rounded / m;
  }, [amount, profitability]);

  // Update form fields if investmentToEdit changes (e.g., if user selects another investment quickly)
  useEffect(() => {
    setSelectedInvestmentCategoryId(investmentToEdit.nome); // Update
    setType(investmentToEdit.tipo);
    setAmount(investmentToEdit.valor);
    setDate(parseISO(investmentToEdit.data));
    setProfitability(investmentToEdit.tipo_rentabilidade === "fixo" ? (investmentToEdit.taxa_fixa || undefined) : undefined);
    setTipoRentabilidade(investmentToEdit.tipo_rentabilidade || "fixo");
    setIndexador(investmentToEdit.indexador || "CDI");
    setPercentualIndexador(investmentToEdit.percentual_indexador || undefined);
    setTaxaAdicional(investmentToEdit.taxa_adicional || 0);
    setValidationErrors({}); // Clear errors on new edit
  }, [investmentToEdit]);

  const updateInvestmentMutation = useMutation({
    mutationFn: async (updatedInvestment: Investment) => {
      if (!user?.id) throw new Error("Usuário não autenticado.");
      const { data, error } = await supabase
        .from("investimentos")
        .update({
          nome: updatedInvestment.nome, // This will be the category ID
          tipo: updatedInvestment.tipo,
          valor: updatedInvestment.valor,
          data: updatedInvestment.data,
          tipo_rentabilidade: updatedInvestment.tipo_rentabilidade,
          taxa_fixa: updatedInvestment.taxa_fixa,
          indexador: updatedInvestment.indexador,
          percentual_indexador: updatedInvestment.percentual_indexador,
          taxa_adicional: updatedInvestment.taxa_adicional,
        })
        .eq("id", updatedInvestment.id)
        .eq("user_id", user.id) // Corrigido para user_id
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
      console.error("Supabase error updating investment:", error);
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
      if (!indexador) {
        newErrors.indexador = true;
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

    const formattedDate = date
      ? formatInTimeZone(date, TARGET_TIMEZONE, 'yyyy-MM-dd') // Usar formatInTimeZone
      : "";

    const updatedInvestment: Investment = {
      ...investmentToEdit,
      nome: selectedInvestmentCategoryId, // Store category ID
      tipo: type,
      valor: amount, // Usar o valor como number
      data: formattedDate,
      tipo_rentabilidade: tipoRentabilidade,
      taxa_fixa: tipoRentabilidade === "fixo" ? profitability : null,
      indexador: tipoRentabilidade === "indexado" ? indexador : null,
      percentual_indexador: tipoRentabilidade === "indexado" ? percentualIndexador : null,
      taxa_adicional: tipoRentabilidade === "indexado" ? taxaAdicional : null,
    };

    updateInvestmentMutation.mutate(updatedInvestment);
  };

  return (
    <form onSubmit={handleSubmit} className={cn("space-y-4 pb-2", isMobile && "w-full mx-auto")}>
      <DialogDescription className="sr-only">
        Formulário para editar os detalhes do investimento.
      </DialogDescription>
      <div className={cn("space-y-0.5", isMobile ? "-mt-10" : "-mt-6")}>
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
            <SelectValue placeholder="Selecione o tipo de investimento" />
          </SelectTrigger>
          <SelectContent className="rounded-2xl border-none shadow-xl">
            <SelectItem value={UNSELECTED_VALUE} disabled className={cn(isMobile && "text-sm")}>Selecione o tipo de investimento</SelectItem>
            {incomeInvestmentSubcategories.length === 0 ? (
              <SelectItem value={UNSELECTED_VALUE} disabled className={cn(isMobile && "text-sm")}>Nenhum tipo de investimento disponível</SelectItem>
            ) : (
              incomeInvestmentSubcategories.map(cat => (
                <SelectItem key={cat.id} value={cat.id} className={cn(isMobile && "text-sm")}>
                  <span className="flex items-center gap-2">
                    <span>{cat.icone}</span>
                    <span>{cat.nome}</span>
                  </span>
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>

      <div className={cn(isMobile ? "grid grid-cols-[1.6fr_1fr] gap-2" : "space-y-0.5")}>
        <div className="space-y-0.5">
          <Label htmlFor="edit-type" className={cn(isMobile && "text-xs")}>Tipo</Label>
          <Select value={type} onValueChange={setType} disabled={loading}>
            <SelectTrigger className={cn("rounded-xl w-full bg-white border-slate-300", isMobile && "h-9 text-sm")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-2xl border-none shadow-xl">
              {investmentTypes.map(t => (
                <SelectItem key={t.value} value={t.value} className={cn(isMobile && "text-sm")}>
                  <div className="flex items-center gap-2">
                    {t.icon && <span>{t.icon}</span>}
                    <span>{t.label}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isMobile && (
          <div className="space-y-0.5">
            <Label className={cn(isMobile && "text-xs")}>Estimativa</Label>
            <div className={cn(
              "rounded-xl w-full bg-blue-50/50 border border-blue-200/50 h-10 px-3 flex items-center font-bold text-[#218C5C] select-none text-[12px]",
              isMobile && "h-9",
              "opacity-90"
            )}>
              {taxaEstimada.toFixed(2)}% a.a.
            </div>
          </div>
        )}
      </div>

      <div className={cn(
        "grid gap-2 mb-2",
        tipoRentabilidade === "indexado" ? "grid-cols-2" : "grid-cols-1"
      )}>
        <div className="space-y-1">
          <Label className={cn(isMobile && "text-xs")}>Rentabilidade</Label>
          <Select
            value={tipoRentabilidade}
            onValueChange={(v: "fixo" | "indexado") => {
              setTipoRentabilidade(v);
              if (v === "fixo") {
                setPercentualIndexador(undefined);
                setTaxaAdicional(0);
              } else {
                setProfitability(undefined);
              }
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
        {/* Lado Esquerdo - Linha 1: Valor Investido */}
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

        {/* Lado Direito - Linha 1: Rentabilidade Principal */}
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
              className={cn("rounded-xl w-full bg-white border-slate-300 placeholder:text-slate-300 placeholder:font-normal", isMobile && "h-10 text-sm", getBorderClass({ isInvalid: validationErrors.profitability, isValid: validationErrors.profitability === false }))}
            />
          </div>
        ) : (
          <div className="space-y-0.5">
            <Label className={cn(isMobile && "text-xs")}>% do {indexador || "Indexador"}</Label>
            <NumericInput
              value={percentualIndexador}
              onValueChange={(v) => setPercentualIndexador(v.floatValue)}
              placeholder="Ex: 110,00"
              className={cn(
                "h-10 rounded-xl w-full bg-white border-slate-300 text-sm font-bold placeholder:text-slate-300 placeholder:font-normal",
                getBorderClass({ isInvalid: validationErrors.percentualIndexador })
              )}
            />
          </div>
        )}

        {/* Lado Esquerdo - Linha 2: Estimativa Calculada (Bruta e Líquida) */}
        <div className="space-y-0.5">
          <Label className={cn(isMobile && "text-xs")}>Estimativa (Bruto/IR/Líq.)</Label>
          <div className={cn(
            "rounded-xl w-full bg-blue-50/50 border border-blue-200/50 h-10 px-2 flex flex-col justify-center font-bold text-[#218C5C] select-none text-[10px] opacity-90 leading-tight",
            isMobile && "h-10"
          )}>
            <div>Bruto: {taxaEstimada.toFixed(2)}% a.a.</div>
            <div className="flex justify-between w-full">
              <span className="text-red-500/70">IR: {getAliquotaIR(date || new Date())}%</span>
              <span className="text-[#218C5C]">Líq: {(taxaEstimada * (1 - getAliquotaIR(date || new Date()) / 100)).toFixed(2)}%</span>
            </div>
          </div>
        </div>

        {/* Lado Direito - Linha 2: Taxa Adicional (se houver) */}
        {tipoRentabilidade === "indexado" ? (
          <div className="space-y-0.5">
            <Label className={cn(isMobile && "text-xs")}>Taxa Adicional (% a.a)</Label>
            <NumericInput
              value={taxaAdicional}
              onValueChange={(v) => setTaxaAdicional(v.floatValue)}
              placeholder="Ex: 0,50"
              className="h-10 rounded-xl w-full bg-white border-slate-300 text-sm font-bold placeholder:text-slate-300 placeholder:font-normal"
            />
          </div>
        ) : (
          /* Placeholder para manter o grid alinhado no modo fixo */
          <div className="hidden md:block"></div>
        )}
      </div>

      <div className={cn("space-y-0.5")}>
        <Label htmlFor="edit-date" className={cn(isMobile && "text-xs")}>Data do Investimento</Label>
        <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
          <PopoverTrigger asChild>
            <Button
              variant={"outline"}
              className={cn(
                "w-full justify-start text-left font-normal h-10 rounded-xl bg-white border-slate-300",
                !date && "text-muted-foreground",
                isMobile && "h-9 text-sm",
                getBorderClass({ isInvalid: validationErrors.date, isValid: validationErrors.date === false })
              )}
              disabled={loading}
            >
              <DynamicIcon name="📅" className={cn("mr-2 h-4 w-4 text-primary", isMobile && "h-3.5 w-3.5")} /> {/* Ícone de emoji colorido */}
              {date ? format(date, "PPP", { locale: ptBR }) : <span>Selecione uma data</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className={cn("w-auto p-0", isMobile && "p-1")}>
            <Calendar
              mode="single"
              selected={date}
              onSelect={(selectedDate) => {
                setDate(selectedDate);
                setIsCalendarOpen(false);
                setValidationErrors(prev => ({ ...prev, date: false }));
              }}
              initialFocus
              locale={ptBR}
              showOutsideDays={false}
              className={cn(isMobile && "text-sm")}
            />
          </PopoverContent>
        </Popover>
      </div>

      <div className={cn("grid grid-cols-2 gap-2 w-full pt-2")}>
        <Button
          type="button"
          onClick={onCancelEdit}
          className={cn(
            "flex-1 rounded-[14px] btn-3d font-black text-white border-none transition-all active:scale-95 shadow-[0_2px_4px_rgba(0,0,0,0.05)] text-lg h-11",
            isMobile && "h-11"
          )}
          style={{ "--cor-topo": "#94A3B8", "--cor-base": "#64748B" } as any}
          disabled={loading}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          className={cn(
            "flex-1 rounded-[14px] btn-3d font-black text-white border-none transition-all active:scale-95 shadow-[0_2px_4px_rgba(0,0,0,0.05)] text-lg h-11",
            isMobile && "h-11"
          )}
          style={{ "--cor-topo": "#25AF6A", "--cor-base": "#1AA361" } as any}
          disabled={loading}
        >
          {loading ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </form>
  );
};