import React, { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Cell } from "recharts"; // Removido Tooltip
import { Tables } from "@/integrations/supabase/types";
import { format, subMonths, getMonth, getYear } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn, formatCurrency } from "@/lib/utils";

interface MonthlyExpenseBarChartProps {
  expenseInstallments: (Tables<'despesas_parcelas'> & { despesas: Pick<Tables<'despesas'>, 'categoria_id'> | null })[];
  currentDate: Date; // To determine the year for the 12-month range
  isMobile?: boolean;
  onMonthClick: (date: Date) => void; // NOVA PROP
}

export const MonthlyExpenseBarChart: React.FC<MonthlyExpenseBarChartProps> = ({
  expenseInstallments,
  currentDate,
  isMobile,
  onMonthClick, // NOVA PROP
}) => {
  const chartData = useMemo(() => {
    const dataMap: { [key: string]: { month: string; expenses: number; fullDate: Date; isCurrentMonth: boolean } } = {};
    const currentYear = getYear(currentDate);
    const currentMonthIndex = getMonth(currentDate);

    // Initialize data for the last 12 months (Jan-Dec of the current year)
    for (let i = 0; i < 12; i++) {
      const monthDate = subMonths(new Date(currentYear, 11), 11 - i); // Start from Jan of currentYear
      const monthKey = format(monthDate, "MMM", { locale: ptBR });
      const isCurrentMonth = getMonth(monthDate) === currentMonthIndex && getYear(monthDate) === currentYear;
      dataMap[monthKey] = { month: monthKey, expenses: 0, fullDate: monthDate, isCurrentMonth };
    }

    expenseInstallments.forEach(installment => {
      const vencimento = installment.vencimento;
      const installmentYear = Number(vencimento.substring(0, 4));
      const installmentMonthIndex = Number(vencimento.substring(5, 7)) - 1;

      // Only include installments from the current year (based on currentDate)
      if (installmentYear === currentYear) {
        // Find the month name for the key
        const monthDate = new Date(currentYear, installmentMonthIndex, 1);
        const monthKey = format(monthDate, "MMM", { locale: ptBR });

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
    <ResponsiveContainer width="100%" height={isMobile ? 90 : 105} minHeight={isMobile ? undefined : 105}>
      <BarChart data={chartData} margin={{ top: 3, right: 0, left: 0, bottom: 6 }} barCategoryGap="10%">
        <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
        <XAxis
          dataKey="month"
          height={12}
          axisLine={false}
          tickLine={false}
          interval={0}
          tick={({ x, y, payload }) => {
            const entry = chartData[payload.index];
            const color = entry.isCurrentMonth ? "hsl(var(--destructive))" : "#000000";
            return (
              <text
                x={x}
                y={y}
                dy={7}
                textAnchor="middle"
                fill={color}
                style={{ 
                  fontSize: isMobile ? "11px" : "13px", 
                  fontWeight: "bold", 
                  cursor: "pointer", 
                  fontFamily: "Roboto",
                  filter: entry.isCurrentMonth ? "drop-shadow(1px 1px 1px rgba(0,0,0,0.08))" : "none"
                }}
                onClick={() => onMonthClick(entry.fullDate)}
              >
                {payload.value.substring(0, 3)}
              </text>
            );
          }}
        />
        <YAxis
          hide={true} // Hide Y-axis for a cleaner look
          domain={[0, 'dataMax']}
        />
        {/* Removido Tooltip */}
        <Bar dataKey="expenses" radius={[4, 4, 4, 4]} barSize={isMobile ? 18 : 24} activeBar={false}>
          {chartData.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={entry.isCurrentMonth ? "#dc2626" : "hsl(var(--destructive))"}
              fillOpacity={entry.isCurrentMonth ? 1 : 0.55}
              className="transition-all duration-300"
              style={{
                filter: entry.isCurrentMonth 
                  ? "drop-shadow(2px 2px 0px rgba(0,0,0,0.12)) drop-shadow(4px 4px 8px rgba(0,0,0,0.15))" 
                  : "drop-shadow(1px 1px 0px rgba(0,0,0,0.08)) drop-shadow(3px 3px 6px rgba(0,0,0,0.1))",
                stroke: "rgba(255,255,255,0.25)",
                strokeWidth: 1
              }}
            />
          ))}

        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};