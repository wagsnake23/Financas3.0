import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { Tables } from "@/integrations/supabase/types";
import DynamicIcon from "./DynamicIcon";
import { AppCategory } from "@/types/finance";
import { TotalExpensesCard } from "./TotalExpensesCard";
import { MonthlyExpenseBarChart } from "./MonthlyExpenseBarChart";
import { formatCurrency } from "@/lib/utils";
import { getCategoryColor } from "@/lib/categoryColors";

const groupSubcategories = (data: any[], limit: number) => {
  if (data.length <= limit) return data;
  const sorted = [...data].sort((a, b) => b.value - a.value);
  const top = sorted.slice(0, limit);
  const others = sorted.slice(limit);
  const totalOthers = others.reduce((acc, curr) => acc + curr.value, 0);

  return [
    ...top,
    {
      nome: "Outros",
      value: totalOthers,
      color: "#94a3b8",
      icone: "📁"
    }
  ];
};

interface ExpensesDashboardProps {
  expenses: Tables<'despesas'>[];
  expenseInstallments: (Tables<'despesas_parcelas'> & { despesas: Pick<Tables<'despesas'>, 'categoria_id'> | null })[];
  categories: AppCategory[];
  isMobile: boolean;
}

export const ExpensesDashboard = ({ expenses, expenseInstallments, categories, isMobile }: ExpensesDashboardProps) => {
  const filteredExpenseInstallments = expenseInstallments;
  const totalExpenses = filteredExpenseInstallments.reduce((sum, p) => sum + p.valor_parcela, 0);
  const allCategories = categories;
  const subcategories = allCategories.filter(c => c.parent_id !== null);
  const parentCategories = allCategories.filter(c => c.parent_id === null);

  const expensesBySubcategory = useMemo(() => {
    const grouped = expenses.reduce((acc, expense) => {
      const subcategory = subcategories.find(c => c.id === expense.categoria_id);
      const id = subcategory?.id || "others";
      const name = subcategory?.nome || "Outros";
      const icon = subcategory?.icone || "📁";
      const color = subcategory ? getCategoryColor(subcategory, allCategories) : "hsl(215, 15%, 50%)";

      if (!acc[id]) {
        acc[id] = { nome: name, value: 0, color, icone: icon };
      }
      acc[id].value += expense.valor_total;
      return acc;
    }, {} as Record<string, { nome: string, value: number; color: string, icone: string }>);

    const rawData = Object.values(grouped);
    const limit = isMobile ? 5 : 8;
    return groupSubcategories(rawData, limit);
  }, [expenses, subcategories, isMobile, allCategories]);

  const totalMonthlyAmount = useMemo(() => {
    return expensesBySubcategory.reduce((sum, item) => sum + item.value, 0);
  }, [expensesBySubcategory]);



  return (
    <div className="grid grid-cols-1 gap-6 mb-8">
      {isMobile && (
        <TotalExpensesCard
          expenseInstallments={expenseInstallments}
          isMobile={isMobile}
          chartContent={
            <MonthlyExpenseBarChart
              expenseInstallments={expenseInstallments}
              currentDate={new Date()}
              isMobile={true}
              onMonthClick={() => { }}
            />
          }
          annualTotalValue={expenseInstallments
            .filter(p => new Date(p.vencimento).getFullYear() === new Date().getFullYear())
            .reduce((sum, p) => sum + p.valor_parcela, 0)
          }
        />
      )}

      <Card className="p-6 animate-fade-in rounded-2xl shadow-sm border border-gray-100 bg-white">
        <div className="flex items-center gap-2 mb-6">
          <div className="h-8 w-1.5 bg-indigo-500 rounded-full" />
          <h2 className="text-xl font-bold text-gray-800 tracking-tight">Despesas por Subcategoria</h2>
        </div>

        {expensesBySubcategory.length === 0 ? (
          <div className="h-60 flex flex-col items-center justify-center text-muted-foreground bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
            <DynamicIcon name="BarChart2" className="h-12 w-12 mb-2 opacity-20" />
            <p className="text-sm font-medium">Nenhuma despesa registrada</p>
          </div>
        ) : (
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={expensesBySubcategory}
                layout="vertical"
                margin={{ left: isMobile ? 0 : 30, right: isMobile ? 0 : 40, top: 0, bottom: 0 }}
                barGap={8}
              >
                <XAxis type="number" hide />
                <YAxis
                  dataKey="nome"
                  type="category"
                  width={isMobile ? 100 : 130}
                  axisLine={false}
                  tickLine={false}
                  tick={({ x, y, payload }) => (
                    <g transform={`translate(${x},${y})`}>
                      <text
                        x={-10}
                        y={0}
                        dy={4}
                        textAnchor="end"
                        className="fill-gray-600 text-[11px] md:text-[13px] font-bold"
                      >
                        {payload.value.length > 15 ? `${payload.value.substring(0, 13)}...` : payload.value}
                      </text>
                    </g>
                  )}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(0,0,0,0.02)' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      const perc = totalMonthlyAmount > 0 ? ((data.value / totalMonthlyAmount) * 100).toFixed(1) : "0";
                      return (
                        <div className="bg-white p-4 shadow-xl border border-gray-100 rounded-xl">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xl">{data.icone}</span>
                            <span className="font-bold text-gray-800">{data.nome}</span>
                          </div>
                          <div className="flex items-baseline gap-2">
                            <span className="text-lg font-black text-indigo-600">{formatCurrency(data.value)}</span>
                            <span className="text-xs font-bold text-gray-400">({perc}%)</span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar
                  dataKey="value"
                  radius={[0, 8, 8, 0]}
                  barSize={isMobile ? 14 : 18}
                >
                  {expensesBySubcategory.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} fillOpacity={0.9} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>


    </div>
  );
};