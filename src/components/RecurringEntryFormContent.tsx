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
import { TablesInsert, Enums, Tables } from "@/integrations/supabase/types"; // Importar Tables
import { supabase } from "@/integrations/supabase/client"; // Importar supabase
import { AddCardDialog } from "./AddCardDialog"; // Importar AddCardDialog
import ManageCardsDialog from "./ManageCardsDialog"; // Importar ManageCardsDialog

interface RecurringEntryFormContentProps {
  isMobile: boolean;
  onSuccess?: () => void;
  fetchedCategories: AppCategory[];
  isLoadingCategories: boolean;
  initialType?: Enums<'recurring_type'>; // Adicionado para predefinir o tipo
}

const UNSELECTED_VALUE = "unselected";

export const RecurringEntryFormContent: React.FC<RecurringEntryFormContentProps> = ({ 
  isMobile, 
  onSuccess, 
  fetchedCategories, 
  isLoadingCategories,
  initialType = "despesa" // Padrão para despesa
}) => {
  const { user } = useAuth();
  const { createRecurringEntry } = useRecurringEntries(user, new Date(), fetchedCategories);
  
  const [type, setType] = useState<Enums<'recurring_type'>>(initialType);
  const [value, setValue] = useState("");
  const [categoryId, setCategoryId] = useState(UNSELECTED_VALUE);
  const [dueDay, setDueDay] = useState("1");
  const [frequency, setFrequency] = useState<Enums<'recurring_frequency'>>("monthly");
  const [startDate, setStartDate] = useState<Date | undefined>(new Date());
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [isStartDateCalendarOpen, setIsStartDateCalendarOpen] = useState(false);
  const [isEndDateCalendarOpen, setIsEndDateCalendarOpen] = useState(false);

  // Novos estados para forma de pagamento e cartões
  const [formaPagamento, setFormaPagamento] = useState<"dinheiro" | "pix" | "cartao" | "boleto">("dinheiro");
  const [cartaoId, setCartaoId] = useState(UNSELECTED_VALUE);
  const [cartoes, setCartoes] = useState<Tables<'cartoes'>[]>([]);

  // Atualiza o tipo se initialType mudar
  useEffect(() => {
    setType(initialType);
    setCategoryId(UNSELECTED_VALUE); // Reset category when type changes
    // Reset payment method and card when type changes
    setFormaPagamento("dinheiro");
    setCartaoId(UNSELECTED_VALUE);
  }, [initialType]);

  // Carregar cartões quando o usuário estiver disponível
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

  const filteredCategories = useMemo(() => {
    if (type === "receita") {
      // Filtra para exibir apenas subcategorias de 'Receitas e Investimentos'
      return fetchedCategories.filter(cat => cat.parent_id === 'receitas_e_investimentos');
    } else {
      // Para despesas, exibe apenas subcategorias que não são de 'Receitas e Investimentos'
      return fetchedCategories.filter(cat => 
        cat.parent_id !== null && // Apenas subcategorias
        cat.parent_id !== 'receitas_e_investimentos' // Exclui subcategorias de receita
      );
    }
  }, [type, fetchedCategories]);

  const getCategoryDisplayName = (catId: string) => {
    const category = fetchedCategories.find(cat => cat.id === catId);
    if (!category) return catId;

    // Para subcategorias de receita ou despesa, apenas mostra o nome da subcategoria
    if (category.parent_id) {
      return category.nome;
    }
    // Para categorias raiz (que não deveriam aparecer no filtro de subcategorias, mas como fallback)
    return category.nome;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (!user) {
      toast.error("Usuário não autenticado. Por favor, faça login novamente.");
      setLoading(false);
      return;
    }
    if (!value || parseFloat(value) <= 0 || categoryId === UNSELECTED_VALUE || !dueDay || !startDate) {
      toast.error("Preencha todos os campos obrigatórios.");
      setLoading(false);
      return;
    }
    if (parseInt(dueDay) < 1 || parseInt(dueDay) > 31) {
      toast.error("O dia de vencimento deve ser entre 1 e 31.");
      setLoading(false);
      return;
    }
    if (endDate && startDate && endDate < startDate) {
      toast.error("A data final não pode ser anterior à data inicial.");
      setLoading(false);
      return;
    }
    // Validation for cartao_id: only if formaPagamento is "cartao" AND it's an expense
    if (type === "despesa" && formaPagamento === "cartao" && cartaoId === UNSELECTED_VALUE) {
      toast.error("Selecione um cartão para despesas com cartão de crédito.");
      setLoading(false);
      return;
    }

    const newRecurringEntry: TablesInsert<'recurring_entries'> = {
      user_id: user.id,
      type,
      title: "Lançamento Recorrente", // Título padrão
      value: parseFloat(value),
      category_id: categoryId,
      due_day: parseInt(dueDay),
      frequency,
      start_date: format(startDate, "yyyy-MM-dd"),
      end_date: endDate ? format(endDate, "yyyy-MM-dd") : null,
      status: 'active',
      // Novos campos de pagamento
      forma_pagamento: formaPagamento, // Incluído para ambos os tipos
      cartao_id: type === "despesa" && formaPagamento === "cartao" ? cartaoId : null, // Condicional para cartao_id
    };

    try {
      await createRecurringEntry(newRecurringEntry);
      setValue("");
      setCategoryId(UNSELECTED_VALUE);
      setDueDay("1");
      setStartDate(new Date());
      setEndDate(undefined);
      setFormaPagamento("dinheiro"); // Resetar forma de pagamento
      setCartaoId(UNSELECTED_VALUE); // Resetar cartão
      onSuccess?.();
    } catch (error) {
      // Error handled by mutation's onError
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Categoria */}
      <div className="space-y-2">
        <Label htmlFor="category" className={cn(isMobile && "text-xs")}>Subcategoria</Label> {/* Label alterada */}
        <Select value={categoryId} onValueChange={setCategoryId} disabled={loading || isLoadingCategories}>
          <SelectTrigger className={cn("rounded-xl", isMobile && "h-9 text-sm")}>
            <SelectValue placeholder="Selecione a subcategoria" /> {/* Placeholder alterado */}
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={UNSELECTED_VALUE} disabled className={cn(isMobile && "text-sm")}>Selecione a subcategoria</SelectItem> {/* Item desabilitado alterado */}
            {filteredCategories.length === 0 ? (
              <SelectItem value={UNSELECTED_VALUE} disabled className={cn(isMobile && "text-sm")}>Nenhuma subcategoria disponível</SelectItem>
            ) : (
              filteredCategories.map((cat) => (
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

      {/* Valor e Forma de Pagamento (lado a lado) */}
      <div className="grid grid-cols-2 gap-4">
        {/* Valor */}
        <div className="space-y-2">
          <Label htmlFor="value" className={cn(isMobile && "text-xs")}>Valor (R$)</Label>
          <Input
            id="value"
            type="number"
            step="0.01"
            value={value}
            onChange={(e) => setValue(e.target.value)}
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

      {/* Data de Fim (Opcional) */}
      <div className="space-y-2">
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
      </div>

      <Button type="submit" className={cn("w-full rounded-xl", isMobile && "h-9 text-sm")} disabled={loading}>
        <DynamicIcon name="Plus" className={cn("mr-2 h-4 w-4", isMobile && "h-3.5 w-3.5")} />
        {loading ? "Criando..." : "Criar Lançamento Recorrente"}
      </Button>
    </form>
  );
};