import React, { useMemo, useState, useEffect } from "react";
import { Navigation } from "@/components/Navigation";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/StatCard";
import { TotalExpensesCard } from "@/components/TotalExpensesCard";
import { TotalRevenueCard } from "@/components/TotalRevenueCard";
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
import {
  format,
  startOfMonth,
  endOfMonth,
  isWithinInterval,
  addMonths,
  subMonths,
  getYear,
} from "date-fns";
import { cn, formatCurrency } from "@/lib/utils";
import { useTransactionsData } from "@/hooks/useTransactionsData";
import { MobileCreditCardExpenses } from "@/components/MobileCreditCardExpenses";
import { MonthBadge } from "@/components/MonthBadge";
import { CombinedMonthlyExpensesDashboard } from "@/components/CombinedMonthlyExpensesDashboard";
import { MonthlyExpenseBarChart } from "@/components/MonthlyExpenseBarChart";
import { MonthlyRevenueBarChart } from "@/components/MonthlyRevenueBarChart";
import { MonthNavigatorCompact } from "@/components/MonthNavigatorCompact";

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  const [selectedMonth, setSelectedMonth] = useState(new Date());

  const { data: allRevenues = [], isLoading: isLoadingAllRevenues } = useQuery<
    Tables<"receitas">[]
  >({
    queryKey: ["allRevenues", user?.id],
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

  const { data: allExpenseInstallments = [], isLoading: isLoadingAllExpenses } =
    useQuery<
      (Tables<"despesas_parcelas"> & {
        despesas: Pick<
          Tables<"despesas">,
          | "categoria_id"
          | "id"
          | "user_id"
          | "descricao"
          | "forma_pagamento"
          | "tipo_pagamento"
          | "cartao_id"
          | "is_recurring_master"
          | "numero_parcelas"
        > | null;
      })[]
    >({
      queryKey: ["allExpenseInstallments", user?.id],
      queryFn: async () => {
        if (!user?.id) return [];
        const { data, error } = await supabase
          .from("despesas_parcelas")
          .select(
            "*, despesas(id, categoria_id, user_id, descricao, forma_pagamento, tipo_pagamento, cartao_id, is_recurring_master, numero_parcelas)"
          )
          .filter("despesas.user_id", "eq", user.id)
          .order("vencimento", { ascending: true });
        if (error) throw error;
        return data;
      },
      enabled: !!user && !authLoading,
    });

  const {
    monthlyFilteredTransactions,
    fetchedCategories: allSubcategories,
    cartoes,
    isLoading: isLoadingTransactionsData,
    isLoadingCategories,
  } = useTransactionsData({
    user,
    selectedMonth,
    enabled: !!user && !authLoading,
  });

  const stats = useMemo(() => {
    const totalIncome = monthlyFilteredTransactions
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + t.amount, 0);

    const totalExpenses = monthlyFilteredTransactions
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + t.amount, 0);

    const balance = totalIncome - totalExpenses;

    return { totalIncome, totalExpenses, balance };
  }, [monthlyFilteredTransactions]);

  const totalPaidMonthlyExpenses = useMemo(() => {
    return monthlyFilteredTransactions
      .filter((t) => t.type === "expense" && t.status === "Recebida")
      .reduce((sum, t) => sum + t.amount, 0);
  }, [monthlyFilteredTransactions]);

  const currentYear = getYear(selectedMonth);

  const totalAnnualExpenses = useMemo(() => {
    if (!allExpenseInstallments) return 0;
    return allExpenseInstallments
      .filter((p) => getYear(new Date(p.vencimento)) === currentYear)
      .reduce((sum, p) => sum + p.valor_parcela, 0);
  }, [allExpenseInstallments, currentYear]);

  const totalAnnualRevenues = useMemo(() => {
    if (!allRevenues) return 0;
    return allRevenues
      .filter((r) => getYear(new Date(r.data)) === currentYear)
      .reduce((sum, r) => sum + r.valor, 0);
  }, [allRevenues, currentYear]);

  const isLoading =
    authLoading ||
    isLoadingTransactionsData ||
    isLoadingAllRevenues ||
    isLoadingAllExpenses ||
    isLoadingCategories;

  const handlePreviousMonth = () => {
    setSelectedMonth((prev) => subMonths(prev, 1));
  };

  const handleNextMonth = () => {
    setSelectedMonth((prev) => addMonths(prev, 1));
  };

  const handleMonthClick = (date: Date) => {
    setSelectedMonth(date);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">
          Carregando Dashboard...
        </div>
      </div>
    );
  }

  const handleCalendarClick = () => {
    const formattedMonth = format(selectedMonth, "yyyy-MM-dd");
    navigate(`/lancamentos?month=${formattedMonth}`);
  };

  return (
    <div
      className={cn(
        "flex flex-col min-h-screen pt-16",
        isMobile && "bg-lancamentos-mobile-bg"
      )}
      style={{
        backgroundColor: "#F6FAFF",
      }}
    >
      <Navigation />
      <main
        className={cn(
          "container mx-auto",
          isMobile ? "pt-4 px-4" : "py-8 max-w-[1200px] px-6"
        )}
      >
        {!isMobile && (
          <h1 className="text-3xl font-bold mb-6">Dashboard Financeiro</h1>
        )}

        {isMobile ? (
          <div className="grid grid-cols-1 gap-4">
            <StatCard
              mainStatTitle="Total de Despesas"
              mainStatValue={stats.totalExpenses}
              secondaryStatTitle="Pago este mês"
              secondaryStatValue={totalPaidMonthlyExpenses}
              topRightContent={
                <MonthNavigatorCompact
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
                  onMonthClick={handleMonthClick}
                />
              }
              annualTotalLabel="Total Anual"
              annualTotalValue={totalAnnualExpenses}
              neumorphism={true}
            >
              <div className={cn("flex flex-col w-full h-full")}>
                <div className={cn("flex justify-end", isMobile && "mt-2")}>
                  <Button
                    className={cn(
                      "btn-3d",
                      "w-[160px] h-9 px-4 text-sm rounded-xl mb-1 mr-1 font-bold" // Changed w-auto to w-[160px]
                    )}
                    style={
                      {
                        "--cor-topo": "#FF6D6D",
                        "--cor-base": "#E85454",
                      } as React.CSSProperties
                    }
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
                <MonthNavigatorCompact
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
                  onMonthClick={handleMonthClick}
                />
              }
              annualTotalLabel="Total Anual"
              annualTotalValue={totalAnnualRevenues}
              neumorphism={true}
            >
              <div className={cn("flex flex-col w-full h-full")}>
                <div className={cn("flex justify-end", isMobile && "mt-2")}>
                  <Button
                    className={cn(
                      "btn-3d",
                      "w-[160px] h-9 px-4 text-sm rounded-xl mb-1 mr-1 font-bold" // Changed w-auto to w-[160px]
                    )}
                    style={
                      {
                        "--cor-topo": "#38C97C",
                        "--cor-base": "#26A765",
                      } as React.CSSProperties
                    }
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
              expenseInstallments={allExpenseInstallments}
              allCategories={allSubcategories}
              isMobile={isMobile}
              selectedMonth={selectedMonth}
            />
            <Footer
              isMobile={isMobile}
              className={cn(isMobile && "mt-[-2rem]")}
              user={user}
            />
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
                  <MonthNavigatorCompact
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
                    isMobile={true}
                    onMonthClick={handleMonthClick}
                  />
                }
                annualTotalLabel="Total Anual"
                annualTotalValue={totalAnnualRevenues}
                neumorphism={true}
              >
                <div className="flex justify-end mt-4">
                  <Button
                    className={cn(
                      "btn-3d",
                      "w-[160px] px-4 h-9 text-sm rounded-xl font-bold" // Consolidated px-3 and px-4 to just px-4, ensured w-auto
                    )}
                    style={
                      {
                        "--cor-topo": "#38C97C",
                        "--cor-base": "#26A765",
                      } as React.CSSProperties
                    }
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
                  <MonthNavigatorCompact
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
                    isMobile={true}
                    onMonthClick={handleMonthClick}
                  />
                }
                annualTotalLabel="Total Anual"
                annualTotalValue={totalAnnualExpenses}
                neumorphism={true}
              >
                <div className="flex justify-end mt-4">
                  <Button
                    className={cn(
                      "btn-3d",
                      "w-[160px] h-9 px-4 text-sm rounded-xl font-bold" // Consolidated px-3 and px-4 to just px-4, ensured w-auto
                    )}
                    style={
                      {
                        "--cor-topo": "#FF6D6D",
                        "--cor-base": "#E85454",
                      } as React.CSSProperties
                    }
                    onClick={() => navigate("/despesas")}
                  >
                    <DynamicIcon name="Plus" className="mr-2 h-4 w-4" />
                    Nova Despesa
                  </Button>
                </div>
              </StatCard>
            </div>

            <div className="grid grid-cols-1">
              <CombinedMonthlyExpensesDashboard
                allRevenues={allRevenues}
                allExpenseInstallments={allExpenseInstallments}
                allCategories={allSubcategories}
                isLoading={isLoading}
                isMobile={isMobile}
              />
            </div>

            <Card className="p-6 animate-slide-up rounded-xl shadow-sm">
              <p className={cn("text-muted-foreground", "font-roboto")}>
                Mais conteúdo do Dashboard virá aqui.
              </p>
            </Card>
            <Footer isMobile={isMobile} className="mt-8" user={user} />
          </>
        )}
      </main>
    </div>
  );
}