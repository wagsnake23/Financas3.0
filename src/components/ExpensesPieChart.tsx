import { Card } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { Transaction } from "@/types/finance";
import { AppCategory } from "@/types/finance";
import { cn } from "@/lib/utils"; // Importar cn

interface ExpensesPieChartProps {
  transactions: Transaction[];
  allCategories: AppCategory[];
  isMobile?: boolean; // Adicionar prop isMobile
}

export const ExpensesPieChart = ({ transactions, allCategories, isMobile }: ExpensesPieChartProps) => {
  const expensesByCategory = transactions
    .filter(t => t.type === "expense")
    .filter(t => !t.is_fixed || t.isRecurring) // Filter out legacy fixed transactions
    .reduce((acc, transaction) => {
      const category = allCategories.find(c => c.id === transaction.category);
      const categoryName = category?.nome || "Outros";
      const categoryColor = category?.cor || "hsl(215, 15%, 50%)";
      
      if (!acc[categoryName]) {
        acc[categoryName] = { value: 0, color: categoryColor };
      }
      acc[categoryName].value += transaction.amount;
      return acc;
    }, {} as Record<string, { value: number; color: string }>);

  const chartData = Object.entries(expensesByCategory).map(([name, data]) => ({
    name,
    value: data.value,
    color: data.color,
  }));

  if (chartData.length === 0) {
    return (
      <Card className={cn("p-6 animate-slide-up rounded-xl shadow-sm", isMobile && "p-4")}> {/* Ajustar padding */}
        <h2 className={cn("text-2xl font-bold mb-6", isMobile && "text-xl mb-4")}>Despesas por Categoria</h2>
        <div className={cn("h-80 flex items-center justify-center text-muted-foreground", isMobile && "h-48")}> {/* Ajustar altura */}
          Nenhuma despesa registrada
        </div>
      </Card>
    );
  }

  return (
    <Card className={cn("p-6 animate-slide-up rounded-xl shadow-sm", isMobile && "p-4")}> {/* Ajustar padding */}
      <h2 className={cn("text-2xl font-bold mb-6", isMobile && "text-xl mb-4")}>Despesas por Categoria</h2>
      <ResponsiveContainer width="100%" height={isMobile ? 200 : 320}> {/* Altura condicional */}
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
            outerRadius={isMobile ? 60 : 100} // Raio externo condicional
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
    </Card>
  );
};