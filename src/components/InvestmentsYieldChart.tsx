import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, LabelList } from "recharts";
import { Tables } from "@/integrations/supabase/types";
import { AppCategory } from "@/types/finance";
import { cn, formatCurrency } from "@/lib/utils";
import { getCategoryColor } from "@/lib/categoryColors";
import DynamicIcon from "./DynamicIcon";
import { useMemo } from "react";

interface InvestmentsYieldChartProps {
    investments: Tables<'investimentos'>[];
    allSubcategories: AppCategory[];
    isMobile?: boolean;
}

export const InvestmentsYieldChart = ({ investments, allSubcategories, isMobile }: InvestmentsYieldChartProps) => {
    const chartData = useMemo(() => {
        const yieldByInvestment = investments.reduce((acc, inv) => {
            const category = allSubcategories.find(c => c.id === inv.nome);
            const name = category?.nome || "Outros";
            const color = category ? getCategoryColor(category, allSubcategories) : `#${Math.floor(Math.random() * 16777215).toString(16)}`;
            const icone = category?.icone || "💰";

            // 1) Taxa diária (juros compostos 252 dias úteis)
            const annualRateDecimal = inv.rentabilidade / 100;
            const dailyRate = Math.pow(1 + annualRateDecimal, 1 / 252) - 1;

            // 2) Truncar a taxa em 10 casas decimais (padrão financeiro)
            const dailyRateTruncated = Math.trunc(dailyRate * 1e10) / 1e10;

            // 3) Taxa mensal (21 dias úteis)
            const taxaMensal = Math.pow(1 + dailyRateTruncated, 21) - 1;

            // 4) Rendimento Mensal bruto
            const monthYield = inv.valor * taxaMensal;

            if (!acc[name]) {
                acc[name] = { value: 0, color, icone };
            }
            acc[name].value += monthYield;
            return acc;
        }, {} as Record<string, { value: number; color: string; icone: string }>);

        // 5) Arredondamento Bancário Final (Round Half Even) para cada subcategoria
        return Object.entries(yieldByInvestment)
            .map(([name, data]) => {
                const rawValue = data.value;
                const decimals = 2;
                const m = Math.pow(10, decimals);
                const n = +(rawValue * m).toFixed(8);
                const i = Math.floor(n);
                const f = n - i;
                const e = 1e-8;

                const rounded = (f > 0.5 - e && f < 0.5 + e)
                    ? (i % 2 === 0 ? i : i + 1)
                    : Math.round(n);

                return {
                    name,
                    value: rounded / m,
                    color: data.color,
                    icone: data.icone
                };
            })
            .sort((a, b) => b.value - a.value);
    }, [investments, allSubcategories]);

    const totalYield = useMemo(() => chartData.reduce((acc, curr) => acc + curr.value, 0), [chartData]);
    const formattedTotalYield = formatCurrency(totalYield);

    if (chartData.length === 0) {
        return (
            <div className={cn(
                "bg-gradient-to-br from-orange-50/90 to-orange-100/60 p-6 rounded-[24px] border border-orange-200/50 shadow-[0_4px_24px_rgba(251,146,60,0.04)]",
                "backdrop-blur-[8px] flex flex-col items-center justify-center min-h-[200px]",
                isMobile && "px-3 py-5"
            )}>
                <h3 className="text-lg font-black text-gray-800 tracking-tight mb-4">Receitas por Investimentos</h3>
                <p className="text-muted-foreground">Nenhum investimento registrado</p>
            </div>
        );
    }

    return (
        <div className={cn(
            "bg-gradient-to-br from-orange-50/90 to-orange-100/60 p-6 rounded-[24px] border border-orange-200/50 shadow-[0_4px_24px_rgba(251,146,60,0.04)]",
            "backdrop-blur-[8px] flex flex-col",
            isMobile ? "px-3 py-5" : "h-full justify-between"
        )} style={{ WebkitBackdropFilter: 'blur(8px)' }}>
            <div>
                <div className="flex items-center gap-2 mb-6">
                    <div className="h-8 w-2 bg-[#FB923C] rounded-full shadow-[0_0_12px_rgba(251,146,60,0.3)]" />
                    <h3 className="text-lg font-black text-gray-800 tracking-tight">Receitas por Investimentos</h3>
                </div>

                <div
                    className="w-full"
                    style={{
                        height: isMobile
                            ? Math.max(200, chartData.length * 35)
                            : Math.max(300, chartData.length * 40)
                    }}
                >
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            data={chartData}
                            layout="vertical"
                            margin={{ left: 0, right: 45, top: 0, bottom: 0 }}
                            barGap={2}
                        >
                            <defs>
                                <linearGradient id="barGradientYield" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="rgba(255,255,255,0.3)" />
                                    <stop offset="50%" stopColor="rgba(255,255,255,0)" />
                                    <stop offset="100%" stopColor="rgba(0,0,0,0.1)" />
                                </linearGradient>
                            </defs>
                            <XAxis type="number" hide />
                            <YAxis
                                dataKey="name"
                                type="category"
                                width={isMobile ? 110 : 140}
                                axisLine={false}
                                tickLine={false}
                                tick={({ x, y, payload }) => {
                                    const item = chartData.find(d => d.name === payload.value);
                                    return (
                                        <g transform={`translate(${x},${y})`}>
                                            <text
                                                x={isMobile ? -8 : -15}
                                                y={0}
                                                dy={4}
                                                textAnchor="end"
                                                className={cn(
                                                    "fill-gray-500 font-black uppercase tracking-tight",
                                                    isMobile ? "text-[10px]" : "text-[12px]"
                                                )}
                                            >
                                                {item?.icone} {payload.value.length > (isMobile ? 13 : 20) ? `${payload.value.substring(0, isMobile ? 11 : 18)}..` : payload.value}
                                            </text>
                                        </g>
                                    );
                                }}
                            />
                            <Tooltip
                                cursor={{ fill: 'transparent' }}
                                content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                        const data = payload[0].payload;
                                        const perc = totalYield > 0 ? ((data.value / totalYield) * 100).toFixed(1) : "0.0";
                                        return (
                                            <div className="bg-white/90 backdrop-blur-md p-4 shadow-[0_12px_48px_rgba(0,0,0,0.15)] border border-white/60 rounded-2xl animate-in zoom-in-95" style={{ WebkitBackdropFilter: 'blur(10px)' }}>
                                                <div className="flex items-center gap-3 mb-2">
                                                    <span className="text-2xl drop-shadow-sm">{data.icone}</span>
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Investimento</span>
                                                        <span className="font-bold text-gray-800 leading-tight">{data.name}</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-baseline gap-2 pt-1 border-t border-gray-100">
                                                    <span className="text-xl font-black text-[#FB923C] tracking-tighter">
                                                        {formatCurrency(data.value)}
                                                    </span>
                                                    <span className="text-xs font-bold text-gray-400">({perc}%)</span>
                                                </div>
                                            </div>
                                        );
                                    }
                                    return null;
                                }}
                            />
                            <Bar
                                dataKey="value"
                                radius={[0, 10, 10, 0]}
                                barSize={isMobile ? 20 : 26}
                                className="cursor-pointer transition-all duration-300"
                                isAnimationActive={true}
                            >
                                {chartData.map((entry, index) => (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={entry.color}
                                    />
                                ))}
                                <LabelList
                                    dataKey="value"
                                    position="right"
                                    content={(props: any) => {
                                        const { x, y, width, value } = props;
                                        const percentage = totalYield > 0
                                            ? `${((value / totalYield) * 100).toFixed(1)}%`
                                            : "0%";
                                        return (
                                            <text
                                                x={x + width + 10}
                                                y={y + (isMobile ? 14 : 18)}
                                                fill="#334155"
                                                fontSize={isMobile ? 11 : 12}
                                                fontWeight="900"
                                                className="font-roboto"
                                            >
                                                {percentage}
                                            </text>
                                        );
                                    }}
                                />
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {!isMobile && (
                <div className="mt-8 pt-6 border-t border-gray-200/50 flex items-end justify-between">
                    <div>
                        <p className="text-sm font-semibold text-muted-foreground mb-1 font-roboto">Rendimento Mensal Total</p>
                        <p className="text-3xl font-bold text-[#FB923C] font-roboto">{formattedTotalYield}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="rounded-xl bg-[#FB923C]/10 p-2 text-[#FB923C]">
                            <DynamicIcon name="TrendingUp" className="h-6 w-6" />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
