import React, { useMemo, useState } from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useProfile } from "@/hooks/useProfile";
import { Tables } from "@/integrations/supabase/types";
import { MobileCreditCardExpenses } from "@/components/MobileCreditCardExpenses";
import { Wallet, TrendingUp, TrendingDown, Plus } from "lucide-react";
import {
    format,
    subMonths,
    addMonths,
    startOfMonth,
    endOfMonth,
    isWithinInterval,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn, formatCurrency, getDisplayName } from "@/lib/utils";
import DynamicIcon from "@/components/DynamicIcon";
import { Button } from "@/components/ui/button";
import { useNavigate, useLocation } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { useCategories } from "@/hooks/useCategories";
import Loading from "@/components/Loading";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { MonthlyBalanceBarChart } from "@/components/MonthlyBalanceBarChart";
import { MonthlyExpenseBarChart } from "@/components/MonthlyExpenseBarChart";
import { MonthlyRevenueBarChart } from "@/components/MonthlyRevenueBarChart";
import { SaldoAjusteDialog } from "@/components/SaldoAjusteDialog";
import { useFinancialProjection } from "@/hooks/useFinancialProjection";


const MiniFinanceBars = ({ expenses, revenues, balance, height = 32, showScaleLines = true }: { expenses: number, revenues: number, balance: number, height?: number, showScaleLines?: boolean }) => {
    const maxVal = Math.max(Math.abs(expenses), Math.abs(revenues), Math.abs(balance), 1);
    const getH = (val: number) => Math.max((Math.abs(val) / maxVal) * height, 2);

    const BarItem = ({ val, colorStart, colorEnd, label, width, glowColor }: { val: number, colorStart: string, colorEnd: string, label: string, width: string, glowColor: string }) => (
        <div className="flex flex-col items-center gap-1">
            <div
                className="transition-all duration-500 ease-out"
                style={{
                    height: `${getH(val)}px`,
                    width: width,
                    background: `linear-gradient(to top, ${colorStart}, ${colorEnd})`,
                    borderRadius: "4px",
                    boxShadow: `inset -2px 0 4px rgba(0,0,0,0.15), inset 2px 0 4px rgba(255,255,255,0.4), 0 4px 10px ${glowColor}`
                }}
            />
            <span className="text-[9px] font-[800] uppercase tracking-tighter leading-none" style={{ color: "rgba(17, 24, 39, 0.92)" }}>{label}</span>
        </div>
    );

    return (
        <div className="relative flex items-end gap-1.5 px-1 pb-1">
            {showScaleLines && (
                <>
                    <div className="absolute left-0 right-0 h-[0.5px]" style={{ bottom: "48px", background: "rgba(0,0,0,0.06)" }} />
                    <div className="absolute left-0 right-0 h-[1px]" style={{ bottom: "14.5px", background: "rgba(0,0,0,0.1)" }} />
                </>
            )}

            <BarItem val={expenses} colorStart="#dc2626" colorEnd="#ef4444" glowColor="rgba(220,38,38,0.4)" label="D" width="16px" />
            <BarItem val={revenues} colorStart="#16a34a" colorEnd="#22c55e" glowColor="rgba(22,163,74,0.4)" label="R" width="16px" />
            <BarItem val={balance} colorStart="#2563eb" colorEnd="#3b82f6" glowColor="rgba(37,99,235,0.4)" label="S" width="16px" />
        </div>
    );
};

const FormatCurrencyStyled = ({ value, prefixColor }: { value: number, prefixColor?: string }) => {
    const formatted = formatCurrency(value);
    const match = formatted.match(/^(R\$)\s?(.*)$/);
    if (match) {
        return (
            <>
                <span style={{ color: prefixColor, opacity: prefixColor ? 1 : 0.85, fontSize: "0.6em", fontWeight: 600, marginRight: "4px", verticalAlign: "baseline" }}>{match[1]}</span>
                {match[2]}
            </>
        );
    }
    return <>{formatted}</>;
};

const EMPTY_ARRAY: any[] = [];

