import React, { useMemo, useState, useEffect } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Navigation } from "@/components/Navigation";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/StatCard";
import { MonthlyBarChart } from "@/components/MonthlyBarChart";
import { ExpensesPieChart } from "@/components/ExpensesPieChart";
import { MonthlyExpensesCombinedMobile } from "@/components/MonthlyExpensesCombinedMobile";
import { TotalExpensesCard } from "@/components/TotalExpensesCard";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Tables } from "@/integrations/supabase/types";
import { Transaction } from "@/types/finance";
import { useIsMobile } from "@/hooks/use-mobile";
import { AppCategory } from "@/types/finance";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import DynamicIcon from "@/components/DynamicIcon";
import { useNavigate } from "react-router-dom";
import { format, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import { MonthlyExpenseCalendar } from "@/components/MonthlyExpenseCalendar";
import { MonthlyExpenseSummary } from "@/components/MonthlyExpenseSummary";
import { cn } from "@/lib/utils";
import { useRecurringEntries } from "@/hooks/useRecurringEntries"; // Importar o novo hook

const Dashboard = () => {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  
  const [showIncomeValue, setShowIncomeValue] = useState(true);
  const [showExpenseValue, setShowExpenseValue] = useState(true);
  const [showBalanceValue, setShowBalanceValue] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date()); // Novo estado para o mês selecionado no calendário

  // Use the new recurring entries hook
  const { materializedRecurringTransactions, isLoading: isLoadingRecurring } = useRecurringEntries(user, selectedMonth, []); // Pass empty categories for now

  // Fetch revenues
  const { data: revenues = [], isLoading: isLoadingRevenues } = useQuery<Tables<'receitas'>[]>({
    queryKey: ["revenues", user?.id], // Unificado
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("receitas")
        .select("*")
        .eq("user_id", user.id)
        .order("data", { ascending: false });
      if (error) throw error;
      return data.filter(r => !r.is_fixed); // Filter out legacy fixed revenues
    },
    enabled: !!user?.id,
  });

  // Fetch expense installments and join with expenses to get category_id
  const { data: expenseInstallments = [], isLoading: isLoadingExpenses } = useQuery<
    (Tables<'despesas_parcelas'> & { despesas: Pick<Tables<'despesas'>, 'categoria_id' | 'is_fixed'> | null })[]
  >({
    queryKey: ["expenseInstallments", user?.id], // Unificado
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("despesas_parcelas")
        .select("*, despesas(categoria_id, user_id, is_fixed)")
        .filter("despesas.user_id", "eq", user.id)
        .order("vencimento", { ascending: true });
      if (error) throw error;
      return data.filter(p => !p.despesas?.is_fixed); // Filter out legacy fixed expenses
    },
    enabled: !!user?.id,
  });

  // Fetch ALL categories from Supabase (user-specific and default ones with user_id: null)
  const { data: allCategories = [], isLoading: isLoadingCategories } = useQuery<AppCategory[]>({
    queryKey: ["categories", user?.id], // Unificado
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("categorias")
        .select("*")
        .or(`user_id.eq.${user.id},user_id.is.null`)
        .order("nome");
      if (error) throw error;
      return data as AppCategory[];
    },
    enabled: !!user?.id,
  });

  const allTransactions: Transaction[] = useMemo(() => {
    const incomeTransactions: Transaction[] = revenues.map(r => ({
      id: r.id,
      type: "income",
      amount: r.valor,
      date: r.data,
      category: r.tipo_receita_id || "receitas_e_investimentos_extras",
      description: r.descricao || "Receita",
    }));

    const expenseTransactions: Transaction[] = expenseInstallments.map(p => ({
      id: p.id,
      type: "expense",
      amount: p.valor_parcela,
      date: p.vencimento,
      category: p.despesas?.categoria_id || "outros_diversos",
      description: `Parcela ${p.numero_parcela} de despesa`,
    }));

    // Combine one-off transactions with materialized recurring transactions
    return [...incomeTransactions, ...expenseTransactions, ...materializedRecurringTransactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [revenues, expenseInstallments, materializedRecurringTransactions]);

  const stats = useMemo(() => {
    const today = new Date();
    const startOfCurrentMonth = startOfMonth(today);
    const endOfCurrentMonth = endOfMonth(today);

    const totalIncome = allTransactions
      .filter(t => t.type === "income" && isWithinInterval(new Date(t.date), { start: startOfCurrentMonth, end: endOfCurrentMonth }))
      .reduce((sum, t) => sum + t.amount, 0);
    
    const totalExpenses = allTransactions
      .filter(t => t.type === "expense" && isWithinInterval(new Date(t.date), { start: startOfCurrentMonth, end: endOfCurrentMonth }))
      .reduce((sum, t) => sum + t.amount, 0);
    
    const balance = totalIncome - totalExpenses;

    return { totalIncome, totalExpenses, balance };
  }, [allTransactions]);

  const isLoading = isLoadingRevenues || isLoadingExpenses || isLoadingCategories || isLoadingRecurring;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Carregando Dashboard...</div>
      </div>
    );
  }

  const handleCalendarClick = () => {
    // Navega para a página de lançamentos com o mês selecionado
    const formattedMonth = format(selectedMonth, "yyyy-MM-dd");
    navigate(`/lancamentos?month=${formattedMonth}`);
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background pt-16">
        <Navigation />
        <main className="container mx-auto px-4 py-8">
          {!isMobile && (
            <h1 className="text-3xl font-bold mb-6">Dashboard Financeiro</h1>
          )}
          
          {isMobile ? (
            // Layout específico para mobile
            <div className="grid grid-cols-1 gap-4 mb-4">
              {/* 1. Total de Despesas */}
              <StatCard
                title="Total de Despesas"
                value={`R$ ${stats.totalExpenses.toFixed(2)}`}
                icon="TrendingDown"
                variant="expense"
                trend="Este mês"
                isMobile={isMobile}
                showValue={showExpenseValue}
                onToggleVisibility={() => setShowExpenseValue(!showExpenseValue)}
              >
                <div className={cn("flex justify-end mt-4", isMobile && "mt-2")}> {/* Ajustado mt para mobile */}
                  <Button 
                    variant="destructive" 
                    className="w-2/5 h-8 px-3 text-xs rounded-xl" 
                    onClick={() => navigate("/despesas")}
                  >
                    <DynamicIcon name="Plus" className="mr-2 h-4 w-4" />
                    Nova Despesa
                  </Button>
                </div>
              </StatCard>

              {/* 2. Total de Receitas */}
              <StatCard
                title="Total de Receitas"
                value={`R$ ${stats.totalIncome.toFixed(2)}`}
                icon="TrendingUp"
                variant="income"
                trend="Este mês"
                isMobile={isMobile}
                showValue={showIncomeValue}
                onToggleVisibility={() => setShowIncomeValue(!showIncomeValue)}
              >
                <div className={cn("flex justify-end mt-4", isMobile && "mt-2")}> {/* Ajustado mt para mobile */}
                  <Button 
                    variant="success" 
                    className="w-2/5 h-8 px-3 text-xs rounded-xl" 
                    onClick={() => navigate("/receitas")}
                  >
                    <DynamicIcon name="Plus" className="mr-2 h-4 w-4" />
                    Nova Receita
                  </Button>
                </div>
              </StatCard>

              {/* 3. Saldo Atual */}
              <StatCard
                title="Saldo Atual"
                value={`R$ ${stats.balance.toFixed(2)}`}
                icon="Wallet"
                variant="balance"
                trend={stats.balance >= 0 ? "Positivo" : "Negativo"}
                isMobile={isMobile}
                showValue={showBalanceValue}
                onToggleVisibility={() => setShowBalanceValue(!showBalanceValue)}
              />

              {/* 4. MonthlyExpensesCombinedMobile (dashboard com seletor de data) */}
              <MonthlyExpensesCombinedMobile
                transactions={allTransactions}
                expenseInstallments={expenseInstallments}
                isMobile={isMobile}
              />
            </div>
          ) : (
            // Layout para desktop
            <>
              {/* Stats Cards originais para desktop */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <StatCard
                  title="Saldo Atual"
                  value={`R$ ${stats.balance.toFixed(2)}`}
                  icon="Wallet"
                  variant="balance"
                  trend={stats.balance >= 0 ? "Positivo" : "Negativo"}
                  isMobile={isMobile}
                  showValue={showBalanceValue}
                  onToggleVisibility={() => setShowBalanceValue(!showBalanceValue)}
                />
                <StatCard
                  title="Total de Receitas"
                  value={`R$ ${stats.totalIncome.toFixed(2)}`}
                  icon="TrendingUp"
                  variant="income"
                  trend="Este mês"
                  isMobile={isMobile}
                  showValue={showIncomeValue}
                  onToggleVisibility={() => setShowIncomeValue(!showIncomeValue)}
                >
                  {/* Botões de ação para desktop */}
                  <div className="flex justify-end mt-4">
                    <Button 
                      variant="success" 
                      className="w-2/5 h-8 px-3 text-xs rounded-xl" 
                      onClick={() => navigate("/receitas")}
                    >
                      <DynamicIcon name="Plus" className="mr-2 h-4 w-4" />
                      Nova Receita
                    </Button>
                  </div>
                </StatCard>
                <StatCard
                  title="Total de Despesas"
                  value={`R$ ${stats.totalExpenses.toFixed(2)}`}
                  icon="TrendingDown"
                  variant="expense"
                  trend="Este mês"
                  isMobile={isMobile}
                  showValue={showExpenseValue}
                  onToggleVisibility={() => setShowExpenseValue(!showExpenseValue)}
                >
                  {/* Botões de ação para desktop */}
                  <div className="flex justify-end mt-4">
                    <Button 
                      variant="destructive" 
                      className="w-2/5 h-8 px-3 text-xs rounded-xl" 
                      onClick={() => navigate("/despesas")}
                    >
                      <DynamicIcon name="Plus" className="mr-2 h-4 w-4" />
                      Nova Despesa
                    </Button>
                  </div>
                </StatCard>
              </div>

              {/* Charts e Resumo Mensal de Despesas */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
                {/* Coluna 1: Gráfico de Pizza de Despesas */}
                <ExpensesPieChart transactions={allTransactions} allCategories={allCategories} isMobile={isMobile} />

                {/* Coluna 2: Resumo Mensal de Despesas e Calendário de Despesas (invertidos e agrupados) */}
                <div className="flex flex-col gap-4">
                  <MonthlyExpenseSummary
                    expenseInstallments={expenseInstallments}
                    isLoading={isLoading}
                    isMobile={isMobile}
                    currentMonth={selectedMonth} // Passa o mês selecionado
                  />
                  <MonthlyExpenseCalendar 
                    transactions={allTransactions} 
                    isMobile={isMobile} 
                    currentMonth={selectedMonth} // Passa o mês selecionado
                  />
                </div>

                {/* Coluna 3: Gráfico de Barras Mensais */}
                <MonthlyBarChart transactions={allTransactions} isMobile={isMobile} />
              </div>

              {/* TotalExpensesCard em uma nova linha, abaixo do grid principal, para dar mais destaque */}
              <div className="grid grid-cols-1 mb-4">
                <TotalExpensesCard expenseInstallments={expenseInstallments} isMobile={isMobile} />
              </div>

              {/* Placeholder for other dashboard content - Renderizado apenas em desktop */}
              <Card className="p-6 animate-slide-up rounded-xl shadow-sm">
                <p className="text-muted-foreground">Mais conteúdo do Dashboard virá aqui.</p>
              </Card>
            </>
          )}
          {/* Footer para mobile, posicionado logo abaixo do grid de dashboards */}
          {isMobile && <Footer isMobile={isMobile} />}

        </main>
        {/* Footer para desktop, posicionado no final da página */}
        {!isMobile && <Footer isMobile={isMobile} />}
      </div>
    </ProtectedRoute>
  );
};

export default Dashboard;