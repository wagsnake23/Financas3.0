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
import { CurrencyInput } from "@/components/ui/currency-input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { getDate } from "date-fns";
import { StatusToggleButton } from "./StatusToggleButton"; // NEW: Import StatusToggleButton
import { Database } from "@/integrations/supabase/types"; // NEW: Import Database type for ReceitaStatus
import { cn } from "@/lib/utils"; // NEW: Import cn for conditional classes

type ReceitaStatus = Database['public']['Enums']['receita_status']; // Define ReceitaStatus type

interface TransactionFormProps {
  onAddTransaction: (transaction: Omit<Transaction, "id">) => void;
  isMobile?: boolean; // NEW: Add isMobile prop
}

const UNSELECTED_VALUE = "unselected";
const RECURRING_INSTALLMENTS_COUNT = 120; // 120 meses

export const TransactionForm = ({ onAddTransaction, isMobile }: TransactionFormProps) => { // NEW: Add isMobile prop
  const { user } = useAuth();
  const [type, setType] = useState<TransactionType>("expense");
  const [amount, setAmount] = useState<number | undefined>(undefined);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [category, setCategory] = useState(UNSELECTED_VALUE);
  const [description, setDescription] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [status, setStatus] = useState<ReceitaStatus>("Pendente"); // NEW: Add status state

  // Effect to reset status when type or recurring changes
  useEffect(() => {
    if (isRecurring) {
      setStatus("Prevista"); // Recurring transactions are 'Prevista' by default
    } else {
      setStatus("Pendente"); // One-off transactions are 'Pendente' by default
    }
  }, [isRecurring, type]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (amount === undefined || category === UNSELECTED_VALUE) {
      toast.error("Preencha todos os campos obrigatórios (Valor e Subcategoria).");
      return;
    }

    if (!user) {
      toast.error("Usuário não autenticado.");
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
              data: date,
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
            p_first_occurrence_date: date,
            p_monthly_amount: amount as number,
            p_category_id: category === UNSELECTED_VALUE ? null : category,
            p_description: description,
            p_status: 'Prevista',
            p_recurrence_day: recurrenceDay,
            p_total_installments: RECURRING_INSTALLMENTS_COUNT,
          });

          if (rpcError) throw rpcError;

        } else {
          // Create a one-off revenue entry
          await onAddTransaction({
            type,
            amount: amount as number,
            date,
            category: category === UNSELECTED_VALUE ? null : category,
            description,
            status: status, // NEW: Use the selected status
            is_recurring_master: false,
            recurrence_id: null,
            recurrence_day: null,
          });
        }
      } else { // type === "expense"
        // For expenses, the ExpenseForm component handles the recurring logic
        // This TransactionForm is for simple one-off transactions.
        // If recurring expense is selected here, it's an error or not intended.
        // For one-off expenses, we need to create a single expense and installment.
        if (isRecurring) {
          toast.error("Para despesas recorrentes, use o formulário de Despesas.");
          return;
        }

        // Create a one-off expense entry
        // This form doesn't have payment details, so we'll default to 'dinheiro' and 1 installment
        const { data: despesaData, error: despesaError } = await supabase
          .from("despesas")
          .insert({
            user_id: user.id,
            categoria_id: category === UNSELECTED_VALUE ? null : category,
            forma_pagamento: "dinheiro", // Default for simple form
            tipo_pagamento: "avista", // Default for simple form
            cartao_id: null,
            valor_total: amount as number,
            descricao,
            numero_parcelas: 1,
            is_recurring_master: false,
          })
          .select()
          .single();

        if (despesaError) throw despesaError;

        const { error: parcelaError } = await supabase
          .from("despesas_parcelas")
          .insert({
            despesa_id: despesaData.id,
            numero_parcela: 1,
            valor_parcela: amount as number,
            vencimento: date,
            pago: status === "Recebida", // Use the selected status
            data_pagamento: status === "Recebida" ? new Date().toISOString() : null,
          });

        if (parcelaError) throw parcelaError;
      }

      // Reset form
      setAmount(undefined);
      setCategory(UNSELECTED_VALUE);
      setDescription("");
      setIsRecurring(false);
      setStatus("Pendente"); // Reset status
      
      toast.success(type === "income" ? "Receita adicionada!" : "Despesa adicionada!", {
        style: { backgroundColor: 'hsl(var(--soft-green))', color: 'hsl(var(--success-darker))' }
      });
    } catch (error: any) {
      toast.error("Erro ao adicionar lançamento", { description: error.message });
      console.error("Supabase error adding transaction:", error);
    }
  };

  return (
    <Card className={cn("p-6 animate-slide-up rounded-xl shadow-sm", isMobile && "p-4")}> {/* NEW: Apply responsive padding */}
      <h2 className={cn("text-2xl font-bold mb-6", isMobile && "text-xl mb-4")}>Novo Lançamento</h2> {/* NEW: Apply responsive font size */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Toggle Avulsa / Recorrente */}
        <div className="space-y-2">
          <Label className={cn(isMobile && "text-xs")}>Tipo de Lançamento</Label> {/* NEW: Apply responsive font size */}
          <ToggleGroup 
            type="single" 
            value={isRecurring ? "recorrente" : "avulsa"} 
            onValueChange={(value) => setIsRecurring(value === "recorrente")}
            className="w-full justify-center"
          >
            <ToggleGroupItem value="avulsa" className={cn("flex-1 rounded-xl", isMobile && "h-9 text-sm")}> {/* NEW: Apply responsive height and font size */}
              <DynamicIcon name="Zap" className={cn("mr-2 h-4 w-4", isMobile && "h-3.5 w-3.5")} /> Avulsa
            </ToggleGroupItem>
            <ToggleGroupItem value="recorrente" className={cn("flex-1 rounded-xl", isMobile && "h-9 text-sm")}> {/* NEW: Apply responsive height and font size */}
              <DynamicIcon name="Repeat" className={cn("mr-2 h-4 w-4", isMobile && "h-3.5 w-3.5")} /> Recorrente
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        <div className={cn("grid gap-4", isMobile ? "grid-cols-1" : "grid-cols-2")}> {/* NEW: Apply responsive grid */}
          <div className="space-y-2">
            <Label htmlFor="type" className={cn(isMobile && "text-xs")}>Tipo</Label> {/* NEW: Apply responsive font size */}
            <Select value={type} onValueChange={(value) => {
              setType(value as TransactionType);
              setCategory(UNSELECTED_VALUE); // Reset category when type changes
            }}>
              <SelectTrigger className={cn("rounded-xl", isMobile && "h-9 text-sm")}> {/* NEW: Apply responsive height and font size */}
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="income" className={cn(isMobile && "text-sm")}>Receita</SelectItem> {/* NEW: Apply responsive font size */}
                <SelectItem value="expense" disabled={isRecurring} className={cn(isMobile && "text-sm")}>Despesa</SelectItem> {/* Disable expense if recurring is selected */}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount" className={cn(isMobile && "text-xs")}>Valor (R$)</Label> {/* NEW: Apply responsive font size */}
            <CurrencyInput
              id="amount"
              value={amount}
              onValueChange={(values) => setAmount(values.floatValue)}
              placeholder="0,00"
              required
              className={cn("rounded-xl", isMobile && "h-9 text-sm")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="date" className={cn(isMobile && "text-xs")}>Data</Label> {/* NEW: Apply responsive font size */}
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className={cn("rounded-xl", isMobile && "h-9 text-sm")}
            /> {/* NEW: Apply responsive height and font size */}
          </div>

          <div className="space-y-2">
            <Label htmlFor="category" className={cn(isMobile && "text-xs")}>Subcategoria</Label> {/* NEW: Apply responsive font size */}
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className={cn("rounded-xl", isMobile && "h-9 text-sm")}> {/* NEW: Apply responsive height and font size */}
                <SelectValue placeholder="Selecione a subcategoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNSELECTED_VALUE} disabled className={cn(isMobile && "text-sm")}>Selecione a subcategoria</SelectItem> {/* NEW: Apply responsive font size */}
                {filteredSubcategories.length === 0 ? (
                  <SelectItem value={UNSELECTED_VALUE} disabled className={cn(isMobile && "text-sm")}>Nenhuma subcategoria disponível</SelectItem> {/* NEW: Apply responsive font size */}
                ) : (
                  filteredSubcategories
                    .map((cat) => (
                      <SelectItem key={cat.id} value={cat.id} className={cn(isMobile && "text-sm")}> {/* NEW: Apply responsive font size */}
                        {cat.nome}
                      </SelectItem>
                    ))
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description" className={cn(isMobile && "text-xs")}>Descrição</Label> {/* NEW: Apply responsive font size */}
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Adicione uma descrição..."
            rows={3}
            className={cn("rounded-xl", isMobile && "text-sm")} {/* NEW: Apply responsive font size */}
          />
        </div>

        {!isRecurring && ( // NEW: Conditionally render status toggle for one-off transactions
          <div className="flex flex-col items-start space-y-2">
            <Label className={cn(isMobile && "text-xs")}>Status</Label> {/* NEW: Apply responsive font size */}
            <StatusToggleButton
              currentStatus={status}
              transactionType={type}
              onToggle={() => setStatus(status === "Recebida" ? "Pendente" : "Recebida")}
              isMobile={isMobile}
            />
          </div>
        )}

        <Button type="submit" className={cn("w-full rounded-xl", isMobile && "h-9 text-sm")} size="lg"> {/* NEW: Apply responsive height and font size */}
          <DynamicIcon name="Plus" className={cn("mr-2 h-4 w-4", isMobile && "h-3.5 w-3.5")} /> {/* NEW: Apply responsive icon size */}
          Adicionar Lançamento
        </Button>
      </form>
    </Card>
  );
};