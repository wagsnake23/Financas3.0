import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { Tables } from "@/integrations/supabase/types";
import { format } from "date-fns";
import DynamicIcon from "./DynamicIcon";
import { AppCategory } from "@/types/finance";
import { TotalExpensesCard } from "./TotalExpensesCard";
import { MonthlyExpenseBarChart } from "./MonthlyExpenseBarChart";
import { cn, formatCurrency } from "@/lib/utils";
import { getCategoryColor } from "@/lib/categoryColors";

const groupSubcategories = (data: any[], limit: number) => {
  if (data.length <= limit) return data;
  const sorted = [...data].sort((a, b) => b.value - a.value);
  const top = sorted.slice(0, limit);
  const others = sorted.slice(limit);
  const totalOthers = others.reduce((acc, curr) => acc + curr.value, 0);

  return [
    ...top,
    {
      nome: "Outros",
      value: totalOthers,
      color: "#94a3b8",
      icone: "📁"
    }
  ];
};

interface ExpensesDashboardProps {
  expenses: Tables<'despesas'>[];
  expenseInstallments: (Tables<'despesas_parcelas'> & { despesas: Pick<Tables<'despesas'>, 'categoria_id'> | null })[];
  categories: AppCategory[];
  isMobile: boolean;
}

export const ExpensesDashboard = ({ expenses, expenseInstallments, categories, isMobile }: ExpensesDashboardProps) => {
  const allCategories = categories;
  const subcategories = allCategories.filter(c => c.parent_id !== null);

  const currentMonthStr = useMemo(() => format(new Date(), "yyyy-MM"), []);
  const currentYearStr = useMemo(() => format(new Date(), "yyyy"), []);

  const monthlyInstallments = useMemo(() => {
    return expenseInstallments.filter(p => p.vencimento.startsWith(currentMonthStr));
  }, [expenseInstallments, currentMonthStr]);

  const annualInstallments = useMemo(() => {
    return expenseInstallments.filter(p => p.vencimento.startsWith(currentYearStr));
  }, [expenseInstallments, currentYearStr]);

  const monthlyTotalValue = useMemo(() => {
    return monthlyInstallments.reduce((sum, p) => sum + p.valor_parcela, 0);
  }, [monthlyInstallments]);

  const annualTotalValue = useMemo(() => {
    return annualInstallments.reduce((sum, p) => sum + p.valor_parcela, 0);
  }, [annualInstallments]);

  const expensesBySubcategory = useMemo(() => {
    const grouped = monthlyInstallments.reduce((acc, installment) => {
      const subcategoryId = installment.despesas?.categoria_id || "others";
      const subcategory = allCategories.find(c => c.id === subcategoryId);
      const name = subcategory?.nome || "Outros";
      const icon = subcategory?.icone || "📁";
      const color = subcategory ? getCategoryColor(subcategory, allCategories) : "hsl(215, 15%, 50%)";

      if (!acc[subcategoryId]) {
        acc[subcategoryId] = { nome: name, value: 0, color, icone: icon };
      }
      acc[subcategoryId].value += installment.valor_parcela;
      return acc;
    }, {} as Record<string, { nome: string, value: number; color: string, icone: string }>);

    const rawData = Object.values(grouped);
    const limit = isMobile ? 5 : 16;
    return groupSubcategories(rawData, limit);
  }, [monthlyInstallments, allCategories, isMobile]);

  const totalMonthlyAmount = useMemo(() => {
    return expensesBySubcategory.reduce((sum, item) => sum + item.value, 0);
  }, [expensesBySubcategory]);



  return (
    <div className="grid grid-cols-1 gap-6 mb-8 h-full">
      {isMobile && (
        <TotalExpensesCard
          expenseInstallments={expenseInstallments}
          isMobile={isMobile}
          chartContent={
            <MonthlyExpenseBarChart
              expenseInstallments={expenseInstallments}
              currentDate={new Date()}
              isMobile={true}
              onMonthClick={() => { }}
            />
          }
          annualTotalValue={expenseInstallments
            .filter(p => new Date(p.vencimento).getFullYear() === new Date().getFullYear())
            .reduce((sum, p) => sum + p.valor_parcela, 0)
          }
        />
      )}

      <Card 
        className={cn("p-6 lg:pb-4 animate-fade-in rounded-[24px] shadow-sm card-despesas flex flex-col", !isMobile && "h-full")}
        style={{ backgroundColor: !isMobile ? "#FFFFFF" : "transparent" }}
      >
        <div className="flex items-center gap-2 mb-6 shrink-0">
          <div className="h-8 w-1.5 bg-indigo-500 rounded-full" />
          <h2 className="text-xl font-bold text-gray-800 tracking-tight">Despesas por Subcategoria</h2>
        </div>

        {expensesBySubcategory.length === 0 ? (
          <div className="flex-grow flex flex-col items-center justify-center text-muted-foreground bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
            <DynamicIcon name="BarChart2" className="h-12 w-12 mb-2 opacity-20" />
            <p className="text-sm font-medium">Nenhuma despesa registrada</p>
          </div>
        ) : (
          <div 
            className={cn("w-full", !isMobile ? "flex-grow min-h-[480px]" : "")}
            style={isMobile ? { 
              height: Math.max(240, expensesBySubcategory.length * 40) 
            } : undefined}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={expensesBySubcategory}
                layout="vertical"
                margin={{ left: isMobile ? 0 : 30, right: isMobile ? 0 : 40, top: 0, bottom: 0 }}
                barGap={8}
              >
                <XAxis type="number" hide />
                <YAxis
                  dataKey="nome"
                  type="category"
                  width={isMobile ? 165 : 180}
                  axisLine={false}
                  tickLine={false}
                  tick={({ x, y, payload, index }) => {
                    const item = expensesBySubcategory[index];
                    return (
                      <g transform={`translate(${x},${y})`}>
                        <foreignObject
                          x={isMobile ? -165 : -180}
                          y={-20}
                          width={isMobile ? 162 : 175}
                          height={40}
                        >
                          <div className="w-full flex flex-col items-end justify-center pr-0.5 select-none pointer-events-none" style={{ height: '40px' }}>
                            <div className="flex flex-row items-baseline justify-end gap-1.5 w-full">
                              <div className="text-right text-gray-700 text-[13px] md:text-[14px] font-semibold leading-[1.1] overflow-hidden break-words whitespace-normal" style={{ maxHeight: '2.2em' }}>
                                {String(payload.value).toLowerCase().replace(/(?:^|\s)\S/g, l => l.toUpperCase())}
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
                <Tooltip
                  cursor={{ fill: 'rgba(0,0,0,0.02)' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      const perc = totalMonthlyAmount > 0 ? ((data.value / totalMonthlyAmount) * 100).toFixed(1) : "0";
                      return (
                        <div className="bg-white p-4 shadow-xl border border-gray-100 rounded-xl">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xl">{data.icone}</span>
                            <span className="font-bold text-gray-800">{data.nome}</span>
                          </div>
                          <div className="flex items-baseline gap-2">
                            <span className="text-lg font-black text-indigo-600">{formatCurrency(data.value)}</span>
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
                  radius={[0, 8, 8, 0]}
                  barSize={isMobile ? 14 : 18}
                >
                  {expensesBySubcategory.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} fillOpacity={0.9} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {!isMobile && expensesBySubcategory.length > 0 && (
          <div className="mt-[18px] pt-12 border-t border-rose-50/50 flex items-center justify-between px-2">
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Mensal</span>
              <span className="text-xl font-black text-rose-600 tracking-tight">{formatCurrency(monthlyTotalValue)}</span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Anual</span>
              <span className="text-lg font-bold text-slate-700 tracking-tight">{formatCurrency(annualTotalValue)}</span>
            </div>
          </div>
        )}

      </Card>


    </div>
  );
};