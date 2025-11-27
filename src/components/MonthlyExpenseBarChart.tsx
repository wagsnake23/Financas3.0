import React, { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Tables } from "@/integrations/supabase/types";
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval, getMonth, getYear } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn, formatCurrency } from "@/lib/utils";

interface MonthlyExpenseBarChartProps {
  expenseInstallments: (Tables<'despesas_parcelas'> & { despesas: Pick<Tables<'despesas'>, 'categoria_id'> | null })[];
  currentDate: Date; // To determine the year for the 12-month range
  isMobile?: boolean;
}

export const MonthlyExpenseBarChart: React.FC<MonthlyExpenseBarChartProps> = ({
  expenseInstallments,
  currentDate,
  isMobile,
}) => {
  const chartData = useMemo(() => {
    const dataMap: { [key: string]: { month: string; expenses: number; fullDate: Date } } = {};
    const currentYear = getYear(currentDate); // Use the year from currentDate

    // Initialize data for the last 12 months (Jan-Dec of the current year)
    for (let i = 0; i < 12; i++) {
      const monthDate = subMonths(new Date(currentYear, 11), 11 - i); // Start from Jan of currentYear
      const monthKey = format(monthDate, "MMM", { locale: ptBR });
      dataMap[monthKey] = { month: monthKey, expenses: 0, fullDate: monthDate };
    }

    expenseInstallments.forEach(installment => {
      const installmentDate = new Date(installment.vencimento);
      const installmentYear = getYear(installmentDate);

      // Only include installments from the current year (based on currentDate)
      if (installmentYear === currentYear) {
        const monthKey = format(installmentDate, "MMM", { locale: ptBR });
        if (dataMap[monthKey]) {
          dataMap[monthKey].expenses += installment.valor_parcela;
        }
      }
    });

    // Convert map to array and sort by date
    return Object.values(dataMap).sort((a, b) => a.fullDate.getTime() - b.fullDate.getTime());
  }, [expenseInstallments, currentDate]);

  if (chartData.every(d => d.expenses === 0)) {
    return (
      <div className={cn("h-24 flex items-center justify-center text-muted-foreground text-sm", isMobile && "h-16 text-xs")}>
        Nenhuma despesa registrada este ano.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={isMobile ? 80 : 120}>
      <BarChart data={chartData} margin={{ top: 5, right: 0, left: 0, bottom: 5 }}>
        <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
        <XAxis
          dataKey="month"
          axisLine={false}
          tickLine={false}
          style={{ fontSize: isMobile ? "10px" : "12px" }} 
          tickFormatter={(value) => value.substring(0, 3)} // Show only first 3 letters
        />
        <YAxis
          hide={true} // Hide Y-axis for a cleaner look
          domain={[0, 'dataMax']}
        />
        <Tooltip
          cursor={{ fill: 'hsl(var(--muted)/50%)' }}
          formatter={(value: number) => formatCurrency(value)}
          contentStyle={{
            backgroundColor: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "var(--radius)",
            fontSize: isMobile ? "10px" : "12px",
            padding: isMobile ? "4px 6px" : "6px 8px",
          }}
          labelStyle={{ fontSize: isMobile ? "10px" : "12px" }}
        />
        <Bar dataKey="expenses" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
};