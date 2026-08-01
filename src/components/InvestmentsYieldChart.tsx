import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, LabelList } from "recharts";
import { Tables } from "@/integrations/supabase/types";
import { Investment, AppCategory } from "@/types/finance";
import { cn, formatCurrency } from "@/lib/utils";
import { getCategoryColor } from "@/lib/categoryColors";
import DynamicIcon from "./DynamicIcon";
import { useMemo, useState } from "react";

interface InvestmentsYieldChartProps {
    investments: (Investment & { rentabilidade?: number; valorLiquido?: number })[];
    allSubcategories: AppCategory[];
    isMobile?: boolean;
}

export const InvestmentsYieldChart = ({ investments, allSubcategories, isMobile }: InvestmentsYieldChartProps) => {
    const [activeBarIndex, setActiveBarIndex] = useState<number | null>(null);
    const [tooltipY, setTooltipY] = useState(0);

    const handleBarSelect = (index: number, e?: React.PointerEvent) => {
        if (activeBarIndex === index) {
            setActiveBarIndex(null);
            return;
        }
        if (e && e.currentTarget) {
            const rect = (e.currentTarget as HTMLElement).closest('.bar-chart-container')?.getBoundingClientRect();
            if (rect) {
                setTooltipY(e.clientY - rect.top);
            }
        }
        setActiveBarIndex(index);
    };

    const chartData = useMemo(() => {
        const yieldByInvestment = investments.reduce((acc, inv) => {
            const category = allSubcategories.find(c => c.id === inv.nome);
            const name = category?.nome || "Outros";
            const color = category ? getCategoryColor(category, allSubcategories) : `#${Math.floor(Math.random() * 16777215).toString(16)}`;
            const icone = category?.icone || "💰";

            // 1) Taxa diária (juros compostos 252 dias úteis)
            const annualRateDecimal = (inv.rentabilidade || 0) / 100;
            const dailyRate = Math.pow(1 + annualRateDecimal, 1 / 252) - 1;

            // 2) Truncar a taxa em 10 casas decimais (padrão financeiro)
            const dailyRateTruncated = Math.trunc(dailyRate * 1e10) / 1e10;

            // 3) Taxa mensal (21 dias úteis)
            const taxaMensal = Math.pow(1 + dailyRateTruncated, 21) - 1;

            // 4) Rendimento Mensal bruto
            const baseValue = inv.valorLiquido !== undefined ? inv.valorLiquido : inv.valor;
            const monthYield = baseValue * taxaMensal;

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
                "card-yield p-6 flex flex-col items-center justify-center min-h-[200px]",
                isMobile && "px-3 py-5"
            )}>
                <h3 className="text-lg font-bold text-[#ea580c] tracking-tight mb-4">Receitas por Investimentos</h3>
                <p className="text-muted-foreground">Nenhum investimento registrado</p>
            </div>
        );
    }

    return (
        <div className={cn(
            "card-cloud p-6 flex flex-col border border-slate-200",
            isMobile ? "px-3 py-5" : "h-full justify-between"
        )} style={{ background: "linear-gradient(180deg, #FFFFFF 0%, #FCFBF9 100%)" }}>
            <div>
                <div className="flex items-center gap-2 mb-6">
                    <div className="h-8 w-2 bg-[#FB923C] rounded-full" />
                    <h3 className="text-lg font-bold text-[#ea580c] tracking-tight">Receitas por Investimentos</h3>
                </div>

                <div
                    className="w-full relative bar-chart-container"
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
                            margin={{ left: isMobile ? 0 : 30, right: 45, top: 0, bottom: 0 }}
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
                                width={isMobile ? 165 : 180}
                                axisLine={false}
                                tickLine={false}
                                tick={({ x, y, payload, index }) => {
                                    const item = chartData.find(d => d.name === payload.value);
                                    return (
                                        <g transform={`translate(${x},${y})`}
                                           className="cursor-pointer"
                                           onPointerDown={(e) => {
                                               e.stopPropagation();
                                               handleBarSelect(index, e as unknown as React.PointerEvent);
                                           }}
                                        >
                                            <foreignObject
                                                x={isMobile ? -165 : -180}
                                                y={-20}
                                                width={isMobile ? 162 : 175}
                                                height={40}
                                            >
                                                <div className="w-full flex flex-col items-end justify-center pr-0.5 select-none pointer-events-none" style={{ height: '40px' }}>
                                                    <div className="flex flex-row items-baseline justify-end gap-1.5 w-full">
                                                        <div className={cn(
                                                            "text-right text-[12px] md:text-[13px] font-semibold leading-[1.1] overflow-hidden break-words whitespace-normal text-gray-700 uppercase tracking-tight"
                                                        )} style={{ maxHeight: '2.2em' }}>
                                                            {String(payload.value)}
                                                        </div>
                                                        <div className="shrink-0 text-[1.15em] leading-normal translate-y-[2px]">
                                                            {item?.icone}
                                                        </div>
                                                    </div>
                                                </div>
                                            </foreignObject>
                                        </g>
                                    );
                                }}
                            />

                            <Bar
                                dataKey="value"
                                radius={[0, 10, 10, 0]}
                                barSize={isMobile ? 20 : 26}
                                className="cursor-pointer transition-all duration-300"
                                isAnimationActive={true}
                            >
                                {chartData.map((entry, index) => {
                                    const isActive = index === activeBarIndex;
                                    return (
                                        <Cell
                                            key={`cell-${index}`}
                                            fill={entry.color}
                                            className={cn(
                                                "cursor-pointer transition-all duration-300",
                                                isActive ? "opacity-100" : (activeBarIndex !== null ? "opacity-30" : "opacity-100")
                                            )}
                                            style={{
                                                filter: isActive ? 'drop-shadow(0px 4px 8px rgba(0,0,0,0.2))' : 'none'
                                            }}
                                            onPointerDown={(e) => {
                                                e.stopPropagation();
                                                handleBarSelect(index, e as unknown as React.PointerEvent);
                                            }}
                                        />
                                    );
                                })}
                                <LabelList
                                    dataKey="value"
                                    position="right"
                                    content={(props: any) => {
                                        const { x, y, width, value, index } = props;
                                        const percentage = totalYield > 0
                                            ? `${((value / totalYield) * 100).toFixed(1)}%`
                                            : "0%";
                                        return (
                                            <text
                                                x={x + width + 10}
                                                y={y + (isMobile ? 14 : 18)}
                                                fill={index === activeBarIndex ? "#ea580c" : "#334155"}
                                                fontSize={isMobile ? 11 : 12}
                                                fontWeight="900"
                                                className="font-roboto cursor-pointer select-none transition-all duration-300"
                                                onPointerDown={(e) => {
                                                    e.stopPropagation();
                                                    handleBarSelect(index, e as unknown as React.PointerEvent);
                                                }}
                                            >
                                                {percentage}
                                            </text>
                                        );
                                    }}
                                />
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>

                    {/* Custom Absolute Tooltip */}
                    {activeBarIndex !== null && chartData[activeBarIndex] && (
                        <div
                            className="absolute pointer-events-none z-50 animate-in zoom-in-95 duration-200"
                            style={{
                                top: tooltipY,
                                left: isMobile ? '50%' : '70%',
                                transform: 'translate(-50%, -100%) translateY(-20px)',
                            }}
                        >
                            <div className="bg-white/95 backdrop-blur-md pt-[9px] pb-3 px-[11px] shadow-[0_12px_48px_rgba(0,0,0,0.18)] border border-white/60 rounded-2xl max-w-[190px] relative" style={{ WebkitBackdropFilter: 'blur(10px)' }}>
                                <div className="flex items-center gap-2 mb-1.5">
                                    <span className="text-xl drop-shadow-sm">{chartData[activeBarIndex].icone}</span>
                                    <div className="flex flex-col">
                                        <span className="text-sm font-bold text-gray-800 leading-tight line-clamp-2" style={{ wordBreak: 'break-word' }}>{chartData[activeBarIndex].name}</span>
                                    </div>
                                </div>
                                <div className="flex items-baseline gap-1.5 pt-1 border-t border-gray-100">
                                    <span className="text-[15px] font-bold text-[#FB923C] tracking-tighter">
                                        {formatCurrency(chartData[activeBarIndex].value)}
                                    </span>
                                    <span className="text-[11px] font-semibold text-gray-400">
                                        ({totalYield > 0 ? ((chartData[activeBarIndex].value / totalYield) * 100).toFixed(1) : "0.0"}%)
                                    </span>
                                </div>
                                {/* Seta indicadora (Arrow) */}
                                <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white/95 border-b border-r border-white/60 transform rotate-45" />
                            </div>
                        </div>
                    )}
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
