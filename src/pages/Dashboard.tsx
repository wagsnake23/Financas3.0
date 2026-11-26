import React, { useCallback, useMemo, useState, useEffect } from "react";
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
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  format,
  startOfMonth,
  endOfMonth,
  isWithinInterval,
  addMonths,
  subMonths,
  getYear,
  getMonth,
  differenceInBusinessDays,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn, formatCurrency, IndexadorHistorico, buildIndexadorMap } from "@/lib/utils";
import { useTransactionsData } from "@/hooks/useTransactionsData";
import { useCategories } from "@/hooks/useCategories";
import { useFinancialProjection } from "@/hooks/useFinancialProjection";
import { useProfile } from "@/hooks/useProfile";
import { MobileCreditCardExpenses } from "@/components/MobileCreditCardExpenses";
import { MonthBadge } from "@/components/MonthBadge";
import { CombinedMonthlyExpensesDashboard } from "@/components/CombinedMonthlyExpensesDashboard";
import { MonthlyExpenseBarChart } from "@/components/MonthlyExpenseBarChart";
import { MonthlyRevenueBarChart } from "@/components/MonthlyRevenueBarChart";
import { MonthlyBalanceBarChart } from "@/components/MonthlyBalanceBarChart";
import { MonthNavigatorCompact } from "@/components/MonthNavigatorCompact";
import { MonthlyYieldsBarChart } from "@/components/MonthlyYieldsBarChart"; // Importar MonthlyYieldsBarChart
import { RevenueByTypeChart } from "@/components/RevenueByTypeChart";
import { ProjectedYieldCard } from "@/components/ProjectedYieldCard";
import { MonthlyProjectedYieldChart } from "@/components/MonthlyProjectedYieldChart";
import { InvestmentsYieldChart } from "@/components/InvestmentsYieldChart";
import { WealthProjection } from "@/components/WealthProjection";
import { MonthlyEvolutionCard } from "@/components/MonthlyEvolutionCard";
import { Investment } from "@/types/finance";
import { useInvestmentsData } from "@/hooks/useInvestmentsData";
import { calcularCaixaAtual } from "@/lib/caixaAtual";

