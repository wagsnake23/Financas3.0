import React, { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import DynamicIcon from "./DynamicIcon";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Label } from "recharts";
import { Transaction, AppCategory } from "@/types/finance";
import { Tables } from "@/integrations/supabase/types";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn, formatCurrency } from "@/lib/utils";
import { getCategoryColor } from "@/lib/categoryColors";

// Helper for subcategory grouping logic
const groupSubcategories = (data: any[], limit: number) => {
  if (data.length <= limit) return data;
  const sorted = [...data].sort((a, b) => b.value - a.value);
  const top = sorted.slice(0, limit);
  const others = sorted.slice(limit);
  const totalOthers = others.reduce((acc, curr) => acc + curr.value, 0);

  return [
    ...top,
    {
      name: "Outros",
      value: totalOthers,
      color: "#94a3b8",
      icone: "📁"
    }
  ];
};

interface CombinedMonthlyExpensesDashboardProps {
  allRevenues: Tables<'receitas'>[]; // Todas as receitas, não filtradas por mês
  allExpenseInstallments: (Tables<'despesas_parcelas'> & { despesas: Pick<Tables<'despesas'>, 'categoria_id' | 'id' | 'user_id' | 'descricao' | 'forma_pagamento' | 'tipo_pagamento' | 'cartao_id' | 'is_recurring_master' | 'numero_parcelas'> | null })[]; // Todas as parcelas, não filtradas por mês
  allCategories: AppCategory[];
  isLoading: boolean; // Loading geral do componente pai
  isMobile?: boolean;
}

