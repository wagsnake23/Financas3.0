import { useState, useMemo } from "react";
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
import { CurrencyInput } from "@/components/ui/currency-input"; // Importar CurrencyInput

interface TransactionFormProps {
  onAddTransaction: (transaction: Omit<Transaction, "id">) => void;
}

const UNSELECTED_VALUE = "unselected"; // Valor único para representar 'não selecionado'

export const TransactionForm = ({ onAddTransaction }: TransactionFormProps) => {
  const { user } = useAuth();
  const [type, setType] = useState<TransactionType>("expense");
  const [amount, setAmount] = useState<number | undefined>(undefined);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [category, setCategory] = useState(UNSELECTED_VALUE);
  const [description, setDescription] = useState("");

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (amount === undefined || category === UNSELECTED_VALUE) {
      toast.error("Preencha todos os campos obrigatórios (Valor e Subcategoria).");
      return;
    }

    onAddTransaction({
      type,
      amount: amount as number,
      date,
      category: category === UNSELECTED_VALUE ? null : category, // Convert UNSELECTED_VALUE to null
      description,
    });

    // Reset form
    setAmount(undefined);
    setCategory(UNSELECTED_VALUE);
    setDescription("");
    
    toast.success(type === "income" ? "Receita adicionada!" : "Despesa adicionada!", {
      style: { backgroundColor: 'hsl(var(--soft-green))', color: 'hsl(var(--success-darker))' }
    });
  };

  return (
    <Card className="p-6 animate-slide-up rounded-xl shadow-sm">
      <h2 className="text-2xl font-bold mb-6">Novo Lançamento</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="type">Tipo</Label>
            <Select value={type} onValueChange={(value) => {
              setType(value as TransactionType);
              setCategory(UNSELECTED_VALUE); // Reset category when type changes
            }}>
              <SelectTrigger className="rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="income">Receita</SelectItem>
                <SelectItem value="expense">Despesa</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Valor (R$)</Label>
            <CurrencyInput
              id="amount"
              value={amount}
              onValueChange={(values) => setAmount(values.floatValue)}
              placeholder="0,00"
              required
              className="rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="date">Data</Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Subcategoria</Label> {/* Label atualizada */}
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Selecione a subcategoria" /> {/* Placeholder atualizado */}
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNSELECTED_VALUE} disabled>Selecione a subcategoria</SelectItem>
                {filteredSubcategories.length === 0 ? (
                  <SelectItem value={UNSELECTED_VALUE} disabled>Nenhuma subcategoria disponível</SelectItem>
                ) : (
                  filteredSubcategories
                    .map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.nome} {/* Exibir apenas o nome da subcategoria */}
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