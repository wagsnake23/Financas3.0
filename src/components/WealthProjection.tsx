import React, { useMemo, useState } from "react";
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Dot
} from "recharts";
import { Slider } from "@/components/ui/slider";
import { Card } from "@/components/ui/card";
import { Investment } from "@/types/finance";
import { formatCurrency } from "@/lib/utils";
import { differenceInBusinessDays } from "date-fns";
import DynamicIcon from "./DynamicIcon";
import { cn } from "@/lib/utils";

interface WealthProjectionProps {
    investments: (Investment & { rentabilidade?: number })[];
    isMobile?: boolean;
}

export function WealthProjection({ investments, isMobile }: WealthProjectionProps) {
    const [projectionMonths, setProjectionMonths] = useState(12);

    // 1. Ponto de partida consolidado do Dashboard (Hoje)
    const virtualInvestments = useMemo(() => {
        return (investments as any[]).map(inv => {
            // Preservamos o valor bruto original para o cálculo de pesos da taxa média
            const valorAtualVirtualOriginal = inv.valorAtualVirtual;

            // Usamos o valor líquido real (pós-IR) calculado pela engine para "Hoje" (m=0)
            const valorHoje = inv.valorLiquido !== undefined ? inv.valorLiquido : inv.valor;
            
            // Projeção futura baseada na rentabilidade atual
            const taxaDiaria = inv.taxaDiaria !== undefined 
                ? inv.taxaDiaria 
                : Math.pow(1 + ((inv.rentabilidade || 0) / 100), 1 / 252) - 1;

            return {
                ...inv,
                taxaDiaria,
                valorAtualVirtualOriginal,
                valorAtualVirtual: valorHoje
            };
        });
    }, [investments]);

    const patrimonioHoje = useMemo(() => {
        return virtualInvestments.reduce((sum, inv) => sum + inv.valorAtualVirtual, 0);
    }, [virtualInvestments]);

    // 2. Pontos de projeção para o gráfico (gerar pontos periódicos para a curva ser suave)
    const chartData = useMemo(() => {
        const points = [];
        const isLongTerm = projectionMonths > 24;
        const maxMonths = isLongTerm ? 120 : 24;

        // Mapeamento dinâmico de labels conforme solicitado
        const labelMap: Record<number, string> = isLongTerm ? {
            0: "Hoje",
            12: "1a",
            36: "3a",
            60: "5a",
            120: "10a"
        } : {
            0: "Hoje",
            3: "3m",
            6: "6m",
            12: "12m",
            24: "24m"
        };

        // Gerar mais pontos para o longo prazo para manter a suavidade
        const step = isLongTerm ? 2 : 1;

        for (let m = 0; m <= maxMonths; m += step) {
            const days = m * 21; // 1 mês = 21 dias úteis

            const patrimonioFuturo = virtualInvestments.reduce((sum, inv) => {
                return sum + (inv.valorAtualVirtual * Math.pow(1 + inv.taxaDiaria, days));
            }, 0);

            // Garantir que os ticks solicitados sempre existam no array
            const isTick = !!labelMap[m];

            points.push({
                month: m,
                name: labelMap[m] || `${m}m`,
                isRequestedTick: isTick,
                value: patrimonioFuturo,
                originalValue: formatCurrency(patrimonioFuturo)
            });
        }

        // Se o passo pulou um tick importante (ex: 120), adiciona manualmente
        Object.entries(labelMap).forEach(([mStr, label]) => {
            const m = parseInt(mStr);
            if (!points.find(p => p.month === m)) {
                const days = m * 21;
                const patrimonioFuturo = virtualInvestments.reduce((sum, inv) => {
                    return sum + (inv.valorAtualVirtual * Math.pow(1 + inv.taxaDiaria, days));
                }, 0);
                points.push({
                    month: m,
                    name: label,
                    isRequestedTick: true,
                    value: patrimonioFuturo,
                    originalValue: formatCurrency(patrimonioFuturo)
                });
            }
        });

        return points.sort((a, b) => a.month - b.month);
    }, [virtualInvestments, projectionMonths]);

    // 3. Cálculos da projeção atual (baseada no Slider)
    const currentProjectionData = useMemo(() => {
        const days = projectionMonths * 21;

        const patrimonioFuturo = virtualInvestments.reduce((sum, inv) => {
            return sum + (inv.valorAtualVirtual * Math.pow(1 + inv.taxaDiaria, days));
        }, 0);

        const lucroAcumulado = patrimonioFuturo - patrimonioHoje;

        // Calcular taxa_media ponderada (baseada no peso BRUTO histórico para consistência com o Dashboard)
        const weightedSumRates = virtualInvestments.reduce((sum, inv: any) => {
            // Em Dashboard.tsx a taxa é (rendimentoBrutoTotal / totalLiquido)
            // Aqui fazemos a soma dos rendimentos anuais teóricos (Base Bruta x Taxa)
            const baseParaPeso = inv.valorAtualVirtualOriginal !== undefined ? inv.valorAtualVirtualOriginal : inv.valorAtualVirtual;
            return sum + (baseParaPeso * ((inv.rentabilidade || 0) / 100));
        }, 0);

        const taxaMediaAnualPonderada = patrimonioHoje > 0 ? weightedSumRates / patrimonioHoje : 0;

        // renda_mensal_futura = patrimonio_futuro * taxa_mensal
        // Usando a mesma lógica do Dashboard: (1 + taxaAnual)^(1/12) - 1
        const taxaMensal = Math.pow(1 + taxaMediaAnualPonderada, 1 / 12) - 1;
        const rendaMensalFutura = patrimonioFuturo * taxaMensal;

        return {
            patrimonioFuturo,
            lucroAcumulado,
            rendaMensalFutura
        };
    }, [virtualInvestments, projectionMonths, patrimonioHoje]);

    return (
        <Card 
            className={cn(
                "w-full overflow-hidden shadow-xl bg-gradient-to-b from-[#F9FBFF] to-white",
                isMobile ? "rounded-[21px] p-4" : "border-none rounded-[32px] p-8"
            )}
            style={isMobile ? {
                border: "1px solid rgba(0,0,0,0.06)",
                outline: "1px solid rgba(59, 130, 246, 0.05)"
            } : undefined}
        >
            {/* Título do Gráfico */}
            <div className="flex items-center gap-2 mb-6">
                <div className="h-8 w-2 bg-gradient-to-b from-blue-400 to-blue-600 rounded-full" />
                <h3 
                    className={cn(
                        "opacity-90 tracking-tight",
                        isMobile ? "text-[18.5px] font-bold text-[#2563eb]" : "text-lg font-black text-[#2563eb]"
                    )}
                    style={isMobile ? { fontFamily: "'Inter', sans-serif" } : undefined}
                >
                    Projeção Patrimonial
                </h3>
            </div>

            {/* Gráfico */}
            <div className="w-full h-[280px] mb-2">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                        data={chartData}
                        margin={{
                            top: 20,
                            right: isMobile ? 10 : 30,
                            left: isMobile ? -15 : 20,
                            bottom: 0
                        }}
                    >
                        <defs>
                            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                        <XAxis
                            dataKey="month"
                            axisLine={false}
                            tickLine={false}
                            tick={(props) => {
                                const { x, y, payload } = props;
                                const point = chartData.find(d => d.month === payload.value);
                                if (!point?.isRequestedTick) return null;
                                return (
                                    <text x={x} y={y} dy={16} textAnchor="middle" fill="#64748b" fontSize={12} fontWeight={700}>
                                        {point.name}
                                    </text>
                                );
                            }}
                            interval={0}
                        />
                        <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                            domain={['auto', 'auto']}
                            width={isMobile ? 50 : 70}
                            tickFormatter={(value) => {
                                if (value === 0) return "0";
                                if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                                if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
                                return `${value}`;
                            }}
                        />
                        <Tooltip
                            content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                    const data = payload[0].payload;
                                    return (
                                        <div className="bg-white/90 backdrop-blur-md p-4 shadow-[0_12px_48px_rgba(0,0,0,0.1)] border border-white/60 rounded-[20px]">
                                            <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1">
                                                Em {data.month === 0 ? "hoje" : `${data.month} meses`}
                                            </p>
                                            <p className="text-lg font-black text-blue-600 tracking-tight">
                                                {data.originalValue}
                                            </p>
                                        </div>
                                    );
                                }
                                return null;
                            }}
                        />
                        <Area
                            type="monotone"
                            dataKey="value"
                            stroke="#3b82f6"
                            strokeWidth={4}
                            fillOpacity={1}
                            fill="url(#colorValue)"
                            animationDuration={1500}
                            activeDot={{ r: 6, fill: '#3b82f6', stroke: '#fff', strokeWidth: 3 }}
                            dot={(props) => {
                                const { cx, cy, payload } = props;
                                if (payload.isRequestedTick) {
                                    return (
                                        <circle
                                            key={`dot-${payload.month}`}
                                            cx={cx}
                                            cy={cy}
                                            r={5}
                                            fill="#3b82f6"
                                            stroke="#fff"
                                            strokeWidth={2}
                                            className="shadow-sm border-none"
                                        />
                                    );
                                }
                                return <></>;
                            }}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>

            {/* Slider */}
            <div className="space-y-1 mb-6 px-2">
                <div className="flex items-center justify-between h-8">
                    <label className="text-[11px] font-black text-blue-400/80 uppercase tracking-widest leading-none">Tempo de Projeção</label>
                    <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-[11px] font-black shadow-lg shadow-blue-100 leading-none">
                        {projectionMonths <= 24
                            ? `${projectionMonths} ${projectionMonths === 1 ? 'mês' : 'meses'}`
                            : `${Math.floor(projectionMonths / 12)} anos`
                        }
                    </span>
                </div>
                <Slider
                    value={[projectionMonths]}
                    onValueChange={(val) => setProjectionMonths(val[0])}
                    max={120}
                    step={1}
                    className="py-2"
                />
                <div className="flex justify-between text-[9px] font-bold text-gray-600 uppercase tracking-widest">
                    <span>Hoje</span>
                    <span>{projectionMonths <= 24 ? "12 meses" : "5 anos"}</span>
                    <span>{projectionMonths <= 24 ? "24 meses" : "10 anos"}</span>
                </div>
            </div>

            {/* Cards de Resumo */}
            <div className={cn(
                "grid gap-4",
                isMobile ? "grid-cols-1" : "grid-cols-3"
            )}>
                {/* Card 1 - Valor Estimado */}
                <div className="bg-white py-4 px-5 rounded-[24px] border border-emerald-100 shadow-[0_4px_20px_rgb(0,0,0,0.01)] flex items-center gap-4 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-50 rounded-full -mr-10 -mt-10 transition-transform group-hover:scale-110" />
                    <div className="relative flex-shrink-0">
                        <div className="p-3 bg-emerald-500 text-white rounded-full shadow-lg shadow-emerald-100 ring-4 ring-emerald-50 flex items-center justify-center">
                            <DynamicIcon name="TrendingUp" className="h-6 w-6" />
                        </div>
                    </div>
                    <div className="relative flex flex-col justify-center min-w-0">
                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-[0.15em] mb-0.5 leading-none">Valor Estimado</span>
                        <p className="text-[20px] font-black text-slate-600 tracking-tight leading-none mb-1 truncate">
                            {formatCurrency(currentProjectionData.patrimonioFuturo)}
                        </p>
                        <div className="flex items-center gap-1.5 text-emerald-500 text-[10px] font-bold leading-none">
                            <DynamicIcon name="TrendingUp" className="h-3 w-3" />
                            <span className="truncate">Crescimento composto</span>
                        </div>
                    </div>
                </div>

                {/* Card 2 - Lucro Acumulado */}
                <div className="bg-white py-4 px-5 rounded-[24px] border border-violet-100 shadow-[0_4px_20px_rgb(0,0,0,0.01)] flex items-center gap-4 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-violet-50 rounded-full -mr-10 -mt-10 transition-transform group-hover:scale-110" />
                    <div className="relative flex-shrink-0">
                        <div className="p-3 bg-violet-500 text-white rounded-full shadow-lg shadow-violet-100 ring-4 ring-violet-50 flex items-center justify-center">
                            <DynamicIcon name="PiggyBank" className="h-6 w-6" />
                        </div>
                    </div>
                    <div className="relative flex flex-col justify-center min-w-0">
                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-[0.15em] mb-0.5 leading-none">Lucro Acumulado</span>
                        <p className="text-[20px] font-black text-slate-600 tracking-tight leading-none mb-1 truncate">
                            {formatCurrency(currentProjectionData.lucroAcumulado)}
                        </p>
                        <div className="flex items-center gap-1.5 text-violet-500 text-[10px] font-bold leading-none">
                            <DynamicIcon name="Sparkles" className="h-3 w-3" />
                            <span className="truncate">Rendimento esperado</span>
                        </div>
                    </div>
                </div>

                {/* Card 3 - Renda Mensal Futura */}
                <div className="bg-white py-4 px-5 rounded-[24px] border border-orange-100 shadow-[0_4px_20px_rgb(0,0,0,0.01)] flex items-center gap-4 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-orange-50 rounded-full -mr-10 -mt-10 transition-transform group-hover:scale-110" />
                    <div className="relative flex-shrink-0">
                        <div className="p-3 bg-orange-500 text-white rounded-full shadow-lg shadow-orange-100 ring-4 ring-orange-50 flex items-center justify-center">
                            <DynamicIcon name="Flame" className="h-6 w-6" />
                        </div>
                    </div>
                    <div className="relative flex flex-col justify-center min-w-0">
                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-[0.15em] mb-0.5 leading-none">Renda Mensal Futura</span>
                        <p className="text-[20px] font-black text-slate-600 tracking-tight leading-none mb-1 truncate">
                            {formatCurrency(currentProjectionData.rendaMensalFutura)}
                        </p>
                        <div className="flex items-center gap-1.5 text-orange-500 text-[10px] font-bold leading-none">
                            <DynamicIcon name="Calendar" className="h-3 w-3" />
                            <span className="truncate">Estimativa de saque mensal</span>
                        </div>
                    </div>
                </div>
            </div>
        </Card>
    );
}
