import React, { useMemo, useState, useEffect } from "react";
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
import { cn, formatCurrency, getAliquotaIR, getTipoTributacao, IndexadorHistorico, buildIndexadorMap, calcularRendimentoComCDI } from "@/lib/utils";
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
      enabled: !!user,
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
    enabled: !!user,
  });

  // Fetch active indexers (CDI/IPCA)
  const { data: indexadores = [] } = useQuery<IndexadorHistorico[]>({
    queryKey: ["indexadores-cdi"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("indexadores")
        .select("tipo, taxa_anual, data_inicio, taxa_diaria")
        .order("data_inicio", { ascending: true });
      if (error) throw error;
      return data as IndexadorHistorico[];
    },
  });

  const cdi = useMemo(() => {
    const cdis = indexadores.filter(i => i.tipo === "CDI");
    if (cdis.length === 0) return 10.65;
    return [...cdis].sort((a, b) => b.data_inicio.localeCompare(a.data_inicio))[0].taxa_anual;
  }, [indexadores]);

  const ipca = useMemo(() => {
    const ipcas = indexadores.filter(i => i.tipo === "IPCA");
    if (ipcas.length === 0) return 5.0;
    return [...ipcas].sort((a, b) => b.data_inicio.localeCompare(a.data_inicio))[0].taxa_anual;
  }, [indexadores]);

  const indexadorMapCDI = useMemo(() => buildIndexadorMap(indexadores.filter(i => i.tipo === "CDI")), [indexadores]);
  const indexadorMapIPCA = useMemo(() => buildIndexadorMap(indexadores.filter(i => i.tipo === "IPCA")), [indexadores]);

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

  const monthlyTrends = useMemo(() => {
    const currentMonthStr = format(selectedMonth, "yyyy-MM");
    const prevMonthStr = format(subMonths(selectedMonth, 1), "yyyy-MM");

    const calculateIncome = (monthStr: string) => {
      return allRevenues
        .filter((r) => r.data.startsWith(monthStr))
        .reduce((sum, r) => sum + r.valor, 0);
    };

    const calculateExpenses = (monthStr: string) => {
      return allExpenseInstallments
        .filter((p) => p.vencimento.startsWith(monthStr))
        .reduce((sum, p) => sum + p.valor_parcela, 0);
    };

    const currentIncome = calculateIncome(currentMonthStr);
    const currentExpenses = calculateExpenses(currentMonthStr);
    const currentBalance = currentIncome - currentExpenses;

    const previousIncome = calculateIncome(prevMonthStr);
    const previousExpenses = calculateExpenses(prevMonthStr);
    const previousBalance = previousIncome - previousExpenses;

    const calcTrendVar = (curr: number, prev: number) => {
      if (prev === 0) return curr > 0 ? 100 : 0;
      return ((curr - prev) / Math.abs(prev)) * 100;
    };

    const incomeVar = calcTrendVar(currentIncome, previousIncome);
    const expenseVar = calcTrendVar(currentExpenses, previousExpenses);
    const balanceVar = calcTrendVar(currentBalance, previousBalance);

    const formatTrend = (val: number) => {
      return `${val > 0 ? '+' : ''}${val.toFixed(0)}%`;
    };

    return {
      incomeTrend: formatTrend(incomeVar),
      incomeIsPositive: currentIncome >= previousIncome,
      expenseTrend: formatTrend(expenseVar),
      expenseIsPositive: currentExpenses >= previousExpenses, 
      balanceTrend: formatTrend(balanceVar),
      balanceIsPositive: currentBalance >= previousBalance,
    };
  }, [allRevenues, allExpenseInstallments, selectedMonth]);

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
      // Determinar o mapa de indexador correto
      let idxMap: Map<string, number> | undefined;
      if (inv.tipo_rentabilidade === "indexado") {
        if (inv.indexador === "CDI") idxMap = indexadorMapCDI;
        else if (inv.indexador === "IPCA") idxMap = indexadorMapIPCA;
      }

      const tipoTributacao = getTipoTributacao(inv, allSubcategories);

      // Cálculo de rendimento usando dados históricos (Engine Real)
      const { 
        valorAtual: valorLiquido, 
        ultimaTaxaAplicada: taxaDiaria,
        rendimentoBrutoAcumulado: rendimentoBruto,
        irProvisionado: valorIR
      } = calcularRendimentoComCDI({
        valorInicial: inv.valor,
        dataInicio: inv.data,
        indexadorMap: idxMap || new Map<string, number>(),
        percentualIndexador: inv.tipo_rentabilidade === "indexado" ? (inv.percentual_indexador || 100) : 100,
        taxaFixaAnual: inv.tipo_rentabilidade === "fixo" ? (inv.taxa_fixa || 0) : null,
        tipoTributacao
      });
      
      const rendimentoLiquido = valorLiquido - inv.valor;
      const investDate = typeof inv.data === 'string' ? new Date(`${inv.data}T12:00:00`) : new Date(inv.data);
      const aliquotaIR = getAliquotaIR(investDate, new Date(), tipoTributacao);

      const rendimentoBrutoDia = valorLiquido * taxaDiaria;
      const rendimentoHojeLiquido = rendimentoBrutoDia * (1 - aliquotaIR / 100);

      return {
        ...inv,
        tipoTributacao,
        rentabilidade: inv.tipo_rentabilidade === "indexado" 
          ? (inv.indexador === "CDI" ? cdi : (inv.indexador === "IPCA" ? ipca : 0)) * (inv.percentual_indexador || 100) / 100
          : (inv.taxa_fixa || 0),
        valorAtualVirtual: inv.valor + rendimentoBruto, // Saldo bruto informativo
        rendimentoHojeVirtual: rendimentoHojeLiquido,
        taxaDiaria,
        aliquotaIR,
        rendimentoBruto,
        imposto: valorIR,
        rendimentoLiquido,
        valorLiquido
      };
    });
  }, [investments, cdi, ipca, allSubcategories, indexadorMapCDI, indexadorMapIPCA]);

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

  const currentYieldStats = useMemo(() => {
    let totalInvested = investments.reduce((sum, inv) => sum + inv.valor, 0);
    // Modified to use Net Amount for cockpit totals
    let totalCurrentBalance = calculatedInvestments.reduce((sum, inv) => sum + inv.valorLiquido, 0);

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
  }, [totalProjectedAnnualYield, investments, calculatedInvestments]);

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

  const handlePreviousMonth = () => {
    setSelectedMonth((prev) => subMonths(prev, 1));
  };

  const handleNextMonth = () => {
    setSelectedMonth((prev) => addMonths(prev, 1));
  };

  const handleMonthClick = (date: Date) => {
    setSelectedMonth(date);
  };



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
                            <h4 className="text-[10px] font-black text-[#0556C3] uppercase tracking-[0.2em] mb-1 leading-none">Saldo Líquido Total</h4>
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
                            <h4 className="text-[10px] font-black text-[#0556C3] uppercase tracking-[0.2em] mb-1 leading-none">Mensal</h4>
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
                            <h4 className="text-[10px] font-black text-[#0556C3] uppercase tracking-[0.2em] mb-1 leading-none">Diário</h4>
                            <p className="text-xl font-bold text-slate-700 tracking-tight leading-none">{formatCurrency(currentYieldStats.totalDailyYieldRS)}</p>
                          </div>
                        </div>

                        {/* Rentabilidade Média */}
                        <div className="flex items-center justify-start gap-4 border-l border-[rgba(0,102,255,0.15)] h-10 pl-8">
                          <div
                            className="p-2.5 rounded-xl flex items-center justify-center bg-white shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
                            style={{ border: "1px solid rgba(0,0,0,0.04)" }}
                          >
                            <DynamicIcon name="Percent" className="h-5 w-5 text-[#0556C3]" strokeWidth={3} />
                          </div>
                          <div className="flex flex-col">
                            <h4 className="text-[10px] font-black text-[#0556C3] uppercase tracking-[0.2em] mb-1 leading-none">Média</h4>
                            <div className="flex items-baseline gap-1">
                              <p className="text-xl font-bold text-slate-700 tracking-tight leading-none">{currentYieldStats.avgProfitability.toFixed(2)}%</p>
                              <span className="text-[10px] font-black text-slate-500 uppercase">a.a.</span>
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
                          <h4 className="text-[11px] font-bold text-[#0556C3] tracking-widest leading-none">Saldo líquido total</h4>
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
                          <h4 className="text-[11px] font-bold text-[#0556C3] tracking-widest leading-none">Média</h4>
                        </div>
                        <div className="flex items-baseline gap-0.5">
                          <p className="text-lg font-bold text-slate-700 tracking-tight leading-none">{currentYieldStats.avgProfitability.toFixed(2)}%</p>
                          <span className="text-[8px] font-black text-gray-500 uppercase">a.a.</span>
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
                          <h4 className="text-[11px] font-bold text-[#0556C3] tracking-widest leading-none">Mensal</h4>
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
                          <h4 className="text-[11px] font-bold text-[#0556C3] tracking-widest leading-none">Diário</h4>
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
                mainStatValue={
                  projectedYear === getYear(selectedMonth)
                    ? stats.balance + currentYieldStats.monthYields
                    : projectedYearValues.monthlyProjection
                }
                projectedPatrimonyValue={projectedYearValues.projectedPatrimony}
                projectedPatrimonyLabel="Patrimônio Projetado"
                annualTotalValue={projectedYearValues.annualBalance}
                annualTotalLabel="Projeção anual"
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
                  mainStatValue={
                    projectedYear === getYear(selectedMonth)
                      ? stats.balance + currentYieldStats.monthYields
                      : projectedYearValues.monthlyProjection
                  }
                  projectedPatrimonyValue={projectedYearValues.projectedPatrimony}
                  projectedPatrimonyLabel="Patrimônio Projetado"
                  annualTotalValue={projectedYearValues.annualBalance}
                  annualTotalLabel="Projeção anual"
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
                  allSubcategories={allSubcategories}
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