export const CombinedMonthlyExpensesDashboard: React.FC<CombinedMonthlyExpensesDashboardProps> = ({
  allRevenues,
  allExpenseInstallments,
  allCategories,
  isLoading,
  isMobile,
}) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const handlePreviousMonth = () => {
    setCurrentMonth(prev => subMonths(prev, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(prev => addMonths(prev, 1));
  };

  const startOfCurrentMonth = startOfMonth(currentMonth);
  const endOfCurrentMonth = endOfMonth(currentMonth);

  // Filtrar parcelas de despesas para o mês selecionado internamente
  const monthlyExpenseInstallments = useMemo(() => {
    const startStr = format(startOfCurrentMonth, "yyyy-MM-01");
    const nextMonthStartStr = format(addMonths(startOfCurrentMonth, 1), "yyyy-MM-01");

    return allExpenseInstallments.filter(p => {
      const vencimentoDate = p.vencimento.substring(0, 10);
      return vencimentoDate >= startStr && vencimentoDate < nextMonthStartStr;
    });
  }, [allExpenseInstallments, startOfCurrentMonth]);

  // Calcular totais de resumo (Pago/Pendente)
  const { totalPaid, totalPending } = useMemo(() => {
    if (isLoading) {
      return { totalPaid: 0, totalPending: 0 };
    }

    let paid = 0;
    let pending = 0;

    monthlyExpenseInstallments.forEach(installment => {
      if (installment.pago) {
        paid += installment.valor_parcela;
      } else {
        pending += installment.valor_parcela;
      }
    });

    return { totalPaid: paid, totalPending: pending };
  }, [monthlyExpenseInstallments, isLoading]);

  // Preparar dados para o Gráfico de Pizza
  const expensesForPieChart = useMemo(() => {
    // Precisamos reconstruir o tipo Transaction a partir de expenseInstallments para o gráfico de pizza
    return monthlyExpenseInstallments.map(p => ({
      id: p.id,
      type: "expense" as "expense", // Cast explícito
      amount: p.valor_parcela,
      date: p.vencimento,
      category: p.despesas?.categoria_id || "outros_diversos",
      description: p.despesas?.descricao || "Despesa",
      status: p.pago ? 'Recebida' : 'Pendente',
      installmentNumber: p.numero_parcela,
      totalInstallments: p.despesas?.numero_parcelas, // Assumindo que despesas pai tem total_installments
      forma_pagamento: p.despesas?.forma_pagamento,
      cartao_id: p.despesas?.cartao_id,
      despesa_id: p.despesas?.id,
      is_recurring_master: Boolean(p.despesas?.is_recurring_master),
      recurrence_id: p.despesas?.id ?? null,
      recurrence_day: null,
      tipo_pagamento: p.despesas?.tipo_pagamento,
    }));
  }, [monthlyExpenseInstallments]);

  const expensesByCategory = expensesForPieChart
    .filter(t => t.type === "expense")
    .reduce((acc, transaction) => {
      const subcategory = allCategories.find(c => c.id === transaction.category);
      let parentCategory: AppCategory | undefined;

      if (subcategory && subcategory.parent_id) {
        parentCategory = allCategories.find(c => c.id === subcategory.parent_id);
      }

      const displayCategoryName = parentCategory?.nome || subcategory?.nome || "Outros";
      const displayCategoryColor = subcategory ? getCategoryColor(subcategory, allCategories) : (parentCategory ? getCategoryColor(parentCategory, allCategories) : "hsl(215, 15%, 50%)");
      const displayCategoryIcon = parentCategory?.icone || subcategory?.icone || "📁";

      if (!acc[displayCategoryName]) {
        acc[displayCategoryName] = { value: 0, color: displayCategoryColor, icone: displayCategoryIcon };
      }
      acc[displayCategoryName].value += transaction.amount;
      return acc;
    }, {} as Record<string, { value: number; color: string; icone: string }>);

  const expensesBySubcategory = expensesForPieChart
    .filter(t => t.type === "expense")
    .reduce((acc, transaction) => {
      const subcategory = allCategories.find(c => c.id === transaction.category);

      const name = subcategory?.nome || "Outros";
      const color = subcategory ? getCategoryColor(subcategory, allCategories) : "hsl(215, 15%, 50%)";
      const icon = subcategory?.icone || "📁";

      if (!acc[name]) {
        acc[name] = { value: 0, color, icone: icon };
      }
      acc[name].value += transaction.amount;
      return acc;
    }, {} as Record<string, { value: number; color: string; icone: string }>);

  const chartData = useMemo(() => {
    return Object.entries(expensesByCategory).map(([name, data]) => ({
      name,
      value: data.value,
      color: data.color,
      icone: data.icone,
    })).sort((a, b) => b.value - a.value);
  }, [expensesByCategory]);

  const subcategoryChartData = useMemo(() => {
    const rawData = Object.entries(expensesBySubcategory).map(([name, data]) => ({
      name,
      value: data.value,
      color: data.color,
      icone: data.icone,
    }));

    return rawData.sort((a, b) => b.value - a.value);
  }, [expensesBySubcategory]);

  const totalMonthlyExpense = useMemo(() => {
    return chartData.reduce((sum, item) => sum + item.value, 0);
  }, [chartData]);

  if (isLoading) {
    return (
      <Card className={cn("p-6 animate-fade-in rounded-xl shadow-sm", isMobile ? "h-48" : "h-60 flex items-center justify-center")}>
        <div className={cn("animate-pulse text-muted-foreground", "font-roboto")}>Carregando dados mensais...</div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className={cn(
        "p-6 animate-slide-up rounded-2xl shadow-sm border-0 bg-white/50 backdrop-blur-sm",
        isMobile && "p-0 bg-transparent shadow-none border-0 backdrop-blur-none"
      )}>
        <div className="flex items-center justify-between mb-8">
          <Button
            variant="ghost"
            size="icon"
            onClick={handlePreviousMonth}
            className="h-10 w-10 rounded-full hover:bg-gray-100 transition-colors"
          >
            <DynamicIcon name="ChevronLeft" className="h-6 w-6 text-gray-600" />
          </Button>

          <div className="text-center">
            <h2 className="text-2xl font-bold capitalize text-gray-800 tracking-tight">
              {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
            </h2>
            <div className="h-1 w-12 bg-primary/20 rounded-full mx-auto mt-1" />
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleNextMonth}
            className="h-10 w-10 rounded-full hover:bg-gray-100 transition-colors"
          >
            <DynamicIcon name="ChevronRight" className="h-6 w-6 text-gray-600" />
          </Button>
        </div>



        {/* Gráficos */}
        <div className={cn("grid grid-cols-1 lg:grid-cols-2 gap-8", isMobile && "gap-4")}>
          {/* Donut de Categorias */}
          <div className={cn("bg-white p-6 rounded-2xl border border-gray-100 shadow-sm", isMobile && "px-3 py-5")}>
            <div className="flex items-center gap-2 mb-6">
              <div className="h-8 w-1.5 bg-primary rounded-full" />
              <h3 className="text-lg font-bold text-gray-800">Despesas por Categoria</h3>
            </div>

            {chartData.length === 0 ? (
              <div className="h-[300px] flex flex-col items-center justify-center text-muted-foreground bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
                <DynamicIcon name="PieChart" className="h-12 w-12 mb-2 opacity-20" />
                <p className="text-sm font-medium">Nenhuma despesa para este período</p>
              </div>
            ) : (
              <div className={cn("h-[350px] w-full", isMobile && "h-[320px]")}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart margin={{ top: 10, right: 25, left: 25, bottom: 10 }}>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={isMobile ? "55%" : "70%"}
                      outerRadius={isMobile ? "78%" : "90%"}
                      paddingAngle={4}
                      dataKey="value"
                      animationBegin={0}
                      animationDuration={1200}
                      label={isMobile ? ({ percent }) => `${(percent * 100).toFixed(0)}%` : false}
                      labelLine={false}
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                      ))}
                      <Label
                        content={({ viewBox }) => {
                          const { cx, cy } = viewBox as any;
                          return (
                            <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle">
                              <tspan x={cx} dy="-0.5em" className="fill-muted-foreground text-[12px] font-semibold uppercase tracking-widest">
                                Total
                              </tspan>
                              <tspan x={cx} dy="1.5em" className="fill-foreground text-xl font-black">
                                {formatCurrency(totalMonthlyExpense)}
                              </tspan>
                            </text>
                          );
                        }}
                      />
                    </Pie>
                    <Tooltip
                      cursor={{ fill: 'transparent' }}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-white p-4 shadow-xl border border-gray-100 rounded-xl">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xl">{data.icone}</span>
                                <span className="font-bold text-gray-800">{data.name}</span>
                              </div>
                              <div className="text-lg font-black text-primary">
                                {formatCurrency(data.value)}
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    {!isMobile && (
                      <Legend
                        verticalAlign="middle"
                        align="right"
                        layout="vertical"
                        iconType="circle"
                        formatter={(value, entry: any) => {
                          const payload = entry.payload;
                          const percentage = ((payload.value / totalMonthlyExpense) * 100).toFixed(0);
                          return (
                            <span className="text-sm font-semibold text-gray-600 pl-2">
                              {value} <span className="text-primary/60 ml-1">{percentage}%</span>
                            </span>
                          );
                        }}
                      />
                    )}
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Barras de Subcategorias */}
          <div className={cn("bg-white p-6 rounded-2xl border border-gray-100 shadow-sm", isMobile && "px-3 py-5")}>
            <div className="flex items-center gap-2 mb-6">
              <div className="h-8 w-1.5 bg-indigo-500 rounded-full" />
              <h3 className="text-lg font-bold text-gray-800">Despesas por Subcategoria</h3>
            </div>

            {subcategoryChartData.length === 0 ? (
              <div className="h-[300px] flex flex-col items-center justify-center text-muted-foreground bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
                <DynamicIcon name="BarChart2" className="h-12 w-12 mb-2 opacity-20" />
                <p className="text-sm font-medium">Nenhuma subcategoria para este período</p>
              </div>
            ) : (
              <div
                className="w-full"
                style={{
                  height: isMobile
                    ? Math.max(200, subcategoryChartData.length * 35)
                    : Math.max(350, subcategoryChartData.length * 40)
                }}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={subcategoryChartData}
                    layout="vertical"
                    margin={{ left: isMobile ? 0 : 30, right: isMobile ? 0 : 40, top: 0, bottom: 0 }}
                    barGap={2}
                  >
                    <XAxis type="number" hide />
                    <YAxis
                      dataKey="name"
                      type="category"
                      width={isMobile ? 100 : 130}
                      axisLine={false}
                      tickLine={false}
                      tick={({ x, y, payload }) => {
                        const item = subcategoryChartData.find(d => d.name === payload.value);
                        return (
                          <g transform={`translate(${x},${y})`}>
                            <text
                              x={isMobile ? -5 : -10}
                              y={0}
                              dy={4}
                              textAnchor="end"
                              className="fill-gray-600 text-[10px] md:text-[13px] font-bold"
                            >
                              {item?.icone} {isMobile && payload.value.length > 12 ? `${payload.value.substring(0, 10)}..` : payload.value}
                            </text>
                          </g>
                        );
                      }}
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(0,0,0,0.02)' }}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          const perc = ((data.value / totalMonthlyExpense) * 100).toFixed(1);
                          return (
                            <div className="bg-white p-4 shadow-xl border border-gray-100 rounded-xl">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xl">{data.icone}</span>
                                <span className="font-bold text-gray-800">{data.name}</span>
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
                      barSize={isMobile ? 18 : 22}
                    >
                      {subcategoryChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} fillOpacity={0.9} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>

  );
};