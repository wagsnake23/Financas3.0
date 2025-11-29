import React, { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Tables } from "@/integrations/supabase/types";
import { AppCategory } from "@/types/finance";
import { cn, formatCurrency } from "@/lib/utils";

interface TopExpensesBarChartProps {
  expenses: Tables<'despesas'>[];
  categories: AppCategory[];
  isMobile?: boolean;
}

export const TopExpensesBarChart: React.FC<TopExpensesBarChartProps> = ({ expenses, categories, isMobile }) => {
  const chartData = useMemo(() => {
    const categoryTotals: { [key: string]: { name: string; value: number; color: string } } = {};
    const allSubcategories = categories;

    expenses.forEach(expense => {
      const subcategory = allSubcategories.find(c => c.id === expense.categoria_id);
      const categoryName = subcategory?.nome || "Outros";
      const categoryColor = subcategory?.cor || "hsl(215, 15%, 50%)"; // Default color

      if (!categoryTotals[categoryName]) {
        categoryTotals[categoryName] = { name: categoryName, value: 0, color: categoryColor };
      }
      categoryTotals[categoryName].value += expense.valor_total;
    });

    const sortedCategories = Object.values(categoryTotals)
      .sort((a, b) => b.value - a.value); // Removido .slice(0, 10) para mostrar todas as categorias

    return sortedCategories;
  }, [expenses, categories]);

  if (chartData.length === 0) {
    return (
      <Card className={cn("p-6 animate-fade-in rounded-xl shadow-sm", isMobile && "p-4")}>
        <h2 className={cn("text-xl font-semibold mb-4", isMobile && "text-lg mb-3")}>Subcategorias por Valor</h2>
        <div className={cn("h-60 flex items-center justify-center text-muted-foreground", isMobile && "h-48")}>
          Nenhuma despesa registrada
        </div>
      </Card>
    );
  }

  return (
    <Card className={cn("p-6 animate-fade-in rounded-xl shadow-sm", isMobile && "p-4")}>
      <h2 className={cn("text-xl font-semibold mb-4", isMobile && "text-lg mb-3")}>Subcategorias por Valor</h2>
      <ResponsiveContainer width="100%" height={isMobile ? 200 : Math.max(300, chartData.length * 40)}> {/* Ajusta a altura dinamicamente */}
        <BarChart
          data={chartData}
          margin={{
            top: 5,
            right: 10,
            left: 10,
            bottom: 5,
          }}
          layout="vertical"
        >
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
          <XAxis
            type="number"
            stroke="hsl(var(--muted-foreground))"
            tickFormatter={(value: number) => formatCurrency(value)}
            style={{ fontSize: isMobile ? "10px" : "12px" }}
          />
          <YAxis
            type="category"
            dataKey="name"
            stroke="hsl(var(--muted-foreground))"
            width={isMobile ? 80 : 120}
            tick={{ fill: "hsl(var(--foreground))" }}
            style={{ fontSize: isMobile ? "10px" : "12px" }}
          />
          <Tooltip
            formatter={(value: number) => formatCurrency(value)}
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "var(--radius)",
            }}
          />
          <Bar dataKey="value" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
};