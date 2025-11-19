import { Card } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { Tables } from "@/integrations/supabase/types";
import DynamicIcon from "./DynamicIcon";
import { AppCategory } from "@/types/finance";

interface ExpensesDashboardProps {
  expenses: Tables<'despesas'>[];
  expenseInstallments: (Tables<'despesas_parcelas'> & { despesas: Pick<Tables<'despesas'>, 'categoria_id' | 'is_fixed'> | null })[];
  categories: AppCategory[]; // Agora contém apenas subcategorias
  isMobile: boolean;
}

export const ExpensesDashboard = ({ expenses, expenseInstallments, categories, isMobile }: ExpensesDashboardProps) => {
  const filteredExpenseInstallments = expenseInstallments.filter(p => !p.despesas?.is_fixed);
  const totalExpenses = filteredExpenseInstallments.reduce((sum, p) => sum + p.valor_parcela, 0);
  const allSubcategories: AppCategory[] = categories; // Renomeado para clareza

  const expensesByCategory = expenses
    .filter(d => !d.is_fixed)
    .reduce((acc, expense) => {
      const category = allSubcategories.find(c => c.id === expense.categoria_id);
      const categoryNome = category?.nome || "Outros";
      const categoryCor = category?.cor || "hsl(215, 15%, 50%)";
      
      if (!acc[categoryNome]) {
        acc[categoryNome] = { value: 0, color: categoryCor };
      }
      acc[categoryNome].value += expense.valor_total;
      return acc;
    }, {} as Record<string, { value: number; color: string }>);

  const chartData = Object.entries(expensesByCategory).map(([nome, data]) => ({
    nome,
    value: data.value,
    color: data.color,
  }));

  return (
    <div className="grid grid-cols-1 gap-6 mb-8">
      <Card className="p-6 bg-gradient-to-br from-destructive/10 to-destructive/5 border-destructive/20 animate-fade-in rounded-xl shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Total de Despesas</p>
            <p className="text-3xl font-bold text-foreground">R$ {totalExpenses.toFixed(2)}</p>
          </div>
          <DynamicIcon name="DollarSign" className="h-12 w-12 text-destructive" />
        </div>
      </Card>

      <Card className="p-6 animate-fade-in rounded-xl shadow-sm">
        <h2 className="text-xl font-semibold mb-4">Despesas por Subcategoria</h2> {/* Título atualizado */}
        {chartData.length === 0 ? (
          <div className="h-60 flex items-center justify-center text-muted-foreground">
            Nenhuma despesa registrada
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ nome, percent }) => `${nome}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value: number) => `R$ ${value.toFixed(2)}`}
                contentStyle={{ 
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "var(--radius)",
                }}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )}
      </Card>
    </div>
  );
};