export default function Home() {
    const { user, loading: authLoading } = useAuth();
    const isMobile = useIsMobile();
    const navigate = useNavigate();
    const [selectedMonth, setSelectedMonth] = useState(new Date());
    const [activeTrendModal, setActiveTrendModal] = useState<"saldo" | "despesas" | "receitas" | null>(null);
    const [isAjusteModalOpen, setIsAjusteModalOpen] = useState(false);


    // Fetch all revenues for memory-based filtering (needed for variations and 10-month graph)
    const { data: allRevenues = EMPTY_ARRAY, isLoading: isLoadingRevenues, isPlaceholderData: isPlaceholderRevenues } = useQuery<
        Tables<"receitas">[]
    >({
        queryKey: ["allRevenues", user?.id, format(selectedMonth, "yyyy")],
        queryFn: async () => {
            if (!user?.id) return [];
            // Fetch current and previous year of the selected month
            const startRange = format(subMonths(selectedMonth, 12), "yyyy-01-01");
            const endRange = format(selectedMonth, "yyyy-12-31");
            const { data, error } = await supabase
                .from("receitas")
                .select("*")
                .eq("user_id", user.id)
                .gte("data", startRange)
                .lte("data", endRange);
            if (error) throw error;
            return data.filter((r: any) => r.data !== '1900-01-01');
        },
        enabled: !!user,
        placeholderData: keepPreviousData,
    });

    // Fetch all expense installments for memory-based filtering (needed for variations, Credit Card card, and 10-month graph)
    // NOTE: queryKey and select must match Dashboard exactly so both pages share the same React Query cache
    // and receive identical data as input to useFinancialProjection.
    const { 
        data: allExpenseInstallments = EMPTY_ARRAY, 
        isLoading: isLoadingExpenses, 
        isPending: isPendingExpenses,
        isSuccess: isSuccessExpenses,
        isPlaceholderData: isPlaceholderExpenses 
    } =
        useQuery<
            (Tables<"despesas_parcelas"> & {
                despesas: Pick<
                    Tables<"despesas">,
                    | "id"
                    | "categoria_id"
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
            placeholderData: keepPreviousData,
        });


    // Fetch cards
    const { 
        data: cartoes = EMPTY_ARRAY, 
        isLoading: isLoadingCartoes,
        isPending: isPendingCartoes,
        isSuccess: isSuccessCartoes,
    } = useQuery<Tables<"cartoes">[]>({
        queryKey: ["cartoes", user?.id],
        queryFn: async () => {
            if (!user?.id) return [];
            const { data, error } = await supabase
                .from("cartoes")
                .select("*")
                .eq("user_id", user.id)
                .order("created_at");
            if (error) throw error;
            return data;
        },
        enabled: !!user,
    });

    // Fetch investimentos to subtract from Caixa Atual
    const { data: investimentos = EMPTY_ARRAY, isLoading: isLoadingInvestments } = useQuery<Tables<"investimentos">[]>({
        queryKey: ["investments", user?.id],
        queryFn: async () => {
            if (!user?.id) return [];
            const { data, error } = await supabase
                .from("investimentos")
                .select("*")
                .eq("user_id", user.id);
            if (error) throw error;
            return data;
        },
        enabled: !!user,
    });

    // Global Balance Queries for "Saldo Atual"
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

    // Fetch categories via SSOT
    const { data: allSubcategories = EMPTY_ARRAY } = useCategories(user?.id);

    const { data: profile, refetch: refetchProfile } = useProfile(user?.id);

    // ── Centralized Financial Projection ─────────────────────────────────────
    const {
        getMonthlyExpenses,
        getMonthlyRevenues,
        getMonthlyBalance,
        getMonthlyTrends,
        getAnnualExpenses,
        getAnnualRevenues,
        isMonthProjected,
    } = useFinancialProjection({
        user,
        allExpenseInstallments,
        allRevenues,
        enabled: !!user,
    });

    const selectedMonthStr = useMemo(() => format(selectedMonth, "yyyy-MM"), [selectedMonth]);
    const prevMonthStr = useMemo(() => format(subMonths(selectedMonth, 1), "yyyy-MM"), [selectedMonth]);

    const stats = useMemo(() => {
        const currentIncome = getMonthlyRevenues(selectedMonthStr);
        const currentReceivedIncome = allRevenues
            .filter((r) => r.data.startsWith(selectedMonthStr) && r.status === 'Recebida')
            .reduce((sum, r) => sum + r.valor, 0);
        const currentExpenses = getMonthlyExpenses(selectedMonthStr);
        const currentPaidExpenses = allExpenseInstallments
            .filter((p) => p.vencimento.startsWith(selectedMonthStr) && p.pago === true)
            .reduce((sum, p) => sum + p.valor_parcela, 0);
        
        // Subtract Active Investments (originated from saldo_atual)
        const currentActiveInvestments = investimentos
            .filter((inv) => (inv.status === 'ativo' || !inv.status) && inv.origem_investimento === 'saldo_atual')
            .reduce((sum, inv) => sum + (inv.valor || 0), 0);

        // Raw calculated system balance WITHOUT manual adjustment
        const saldoCalculadoSistema = globalReceivedIncome - globalPaidExpenses - currentActiveInvestments;

        // Caixa Atual represents the GLOBAL actual balance PLUS manual adjustment
        const currentCaixaAtual = saldoCalculadoSistema + (profile?.saldo_ajuste || 0);
        
        const currentBalance = currentIncome - currentExpenses;

        const trends = getMonthlyTrends(selectedMonthStr, prevMonthStr);

        const calculateVar = (curr: number, prev: number) => {
            if (prev === 0) return curr > 0 ? 100 : 0;
            return ((curr - prev) / prev) * 100;
        };

        const previousIncome = getMonthlyRevenues(prevMonthStr);
        const previousExpenses = getMonthlyExpenses(prevMonthStr);
        const previousBalance = previousIncome - previousExpenses;

        return {
            currentIncome,
            currentReceivedIncome,
            currentPaidExpenses,
            currentCaixaAtual,
            saldoCalculadoSistema,
            currentExpenses,
            currentBalance,
            incomeVar: calculateVar(currentIncome, previousIncome),
            expenseVar: calculateVar(currentExpenses, previousExpenses),
            balanceVar: calculateVar(currentBalance, previousBalance),
        };
    }, [getMonthlyRevenues, getMonthlyExpenses, getMonthlyTrends, selectedMonthStr, prevMonthStr, allRevenues, allExpenseInstallments, investimentos, globalReceivedIncome, globalPaidExpenses, profile?.saldo_ajuste]);

    // Snapshot mechanism to avoid flickering to R$ 0,00 during month transitions
    const lastStableData = React.useRef({
        stats,
        allExpenseInstallments,
        selectedMonth,
    });

    const isPlaceholder = isPlaceholderRevenues || isPlaceholderExpenses;

    if (!isPlaceholder && !isLoadingRevenues && !isLoadingExpenses) {
        lastStableData.current = {
            stats,
            allExpenseInstallments,
            selectedMonth,
        };
    }

    const dStats = lastStableData.current.stats;
    const dExpenses = lastStableData.current.allExpenseInstallments;
    const dMonth = lastStableData.current.selectedMonth;

    // Loading estrito do card de cartões: apenas exibe conteúdo após confirmação definitiva do Supabase
    const isCardsLoading = useMemo(() => {
        if (authLoading || !user) return true;
        if (!isSuccessCartoes || isLoadingCartoes || isPendingCartoes) return true;
        // Se o usuário possui cartões, aguarda as despesas para evitar flash de valor zerado (R$ 0,00) ou gráfico vazio
        if (cartoes.length > 0) {
            if (!isSuccessExpenses || (isLoadingExpenses && dExpenses.length === 0)) {
                return true;
            }
        }
        return false;
    }, [authLoading, user, isSuccessCartoes, isLoadingCartoes, isPendingCartoes, cartoes.length, isSuccessExpenses, isLoadingExpenses, dExpenses.length]);

    const location = useLocation();

    const monthlyBalances = useMemo(() => {
        const today = new Date();
        const diffMonths = (today.getFullYear() - selectedMonth.getFullYear()) * 12 + (today.getMonth() - selectedMonth.getMonth());
        
        // If selectedMonth is in the future or older than 9 months, shift window to end at selectedMonth
        const endMonth = (diffMonths >= 0 && diffMonths < 10) ? today : selectedMonth;
        
        const list = [];
        for (let i = 9; i >= 0; i--) {
            const m = subMonths(endMonth, i);
            const mStr = format(m, "yyyy-MM");
            
            const income = getMonthlyRevenues(mStr);
            const expenses = getMonthlyExpenses(mStr);
                
            list.push({
                monthStr: mStr,
                balance: income - expenses,
                date: m
            });
        }
        return list;
    }, [getMonthlyRevenues, getMonthlyExpenses, selectedMonth]);

    const selectedMonthIdx = useMemo(() => {
        const selStr = format(selectedMonth, "yyyy-MM");
        return monthlyBalances.findIndex(item => item.monthStr === selStr);
    }, [monthlyBalances, selectedMonth]);

    const sparklinePoints = useMemo(() => {
        if (monthlyBalances.length === 0) return [];
        const balances = monthlyBalances.map(m => m.balance);
        const minBal = Math.min(...balances);
        const maxBal = Math.max(...balances);
        const range = maxBal - minBal === 0 ? 1 : maxBal - minBal;
        
        return monthlyBalances.map((item, i) => {
            // max balance maps to Y=5, min balance maps to Y=40
            // start at X=5 and end at 155 for mobile (to stretch fully to the right)
            const y = 40 - ((item.balance - minBal) / range) * 35;
            return {
                x: isMobile ? 5 + i * (150 / 9) : 22 + i * (128 / 9),
                y,
                monthStr: item.monthStr,
                balance: item.balance
            };
        });
    }, [monthlyBalances, isMobile]);

    const linePath = useMemo(() => {
        if (sparklinePoints.length === 0) return "";
        let path = `M ${sparklinePoints[0].x} ${sparklinePoints[0].y}`;
        for (let i = 0; i < sparklinePoints.length - 1; i++) {
            const p0 = sparklinePoints[i];
            const p1 = sparklinePoints[i + 1];
            const dx = (p1.x - p0.x) / 2.5;
            const cpX1 = p0.x + dx;
            const cpY1 = p0.y;
            const cpX2 = p1.x - dx;
            const cpY2 = p1.y;
            path += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${p1.x} ${p1.y}`;
        }
        return path;
    }, [sparklinePoints]);

    const fillPath = useMemo(() => {
        if (linePath === "") return "";
        return `${linePath} L 150 44 L 22 44 Z`;
    }, [linePath]);

    // Scroll to cartoes if hash is present
    React.useEffect(() => {
        if (location.hash === "#cartoes") {
            const el = document.getElementById("cartoes-section");
            if (el) el.scrollIntoView({ behavior: "smooth" });
        }
    }, [location.hash]);

    // SÃ³ mostra o Loading se for o carregamento inicial (sem dados de receitas ou despesas ainda)
    const isInitialLoad = (isLoadingRevenues && allRevenues.length === 0) || (isLoadingExpenses && allExpenseInstallments.length === 0);



    const handlePrevMonth = () => setSelectedMonth((m) => subMonths(m, 1));
    const handleNextMonth = () => setSelectedMonth((m) => addMonths(m, 1));

    const userName = getDisplayName(profile, user);
    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour >= 5 && hour < 12) return "Bom dia";
        if (hour >= 12 && hour < 18) return "Boa tarde";
        return "Boa noite";
    };

    const greeting = getGreeting();
    const rawWeekday = format(new Date(), "EEEE", { locale: ptBR });
    const capitalizedWeekday = rawWeekday.charAt(0).toUpperCase() + rawWeekday.slice(1);
    const dayStr = format(new Date(), "dd");
    const rawMonthAbbr = format(new Date(), "MMM", { locale: ptBR }).replace(".", "");
    const capitalizedMonthAbbr = rawMonthAbbr.charAt(0).toUpperCase() + rawMonthAbbr.slice(1);
    const yearStr = format(new Date(), "yyyy");
    const todayStr = `${capitalizedWeekday}, ${dayStr} ${capitalizedMonthAbbr} de ${yearStr}`;
    const isCurrentMonth = format(selectedMonth, "yyyy-MM") === format(new Date(), "yyyy-MM");

    return (
        <div
            className={cn("flex flex-col min-h-[100dvh] relative overflow-hidden global-bg", !isMobile && "pt-[72px]")}
        >
            {isMobile && (
                <div
                    className="absolute inset-0 z-10 pointer-events-none"
                    style={{
                        background: "linear-gradient(180deg, #FAFAFA 0%, #FAFAFA 75%, #F8F9FB 88%, #FCFCFE 100%)"
                    }}
                />
            )}
            {/* HEADER AREA */}
            <div className="relative h-[220px] w-full overflow-hidden shrink-0">
                <div className={cn(
                    "container-app relative z-10",
                    isMobile ? "fixed top-[calc(3.5rem+env(safe-area-inset-top))] left-0 right-0 h-[42px] z-40 flex items-center pt-0 bg-transparent justify-between" : "pt-[72px] md:pt-[42px] flex justify-between items-start"
                )}>
                    <div>
                        <h1 
                            className={cn("font-bold leading-none", isMobile ? "text-[17px] tracking-tight" : "text-2xl font-extrabold tracking-[0.5px] -mt-0.5")}
                            style={{ fontFamily: "'Inter', sans-serif" }}
                        >
                            <span className={cn(isMobile ? "text-slate-500" : "text-[#1e3a8a]")}>{greeting},</span> <span className={cn(isMobile ? "text-slate-800" : "text-[#1e3a8a]")}>{userName}</span> {profile?.avatar || "👍"}
                        </h1>
                        <p 
                            className={cn("font-medium leading-none", isMobile ? "text-[12px] font-normal -mt-[4px]" : "text-sm font-bold text-slate-500 -mt-0.5 tracking-wider opacity-80")}
                            style={{ color: isMobile ? "#262626" : undefined, fontFamily: "'Inter', sans-serif" }}
                        >
                            {todayStr}
                        </p>
                    </div>
                    {isMobile && (
                        <div className="flex flex-col items-center select-none mr-0 -mt-[3px]">
                            <div className="flex items-center gap-[7px]">
                                <button 
                                    onClick={handlePrevMonth} 
                                    className="border-none rounded-[8px] p-0 h-6 w-6 flex items-center justify-center transition-all hover:opacity-90 active:scale-95 cursor-pointer translate-y-[2px]"
                                    style={{ 
                                        background: "white",
                                        boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                                        border: "1px solid #e2e8f0"
                                    }}
                                >
                                    <DynamicIcon name="ChevronLeft" className="h-3 w-3 text-slate-600" strokeWidth={3.5} />
                                </button>
                                <div className="w-[38px] flex justify-center items-center">
                                    <span 
                                        className="font-bold tracking-wide uppercase font-sans leading-none text-center"
                                        style={{ 
                                            fontSize: '16.5px', 
                                            color: isCurrentMonth ? '#334155' : '#94a3b8',
                                            fontWeight: 800
                                        }}
                                    >
                                        {format(selectedMonth, "MMM", { locale: ptBR }).replace(".", "")}
                                    </span>
                                </div>
                                <button 
                                    onClick={handleNextMonth} 
                                    className="border-none rounded-[8px] p-0 h-6 w-6 flex items-center justify-center transition-all hover:opacity-90 active:scale-95 cursor-pointer translate-y-[2px]"
                                    style={{ 
                                        background: "white",
                                        boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                                        border: "1px solid #e2e8f0"
                                    }}
                                >
                                    <DynamicIcon name="ChevronRight" className="h-3 w-3 text-slate-600" strokeWidth={3.5} />
                                </button>
                            </div>
                            <span 
                                className="font-bold font-sans leading-none"
                                style={{ 
                                    fontSize: '12.5px', 
                                    color: '#64748b',
                                    marginTop: '-0.5px'
                                }}
                            >
                                {format(selectedMonth, "yyyy")}
                            </span>
                        </div>
                    )}
                </div>
            </div>

            <main className={cn(
                "container-app relative z-20 flex-grow !bg-transparent !bg-none !backdrop-blur-none !shadow-none",
                isMobile ? "-mt-32 pb-10" : "-mt-24 md:-mt-[84px] md:pb-8"
            )} style={{ background: 'transparent' }}>

                {isMobile ? (
                    <div className="relative !bg-transparent !bg-none !backdrop-blur-none">
                        <div
                            className="!fixed top-[98px] left-0 right-0 bottom-[28px] overflow-hidden z-30 container-app pt-[12px] !bg-transparent !bg-none !backdrop-blur-none" style={{ background: 'transparent' }}
                        >
                            <div
                                className="h-full grid grid-cols-1 pb-6 !bg-transparent !bg-none !backdrop-blur-none"
                                style={{
                                    background: 'transparent',
                                    gridTemplateRows: 'repeat(4, minmax(0, 1fr))',
                                    gap: 'var(--home-grid-gap, 12px)'
                                }}
                            >
                                {/* CARD PRINCIPAL â€” SALDO MENSAL (HERO) */}
                                <Card
                                    className="home-mobile-card rounded-[22px] relative overflow-hidden card-saldo h-full w-full flex flex-col justify-center"
                                    style={{
                                        borderRadius: "22px",
                                        background: "radial-gradient(circle at top right, rgba(255,255,255,.60), transparent 65%), linear-gradient(135deg, #E2EDFC 0%, #E8F1FD 35%, #EEF5FF 70%, #E0EDFF 85%, #D1E1FF 100%)",
                                        border: "1px solid rgba(255,255,255,0.85)",
                                        backgroundClip: "padding-box",
                                        outline: "none",
                                        boxShadow: "0 8px 24px rgba(37,99,235,0.06), 0 2px 6px rgba(37,99,235,0.03), inset 0 1px 0 rgba(255,255,255,.95)"
                                    }}
                                >
                                    {/* Formas orgânicas temáticas de fundo */}
                                    <div aria-hidden="true" className="absolute inset-0 pointer-events-none overflow-hidden rounded-[22px]" style={{ zIndex: 0 }}>
                                        <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 400 180">
                                            <defs>
                                                <linearGradient id="wave-grad-mob" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.45" />
                                                    <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.30" />
                                                </linearGradient>
                                            </defs>
                                            {/* Curva suave superior */}
                                            <path d="M 60,0 C 150,55 240,65 380,15 L 400,0 Z" fill="rgba(255,255,255,0.45)" />
                                            {/* Onda suave que envolve o gráfico */}
                                            <path d="M 0,180 Q 120,115 220,135 T 400,85 L 400,180 Z" fill="url(#wave-grad-mob)" />
                                        </svg>
                                    </div>

                                    <div className="flex flex-col justify-center h-full w-full relative z-20">
                                        {/* TOPO: Título + Valor e Seletor */}
                                        <div className="flex justify-between items-start w-full mb-2">
                                            <div 
                                                className="flex flex-col cursor-pointer group transition-all active:opacity-70 md:mt-3"
                                                onClick={() => setIsAjusteModalOpen(true)}
                                            >
                                                <div className="flex items-center gap-1.5 mb-1 md:-mt-[1px]" style={{ marginTop: "calc(var(--home-title-mt, 3px) + 10px)" }}>
                                                    <h2 className="leading-none tracking-[0.5px]" style={{ color: "#2563EB", fontFamily: "'Inter', sans-serif", fontSize: "var(--home-title-text, 15px)", fontWeight: 700 }}>Saldo em conta</h2>
                                                    <button 
                                                        className="btn-3d w-7 h-7 flex items-center justify-center rounded-full border border-blue-200/50 transition-all active:scale-95 shadow-[0_2px_5px_rgba(37,99,235,0.15)]"
                                                        aria-label="Ajustar saldo"
                                                        type="button"
                                                        style={{ "--cor-topo": "#ffffff", "--cor-base": "#eff6ff" } as any}
                                                    >
                                                        <DynamicIcon name="Wallet" className="h-4 w-4 text-[#2563EB]" style={{ filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.05))" }} />
                                                    </button>
                                                </div>
                                                <p className="leading-none transition-all" style={{ marginTop: "var(--home-val-mt, -5px)", fontSize: "22px", fontWeight: 700, fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', color: dStats.currentCaixaAtual < 0 ? (isMobile ? "#ef4444" : "#b91c1c") : "#0F172A", letterSpacing: "-0.5px" }}>
                                                    <FormatCurrencyStyled value={dStats.currentCaixaAtual} prefixColor={dStats.currentCaixaAtual < 0 ? (isMobile ? "#ef4444" : "#b91c1c") : "#0F172A"} />
                                                </p>
                                            </div>
                                        </div>

                                        {/* BASE: Saldo Mensal à esquerda e Sparkline à direita */}
                                        <div className="flex justify-between items-end w-full mt-2">
                                            {/* Informações Secundárias e Ações */}
                                            <div className="w-[135px] md:w-auto shrink-0 flex flex-col items-start pb-0 z-10 mr-2 -mt-4">
                                                {/* Saldo Mensal agrupado com Ícone Azul */}
                                                <div className="flex items-center gap-2.5 mb-2.5">
                                                    <Button
                                                        onClick={() => navigate("/dashboard?filter=investments")}
                                                        className="p-0 flex items-center justify-center rounded-xl border-none transition-all active:scale-90 shrink-0"
                                                        style={{ width: "var(--home-btn-h, 36px)", height: "var(--home-btn-h, 36px)", background: "#2563EB", filter: "saturate(0.95)", boxShadow: "0 6px 14px rgba(37,99,235,0.15)", transform: "translateY(-4px)" }}
                                                    >
                                                        <DynamicIcon name="LineChart" className="h-[18px] w-[18px] text-white" strokeWidth={3} />
                                                    </Button>
                                                    <div className="flex flex-col items-start" style={{ transform: "translateY(-4px)" }}>
                                                        <span className="text-[12px] font-medium leading-[1.2] tracking-normal text-[#64748B] mb-0.5 whitespace-nowrap">
                                                            Saldo em {format(selectedMonth, "MMMM", { locale: ptBR }).replace(/^\w/, c => c.toUpperCase())}
                                                        </span>
                                                        <span className="text-[15px] font-bold text-[#334155] tracking-tight leading-none">
                                                            {formatCurrency(dStats.currentBalance)}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Sparkline Graph */}
                                            <div className="flex-1 min-w-0 flex flex-col items-end justify-end -mt-6" style={{ transform: "translateY(-14px)" }}>
                                                <div className="flex flex-col items-center w-full">
                                                    <svg viewBox="0 0 160 45" className="w-full h-[var(--home-chart-h,64px)] overflow-visible">
                                                    <defs>
                                                        <linearGradient id="sparkline-grad-mob" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="0%" stopColor="#2563EB" stopOpacity="0.18" />
                                                            <stop offset="70%" stopColor="#2563EB" stopOpacity="0.03" />
                                                            <stop offset="100%" stopColor="#2563EB" stopOpacity="0.00" />
                                                        </linearGradient>
                                                        <filter id="line-glow-mob" x="-10%" y="-10%" width="120%" height="130%">
                                                            <feDropShadow dx="0" dy="3" stdDeviation="2.5" floodColor="#2563EB" floodOpacity="0.18" />
                                                        </filter>
                                                        <filter id="red-glow-mob" x="-40%" y="-40%" width="180%" height="180%">
                                                            <feGaussianBlur in="SourceAlpha" stdDeviation="1.2" result="blur" />
                                                            <feOffset dx="0" dy="1" />
                                                            <feComponentTransfer in="blur" result="glow">
                                                              <feFuncA type="linear" slope="0.3" />
                                                            </feComponentTransfer>
                                                            <feMerge>
                                                              <feMergeNode in="glow" />
                                                              <feMergeNode in="SourceGraphic" />
                                                            </feMerge>
                                                        </filter>
                                                    </defs>
                                                    <path
                                                        d={fillPath}
                                                        fill="url(#sparkline-grad-mob)"
                                                        style={{ transition: 'all 220ms ease-in-out' }}
                                                    />
                                                    <path
                                                        d={linePath}
                                                        fill="none"
                                                        stroke="#2563EB"
                                                        strokeWidth="2.5"
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        filter="url(#line-glow-mob)"
                                                        style={{ transition: 'all 220ms ease-in-out' }}
                                                    />
                                                    {sparklinePoints.map((pt, idx) => {
                                                        const isSelected = idx === selectedMonthIdx;
                                                        return (
                                                            <circle
                                                                key={idx}
                                                                cx={pt.x}
                                                                cy={pt.y}
                                                                r={isSelected ? 4.2 : 3}
                                                                fill={isSelected ? "#EF6C6C" : "#2563EB"}
                                                                stroke="#ffffff"
                                                                strokeWidth={isSelected ? 1.6 : 1.2}
                                                                filter={isSelected ? "url(#red-glow-mob)" : undefined}
                                                                style={{ transition: 'all 220ms ease-in-out' }}
                                                            />
                                                        );
                                                    })}
                                                    </svg>
                                                    <span className="text-[10px] font-medium text-[#0F172A] mt-[3px] mb-2.5 md:mb-0 tracking-tight leading-none text-center" style={{ transform: "translateY(-4px)" }}>
                                                        Últimos 10 meses
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </Card>

                                {/* CARD DESPESAS */}
                                <Card
                                    className="pl-3 pr-[20px] pt-[8px] pb-[12px] relative overflow-hidden card-despesas md:p-6 md:flex md:flex-col h-full w-full justify-between rounded-[22px]"
                                    style={{
                                        borderRadius: "22px",
                                        background: "radial-gradient(circle at top right, rgba(255,255,255,.85), transparent 60%), linear-gradient(135deg, rgba(239,68,68,.06) 0%, rgba(239,68,68,.10) 35%, rgba(239,68,68,.05) 70%, rgba(239,68,68,.07) 85%, rgba(239,68,68,.10) 100%), #FFF5F5",
                                        border: "1px solid rgba(255,255,255,0.85)",
                                        backgroundClip: "padding-box",
                                        outline: "none",
                                        boxShadow: "0 8px 24px rgba(239,68,68,0.06), 0 2px 6px rgba(239,68,68,0.03), inset 0 1px 0 rgba(255,255,255,.95)"
                                    }}
                                >
                                    {/* Formas orgânicas temáticas de fundo */}
                                    <div aria-hidden="true" className="absolute inset-0 pointer-events-none overflow-hidden rounded-[22px]" style={{ zIndex: 0 }}>
                                        <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 400 180">
                                            <defs>
                                                <linearGradient id="wave-grad-despesas-mob" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.75" />
                                                    <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.15" />
                                                </linearGradient>
                                            </defs>
                                            {/* Curva suave superior */}
                                            <path d="M 60,0 C 150,55 240,65 380,15 L 400,0 Z" fill="rgba(255,255,255,0.5)" />
                                            {/* Onda suave que envolve a base */}
                                            <path d="M 0,180 Q 120,115 220,135 T 400,85 L 400,180 Z" fill="url(#wave-grad-despesas-mob)" />
                                        </svg>
                                    </div>

                                    <div className="flex flex-col justify-center h-full w-full relative z-20">
                                        <div className="flex justify-between items-start w-full mb-2">
                                            <div className="flex flex-col md:mt-3">
                                                <div className="flex items-center gap-1.5 mb-1 md:-mt-[1px] relative -top-[5px]" style={{ marginTop: "calc(var(--home-title-mt, 3px) + 10px)" }}>
                                                    <h2 className="leading-none tracking-[0.5px]" style={{ color: isMobile ? "#ef4444" : "#b91c1c", fontFamily: "'Inter', sans-serif", fontSize: "var(--home-title-text, 15px)", fontWeight: 700 }}>Despesas</h2>
                                                </div>
                                                <p className="leading-none transition-all relative -top-[3px]" style={{ marginTop: "var(--home-val-mt, -5px)", fontSize: "22px", fontWeight: 700, fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', color: "#0F172A", letterSpacing: "-0.5px" }}>
                                                    <FormatCurrencyStyled value={dStats.currentExpenses} prefixColor={isCurrentMonth ? (isMobile ? "#ef4444" : "#b91c1c") : undefined} />
                                                </p>
                                            </div>
                                            <Button
                                                className="btn-3d px-4 rounded-[11px] font-bold border-none transition-all duration-200 shadow-[0_2px_4px_rgba(0,0,0,0.05)] w-[135px] -mr-1 flex items-center justify-center gap-1"
                                                style={{ "--cor-topo": "#FFFFFF", "--cor-base": "#F1F5F9", borderBottom: "1px solid rgba(0,0,0,0.12)", boxShadow: "inset 0px 1px 0px rgba(0, 0, 0, 0.1), inset 0px -2px 3px rgba(0, 0, 0, 0.15)", height: isMobile ? "var(--home-btn-h, 36px)" : "40px", fontSize: isMobile ? "var(--home-btn-text, 14px)" : "15px", color: "#ef4444" } as any}
                                                onClick={() => navigate(`/lancamentos?type=expense&month=${format(selectedMonth, "yyyy-MM-dd")}`)}
                                            >
                                                Ver Gastos <DynamicIcon name="ChevronRight" className="h-3.5 w-3.5" strokeWidth={4} />
                                            </Button>
                                        </div>

                                        <div className="flex items-center justify-between mt-2">
                                            <div className="flex items-start gap-2">
                                                <Button
                                                    onClick={() => navigate("/dashboard?filter=expenses")}
                                                    className="p-0 flex items-center justify-center rounded-xl border-none transition-all active:scale-90 shrink-0"
                                                    style={{ width: "var(--home-btn-h, 36px)", height: "var(--home-btn-h, 36px)", background: "#ef4444", filter: "saturate(0.84)", boxShadow: "0 4px 10px rgba(239,68,68,0.12), inset 0 1px 1px rgba(255,255,255,0.3)" }}
                                                >
                                                    <TrendingDown className="h-[18px] w-[18px] text-white" strokeWidth={3} />
                                                </Button>
                                                <div className="flex flex-col items-start gap-0.5">
                                                    <div 
                                                         className={cn(
                                                             "flex items-center px-2 py-0.5 rounded-[10px] text-[10px] font-bold border-none tracking-tight leading-none h-[18px]",
                                                             dStats.expenseVar >= 0 ? "text-[#dc2626] bg-[#fef2f2]" : "text-[#16a34a] bg-[#f0fdf4]"
                                                         )}
                                                         style={{ 
                                                             border: "1px solid rgba(255,255,255,.85)",
                                                             backdropFilter: "blur(6px)",
                                                             boxShadow: "0 2px 6px rgba(0,0,0,.04)"
                                                         }}
                                                    >
                                                        {dStats.expenseVar >= 0 ? "↑ +" : "↓ "} {Math.abs(dStats.expenseVar).toFixed(1)}%
                                                    </div>
                                                    <span className="text-[10px] font-normal leading-tight" style={{ color: "#0F172A" }}>Mês anterior</span>
                                                </div>
                                            </div>
                                            <Button
                                                className="px-4 rounded-[11px] font-bold text-white border-none transition-all hover:-translate-y-[1px] active:translate-y-[1px] active:shadow-[0_3px_8px_rgba(0,0,0,0.4)] w-[135px] -mr-1 flex items-center justify-center gap-1"
                                                style={{ height: isMobile ? "var(--home-btn-h, 36px)" : "40px", fontSize: isMobile ? "var(--home-btn-text, 14px)" : "15px", background: "linear-gradient(135deg, #ef4444, #dc2626)", borderBottom: "1px solid rgba(0,0,0,0.4)", filter: "saturate(0.85)", boxShadow: "0 4px 12px rgba(0,0,0,.08), inset 0 1px 0 rgba(255,255,255,.25)", textShadow: "0 1px 1px rgba(0, 0, 0, 0.15)" }}
                                                onClick={() => navigate("/despesas")}
                                            >
                                                <span className="text-[18px] leading-none mb-[2px] font-medium">+</span>
                                                Nova Despesa
                                            </Button>
                                        </div>
                                    </div>
                                </Card>

                                {/* CARD RECEITAS */}
                                <Card
                                    className="pl-3 pr-[20px] pt-[8px] pb-[12px] relative overflow-hidden card-receitas md:p-6 md:flex md:flex-col h-full w-full justify-between rounded-[22px]"
                                    style={{
                                        borderRadius: "22px",
                                        background: "radial-gradient(circle at top right, rgba(255,255,255,.85), transparent 60%), linear-gradient(135deg, rgba(34,197,94,.13) 0%, rgba(34,197,94,.10) 35%, rgba(34,197,94,.05) 70%, rgba(34,197,94,.07) 85%, rgba(34,197,94,.10) 100%), #F3FFF7",
                                        border: "1px solid rgba(255,255,255,0.85)",
                                        backgroundClip: "padding-box",
                                        outline: "none",
                                        boxShadow: "0 8px 24px rgba(34,197,94,0.06), 0 2px 6px rgba(34,197,94,0.03), inset 0 1px 0 rgba(255,255,255,.95)"
                                    }}
                                >
                                    {/* Formas orgânicas temáticas de fundo */}
                                    <div aria-hidden="true" className="absolute inset-0 pointer-events-none overflow-hidden rounded-[22px]" style={{ zIndex: 0 }}>
                                        <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 400 180">
                                            <defs>
                                                <linearGradient id="wave-grad-receitas-mob" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.75" />
                                                    <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.15" />
                                                </linearGradient>
                                            </defs>
                                            {/* Curva suave superior */}
                                            <path d="M 60,0 C 150,55 240,65 380,15 L 400,0 Z" fill="rgba(255,255,255,0.5)" />
                                            {/* Onda suave que envolve a base */}
                                            <path d="M 0,180 Q 120,115 220,135 T 400,85 L 400,180 Z" fill="url(#wave-grad-receitas-mob)" />
                                        </svg>
                                    </div>

                                    <div className="flex flex-col justify-center h-full w-full relative z-20">
                                        <div className="flex justify-between items-start w-full mb-2">
                                            <div className="flex flex-col md:mt-3">
                                                <div className="flex items-center gap-1.5 mb-1 md:-mt-[1px] relative -top-[5px]" style={{ marginTop: "calc(var(--home-title-mt, 3px) + 10px)" }}>
                                                    <h2 className="leading-none tracking-[0.5px]" style={{ color: "#15803d", fontFamily: "'Inter', sans-serif", fontSize: "var(--home-title-text, 15px)", fontWeight: 700 }}>Receitas</h2>
                                                </div>
                                                <p className="leading-none transition-all relative -top-[3px]" style={{ marginTop: "var(--home-val-mt, -5px)", fontSize: "22px", fontWeight: 700, fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', color: "#0F172A", letterSpacing: "-0.5px" }}>
                                                    <FormatCurrencyStyled value={dStats.currentIncome} prefixColor={isCurrentMonth ? "#15803d" : undefined} />
                                                </p>
                                            </div>
                                            <Button
                                                className="btn-3d px-4 rounded-[11px] font-bold border-none transition-all duration-200 shadow-[0_2px_4px_rgba(0,0,0,0.05)] w-[135px] -mr-1 flex items-center justify-center gap-1"
                                                style={{ "--cor-topo": "#FFFFFF", "--cor-base": "#F1F5F9", borderBottom: "1px solid rgba(0,0,0,0.12)", boxShadow: "inset 0px 1px 0px rgba(0, 0, 0, 0.1), inset 0px -2px 3px rgba(0, 0, 0, 0.15)", height: isMobile ? "var(--home-btn-h, 36px)" : "40px", fontSize: isMobile ? "var(--home-btn-text, 14px)" : "15px", color: "#15803d" } as any}
                                                onClick={() => navigate(`/lancamentos?type=income&month=${format(selectedMonth, "yyyy-MM-dd")}`)}
                                            >
                                                Ver Receitas <DynamicIcon name="ChevronRight" className="h-3.5 w-3.5" strokeWidth={4} />
                                            </Button>
                                        </div>

                                        <div className="flex items-center justify-between mt-2">
                                            <div className="flex items-start gap-2">
                                                <Button
                                                    onClick={() => navigate("/dashboard?filter=revenues")}
                                                    className="p-0 flex items-center justify-center rounded-xl border-none transition-all active:scale-90 shrink-0"
                                                    style={{ width: "var(--home-btn-h, 36px)", height: "var(--home-btn-h, 36px)", background: "linear-gradient(135deg, #22c55e, #16a34a)", filter: "saturate(0.84)", boxShadow: "0 4px 10px rgba(34,197,94,0.12), inset 0 1px 1px rgba(255,255,255,0.3)" }}
                                                >
                                                    <TrendingUp className="h-[18px] w-[18px] text-white" strokeWidth={3} />
                                                </Button>
                                                <div className="flex flex-col items-start gap-0.5">
                                                    <div 
                                                         className={cn(
                                                             "flex items-center px-2 py-0.5 rounded-[10px] text-[10px] font-bold border-none tracking-tight leading-none h-[18px]",
                                                             dStats.incomeVar >= 0 ? "text-[#16a34a] bg-[#f0fdf4]" : "text-[#dc2626] bg-[#fef2f2]"
                                                         )}
                                                         style={{ 
                                                             border: "1px solid rgba(255,255,255,.85)",
                                                             backdropFilter: "blur(6px)",
                                                             boxShadow: "0 2px 6px rgba(0,0,0,.04)"
                                                         }}
                                                    >
                                                        {dStats.incomeVar >= 0 ? "↑ +" : "↓ "} {Math.abs(dStats.incomeVar).toFixed(1)}%
                                                    </div>
                                                    <span className="text-[10px] font-normal leading-tight" style={{ color: "#0F172A" }}>Mês anterior</span>
                                                </div>
                                            </div>
                                            <Button
                                                className="px-4 rounded-[11px] font-bold text-white border-none transition-all hover:-translate-y-[1px] active:translate-y-[1px] active:shadow-[0_3px_8px_rgba(0,0,0,0.4)] w-[135px] -mr-1 flex items-center justify-center gap-1"
                                                style={{ height: isMobile ? "var(--home-btn-h, 36px)" : "40px", fontSize: isMobile ? "var(--home-btn-text, 14px)" : "15px", background: "linear-gradient(135deg, #22c55e, #16a34a)", borderBottom: "1px solid rgba(0,0,0,0.4)", filter: "saturate(0.85)", boxShadow: "0 4px 12px rgba(0,0,0,.08), inset 0 1px 0 rgba(255,255,255,.25)", textShadow: "0 1px 1px rgba(0, 0, 0, 0.15)" }}
                                                onClick={() => navigate("/receitas")}
                                            >
                                                <span className="text-[18px] leading-none mb-[2px] font-medium">+</span>
                                                Nova Receita
                                            </Button>
                                        </div>
                                    </div>
                                </Card>

                                <div id="cartoes-section" className="h-full w-full">
                                    <MobileCreditCardExpenses
                                        cartoes={cartoes}
                                        expenseInstallments={dExpenses}
                                        allCategories={allSubcategories as any}
                                        isMobile={isMobile}
                                        selectedMonth={dMonth}
                                        isLoading={isCardsLoading}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-[21px] md:auto-rows-fr md:items-stretch">
                        {/* CARD PRINCIPAL — SALDO MENSAL (HERO) */}
                        <Card
                            className="rounded-[24px] relative overflow-hidden card-saldo h-full flex flex-col justify-center home-desk-card md:p-6 md:flex md:flex-col md:justify-between"
                            style={{
                                background: "radial-gradient(circle at top right, rgba(255,255,255,.70), transparent 60%), linear-gradient(135deg, #E2EDFC 0%, #E8F1FD 35%, #EEF5FF 70%, rgba(37,99,235,0.11) 85%, rgba(37,99,235,0.15) 100%)",
                                border: "1px solid rgba(255,255,255,0.85)",
                                backgroundClip: "padding-box",
                                outline: "none",
                                boxShadow: "0 8px 24px rgba(37,99,235,0.06), 0 2px 6px rgba(37,99,235,0.03), inset 0 1px 0 rgba(255,255,255,.95)"
                            }}
                        >
                            {/* Formas orgânicas temáticas de fundo */}
                            <div aria-hidden="true" className="absolute inset-0 pointer-events-none overflow-hidden rounded-[22px]" style={{ zIndex: 0 }}>
                                <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 500 220">
                                    <defs>
                                        <linearGradient id="wave-grad-desk" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.75" />
                                            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.12" />
                                        </linearGradient>
                                    </defs>
                                    {/* Curva suave superior */}
                                    <path d="M 80,0 C 180,60 300,75 480,20 L 500,0 Z" fill="rgba(255,255,255,0.5)" />
                                    {/* Onda orgânica que acompanha o gráfico */}
                                    <path d="M 0,220 Q 150,135 280,165 T 500,105 L 500,220 Z" fill="url(#wave-grad-desk)" />
                                </svg>
                            </div>

                            <div className="flex flex-col h-full w-full justify-between relative z-20">
                                {/* HEADER: Título e seletor de mês com indicador Últimos 10 meses */}
                                <div className="flex justify-between items-start w-full">
                                    <div 
                                        className="flex flex-col cursor-pointer group transition-all active:opacity-70"
                                        onClick={() => setIsAjusteModalOpen(true)}
                                    >
                                        <div className="flex items-center gap-2 mb-1">
                                            <h2 className="text-[15px] tracking-[0.5px] md:text-[17px]" style={{ color: "#2563EB", fontFamily: "'Inter', sans-serif", fontWeight: 700 }}>Saldo em conta</h2>
                                            <button 
                                                className="btn-3d w-7 h-7 flex items-center justify-center rounded-full border border-blue-200/50 transition-all active:scale-95 shadow-[0_2px_5px_rgba(37,99,235,0.15)]"
                                                aria-label="Ajustar saldo"
                                                type="button"
                                                style={{ "--cor-topo": "#ffffff", "--cor-base": "#eff6ff" } as any}
                                            >
                                                <DynamicIcon name="Wallet" className="h-4 w-4 text-[#2563EB]" style={{ filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.05))" }} />
                                            </button>
                                        </div>
                                        <p className="leading-none transition-all" style={{ marginTop: "-3px", fontSize: "26px", fontWeight: 700, fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', color: dStats.currentCaixaAtual < 0 ? (isMobile ? "#ef4444" : "#b91c1c") : "#0F172A", letterSpacing: "-0.5px", WebkitFontSmoothing: "antialiased", MozOsxFontSmoothing: "grayscale", fontVariantNumeric: "tabular-nums", fontFeatureSettings: '"tnum"', textRendering: "optimizeLegibility" }}>
                                            <FormatCurrencyStyled value={dStats.currentCaixaAtual} prefixColor={dStats.currentCaixaAtual < 0 ? (isMobile ? "#ef4444" : "#b91c1c") : "#0F172A"} />
                                        </p>
                                    </div>
                                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                                        <div
                                            className="flex items-center justify-between px-1 rounded-[11px] transition-all h-9 w-[150px] bg-[#f1f5f9] cursor-pointer border border-slate-200/60"
                                            style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}
                                        >
                                            <button onClick={handlePrevMonth} className="text-[#4b5563] border-none rounded-[8px] p-0 h-7 w-7 flex items-center justify-center transition-all hover:opacity-90 bg-white shadow-sm" style={{ border: "1px solid rgba(0,0,0,0.05)" }}>
                                                <DynamicIcon name="ChevronLeft" className="h-3.5 w-3.5" strokeWidth={3} />
                                            </button>
                                            <span className="text-[12px] font-bold text-[#1e293b] px-1 flex-1 text-center uppercase tracking-tight pt-[1px] whitespace-nowrap md:text-[13px]">
                                                {format(selectedMonth, "MMM / y", { locale: ptBR }).replace(".", "")}
                                            </span>
                                            <button onClick={handleNextMonth} className="text-[#4b5563] border-none rounded-[8px] p-0 h-7 w-7 flex items-center justify-center transition-all hover:opacity-90 bg-white shadow-sm" style={{ border: "1px solid rgba(0,0,0,0.05)" }}>
                                                <DynamicIcon name="ChevronRight" className="h-3.5 w-3.5" strokeWidth={3} />
                                            </button>
                                        </div>

                                        {/* Sparkline Graph movido para baixo do Date Selector */}
                                        <div className="w-full flex flex-col items-center mt-6">
                                            <svg viewBox="0 0 160 45" className="w-full max-w-[210px] h-[75px] overflow-visible">
                                                <defs>
                                                    <linearGradient id="sparkline-grad-desk" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="0%" stopColor="#2563EB" stopOpacity="0.18" />
                                                        <stop offset="70%" stopColor="#2563EB" stopOpacity="0.03" />
                                                        <stop offset="100%" stopColor="#2563EB" stopOpacity="0.00" />
                                                    </linearGradient>
                                                    <filter id="line-glow-desk" x="-10%" y="-10%" width="120%" height="130%">
                                                        <feDropShadow dx="0" dy="3" stdDeviation="2.5" floodColor="#2563EB" floodOpacity="0.18" />
                                                    </filter>
                                                    <filter id="red-glow-desk" x="-40%" y="-40%" width="180%" height="180%">
                                                        <feGaussianBlur in="SourceAlpha" stdDeviation="1.2" result="blur" />
                                                        <feOffset dx="0" dy="1" />
                                                        <feComponentTransfer in="blur" result="glow">
                                                          <feFuncA type="linear" slope="0.3" />
                                                        </feComponentTransfer>
                                                        <feMerge>
                                                          <feMergeNode in="glow" />
                                                          <feMergeNode in="SourceGraphic" />
                                                        </feMerge>
                                                    </filter>
                                                </defs>
                                                <path
                                                    d={fillPath}
                                                    fill="url(#sparkline-grad-desk)"
                                                    style={{ transition: 'all 220ms ease-in-out' }}
                                                />
                                                <path
                                                    d={linePath}
                                                    fill="none"
                                                    stroke="#2563EB"
                                                    strokeWidth="2.5"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    filter="url(#line-glow-desk)"
                                                    style={{ transition: 'all 220ms ease-in-out' }}
                                                />
                                                {sparklinePoints.map((pt, idx) => {
                                                    const isSelected = idx === selectedMonthIdx;
                                                    return (
                                                        <circle
                                                            key={idx}
                                                            cx={pt.x}
                                                            cy={pt.y}
                                                            r={isSelected ? 4.2 : 3.5}
                                                            fill={isSelected ? "#EF6C6C" : "#2563EB"}
                                                            stroke="#ffffff"
                                                            strokeWidth={isSelected ? 1.6 : 1.5}
                                                            filter={isSelected ? "url(#red-glow-desk)" : undefined}
                                                            style={{ transition: 'all 220ms ease-in-out' }}
                                                        />
                                                    );
                                                })}
                                            </svg>
                                            <span className="text-[11px] font-medium text-[#0F172A] leading-none whitespace-nowrap mt-2.5 opacity-90">Últimos 10 meses</span>
                                        </div>
                                    </div>
                                </div>

                                {/* CONTENT/BASE: Saldo Mensal à esquerda e Sparkline à direita */}
                                <div className="flex justify-between items-end w-full mt-auto mb-2">
                                    {/* Informações Secundárias e Ações */}
                                    <div className="flex flex-col items-start justify-center pb-0 z-10 mr-4 -mt-4">
                                        {/* Saldo Mensal agrupado com Ícone Azul */}
                                        <div className="flex items-center gap-3">
                                            <Button
                                                onClick={() => setActiveTrendModal("saldo")}
                                                className="w-9 h-9 p-0 flex items-center justify-center rounded-xl border-none transition-all active:scale-90 shrink-0"
                                                style={{ background: "#2563EB", filter: "saturate(0.95)", boxShadow: "0 6px 14px rgba(37,99,235,0.15)", transform: "translateY(-4px)" }}
                                            >
                                                <DynamicIcon name="LineChart" className="h-[18px] w-[18px] text-white" strokeWidth={3} />
                                            </Button>
                                            <div className="flex flex-col items-start" style={{ transform: "translateY(-4px)" }}>
                                                <span className="text-[12px] font-medium leading-[1.2] tracking-normal text-[#64748B] mb-1">
                                                    Saldo em {format(selectedMonth, "MMMM", { locale: ptBR }).replace(/^\w/, c => c.toUpperCase())}
                                                </span>
                                                <span className="text-[16px] font-bold text-[#334155] tracking-tight leading-none">
                                                    {formatCurrency(dStats.currentBalance)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                </div>
                            </div>
                        </Card>

                        {/* CARD DE CARTÃO DE CRÉDITO */}
                        <div id="cartoes-section" className="mb-4 h-full w-full flex">
                            <MobileCreditCardExpenses
                                cartoes={cartoes}
                                expenseInstallments={dExpenses}
                                allCategories={allSubcategories as any}
                                isMobile={isMobile}
                                selectedMonth={dMonth}
                                isLoading={isCardsLoading}
                            />
                        </div>

                        {/* CARD DESPESAS */}
                        <Card
                            className="rounded-[24px] relative overflow-hidden h-full flex flex-col justify-center home-desk-card md:p-6 md:flex md:flex-col md:justify-between"
                            style={{
                                background: "radial-gradient(circle at top right, rgba(255,255,255,.70), transparent 60%), linear-gradient(135deg, rgba(239,68,68,.06) 0%, rgba(239,68,68,.10) 35%, rgba(239,68,68,.07) 70%, rgba(239,68,68,.12) 85%, rgba(239,68,68,.16) 100%), #FFF5F5",
                                border: "1px solid rgba(255,255,255,0.85)",
                                backgroundClip: "padding-box",
                                outline: "none",
                                boxShadow: "0 8px 24px rgba(239,68,68,0.06), 0 2px 6px rgba(239,68,68,0.03), inset 0 1px 0 rgba(255,255,255,.95)"
                            }}
                        >
                            {/* Formas orgânicas temáticas de fundo */}
                            <div aria-hidden="true" className="absolute inset-0 pointer-events-none overflow-hidden rounded-[22px]" style={{ zIndex: 0 }}>
                                <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 500 220">
                                    <defs>
                                        <linearGradient id="wave-grad-despesas-desk" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.75" />
                                            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.12" />
                                        </linearGradient>
                                    </defs>
                                    {/* Curva suave superior */}
                                    <path d="M 80,0 C 180,60 300,75 480,20 L 500,0 Z" fill="rgba(255,255,255,0.5)" />
                                    {/* Onda orgânica inferior */}
                                    <path d="M 0,220 Q 150,135 280,165 T 500,105 L 500,220 Z" fill="url(#wave-grad-despesas-desk)" />
                                </svg>
                            </div>

                            <div className="flex flex-col h-full w-full justify-between relative z-20">
                                {/* HEADER */}
                                <div className="flex justify-between items-start w-full">
                                    <div className="flex flex-col">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h2 className="text-[15px] tracking-[0.5px] md:text-[17px]" style={{ color: "#b91c1c", fontFamily: "'Inter', sans-serif", fontWeight: 700 }}>Despesas</h2>
                                        </div>
                                        <p className="leading-none transition-all" style={{ marginTop: "-3px", fontSize: "26px", fontWeight: 700, fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', color: "#0F172A", letterSpacing: "-0.5px", WebkitFontSmoothing: "antialiased", MozOsxFontSmoothing: "grayscale", fontVariantNumeric: "tabular-nums", fontFeatureSettings: '"tnum"', textRendering: "optimizeLegibility" }}>
                                            <FormatCurrencyStyled value={dStats.currentExpenses} prefixColor={isCurrentMonth ? "#b91c1c" : undefined} />
                                        </p>
                                    </div>
                                    <div className="shrink-0 flex items-start">
                                        <Button
                                            className="btn-3d h-9 md:h-[40px] px-4 rounded-[11px] font-bold text-sm md:text-[15px] whitespace-nowrap w-[150px] transition-all duration-200 shadow-[0_2px_4px_rgba(0,0,0,0.05)] border-none"
                                            style={{ 
                                                "--cor-topo": "#FFFFFF", 
                                                "--cor-base": "#F1F5F9", 
                                                borderBottom: "1px solid rgba(0,0,0,0.12)",
                                                boxShadow: "inset 0px 1px 0px rgba(0, 0, 0, 0.1), inset 0px -2px 3px rgba(0, 0, 0, 0.15)",
                                                color: "#ef4444"
                                            } as any}
                                            onClick={() => navigate(`/lancamentos?type=expense&month=${format(selectedMonth, "yyyy-MM-dd")}`)}
                                        >
                                            Ver Gastos <DynamicIcon name="ChevronRight" className="ml-1.5 h-3 w-3" strokeWidth={4} />
                                        </Button>
                                    </div>
                                </div>

                                {/* CONTENT/BASE */}
                                <div className="flex items-end justify-between w-full mt-4">
                                    <div className="flex items-center gap-2">
                                        <Button
                                            onClick={() => setActiveTrendModal("despesas")}
                                            className="w-9 h-9 p-0 flex items-center justify-center rounded-xl border-none transition-all active:scale-90 shrink-0"
                                            style={{ background: "#ef4444", filter: "saturate(0.95)", boxShadow: "0 6px 14px rgba(0,0,0,0.12)" }}
                                        >
                                            <TrendingDown className="h-[18px] w-[18px] text-white" strokeWidth={3} />
                                        </Button>
                                        <div className="flex flex-col items-start gap-0.5 mt-1">
                                            <div className={cn(
                                                 "flex items-center px-2 py-0.5 rounded-[10px] text-[10px] font-bold border-none",
                                                 dStats.expenseVar >= 0 ? "text-[#dc2626] bg-[#fef2f2]" : "text-[#16a34a] bg-[#f0fdf4]"
                                            )} style={{ border: "1px solid rgba(255,255,255,.85)", backdropFilter: "blur(6px)", boxShadow: "0 2px 6px rgba(0,0,0,.04)" }}>
                                                {dStats.expenseVar >= 0 ? "↑ +" : "↓ "} {Math.abs(dStats.expenseVar).toFixed(1)}%
                                            </div>
                                            <span className="text-[10px] font-normal leading-tight md:text-[12px]" style={{ color: "#0F172A" }}>Mês anterior</span>
                                        </div>
                                    </div>
                                    <div className="shrink-0 flex items-end">
                                        <Button
                                            className="h-9 md:h-[40px] px-4 rounded-[11px] font-bold text-sm md:text-[15px] text-white border-none transition-all hover:-translate-y-[1px] active:translate-y-[1px] active:shadow-[0_3px_8px_rgba(0,0,0,0.4)] w-[150px]"
                                            style={{ background: "linear-gradient(135deg, #ef4444, #dc2626)", borderBottom: "1px solid rgba(0,0,0,0.4)", filter: "saturate(0.85)", boxShadow: "0 4px 12px rgba(0,0,0,.08), inset 0 1px 0 rgba(255,255,255,.25)", textShadow: "0 1px 1px rgba(0, 0, 0, 0.15)" }}
                                            onClick={() => navigate("/despesas")}
                                        >
                                            <Plus className="mr-1.5 h-4 w-4 text-white" strokeWidth={4} />
                                            Nova Despesa
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </Card>

                        {/* CARD RECEITAS */}
                        <Card
                            className="rounded-[24px] relative overflow-hidden h-full flex flex-col justify-center home-desk-card md:p-6 md:flex md:flex-col md:justify-between"
                            style={{
                                background: "radial-gradient(circle at top right, rgba(255,255,255,.70), transparent 60%), linear-gradient(135deg, rgba(34,197,94,.13) 0%, rgba(34,197,94,.10) 35%, rgba(34,197,94,.07) 70%, rgba(34,197,94,.12) 85%, rgba(34,197,94,.16) 100%), #F3FFF7",
                                border: "1px solid rgba(255,255,255,0.85)",
                                backgroundClip: "padding-box",
                                outline: "none",
                                boxShadow: "0 8px 24px rgba(34,197,94,0.06), 0 2px 6px rgba(34,197,94,0.03), inset 0 1px 0 rgba(255,255,255,.95)"
                            }}
                        >
                            {/* Formas orgânicas temáticas de fundo */}
                            <div aria-hidden="true" className="absolute inset-0 pointer-events-none overflow-hidden rounded-[22px]" style={{ zIndex: 0 }}>
                                <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 500 220">
                                    <defs>
                                        <linearGradient id="wave-grad-receitas-desk" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.75" />
                                            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.12" />
                                        </linearGradient>
                                    </defs>
                                    {/* Curva suave superior */}
                                    <path d="M 80,0 C 180,60 300,75 480,20 L 500,0 Z" fill="rgba(255,255,255,0.5)" />
                                    {/* Onda orgânica inferior */}
                                    <path d="M 0,220 Q 150,135 280,165 T 500,105 L 500,220 Z" fill="url(#wave-grad-receitas-desk)" />
                                </svg>
                            </div>

                            <div className="flex flex-col h-full w-full justify-between relative z-20">
                                {/* HEADER */}
                                <div className="flex justify-between items-start w-full">
                                    <div className="flex flex-col">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h2 className="text-[15px] tracking-[0.5px] md:text-[17px]" style={{ color: "#15803d", fontFamily: "'Inter', sans-serif", fontWeight: 700 }}>Receitas</h2>
                                        </div>
                                        <p className="leading-none transition-all" style={{ marginTop: "-3px", fontSize: "26px", fontWeight: 700, fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', color: "#0F172A", letterSpacing: "-0.5px", WebkitFontSmoothing: "antialiased", MozOsxFontSmoothing: "grayscale", fontVariantNumeric: "tabular-nums", fontFeatureSettings: '"tnum"', textRendering: "optimizeLegibility" }}>
                                            <FormatCurrencyStyled value={dStats.currentIncome} prefixColor={isCurrentMonth ? "#15803d" : undefined} />
                                        </p>
                                    </div>
                                    <div className="shrink-0 flex items-start">
                                        <Button
                                            className="btn-3d h-9 md:h-[40px] px-4 rounded-[11px] font-bold text-sm md:text-[15px] whitespace-nowrap w-[150px] transition-all duration-200 shadow-[0_2px_4px_rgba(0,0,0,0.05)] border-none"
                                            style={{ 
                                                "--cor-topo": "#FFFFFF", 
                                                "--cor-base": "#F1F5F9", 
                                                borderBottom: "1px solid rgba(0,0,0,0.12)",
                                                boxShadow: "inset 0px 1px 0px rgba(0, 0, 0, 0.1), inset 0px -2px 3px rgba(0, 0, 0, 0.15)",
                                                color: "#15803d"
                                            } as any}
                                            onClick={() => navigate(`/lancamentos?type=income&month=${format(selectedMonth, "yyyy-MM-dd")}`)}
                                        >
                                            Ver Receitas <DynamicIcon name="ChevronRight" className="ml-1.5 h-3 w-3" strokeWidth={4} />
                                        </Button>
                                    </div>
                                </div>

                                {/* CONTENT/BASE */}
                                <div className="flex items-end justify-between w-full mt-4">
                                    <div className="flex items-center gap-2">
                                        <Button
                                            onClick={() => setActiveTrendModal("receitas")}
                                            className="w-9 h-9 p-0 flex items-center justify-center rounded-xl border-none transition-all active:scale-90 shrink-0"
                                            style={{ background: "#22c55e", filter: "saturate(0.95)", boxShadow: "0 6px 14px rgba(0,0,0,0.12)" }}
                                        >
                                            <TrendingUp className="h-[18px] w-[18px] text-white" strokeWidth={3} />
                                        </Button>
                                        <div className="flex flex-col items-start gap-0.5 mt-1">
                                            <div className={cn(
                                                 "flex items-center px-2 py-0.5 rounded-[10px] text-[10px] font-bold border-none",
                                                 dStats.incomeVar >= 0 ? "text-[#16a34a] bg-[#f0fdf4]" : "text-[#dc2626] bg-[#fef2f2]"
                                            )} style={{ border: "1px solid rgba(255,255,255,.85)", backdropFilter: "blur(6px)", boxShadow: "0 2px 6px rgba(0,0,0,.04)" }}>
                                                {dStats.incomeVar >= 0 ? "↑ +" : "↓ "} {Math.abs(dStats.incomeVar).toFixed(1)}%
                                            </div>
                                            <span className="text-[10px] font-normal leading-tight md:text-[12px]" style={{ color: "#0F172A" }}>Mês anterior</span>
                                        </div>
                                    </div>
                                    <div className="shrink-0 flex items-end">
                                        <Button
                                            className="h-9 md:h-[40px] px-4 rounded-[11px] font-bold text-sm md:text-[15px] text-white border-none transition-all hover:-translate-y-[1px] active:translate-y-[1px] active:shadow-[0_3px_8px_rgba(0,0,0,0.4)] w-[150px]"
                                            style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)", borderBottom: "1px solid rgba(0,0,0,0.4)", filter: "saturate(0.85)", boxShadow: "0 4px 12px rgba(0,0,0,.08), inset 0 1px 0 rgba(255,255,255,.25)", textShadow: "0 1px 1px rgba(0, 0, 0, 0.15)" }}
                                            onClick={() => navigate("/receitas")}
                                        >
                                            <Plus className="mr-1.5 h-4 w-4 text-white" strokeWidth={4} />
                                            Nova Receita
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    </div>
                )}
            </main>
            {user && (
                <SaldoAjusteDialog
                    isOpen={isAjusteModalOpen}
                    onOpenChange={setIsAjusteModalOpen}
                    saldoCalculadoSistema={dStats.saldoCalculadoSistema}
                    saldoAtualComAjuste={dStats.currentCaixaAtual}
                    userId={user.id}
                    onAjusteSalvo={refetchProfile}
                    isMobile={!!isMobile}
                />
            )}
            <Dialog open={activeTrendModal !== null} onOpenChange={(open) => !open && setActiveTrendModal(null)}>
                <DialogContent className="sm:max-w-[700px] p-0 overflow-hidden border-[2px] border-[#3b82f6]/15 shadow-2xl rounded-[21px] bg-white/95 backdrop-blur-md">
                    <DialogHeader className="p-6 pb-2 text-left relative flex flex-row items-center w-full">
                        <div className="flex items-center gap-3">
                            <div
                              className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border border-white/20 shadow-sm"
                              style={{ 
                                background: activeTrendModal === 'saldo' ? "linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)" : 
                                           activeTrendModal === 'receitas' ? "linear-gradient(135deg, #14532d 0%, #22c55e 100%)" :
                                           "linear-gradient(135deg, #7f1d1d 0%, #ef4444 100%)" 
                              }}
                            >
                              <span className="text-[22px] select-none leading-none">
                                {activeTrendModal === 'saldo' ? "📊" : activeTrendModal === 'receitas' ? "📈" : "📉"}
                              </span>
                            </div>
                            <div className="flex flex-col">
                                <DialogTitle className="text-lg md:text-xl font-extrabold tracking-[0.5px] -mt-0.5" style={{ color: activeTrendModal === 'saldo' ? "#1e3a8a" : activeTrendModal === 'receitas' ? "#14532d" : "#7f1d1d", fontFamily: "'Inter', sans-serif" }}>
                                    {activeTrendModal === 'saldo' && "Evolução do Saldo Mensal"}
                                    {activeTrendModal === 'despesas' && "Evolução das Despesas"}
                                    {activeTrendModal === 'receitas' && "Evolução das Receitas"}
                                </DialogTitle>
                                <DialogDescription className="text-xs md:text-sm font-bold text-slate-500 tracking-wider opacity-80 mt-[-3px]">
                                    {activeTrendModal === 'saldo' && "Acompanhe a evolução do saldo acumulado."}
                                    {activeTrendModal === 'despesas' && "Acompanhe a evolução das despesas."}
                                    {activeTrendModal === 'receitas' && "Acompanhe a evolução das receitas."}
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>
                    <div className="p-6 pt-2 pb-6 h-auto flex flex-col w-full">
                        {activeTrendModal === 'saldo' && (() => {
                            const year = format(selectedMonth, "yyyy");
                            const annualRev = getAnnualRevenues(Number(year));
                            const annualExp = getAnnualExpenses(Number(year));
                            const annualBal = annualRev - annualExp;
                            return (
                            <div className="flex flex-col w-full">
                                <div className="flex justify-between items-start w-full mb-6">
                                    <div className="flex flex-col">
                                        <h2 className="text-[15px] font-extrabold tracking-[0.5px] mb-1 md:text-[17px]" style={{ color: "#0556C3", fontFamily: "'Inter', sans-serif" }}>Saldo Mensal</h2>
                                        <p className="text-[21px] font-[800] leading-none md:text-[25px]" style={{ marginTop: "-3px", fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', color: dStats.currentBalance < 0 ? "#b91c1c" : (isCurrentMonth ? "#1f2937" : "#4B5563"), WebkitFontSmoothing: "antialiased", MozOsxFontSmoothing: "grayscale", letterSpacing: "-0.015em", fontVariantNumeric: "tabular-nums", fontFeatureSettings: '"tnum"', textShadow: "0 1px 0 rgba(255,255,255,0.5), 0 1px 2px rgba(0,0,0,0.1), 0 0 4px rgba(255,255,255,0.4)" }}>
                                            <FormatCurrencyStyled value={dStats.currentBalance} prefixColor={dStats.currentBalance < 0 ? "#b91c1c" : (isCurrentMonth ? "#0556C3" : undefined)} />
                                        </p>
                                    </div>
                                    <div className="shrink-0 flex items-start">
                                        <div
                                            className="flex items-center justify-between px-1 rounded-[11px] transition-all h-9 w-[150px] bg-[#f1f5f9] cursor-pointer border border-slate-200/60"
                                            style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}
                                        >
                                            <button onClick={handlePrevMonth} className="text-[#4b5563] border-none rounded-[8px] p-0 h-7 w-7 flex items-center justify-center transition-all hover:opacity-90 bg-white shadow-sm" style={{ border: "1px solid rgba(0,0,0,0.05)" }}>
                                                <DynamicIcon name="ChevronLeft" className="h-3.5 w-3.5" strokeWidth={3} />
                                            </button>
                                            <span className="text-[12px] font-bold text-[#1e293b] px-1 flex-1 text-center uppercase tracking-tight pt-[1px] whitespace-nowrap md:text-[13px]">
                                                {format(selectedMonth, "MMM / y", { locale: ptBR }).replace(".", "")}
                                            </span>
                                            <button onClick={handleNextMonth} className="text-[#4b5563] border-none rounded-[8px] p-0 h-7 w-7 flex items-center justify-center transition-all hover:opacity-90 bg-white shadow-sm" style={{ border: "1px solid rgba(0,0,0,0.05)" }}>
                                                <DynamicIcon name="ChevronRight" className="h-3.5 w-3.5" strokeWidth={3} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <div className="h-[250px] w-full mb-6">
                                    <MonthlyBalanceBarChart revenues={allRevenues} expenseInstallments={allExpenseInstallments} currentDate={selectedMonth} isMobile={false} onMonthClick={(date) => setSelectedMonth(date)} getMonthlyExpensesFn={getMonthlyExpenses} getMonthlyRevenuesFn={getMonthlyRevenues} isMonthProjectedFn={isMonthProjected} />
                                </div>
                                <div className="flex justify-between items-end w-full">
                                    <div className="flex flex-col items-start gap-0.5">
                                        <div className={cn("flex items-center px-2 py-0.5 rounded-[10px] text-[10px] font-bold border-none", dStats.balanceVar >= 0 ? "text-[#16a34a] bg-[#f0fdf4]" : "text-[#dc2626] bg-[#fef2f2]")}>
                                            {dStats.balanceVar >= 0 ? "↑ +" : "↓ "} {Math.abs(dStats.balanceVar).toFixed(1)}%
                                        </div>
                                        <span className="text-[10px] font-medium leading-tight md:text-[12px]" style={{ color: "#4b5563" }}>Mês anterior</span>
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Saldo Anual</span>
                                        <span className="text-sm font-bold text-slate-700">{formatCurrency(annualBal)}</span>
                                    </div>
                                </div>
                            </div>
                            );
                        })()}
                        {activeTrendModal === 'despesas' && (() => {
                            const year = format(selectedMonth, "yyyy");
                            const annualExp = getAnnualExpenses(Number(year));
                            return (
                            <div className="flex flex-col w-full">
                                <div className="flex justify-between items-start w-full mb-6">
                                    <div className="flex flex-col">
                                        <h2 className="text-[15px] font-extrabold tracking-[0.5px] mb-1 md:text-[17px]" style={{ color: "#b91c1c", fontFamily: "'Inter', sans-serif" }}>Despesas</h2>
                                        <p className="text-[21px] font-[800] leading-none md:text-[25px]" style={{ marginTop: "-3px", fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', color: isCurrentMonth ? "#1f2937" : "#4B5563", WebkitFontSmoothing: "antialiased", MozOsxFontSmoothing: "grayscale", letterSpacing: "-0.015em", fontVariantNumeric: "tabular-nums", fontFeatureSettings: '"tnum"', textShadow: "0 1px 0 rgba(255,255,255,0.5), 0 1px 2px rgba(0,0,0,0.1), 0 0 4px rgba(255,255,255,0.4)" }}>
                                            <FormatCurrencyStyled value={dStats.currentExpenses} prefixColor={isCurrentMonth ? "#b91c1c" : undefined} />
                                        </p>
                                    </div>
                                    <div className="shrink-0 flex items-start">
                                        <div
                                            className="flex items-center justify-between px-1 rounded-[11px] transition-all h-9 w-[150px] bg-[#f1f5f9] cursor-pointer border border-slate-200/60"
                                            style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}
                                        >
                                            <button onClick={handlePrevMonth} className="text-[#4b5563] border-none rounded-[8px] p-0 h-7 w-7 flex items-center justify-center transition-all hover:opacity-90 bg-white shadow-sm" style={{ border: "1px solid rgba(0,0,0,0.05)" }}>
                                                <DynamicIcon name="ChevronLeft" className="h-3.5 w-3.5" strokeWidth={3} />
                                            </button>
                                            <span className="text-[12px] font-bold text-[#1e293b] px-1 flex-1 text-center uppercase tracking-tight pt-[1px] whitespace-nowrap md:text-[13px]">
                                                {format(selectedMonth, "MMM / y", { locale: ptBR }).replace(".", "")}
                                            </span>
                                            <button onClick={handleNextMonth} className="text-[#4b5563] border-none rounded-[8px] p-0 h-7 w-7 flex items-center justify-center transition-all hover:opacity-90 bg-white shadow-sm" style={{ border: "1px solid rgba(0,0,0,0.05)" }}>
                                                <DynamicIcon name="ChevronRight" className="h-3.5 w-3.5" strokeWidth={3} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <div className="h-[250px] w-full mb-6">
                                    <MonthlyExpenseBarChart expenseInstallments={allExpenseInstallments} currentDate={selectedMonth} isMobile={false} onMonthClick={(date) => setSelectedMonth(date)} getMonthlyExpensesFn={getMonthlyExpenses} isMonthProjectedFn={isMonthProjected} />
                                </div>
                                <div className="flex justify-between items-end w-full">
                                    <div className="flex flex-col items-start gap-0.5">
                                        <div className={cn("flex items-center px-2 py-0.5 rounded-[10px] text-[10px] font-bold border-none", dStats.expenseVar >= 0 ? "text-[#dc2626] bg-[#fef2f2]" : "text-[#16a34a] bg-[#f0fdf4]")}>
                                            {dStats.expenseVar >= 0 ? "↑ +" : "↓ "} {Math.abs(dStats.expenseVar).toFixed(1)}%
                                        </div>
                                        <span className="text-[10px] font-medium leading-tight md:text-[12px]" style={{ color: "#4b5563" }}>Mês anterior</span>
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Total Anual</span>
                                        <span className="text-sm font-bold text-slate-700">{formatCurrency(annualExp)}</span>
                                    </div>
                                </div>
                            </div>
                            );
                        })()}
                        {activeTrendModal === 'receitas' && (() => {
                            const year = format(selectedMonth, "yyyy");
                            const annualRev = getAnnualRevenues(Number(year));
                            return (
                            <div className="flex flex-col w-full">
                                <div className="flex justify-between items-start w-full mb-6">
                                    <div className="flex flex-col">
                                        <h2 className="text-[15px] font-extrabold tracking-[0.5px] mb-1 md:text-[17px]" style={{ color: "#15803d", fontFamily: "'Inter', sans-serif" }}>Receitas</h2>
                                        <p className="text-[21px] font-[800] leading-none md:text-[25px]" style={{ marginTop: "-3px", fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', color: isCurrentMonth ? "#1f2937" : "#4B5563", WebkitFontSmoothing: "antialiased", MozOsxFontSmoothing: "grayscale", letterSpacing: "-0.015em", fontVariantNumeric: "tabular-nums", fontFeatureSettings: '"tnum"', textShadow: "0 1px 0 rgba(255,255,255,0.5), 0 1px 2px rgba(0,0,0,0.1), 0 0 4px rgba(255,255,255,0.4)" }}>
                                            <FormatCurrencyStyled value={dStats.currentIncome} prefixColor={isCurrentMonth ? "#15803d" : undefined} />
                                        </p>
                                    </div>
                                    <div className="shrink-0 flex items-start">
                                        <div
                                            className="flex items-center justify-between px-1 rounded-[11px] transition-all h-9 w-[150px] bg-[#f1f5f9] cursor-pointer border border-slate-200/60"
                                            style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}
                                        >
                                            <button onClick={handlePrevMonth} className="text-[#4b5563] border-none rounded-[8px] p-0 h-7 w-7 flex items-center justify-center transition-all hover:opacity-90 bg-white shadow-sm" style={{ border: "1px solid rgba(0,0,0,0.05)" }}>
                                                <DynamicIcon name="ChevronLeft" className="h-3.5 w-3.5" strokeWidth={3} />
                                            </button>
                                            <span className="text-[12px] font-bold text-[#1e293b] px-1 flex-1 text-center uppercase tracking-tight pt-[1px] whitespace-nowrap md:text-[13px]">
                                                {format(selectedMonth, "MMM / y", { locale: ptBR }).replace(".", "")}
                                            </span>
                                            <button onClick={handleNextMonth} className="text-[#4b5563] border-none rounded-[8px] p-0 h-7 w-7 flex items-center justify-center transition-all hover:opacity-90 bg-white shadow-sm" style={{ border: "1px solid rgba(0,0,0,0.05)" }}>
                                                <DynamicIcon name="ChevronRight" className="h-3.5 w-3.5" strokeWidth={3} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <div className="h-[250px] w-full mb-6">
                                    <MonthlyRevenueBarChart 
                                        revenues={allRevenues} 
                                        currentDate={selectedMonth} 
                                        isMobile={false} 
                                        onMonthClick={(date) => setSelectedMonth(date)} 
                                        getMonthlyRevenuesFn={getMonthlyRevenues}
                                    />
                                </div>
                                <div className="flex justify-between items-end w-full">
                                    <div className="flex flex-col items-start gap-0.5">
                                        <div className={cn("flex items-center px-2 py-0.5 rounded-[10px] text-[10px] font-bold border-none", dStats.incomeVar >= 0 ? "text-[#16a34a] bg-[#f0fdf4]" : "text-[#dc2626] bg-[#fef2f2]")}>
                                            {dStats.incomeVar >= 0 ? "↑ +" : "↓ "} {Math.abs(dStats.incomeVar).toFixed(1)}%
                                        </div>
                                        <span className="text-[10px] font-medium leading-tight md:text-[12px]" style={{ color: "#4b5563" }}>Mês anterior</span>
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Total Anual</span>
                                        <span className="text-sm font-bold text-slate-700">{formatCurrency(annualRev)}</span>
                                    </div>
                                </div>
                            </div>
                            );
                        })()}
                    </div>
                </DialogContent>
            </Dialog>

            <Footer
                isMobile={isMobile}
                className={cn(isMobile ? "relative w-full mt-6 mb-[env(safe-area-inset-bottom,16px)] pt-2 pb-2 z-20 !bg-transparent" : "mt-8")}
                user={user}
            />
        </div >
    );
};

