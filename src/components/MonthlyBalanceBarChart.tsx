import React, { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Cell } from "recharts";
import { Tables } from "@/integrations/supabase/types";
import { format, getMonth, getYear } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface MonthlyBalanceBarChartProps {
    revenues: Tables<'receitas'>[];
    expenseInstallments: (Tables<'despesas_parcelas'> & { despesas: Pick<Tables<'despesas'>, 'categoria_id'> | null })[];
    currentDate: Date;
    isMobile?: boolean;
    onMonthClick: (date: Date) => void;
}

export const MonthlyBalanceBarChart: React.FC<MonthlyBalanceBarChartProps> = ({
    revenues,
    expenseInstallments,
    currentDate,
    isMobile,
    onMonthClick,
}) => {
    const chartData = useMemo(() => {
        const dataMap: { [key: string]: { month: string; balance: number; fullDate: Date; isCurrentMonth: boolean } } = {};
        const currentYear = getYear(currentDate);
        const currentMonthIndex = getMonth(currentDate);

        // Initialize data for the 12 months of the current year
        for (let i = 0; i < 12; i++) {
            const monthDate = new Date(currentYear, i, 1);
            const monthKey = format(monthDate, "MMM", { locale: ptBR });
            const isCurrentMonth = getMonth(monthDate) === currentMonthIndex && getYear(monthDate) === currentYear;
            dataMap[monthKey] = { month: monthKey, balance: 0, fullDate: monthDate, isCurrentMonth };
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
                    dataMap[monthKey].balance += revenue.valor;
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
                    dataMap[monthKey].balance -= installment.valor_parcela;
                }
            }
        });

        return Object.values(dataMap)
            .sort((a, b) => a.fullDate.getTime() - b.fullDate.getTime())
            .map(d => ({ ...d, absBalance: Math.abs(d.balance) }));
    }, [revenues, expenseInstallments, currentDate]);

    const allZero = chartData.every(d => d.balance === 0);

    if (allZero) {
        return (
            <div className={cn("h-24 flex items-center justify-center text-muted-foreground text-sm", isMobile && "h-16 text-xs")}>
                Nenhum dado para o período.
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
                    const isPositive = entry.balance >= 0;
                    const isCurrentMonth = entry.isCurrentMonth;
                    const color = isCurrentMonth
                        ? (isPositive ? "#1d4ed8" : "#b91c1c")
                        : "#94a3b8";
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
                                <circle cx={x} cy={y + 18} r={2.5} fill={isPositive ? "#2563eb" : "#dc2626"} />
                            )}
                        </g>
                    );
                }}
            />
            <YAxis hide={true} domain={[0, 'dataMax']} />
            
            <Bar 
                dataKey="absBalance" 
                barSize={isMobile ? 18 : 24} 
                activeBar={false}
                shape={(props: any) => {
                    const { x, y, width, height, payload } = props;
                    if (height === 0 || Number.isNaN(height)) return null;

                    const isCurrentMonth = payload.isCurrentMonth;
                    const isPositive = payload.balance >= 0;
                    const newHeight = height;
                    const newY = y;
                    
                    const radius = 6;
                    const path = `M${x},${newY + radius} A${radius},${radius} 0 0,1 ${x + radius},${newY} L${x + width - radius},${newY} A${radius},${radius} 0 0,1 ${x + width},${newY + radius} L${x + width},${newY + newHeight} L${x},${newY + newHeight} Z`;

                    let gradientColors = isPositive 
                        ? { start: "#93c5fd", end: "#3b82f6" } 
                        : { start: "#fca5a5", end: "#ef4444" };
                    if (isCurrentMonth) {
                       gradientColors = isPositive 
                           ? { start: "#3b82f6", end: "#1d4ed8" }
                           : { start: "#ef4444", end: "#b91c1c" };
                    }

                    const gradientId = `barGrad-balance-${isPositive ? 'pos' : 'neg'}-${isCurrentMonth ? 'active' : 'inactive'}`;

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
