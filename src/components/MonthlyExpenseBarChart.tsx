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
  getMonthlyExpensesFn?: (monthStr: string) => number; // Centralized function
  isMonthProjectedFn?: (monthStr: string) => boolean; // Projected month check
}

export const MonthlyExpenseBarChart: React.FC<MonthlyExpenseBarChartProps> = ({
  expenseInstallments,
  currentDate,
  isMobile,
  onMonthClick, // NOVA PROP
  getMonthlyExpensesFn,
  isMonthProjectedFn,
}) => {
  const chartData = useMemo(() => {
    const dataMap: { [key: string]: { month: string; expenses: number; fullDate: Date; isCurrentMonth: boolean; isProjected: boolean } } = {};
    const currentYear = getYear(currentDate);
    const currentMonthIndex = getMonth(currentDate);

    // Initialize data for the last 12 months (Jan-Dec of the current year)
    for (let i = 0; i < 12; i++) {
      const monthDate = subMonths(new Date(currentYear, 11), 11 - i); // Start from Jan of currentYear
      const monthKey = format(monthDate, "MMM", { locale: ptBR });
      const monthStr = format(monthDate, "yyyy-MM");
      const isCurrentMonth = getMonth(monthDate) === currentMonthIndex && getYear(monthDate) === currentYear;
      const isProjected = isMonthProjectedFn ? isMonthProjectedFn(monthStr) : false;
      dataMap[monthKey] = { month: monthKey, expenses: 0, fullDate: monthDate, isCurrentMonth, isProjected };
    }

    if (getMonthlyExpensesFn) {
      // Use centralized function
      Object.values(dataMap).forEach(entry => {
        const monthStr = format(entry.fullDate, "yyyy-MM");
        entry.expenses = getMonthlyExpensesFn(monthStr);
      });
    } else {
      if (process.env.NODE_ENV === 'development') {
        console.error('[MonthlyExpenseBarChart] Missing required prop: getMonthlyExpensesFn');
      }
    }

    // Convert map to array and sort by date
    return Object.values(dataMap).sort((a, b) => a.fullDate.getTime() - b.fullDate.getTime());
  }, [expenseInstallments, currentDate, getMonthlyExpensesFn, isMonthProjectedFn]);

  console.log('[EXPENSE_MOBILE_DEBUG]', chartData.map(item => ({ month: item.month, expenses: item.expenses })));

  console.log('[EXPENSE_PROPS_DEBUG] isMobile:', isMobile, 'getMonthlyExpensesFn:', typeof getMonthlyExpensesFn);

  if (chartData.every(d => d.expenses === 0)) {
    return (
      <div className={cn("h-24 flex items-center justify-center text-muted-foreground text-sm", isMobile && "h-16 text-xs")}>
        Nenhuma despesa registrada este ano.
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
            const color = isCurrentMonth ? "#b91c1c" : "#4B5563";
            
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
                  <circle cx={x} cy={y + 18} r={2.5} fill="#dc2626" />
                )}
              </g>
            );
          }}
        />
        <YAxis hide={true} domain={[0, 'dataMax']} />
        
        <Bar 
          dataKey="expenses" 
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

            let gradientColors = { start: "#fecaca", end: "#ef4444" };
            if (isCurrentMonth) {
               gradientColors = { start: "#ef4444", end: "#b91c1c" };
            }

            const gradientId = `barGrad-exp-${isCurrentMonth ? 'act' : 'inact'}`;
            const strokeGradId = `strokeGrad-exp-${isCurrentMonth ? 'act' : 'inact'}`;
            const patternId = `pattern-projected-exp-${isCurrentMonth ? 'sel' : 'unsel'}`;

            return (
              <g>
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={gradientColors.start} stopOpacity={isCurrentMonth ? 1 : (payload.isProjected ? 0.4 : 0.85)} />
                    <stop offset="100%" stopColor={gradientColors.end} stopOpacity={isCurrentMonth ? 1 : (payload.isProjected ? 0.2 : 0.65)} />
                  </linearGradient>
                  <linearGradient id={strokeGradId} x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity={isCurrentMonth ? 0.6 : (payload.isProjected ? 0.2 : 0.3)} />
                    <stop offset="100%" stopColor="#000000" stopOpacity={isCurrentMonth ? 0.05 : 0.02} />
                  </linearGradient>
                  <pattern id={patternId} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                    {isCurrentMonth ? (
                      <>
                        <rect width="6" height="6" fill="#fee2e2" fillOpacity="0.85" />
                        <rect width="3" height="6" fill="#dc2626" fillOpacity="0.9" />
                      </>
                    ) : (
                      <>
                        <rect width="6" height="6" fill="transparent" />
                        <rect width="3" height="6" fill="#f87171" fillOpacity="1" />
                      </>
                    )}
                  </pattern>
                </defs>
                {isCurrentMonth && (
                  <path d={path} fill="none" stroke={gradientColors.end} strokeWidth="6" opacity={payload.isProjected ? 0.25 : 0.12} filter="blur(3px)" />
                )}
                {payload.isProjected ? (
                  isCurrentMonth ? (
                    <path d={path} fill={`url(#${patternId})`} stroke="#dc2626" strokeWidth="2" />
                  ) : (
                    <path d={path} fill={`url(#${patternId})`} stroke="#f87171" strokeWidth="1.5" strokeDasharray="3 3" />
                  )
                ) : (
                  <path d={path} fill={`url(#${gradientId})`} stroke={`url(#${strokeGradId})`} strokeWidth="1" />
                )}
                {!payload.isProjected && <rect x={x + 3} y={newY + 2} width={Math.max(0, width - 6)} height={4} rx={2} fill="#ffffff" opacity={isCurrentMonth ? 0.6 : 0.25} />}
              </g>
            );
          }}
        />
      </BarChart>
    </ResponsiveContainer>
  );
};
