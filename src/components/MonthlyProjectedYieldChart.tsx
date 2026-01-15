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
        <ResponsiveContainer width="100%" height={isMobile ? 90 : 'auto'} minHeight={isMobile ? undefined : 260}>
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
                <Bar dataKey="absValue" radius={[4, 4, 0, 0]} barSize={isMobile ? 18 : 24} activeBar={false}>
                    {chartData.map((entry, index) => {
                        const isPositive = entry.value >= 0;
                        // Purple logic
                        const fill = entry.isCurrentMonth
                            ? "#7C3AED" // Violet 600 (Current Month)
                            : "#C4B5FD"; // Violet 300 (Other Months)

                        // If negative, maybe a slightly different shade or keep implied?  
                        // Let's stick to purple shades as requested "inves de vermelho a cor será o roxo".
                        return (
                            <Cell
                                key={`cell-${index}`}
                                fill={fill}
                            />
                        );
                    })}
                </Bar>
            </BarChart>
        </ResponsiveContainer>
    );
};
