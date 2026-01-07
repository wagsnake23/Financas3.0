import { Card } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, LabelList } from "recharts";
import { Tables } from "@/integrations/supabase/types";
import { AppCategory } from "@/types/finance";
import { cn, formatCurrency } from "@/lib/utils";
import { getCategoryColor } from "@/lib/categoryColors";
import DynamicIcon from "./DynamicIcon";
import { useMemo } from "react";

interface RevenueByTypeChartProps {
  revenues: Tables<'receitas'>[];
  revenueTypes: AppCategory[];
  isMobile?: boolean;
  annualTotalValue?: number;
}

export const RevenueByTypeChart = ({ revenues, revenueTypes, isMobile, annualTotalValue }: RevenueByTypeChartProps) => {
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
        <h2 className="text-xl font-semibold mb-4">Receitas por Subcategoria</h2>
        <div className="flex-grow flex items-center justify-center text-muted-foreground">
          Nenhuma receita registrada
        </div>
      </Card>
    );
  }

  // Dashboard-like gradient card and BarChart for both Mobile and Desktop
  return (
    <div className={cn(
      "bg-gradient-to-br from-gray-50/90 to-gray-200/60 p-6 rounded-[24px] border border-gray-300/50 shadow-[0_4px_24px_rgba(0,0,0,0.04)]",
      "backdrop-blur-[8px] flex flex-col",
      isMobile ? "px-3 py-5" : "h-full justify-between"
    )} style={{ WebkitBackdropFilter: 'blur(8px)' }}>
      <div>
        <div className="flex items-center gap-2 mb-6">
          <div className="h-8 w-2 bg-[#1AA361] rounded-full shadow-[0_0_12px_rgba(26,163,97,0.3)]" />
          <h3 className="text-lg font-black text-gray-800 tracking-tight">Receitas por Subcategoria</h3>
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
                    const perc = totalRevenue > 0 ? ((data.value / totalRevenue) * 100).toFixed(1) : "0.0";
                    return (
                      <div className="bg-white/90 backdrop-blur-md p-4 shadow-[0_12px_48px_rgba(0,0,0,0.15)] border border-white/60 rounded-2xl animate-in zoom-in-95" style={{ WebkitBackdropFilter: 'blur(10px)' }}>
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-2xl drop-shadow-sm">{data.icone}</span>
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Subcategoria</span>
                            <span className="font-bold text-gray-800 leading-tight">{data.name}</span>
                          </div>
                        </div>
                        <div className="flex items-baseline gap-2 pt-1 border-t border-gray-100">
                          <span className="text-xl font-black text-[#1AA361] tracking-tighter">
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
                    const percentage = totalRevenue > 0
                      ? `${((value / totalRevenue) * 100).toFixed(1)}%`
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