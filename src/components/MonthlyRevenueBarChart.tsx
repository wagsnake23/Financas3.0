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
    <ResponsiveContainer width="100%" height="100%" minHeight={isMobile ? 120 : 140}>
      <BarChart data={chartData} margin={{ top: 25, right: 0, left: 0, bottom: 0 }} barCategoryGap="15%">
        <CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="3 3" />
        <XAxis
          dataKey="month"
          height={24}
          axisLine={false}
          tickLine={false}
          interval={0}
          tick={({ x, y, payload }) => {
            const entry = chartData[payload.index];
            const isCurrentMonth = entry.isCurrentMonth;
            const color = isCurrentMonth ? "#15803d" : "#94a3b8";
            
            return (
              <g>
                <text
                  x={x}
                  y={y}
                  dy={10}
                  textAnchor="middle"
                  fill={color}
                  style={{ 
                    fontSize: isMobile ? "9px" : "10px", 
                    fontWeight: isCurrentMonth ? "800" : "600", 
                    cursor: "pointer", 
                    fontFamily: "Inter, sans-serif",
                    letterSpacing: "0.5px"
                  }}
                  onClick={() => onMonthClick(entry.fullDate)}
                >
                  {payload.value.substring(0, 3).toUpperCase()}
                </text>
                {isCurrentMonth && (
                  <circle cx={x} cy={y + 18} r={2.5} fill="#16a34a" />
                )}
              </g>
            );
          }}
        />
        <YAxis hide={true} domain={[0, 'dataMax']} />
        
        <Bar 
          dataKey="revenues" 
          barSize={isMobile ? 18 : 24} 
          activeBar={false}
          shape={(props: any) => {
            const { x, y, width, height, payload } = props;
            if (height === 0 || Number.isNaN(height)) return null;

            const isCurrentMonth = payload.isCurrentMonth;
            const newHeight = height;
            const newY = y;
            
            const radius = 6;
            const path = `M${x},${newY + radius} A${radius},${radius} 0 0,1 ${x + radius},${newY} L${x + width - radius},${newY} A${radius},${radius} 0 0,1 ${x + width},${newY + radius} L${x + width},${newY + newHeight} L${x},${newY + newHeight} Z`;

            let gradientColors = { start: "#86efac", end: "#22c55e" };
            if (isCurrentMonth) {
               gradientColors = { start: "#22c55e", end: "#15803d" };
            }

            const gradientId = `barGrad-revenue-${isCurrentMonth ? 'active' : 'inactive'}`;

            return (
              <g>
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={gradientColors.start} stopOpacity={isCurrentMonth ? 1 : 0.6} />
                    <stop offset="100%" stopColor={gradientColors.end} stopOpacity={isCurrentMonth ? 1 : 0.4} />
                  </linearGradient>
                </defs>
                {isCurrentMonth && (
                  <path d={path} fill="none" stroke={gradientColors.end} strokeWidth="4" opacity="0.10" filter="blur(2px)" />
                )}
                <path d={path} fill={`url(#${gradientId})`} />
                <rect x={x + 2} y={newY + 2} width={width - 4} height={isMobile ? 3 : 4} rx={isMobile ? 1.5 : 2} fill="#ffffff" opacity={isCurrentMonth ? 0.35 : 0.15} />
              </g>
            );
          }}
        />
      </BarChart>
    </ResponsiveContainer>
  );
};