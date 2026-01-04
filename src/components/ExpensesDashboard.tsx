import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { Tables } from "@/integrations/supabase/types";
import DynamicIcon from "./DynamicIcon";
import { AppCategory } from "@/types/finance";
import { TotalExpensesCard } from "./TotalExpensesCard";
import { MonthlyExpenseBarChart } from "./MonthlyExpenseBarChart";

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
      const color = subcategory?.cor || "hsl(215, 15%, 50%)";

      if (!acc[id]) {
        acc[id] = { nome: name, value: 0, color, icone: icon };
      }
      acc[id].value += expense.valor_total;
      return acc;
    }, {} as Record<string, { nome: string, value: number; color: string, icone: string }>);

    return Object.values(grouped).map((data) => ({
      ...data
    }));
  }, [expenses, subcategories]);

  const expensesByParentCategory = useMemo(() => {
    const grouped = expenses.reduce((acc, expense) => {
      const subcategory = subcategories.find(c => c.id === expense.categoria_id);
      const parent = subcategory ? parentCategories.find(c => c.id === subcategory.parent_id) : null;
      const id = parent?.id || "others";
      const name = parent?.nome || "Outros";
      const icon = parent?.icone || "📁";
      const color = parent?.cor || "hsl(215, 15%, 50%)";

      if (!acc[id]) {
        acc[id] = { nome: name, value: 0, color, icone: icon };
      }
      acc[id].value += expense.valor_total;
      return acc;
    }, {} as Record<string, { nome: string, value: number; color: string, icone: string }>);

    return Object.values(grouped).map((data) => ({
      ...data
    }));
  }, [expenses, subcategories, parentCategories]);

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

      <Card className="p-6 animate-fade-in rounded-xl shadow-sm">
        <h2 className="text-xl font-semibold mb-4">Despesas por Subcategoria</h2>
        {expensesBySubcategory.length === 0 ? (
          <div className="h-60 flex items-center justify-center text-muted-foreground">
            Nenhuma despesa registrada
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={expensesBySubcategory}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ nome, icone, percent }) => `${icone} ${nome}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {expensesBySubcategory.map((entry, index) => (
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

      <Card className="p-6 animate-fade-in rounded-xl shadow-sm">
        <h2 className="text-xl font-semibold mb-4">Despesas por Categoria</h2>
        {expensesByParentCategory.length === 0 ? (
          <div className="h-60 flex items-center justify-center text-muted-foreground">
            Nenhuma despesa registrada
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={expensesByParentCategory}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ nome, icone, percent }) => `${icone} ${nome}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {expensesByParentCategory.map((entry, index) => (
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