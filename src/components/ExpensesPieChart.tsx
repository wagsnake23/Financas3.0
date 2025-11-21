import { Card } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { Transaction } from "@/types/finance";
import { AppCategory } from "@/types/finance";
import { cn, formatCurrency } from "@/lib/utils"; // Importar formatCurrency

interface ExpensesPieChartProps {
  transactions: Transaction[];
  allCategories: AppCategory[];
  isMobile?: boolean;
}

export const ExpensesPieChart = ({ transactions, allCategories, isMobile }: ExpensesPieChartProps) => {

  // Função auxiliar para encontrar a categoria principal de uma subcategoria
  const getMainCategory = (subcategoryId: string): AppCategory => {
    let currentCategory = allCategories.find(cat => cat.id === subcategoryId);

    // Se a subcategoria não for encontrada, ou se for uma categoria principal (parent_id é null), retorna ela mesma.
    // Caso contrário, procura recursivamente a categoria pai até encontrar a principal.
    while (currentCategory && currentCategory.parent_id !== null) {
      const parent = allCategories.find(cat => cat.id === currentCategory?.parent_id);
      if (parent) {
        currentCategory = parent;
      } else {
        // Se o pai não for encontrado, a categoria atual é a mais alta que podemos identificar.
        break;
      }
    }

    // Retorna a categoria principal encontrada ou um objeto "Outros" se nada for identificado
    return currentCategory || {
      id: "outros",
      nome: "Outros",
      icone: "MoreHorizontal",
      cor: "hsl(215, 15%, 50%)", // Cor padrão para 'Outros'
      parent_id: null,
    };
  };

  const expensesByCategory = transactions
    .filter(t => t.type === "expense")
    .reduce((acc, transaction) => {
      // Obtém a categoria principal para a transação
      const mainCategory = getMainCategory(transaction.category);
      
      const displayCategoryName = mainCategory.nome;
      const displayCategoryColor = mainCategory.cor;
      
      if (!acc[displayCategoryName]) {
        acc[displayCategoryName] = { value: 0, color: displayCategoryColor };
      }
      acc[displayCategoryName].value += Math.abs(transaction.amount); // Usar Math.abs() para garantir valor absoluto
      return acc;
    }, {} as Record<string, { value: number; color: string }>);

  const chartData = Object.entries(expensesByCategory).map(([name, data]) => ({
    name,
    value: data.value,
    color: data.color,
  }));

  if (chartData.length === 0) {
    return (
      <Card className={cn("p-6 animate-slide-up rounded-xl shadow-sm", isMobile && "p-4")}>
        <h2 className={cn("text-2xl font-bold mb-6", isMobile && "text-xl mb-4")}>Despesas por Categoria</h2>
        <div className={cn("h-80 flex items-center justify-center text-muted-foreground", isMobile && "h-48")}>
          Nenhuma despesa registrada
        </div>
      </Card>
    );
  }

  return (
    <Card className={cn("p-6 animate-slide-up rounded-xl shadow-sm", isMobile && "p-4")}>
      <h2 className={cn("text-2xl font-bold mb-6", isMobile && "text-xl mb-4")}>Despesas por Categoria</h2>
      <ResponsiveContainer width="100%" height={isMobile ? 200 : 320}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
            outerRadius={isMobile ? 60 : 100}
            fill="#8884d8"
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip 
            formatter={(value: number) => formatCurrency(value)}
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