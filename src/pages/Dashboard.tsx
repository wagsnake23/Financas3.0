import React, { useMemo, useState, useEffect } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Navigation } from "@/components/Navigation";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/StatCard";
import { MonthlyBarChart } from "@/components/MonthlyBarChart";
import { ExpensesPieChart } from "@/components/ExpensesPieChart";
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
import { cn, formatCurrency } from "@/lib/utils"; // Importar formatCurrency
import { useTransactionsData } from "@/hooks/useTransactionsData";
import { MobileCreditCardExpenses } from "@/components/MobileCreditCardExpenses";
import { MonthBadge } from "@/components/MonthBadge";

const Dashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  
  const [showIncomeValue, setShowIncomeValue] = useState(true);
  const [showExpenseValue, setShowExpenseValue] = useState(true);
  const [showBalanceValue, setShowBalanceValue] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date());

  const {
    monthlyFilteredTransactions,
    fetchedCategories: allSubcategories,
    cartoes,
    isLoading: isLoadingTransactionsData,
    isLoadingCategories,
  } = useTransactionsData({ user, selectedMonth, enabled: !!user && !authLoading });

  // Fetch revenues
  const { data: revenues = [], isLoading: isLoadingRevenues } = useQuery<Tables<'receitas'>[]>({
    queryKey: ["revenues", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("receitas")
        .select("*")
        .eq("user_id", user.id)
        .order("data", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user && !authLoading,
  });

  // Fetch expense installments and join with expenses to get category_id
  const { data: expenseInstallments = [], isLoading: isLoadingExpenses } = useQuery<
    (Tables<'despesas_parcelas'> & { despesas: Pick<Tables<'despesas'>, 'categoria_id'> | null })[]
  >({
    queryKey: ["expenseInstallments", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("despesas_parcelas")
        .select("*, despesas(categoria_id, user_id)")
        .filter("despesas.user_id", "eq", user.id)
        .order("vencimento", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!user && !authLoading,
  });

  const stats = useMemo(() => {
    const totalIncome = monthlyFilteredTransactions
      .filter(t => t.type === "income")
      .reduce((sum, t) => sum + t.amount, 0);
    
    const totalExpenses = monthlyFilteredTransactions
      .filter(t => t.type === "expense")
      .reduce((sum, t) => sum + t.amount, 0);
    
    const balance = totalIncome - totalExpenses;

    return { totalIncome, totalExpenses, balance };
  }, [monthlyFilteredTransactions]);

  // Calculate total paid expenses for the current month
  const totalPaidMonthlyExpenses = useMemo(() => {
    return monthlyFilteredTransactions
      .filter(t => t.type === "expense" && t.status === "Recebida")
      .reduce((sum, t) => sum + t.amount, 0);
  }, [monthlyFilteredTransactions]);

  const isLoading = authLoading || isLoadingTransactionsData || isLoadingRevenues || isLoadingExpenses || isLoadingCategories;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Carregando Dashboard...</div>
      </div>
    );
  }

  const handleCalendarClick = () => {
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
            <div className="grid grid-cols-1 gap-4 mb-4">
              <StatCard
                title="Total de Despesas"
                value={stats.totalExpenses} // Passando valor numérico
                icon="TrendingDown"
                variant="expense"
                isMobile={isMobile}
                showValue={showExpenseValue}
                onToggleVisibility={() => setShowExpenseValue(!showExpenseValue)}
                childrenAlignment="start" 
                headerContent={isMobile ? <MonthBadge selectedMonth={selectedMonth} isMobile={isMobile} variant="expense" /> : null} // Pass MonthBadge here
              >
                <div className={cn("flex justify-between items-end w-full")}>
                  <div className="flex flex-col items-start">
                    <p className="text-xs text-muted-foreground">Pago este mês:</p> {/* MonthBadge removed from here */}
                    <p className="font-semibold text-base text-success">{formatCurrency(totalPaidMonthlyExpenses)}</p>
                  </div>
                  <Button
                    variant="destructive"
                    className={cn("h-8 px-3 text-xs rounded-xl w-[130px]")} 
                    onClick={() => navigate("/despesas")}
                  >
                    <DynamicIcon name="Plus" className="mr-2 h-4 w-4" />
                    Nova Despesa
                  </Button>
                </div>
              </StatCard>

              <StatCard
                title="Total de Receitas"
                value={stats.totalIncome} // Passando valor numérico
                icon="TrendingUp"
                variant="income"
                isMobile={isMobile}
                showValue={showIncomeValue}
                onToggleVisibility={() => setShowIncomeValue(!showIncomeValue)}
                headerContent={isMobile ? <MonthBadge selectedMonth={selectedMonth} isMobile={isMobile} variant="income" /> : null} // Pass MonthBadge here
              >
                <div className={cn("flex justify-between items-end w-full")}>
                  <div className="flex flex-col items-start">
                    <p className="text-xs text-muted-foreground">Saldo Atual:</p> {/* MonthBadge removed from here */}
                    <p className={cn(
                      "font-semibold text-base text-primary"
                    )}>
                      {showBalanceValue ? formatCurrency(stats.balance) : "R$ *****"}
                    </p>
                  </div>
                  <Button 
                    variant="success" 
                    className="w-[130px] h-8 px-3 text-xs rounded-xl" 
                    onClick={() => navigate("/receitas")}
                  >
                    <DynamicIcon name="Plus" className="mr-2 h-4 w-4" />
                    Nova Receita
                  </Button>
                </div>
              </StatCard>

              <MobileCreditCardExpenses
                cartoes={cartoes}
                expenseInstallments={expenseInstallments}
                allCategories={allSubcategories}
                isMobile={isMobile}
                selectedMonth={selectedMonth}
              />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <StatCard
                  title="Saldo Atual"
                  value={stats.balance} // Passando valor numérico
                  icon="Wallet"
                  variant="balance"
                  trend={stats.balance >= 0 ? "Positivo" : "Negativo"}
                  isMobile={isMobile}
                  showValue={showBalanceValue}
                  onToggleVisibility={() => setShowBalanceValue(!showBalanceValue)}
                />
                <StatCard
                  title="Total de Receitas"
                  value={stats.totalIncome} // Passando valor numérico
                  icon="TrendingUp"
                  variant="income"
                  isMobile={isMobile}
                  showValue={showIncomeValue}
                  onToggleVisibility={() => setShowIncomeValue(!showIncomeValue)}
                >
                  <div className="flex justify-end mt-4">
                    <Button 
                      variant="success" 
                      className="w-auto px-4 h-8 text-xs rounded-xl" 
                      onClick={() => navigate("/receitas")}
                    >
                      <DynamicIcon name="Plus" className="mr-2 h-4 w-4" />
                      Nova Receita
                    </Button>
                  </div>
                </StatCard>
                <StatCard
                  title="Total de Despesas"
                  value={stats.totalExpenses} // Passando valor numérico
                  icon="TrendingDown"
                  variant="expense"
                  isMobile={isMobile}
                  showValue={showExpenseValue}
                  onToggleVisibility={() => setShowExpenseValue(!showExpenseValue)}
                >
                  <div className="flex justify-end mt-4">
                    <Button
                      variant="destructive"
                      className={cn("h-8 px-3 text-xs rounded-xl w-auto px-4")}
                      onClick={() => navigate("/despesas")}
                    >
                      <DynamicIcon name="Plus" className="mr-2 h-4 w-4" />
                      Nova Despesa
                    </Button>
                  </div>
                </StatCard>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
                <ExpensesPieChart transactions={monthlyFilteredTransactions} allCategories={allSubcategories} isMobile={isMobile} />

                <div className="flex flex-col gap-4">
                  {/* <MonthlyExpenseSummary
                    expenseInstallments={expenseInstallments}
                    isLoading={isLoading}
                    isMobile={isMobile}
                    currentMonth={selectedMonth}
                  /> */}
                  <MonthlyExpenseCalendar 
                    transactions={monthlyFilteredTransactions}
                    isMobile={isMobile} 
                    currentMonth={selectedMonth}
                  />
                </div>

                <MonthlyBarChart transactions={monthlyFilteredTransactions} isMobile={isMobile} />
              </div>

              <div className="grid grid-cols-1 mb-4">
                <TotalExpensesCard expenseInstallments={expenseInstallments} isMobile={isMobile} />
              </div>

              <Card className="p-6 animate-slide-up rounded-xl shadow-sm">
                <p className="text-muted-foreground">Mais conteúdo do Dashboard virá aqui.</p>
              </Card>
            </>
          )}
        </main>
        <Footer isMobile={isMobile} />
      </div>
    </ProtectedRoute>
  );
};

export default Dashboard;