import React, { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Cell } from "recharts"; // Removido Tooltip
import { Tables } from "@/integrations/supabase/types";
import { format, subMonths, getMonth, getYear } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn, formatCurrency } from "@/lib/utils";

interface MonthlyRevenueBarChartProps {
  revenues: Tables<'receitas'>[];
  currentDate: Date;
  isMobile?: boolean;
  onMonthClick: (date: Date) => void;
}

export const MonthlyRevenueBarChart: React.FC<MonthlyRevenueBarChartProps> = ({
  revenues,
  currentDate,
  isMobile,
  onMonthClick,
}) => {
  const chartData = useMemo(() => {
    const dataMap: { [key: string]: { month: string; revenues: number; fullDate: Date; isCurrentMonth: boolean } } = {};
    const currentYear = getYear(currentDate);
    const currentMonthIndex = getMonth(currentDate);

    for (let i = 0; i < 12; i++) {
      const monthDate = subMonths(new Date(currentYear, 11), 11 - i);
      const monthKey = format(monthDate, "MMM", { locale: ptBR });
      const isCurrentMonth = getMonth(monthDate) === currentMonthIndex && getYear(monthDate) === currentYear;
      dataMap[monthKey] = { month: monthKey, revenues: 0, fullDate: monthDate, isCurrentMonth };
    }

    revenues.forEach(revenue => {
      const data = revenue.data;
      const revenueYear = Number(data.substring(0, 4));
      const revenueMonthIndex = Number(data.substring(5, 7)) - 1;

      if (revenueYear === currentYear) {
        // Find the month name for the key
        const monthDate = new Date(currentYear, revenueMonthIndex, 1);
        const monthKey = format(monthDate, "MMM", { locale: ptBR });

        if (dataMap[monthKey]) {
          dataMap[monthKey].revenues += revenue.valor;
        }
      }
    });

    return Object.values(dataMap).sort((a, b) => a.fullDate.getTime() - b.fullDate.getTime());
  }, [revenues, currentDate]);

  if (chartData.every(d => d.revenues === 0)) {
    return (
      <div className={cn("h-24 flex items-center justify-center text-muted-foreground text-sm", isMobile && "h-16 text-xs")}>
        Nenhuma receita registrada este ano.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={isMobile ? 90 : 260} minHeight={isMobile ? undefined : 260}>
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
            const color = entry.isCurrentMonth ? "hsl(var(--success))" : "hsl(var(--muted-foreground))";
            return (
              <text
                x={x}
                y={y}
                dy={7} /* Ajustado para aproximar os meses das barras */
                textAnchor="middle"
                fill={color}
                style={{ fontSize: isMobile ? "11px" : "13px", fontWeight: "bold", cursor: "pointer", fontFamily: "Roboto" }}
                onClick={() => onMonthClick(entry.fullDate)}
              >
                {payload.value.substring(0, 3)}
              </text>
            );
          }}
        />
        <YAxis
          hide={true}
          domain={[0, 'dataMax']}
        />
        {/* Removido Tooltip */}
        <Bar dataKey="revenues" radius={[4, 4, 0, 0]} barSize={isMobile ? 18 : 24} activeBar={false}>
          {chartData.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={entry.isCurrentMonth ? "hsl(var(--success))" : "hsl(var(--soft-green))"}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};