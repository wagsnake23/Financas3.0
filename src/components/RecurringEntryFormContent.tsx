import React, { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";
import DynamicIcon from "./DynamicIcon";
import { AppCategory } from "@/types/finance";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useRecurringEntries } from "@/hooks/useRecurringEntries";
import { TablesInsert, Enums, Tables, TablesUpdate } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { AddCardDialog } from "./AddCardDialog";
import ManageCardsDialog from "./ManageCardsDialog";
import { CurrencyInput } from "@/components/ui/currency-input";
import { TransactionStatusToggle } from "./expense-form/TransactionStatusToggle";

interface RecurringEntryFormContentProps {
  isMobile: boolean;
  onSuccess?: () => void;
  fetchedCategories: AppCategory[];
  isLoadingCategories: boolean;
  initialType?: Enums<'recurring_type'>;
}

const UNSELECTED_VALUE = "unselected";

export const RecurringEntryFormContent: React.FC<RecurringEntryFormContentProps> = ({ 
  isMobile, 
  onSuccess, 
  fetchedCategories, 
  isLoadingCategories,
  initialType = "despesa"
}) => {
  const { user } = useAuth();
  const { createRecurringEntry, createOrUpdateException } = useRecurringEntries(user, new Date(), fetchedCategories, true);
  
  const [type, setType] = useState<Enums<'recurring_type'>>(initialType);
  const [value, setValue] = useState<number | undefined>(undefined);
  const [selectedParentCategoryId, setSelectedParentCategoryId] = useState(UNSELECTED_VALUE);
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState(UNSELECTED_VALUE);
  const [dueDay, setDueDay] = useState("1");
  const [frequency, setFrequency] = useState<Enums<'recurring_frequency'>>("monthly");
  const [startDate, setStartDate] = useState<Date | undefined>(new Date());
  // Removido o estado endDate e isEndDateCalendarOpen
  const [loading, setLoading] = useState(false);
  const [isStartDateCalendarOpen, setIsStartDateCalendarOpen] = useState(false);
  // Removido o estado isEndDateCalendarOpen
  const [isPaid, setIsPaid] = useState(false);

  const [formaPagamento, setFormaPagamento] = useState<"dinheiro" | "pix" | "cartao" | "boleto">("dinheiro");
  const [cartaoId, setCartaoId] = useState(UNSELECTED_VALUE);
  const [cartoes, setCartoes] = useState<Tables<'cartoes'>[]>([]);

  useEffect(() => {
    setType(initialType);
    setSelectedParentCategoryId(UNSELECTED_VALUE);
    setSelectedSubcategoryId(UNSELECTED_VALUE);
    setFormaPagamento("dinheiro");
    setCartaoId(UNSELECTED_VALUE);
    setIsPaid(false);
    // Resetar endDate para undefined ao mudar o tipo inicial
    // setEndDate(undefined); // Removido, pois o campo foi removido
  }, [initialType]);

  useEffect(() => {
    if (user) {
      loadCartoes();
    }
  }, [user]);

  const loadCartoes = async () => {
    const { data, error } = await supabase
      .from("cartoes")
      .select("*")
      .eq("user_id", user?.id)
      .order("nome");

    if (error) {
      console.error(error);
    } else {
      setCartoes(data || []);
    }
  };

  const rootCategories = useMemo(() => {
    if (type === "receita") {
      return fetchedCategories.filter(cat => cat.id === 'receitas_e_investimentos');
    } else {
      return fetchedCategories.filter(cat => cat.parent_id === null && cat.id !== 'receitas_e_investimentos');
    }
  }, [type, fetchedCategories]);

  const subcategories = useMemo(() => {
    if (selectedParentCategoryId === UNSELECTED_VALUE) {
      return [];
    }
    return fetchedCategories.filter(cat => cat.parent_id === selectedParentCategoryId);
  }, [fetchedCategories, selectedParentCategoryId]);

  const getCategoryDisplayName = (catId: string) => {
    const category = fetchedCategories.find(cat => cat.id === catId);
    return category?.nome || catId;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (!user) {
      toast.error("Usuário não autenticado. Por favor, faça login novamente.");
      setLoading(false);
      return;
    }
    if (value === undefined || value <= 0 || selectedParentCategoryId === UNSELECTED_VALUE || selectedSubcategoryId === UNSELECTED_VALUE || !dueDay || !startDate) {
      toast.error("Preencha todos os campos obrigatórios.");
      setLoading(false);
      return;
    }
    if (parseInt(dueDay) < 1 || parseInt(dueDay) > 31) {
      toast.error("O dia de vencimento deve ser entre 1 e 31.");
      setLoading(false);
      return;
    }
    // Removida a validação de endDate, pois o campo foi removido
    // if (endDate && startDate && endDate < startDate) {
    //   toast.error("A data final não pode ser anterior à data inicial.");
    //   setLoading(false);
    //   return;
    // }
    if (type === "despesa" && formaPagamento === "cartao" && cartaoId === UNSELECTED_VALUE) {
      toast.error("Selecione um cartão para despesas com cartão de crédito.");
      setLoading(false);
      return;
    }

    const newRecurringEntry: TablesInsert<'recurring_entries'> = {
      user_id: user.id,
      type,
      title: "Lançamento Recorrente",
      value: value as number,
      category_id: selectedSubcategoryId === UNSELECTED_VALUE ? null : selectedSubcategoryId,
      due_day: parseInt(dueDay),
      frequency,
      start_date: format(startDate, "yyyy-MM-dd"),
      end_date: null, // Sempre null, pois o campo foi removido
      status: 'active',
      forma_pagamento: formaPagamento,
      cartao_id: type === "despesa" && formaPagamento === "cartao" ? cartaoId : null,
    };

    try {
      const createdEntry = await createRecurringEntry(newRecurringEntry);

      if (isPaid && createdEntry && startDate) {
        const firstOccurrenceYear = startDate.getFullYear();
        const firstOccurrenceMonth = startDate.getMonth() + 1;

        const exceptionPayload: TablesUpdate<'recurring_entry_exceptions'> = {
          paid: true,
          canceled: false,
          note: "Marcado como pago na criação da recorrência",
          override_value: value,
          override_category_id: selectedSubcategoryId === UNSELECTED_VALUE ? null : selectedSubcategoryId,
          override_due_date: format(startDate, "yyyy-MM-dd"),
        };

        await createOrUpdateException({
          recurring_id: createdEntry.id,
          year: firstOccurrenceYear,
          month: firstOccurrenceMonth,
          payload: exceptionPayload,
        });
        toast.success("Primeira ocorrência marcada como paga!", {
          style: { backgroundColor: 'hsl(var(--soft-green))', color: 'hsl(var(--success-darker))' }
        });
      }

      setValue(undefined);
      setSelectedParentCategoryId(UNSELECTED_VALUE);
      setSelectedSubcategoryId(UNSELECTED_VALUE);
      setDueDay("1");
      setStartDate(new Date());
      // setEndDate(undefined); // Removido
      setFormaPagamento("dinheiro");
      setCartaoId(UNSELECTED_VALUE);
      setIsPaid(false);
      onSuccess?.();
    } catch (error) {
      // Error handled by mutation's onError
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Categoria Principal e Subcategoria */}
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="parentCategory" className={cn(isMobile && "text-xs")}>Categoria Principal</Label>
          <Select 
            value={selectedParentCategoryId} 
            onValueChange={(value) => {
              setSelectedParentCategoryId(value);
              setSelectedSubcategoryId(UNSELECTED_VALUE); // Reset subcategory when parent changes
            }}
            disabled={loading || isLoadingCategories}
          >
            <SelectTrigger className={cn("rounded-xl", isMobile && "h-9 text-sm")}>
              <SelectValue placeholder="Selecione a categoria principal" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={UNSELECTED_VALUE} disabled className={cn(isMobile && "text-sm")}>Selecione a categoria principal</SelectItem>
              {rootCategories.length === 0 ? (
                <SelectItem value={UNSELECTED_VALUE} disabled className={cn(isMobile && "text-sm")}>Nenhuma categoria principal disponível</SelectItem>
              ) : (
                rootCategories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id} className={cn(isMobile && "text-sm")}>
                    <span className="flex items-center gap-2">
                      <span>{cat.icone}</span>
                      <span>{getCategoryDisplayName(cat.id)}</span>
                    </span>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="subcategory" className={cn(isMobile && "text-xs")}>Subcategoria</Label>
          <Select 
            value={selectedSubcategoryId} 
            onValueChange={setSelectedSubcategoryId} 
            disabled={loading || isLoadingCategories || selectedParentCategoryId === UNSELECTED_VALUE || subcategories.length === 0}
          >
            <SelectTrigger className={cn("rounded-xl", isMobile && "h-9 text-sm")}>
              <SelectValue placeholder="Selecione a subcategoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={UNSELECTED_VALUE} disabled className={cn(isMobile && "text-sm")}>Selecione a subcategoria</SelectItem>
              {subcategories.length === 0 ? (
                <SelectItem value={UNSELECTED_VALUE} disabled className={cn(isMobile && "text-sm")}>Nenhuma subcategoria disponível</SelectItem>
              ) : (
                subcategories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id} className={cn(isMobile && "text-sm")}>
                    <span className="flex items-center gap-2">
                      <span>{cat.icone}</span>
                      <span>{getCategoryDisplayName(cat.id)}</span>
                    </span>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Valor e Forma de Pagamento (lado a lado) */}
      <div className="grid grid-cols-2 gap-4">
        {/* Valor */}
        <div className="space-y-2">
          <Label htmlFor="value" className={cn(isMobile && "text-xs")}>Valor (R$)</Label>
          <CurrencyInput
            id="value"
            value={value}
            onValueChange={(values) => setValue(values.floatValue)}
            placeholder="0,00"
            required
            disabled={loading}
            className={cn("rounded-xl", isMobile && "h-9 text-sm")}
          />
        </div>

        {/* Forma de Pagamento (AGORA SEM CONDICIONAL type === "despesa") */}
        <div className="space-y-2">
          <Label className={cn(isMobile && "text-xs")}>Forma de Pagamento</Label>
          <Select value={formaPagamento} onValueChange={(v: any) => setCartaoId(UNSELECTED_VALUE) || setFormaPagamento(v)} disabled={loading}>
            <SelectTrigger className={cn("rounded-xl", isMobile && "h-9 text-sm")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="dinheiro" className={cn(isMobile && "text-sm")}>Dinheiro</SelectItem>
              <SelectItem value="pix" className={cn(isMobile && "text-sm")}>Pix</SelectItem>
              <SelectItem value="cartao" className={cn(isMobile && "text-sm")}>Cartão</SelectItem>
              <SelectItem value="boleto" className={cn(isMobile && "text-sm")}>Boleto</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Cartão de Crédito (apenas se formaPagamento for 'cartao' E o tipo for 'despesa') */}
      {formaPagamento === "cartao" && type === "despesa" && (
        <div className="space-y-2">
          <Label className={cn(isMobile && "text-xs")}>Cartão de Crédito</Label>
          <div className="flex gap-2">
            <Select value={cartaoId} onValueChange={(v: any) => setCartaoId(v)} disabled={loading}>
              <SelectTrigger className={cn("rounded-xl", isMobile && "h-9 text-sm")}>
                <SelectValue placeholder="Selecione o cartão" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNSELECTED_VALUE} disabled className={cn(isMobile && "text-sm")}>Selecione o cartão</SelectItem>
                {cartoes
                  .map((cartao) => (
                    <SelectItem key={cartao.id} value={cartao.id} className={cn(isMobile && "text-sm")}>
                      {cartao.nome} - {cartao.banco}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <AddCardDialog user={user} onCardAdded={loadCartoes} />
            <ManageCardsDialog 
              cards={cartoes} 
              onCardUpdated={loadCartoes} 
              onCardDeleted={loadCartoes} 
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4"> {/* Layout para Frequência e Vencimento */}
        {/* Frequência */}
        <div className="space-y-2">
          <Label htmlFor="frequency" className={cn(isMobile && "text-xs")}>Frequência</Label>
          <Select value={frequency} onValueChange={(value: Enums<'recurring_frequency'>) => setFrequency(value)} disabled={loading}>
            <SelectTrigger className={cn("rounded-xl", isMobile && "h-9 text-sm")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="monthly" className={cn(isMobile && "text-sm")}>Mensal</SelectItem>
                <SelectItem value="quarterly" className={cn(isMobile && "text-sm")}>Trimestral</SelectItem>
                <SelectItem value="annually" className={cn(isMobile && "text-sm")}>Anual</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Dia de Vencimento */}
        <div className="space-y-2">
          <Label htmlFor="dueDay" className={cn(isMobile && "text-xs")}>Vencimento</Label>
          <Input
            id="dueDay"
            type="number"
            min="1"
            max="31"
            value={dueDay}
            onChange={(e) => setDueDay(e.target.value)}
            required
            disabled={loading}
            className={cn("rounded-xl", isMobile && "h-9 text-sm")}
          />
        </div>
      </div>

      {/* Data de Início */}
      <div className="space-y-2">
        <Label htmlFor="startDate" className={cn(isMobile && "text-xs")}>Data de Início</Label>
        <Popover open={isStartDateCalendarOpen} onOpenChange={setIsStartDateCalendarOpen}>
          <PopoverTrigger asChild>
            <Button
              variant={"outline"}
              className={cn(
                "w-full justify-start text-left font-normal h-10 rounded-xl",
                !startDate && "text-muted-foreground",
                isMobile && "h-9 text-sm"
              )}
              disabled={loading}
            >
              <CalendarIcon className={cn("mr-2 h-4 w-4", isMobile && "h-3.5 w-3.5")} />
              {startDate ? format(startDate, "PPP", { locale: ptBR }) : <span>Selecione uma data</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className={cn("w-auto p-0", isMobile && "p-1")}>
            <Calendar
              mode="single"
              selected={startDate}
              onSelect={setStartDate}
              initialFocus
              locale={ptBR}
              showOutsideDays={false}
              className={cn(isMobile && "text-sm")}
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Removido: Data de Fim (Opcional) */}
      {/* <div className="space-y-2">
        <Label htmlFor="endDate" className={cn(isMobile && "text-xs")}>Data de Fim (Opcional)</Label>
        <Popover open={isEndDateCalendarOpen} onOpenChange={setIsEndDateCalendarOpen}>
          <PopoverTrigger asChild>
            <Button
              variant={"outline"}
              className={cn(
                "w-full justify-start text-left font-normal h-10 rounded-xl",
                !endDate && "text-muted-foreground",
                isMobile && "h-9 text-sm"
              )}
              disabled={loading}
            >
              <CalendarIcon className={cn("mr-2 h-4 w-4", isMobile && "h-3.5 w-3.5")} />
              {endDate ? format(endDate, "PPP", { locale: ptBR }) : <span>Selecione uma data</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className={cn("w-auto p-0", isMobile && "p-1")}>
            <Calendar
              mode="single"
              selected={endDate}
              onSelect={setEndDate}
              initialFocus
              locale={ptBR}
              showOutsideDays={false}
              className={cn(isMobile && "text-sm")}
            />
          </PopoverContent>
        </Popover>
      </div> */}

      {/* Status de Pago/Pendente */}
      <TransactionStatusToggle
        isPaid={isPaid}
        setIsPaid={setIsPaid}
        isMobile={isMobile}
      />

      <Button type="submit" className={cn("w-full rounded-xl", isMobile && "h-9 text-sm")} disabled={loading}>
        <DynamicIcon name="Plus" className={cn("mr-2 h-4 w-4", isMobile && "h-3.5 w-3.5")} />
        {loading ? "Criando..." : "Criar Lançamento Recorrente"}
      </Button>
    </form>
  );
};