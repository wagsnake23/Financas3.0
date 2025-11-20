import { Card } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { Tables } from "@/integrations/supabase/types";
import { AppCategory } from "@/types/finance";

interface RevenueByTypeChartProps {
  revenues: Tables<'receitas'>[];
  revenueTypes: AppCategory[];
}

export const RevenueByTypeChart = ({ revenues, revenueTypes }: RevenueByTypeChartProps) => {
  const incomeByType = revenues
    .reduce((acc, revenue) => {
      const type = revenueTypes.find(t => t.id === revenue.tipo_receita_id);
      const typeName = type?.nome || "Outros";
      const typeColor = type?.cor || `hsl(${Math.floor(Math.random() * 360)}, 70%, 50%)`;

      if (!acc[typeName]) {
        acc[typeName] = { value: 0, color: typeColor };
      }
      acc[typeName].value += revenue.valor;
      return acc;
    }, {} as Record<string, { value: number; color: string }>);

  const chartData = Object.entries(incomeByType).map(([name, data]) => ({
    name,
    value: data.value,
    color: data.color,
  }));

  if (chartData.length === 0) {
    return (
      <Card className="p-6 animate-fade-in rounded-xl shadow-sm">
        <h2 className="text-xl font-semibold mb-4">Receitas por Subcategoria</h2>
        <div className="h-60 flex items-center justify-center text-muted-foreground">
          Nenhuma receita registrada
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 animate-fade-in rounded-xl shadow-sm">
      <h2 className="text-xl font-semibold mb-4">Receitas por Subcategoria</h2>
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
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
    </Card>
  );
};