import React, { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Cell } from "recharts";
import { Tables } from "@/integrations/supabase/types";
import { format, subMonths, getMonth, getYear } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface MonthlyYieldsBarChartProps {
    revenues: Tables<'receitas'>[];
    currentDate: Date;
    isMobile?: boolean;
    onMonthClick: (date: Date) => void;
    projectedAnnualYield?: number;
}

export const MonthlyYieldsBarChart: React.FC<MonthlyYieldsBarChartProps> = ({
    revenues,
    currentDate,
    isMobile,
    onMonthClick,
    projectedAnnualYield = 0,
}) => {
    const chartData = useMemo(() => {
        const dataMap: { [key: string]: { month: string; yields: number; fullDate: Date; isCurrentMonth: boolean } } = {};
        const currentYear = getYear(currentDate);
        const currentMonthIndex = getMonth(currentDate);

        const monthlyProjected = projectedAnnualYield / 12;

        for (let i = 0; i < 12; i++) {
            const monthDate = subMonths(new Date(currentYear, 11), 11 - i);
            const monthKey = format(monthDate, "MMM", { locale: ptBR });
            const isCurrentMonth = getMonth(monthDate) === currentMonthIndex && getYear(monthDate) === currentYear;
            // Use projected value for all months in the "estimated distribution"
            dataMap[monthKey] = { month: monthKey, yields: monthlyProjected, fullDate: monthDate, isCurrentMonth };
        }

        // We could still add actual revenues on top, but the user asked for "distribution mensal estimada"
        // and for the "Total Anual" to be the sum of investments * %.
        // If we want the chart to match the total exactly, we use the projection.

        return Object.values(dataMap).sort((a, b) => a.fullDate.getTime() - b.fullDate.getTime());
    }, [projectedAnnualYield, currentDate]);

    if (chartData.every(d => d.yields === 0)) {
        return (
            <div className={cn("h-24 flex items-center justify-center text-muted-foreground text-sm", isMobile && "h-16 text-xs")}>
                Nenhum rendimento registrado este ano.
            </div>
        );
    }

    return (
        <ResponsiveContainer width="100%" height={isMobile ? 70 : 'auto'} minHeight={isMobile ? undefined : 260}>
            <BarChart data={chartData} margin={{ top: 5, right: 0, left: 0, bottom: 5 }}>
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                <XAxis
                    dataKey="month"
                    axisLine={false}
                    tickLine={false}
                    interval={0}
                    tick={({ x, y, payload }) => {
                        const entry = chartData[payload.index];
                        const color = entry.isCurrentMonth ? "hsl(var(--yield))" : "hsl(var(--yield-darker))";
                        return (
                            <text
                                x={x}
                                y={y}
                                dy={10}
                                textAnchor="middle"
                                fill={color}
                                style={{ 
                                    fontSize: isMobile ? "11px" : "13px", 
                                    fontWeight: "bold", 
                                    cursor: "pointer", 
                                    fontFamily: "Roboto",
                                    filter: "drop-shadow(1px 1px 1px rgba(0,0,0,0.08))"
                                }}
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
                <Bar dataKey="yields" radius={[4, 4, 4, 4]} barSize={isMobile ? 14 : undefined} activeBar={false}>
                    {chartData.map((entry, index) => (
                        <Cell
                            key={`cell-${index}`}
                            fill={entry.isCurrentMonth ? "hsl(var(--yield))" : "hsl(var(--yield))"}
                            fillOpacity={entry.isCurrentMonth ? 1 : 0.4}
                            className="transition-all duration-300"
                            style={{
                                filter: entry.isCurrentMonth 
                                    ? "drop-shadow(0 0 6px rgba(147, 51, 234, 0.2)) drop-shadow(2px 2px 3px rgba(0,0,0,0.1))" 
                                    : "drop-shadow(2px 2px 3px rgba(0,0,0,0.08))"
                            }}
                        />
                    ))}
                </Bar>
            </BarChart>
        </ResponsiveContainer>
    );
};
