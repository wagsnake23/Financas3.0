import React, { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Cell } from "recharts";
import { Tables } from "@/integrations/supabase/types";
import { format, getMonth, getYear } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface MonthlyProjectedYieldChartProps {
    revenues: Tables<'receitas'>[];
    expenseInstallments: (Tables<'despesas_parcelas'> & { despesas: Pick<Tables<'despesas'>, 'categoria_id'> | null })[];
    currentDate: Date;
    projectedMonthlyYield: number;
    isMobile?: boolean;
    onMonthClick: (date: Date) => void;
}

export const MonthlyProjectedYieldChart: React.FC<MonthlyProjectedYieldChartProps> = ({
    revenues,
    expenseInstallments,
    currentDate,
    projectedMonthlyYield,
    isMobile,
    onMonthClick,
}) => {
    const chartData = useMemo(() => {
        const dataMap: { [key: string]: { month: string; value: number; fullDate: Date; isCurrentMonth: boolean } } = {};
        const currentYear = getYear(currentDate);
        const currentMonthIndex = getMonth(currentDate);

        // Initialize data for the 12 months of the current year
        for (let i = 0; i < 12; i++) {
            const monthDate = new Date(currentYear, i, 1);
            const monthKey = format(monthDate, "MMM", { locale: ptBR });
            const isCurrentMonth = getMonth(monthDate) === currentMonthIndex && getYear(monthDate) === currentYear;
            // Start with projected monthly yield
            dataMap[monthKey] = { month: monthKey, value: projectedMonthlyYield, fullDate: monthDate, isCurrentMonth };
        }

        // Add revenues
        revenues.forEach(revenue => {
            const data = revenue.data;
            const revenueYear = Number(data.substring(0, 4));
            const revenueMonthIndex = Number(data.substring(5, 7)) - 1;

            if (revenueYear === currentYear) {
                const monthDate = new Date(currentYear, revenueMonthIndex, 1);
                const monthKey = format(monthDate, "MMM", { locale: ptBR });
                if (dataMap[monthKey]) {
                    dataMap[monthKey].value += revenue.valor;
                }
            }
        });

        // Subtract expenses
        expenseInstallments.forEach(installment => {
            const vencimento = installment.vencimento;
            const installmentYear = Number(vencimento.substring(0, 4));
            const installmentMonthIndex = Number(vencimento.substring(5, 7)) - 1;

            if (installmentYear === currentYear) {
                const monthDate = new Date(currentYear, installmentMonthIndex, 1);
                const monthKey = format(monthDate, "MMM", { locale: ptBR });
                if (dataMap[monthKey]) {
                    dataMap[monthKey].value -= installment.valor_parcela;
                }
            }
        });

        return Object.values(dataMap)
            .sort((a, b) => a.fullDate.getTime() - b.fullDate.getTime())
            .map(d => ({ ...d, absValue: Math.abs(d.value) }));
    }, [revenues, expenseInstallments, currentDate, projectedMonthlyYield]);

    const allZero = chartData.every(d => d.value === 0);

    if (allZero) {
        return (
            <div className={cn("h-24 flex items-center justify-center text-muted-foreground text-sm", isMobile && "h-16 text-xs")}>
                Nenhum dado para o período.
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
                        // Purple for current month, muted for others
                        const color = entry.isCurrentMonth
                            ? "#7C3AED" // Violet 600
                            : "hsl(var(--muted-foreground))";
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
                <Bar 
                    dataKey="absValue" 
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

                        let gradientColors = { start: "#d8b4fe", end: "#a855f7" }; // Inactive (purple 300 to 500)
                        if (isCurrentMonth) {
                           gradientColors = { start: "#9333ea", end: "#7e22ce" }; // Active (purple 600 to 700)
                        }

                        const gradientId = `barGrad-yield-${isCurrentMonth ? 'act' : 'inact'}`;
                        const strokeGradId = `strokeGrad-yield-${isCurrentMonth ? 'act' : 'inact'}`;

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
