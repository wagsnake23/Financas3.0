import { Card } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { Transaction } from "@/types/finance";
import { AppCategory } from "@/types/finance";
import { cn, formatCurrency } from "@/lib/utils"; // Importar formatCurrency
import { getCategoryColor } from "@/lib/categoryColors";

interface ExpensesPieChartProps {
  transactions: Transaction[];
  allCategories: AppCategory[];
  isMobile?: boolean;
}

export const ExpensesPieChart = ({ transactions, allCategories, isMobile }: ExpensesPieChartProps) => {
  const expensesByCategory = transactions
    .filter(t => t.type === "expense")
    .reduce((acc, transaction) => {
      const subcategory = allCategories.find(c => c.id === transaction.category); // Esta é a subcategoria
      let parentCategory: AppCategory | undefined;

      if (subcategory && subcategory.parent_id) {
        parentCategory = allCategories.find(c => c.id === subcategory.parent_id);
      }

      // Usar o nome e a cor da categoria pai, se existir, caso contrário, usar a subcategoria ou um fallback
      const displayCategoryName = parentCategory?.nome || subcategory?.nome || "Outros";
      const displayCategoryColor = displayCategoryName === "Outros" ? "hsl(215, 15%, 50%)" : (parentCategory ? getCategoryColor(parentCategory, allCategories) : (subcategory ? getCategoryColor(subcategory, allCategories) : "hsl(215, 15%, 50%)"));

      if (!acc[displayCategoryName]) {
        acc[displayCategoryName] = { value: 0, color: displayCategoryColor };
      }
      acc[displayCategoryName].value += transaction.amount;
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
        <h2 className={cn("text-2xl font-bold mb-6", isMobile && "text-xl mb-4")}>Despesas por Categoria</h2> {/* Título atualizado */}
        <div className={cn("h-80 flex items-center justify-center text-muted-foreground", isMobile && "h-48")}>
          Nenhuma despesa registrada
        </div>
      </Card>
    );
  }

  return (
    <div className={cn(
      "p-6 animate-slide-up relative overflow-hidden rounded-[24px]",
      isMobile && "p-4"
    )} style={{
      background: "linear-gradient(135deg, #FFF8F8 0%, #FFFFFF 55%, #FFF4F4 100%)",
      border: "1px solid rgba(255,255,255,.85)",
      backgroundClip: "padding-box",
      boxShadow: "0 8px 24px rgba(37,99,235,.05), 0 2px 6px rgba(37,99,235,.03), inset 0 1px 0 rgba(255,255,255,.95)",
      backdropFilter: "blur(18px) saturate(1.4)",
      WebkitBackdropFilter: "blur(18px) saturate(1.4)"
    }}>
      {/* SHAPE ORGÂNICA */}
      <div aria-hidden="true" style={{ position: "absolute", top: "-20px", right: "-30px", width: "40%", height: "35%", borderRadius: "50%", background: "rgba(255,255,255,0.25)", filter: "blur(4px)", pointerEvents: "none", zIndex: 0 }} />
      {/* ILUMINAÇÃO TEMÁTICA */}
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at top right, rgba(239,68,68,.08), transparent 70%)", pointerEvents: "none", zIndex: 0, borderRadius: "inherit" }} />
      
      <div style={{ position: "relative", zIndex: 1 }}>
      <h2 className={cn("text-2xl font-bold mb-6 text-[#EF4444]", isMobile && "text-xl mb-4")}>Despesas por Categoria</h2> {/* Título atualizado */}
      <div style={{ filter: "drop-shadow(0 4px 10px rgba(0,0,0,.06))" }}>
        <ResponsiveContainer width="100%" height={isMobile ? 200 : 'auto'} minHeight={isMobile ? undefined : 260}>
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
      </div>
      </div>
    </div>
  );
};
