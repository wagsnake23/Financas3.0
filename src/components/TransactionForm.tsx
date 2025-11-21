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
// Removed: import { getDate } from "date-fns";
import { StatusToggleButton } from "./StatusToggleButton";
import { Database } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";
// Removed: import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

type ReceitaStatus = Database['public']['Enums']['receita_status'];

interface TransactionFormProps {
  onAddTransaction: (transaction: Omit<Transaction, "id">) => void;
  isMobile?: boolean;
}

const UNSELECTED_VALUE = "unselected";
// Removed: const RECURRING_INSTALLMENTS_COUNT = 120; // No longer needed as this form is for one-off

export const TransactionForm = ({ onAddTransaction, isMobile }: TransactionFormProps) => {
  const { user } = useAuth();
  const [type, setType] = useState<TransactionType>("expense");
  const [amount, setAmount] = useState<number | undefined>(undefined);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [category, setCategory] = useState(UNSELECTED_VALUE);
  const [description, setDescription] = useState("");
  // Removed: const [isRecurring, setIsRecurring] = useState(false);
  const [status, setStatus] = useState<ReceitaStatus>("Pendente");

  // Set status to 'Pendente' by default for new one-off transactions
  useEffect(() => {
    setStatus("Pendente");
  }, [type]);


  const { data: fetchedCategories = [] } = useQuery<AppCategory[]>({
    queryKey: ["transactionFormCategories", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("categorias")
        .select("*")
        .or(`user_id.eq.${user.id},user_id.is.null`)
        .not("parent_id", "is", null)
        .order("nome");
      if (error) throw error;
      return data as AppCategory[];
    },
    enabled: !!user?.id,
  });

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

    try {
      if (type === "income") {
        // Always one-off income from this form
        await onAddTransaction({
          type,
          amount: amount as number,
          date,
          category: category === UNSELECTED_VALUE ? null : category,
          description,
          status: status,
          is_recurring_master: false,
          recurrence_id: null,
          recurrence_day: null,
        });
      } else { // type === "expense"
        // Always one-off expense from this form
        const { data: despesaData, error: despesaError } = await supabase
          .from("despesas")
          .insert({
            user_id: user.id,
            categoria_id: category === UNSELECTED_VALUE ? null : category,
            forma_pagamento: "dinheiro", // Default to dinheiro for one-off expense
            tipo_pagamento: "avista", // Default to avista for one-off expense
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
            pago: status === "Recebida",
            data_pagamento: status === "Recebida" ? new Date().toISOString() : null,
          });

        if (parcelaError) throw parcelaError;
      }

      setAmount(undefined);
      setCategory(UNSELECTED_VALUE);
      setDescription("");
      // Removed: setIsRecurring(false);
      setStatus("Pendente");
      
      toast.success(type === "income" ? "Receita adicionada!" : "Despesa adicionada!", {
        style: { backgroundColor: 'hsl(var(--soft-green))', color: 'hsl(var(--success-darker))' }
      });
    } catch (error: any) {
      toast.error("Erro ao adicionar lançamento", { description: error.message });
      console.error("Supabase error adding transaction:", error);
    }
  };

  return (
    <Card className={cn("p-6 animate-slide-up rounded-xl shadow-sm", isMobile && "p-4")}>
      <h2 className={cn("text-2xl font-bold mb-6", isMobile && "text-xl mb-4")}>Novo Lançamento</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Removed: Tipo de Lançamento RadioGroup */}

        <div className={cn("grid gap-4", isMobile ? "grid-cols-1" : "grid-cols-2")}>
          <div className="space-y-2">
            <Label htmlFor="type" className={cn(isMobile && "text-xs")}>Tipo</Label>
            <Select value={type} onValueChange={(value) => {
              setType(value as TransactionType);
              setCategory(UNSELECTED_VALUE);
            }}>
              <SelectTrigger className={cn("rounded-xl", isMobile && "h-9 text-sm")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="income" className={cn(isMobile && "text-sm")}>Receita</SelectItem>
                <SelectItem value="expense" className={cn(isMobile && "text-sm")}>Despesa</SelectItem> {/* Removed disabled={isRecurring} */}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount" className={cn(isMobile && "text-xs")}>Valor (R$)</Label>
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
            <Label htmlFor="date" className={cn(isMobile && "text-xs")}>Data</Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className={cn("rounded-xl", isMobile && "h-9 text-sm")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category" className={cn(isMobile && "text-xs")}>Subcategoria</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className={cn("rounded-xl", isMobile && "h-9 text-sm")}>
                <SelectValue placeholder="Selecione a subcategoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNSELECTED_VALUE} disabled className={cn(isMobile && "text-sm")}>Selecione a subcategoria</SelectItem>
                {filteredSubcategories.length === 0 ? (
                  <SelectItem value={UNSELECTED_VALUE} disabled className={cn(isMobile && "text-sm")}>Nenhuma subcategoria disponível</SelectItem>
                ) : (
                  filteredSubcategories
                    .map((cat) => (
                      <SelectItem key={cat.id} value={cat.id} className={cn(isMobile && "text-sm")}>
                        {cat.nome}
                      </SelectItem>
                    ))
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description" className={cn(isMobile && "text-xs")}>Descrição</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Adicione uma descrição..."
            rows={3}
            className={cn("rounded-xl", isMobile && "text-sm")}
          />
        </div>

        {/* StatusToggleButton is always shown now */}
        <div className="flex flex-col items-start space-y-2">
          <Label className={cn(isMobile && "text-xs")}>Status</Label>
          <StatusToggleButton
            currentStatus={status}
            transactionType={type}
            onToggle={() => setStatus(status === "Recebida" ? "Pendente" : "Recebida")}
            isMobile={isMobile}
          />
        </div>

        <Button type="submit" className={cn("w-full rounded-xl", isMobile && "h-9 text-sm")} size="lg">
          <DynamicIcon name="Plus" className={cn("mr-2 h-4 w-4", isMobile && "h-3.5 w-3.5")} />
          Adicionar Lançamento
        </Button>
      </form>
    </Card>
  );
};