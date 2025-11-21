import React, { useState, useEffect } from "react";
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
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import DynamicIcon from "./DynamicIcon";
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

  // Update form fields if investmentToEdit changes (e.g., if user selects another investment quickly)
  useEffect(() => {
    setSelectedInvestmentCategoryId(investmentToEdit.nome); // Update
    setType(investmentToEdit.tipo);
    setAmount(investmentToEdit.valor);
    setDate(parseISO(investmentToEdit.data));
    setProfitability(investmentToEdit.rentabilidade);
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
      toast.error("Erro ao atualizar investimento", { description: error.message });
      console.error("Supabase error updating investment:", error);
    },
    onSettled: () => {
      setLoading(false);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (!user) {
      toast.error("Usuário não autenticado.");
      setLoading(false);
      return;
    }

    if (!selectedInvestmentCategoryId || selectedInvestmentCategoryId === UNSELECTED_VALUE || amount === undefined || profitability === undefined || !date) {
      toast.error("Preencha todos os campos obrigatórios");
      setLoading(false);
      return;
    }

    const formattedDate = date
      ? format(date, 'yyyy-MM-dd')
      : "";

    const updatedInvestment: Investment = {
      ...investmentToEdit,
      nome: selectedInvestmentCategoryId, // Store category ID
      tipo: type,
      valor: amount,
      data: formattedDate,
      rentabilidade: profitability,
    };

    updateInvestmentMutation.mutate(updatedInvestment);
  };

  return (
    <form onSubmit={handleSubmit} className={cn("space-y-4", isMobile && "p-3")}> {/* Removido Card, ajustado padding para mobile */}
      <DialogDescription className="sr-only">
        Formulário para editar os detalhes do investimento.
      </DialogDescription>
      <div className="space-y-2">
        <Label htmlFor="edit-investment-category" className={cn(isMobile && "text-xs")}>Nome do Investimento</Label>
        <Select value={selectedInvestmentCategoryId} onValueChange={setSelectedInvestmentCategoryId} disabled={loading}>
          <SelectTrigger id="edit-investment-category" className={cn("rounded-xl", isMobile && "h-9 text-sm")}>
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

      <div className="space-y-2">
        <Label htmlFor="edit-type" className={cn(isMobile && "text-xs")}>Tipo</Label>
        <Select value={type} onValueChange={setType} disabled={loading}>
          <SelectTrigger className={cn("rounded-xl", isMobile && "h-9 text-sm")}>
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

      <div className={cn("grid gap-4", isMobile ? "grid-cols-2 gap-2" : "grid-cols-1")}> {/* Ajustado gap para mobile */}
        <div className="space-y-2">
          <Label htmlFor="edit-amount" className={cn(isMobile && "text-xs")}>Valor Investido (R$)</Label>
          <CurrencyBR
            value={amount}
            onChange={(v) => setAmount(v)}
            disabled={loading}
            className={cn("rounded-xl", isMobile && "h-9 text-sm")}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="edit-profitability" className={cn(isMobile && "text-xs")}>Rentabilidade</Label>
          <NumericInput
            id="edit-profitability"
            value={profitability}
            onValueChange={(values) => setProfitability(values.floatValue)}
            required
            disabled={loading}
            className={cn("rounded-xl", isMobile && "h-9 text-sm")}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="edit-date" className={cn(isMobile && "text-xs")}>Data do Investimento</Label>
        <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
          <PopoverTrigger asChild>
            <Button
              variant={"outline"}
              className={cn(
                "w-full justify-start text-left font-normal h-10 rounded-xl",
                !date && "text-muted-foreground",
                isMobile && "h-9 text-sm"
              )}
              disabled={loading}
            >
              <CalendarIcon className={cn("mr-2 h-4 w-4", isMobile && "h-3.5 w-3.5")} />
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
              }}
              initialFocus
              locale={ptBR}
              showOutsideDays={false}
              className={cn(isMobile && "text-sm")}
            />
          </PopoverContent>
        </Popover>
      </div>

      <div className="flex gap-2">
        <Button type="submit" className={cn("flex-1 rounded-xl", isMobile && "h-9 text-sm")} size="lg" disabled={loading}>
          {loading ? "Atualizando..." : "Atualizar Investimento"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onCancelEdit}
          className={cn("flex-1 rounded-xl", isMobile && "h-9 text-sm")}
          size="lg"
          disabled={loading}
        >
          <DynamicIcon name="XCircle" className={cn("mr-2 h-4 w-4", isMobile && "h-3.5 w-3.5")} />
          Cancelar
        </Button>
      </div>
    </form>
  );
};