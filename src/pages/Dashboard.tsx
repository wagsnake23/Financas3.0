import React, { useMemo, useState, useEffect } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Navigation } from "@/components/Navigation";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/StatCard";
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
import { format, startOfMonth, endOfMonth, isWithinInterval, addMonths, subMonths, getYear } from "date-fns"; // Importar getYear
import { cn, formatCurrency } from "@/lib/utils";
import { useTransactionsData } from "@/hooks/useTransactionsData";
import { MobileCreditCardExpenses } from "@/components/MobileCreditCardExpenses";
import { MonthBadge } from "@/components/MonthBadge";
import { CombinedMonthlyExpensesDashboard } from "@/components/CombinedMonthlyExpensesDashboard";
import { MonthlyExpenseBarChart } from "@/components/MonthlyExpenseBarChart";
import { MonthlyRevenueBarChart } from "@/components/MonthlyRevenueBarChart";
import { MonthNavigatorCompact } from "@/components/MonthNavigatorCompact";

export default function Dashboard() { // Alterado para export default function
  const { user, loading: authLoading } = useAuth();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  
  const [selectedMonth, setSelectedMonth] = useState(new Date()); // Este estado agora só controlará StatCards e MonthlyBarChart

  // Buscar TODAS as receitas (não filtradas por mês)
  const { data: allRevenues = [], isLoading: isLoadingAllRevenues } = useQuery<Tables<'receitas'>[]>({
    queryKey: ["allRevenues", user?.id], // Chave de consulta alterada
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

  // Buscar TODAS as parcelas de despesas (não filtradas por mês)
  const { data: allExpenseInstallments = [], isLoading: isLoadingAllExpenses } = useQuery<
    (Tables<'despesas_parcelas'> & { despesas: Pick<Tables<'despesas'>, 'categoria_id' | 'id' | 'user_id' | 'descricao' | 'forma_pagamento' | 'tipo_pagamento' | 'cartao_id' | 'is_recurring_master' | 'numero_parcelas'> | null })[] // Adicionado mais campos para reconstrução no dashboard combinado
  >({
    queryKey: ["allExpenseInstallments", user?.id], // Chave de consulta alterada
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("despesas_parcelas")
        .select("*, despesas(id, categoria_id, user_id, descricao, forma_pagamento, tipo_pagamento, cartao_id, is_recurring_master, numero_parcelas)") // Selecionar mais campos de despesas
        .filter("despesas.user_id", "eq", user.id)
        .order("vencimento", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!user && !authLoading,
  });

  // Este hook ainda busca dados filtrados por mês para StatCards e MonthlyBarChart
  const {
    monthlyFilteredTransactions,
    fetchedCategories: allSubcategories,
    cartoes,
    isLoading: isLoadingTransactionsData,
    isLoadingCategories,
  } = useTransactionsData({ user, selectedMonth, enabled: !!user && !authLoading });

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

  // Calcular total de despesas pagas para o mês atual (usando monthlyFilteredTransactions)
  const totalPaidMonthlyExpenses = useMemo(() => {
    return monthlyFilteredTransactions
      .filter(t => t.type === "expense" && t.status === "Recebida")
      .reduce((sum, t) => sum + t.amount, 0);
  }, [monthlyFilteredTransactions]);

  // NOVO: Calcular totais anuais
  const currentYear = getYear(selectedMonth);

  const totalAnnualExpenses = useMemo(() => {
    if (!allExpenseInstallments) return 0;
    return allExpenseInstallments
      .filter(p => getYear(new Date(p.vencimento)) === currentYear)
      .reduce((sum, p) => sum + p.valor_parcela, 0);
  }, [allExpenseInstallments, currentYear]);

  const totalAnnualRevenues = useMemo(() => {
    if (!allRevenues) return 0;
    return allRevenues
      .filter(r => getYear(new Date(r.data)) === currentYear)
      .reduce((sum, r) => sum + r.valor, 0);
  }, [allRevenues, currentYear]);


  const isLoading = authLoading || isLoadingTransactionsData || isLoadingAllRevenues || isLoadingAllExpenses || isLoadingCategories; // Verificações de loading atualizadas

  // Funções para navegar entre os meses
  const handlePreviousMonth = () => {
    setSelectedMonth(prev => subMonths(prev, 1));
  };

  const handleNextMonth = () => {
    setSelectedMonth(prev => addMonths(prev, 1));
  };

  // Função para lidar com o clique no mês do gráfico
  const handleMonthClick = (date: Date) => {
    setSelectedMonth(date);
  };

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
        <main className={cn("container mx-auto", isMobile ? "pt-8 px-4" : "py-8 max-w-[1200px] px-6")}>
          {!isMobile && (
            <h1 className="text-3xl font-bold mb-6">Dashboard Financeiro</h1>
          )}
          
          {/* REMOVIDO: MonthNavigator global */}

          {isMobile ? (
            <div className="grid grid-cols-1 gap-4"> {/* Removido mb-4 */}
              <StatCard
                mainStatTitle="Total de Despesas"
                mainStatValue={stats.totalExpenses}
                secondaryStatTitle="Pago este mês"
                secondaryStatValue={totalPaidMonthlyExpenses}
                topRightContent={
                  <MonthNavigatorCompact // Use the new component
                    selectedMonth={selectedMonth}
                    onPreviousMonth={handlePreviousMonth}
                    onNextMonth={handleNextMonth}
                    isMobile={isMobile}
                    variant="expense"
                  />
                }
                icon="TrendingDown"
                variant="expense"
                isMobile={isMobile}
                childrenAlignment="start"
                chartContent={
                  <MonthlyExpenseBarChart
                    expenseInstallments={allExpenseInstallments}
                    currentDate={selectedMonth}
                    isMobile={isMobile}
                    onMonthClick={handleMonthClick} // Passando a função de clique
                  />
                }
                annualTotalLabel="Total Anual" // NEW
                annualTotalValue={totalAnnualExpenses} // NEW
              >
                {/* Ajuste para posicionar o botão na parte inferior */}
                <div className={cn("flex flex-col w-full h-full")}>
                  <div className={cn("flex justify-end", isMobile && "mt-2")}> {/* Alterado mt-auto para mt-2 para mobile */}
                    <Button
                      variant="destructive"
                      className={cn("h-8 px-3 text-xs rounded-xl w-[130px] mb-1 mr-1")} /* Adicionado mr-1 aqui */
                      onClick={() => navigate("/despesas")}
                    >
                      <DynamicIcon name="Plus" className="mr-2 h-4 w-4" />
                      Nova Despesa
                    </Button>
                  </div>
                </div>
              </StatCard>

              <StatCard
                mainStatTitle="Total de Receitas"
                mainStatValue={stats.totalIncome}
                secondaryStatTitle="Saldo Atual"
                secondaryStatValue={stats.balance}
                topRightContent={
                  <MonthNavigatorCompact // Use the new component
                    selectedMonth={selectedMonth}
                    onPreviousMonth={handlePreviousMonth}
                    onNextMonth={handleNextMonth}
                    isMobile={isMobile}
                    variant="income"
                  />
                }
                icon="TrendingUp"
                variant="income"
                isMobile={isMobile}
                childrenAlignment="start" 
                chartContent={
                  <MonthlyRevenueBarChart
                    revenues={allRevenues}
                    currentDate={selectedMonth}
                    isMobile={isMobile}
                    onMonthClick={handleMonthClick} // Passando a função de clique
                  />
                }
                annualTotalLabel="Total Anual" // NEW
                annualTotalValue={totalAnnualRevenues} // NEW
              >
                {/* Ajuste para posicionar o botão na parte inferior */}
                <div className={cn("flex flex-col w-full h-full")}>
                  <div className={cn("flex justify-end", isMobile && "mt-2")}> {/* Alterado mt-auto para mt-2 para mobile */}
                    <Button 
                      variant="success" 
                      className="w-[130px] h-8 px-3 text-xs rounded-xl mb-1 mr-1" 
                      onClick={() => navigate("/receitas")}
                    >
                      <DynamicIcon name="Plus" className="mr-2 h-4 w-4" />
                      Nova Receita
                    </Button>
                  </div>
                </div>
              </StatCard>

              <MobileCreditCardExpenses
                cartoes={cartoes}
                expenseInstallments={allExpenseInstallments} // Passar todas as parcelas para o componente mobile
                allCategories={allSubcategories}
                isMobile={isMobile}
                selectedMonth={selectedMonth}
              />
              <Footer isMobile={isMobile} className={cn(isMobile && "mt-[-2rem]")} /> {/* Alterado mt-[-1rem] para mt-[-2rem] */}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <StatCard
                  mainStatTitle="Saldo Atual"
                  mainStatValue={stats.balance}
                  icon="Wallet"
                  variant="balance"
                  trend={stats.balance >= 0 ? "Positivo" : "Negativo"}
                  isMobile={isMobile}
                />
                <StatCard
                  mainStatTitle="Total de Receitas"
                  mainStatValue={stats.totalIncome}
                  icon="TrendingUp"
                  variant="income"
                  isMobile={isMobile}
                  topRightContent={
                    <MonthNavigatorCompact // Use the new component
                      selectedMonth={selectedMonth}
                      onPreviousMonth={handlePreviousMonth}
                      onNextMonth={handleNextMonth}
                      isMobile={isMobile}
                      variant="income"
                    />
                  }
                  chartContent={
                    <MonthlyRevenueBarChart
                      revenues={allRevenues}
                      currentDate={selectedMonth}
                      isMobile={isMobile}
                      onMonthClick={handleMonthClick} // Passando a função de clique
                    />
                  }
                  annualTotalLabel="Total Anual" // NEW
                  annualTotalValue={totalAnnualRevenues} // NEW
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
                  mainStatTitle="Total de Despesas"
                  mainStatValue={stats.totalExpenses}
                  icon="TrendingDown"
                  variant="expense"
                  isMobile={isMobile}
                  secondaryStatTitle="Pago este mês"
                  secondaryStatValue={totalPaidMonthlyExpenses}
                  topRightContent={
                    <MonthNavigatorCompact // Use the new component
                      selectedMonth={selectedMonth}
                      onPreviousMonth={handlePreviousMonth}
                      onNextMonth={handleNextMonth}
                      isMobile={isMobile}
                      variant="expense"
                    />
                  }
                  chartContent={
                    <MonthlyExpenseBarChart
                      expenseInstallments={allExpenseInstallments}
                      currentDate={selectedMonth}
                      isMobile={isMobile}
                      onMonthClick={handleMonthClick} // Passando a função de clique
                    />
                  }
                  annualTotalLabel="Total Anual" // NEW
                  annualTotalValue={totalAnnualExpenses} // NEW
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

              <div className="grid grid-cols-1 mb-4">
                <CombinedMonthlyExpensesDashboard
                  allRevenues={allRevenues}
                  allExpenseInstallments={allExpenseInstallments}
                  allCategories={allSubcategories}
                  isLoading={isLoading}
                  isMobile={isMobile}
                />
              </div>

              <div className="grid grid-cols-1 mb-4">
                <TotalExpensesCard expenseInstallments={allExpenseInstallments} isMobile={isMobile} />
              </div>

              <Card className="p-6 animate-slide-up rounded-xl shadow-sm">
                <p className={cn("text-muted-foreground", "font-roboto")}>Mais conteúdo do Dashboard virá aqui.</p>
              </Card>
              <Footer isMobile={isMobile} className="mt-8" />
            </>
          )}
        </main>
      </div>
    </ProtectedRoute>
  );
}