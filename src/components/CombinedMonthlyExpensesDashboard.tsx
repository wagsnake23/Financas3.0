import React, { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import DynamicIcon from "./DynamicIcon";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Label, LabelList } from "recharts";
import { Transaction, AppCategory } from "@/types/finance";
import { Tables } from "@/integrations/supabase/types";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn, formatCurrency } from "@/lib/utils";
import { getCategoryColor } from "@/lib/categoryColors";
import { getYear, setYear, startOfYear, endOfYear } from "date-fns";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

// Helper for subcategory grouping logic
const groupSubcategories = (data: any[], limit: number) => {
  const sorted = [...data].sort((a, b) => b.value - a.value);
  if (sorted.length <= limit) return sorted;

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
  const [viewMode, setViewMode] = useState<"monthly" | "annual">("monthly");

  const handlePreviousMonth = () => {
    setCurrentMonth(prev => subMonths(prev, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(prev => addMonths(prev, 1));
  };

  const handlePreviousYear = () => {
    setCurrentMonth(prev => subMonths(prev, 12));
  };

  const handleNextYear = () => {
    setCurrentMonth(prev => addMonths(prev, 12));
  };

  const startOfCurrentMonth = startOfMonth(currentMonth);
  const endOfCurrentMonth = endOfMonth(currentMonth);

  // Filtrar parcelas de despesas para o mês selecionado internamente ou para o ano todo
  const filteredExpenseInstallments = useMemo(() => {
    if (viewMode === "monthly") {
      const startStr = format(startOfMonth(currentMonth), "yyyy-MM-01");
      const nextMonthStartStr = format(addMonths(startOfMonth(currentMonth), 1), "yyyy-MM-01");

      return allExpenseInstallments.filter(p => {
        const vencimentoDate = p.vencimento.substring(0, 10);
        return vencimentoDate >= startStr && vencimentoDate < nextMonthStartStr;
      });
    } else {
      const yearStr = format(currentMonth, "yyyy");
      return allExpenseInstallments.filter(p => {
        return p.vencimento.startsWith(yearStr);
      });
    }
  }, [allExpenseInstallments, currentMonth, viewMode]);

  // Calcular totais de resumo (Pago/Pendente)
  const { totalPaid, totalPending } = useMemo(() => {
    if (isLoading) {
      return { totalPaid: 0, totalPending: 0 };
    }

    let paid = 0;
    let pending = 0;

    filteredExpenseInstallments.forEach(installment => {
      if (installment.pago) {
        paid += installment.valor_parcela;
      } else {
        pending += installment.valor_parcela;
      }
    });

    return { totalPaid: paid, totalPending: pending };
  }, [filteredExpenseInstallments, isLoading]);

  // Preparar dados para o Gráfico de Pizza
  const expensesForPieChart = useMemo(() => {
    // Precisamos reconstruir o tipo Transaction a partir de expenseInstallments para o gráfico de pizza
    return filteredExpenseInstallments.map(p => ({
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
  }, [filteredExpenseInstallments]);

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

    const limit = isMobile ? rawData.length : 8; // Top 8 for desktop, all for mobile
    return groupSubcategories(rawData, limit);
  }, [expensesBySubcategory, isMobile]);

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
        "p-6 animate-slide-up rounded-[2xl] border border-white/20 bg-white/75 backdrop-blur-[10px] shadow-[0_8px_32px_rgba(0,0,0,0.08)]",
        isMobile && "p-0 bg-transparent shadow-none border-0 backdrop-blur-none"
      )} style={{ WebkitBackdropFilter: 'blur(10px)' }}>
        {!isMobile && (
          <div className="flex flex-col items-end gap-3 mb-8 pr-2">
            <ToggleGroup
              type="single"
              value={viewMode}
              onValueChange={(v) => v && setViewMode(v as "monthly" | "annual")}
              className="bg-white/40 p-1.5 rounded-2xl shadow-sm border border-gray-300/50"
            >
              <ToggleGroupItem
                value="monthly"
                className="rounded-xl px-5 py-2 text-sm font-black data-[state=on]:bg-blue-600 data-[state=on]:text-white shadow-none transition-all"
              >
                Mês
              </ToggleGroupItem>
              <ToggleGroupItem
                value="annual"
                className="rounded-xl px-5 py-2 text-sm font-black data-[state=on]:bg-blue-600 data-[state=on]:text-white shadow-none transition-all"
              >
                Ano
              </ToggleGroupItem>
            </ToggleGroup>

            <div className="flex items-center gap-6">
              <Button
                variant="ghost"
                size="icon"
                onClick={viewMode === "monthly" ? handlePreviousMonth : handlePreviousYear}
                className="h-10 w-10 rounded-full hover:bg-white/40 transition-colors shadow-sm bg-white/20"
              >
                <DynamicIcon name="ChevronLeft" className="h-6 w-6 text-gray-600" />
              </Button>

              <div className="text-center group min-w-[180px]">
                <h2 className="text-2xl font-black capitalize text-gray-800 tracking-tight transition-all group-hover:scale-105">
                  {viewMode === "monthly"
                    ? format(currentMonth, "MMMM yyyy", { locale: ptBR })
                    : format(currentMonth, "yyyy", { locale: ptBR })}
                </h2>
                <div className="h-1.5 w-16 bg-primary/30 rounded-full mx-auto mt-2 transition-all group-hover:w-24 group-hover:bg-primary/50" />
              </div>

              <Button
                variant="ghost"
                size="icon"
                onClick={viewMode === "monthly" ? handleNextMonth : handleNextYear}
                className="h-10 w-10 rounded-full hover:bg-white/40 transition-colors shadow-sm bg-white/20"
              >
                <DynamicIcon name="ChevronRight" className="h-6 w-6 text-gray-600" />
              </Button>
            </div>
          </div>
        )}



        {/* Gráficos */}
        <div className={cn("grid grid-cols-1 lg:grid-cols-2 gap-8", isMobile && "gap-4")}>
          {/* Donut de Categorias */}
          <div className={cn(
            "relative overflow-hidden px-4 rounded-[24px] border border-blue-100 card-fatura shadow-[0_4px_12px_rgba(0,0,0,0.03)]",
            isMobile ? "pt-3 pb-5 px-3" : "pt-4 pb-6 px-6"
          )} style={{ backgroundColor: "rgba(255, 255, 255, 0.55)" }}>
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-2 mt-1">
                <div className="h-8 w-2 bg-primary rounded-full shadow-[0_0_12px_rgba(59,130,246,0.3)]" />
                <h3 className="text-lg font-bold text-[#1E6BCE] tracking-tight">Despesas por Categoria</h3>
              </div>

              {isMobile && (
                <div className="flex flex-col items-center gap-2">
                  <ToggleGroup
                    type="single"
                    value={viewMode}
                    onValueChange={(v) => v && setViewMode(v as "monthly" | "annual")}
                    className="btn-3d bg-[#E6F0FF] p-1 rounded-2xl border border-blue-200 shadow-none h-9 w-[135px]"
                    style={{ "--cor-topo": "#E6F0FF", "--cor-base": "#DCEBFF", boxShadow: "inset 0px 1px 2px rgba(255, 255, 255, 0.25), inset 0px -2px 3px rgba(0, 0, 0, 0.1)" } as any}
                  >
                    <ToggleGroupItem
                      value="monthly"
                      className="rounded-xl flex-1 text-xs font-black transition-all data-[state=on]:bg-gradient-to-b data-[state=on]:from-[#1E6BCE] data-[state=on]:to-[#1557A6] data-[state=on]:text-white data-[state=on]:shadow-md data-[state=off]:text-[#1E6BCE] h-7"
                    >
                      Mês
                    </ToggleGroupItem>
                    <ToggleGroupItem
                      value="annual"
                      className="rounded-xl flex-1 text-xs font-black transition-all data-[state=on]:bg-gradient-to-b data-[state=on]:from-[#1E6BCE] data-[state=on]:to-[#1557A6] data-[state=on]:text-white data-[state=on]:shadow-md data-[state=off]:text-[#1E6BCE] h-7"
                    >
                      Ano
                    </ToggleGroupItem>
                  </ToggleGroup>

                  <div
                    className="btn-3d flex items-center justify-between px-1 rounded-2xl transition-all h-9 w-[135px] border border-blue-200 shadow-none cursor-default mt-1"
                    style={{ "--cor-topo": "#E6F0FF", "--cor-base": "#DCEBFF", boxShadow: "inset 0px 1px 2px rgba(255, 255, 255, 0.25), inset 0px -2px 3px rgba(0, 0, 0, 0.1)" } as any}
                  >
                    <button
                      onClick={viewMode === "monthly" ? handlePreviousMonth : handlePreviousYear}
                      className="text-white hover:opacity-90 rounded-full p-0 h-6 w-6 flex items-center justify-center transition-all shadow-sm"
                      style={{ background: "linear-gradient(180deg, #1E6BCE 0%, #1557A6 100%)", boxShadow: "inset 0px 1px 1px rgba(255, 255, 255, 0.4), inset 0px -1px 1px rgba(0, 0, 0, 0.1)" }}
                    >
                      <DynamicIcon name="ChevronLeft" className="h-3.5 w-3.5" strokeWidth={4} />
                    </button>
                    <span className="text-[12px] font-black text-[#1E6BCE] px-1 flex-1 text-center uppercase tracking-tight pt-[1px] whitespace-nowrap">
                      {viewMode === "monthly"
                        ? format(currentMonth, "MMM / y", { locale: ptBR }).replace(".", "")
                        : format(currentMonth, "yyyy", { locale: ptBR })}
                    </span>
                    <button
                      onClick={viewMode === "monthly" ? handleNextMonth : handleNextYear}
                      className="text-white hover:opacity-90 rounded-full p-0 h-6 w-6 flex items-center justify-center transition-all shadow-sm"
                      style={{ background: "linear-gradient(180deg, #1E6BCE 0%, #1557A6 100%)", boxShadow: "inset 0px 1px 1px rgba(255, 255, 255, 0.4), inset 0px -1px 1px rgba(0, 0, 0, 0.1)" }}
                    >
                      <DynamicIcon name="ChevronRight" className="h-3.5 w-3.5" strokeWidth={4} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {chartData.length === 0 ? (
              <div className="h-[300px] flex flex-col items-center justify-center text-muted-foreground bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
                <DynamicIcon name="PieChart" className="h-12 w-12 mb-2 opacity-20" />
                <p className="text-sm font-medium">Nenhuma despesa para este período</p>
              </div>
            ) : (
              <div
                className={cn(
                  "h-[350px] w-full outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0",
                  "select-none [&_*]:outline-none [&_*]:focus:outline-none [&_*]:focus-visible:outline-none",
                  isMobile && "h-[320px]"
                )}
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart
                    margin={{ top: 10, right: 25, left: 25, bottom: 10 }}
                    style={{ outline: 'none' }}
                  >
                    <defs>
                      <filter id="shadow3d" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur in="SourceAlpha" stdDeviation="3" result="blur" />
                        <feOffset in="blur" dx="2" dy="4" result="offsetBlur" />
                        <feFlood floodColor="#000" floodOpacity="0.2" result="offsetColor" />
                        <feComposite in="offsetColor" in2="offsetBlur" operator="in" result="offsetBlur" />
                        <feBlend in="SourceGraphic" in2="offsetBlur" mode="normal" />
                      </filter>
                      <linearGradient id="pieGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgba(255,255,255,0.2)" />
                        <stop offset="100%" stopColor="rgba(0,0,0,0.1)" />
                      </linearGradient>
                    </defs>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={isMobile ? "55%" : "70%"}
                      outerRadius={isMobile ? "78%" : "90%"}
                      paddingAngle={5}
                      dataKey="value"
                      animationBegin={0}
                      animationDuration={1500}
                      label={isMobile ? ({ percent }) => `${(percent * 100).toFixed(0)}%` : false}
                      labelLine={false}
                      stroke="none"
                      isAnimationActive={true}
                    >
                      {chartData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.color}
                          filter="url(#shadow3d)"
                          className="transition-all duration-300 cursor-pointer outline-none"
                          style={{ filter: 'drop-shadow(0px 4px 8px rgba(0,0,0,0.15))' }}
                        />
                      ))}
                      <Label
                        content={({ viewBox }) => {
                          const { cx, cy } = viewBox as any;
                          return (
                            <g>
                              <circle cx={cx} cy={cy} r={isMobile ? "50" : "60"} fill="white" fillOpacity="0.6" style={{ filter: 'blur(2px)' }} />
                              <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle">
                                <tspan x={cx} dy="-0.6em" className="fill-gray-400 text-[10px] font-black uppercase tracking-[0.2em]">
                                  Total
                                </tspan>
                                <tspan x={cx} dy="1.2em" className="fill-gray-800 text-xl font-black tracking-tighter">
                                  {formatCurrency(totalMonthlyExpense)}
                                </tspan>
                              </text>
                            </g>
                          );
                        }}
                      />
                    </Pie>
                    <Tooltip
                      cursor={{ fill: 'transparent' }}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          const perc = ((data.value / totalMonthlyExpense) * 100).toFixed(1);
                          return (
                            <div className="bg-white/90 backdrop-blur-md p-4 shadow-[0_12px_48px_rgba(0,0,0,0.15)] border border-white/60 rounded-2xl animate-in zoom-in-95" style={{ WebkitBackdropFilter: 'blur(10px)' }}>
                              <div className="flex items-center gap-3 mb-2">
                                <span className="text-2xl drop-shadow-sm">{data.icone}</span>
                                <div className="flex flex-col">
                                  <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Categoria</span>
                                  <span className="font-bold text-gray-800 leading-tight">{data.name}</span>
                                </div>
                              </div>
                              <div className="flex items-baseline gap-2 pt-1 border-t border-gray-100">
                                <span className="text-xl font-black text-primary tracking-tighter">
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
                    {!isMobile && (
                      <Legend
                        verticalAlign="bottom"
                        align="center"
                        layout="horizontal"
                        iconType="circle"
                        wrapperStyle={{ paddingTop: '20px' }}
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
          <div className={cn(
            "relative overflow-hidden px-4 rounded-[24px] border border-blue-100 card-fatura shadow-[0_4px_12px_rgba(0,0,0,0.03)]",
            isMobile ? "pt-3 pb-5 px-3" : "pt-4 pb-6 px-6"
          )} style={{ backgroundColor: "rgba(255, 255, 255, 0.55)" }}>
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-2 mt-1">
                <div className="h-8 w-2 bg-indigo-500 rounded-full shadow-[0_0_12px_rgba(99,102,241,0.3)]" />
                <h3 className="text-lg font-bold text-[#1E6BCE] tracking-tight">Despesas por Subcategoria</h3>
              </div>

              {isMobile && (
                <div className="flex flex-col items-center gap-2">
                  <ToggleGroup
                    type="single"
                    value={viewMode}
                    onValueChange={(v) => v && setViewMode(v as "monthly" | "annual")}
                    className="btn-3d bg-[#E6F0FF] p-1 rounded-2xl border border-blue-200 shadow-none h-9 w-[135px]"
                    style={{ "--cor-topo": "#E6F0FF", "--cor-base": "#DCEBFF", boxShadow: "inset 0px 1px 2px rgba(255, 255, 255, 0.25), inset 0px -2px 3px rgba(0, 0, 0, 0.1)" } as any}
                  >
                    <ToggleGroupItem
                      value="monthly"
                      className="rounded-xl flex-1 text-xs font-black transition-all data-[state=on]:bg-gradient-to-b data-[state=on]:from-[#1E6BCE] data-[state=on]:to-[#1557A6] data-[state=on]:text-white data-[state=on]:shadow-md data-[state=off]:text-[#1E6BCE] h-7"
                    >
                      Mês
                    </ToggleGroupItem>
                    <ToggleGroupItem
                      value="annual"
                      className="rounded-xl flex-1 text-xs font-black transition-all data-[state=on]:bg-gradient-to-b data-[state=on]:from-[#1E6BCE] data-[state=on]:to-[#1557A6] data-[state=on]:text-white data-[state=on]:shadow-md data-[state=off]:text-[#1E6BCE] h-7"
                    >
                      Ano
                    </ToggleGroupItem>
                  </ToggleGroup>

                  <div
                    className="btn-3d flex items-center justify-between px-1 rounded-2xl transition-all h-9 w-[135px] border border-blue-200 shadow-none cursor-default mt-1"
                    style={{ "--cor-topo": "#E6F0FF", "--cor-base": "#DCEBFF", boxShadow: "inset 0px 1px 2px rgba(255, 255, 255, 0.25), inset 0px -2px 3px rgba(0, 0, 0, 0.1)" } as any}
                  >
                    <button
                      onClick={viewMode === "monthly" ? handlePreviousMonth : handlePreviousYear}
                      className="text-white hover:opacity-90 rounded-full p-0 h-6 w-6 flex items-center justify-center transition-all shadow-sm"
                      style={{ background: "linear-gradient(180deg, #1E6BCE 0%, #1557A6 100%)", boxShadow: "inset 0px 1px 1px rgba(255, 255, 255, 0.4), inset 0px -1px 1px rgba(0, 0, 0, 0.1)" }}
                    >
                      <DynamicIcon name="ChevronLeft" className="h-3.5 w-3.5" strokeWidth={4} />
                    </button>
                    <span className="text-[12px] font-black text-[#1E6BCE] px-1 flex-1 text-center uppercase tracking-tight pt-[1px] whitespace-nowrap">
                      {viewMode === "monthly"
                        ? format(currentMonth, "MMM / y", { locale: ptBR }).replace(".", "")
                        : format(currentMonth, "yyyy", { locale: ptBR })}
                    </span>
                    <button
                      onClick={viewMode === "monthly" ? handleNextMonth : handleNextYear}
                      className="text-white hover:opacity-90 rounded-full p-0 h-6 w-6 flex items-center justify-center transition-all shadow-sm"
                      style={{ background: "linear-gradient(180deg, #1E6BCE 0%, #1557A6 100%)", boxShadow: "inset 0px 1px 1px rgba(255, 255, 255, 0.4), inset 0px -1px 1px rgba(0, 0, 0, 0.1)" }}
                    >
                      <DynamicIcon name="ChevronRight" className="h-3.5 w-3.5" strokeWidth={4} />
                    </button>
                  </div>
                </div>
              )}
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
                    margin={{ left: isMobile ? 0 : 30, right: 45, top: 0, bottom: 0 }}
                    barGap={2}
                  >
                    <defs>
                      <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgba(255,255,255,0.3)" />
                        <stop offset="50%" stopColor="rgba(255,255,255,0)" />
                        <stop offset="100%" stopColor="rgba(0,0,0,0.1)" />
                      </linearGradient>
                      <filter id="barShadow" x="-2%" y="-2%" width="120%" height="120%">
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
                        const item = subcategoryChartData.find(d => d.name === payload.value);
                        return (
                          <g transform={`translate(${x},${y})`}>
                            <text
                              x={isMobile ? -8 : -15}
                              y={0}
                              dy={4}
                              textAnchor="end"
                              className="fill-gray-500 text-[10px] md:text-[12px] font-black uppercase tracking-tight"
                            >
                              {item?.icone} {isMobile && payload.value.length > 13 ? `${payload.value.substring(0, 11)}..` : payload.value}
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
                          const perc = ((data.value / totalMonthlyExpense) * 100).toFixed(1);
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
                                <span className="text-xl font-black text-indigo-600 tracking-tighter">
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
                      {subcategoryChartData.map((entry, index) => (
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
                          const percentage = totalMonthlyExpense > 0
                            ? `${((value / totalMonthlyExpense) * 100).toFixed(1)}%`
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
            )}
          </div>
        </div>
      </Card>
    </div>
  );
};