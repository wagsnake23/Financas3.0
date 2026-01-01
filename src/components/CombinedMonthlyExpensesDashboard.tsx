import React, { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import DynamicIcon from "./DynamicIcon";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { Transaction, AppCategory } from "@/types/finance";
import { Tables } from "@/integrations/supabase/types";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn, formatCurrency } from "@/lib/utils";

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
      const displayCategoryColor = parentCategory?.cor || subcategory?.cor || "hsl(215, 15%, 50%)";

      if (!acc[displayCategoryName]) {
        acc[displayCategoryName] = { value: 0, color: displayCategoryColor };
      }
      acc[displayCategoryName].value += transaction.amount;
      return acc;
    }, {} as Record<string, { value: number; color: string }>);

  const chartData = Object.entries(expensesByCategory).map(([name, data]) => ({
    name,
    value: data.value,
    color: data.color,
  }));

  if (isLoading) {
    return (
      <Card className={cn("p-6 animate-fade-in rounded-xl shadow-sm", isMobile ? "h-48" : "h-60 flex items-center justify-center")}>
        <div className={cn("animate-pulse text-muted-foreground", "font-roboto")}>Carregando dados mensais...</div>
      </Card>
    );
  }

  return (
    <Card className={cn("p-6 animate-slide-up rounded-xl shadow-sm", isMobile && "p-4")}>
      <div className="flex items-center justify-between mb-4">
        <Button variant="outline" size="icon" onClick={handlePreviousMonth} className={cn(isMobile && "h-6 w-6")}>
          <DynamicIcon name="ChevronLeft" className={cn("h-5 w-5", isMobile && "h-2.5 w-2.5")} />
        </Button>
        <h2 className={cn("text-xl font-bold capitalize", isMobile && "text-lg", "font-roboto")}>
          {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
        </h2>
        <Button variant="outline" size="icon" onClick={handleNextMonth} className={cn(isMobile && "h-6 w-6")}>
          <DynamicIcon name="ChevronRight" className={cn("h-5 w-5", isMobile && "h-2.5 w-2.5")} />
        </Button>
      </div>

      {/* Parte do Resumo Mensal de Despesas */}
      <div className="grid grid-cols-2 gap-4 text-center mb-6">
        <div className={cn(
          "p-3 border rounded-lg",
          isMobile ? "p-2 border-transparent bg-transparent" : "bg-success/5 border-success/20"
        )}>
          <p className={cn("text-sm text-muted-foreground", isMobile && "text-xs", "font-roboto")}>Pago</p>
          <p className={cn("text-xl font-bold text-success", isMobile && "text-base")}>{formatCurrency(totalPaid)}</p>
        </div>
        <div className={cn(
          "p-3 border rounded-lg",
          isMobile ? "p-2 border-transparent bg-transparent" : "bg-destructive/5 border-destructive/20"
        )}>
          <p className={cn("text-sm text-muted-foreground", isMobile && "text-xs", "font-roboto")}>Pendente</p>
          <p className={cn("text-xl font-bold text-destructive", isMobile && "text-base")}>{formatCurrency(totalPending)}</p>
        </div>
      </div>

      {/* Parte do Gráfico de Pizza de Despesas por Categoria */}
      <h3 className={cn("text-xl font-semibold mb-4", isMobile && "text-lg mb-3", "font-roboto")}>Despesas por Categoria</h3>
      {chartData.length === 0 ? (
        <div className={cn("h-60 flex items-center justify-center text-muted-foreground", isMobile && "h-48", "font-roboto")}>
          Nenhuma despesa registrada
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={isMobile ? 200 : 'auto'} minHeight={isMobile ? undefined : 260}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
              outerRadius={isMobile ? 60 : 100}
              fill="#8884d8"
              dataKey="value"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) => formatCurrency(value)}
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "var(--radius)",
              }}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
};