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
    investments: Investment[];
    isMobile?: boolean;
}

export function WealthProjection({ investments, isMobile }: WealthProjectionProps) {
    const [projectionMonths, setProjectionMonths] = useState(12);

    // 1. Motor de juros compostos (já capitalizado até hoje)
    const virtualInvestments = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return investments.map(inv => {
            // taxa_diaria = (1 + (rentabilidade / 100))^(1 / 252) - 1
            const taxaDiaria = Math.pow(1 + (inv.rentabilidade / 100), 1 / 252) - 1;

            const [year, month, day] = inv.data.split('-').map(Number);
            const investDate = new Date(year, month - 1, day);
            investDate.setHours(0, 0, 0, 0);

            const diasUteisPassados = differenceInBusinessDays(today, investDate);

            // valor_atual = valor_inicial × (1 + taxa_diaria)^(dias_uteis_passados)
            const valorAtualVirtual = inv.valor * Math.pow(1 + taxaDiaria, Math.max(0, diasUteisPassados));

            return {
                ...inv,
                taxaDiaria,
                valorAtualVirtual
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

        // Calcular taxa_media ponderada (baseada no valor atual virtual hoje)
        const weightedSumRates = virtualInvestments.reduce((sum, inv) => {
            return sum + (inv.valorAtualVirtual * (inv.rentabilidade / 100));
        }, 0);

        const taxaMediaAnualPonderada = patrimonioHoje > 0 ? weightedSumRates / patrimonioHoje : 0;

        // renda_mensal_futura = patrimonio_futuro × ((1 + taxa_media)^(1/12) - 1)
        const rendaMensalFutura = patrimonioFuturo * (Math.pow(1 + taxaMediaAnualPonderada, 1 / 12) - 1);

        return {
            patrimonioFuturo,
            lucroAcumulado,
            rendaMensalFutura
        };
    }, [virtualInvestments, projectionMonths, patrimonioHoje]);

    return (
        <Card className={cn(
            "w-full overflow-hidden border-none shadow-xl bg-gradient-to-b from-[#F9FBFF] to-white",
            isMobile ? "rounded-[24px] p-4" : "rounded-[32px] p-8"
        )}>
            {/* Gráfico */}
            <div className="w-full h-[300px] mb-8">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                        data={chartData}
                        margin={{
                            top: 10,
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
                                if (value === 0) return "R$ 0";
                                if (value >= 1000000) return `R$ ${(value / 1000000).toFixed(1)}M`;
                                if (value >= 1000) return `R$ ${(value / 1000).toFixed(0)}k`;
                                return `R$ ${value}`;
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
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>

            {/* Slider */}
            <div className="space-y-6 mb-10 px-2">
                <div className="flex items-center justify-between">
                    <label className="text-sm font-black text-gray-500 uppercase tracking-widest">Tempo de Projeção</label>
                    <span className="bg-blue-600 text-white px-4 py-1.5 rounded-full text-sm font-black shadow-lg shadow-blue-100 italic">
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
                    className="py-4"
                />
                <div className="flex justify-between text-[10px] font-black text-gray-400 uppercase tracking-widest opacity-60">
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
                <div className="bg-white p-6 rounded-[28px] border border-emerald-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex flex-col gap-3 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-full -mr-12 -mt-12 transition-transform group-hover:scale-110" />
                    <div className="flex items-center gap-2 mb-1 relative">
                        <div className="p-2.5 bg-emerald-500 text-white rounded-xl shadow-lg shadow-emerald-100 ring-4 ring-emerald-50">
                            <DynamicIcon name="TrendingUp" className="h-5 w-5" />
                        </div>
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em]">Valor Estimado</span>
                    </div>
                    <div className="relative">
                        <p className="text-2xl font-black text-gray-800 tracking-tight leading-none mb-1">
                            {formatCurrency(currentProjectionData.patrimonioFuturo)}
                        </p>
                        <div className="flex items-center gap-1.5 text-emerald-500 text-[11px] font-bold">
                            <DynamicIcon name="TrendingUp" className="h-3.5 w-3.5" />
                            <span>Crescimento composto</span>
                        </div>
                    </div>
                </div>

                {/* Card 2 - Lucro Acumulado */}
                <div className="bg-white p-6 rounded-[28px] border border-violet-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex flex-col gap-3 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-violet-50 rounded-full -mr-12 -mt-12 transition-transform group-hover:scale-110" />
                    <div className="flex items-center gap-2 mb-1 relative">
                        <div className="p-2.5 bg-violet-500 text-white rounded-xl shadow-lg shadow-violet-100 ring-4 ring-violet-50">
                            <DynamicIcon name="PiggyBank" className="h-5 w-5" />
                        </div>
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em]">Lucro Acumulado</span>
                    </div>
                    <div className="relative">
                        <p className="text-2xl font-black text-gray-800 tracking-tight leading-none mb-1">
                            {formatCurrency(currentProjectionData.lucroAcumulado)}
                        </p>
                        <div className="flex items-center gap-1.5 text-violet-500 text-[11px] font-bold">
                            <DynamicIcon name="Sparkles" className="h-3.5 w-3.5" />
                            <span>Rendimento esperado</span>
                        </div>
                    </div>
                </div>

                {/* Card 3 - Renda Mensal Futura */}
                <div className="bg-white p-6 rounded-[28px] border border-orange-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex flex-col gap-3 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-orange-50 rounded-full -mr-12 -mt-12 transition-transform group-hover:scale-110" />
                    <div className="flex items-center gap-2 mb-1 relative">
                        <div className="p-2.5 bg-orange-500 text-white rounded-xl shadow-lg shadow-orange-100 ring-4 ring-orange-50">
                            <DynamicIcon name="Flame" className="h-5 w-5" />
                        </div>
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em]">Renda Mensal Futura</span>
                    </div>
                    <div className="relative">
                        <p className="text-2xl font-black text-gray-800 tracking-tight leading-none mb-1">
                            {formatCurrency(currentProjectionData.rendaMensalFutura)}
                        </p>
                        <div className="flex items-center gap-1.5 text-orange-500 text-[11px] font-bold">
                            <DynamicIcon name="Calendar" className="h-3.5 w-3.5" />
                            <span>Estimativa de saque mensal</span>
                        </div>
                    </div>
                </div>
            </div>
        </Card>
    );
}
