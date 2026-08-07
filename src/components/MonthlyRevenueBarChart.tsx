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
        <CartesianGrid vertical={false} stroke="#cbd5e1" strokeDasharray="3 3" opacity={0.6} />
        <XAxis
          dataKey="month"
          height={24}
          axisLine={false}
          tickLine={false}
          interval={0}
          tick={({ x, y, payload }) => {
            const entry = chartData[payload.index];
            const isCurrentMonth = entry.isCurrentMonth;
            const color = isCurrentMonth ? "#15803d" : "#4B5563";
            
            return (
              <g>
                <text
                  x={x}
                  y={y}
                  dy={10}
                  textAnchor="middle"
                  fill={color}
                  style={{ 
                    fontSize: isMobile ? "10px" : "11px", 
                    fontWeight: 700, 
                    cursor: "pointer", 
                    fontFamily: "Inter, sans-serif"
                  }}
                  onClick={() => onMonthClick(entry.fullDate)}
                >
                  {payload.value.charAt(0).toUpperCase() + payload.value.substring(1, 3).toLowerCase()}
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
            
            const r = Math.min(4, newHeight / 2); // Reverted radius
            const path = `M${x},${newY + r} A${r},${r} 0 0,1 ${x + r},${newY} L${x + width - r},${newY} A${r},${r} 0 0,1 ${x + width},${newY + r} L${x + width},${newY + newHeight - r} A${r},${r} 0 0,1 ${x + width - r},${newY + newHeight} L${x + r},${newY + newHeight} A${r},${r} 0 0,1 ${x},${newY + newHeight - r} Z`;

            let gradientColors = { start: "#bbf7d0", end: "#22c55e" };
            if (isCurrentMonth) {
               gradientColors = { start: "#22c55e", end: "#15803d" };
            }

            const gradientId = `barGrad-rev-${isCurrentMonth ? 'act' : 'inact'}`;
            const strokeGradId = `strokeGrad-rev-${isCurrentMonth ? 'act' : 'inact'}`;

            return (
              <g>
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={gradientColors.start} stopOpacity={isCurrentMonth ? 1 : 0.85} />
                    <stop offset="100%" stopColor={gradientColors.end} stopOpacity={isCurrentMonth ? 1 : 0.65} />
                  </linearGradient>
                  <linearGradient id={strokeGradId} x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity={isCurrentMonth ? 0.6 : 0.3} />
                    <stop offset="100%" stopColor="#000000" stopOpacity={isCurrentMonth ? 0.05 : 0.02} />
                  </linearGradient>
                </defs>
                {isCurrentMonth && (
                  <path d={path} fill="none" stroke={gradientColors.end} strokeWidth="6" opacity="0.12" filter="blur(3px)" />
                )}
                <path d={path} fill={`url(#${gradientId})`} stroke={`url(#${strokeGradId})`} strokeWidth="1" />
                <rect x={x + 3} y={newY + 2} width={Math.max(0, width - 6)} height={4} rx={2} fill="#ffffff" opacity={isCurrentMonth ? 0.6 : 0.25} />
              </g>
            );
          }}
        />
      </BarChart>
    </ResponsiveContainer>
  );
};