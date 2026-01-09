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
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Investment, AppCategory } from "@/types/finance"; // Importar AppCategory
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import DynamicIcon from "./DynamicIcon"; // Importar DynamicIcon
import { cn, getBorderClass, formatCurrency, formatInTimeZone, TARGET_TIMEZONE } from "@/lib/utils"; // Importar getBorderClass, formatInTimeZone, TARGET_TIMEZONE
// Removido: import { Card } from "@/components/ui/card"; // Importar Card

interface EditInvestmentDialogProps {
  investmentToEdit: Investment;
  onUpdateSuccess: () => void;
  onCancelEdit: () => void;
  user: User | null;
  investmentTypes: { value: string; label: string }[];
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
  const [profitability, setProfitability] = useState<number | undefined>(investmentToEdit.rentabilidade);
  const [loading, setLoading] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, boolean>>({}); // NOVO ESTADO

  // Cálculo reativo da Rentabilidade Diária (R$) - Padrão Bancário
  const dailyProfitabilityRS = useMemo(() => {
    if (amount === undefined || profitability === undefined || amount <= 0) return 0;

    // 1) Taxa diária (juros compostos 252 dias úteis)
    const annualRate = profitability / 100;
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
    setProfitability(investmentToEdit.rentabilidade);
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
          rentabilidade: updatedInvestment.rentabilidade,
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
    if (profitability === undefined || profitability < 0) {
      newErrors.profitability = true;
      hasError = true;
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
      rentabilidade: profitability, // Usar o valor como number
    };

    updateInvestmentMutation.mutate(updatedInvestment);
  };

  return (
    <form onSubmit={handleSubmit} className={cn("space-y-4 pb-2", isMobile && "max-w-[280px] mx-auto")}>
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
          <SelectTrigger id="edit-investment-category" className={cn("rounded-xl w-full bg-white border-[#E5E0FF]", isMobile && "h-9 text-sm", getBorderClass({ isInvalid: validationErrors.selectedInvestmentCategoryId, isValid: validationErrors.selectedInvestmentCategoryId === false }))}>
            <SelectValue placeholder="Selecione o tipo de investimento" />
          </SelectTrigger>
          <SelectContent>
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

      <div className={cn("space-y-0.5")}>
        <Label htmlFor="edit-type" className={cn(isMobile && "text-xs")}>Tipo</Label>
        <Select value={type} onValueChange={setType} disabled={loading}>
          <SelectTrigger className={cn("rounded-xl w-full bg-white border-[#E5E0FF]", isMobile && "h-9 text-sm")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {investmentTypes.map(t => (
              <SelectItem key={t.value} value={t.value} className={cn(isMobile && "text-sm")}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className={cn("grid gap-4", isMobile ? "grid-cols-2 gap-2" : "grid-cols-1")}>
        <div className="space-y-0.5">
          <Label htmlFor="edit-amount" className={cn(isMobile && "text-xs")}>Valor Investido (R$)</Label>
          <CurrencyBR
            value={amount}
            onChange={(v) => {
              setAmount(v);
              setValidationErrors(prev => ({ ...prev, amount: false }));
            }}
            disabled={loading}
            className={cn("rounded-xl w-full bg-white border-[#E5E0FF]", isMobile && "h-9 text-sm", getBorderClass({ isInvalid: validationErrors.amount, isValid: validationErrors.amount === false }))}
          />
        </div>

        <div className={cn("grid gap-4", isMobile ? "grid-cols-1" : "grid-cols-2")}>
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
              className={cn("rounded-xl w-full bg-white border-[#E5E0FF]", isMobile && "h-9 text-sm", getBorderClass({ isInvalid: validationErrors.profitability, isValid: validationErrors.profitability === false }))}
            />
          </div>

          {!isMobile && (
            <div className="space-y-0.5 animate-fade-in">
              <Label className="text-xs">Rentabilidade Diária (R$)</Label>
              <div className={cn(
                "rounded-xl w-full bg-gray-50 border border-[#E5E0FF] h-10 px-3 flex items-center font-semibold text-emerald-600 select-none",
                "opacity-80"
              )}>
                {formatCurrency(dailyProfitabilityRS)}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className={cn("space-y-0.5")}>
        <Label htmlFor="edit-date" className={cn(isMobile && "text-xs")}>Data do Investimento</Label>
        <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
          <PopoverTrigger asChild>
            <Button
              variant={"outline"}
              className={cn(
                "w-full justify-start text-left font-normal h-10 rounded-xl bg-white border-[#E5E0FF]",
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
          // Removido: variant="outline"
          onClick={onCancelEdit}
          className={cn(
            "flex-1 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors",
            isMobile && "h-9 text-sm"
          )}
          size="lg"
          disabled={loading}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          className={cn(
            "flex-1 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 border-transparent shadow-md transition-all hover:shadow-lg",
            isMobile && "h-9 text-sm"
          )}
          size="lg"
          disabled={loading}
        >
          {loading ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </form>
  );
};