export default function Dashboard() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [searchParams, setSearchParams] = useSearchParams();
  const filter = searchParams.get("filter");

  useEffect(() => {
    const filter = searchParams.get("filter");
    if (filter === "expenses") {
      const el = document.getElementById("stat-expenses");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    } else if (filter === "revenues") {
      const el = document.getElementById("stat-revenues");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [searchParams]);

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
      return data.filter((r: any) => r.data !== '1900-01-01');
    },
    enabled: !!user,
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
          | "data_competencia"
        > | null;
      })[]
    >({
      queryKey: ["allExpenseInstallments", user?.id],
      queryFn: async () => {
        if (!user?.id) return [];
        const { data, error } = await supabase
          .from("despesas_parcelas")
          .select(
            "*, despesas(id, categoria_id, user_id, descricao, forma_pagamento, tipo_pagamento, cartao_id, is_recurring_master, numero_parcelas, data_competencia)"
          )
          .filter("despesas.user_id", "eq", user.id)
          .order("vencimento", { ascending: true });
        if (error) throw error;
        return data;
      },
      enabled: !!user,
    });

  // ── Fonte Única de Verdade para Investimentos ────────────────────────────
  // Reutiliza exatamente o mesmo hook do módulo Investimentos (FIFO por lote)
  const {
    investments,
    aportes,
    alocacoes: alocacoesResgates,
    resgates: resgatesInvestimentos,
    indexadores,
    indexadorMapCDI,
    indexadorMapIPCA,
    allSubcategories: investmentSubcategories,
    calculatedInvestments: calculatedInvestmentsFifo,
    stats: investmentStats,
    isLoading: isLoadingInvestments,
  } = useInvestmentsData();

  // Adaptar o formato FIFO para o formato esperado por WealthProjection e InvestmentsYieldChart
  // (que esperam: valorLiquido, taxaDiaria, rentabilidade, valorAtualVirtual)
  const calculatedInvestments = useMemo(() => {
    return calculatedInvestmentsFifo
      .filter((c) => c.investimento.status !== "resgatado")
      .map((c) => ({
        ...c.investimento,
        valorLiquido: c.saldoLiquidoTotal,
        valorAtualVirtual: c.saldoBrutoVirtualTotal,
        taxaDiaria: c.taxaDiariaPonderada,
        rentabilidade: c.rentabilidadeLiquidaAnual,
        rendimentoHojeVirtual: c.rendimentoHojeLiquidoTotal,
        rendimentoHojeLiquido: c.rendimentoHojeLiquidoTotal,
        rendimentoMesTotal: c.rendimentoMesTotal,
        rendimentoMesLiquidoTotal: c.rendimentoMesLiquidoTotal,
        tipoTributacao: c.investimento.tipo_rentabilidade,
        rendimentoBruto: c.rendimentoBrutoTotal,
        imposto: c.irProvisionadoTotal,
        rendimentoLiquido: c.rendimentoLiquidoTotal,
        aliquotaIR: 0,
      }));
  }, [calculatedInvestmentsFifo]);

  // currentYieldStats agora vem de investmentStats (fonte FIFO — mesma base do módulo Investimentos)
  const currentYieldStats = useMemo(() => ({
    totalCurrentBalance: investmentStats.totalCurrentBalance,
    totalInvested: investmentStats.totalInvested,
    avgProfitability: investmentStats.avgProfitability,
    avgMonthlyProfitability: investmentStats.avgMonthlyProfitability,
    totalDailyYieldRS: investmentStats.totalDailyYieldRS,
    monthYields: investmentStats.totalMonthlyYieldRS,
    annualYields: investmentStats.totalCurrentBalance * (investmentStats.avgProfitability / 100),
  }), [investmentStats]);

  // Global Balance Queries for "Saldo Atual" (Identical to Home.tsx)
  const { data: globalReceivedIncome = 0 } = useQuery({
    queryKey: ["globalReceivedIncome", user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      const { data, error } = await supabase
        .from("receitas")
        .select("valor")
        .eq("user_id", user.id)
        .eq("status", "Recebida");
      if (error) throw error;
      return data.reduce((sum, r) => sum + r.valor, 0);
    },
    enabled: !!user,
  });

  const { data: globalPaidExpenses = 0 } = useQuery({
    queryKey: ["globalPaidExpenses", user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      const { data, error } = await supabase
        .from("despesas_parcelas")
        .select("valor_parcela, despesas!inner(user_id)")
        .eq("despesas.user_id", user.id)
        .eq("pago", true);
      if (error) throw error;
      return data.reduce((sum, p) => sum + p.valor_parcela, 0);
    },
    enabled: !!user,
  });

  const { data: rawCategories = [] } = useCategories(user?.id);

  const {
    monthlyFilteredTransactions,
    fetchedCategories: allSubcategories,
    cartoes,
    isLoading: isLoadingTransactionsData,
    isLoadingCategories,
  } = useTransactionsData({
    user,
    selectedMonth,
    enabled: !!user,
  });

  // ── Centralized Financial Projection ─────────────────────────────────────
  const {
    getMonthlyExpenses,
    getMonthlyRevenues,
    getMonthlyBalance,
    getAnnualExpenses,
    getAnnualRevenues,
    getAnnualBalance,
    getMonthlyTrends,
    isMonthProjected,
  } = useFinancialProjection({
    user,
    allExpenseInstallments,
    allRevenues,
    enabled: !!user,
  });

  const selectedMonthStr = format(selectedMonth, "yyyy-MM");
  const prevMonthStr = format(subMonths(selectedMonth, 1), "yyyy-MM");

  const stats = useMemo(() => {
    const totalIncome = getMonthlyRevenues(selectedMonthStr);
    const totalExpenses = getMonthlyExpenses(selectedMonthStr);
    const balance = totalIncome - totalExpenses;
    return { totalIncome, totalExpenses, balance };
  }, [getMonthlyRevenues, getMonthlyExpenses, selectedMonthStr]);

  const monthlyTrends = useMemo(() => {
    return getMonthlyTrends(selectedMonthStr, prevMonthStr);
  }, [getMonthlyTrends, selectedMonthStr, prevMonthStr]);

  const totalPaidMonthlyExpenses = useMemo(() => {
    return monthlyFilteredTransactions
      .filter((t) => t.type === "expense" && t.status === "Recebida")
      .reduce((sum, t) => sum + t.amount, 0);
  }, [monthlyFilteredTransactions]);

  const totalReceivedMonthlyIncome = useMemo(() => {
    return monthlyFilteredTransactions
      .filter((t) => t.type === "income" && t.status === "Recebida")
      .reduce((sum, t) => sum + t.amount, 0);
  }, [monthlyFilteredTransactions]);

  const currentYear = getYear(selectedMonth);

  const totalAnnualExpenses = useMemo(() => {
    return getAnnualExpenses(currentYear);
  }, [getAnnualExpenses, currentYear]);

  const totalAnnualRevenues = useMemo(() => {
    return getAnnualRevenues(currentYear);
  }, [getAnnualRevenues, currentYear]);

  const overallBalance = useMemo(() => {
    const totalAllRevenues = getAnnualRevenues(currentYear);
    const totalAllExpenses = getAnnualExpenses(currentYear);
    return totalAllRevenues - totalAllExpenses;
  }, [allRevenues, allExpenseInstallments]);

  const totalOverallExpenses = useMemo(() => {
    return getMonthlyExpenses(selectedMonthStr);
  }, [allExpenseInstallments]);

  const { data: profile } = useProfile(user?.id);

  const saldoAtualEmConta = useMemo(() => {
    const { caixaAtualFinal } = calcularCaixaAtual({
      globalReceivedIncome: globalReceivedIncome || 0,
      globalPaidExpenses: globalPaidExpenses || 0,
      investimentos: investments || [],
      aportes: aportes || [],
      alocacoesResgates: alocacoesResgates || [],
      saldoAjusteManual: profile?.saldo_ajuste || 0,
    });
    return caixaAtualFinal;
  }, [globalReceivedIncome, globalPaidExpenses, investments, aportes, alocacoesResgates, profile?.saldo_ajuste]);

  const patrimonioBase = currentYieldStats.totalCurrentBalance + saldoAtualEmConta;

  const projecoesAcumuladas = useMemo(() => {
    let acumulado = 0;
    const firstProjectedMonth = startOfMonth(new Date());
    const end = startOfMonth(selectedMonth);
    
    if (end >= firstProjectedMonth) {
      let curr = firstProjectedMonth;
      while (curr <= end) {
        const mStr = format(curr, "yyyy-MM");
        const rev = getMonthlyRevenues(mStr);
        const exp = getMonthlyExpenses(mStr);
        acumulado += (rev - exp) + currentYieldStats.monthYields;
        curr = addMonths(curr, 1);
      }
    }
    return acumulado;
  }, [selectedMonth, getMonthlyRevenues, getMonthlyExpenses, currentYieldStats.monthYields]);

  const projecaoMensalTotal = currentYieldStats.monthYields + stats.balance;
  const patrimonioProjetado = patrimonioBase + projecoesAcumuladas;

  const selectedYear = getYear(selectedMonth);
  const selectedYearRevenues = getAnnualRevenues(selectedYear);
  const selectedYearExpenses = getAnnualExpenses(selectedYear);
  const projecaoAnual = (selectedYearRevenues - selectedYearExpenses) + currentYieldStats.annualYields;

  const projectedEndDate = useMemo(() => {
    if (allRevenues.length === 0 && allExpenseInstallments.length === 0) return "";

    const dates = [
      ...allRevenues.map((r) => new Date(r.data).getTime()),
      ...allExpenseInstallments.map((p) => new Date(p.vencimento).getTime()),
    ].filter((t) => !isNaN(t));

    if (dates.length === 0) return "";

    const maxDate = new Date(Math.max(...dates));
    return format(maxDate, "MMM/yyyy", { locale: ptBR })
      .replace(".", "")
      .toUpperCase();
  }, [allRevenues, allExpenseInstallments]);

  const isLoading =
    isLoadingTransactionsData ||
    isLoadingAllRevenues ||
    isLoadingAllExpenses ||
    isLoadingCategories ||
    isLoadingInvestments;

  const isInitialLoad =
    (isLoadingCategories && allSubcategories.length === 0) ||
    (isLoadingAllRevenues && allRevenues.length === 0) ||
    (isLoadingInvestments && investments.length === 0) ||
    (isLoadingAllExpenses && allExpenseInstallments.length === 0);

  const handlePreviousMonth = useCallback(() => {
    setSelectedMonth((prev) => subMonths(prev, 1));
  }, []);

  const handleNextMonth = useCallback(() => {
    setSelectedMonth((prev) => addMonths(prev, 1));
  }, []);

  const handleMonthClick = useCallback((date: Date) => {
    setSelectedMonth(date);
  }, []);



  const handleCalendarClick = () => {
    const formattedMonth = format(selectedMonth, "yyyy-MM-dd");
    navigate(`/lancamentos?month=${formattedMonth}`);
  };

  return (
    <div
      className={cn(
        "flex flex-col min-h-[100dvh] relative global-bg",
        isMobile ? "pt-[calc(3.5rem+env(safe-area-inset-top))]" : "pt-[72px]"
      )}
    >
      {isMobile && (
          <div
              className="absolute inset-0 z-10 pointer-events-none"
              style={{
                  background: "linear-gradient(180deg, #FAFAFA 0%, #FAFAFA 75%, #F8F9FB 88%, #FCFCFE 100%)"
              }}
          />
      )}
      {/* HEADER PREMIUM — FINTECH STYLE (DASHBOARD THEME) */}
      {!isMobile && !filter && (
        <div className="relative h-[160px] w-full overflow-hidden bg-transparent">
          <div className="container-app relative z-10 pt-[28px] md:pt-[42px] flex justify-between items-start">
            <div>
              <div className="flex items-start gap-3">
                <div
                  className="btn-3d btn-3d-icon p-2 rounded-xl flex items-center justify-center border-none cursor-default h-auto w-auto mt-1"
                  style={{ "--cor-topo": "#FFFFFF", "--cor-base": "#F1F5F9" } as any}
                >
                  <span className="text-xl select-none">📊</span>
                </div>
                <div className="flex flex-col">
                  <h1 className="text-2xl font-extrabold text-[#1e3a8a] tracking-[0.5px] -mt-0.5" style={{ fontFamily: "'Inter', sans-serif" }}>
                    Dashboard Financeiro
                  </h1>
                  <p className="text-sm font-bold text-slate-500 -mt-0.5 tracking-wider opacity-80">
                    Visão Geral das Finanças
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-1 font-bold text-sm !text-[#1e3a8a] hover:opacity-80 transition-colors bg-transparent border-none outline-none focus:outline-none shadow-none mt-2 pr-4 cursor-pointer"
            >
              <DynamicIcon name="ArrowLeft" className="h-[18px] w-[18px]" strokeWidth={2.5} />
              Voltar
            </button>
          </div>
        </div>
      )}

      <main
        className={cn(
          "container-app relative z-20 flex-grow",
          isMobile ? "pt-[2px] pb-2" : "pt-0 pb-8 -mt-6"
        )}
      >

        {filter === "investments" ? (
          <div className="flex flex-col gap-4 md:max-w-[1200px] md:mx-auto">
            {!isMobile ? (
              <>
                {/* Desktop Layout: Side-by-side Saldo and Cockpit */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
                  <StatCard dashboardPremiumStyle={true}
                    mainStatTitle="Saldo mensal"
                    mainStatValue={stats.balance}
                    topRightContent={
                      <MonthNavigatorCompact premiumMode={true}
                        selectedMonth={selectedMonth}
                        onPreviousMonth={handlePreviousMonth}
                        onNextMonth={handleNextMonth}
                        isMobile={isMobile}
                        variant="balance"
                      />
                    }
                    variant="balance"
                    isMobile={isMobile}
                    childrenAlignment="start"
                    chartContent={
                    <MonthlyBalanceBarChart
                      revenues={allRevenues}
                      expenseInstallments={allExpenseInstallments}
                      currentDate={selectedMonth}
                      isMobile={isMobile}
                      onMonthClick={handleMonthClick}
                      disablePattern={filter === 'investments'}
                    />
                    }
                    annualTotalValue={totalAnnualRevenues - totalAnnualExpenses}
                    annualTotalLabel="Saldo anual"
                    trend={monthlyTrends.balanceTrend}
                    trendIsPositive={monthlyTrends.balanceIsPositive}
                    icon="Wallet"
                    neumorphism={true}
                    className="card-saldo overflow-hidden h-full"
                    forceTransparentBackground={true}
                    >
                    <div className="h-12 md:h-[52px] w-full" />
                  </StatCard>

                  <div className="animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="rounded-[24px] p-6 shadow-sm h-full flex items-center border border-[rgba(15,23,42,0.10)]" style={{ backgroundColor: "#FFFFFF" }}>
                      <div className="grid grid-cols-2 items-center gap-x-8 gap-y-10 w-full">
                        {/* Total Investido */}
                        <div className="flex items-center justify-start gap-4">
                          <div
                            className="p-2.5 rounded-xl flex items-center justify-center bg-white shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
                            style={{ border: "1px solid rgba(0,0,0,0.04)" }}
                          >
                            <DynamicIcon name="DollarSign" className="h-5 w-5 text-[#0556C3]" strokeWidth={3} />
                          </div>
                          <div className="flex flex-col">
                            <h4 className="text-[10px] font-black text-[#0556C3] uppercase tracking-[0.2em] mb-1 leading-none">SALDO TOTAL</h4>
                            <p className="text-xl font-bold text-slate-700 tracking-tight leading-none">{formatCurrency(currentYieldStats.totalCurrentBalance)}</p>
                          </div>
                        </div>

                        {/* Rendimento Mensal */}
                        <div className="flex items-center justify-start gap-4 border-l border-[rgba(0,102,255,0.15)] h-10 pl-8">
                          <div
                            className="p-2.5 rounded-xl flex items-center justify-center bg-white shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
                            style={{ border: "1px solid rgba(0,0,0,0.04)" }}
                          >
                            <DynamicIcon name="Calendar" className="h-5 w-5 text-[#0556C3]" strokeWidth={3} />
                          </div>
                          <div className="flex flex-col">
                            <h4 className="text-[10px] font-black text-[#0556C3] uppercase tracking-[0.2em] mb-1 leading-none">MENSAL</h4>
                            <p className="text-xl font-bold text-slate-700 tracking-tight leading-none">{formatCurrency(currentYieldStats.monthYields)}</p>
                          </div>
                        </div>

                        {/* Rendimento Diário */}
                        <div className="flex items-center justify-start gap-4 h-10">
                          <div
                            className="p-2.5 rounded-xl flex items-center justify-center bg-white shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
                            style={{ border: "1px solid rgba(0,0,0,0.04)" }}
                          >
                            <DynamicIcon name="Clock" className="h-5 w-5 text-[#0556C3]" strokeWidth={3} />
                          </div>
                          <div className="flex flex-col">
                            <h4 className="text-[10px] font-black text-[#0556C3] uppercase tracking-[0.2em] mb-1 leading-none">DIÁRIO</h4>
                            <p className="text-xl font-bold text-slate-700 tracking-tight leading-none">{formatCurrency(currentYieldStats.totalDailyYieldRS)}</p>
                          </div>
                        </div>

                        {/* Rentabilidade Média Mensal */}
                        <div className="flex items-center justify-start gap-4 border-l border-[rgba(0,102,255,0.15)] h-10 pl-8">
                          <div
                            className="p-2.5 rounded-xl flex items-center justify-center bg-white shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
                            style={{ border: "1px solid rgba(0,0,0,0.04)" }}
                          >
                            <DynamicIcon name="Percent" className="h-5 w-5 text-[#0556C3]" strokeWidth={3} />
                          </div>
                          <div className="flex flex-col">
                            <h4 className="text-[10px] font-black text-[#0556C3] uppercase tracking-[0.2em] mb-1 leading-none">MÉDIA MENSAL</h4>
                            <div className="flex items-baseline gap-1">
                              <p className="text-xl font-bold text-slate-700 tracking-tight leading-none">{(currentYieldStats.avgMonthlyProfitability ?? 0).toFixed(2).replace('.', ',')}%</p>
                              <span className="text-[10px] font-black text-slate-500 uppercase">A.M.</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Full Width Wealth Projection */}
                <div className="w-full mb-4">
                  <WealthProjection
                    investments={calculatedInvestments}
                    isMobile={isMobile}
                  />
                </div>
              </>
            ) : (
              <>
                {/* Mobile Layout: Stacked elements */}
                {/* Saldo Mensal (Primeiro) */}
                <StatCard dashboardPremiumStyle={true}
                  mainStatTitle="Saldo mensal"
                  mainStatValue={stats.balance}
                  topRightContent={
                    <MonthNavigatorCompact premiumMode={true}
                      selectedMonth={selectedMonth}
                      onPreviousMonth={handlePreviousMonth}
                      onNextMonth={handleNextMonth}
                      isMobile={isMobile}
                      variant="balance"
                    />
                  }
                  variant="balance"
                  isMobile={isMobile}
                  childrenAlignment="start"
                  chartContent={
                    <MonthlyBalanceBarChart
                      revenues={allRevenues}
                      expenseInstallments={allExpenseInstallments}
                      currentDate={selectedMonth}
                      isMobile={isMobile}
                      onMonthClick={handleMonthClick}
                      getMonthlyExpensesFn={getMonthlyExpenses}
                      getMonthlyRevenuesFn={getMonthlyRevenues}
                      disablePattern={filter === 'investments'}
                    />
                  }
                  annualTotalLabel="Saldo anual"
                  annualTotalValue={totalAnnualRevenues - totalAnnualExpenses}
                  trend={monthlyTrends.balanceTrend}
                  trendIsPositive={monthlyTrends.balanceIsPositive}
                  icon="Wallet"
                  neumorphism={true}
                  className="card-saldo overflow-hidden"
                  forceTransparentBackground={true}
                >
                  <div className="h-12 md:h-[52px] w-full" />
                </StatCard>

                {/* 1. Projeção do Patrimônio */}
                <div className="mb-4">
                  <WealthProjection
                    investments={calculatedInvestments}
                    isMobile={isMobile}
                  />
                </div>

                {/* Evolução Mensal (IPCA x CDI x Meus Investimentos) */}
                <div className="mb-4">
                  <MonthlyEvolutionCard
                    indexadores={indexadores}
                    investments={investments}
                    aportes={aportes}
                    alocacoes={alocacoesResgates}
                    resgates={resgatesInvestimentos}
                    allSubcategories={investmentSubcategories}
                    indexadorMapCDI={indexadorMapCDI}
                    indexadorMapIPCA={indexadorMapIPCA}
                    selectedMonth={selectedMonth}
                    onPreviousMonth={handlePreviousMonth}
                    onNextMonth={handleNextMonth}
                    onSelectMonth={handleMonthClick}
                    isLoading={isLoadingInvestments}
                    isMobile={isMobile}
                  />
                </div>

                {/* 4. Card de Resumo (Investment Cockpit) */}
                <div className="animate-in fade-in slide-in-from-top-4 duration-500">
                  <div className="py-6 px-[22px] shadow-sm rounded-[18px] border border-[rgba(15,23,42,0.10)]" style={{ backgroundColor: "#FFFFFF" }}>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-7">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2 mb-2">
                          <div
                            className="p-2 rounded-xl flex items-center justify-center shadow-[0_2px_8px_rgba(5,86,195,0.3)]"
                            style={{ background: "#0556C3" }}
                          >
                            <DynamicIcon name="DollarSign" className="h-3.5 w-3.5 text-white" strokeWidth={3} />
                          </div>
                          <h4 className="text-[11px] font-bold text-[#0556C3] tracking-widest leading-none">SALDO TOTAL</h4>
                        </div>
                        <p className="text-lg font-bold text-slate-700 tracking-tight leading-none">{formatCurrency(currentYieldStats.totalCurrentBalance)}</p>
                      </div>

                      <div className="flex flex-col items-end text-right">
                        <div className="flex flex-row-reverse items-center gap-2 mb-2">
                          <div
                            className="p-2 rounded-xl flex items-center justify-center shadow-[0_2px_8px_rgba(5,86,195,0.3)]"
                            style={{ background: "#0556C3" }}
                          >
                            <DynamicIcon name="Percent" className="h-3.5 w-3.5 text-white" strokeWidth={3} />
                          </div>
                          <h4 className="text-[11px] font-bold text-[#0556C3] tracking-widest leading-none">MÉDIA MENSAL</h4>
                        </div>
                        <div className="flex items-baseline gap-0.5">
                          <p className="text-lg font-bold text-slate-700 tracking-tight leading-none">{(currentYieldStats.avgMonthlyProfitability ?? 0).toFixed(2).replace('.', ',')}%</p>
                          <span className="text-[8px] font-black text-gray-500 uppercase">A.M.</span>
                        </div>
                      </div>

                      <div className="flex flex-col">
                        <div className="flex items-center gap-2 mb-2">
                          <div
                            className="p-2 rounded-xl flex items-center justify-center shadow-[0_2px_8px_rgba(5,86,195,0.3)]"
                            style={{ background: "#0556C3" }}
                          >
                            <DynamicIcon name="Calendar" className="h-3.5 w-3.5 text-white" strokeWidth={3} />
                          </div>
                          <h4 className="text-[11px] font-bold text-[#0556C3] tracking-widest leading-none">MENSAL</h4>
                        </div>
                        <p className="text-lg font-bold text-slate-700 tracking-tight leading-none">{formatCurrency(currentYieldStats.monthYields)}</p>
                      </div>

                      <div className="flex flex-col items-end text-right">
                        <div className="flex flex-row-reverse items-center gap-2 mb-2">
                          <div
                            className="p-2 rounded-xl flex items-center justify-center shadow-[0_2px_8px_rgba(5,86,195,0.3)]"
                            style={{ background: "#0556C3" }}
                          >
                            <DynamicIcon name="Clock" className="h-3.5 w-3.5 text-white" strokeWidth={3} />
                          </div>
                          <h4 className="text-[11px] font-bold text-[#0556C3] tracking-widest leading-none">DIÁRIO</h4>
                        </div>
                        <p className="text-lg font-bold text-slate-700 tracking-tight leading-none">{formatCurrency(currentYieldStats.totalDailyYieldRS)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        ) : isMobile ? (
          <div className="grid grid-cols-1 gap-4">
            {(!filter || filter === "expenses") && (
              <StatCard dashboardPremiumStyle={true}
                id="stat-expenses"
                mainStatTitle="Despesas totais"
                mainStatValue={stats.totalExpenses}

                topRightContent={
                  <MonthNavigatorCompact premiumMode={true}
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
                childrenAlignment="end"
                chartContent={
                  <MonthlyExpenseBarChart
                    expenseInstallments={allExpenseInstallments}
                    currentDate={selectedMonth}
                    isMobile={isMobile}
                    onMonthClick={handleMonthClick}
                    getMonthlyExpensesFn={getMonthlyExpenses}
                    isMonthProjectedFn={isMonthProjected}
                  />
                }
                annualTotalLabel="Total anual"
                annualTotalValue={totalAnnualExpenses}
                neumorphism={true}
                trend={monthlyTrends.expenseTrend}
                trendIsPositive={monthlyTrends.expenseIsPositive}
                className="card-despesas overflow-hidden"
                forceTransparentBackground={true}
                secondaryStatTitle="Pago este mês"
                secondaryStatValue={totalPaidMonthlyExpenses}
              >

                <div className="h-12 md:h-[52px] w-full" />
              </StatCard>
            )}

            {(!filter || filter === "revenues") && (
              <StatCard dashboardPremiumStyle={true}
                id="stat-revenues"
                mainStatTitle="Receitas totais"
                mainStatValue={stats.totalIncome}

                topRightContent={
                  <MonthNavigatorCompact premiumMode={true}
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
                childrenAlignment="end"
                chartContent={
                  <MonthlyRevenueBarChart
                    revenues={allRevenues}
                    currentDate={selectedMonth}
                    isMobile={isMobile}
                    onMonthClick={handleMonthClick}
                    getMonthlyRevenuesFn={getMonthlyRevenues}
                  />
                }
                annualTotalLabel="Receita anual"
                annualTotalValue={totalAnnualRevenues}
                neumorphism={true}
                trend={monthlyTrends.incomeTrend}
                trendIsPositive={monthlyTrends.incomeIsPositive}
                className="card-receitas overflow-hidden"
                forceTransparentBackground={true}
                secondaryStatTitle="Receita atual"
                secondaryStatValue={totalReceivedMonthlyIncome}
              >

                <div className="h-12 md:h-[52px] w-full" />
              </StatCard>
            )}



            {!filter && (
              <StatCard dashboardPremiumStyle={true}
                mainStatTitle="Saldo mensal"
                mainStatValue={stats.balance}
                topRightContent={
                  <MonthNavigatorCompact premiumMode={true}
                    selectedMonth={selectedMonth}
                    onPreviousMonth={handlePreviousMonth}
                    onNextMonth={handleNextMonth}
                    isMobile={isMobile}
                    variant="balance"
                  />
                }
                variant="balance"
                isMobile={isMobile}
                childrenAlignment="start"
                chartContent={
                  <MonthlyBalanceBarChart
                    revenues={allRevenues}
                    expenseInstallments={allExpenseInstallments}
                    currentDate={selectedMonth}
                    isMobile={isMobile}
                    onMonthClick={handleMonthClick}
                    getMonthlyExpensesFn={getMonthlyExpenses}
                    getMonthlyRevenuesFn={getMonthlyRevenues}
                    disablePattern={filter === 'investments'}
                  />
                }
                trend={monthlyTrends.balanceTrend}
                trendIsPositive={monthlyTrends.balanceIsPositive}
                annualTotalLabel="Saldo anual"
                annualTotalValue={totalAnnualRevenues - totalAnnualExpenses}
                icon="Wallet"
                neumorphism={true}
                className="card-saldo overflow-hidden"
                forceTransparentBackground={true}
              >
                <div className="h-12 md:h-[52px] w-full" />
              </StatCard>
            )}



            {!filter && (
              <ProjectedYieldCard
                mainStatValue={projecaoMensalTotal}
                projectedPatrimonyValue={patrimonioProjetado}
                projectedPatrimonyLabel="Patrimônio Projetado"
                annualTotalValue={projecaoAnual}
                annualTotalLabel="Projeção anual"
                isMobile={isMobile}
                topRightContent={
                  <MonthNavigatorCompact premiumMode={true}
                    selectedMonth={selectedMonth}
                    onPreviousMonth={handlePreviousMonth}
                    onNextMonth={handleNextMonth}
                    isMobile={isMobile}
                    variant="balance"
                  />
                }
                chartContent={
                  <MonthlyProjectedYieldChart
                    revenues={allRevenues}
                    expenseInstallments={allExpenseInstallments}
                    currentDate={selectedMonth}
                    projectedMonthlyYield={currentYieldStats.monthYields}
                    isMobile={isMobile}
                    onMonthClick={(date) => {
                      setSelectedMonth(date);
                      const el = document.getElementById("stat-expenses");
                      if (el) el.scrollIntoView({ behavior: "smooth" });
                    }}
                  />
                }
              />
            )}

            {isMobile && (!filter || filter === "revenues") && (
              <>
                <RevenueByTypeChart
                  revenues={allRevenues.filter(r =>
                    isWithinInterval(new Date(r.data), {
                      start: startOfMonth(selectedMonth),
                      end: endOfMonth(selectedMonth)
                    })
                  )}
                  revenueTypes={allSubcategories}
                  isMobile={true}
                />
                <InvestmentsYieldChart
                  investments={calculatedInvestments}
                  allSubcategories={rawCategories}
                  isMobile={isMobile}
                />
              </>
            )}

            {(!filter || filter === "expenses") && (
              <CombinedMonthlyExpensesDashboard
                allRevenues={allRevenues}
                allExpenseInstallments={allExpenseInstallments}
                allCategories={allSubcategories}
                isLoading={isLoading}
                isMobile={isMobile}
              />
            )}

            {!filter && (
              <WealthProjection
                investments={calculatedInvestments}
                isMobile={isMobile}
              />
            )}

            {!filter && (
              <MonthlyEvolutionCard
                indexadores={indexadores}
                investments={investments}
                aportes={aportes}
                alocacoes={alocacoesResgates}
                resgates={resgatesInvestimentos}
                allSubcategories={investmentSubcategories}
                indexadorMapCDI={indexadorMapCDI}
                indexadorMapIPCA={indexadorMapIPCA}
                selectedMonth={selectedMonth}
                onPreviousMonth={handlePreviousMonth}
                onNextMonth={handleNextMonth}
                onSelectMonth={handleMonthClick}
                isLoading={isLoadingInvestments}
                isMobile={isMobile}
              />
            )}
          </div>
        ) : (
          <>
            <div className={cn("grid gap-4 mb-4", "grid-cols-1 md:grid-cols-2")}>
              {(!filter || filter === "expenses") && (
                <StatCard dashboardPremiumStyle={true}
                  mainStatTitle="Despesas totais"
                  mainStatValue={stats.totalExpenses}
                  icon="TrendingDown"
                  variant="expense"
                  isMobile={isMobile}
                  trend={monthlyTrends.expenseTrend}
                  trendIsPositive={monthlyTrends.expenseIsPositive}
                  topRightContent={
                    <MonthNavigatorCompact premiumMode={true}
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
                      isMobile={false}
                      onMonthClick={handleMonthClick}
                      getMonthlyExpensesFn={getMonthlyExpenses}
                      isMonthProjectedFn={isMonthProjected}
                    />
                  }
                  annualTotalLabel="Total anual"
                  annualTotalValue={totalAnnualExpenses}
                  neumorphism={true}
                  secondaryStatTitle="Pago este mês"
                  secondaryStatValue={totalPaidMonthlyExpenses}
                >
                  <div className="h-12 md:h-[52px] w-full" />
                </StatCard>
              )}

              {(!filter || filter === "revenues") && (
                <StatCard dashboardPremiumStyle={true}
                  id="stat-revenues"
                  mainStatTitle="Receitas totais"
                  mainStatValue={stats.totalIncome}
                  icon="TrendingUp"
                  variant="income"
                  isMobile={isMobile}
                  trend={monthlyTrends.incomeTrend}
                  trendIsPositive={monthlyTrends.incomeIsPositive}
                  topRightContent={
                    <MonthNavigatorCompact premiumMode={true}
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
                      isMobile={false}
                      onMonthClick={handleMonthClick}
                      getMonthlyRevenuesFn={getMonthlyRevenues}
                    />
                  }
                  annualTotalLabel="Receita anual"
                  annualTotalValue={totalAnnualRevenues}
                  neumorphism={true}
                  secondaryStatTitle="Receita atual"
                  secondaryStatValue={totalReceivedMonthlyIncome}
                >
                  <div className="h-12 md:h-[52px] w-full" />
                </StatCard>
              )}

              {!filter && (
                <StatCard dashboardPremiumStyle={true}
                  mainStatTitle="Saldo mensal"
                  mainStatValue={stats.balance}
                  trend={monthlyTrends.balanceTrend}
                  trendIsPositive={monthlyTrends.balanceIsPositive}
                  topRightContent={
                    <MonthNavigatorCompact premiumMode={true}
                      selectedMonth={selectedMonth}
                      onPreviousMonth={handlePreviousMonth}
                      onNextMonth={handleNextMonth}
                      isMobile={isMobile}
                      variant="balance"
                    />
                  }
                  variant="balance"
                  isMobile={isMobile}
                  chartContent={
                    <MonthlyBalanceBarChart
                      revenues={allRevenues}
                      expenseInstallments={allExpenseInstallments}
                      currentDate={selectedMonth}
                      isMobile={false}
                      onMonthClick={handleMonthClick}
                      disablePattern={filter === 'investments'}
                    />
                  }
                  annualTotalValue={totalAnnualRevenues - totalAnnualExpenses}
                  annualTotalLabel="Saldo anual"
                  icon="Wallet"
                  neumorphism={true}
                >
                  <div className="h-12 md:h-[52px] w-full" />
                </StatCard>
              )}



              {!filter && (
                <ProjectedYieldCard
                  mainStatValue={projecaoMensalTotal}
                  projectedPatrimonyValue={patrimonioProjetado}
                  projectedPatrimonyLabel="Patrimônio Projetado"
                  annualTotalValue={projecaoAnual}
                  annualTotalLabel="Projeção anual"
                  isMobile={isMobile}
                  topRightContent={
                    <MonthNavigatorCompact premiumMode={true}
                      selectedMonth={selectedMonth}
                      onPreviousMonth={handlePreviousMonth}
                      onNextMonth={handleNextMonth}
                      isMobile={isMobile}
                      variant="balance"
                    />
                  }
                  chartContent={
                    <MonthlyProjectedYieldChart
                      revenues={allRevenues}
                      expenseInstallments={allExpenseInstallments}
                      currentDate={selectedMonth}
                      projectedMonthlyYield={currentYieldStats.monthYields}
                      isMobile={isMobile}
                      onMonthClick={(date) => {
                        setSelectedMonth(date);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                    />
                  }
                />
              )}
            </div>

            {(!filter || filter === "revenues") && (
              <div className={cn("grid gap-4 mb-4", "grid-cols-1 md:grid-cols-2")}>
                <RevenueByTypeChart
                  revenues={allRevenues.filter(r =>
                    isWithinInterval(new Date(r.data), {
                      start: startOfMonth(selectedMonth),
                      end: endOfMonth(selectedMonth)
                    })
                  )}
                  revenueTypes={allSubcategories}
                  isMobile={isMobile}
                />
                <InvestmentsYieldChart
                  investments={calculatedInvestments}
                  allSubcategories={rawCategories}
                  isMobile={isMobile}
                />
              </div>
            )}

            {(!filter || filter === "expenses") && (
              <div className="grid grid-cols-1">
                <CombinedMonthlyExpensesDashboard
                  allRevenues={allRevenues}
                  allExpenseInstallments={allExpenseInstallments}
                  allCategories={allSubcategories}
                  isLoading={isLoading}
                  isMobile={isMobile}
                />
              </div>
            )}

            {!filter && (
              <div className="mt-8">
                <WealthProjection
                  investments={calculatedInvestments}
                  isMobile={isMobile}
                />
              </div>
            )}


          </>
        )}
      </main>
      <Footer
        isMobile={isMobile}
        className={cn(isMobile ? "mt-0 mb-2 bg-transparent" : "mt-8")}
        user={user}
      />
    </div>
  );
}
