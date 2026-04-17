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
import { cn, formatCurrency, getAliquotaIR } from "@/lib/utils";
import { useTransactionsData } from "@/hooks/useTransactionsData";
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
import { YearNavigatorCompact } from "@/components/YearNavigatorCompact";
import { InvestmentsYieldChart } from "@/components/InvestmentsYieldChart";
import { WealthProjection } from "@/components/WealthProjection";
import { Investment } from "@/types/finance";

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
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

  // Fetch investments
  const { data: investments = [], isLoading: isLoadingInvestments } = useQuery<Investment[]>({
    queryKey: ["investments", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("investimentos")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Investment[];
    },
    enabled: !!user && !authLoading,
  });

  // Fetch active indexers (CDI/IPCA)
  const { data: indexadores = [] } = useQuery({
    queryKey: ["indexadores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("indexadores")
        .select("*")
        .is("data_fim", null);
      if (error) throw error;
      return data;
    },
  });

  const cdi = useMemo(() => indexadores.find(i => i.tipo === "CDI")?.taxa_anual || 10.65, [indexadores]);
  const ipca = useMemo(() => indexadores.find(i => i.tipo === "IPCA")?.taxa_anual || 5.0, [indexadores]);

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

  const totalReceivedMonthlyIncome = useMemo(() => {
    return monthlyFilteredTransactions
      .filter((t) => t.type === "income" && t.status === "Recebida")
      .reduce((sum, t) => sum + t.amount, 0);
  }, [monthlyFilteredTransactions]);

  const currentYear = getYear(selectedMonth);

  const totalAnnualExpenses = useMemo(() => {
    if (!allExpenseInstallments) return 0;
    return allExpenseInstallments
      .filter((p) => Number(p.vencimento.substring(0, 4)) === currentYear)
      .reduce((sum, p) => sum + p.valor_parcela, 0);
  }, [allExpenseInstallments, currentYear]);

  const totalAnnualRevenues = useMemo(() => {
    if (!allRevenues) return 0;
    return allRevenues
      .filter((r) => Number(r.data.substring(0, 4)) === currentYear)
      .reduce((sum, r) => sum + r.valor, 0);
  }, [allRevenues, currentYear]);

  const overallBalance = useMemo(() => {
    const totalAllRevenues = allRevenues.reduce((sum, r) => sum + r.valor, 0);
    const totalAllExpenses = allExpenseInstallments.reduce((sum, p) => sum + p.valor_parcela, 0);
    return totalAllRevenues - totalAllExpenses;
  }, [allRevenues, allExpenseInstallments]);

  const totalOverallExpenses = useMemo(() => {
    return allExpenseInstallments.reduce((sum, p) => sum + p.valor_parcela, 0);
  }, [allExpenseInstallments]);

  const calculatedInvestments = useMemo(() => {
    return investments.map((inv: Investment) => {
      // Calculate total profitability for indexed investments (Gross)
      let taxaAnual = inv.tipo_rentabilidade === "fixo" ? (inv.taxa_fixa || 0) : 0;
      if (inv.tipo_rentabilidade === "indexado") {
        const taxaBase = inv.indexador === "CDI" ? cdi : ipca;
        taxaAnual = (taxaBase * (inv.percentual_indexador || 0) / 100) + (inv.taxa_adicional || 0);
      }

      // 1. Taxa diária: (1 + (taxa_anual / 100))^(1 / 252) - 1
      const taxaDiaria = Math.pow(1 + (taxaAnual / 100), 1 / 252) - 1;

      // 2. Dias úteis passados
      const [year, month, day] = (inv.data as string).split('-').map(Number);
      const investDate = new Date(year, month - 1, day);
      investDate.setHours(0, 0, 0, 0);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // differenceInBusinessDays returns the number of full business days between dates
      const diasUteis = differenceInBusinessDays(today, investDate);

      // 3. Valor atual virtual: valor_inicial × (1 + taxa_diaria)^(dias_uteis_passados)
      const valorAtualVirtual = inv.valor * Math.pow(1 + taxaDiaria, Math.max(0, diasUteis));

      // 4. Rendimento de hoje líquido: (valor_atual × taxa_diaria) × (1 - IR/100)
      const aliquotaIR = getAliquotaIR(investDate);
      const rendimentoHojeVirtual = (valorAtualVirtual * taxaDiaria) * (1 - aliquotaIR / 100);

      return {
        ...inv,
        rentabilidade: taxaAnual, // Annual Gross
        valorAtualVirtual,
        rendimentoHojeVirtual,
        taxaDiaria
      };
    });
  }, [investments, cdi, ipca]);

  // Yields calculation
  const totalProjectedAnnualYield = useMemo(() => {
    const rawTotal = calculatedInvestments.reduce((sum, inv) => {
      const annualRateDecimal = inv.rentabilidade / 100;
      const dailyRate = Math.pow(1 + annualRateDecimal, 1 / 252) - 1;
      const dailyRateTruncated = Math.trunc(dailyRate * 1e10) / 1e10;
      const annualRateDerived = Math.pow(1 + dailyRateTruncated, 252) - 1;
      return sum + (inv.valorAtualVirtual * annualRateDerived);
    }, 0);

    // Arredondamento Bancário (Round Half Even) para 2 casas
    const m = 100;
    const n = +(rawTotal * m).toFixed(8);
    const i = Math.floor(n);
    const f = n - i;
    const e = 1e-8;
    const rounded = (f > 0.5 - e && f < 0.5 + e)
      ? (i % 2 === 0 ? i : i + 1)
      : Math.round(n);

    return rounded / m;
  }, [calculatedInvestments]);

  const totalInvested = useMemo(() => {
    return investments.reduce((sum, inv) => sum + inv.valor, 0);
  }, [investments]);

  const currentYieldStats = useMemo(() => {
    const totalCurrentBalance = calculatedInvestments.reduce((sum, inv) => sum + inv.valorAtualVirtual, 0);

    if (totalInvested === 0) return { monthYields: 0, annualYields: 0, totalInvested: 0, totalCurrentBalance: 0, avgProfitability: 0, totalDailyYieldRS: 0 };

    // taxa_anual_ponderada = Σ (valor_atual × (rentabilidade / 100)) ÷ Σ valor_atual
    const weightedSum = calculatedInvestments.reduce((sum, inv) => sum + (inv.valorAtualVirtual * (inv.rentabilidade / 100)), 0);
    const taxaAnualPonderada = weightedSum / totalCurrentBalance;
    const avgProfitability = taxaAnualPonderada * 100;

    // Rendimento Diário e Mensal com base em 252 e 21 dias úteis
    const dailyRate = Math.pow(1 + taxaAnualPonderada, 1 / 252) - 1;
    const dailyRateTruncated = Math.trunc(dailyRate * 1e10) / 1e10;

    // Rendimento Diário Total (R$) - Sum of virtual daily yields
    const totalDailyYieldRS = calculatedInvestments.reduce((sum, inv) => sum + inv.rendimentoHojeVirtual, 0);

    // Rendimento Mensal: juros compostos com base em 21 dias úteis
    const taxaMensal = Math.pow(1 + dailyRateTruncated, 21) - 1;
    const rawMonthYield = totalCurrentBalance * taxaMensal;

    // Arredondamento Bancário para o rendimento mensal
    const m = 100;
    const nm = +(rawMonthYield * m).toFixed(8);
    const im = Math.floor(nm);
    const fm = nm - im;
    const e = 1e-8;
    const monthRounded = (fm > 0.5 - e && fm < 0.5 + e)
      ? (im % 2 === 0 ? im : im + 1)
      : Math.round(nm);

    return {
      monthYields: monthRounded / m,
      annualYields: totalProjectedAnnualYield,
      totalInvested,
      totalCurrentBalance,
      avgProfitability,
      totalDailyYieldRS
    };
  }, [totalProjectedAnnualYield, totalInvested, calculatedInvestments]);

  const [projectedYear, setProjectedYear] = useState(getYear(new Date()));

  useEffect(() => {
    setProjectedYear(getYear(selectedMonth));
  }, [selectedMonth]);

  const projectedYearValues = useMemo(() => {
    const startYear = getYear(new Date());
    const endYear = projectedYear;

    let cumulativeBalance = 0;

    // Calculate cumulative balance from current year up to projectedYear
    // Only if endYear >= startYear, otherwise just use current year
    const rangeEnd = Math.max(startYear, endYear);

    for (let year = startYear; year <= rangeEnd; year++) {
      const yearRevs = allRevenues
        .filter((r) => Number(r.data.substring(0, 4)) === year)
        .reduce((sum, r) => sum + r.valor, 0);

      const yearExps = allExpenseInstallments
        .filter((p) => Number(p.vencimento.substring(0, 4)) === year)
        .reduce((sum, p) => sum + p.valor_parcela, 0);

      const yearBalance = (yearRevs - yearExps) + currentYieldStats.annualYields;
      cumulativeBalance += yearBalance;
    }

    // Still need the specific values for the selected endYear to show in the card's main stats
    const revs = allRevenues
      .filter((r) => Number(r.data.substring(0, 4)) === endYear)
      .reduce((sum, r) => sum + r.valor, 0);

    const exps = allExpenseInstallments
      .filter((p) => Number(p.vencimento.substring(0, 4)) === endYear)
      .reduce((sum, p) => sum + p.valor_parcela, 0);

    const monthlyProjection = (revs - exps) / 12 + currentYieldStats.monthYields;
    const annualBalance = (revs - exps) + currentYieldStats.annualYields;
    const projectedPatrimony = currentYieldStats.totalCurrentBalance + cumulativeBalance;

    return {
      monthlyProjection,
      annualBalance,
      projectedPatrimony,
      revenues: revs,
      expenses: exps
    };
  }, [allRevenues, allExpenseInstallments, projectedYear, currentYieldStats]);

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
    authLoading ||
    isLoadingTransactionsData ||
    isLoadingAllRevenues ||
    isLoadingAllExpenses ||
    isLoadingCategories ||
    isLoadingInvestments; // Adicionado isLoadingInvestments

  const isInitialLoad =
    authLoading ||
    (isLoadingCategories && allSubcategories.length === 0) ||
    (isLoadingAllRevenues && allRevenues.length === 0) ||
    (isLoadingInvestments && investments.length === 0) || // Adicionado isLoadingInvestments
    (isLoadingAllExpenses && allExpenseInstallments.length === 0);

  const handlePreviousMonth = () => {
    setSelectedMonth((prev) => subMonths(prev, 1));
  };

  const handleNextMonth = () => {
    setSelectedMonth((prev) => addMonths(prev, 1));
  };

  const handleMonthClick = (date: Date) => {
    setSelectedMonth(date);
  };

  if (isInitialLoad) {
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
        isMobile ? "bg-white" : "bg-[#F6FAFF]"
      )}
    >
      <Navigation />
      <main
        className={cn(
          "container mx-auto flex-grow",
          isMobile ? "pt-4 px-4 pb-16" : "py-8 max-w-[1200px] px-6"
        )}
      >
        {!isMobile && !filter && (
          <h1 className="text-3xl font-bold mb-6">Dashboard Financeiro</h1>
        )}

        {filter === "investments" ? (
          <div className="flex flex-col gap-4 md:max-w-[1200px] md:mx-auto">
            {!isMobile ? (
              <>
                {/* Desktop Layout: Side-by-side Saldo and Cockpit */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
                  <StatCard
                    mainStatTitle="Saldo Mensal"
                    mainStatValue={stats.balance}
                    topRightContent={
                      <MonthNavigatorCompact
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
                        isMobile={true}
                        onMonthClick={handleMonthClick}
                      />
                    }
                    annualTotalValue={totalAnnualRevenues - totalAnnualExpenses}
                    icon="Wallet"
                    neumorphism={true}
                    className="card-saldo overflow-hidden h-full"
                    forceTransparentBackground={true}
                    >
                    <div className="h-12 md:h-[52px] w-full" />
                  </StatCard>

                  {/* Investment Cockpit - Replaced with Investments Module design - Using 2/3 of space on large screens */}
                  <div className="lg:col-span-2 animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="card-receitas border-none rounded-[32px] p-8 shadow-sm h-full flex items-center">
                      <div className="grid grid-cols-2 xl:grid-cols-4 items-center gap-x-8 gap-y-10 w-full">
                        {/* Total Investido */}
                        <div className="flex items-center gap-4">
                          <div
                            className="btn-3d p-3 rounded-2xl shadow-sm border-none flex items-center justify-center"
                            style={{ "--cor-topo": "#1AA361", "--cor-base": "#15803d" } as any}
                          >
                            <DynamicIcon name="DollarSign" className="h-6 w-6 text-white" strokeWidth={3} />
                          </div>
                          <div className="flex flex-col">
                            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1 leading-none">Saldo Atual</h4>
                            <p className="text-xl font-bold text-slate-700 tracking-tight leading-none">{formatCurrency(currentYieldStats.totalCurrentBalance)}</p>
                          </div>
                        </div>

                        {/* Rendimento Mensal */}
                        <div className="flex items-center lg:justify-center gap-4 border-l border-success/10 h-10">
                          <div
                            className="btn-3d p-2.5 rounded-xl shadow-sm border-none flex items-center justify-center"
                            style={{ "--cor-topo": "#1AA361", "--cor-base": "#15803d" } as any}
                          >
                            <DynamicIcon name="Calendar" className="h-5 w-5 text-white" strokeWidth={3} />
                          </div>
                          <div className="flex flex-col">
                            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1 leading-none">Mensal</h4>
                            <p className="text-xl font-bold text-slate-700 tracking-tight leading-none">{formatCurrency(currentYieldStats.monthYields)}</p>
                          </div>
                        </div>

                        {/* Rendimento Diário */}
                        <div className="flex items-center lg:justify-center gap-4 border-l border-success/10 h-10">
                          <div
                            className="btn-3d p-2.5 rounded-xl shadow-sm border-none flex items-center justify-center"
                            style={{ "--cor-topo": "#1AA361", "--cor-base": "#15803d" } as any}
                          >
                            <DynamicIcon name="Clock" className="h-5 w-5 text-white" strokeWidth={3} />
                          </div>
                          <div className="flex flex-col">
                            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1 leading-none">Diário</h4>
                            <p className="text-xl font-bold text-slate-700 tracking-tight leading-none">{formatCurrency(currentYieldStats.totalDailyYieldRS)}</p>
                          </div>
                        </div>

                        {/* Rentabilidade Média */}
                        <div className="flex flex-row-reverse items-center gap-4 border-l border-success/10 h-10">
                          <div
                            className="btn-3d p-3 rounded-2xl shadow-sm border-none flex items-center justify-center"
                            style={{ "--cor-topo": "#1AA361", "--cor-base": "#15803d" } as any}
                          >
                            <DynamicIcon name="Percent" className="h-6 w-6 text-white" strokeWidth={3} />
                          </div>
                          <div className="flex flex-col items-end">
                            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1 leading-none">Média</h4>
                            <div className="flex items-baseline gap-1">
                              <p className="text-xl font-bold text-slate-700 tracking-tight leading-none">{currentYieldStats.avgProfitability.toFixed(2)}%</p>
                              <span className="text-[10px] font-black text-gray-500 uppercase">a.a.</span>
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
                <StatCard
                  mainStatTitle="Saldo Mensal"
                  mainStatValue={stats.balance}
                  topRightContent={
                    <MonthNavigatorCompact
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
                      isMobile={true}
                      onMonthClick={handleMonthClick}
                    />
                  }
                  annualTotalLabel="Saldo Anual"
                  annualTotalValue={totalAnnualRevenues - totalAnnualExpenses}
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

                {/* 4. Card de Resumo (Investment Cockpit) */}
                <div className="animate-in fade-in slide-in-from-top-4 duration-500">
                  <div className="card-receitas p-6 shadow-[0_12px_28px_rgba(0,0,0,0.08)] rounded-[24px]">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-7">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2 mb-2">
                          <div
                            className="btn-3d p-2 rounded-xl shadow-sm border-none flex items-center justify-center"
                            style={{ "--cor-topo": "#1AA361", "--cor-base": "#15803d" } as any}
                          >
                            <DynamicIcon name="DollarSign" className="h-3.5 w-3.5 text-white" strokeWidth={3} />
                          </div>
                          <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Saldo Atual</h4>
                        </div>
                        <p className="text-lg font-bold text-slate-700 tracking-tight leading-none">{formatCurrency(currentYieldStats.totalCurrentBalance)}</p>
                      </div>

                      <div className="flex flex-col items-end text-right">
                        <div className="flex flex-row-reverse items-center gap-2 mb-2">
                          <div
                            className="btn-3d p-2 rounded-xl shadow-sm border-none flex items-center justify-center"
                            style={{ "--cor-topo": "#1AA361", "--cor-base": "#15803d" } as any}
                          >
                            <DynamicIcon name="Percent" className="h-3.5 w-3.5 text-white" strokeWidth={3} />
                          </div>
                          <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Média</h4>
                        </div>
                        <div className="flex items-baseline gap-0.5">
                          <p className="text-lg font-bold text-slate-700 tracking-tight leading-none">{currentYieldStats.avgProfitability.toFixed(2)}%</p>
                          <span className="text-[8px] font-black text-gray-500 uppercase">a.a.</span>
                        </div>
                      </div>

                      <div className="flex flex-col">
                        <div className="flex items-center gap-2 mb-2">
                          <div
                            className="btn-3d p-2 rounded-xl shadow-sm border-none flex items-center justify-center"
                            style={{ "--cor-topo": "#1AA361", "--cor-base": "#15803d" } as any}
                          >
                            <DynamicIcon name="Calendar" className="h-3.5 w-3.5 text-white" strokeWidth={3} />
                          </div>
                          <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Mensal</h4>
                        </div>
                        <p className="text-lg font-bold text-slate-700 tracking-tight leading-none">{formatCurrency(currentYieldStats.monthYields)}</p>
                      </div>

                      <div className="flex flex-col items-end text-right">
                        <div className="flex flex-row-reverse items-center gap-2 mb-2">
                          <div
                            className="btn-3d p-2 rounded-xl shadow-sm border-none flex items-center justify-center"
                            style={{ "--cor-topo": "#1AA361", "--cor-base": "#15803d" } as any}
                          >
                            <DynamicIcon name="Clock" className="h-3.5 w-3.5 text-white" strokeWidth={3} />
                          </div>
                          <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Diário</h4>
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
              <StatCard
                id="stat-expenses"
                mainStatTitle="Total de Despesas"
                mainStatValue={stats.totalExpenses}

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
                childrenAlignment="end"
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
                className="card-despesas overflow-hidden"
                forceTransparentBackground={true}
                bottomRightContent={
                  <>
                    <p className="text-xs md:text-sm text-muted-foreground font-roboto leading-none mb-0.5">Pago este mês</p>
                    <p className="text-sm md:text-base font-bold text-success font-roboto leading-none">
                      {formatCurrency(totalPaidMonthlyExpenses)}
                    </p>
                  </>
                }
              >

                <div className="h-12 md:h-[52px] w-full" />
              </StatCard>
            )}

            {(!filter || filter === "revenues") && (
              <StatCard
                id="stat-revenues"
                mainStatTitle="Total de Receitas"
                mainStatValue={stats.totalIncome}

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
                childrenAlignment="end"
                chartContent={
                  <MonthlyRevenueBarChart
                    revenues={allRevenues}
                    currentDate={selectedMonth}
                    isMobile={isMobile}
                    onMonthClick={handleMonthClick}
                  />
                }
                annualTotalLabel="Receita Anual"
                annualTotalValue={totalAnnualRevenues}
                neumorphism={true}
                className="card-receitas overflow-hidden"
                forceTransparentBackground={true}
                bottomRightContent={
                  <>
                    <p className="text-xs md:text-sm text-muted-foreground font-roboto leading-none mb-0.5">Receita Atual</p>
                    <p className="text-sm md:text-base font-bold text-success font-roboto leading-none">
                      {formatCurrency(totalReceivedMonthlyIncome)}
                    </p>
                  </>
                }
              >

                <div className="h-12 md:h-[52px] w-full" />
              </StatCard>
            )}



            {!filter && (
              <StatCard
                mainStatTitle="Saldo Mensal"
                mainStatValue={stats.balance}
                topRightContent={
                  <MonthNavigatorCompact
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
                  />
                }
                annualTotalLabel="Saldo Anual"
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
                mainStatValue={
                  projectedYear === getYear(selectedMonth)
                    ? stats.balance + currentYieldStats.monthYields
                    : projectedYearValues.monthlyProjection
                }
                projectedPatrimonyValue={projectedYearValues.projectedPatrimony}
                projectedPatrimonyLabel="Patrimônio Projetado"
                annualTotalValue={projectedYearValues.annualBalance}
                annualTotalLabel="Projeção Anual"
                isMobile={isMobile}
                topRightContent={
                  <YearNavigatorCompact
                    year={projectedYear}
                    onPreviousYear={() => setProjectedYear(p => p - 1)}
                    onNextYear={() => setProjectedYear(p => p + 1)}
                    isMobile={isMobile}
                  />
                }
                chartContent={
                  <MonthlyProjectedYieldChart
                    revenues={allRevenues}
                    expenseInstallments={allExpenseInstallments}
                    currentDate={new Date(projectedYear, getMonth(selectedMonth), 1)}
                    projectedMonthlyYield={currentYieldStats.monthYields}
                    isMobile={true}
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
                  allSubcategories={allSubcategories}
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
          </div>
        ) : (
          <>
            <div className={cn("grid gap-4 mb-4", "grid-cols-1 md:grid-cols-2")}>
              {(!filter || filter === "expenses") && (
                <StatCard
                  mainStatTitle="Total de Despesas"
                  mainStatValue={stats.totalExpenses}
                  icon="TrendingDown"
                  variant="expense"
                  isMobile={isMobile}

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
                  bottomRightContent={
                    <>
                      <p className="text-xs md:text-sm text-muted-foreground font-roboto leading-none mb-0.5">Pago este mês</p>
                      <p className="text-sm md:text-base font-bold text-success font-roboto leading-none">
                        {formatCurrency(totalPaidMonthlyExpenses)}
                      </p>
                    </>
                  }
                >

                  <div className="h-12 md:h-[52px] w-full" />
                </StatCard>
              )}

              {(!filter || filter === "revenues") && (
                <StatCard
                  id="stat-revenues"
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
                  annualTotalLabel="Receita Anual"
                  annualTotalValue={totalAnnualRevenues}
                  neumorphism={true}
                  bottomRightContent={
                    <>
                      <p className="text-xs md:text-sm text-muted-foreground font-roboto leading-none mb-0.5">Receita Atual</p>
                      <p className="text-sm md:text-base font-bold text-success font-roboto leading-none">
                        {formatCurrency(totalReceivedMonthlyIncome)}
                      </p>
                    </>
                  }
                >

                  <div className="h-12 md:h-[52px] w-full" />
                </StatCard>
              )}

              {!filter && (
                <StatCard
                  mainStatTitle="Saldo Mensal"
                  mainStatValue={stats.balance}
                  topRightContent={
                    <MonthNavigatorCompact
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
                      isMobile={true}
                      onMonthClick={handleMonthClick}
                    />
                  }
                  annualTotalValue={totalAnnualRevenues - totalAnnualExpenses}
                  icon="Wallet"
                  neumorphism={true}
                >
                  <div className="h-12 md:h-[52px] w-full" />
                </StatCard>
              )}



              {!filter && (
                <ProjectedYieldCard
                  mainStatValue={
                    projectedYear === getYear(selectedMonth)
                      ? stats.balance + currentYieldStats.monthYields
                      : projectedYearValues.monthlyProjection
                  }
                  projectedPatrimonyValue={projectedYearValues.projectedPatrimony}
                  projectedPatrimonyLabel="Patrimônio Projetado"
                  annualTotalValue={projectedYearValues.annualBalance}
                  annualTotalLabel="Projeção Anual"
                  isMobile={isMobile}
                  topRightContent={
                    <YearNavigatorCompact
                      year={projectedYear}
                      onPreviousYear={() => setProjectedYear(p => p - 1)}
                      onNextYear={() => setProjectedYear(p => p + 1)}
                      isMobile={isMobile}
                    />
                  }
                  chartContent={
                    <MonthlyProjectedYieldChart
                      revenues={allRevenues}
                      expenseInstallments={allExpenseInstallments}
                      currentDate={new Date(projectedYear, getMonth(selectedMonth), 1)}
                      projectedMonthlyYield={currentYieldStats.monthYields}
                      isMobile={true}
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
                  allSubcategories={allSubcategories}
                  isMobile={isMobile}
                />
              </div>
            )}

            {!filter && (
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
            <Card className="p-6 animate-slide-up rounded-xl shadow-sm">
              <p className={cn("text-muted-foreground", "font-roboto")}>
                Mais conteúdo do Dashboard virá aqui.
              </p>
            </Card>

          </>
        )}
      </main>
      <Footer
        isMobile={isMobile}
        className={cn(isMobile ? "fixed bottom-0 left-0 right-0 py-2 bg-white/80 backdrop-blur-sm z-50 m-0" : "mt-8")}
        user={user}
      />
    </div>
  );
}
