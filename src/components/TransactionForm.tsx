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

interface TransactionFormProps {
  onAddTransaction: (transaction: Omit<Transaction, "id">) => void;
}

const UNSELECTED_VALUE = "unselected"; // Valor único para representar 'não selecionado'

export const TransactionForm = ({ onAddTransaction }: TransactionFormProps) => {
  const { user } = useAuth();
  const [type, setType] = useState<TransactionType>("expense");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [category, setCategory] = useState(UNSELECTED_VALUE); // Inicializado com UNSELECTED_VALUE
  const [description, setDescription] = useState("");

  // Fetch ALL categories from Supabase (user-specific and default ones with user_id: null)
  const { data: fetchedCategories = [] } = useQuery<AppCategory[]>({
    queryKey: ["transactionFormCategories", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("categorias")
        .select("*")
        .or(`user_id.eq.${user.id},user_id.is.null`)
        .order("nome");
      if (error) throw error;
      return data as AppCategory[];
    },
    enabled: !!user?.id,
  });

  const allCategories = fetchedCategories;

  const filteredCategories = useMemo(() => {
    if (type === "income") {
      // For income, show only subcategories of the 'Receitas e Investimentos' root
      return allCategories.filter(cat => cat.parent_id === 'receitas_e_investimentos');
    } else {
      // For expense, show all categories that are not the 'Receitas e Investimentos' root or its subcategories
      return allCategories.filter(cat => cat.id !== 'receitas_e_investimentos' && cat.parent_id !== 'receitas_e_investimentos');
    }
  }, [type, allCategories]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!amount || category === UNSELECTED_VALUE) { // Verificação com UNSELECTED_VALUE
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    onAddTransaction({
      type,
      amount: parseFloat(amount),
      date,
      category,
      description,
    });

    // Reset form
    setAmount("");
    setCategory(UNSELECTED_VALUE); // Reset para UNSELECTED_VALUE
    setDescription("");
    
    toast.success(type === "income" ? "Receita adicionada!" : "Despesa adicionada!", {
      style: { backgroundColor: 'hsl(var(--soft-green))', color: 'hsl(var(--success))' }
    });
  };

  return (
    <Card className="p-6 animate-slide-up">
      <h2 className="text-2xl font-bold mb-6">Novo Lançamento</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="type">Tipo</Label>
            <Select value={type} onValueChange={(value) => {
              setType(value as TransactionType);
              setCategory(UNSELECTED_VALUE); // Reset category when type changes to UNSELECTED_VALUE
            }}>
              <SelectTrigger>
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
            <Input
              id="amount"
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0,00"
              required
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
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Categoria</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNSELECTED_VALUE} disabled>Selecione...</SelectItem> {/* Usando UNSELECTED_VALUE */}
                {filteredCategories.length === 0 ? (
                  <SelectItem value={UNSELECTED_VALUE} disabled>Nenhuma categoria disponível</SelectItem>
                ) : (
                  filteredCategories
                    .map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.parent_id ? `— ${allCategories.find(p => p.id === cat.parent_id)?.nome} > ${cat.nome}` : cat.nome}
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
          />
        </div>

        <Button type="submit" className="w-full" size="lg">
          <DynamicIcon name="Plus" className="mr-2 h-4 w-4" />
          Adicionar Lançamento
        </Button>
      </form>
    </Card>
  );
};