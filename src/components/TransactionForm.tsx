import { useState, useMemo, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Transaction, TransactionType, AppCategory } from "@/types/finance";
import { toast } from "sonner";
import DynamicIcon from "./DynamicIcon";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import CurrencyBR from "@/components/ui/currency-br"; // Importar CurrencyBR
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { getDate, format } from "date-fns"; // Importar format
import { formatInTimeZone, TARGET_TIMEZONE, formatDateWithCurrentTimeInTimeZone } from "@/lib/utils"; // NOVO: Importar formatDateWithCurrentTimeInTimeZone

import { cn, getBorderClass } from "@/lib/utils"; // Importar getBorderClass

interface TransactionFormProps {
  onAddTransaction: (transaction: Omit<Transaction, "id">) => void;
}

const UNSELECTED_VALUE = "unselected";
const RECURRING_INSTALLMENTS_COUNT = 120; // 120 meses
const toastDuration = 1000; // 1 segundo para todos os dispositivos
const toastSuccessStyle = { backgroundColor: '#F3FFF3', color: '#006000' };
const toastErrorStyle = { backgroundColor: '#F3FFF3', color: '#FF2929' };

export const TransactionForm = ({ onAddTransaction }: TransactionFormProps) => {
  const { user } = useAuth();
  const [type, setType] = useState<TransactionType>("expense");
  const [amount, setAmount] = useState<number | undefined>(undefined);
  // Inicializar com a data e hora atual de Brasília
  const [date, setDate] = useState(formatDateWithCurrentTimeInTimeZone(new Date()));
  const [category, setCategory] = useState(UNSELECTED_VALUE);
  const [description, setDescription] = useState("");
  const [isRecurring, setIsRecurring] = useState(false); // State for the toggle
  const [status, setStatus] = useState<"Prevista" | "Pendente">("Pendente"); // New state for income status
  const [validationErrors, setValidationErrors] = useState<Record<string, boolean>>({}); // NOVO ESTADO

  // Fetch ALL categories from Supabase (user-specific and default ones with user_id: null)
  // Modificado para buscar APENAS SUBCATEGORIAS (parent_id IS NOT NULL)
  const { data: fetchedCategories = [] } = useQuery<AppCategory[]>({
    queryKey: ["transactionFormCategories", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("categorias")
        .select("*")
        .or(`user_id.eq.${user.id},user_id.is.null`)
        .not("parent_id", "is", null) // APENAS SUBCATEGORIAS
        .order("nome");
      if (error) throw error;
      return data as AppCategory[];
    },
    enabled: !!user?.id,
  });

  // `fetchedCategories` agora já são as subcategorias.
  // Filtrar para obter apenas as subcategorias relevantes para o tipo de transação.
  const filteredSubcategories = useMemo(() => {
    if (type === "income") {
      return fetchedCategories.filter(cat => cat.parent_id === 'receitas_e_investimentos');
    } else {
      return fetchedCategories.filter(cat => cat.parent_id !== 'receitas_e_investimentos');
    }
  }, [type, fetchedCategories]);

  // Effect to handle recurrence logic and status for income
  useEffect(() => {
    if (type === "income") {
      setStatus(isRecurring ? "Prevista" : "Pendente");
    } else {
      // For expenses, always force to Avulsa and set status to Pendente
      setIsRecurring(false);
      setStatus("Pendente"); // Expenses are always 'Pendente' initially
    }
  }, [type, isRecurring]);

  const handleToggleChange = (value: string) => {
    if (value === "recorrente") {
      if (type === "expense") {
        toast.error("Despesas recorrentes devem ser criadas no módulo de Despesas.", { duration: toastDuration, style: toastErrorStyle });
        setIsRecurring(false); // Force back to Avulsa
        return;
      }
      setIsRecurring(true);
    } else {
      setIsRecurring(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const newErrors: Record<string, boolean> = {};
    let hasError = false;

    if (amount === undefined || amount <= 0) {
      newErrors.amount = true;
      hasError = true;
    }
    if (!date) {
      newErrors.date = true;
      hasError = true;
    }
    if (category === UNSELECTED_VALUE) {
      newErrors.category = true;
      hasError = true;
    }

    setValidationErrors(newErrors);

    if (hasError) {
      toast.error("Preencha todos os campos obrigatórios (Valor, Data e Subcategoria).", { duration: toastDuration, style: toastErrorStyle });
      return;
    }

    if (!user) {
      toast.error("Usuário não autenticado.", { duration: toastDuration, style: toastErrorStyle });
      return;
    }

    const recurrenceDay = getDate(new Date(date)); // Get day of month from selected date

    try {
      if (type === "income") {
        if (isRecurring) {
          // 1. Create the master recurring revenue entry
          const { data: masterData, error: masterError } = await supabase
            .from("receitas")
            .insert({
              user_id: user.id,
              tipo_receita_id: category === UNSELECTED_VALUE ? null : category,
              valor: amount as number,
              data: date, // 'date' já está formatado com hora
              descricao,
              status: 'Prevista', // Master is always 'Prevista'
              is_recurring_master: true,
              recurrence_day: recurrenceDay,
            })
            .select()
            .single();

          if (masterError) throw masterError;
          const masterRevenueId = masterData.id;

          // Update the master record itself to point its recurrence_id to its own id
          const { error: updateMasterError } = await supabase
            .from("receitas")
            .update({ recurrence_id: masterRevenueId })
            .eq("id", masterRevenueId);
          
          if (updateMasterError) throw updateMasterError;

          // 2. Call RPC to generate future occurrences in background
          const { error: rpcError } = await supabase.rpc('generate_recurring_entries', {
            p_user_id: user.id,
            p_transaction_type: 'income',
            p_master_id: masterRevenueId,
            p_first_occurrence_date: date, // 'date' já é uma string 'YYYY-MM-DD HH:mm:ss'
            p_monthly_amount: amount as number,
            p_category_id: category === UNSELECTED_VALUE ? null : category,
            p_description: description,
            p_status: 'Prevista', // Required enum value
            p_recurrence_day: recurrenceDay,
            p_total_installments: RECURRING_INSTALLMENTS_COUNT,
            p_forma_pagamento: null,
            p_cartao_id: null,
            p_tipo_pagamento: null,
          });

          if (rpcError) throw rpcError;

        } else {
          // Create a one-off revenue entry
          await onAddTransaction({
            type,
            amount: amount as number,
            date, // 'date' já está formatado com hora
            category: category === UNSELECTED_VALUE ? null : category,
            description,
            status: "Pendente", // Default for one-off income
            is_recurring_master: false,
            recurrence_id: null,
            recurrence_day: null,
          });
        }
      } else { // type === "expense"
        // For expenses, the ExpenseForm component handles the recurring logic
        // This TransactionForm is for simple one-off transactions.
        // If recurring expense is selected here, it's an error or not intended.
        // The toggle should have already forced it to "Avulsa"
        await onAddTransaction({
          type,
          amount: amount as number,
          date, // 'date' já está formatado com hora
          category: category === UNSELECTED_VALUE ? null : category,
          description,
          status: "Pendente", // Default for one-off expense
          is_recurring_master: false,
          recurrence_id: null,
          recurrence_day: null,
        });
      }

      // Reset form
      setAmount(undefined);
      setCategory(UNSELECTED_VALUE);
      setDescription("");
      setIsRecurring(false); // Reset toggle
      setStatus("Pendente"); // Reset status
      setValidationErrors({}); // Clear errors on success
      // Reset date to current date and time
      setDate(formatDateWithCurrentTimeInTimeZone(new Date()));
      
      toast.success(type === "income" ? "Receita adicionada!" : "Despesa adicionada!", {
        style: toastSuccessStyle,
        duration: toastDuration
      });
    } catch (error: any) {
      toast.error("Erro ao adicionar lançamento", { description: error.message, duration: toastDuration, style: toastErrorStyle });
      console.error("Supabase error adding transaction:", error);
    }
  };

  return (
    <Card className="p-6 animate-slide-up rounded-xl shadow-sm">
      <h2 className="text-2xl font-bold mb-6">Novo Lançamento</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Toggle Avulsa / Recorrente */}
        <div className="space-y-2">
          <Label>Tipo de Lançamento</Label>
          <ToggleGroup 
            type="single" 
            value={isRecurring ? "recorrente" : "avulsa"} 
            onValueChange={handleToggleChange}
            className="w-full justify-center"
          >
            <ToggleGroupItem 
              value="avulsa" 
              className={cn(
                "flex-1 rounded-xl flex items-center justify-center border",
                "data-[state=on]:bg-primary data-[state=on]:border-primary data-[state=on]:text-primary-foreground data-[state=on]:font-bold",
                "data-[state=off]:bg-transparent data-[state=off]:border-border data-[state=off]:text-muted-foreground"
              )}
            >
              <DynamicIcon 
                name="Zap" 
                className={cn(
                  "mr-2 h-4 w-4",
                  "data-[state=on]:text-primary-foreground data-[state=off]:text-muted-foreground"
                )} 
              /> Avulsa
            </ToggleGroupItem>
            <ToggleGroupItem 
              value="recorrente" 
              className={cn(
                "flex-1 rounded-xl flex items-center justify-center border",
                "data-[state=on]:bg-primary data-[state=on]:border-primary data-[state=on]:text-primary-foreground data-[state=on]:font-bold",
                "data-[state=off]:bg-transparent data-[state=off]:border-border data-[state=off]:text-muted-foreground"
              )}
            >
              <DynamicIcon 
                name="Repeat" 
                className={cn(
                  "mr-2 h-4 w-4",
                  "data-[state=on]:text-primary-foreground data-[state=off]:text-muted-foreground"
                )} 
              /> Recorrente
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="type">Tipo</Label>
            <Select value={type} onValueChange={(value) => {
              setType(value as TransactionType);
              setCategory(UNSELECTED_VALUE); // Reset category when type changes
              // If changing to expense, force isRecurring to false
              if (value === "expense") {
                setIsRecurring(false);
              }
            }}>
              <SelectTrigger className="rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="income">Receita</SelectItem>
                <SelectItem value="expense">Despesa</SelectItem> {/* Removed disabled, logic is in handleToggleChange */}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Valor (R$)</Label>
            <CurrencyBR
              value={amount}
              onChange={(v) => {
                setAmount(v);
                setValidationErrors(prev => ({ ...prev, amount: false }));
              }}
              className={cn("rounded-xl", getBorderClass({ isInvalid: validationErrors.amount, isValid: validationErrors.amount === false }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="date">Data</Label>
            <Input
              id="date"
              type="date"
              value={date.split(' ')[0]} // Exibir apenas a data para o input type="date"
              onChange={(e) => {
                // Ao mudar a data, combine com a hora atual de Brasília
                const selectedDate = new Date(e.target.value);
                setDate(formatDateWithCurrentTimeInTimeZone(selectedDate));
                setValidationErrors(prev => ({ ...prev, date: false }));
              }}
              required
              className={cn("rounded-xl", getBorderClass({ isInvalid: validationErrors.date, isValid: validationErrors.date === false }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Subcategoria</Label>
            <Select value={category} onValueChange={(value) => {
              setCategory(value);
              setValidationErrors(prev => ({ ...prev, category: false }));
            }}>
              <SelectTrigger className={cn("rounded-xl", getBorderClass({ isInvalid: validationErrors.category, isValid: validationErrors.category === false }))}>
                <SelectValue placeholder="Selecione a subcategoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNSELECTED_VALUE} disabled>Selecione a subcategoria</SelectItem>
                {filteredSubcategories.length === 0 ? (
                  <SelectItem value={UNSELECTED_VALUE} disabled>Nenhuma subcategoria disponível</SelectItem>
                ) : (
                  filteredSubcategories
                    .map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.nome}
                      </SelectItem>
                    ))
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Descrição</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Adicione uma descrição..."
            rows={3}
            className="rounded-xl"
          />
        </div>

        <Button type="submit" className="w-full rounded-xl" size="lg">
          <DynamicIcon name="Plus" className="mr-2 h-4 w-4" />
          Adicionar Lançamento
        </Button>
      </form>
    </Card>
  );
};