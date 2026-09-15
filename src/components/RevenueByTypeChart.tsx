import { Card } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, LabelList } from "recharts";
import { Tables } from "@/integrations/supabase/types";
import { AppCategory } from "@/types/finance";
import { cn, formatCurrency } from "@/lib/utils";
import { getCategoryColor } from "@/lib/categoryColors";
import DynamicIcon from "./DynamicIcon";
import { useMemo, useState } from "react";

interface RevenueByTypeChartProps {
  revenues: Tables<'receitas'>[];
  revenueTypes: AppCategory[];
  isMobile?: boolean;
  annualTotalValue?: number;
}

export const RevenueByTypeChart = ({ revenues, revenueTypes, isMobile, annualTotalValue }: RevenueByTypeChartProps) => {
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
    const incomeByType = revenues
      .reduce((acc, revenue) => {
        const type = revenueTypes.find(t => t.id === revenue.tipo_receita_id);
        const typeName = type?.nome || "Outros";
        const typeColor = type ? getCategoryColor(type, revenueTypes) : `hsl(${Math.floor(Math.random() * 360)}, 70%, 50%)`;
        const typeIcon = type?.icone || "💰";

        if (!acc[typeName]) {
          acc[typeName] = { value: 0, color: typeColor, icone: typeIcon };
        }
        acc[typeName].value += revenue.valor;
        return acc;
      }, {} as Record<string, { value: number; color: string; icone: string }>);

    return Object.entries(incomeByType)
      .map(([name, data]) => ({
        name,
        value: data.value,
        color: data.color,
        icone: data.icone
      }))
      .sort((a, b) => b.value - a.value);
  }, [revenues, revenueTypes]);

  const totalRevenue = useMemo(() => chartData.reduce((acc, curr) => acc + curr.value, 0), [chartData]);
  const formattedTotalRevenue = formatCurrency(totalRevenue);

  // If no data
  if (chartData.length === 0) {
    return (
      <Card className={cn(
        "p-6 animate-fade-in rounded-xl shadow-sm",
        isMobile && "bg-gradient-to-br from-gray-50/90 to-gray-200/60 border border-gray-300/50 shadow-[0_4px_24px_rgba(0,0,0,0.04)] backdrop-blur-[8px]",
        !isMobile && "h-full flex flex-col justify-center"
      )}>
        <h2 className="text-xl font-semibold mb-4">Receitas por Categoria</h2>
        <div className="flex-grow flex items-center justify-center text-muted-foreground">
          Nenhuma receita registrada
        </div>
      </Card>
    );
  }

  // Dashboard-like gradient card and BarChart for both Mobile and Desktop
  return (
    <div className={cn(
      "p-6 flex flex-col relative overflow-hidden rounded-[24px]",
      isMobile ? "px-3 py-5" : "h-full justify-between"
    )} style={{ 
      background: "linear-gradient(135deg, #F8FFF9 0%, #FFFFFF 55%, #F3FFF7 100%)",
      border: "1px solid rgba(255,255,255,.85)",
      backgroundClip: "padding-box",
      boxShadow: "0 8px 24px rgba(37,99,235,.05), 0 2px 6px rgba(37,99,235,.03), inset 0 1px 0 rgba(255,255,255,.95)",
      backdropFilter: "blur(18px) saturate(1.4)",
      WebkitBackdropFilter: "blur(18px) saturate(1.4)"
    }}>
      {/* SHAPE ORGÂNICA */}
      <div aria-hidden="true" style={{ position: "absolute", top: "-20px", right: "-30px", width: "40%", height: "35%", borderRadius: "50%", background: "rgba(255,255,255,0.25)", filter: "blur(4px)", pointerEvents: "none", zIndex: 0 }} />
      {/* ILUMINAÇÃO TEMÁTICA */}
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at top right, rgba(34,197,94,.08), transparent 70%)", pointerEvents: "none", zIndex: 0, borderRadius: "inherit" }} />
      
      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", height: "100%" }}>
        <div className="flex items-center gap-2 mb-6">
          <div className="h-8 w-2 bg-[#1AA361] rounded-full" />
          <h3 className="text-lg font-bold text-[#1AA361] tracking-tight">Receitas por Categoria</h3>
        </div>

        <div
          className="w-full relative bar-chart-container"
          style={{
            height: isMobile
              ? Math.max(200, chartData.length * 35)
              : Math.max(300, chartData.length * 40),
            filter: "drop-shadow(0 4px 10px rgba(0,0,0,.06))"
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
                <linearGradient id="barGradientRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgba(255,255,255,0.3)" />
                  <stop offset="50%" stopColor="rgba(255,255,255,0)" />
                  <stop offset="100%" stopColor="rgba(0,0,0,0.1)" />
                </linearGradient>
                <filter id="barShadowRevenue" x="-2%" y="-2%" width="120%" height="120%">
                  <feGaussianBlur in="SourceAlpha" stdDeviation="1.5" result="blur" />
                  <feOffset in="blur" dx="1" dy="1" result="offsetBlur" />
                  <feComposite in="SourceGraphic" in2="offsetBlur" operator="over" />
                </filter>
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
                          <div className="flex flex-row items-center justify-end gap-[8px] w-full">
                            <div className={cn(
                              "text-right text-[12px] md:text-[13px] font-semibold leading-[1.1] overflow-hidden break-words whitespace-normal text-gray-700 uppercase tracking-tight"
                            )} style={{ maxHeight: '2.2em' }}>
                              {String(payload.value)}
                            </div>
                            {(() => {
                              console.log('[DASHBOARD_ICON_RENDER]', {
                                nome: payload.value,
                                svgEncontrado: typeof item?.icone === 'string' && item.icone.startsWith('brand:'),
                                origemIcone: typeof item?.icone,
                                renderizado: !!item?.icone
                              });
                              return (
                                <div className="shrink-0 flex items-center justify-center translate-y-[1px]" style={{ width: '18px', height: '18px' }}>
                                  {item?.icone ? (
                                    <DynamicIcon name={item.icone as string} className="w-[18px] h-[18px] object-contain shrink-0" style={{ width: '18px', height: '18px', objectFit: 'contain', flexShrink: 0 }} />
                                  ) : (
                                    <span className="text-[16px] leading-none drop-shadow-sm">📁</span>
                                  )}
                                </div>
                              );
                            })()}
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
                    const percentage = totalRevenue > 0
                      ? `${((value / totalRevenue) * 100).toFixed(1)}%`
                      : "0%";
                    return (
                      <text
                        x={x + width + 10}
                        y={y + (isMobile ? 14 : 18)}
                        fill={index === activeBarIndex ? "#16a34a" : "#334155"}
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
                          <span className="text-xl drop-shadow-sm">
                            {chartData[activeBarIndex].icone && String(chartData[activeBarIndex].icone).startsWith("brand:") ? null : chartData[activeBarIndex].icone}
                          </span>
                          <div className="flex flex-col">
                              <span className="text-sm font-bold text-gray-800 leading-tight line-clamp-2" style={{ wordBreak: 'break-word' }}>{chartData[activeBarIndex].name}</span>
                          </div>
                      </div>
                      <div className="flex items-baseline gap-1.5 pt-1 border-t border-gray-100">
                          <span className="text-[15px] font-bold text-[#1AA361] tracking-tighter">
                              {formatCurrency(chartData[activeBarIndex].value)}
                          </span>
                          <span className="text-[11px] font-semibold text-gray-400">
                              ({totalRevenue > 0 ? ((chartData[activeBarIndex].value / totalRevenue) * 100).toFixed(1) : "0.0"}%)
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
            <p className="text-sm font-semibold text-muted-foreground mb-1 font-roboto">Total de Receitas</p>
            <p className="text-3xl font-bold text-[#1AA361] font-roboto">{formattedTotalRevenue}</p>
          </div>
          <div className="flex items-center gap-2">
            {annualTotalValue !== undefined && (
              <div className="flex flex-col items-end">
                <p className="text-xs text-muted-foreground leading-none font-roboto">Total Anual</p>
                <p className="text-sm font-bold text-[#1AA361] font-roboto">{formatCurrency(annualTotalValue)}</p>
              </div>
            )}
            <div className="rounded-xl bg-[#1AA361]/10 p-2 text-[#1AA361]">
              <DynamicIcon name="DollarSign" className="h-6 w-6" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
