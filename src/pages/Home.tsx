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
import Loading from "@/components/Loading";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { MonthlyBalanceBarChart } from "@/components/MonthlyBalanceBarChart";
import { MonthlyExpenseBarChart } from "@/components/MonthlyExpenseBarChart";
import { MonthlyRevenueBarChart } from "@/components/MonthlyRevenueBarChart";

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

export default function Home() {
    const { user } = useAuth();
    const isMobile = useIsMobile();
    const navigate = useNavigate();
    const [selectedMonth, setSelectedMonth] = useState(new Date());
    const [activeTrendModal, setActiveTrendModal] = useState<"saldo" | "despesas" | "receitas" | null>(null);

    // Fetch all revenues for memory-based filtering (needed for variations and 10-month graph)
    const { data: allRevenues = [], isLoading: isLoadingRevenues, isPlaceholderData: isPlaceholderRevenues } = useQuery<
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
    const { data: allExpenseInstallments = [], isLoading: isLoadingExpenses, isPlaceholderData: isPlaceholderExpenses } =
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
                > | null;
            })[]
        >({
            queryKey: ["allExpenseInstallments", user?.id, format(selectedMonth, "yyyy")],
            queryFn: async () => {
                if (!user?.id) return [];
                // Fetch current and previous year of the selected month
                const startRange = format(subMonths(selectedMonth, 12), "yyyy-01-01");
                const endRange = format(selectedMonth, "yyyy-12-31");
                const { data, error } = await supabase
                    .from("despesas_parcelas")
                    .select(
                        "*, despesas(id, categoria_id, user_id, descricao, forma_pagamento, tipo_pagamento, cartao_id, is_recurring_master, numero_parcelas)"
                    )
                    .filter("despesas.user_id", "eq", user.id)
                    .gte("vencimento", startRange)
                    .lte("vencimento", endRange);
                if (error) throw error;
                return data;
            },
            enabled: !!user,
            placeholderData: keepPreviousData,
        });


    // Fetch cards
    const { data: cartoes = [], isLoading: isLoadingCartoes } = useQuery<Tables<"cartoes">[]>({
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
    const { data: investimentos = [], isLoading: isLoadingInvestments } = useQuery<Tables<"investimentos">[]>({
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

    // Fetch categories
    const { data: allSubcategories = [] } = useQuery({
        queryKey: ["categories", user?.id],
        queryFn: async () => {
            if (!user?.id) return [];
            const { data, error } = await supabase
                .from("categorias")
                .select("*")
                .or(`user_id.eq.${user.id},user_id.is.null`)
                .order("nome");
            if (error) throw error;
            return data;
        },
        enabled: !!user,
    });

    const { data: profile } = useProfile(user?.id);

    const stats = useMemo(() => {
        const currentMonthStr = format(selectedMonth, "yyyy-MM");
        const prevMonthStr = format(subMonths(selectedMonth, 1), "yyyy-MM");

        const calculateIncome = (monthStr: string) => {
            return allRevenues
                .filter((r) => r.data.startsWith(monthStr))
                .reduce((sum, r) => sum + r.valor, 0);
        };

        const calculateReceivedIncome = (monthStr: string) => {
            return allRevenues
                .filter((r) => r.data.startsWith(monthStr) && r.status === 'Recebida')
                .reduce((sum, r) => sum + r.valor, 0);
        };

        const calculateExpenses = (monthStr: string) => {
            return allExpenseInstallments
                .filter((p) => p.vencimento.startsWith(monthStr))
                .reduce((sum, p) => sum + p.valor_parcela, 0);
        };

        const calculatePaidExpenses = (monthStr: string) => {
            return allExpenseInstallments
                .filter((p) => p.vencimento.startsWith(monthStr) && p.pago === true)
                .reduce((sum, p) => sum + p.valor_parcela, 0);
        };

        const currentIncome = calculateIncome(currentMonthStr);
        const currentReceivedIncome = calculateReceivedIncome(currentMonthStr);
        const currentExpenses = calculateExpenses(currentMonthStr);
        const currentPaidExpenses = calculatePaidExpenses(currentMonthStr);
        
        // Subtract Active Investments (originated from saldo_atual)
        const currentActiveInvestments = investimentos
            .filter((inv) => (inv.status === 'ativo' || !inv.status) && inv.origem_investimento === 'saldo_atual')
            .reduce((sum, inv) => sum + (inv.valor || 0), 0);

        // Caixa Atual represents the GLOBAL actual balance
        const currentCaixaAtual = globalReceivedIncome - globalPaidExpenses - currentActiveInvestments;
        
        const currentBalance = currentIncome - currentExpenses;

        const previousIncome = calculateIncome(prevMonthStr);
        const previousExpenses = calculateExpenses(prevMonthStr);
        const previousBalance = previousIncome - previousExpenses;

        const calculateVar = (curr: number, prev: number) => {
            if (prev === 0) return curr > 0 ? 100 : 0;
            return ((curr - prev) / prev) * 100;
        };

        return {
            currentIncome,
            currentReceivedIncome,
            currentPaidExpenses,
            currentCaixaAtual,
            currentExpenses,
            currentBalance,
            incomeVar: calculateVar(currentIncome, previousIncome),
            expenseVar: calculateVar(currentExpenses, previousExpenses),
            balanceVar: calculateVar(currentBalance, previousBalance),
        };
    }, [allRevenues, allExpenseInstallments, selectedMonth, investimentos, globalReceivedIncome, globalPaidExpenses]);

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
            
            const income = allRevenues
                .filter((r) => r.data.startsWith(mStr))
                .reduce((sum, r) => sum + r.valor, 0);
                
            const expenses = allExpenseInstallments
                .filter((p) => p.vencimento.startsWith(mStr))
                .reduce((sum, p) => sum + p.valor_parcela, 0);
                
            list.push({
                monthStr: mStr,
                balance: income - expenses,
                date: m
            });
        }
        return list;
    }, [allRevenues, allExpenseInstallments, selectedMonth]);

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
            // start at X=22 (margin left), end at X=150 (margin right)
            const y = 40 - ((item.balance - minBal) / range) * 35;
            return {
                x: 22 + i * (128 / 9),
                y,
                monthStr: item.monthStr,
                balance: item.balance
            };
        });
    }, [monthlyBalances]);

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

    if (isInitialLoad && !allRevenues.length && !allExpenseInstallments.length) {
        return <Loading />;
    }

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
                    className="fixed top-0 left-0 right-0 bottom-0 z-20 pointer-events-none"
                    style={{
                        backgroundImage: "url('/sky.webp')",
                        backgroundSize: "cover",
                        backgroundPosition: "center top",
                        backgroundRepeat: "no-repeat"
                    }}
                />
            )}
            {/* HEADER AREA */}
            <div className="relative h-[220px] w-full overflow-hidden shrink-0">
                <div className={cn(
                    "container-app relative z-10",
                    isMobile ? "fixed top-[56px] left-0 right-0 h-[42px] z-40 flex items-center pt-0 bg-transparent justify-between" : "pt-[72px] md:pt-[42px] flex justify-between items-start"
                )}>
                    <div>
                        <h1 
                            className={cn("font-bold leading-none text-white", isMobile ? "text-[17px] tracking-tight" : "text-2xl font-extrabold tracking-[0.5px] -mt-0.5")}
                            style={{ fontFamily: "'Inter', sans-serif", textShadow: isMobile ? "0 1px 2px rgba(0,0,0,.18)" : "none" }}
                        >
                            <span className={cn(isMobile ? "text-[#D9E3F5]" : "text-[#1e3a8a]")}>{greeting},</span> <span className={cn(isMobile ? "text-white" : "text-[#1e3a8a]")}>{userName}</span> {profile?.avatar || "👍"}
                        </h1>
                        <p 
                            className={cn("font-medium leading-none", isMobile ? "text-[12px] font-normal opacity-[0.85] -mt-[4px]" : "text-sm font-bold text-slate-500 -mt-0.5 tracking-wider opacity-80")}
                            style={{ color: isMobile ? "#D9E3F5" : undefined, textShadow: isMobile ? "0 1px 2px rgba(0,0,0,.18)" : "none", fontFamily: "'Inter', sans-serif" }}
                        >
                            {todayStr}
                        </p>
                    </div>
                    {isMobile && (
                        <div className="flex flex-col items-center select-none mr-0 -mt-[3px]">
                            <div className="flex items-center gap-[7px]">
                                <button 
                                    onClick={handlePrevMonth} 
                                    className="text-white border-none rounded-[8px] p-0 h-6 w-6 flex items-center justify-center transition-all hover:opacity-90 active:scale-95 cursor-pointer translate-y-[2px]"
                                    style={{ 
                                        background: "rgba(255, 255, 255, 0.15)",
                                        boxShadow: "0 2px 4px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.15)",
                                        borderBottom: "1px solid rgba(0,0,0,0.2)"
                                    }}
                                >
                                    <DynamicIcon name="ChevronLeft" className="h-3 w-3 text-white" strokeWidth={3.5} />
                                </button>
                                <div className="w-[38px] flex justify-center items-center">
                                    <span 
                                        className="font-bold tracking-wide uppercase font-sans leading-none text-center"
                                        style={{ 
                                            fontSize: '16.5px', 
                                            color: isCurrentMonth ? '#FFFFFF' : '#D6DEE8',
                                            textShadow: '0 1px 2px rgba(0,0,0,0.15)',
                                            fontWeight: 800
                                        }}
                                    >
                                        {format(selectedMonth, "MMM", { locale: ptBR }).replace(".", "")}
                                    </span>
                                </div>
                                <button 
                                    onClick={handleNextMonth} 
                                    className="text-white border-none rounded-[8px] p-0 h-6 w-6 flex items-center justify-center transition-all hover:opacity-90 active:scale-95 cursor-pointer translate-y-[2px]"
                                    style={{ 
                                        background: "rgba(255, 255, 255, 0.15)",
                                        boxShadow: "0 2px 4px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.15)",
                                        borderBottom: "1px solid rgba(0,0,0,0.2)"
                                    }}
                                >
                                    <DynamicIcon name="ChevronRight" className="h-3 w-3 text-white" strokeWidth={3.5} />
                                </button>
                            </div>
                            <span 
                                className="font-bold font-sans leading-none"
                                style={{ 
                                    fontSize: '12.5px', 
                                    color: '#D9E3F5',
                                    marginTop: '-0.5px',
                                    textShadow: '0 1px 2px rgba(0,0,0,0.15)'
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
                                    className="home-mobile-card rounded-[16px] relative overflow-hidden card-saldo h-full w-full flex flex-col justify-center"
                                    style={{
                                        borderRadius: "16px",
                                        background: "linear-gradient(180deg, #FFFFFF 0%, #FCFDFF 55%, #F8FBFF 100%)",
                                        backdropFilter: "blur(18px) saturate(1.4)",
                                        WebkitBackdropFilter: "blur(18px) saturate(1.4)",
                                        border: "1px solid rgba(255,255,255,.75)",
                                        backgroundClip: "padding-box",
                                        outline: "none",
                                        boxShadow: "0 10px 28px rgba(15,45,95,.10), 0 3px 10px rgba(15,45,95,.06), inset 0 1px 0 rgba(255,255,255,.95)"
                                    }}
                                >
                                    <div className="flex justify-between items-stretch w-full relative z-20">
                                        <div className="flex flex-col justify-between py-0.5">
                                            <div className="flex flex-col md:mt-3">
                                                <h2 className="font-extrabold leading-none tracking-tight mb-2 md:-mt-[1px] md:text-[16px]" style={{ color: "#0556C3", fontFamily: "'Inter', sans-serif", fontSize: "var(--home-title-text, 15px)", marginTop: "var(--home-title-mt, 1px)" }}>Saldo Atual</h2>
                                                <p className="font-[800] leading-none md:text-[25px]" style={{ marginTop: "var(--home-val-mt, -5px)", fontSize: "var(--home-val-text, 21px)", fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', color: dStats.currentCaixaAtual < 0 ? (isMobile ? "#ef4444" : "#b91c1c") : (isCurrentMonth ? "#1f2937" : "#4B5563"), WebkitFontSmoothing: "antialiased", MozOsxFontSmoothing: "grayscale", letterSpacing: "-0.015em", fontVariantNumeric: "tabular-nums", fontFeatureSettings: '"tnum"', textShadow: "0 1px 0 rgba(255,255,255,0.5), 0 1px 2px rgba(0,0,0,0.1), 0 0 4px rgba(255,255,255,0.4)" }}>
                                                    <FormatCurrencyStyled value={dStats.currentCaixaAtual} prefixColor={dStats.currentCaixaAtual < 0 ? (isMobile ? "#ef4444" : "#b91c1c") : (isCurrentMonth ? "#0556C3" : undefined)} />
                                                </p>
                                            </div>
                                            <div className="flex items-center mt-3 gap-2">
                                                {/* Investments Icon Button */}
                                                <Button
                                                    onClick={() => navigate("/dashboard?filter=investments")}
                                                    className="w-9 h-9 p-0 flex items-center justify-center rounded-xl border-none transition-all active:scale-90 shrink-0"
                                                    style={{ background: "#2563eb", filter: "saturate(0.95)", boxShadow: "0 4px 10px rgba(37,99,235,0.2), inset 0 1px 1px rgba(255,255,255,0.3)" }}
                                                >
                                                    <DynamicIcon name="LineChart" className="h-[18px] w-[18px] text-white" strokeWidth={3} />
                                                </Button>
                                                <div className="flex flex-col items-start gap-[2px] mt-0.5">
                                                    <span className="text-[10px] font-semibold leading-none whitespace-nowrap" style={{ color: "#0556C3" }}>Saldo Mensal</span>
                                                    <span className="text-[13px] font-bold leading-none" style={{ color: "#334155" }}>{formatCurrency(dStats.currentBalance)}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Sparkline Graph */}
                                        <div className="flex flex-col items-center justify-end pb-0.5 -mr-1">
                                            <svg viewBox="0 0 160 45" className="w-full max-w-[170px] h-[64px] overflow-visible">
                                                <defs>
                                                    <linearGradient id="sparkline-grad" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="0%" stopColor="#2f80ff" stopOpacity="0.20" />
                                                        <stop offset="50%" stopColor="#2f80ff" stopOpacity="0.10" />
                                                        <stop offset="100%" stopColor="#2f80ff" stopOpacity="0.00" />
                                                    </linearGradient>
                                                    <filter id="point-shadow" x="-30%" y="-30%" width="160%" height="160%">
                                                        <feDropShadow dx="0" dy="1" stdDeviation="0.6" floodColor="#000" floodOpacity="0.15" />
                                                    </filter>
                                                    <filter id="red-glow" x="-40%" y="-40%" width="180%" height="180%">
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
                                                    fill="url(#sparkline-grad)"
                                                    style={{ transition: 'all 220ms ease-in-out' }}
                                                />
                                                <path
                                                    d={linePath}
                                                    fill="none"
                                                    stroke="#0556C3"
                                                    strokeWidth="2.5"
                                                    strokeLinecap="round"
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
                                                            fill={isSelected ? "#EF6C6C" : "#0556C3"}
                                                            stroke="#fff"
                                                            strokeWidth={isSelected ? 1.6 : 1.2}
                                                            filter={isSelected ? "url(#red-glow)" : "url(#point-shadow)"}
                                                            style={{ transition: 'all 220ms ease-in-out' }}
                                                        />
                                                    );
                                                })}
                                            </svg>
                                            <span className="text-[10px] font-semibold text-[#6b7280] mt-[8px] tracking-tight">
                                                Últimos 10 meses
                                            </span>
                                        </div>
                                    </div>
                                </Card>

                                {/* CARD DESPESAS */}
                                <Card
                                    className="home-mobile-card relative overflow-hidden card-despesas h-full w-full flex flex-col justify-center rounded-[16px]"
                                    style={{
                                        borderRadius: "16px",
                                        background: "linear-gradient(180deg, #FFFFFF 0%, #FCFDFF 55%, #F8FBFF 100%)",
                                        backdropFilter: "blur(18px) saturate(1.4)",
                                        WebkitBackdropFilter: "blur(18px) saturate(1.4)",
                                        border: "1px solid rgba(255,255,255,.75)",
                                        backgroundClip: "padding-box",
                                        outline: "none",
                                        boxShadow: "0 10px 28px rgba(15,45,95,.10), 0 3px 10px rgba(15,45,95,.06), inset 0 1px 0 rgba(255,255,255,.95)"
                                    }}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex flex-col md:mt-3">
                                            <h2 className="font-extrabold leading-none tracking-tight mb-2 md:-mt-[1px] md:text-[16px]" style={{ color: isMobile ? "#ef4444" : "#b91c1c", fontFamily: "'Inter', sans-serif", fontSize: "var(--home-title-text, 15px)", marginTop: "var(--home-title-mt, 3px)" }}>Despesas</h2>
                                            <p className="font-[800] leading-none md:text-[25px]" style={{ marginTop: "var(--home-val-mt, -5px)", fontSize: "var(--home-val-text, 21px)", fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', color: isCurrentMonth ? "#1f2937" : "#4B5563", WebkitFontSmoothing: "antialiased", MozOsxFontSmoothing: "grayscale", letterSpacing: "-0.015em", fontVariantNumeric: "tabular-nums", fontFeatureSettings: '"tnum"', textShadow: "0 1px 0 rgba(255,255,255,0.5), 0 1px 2px rgba(0,0,0,0.1), 0 0 4px rgba(255,255,255,0.4)" }}>
                                                <FormatCurrencyStyled value={dStats.currentExpenses} prefixColor={isCurrentMonth ? (isMobile ? "#ef4444" : "#b91c1c") : undefined} />
                                            </p>
                                        </div>
                                        <Button
                                            className="h-9 md:h-[40px] px-4 rounded-[11px] font-bold text-sm md:text-[15px] whitespace-nowrap w-[135px] transition-all hover:-translate-y-[1px] active:translate-y-[1px] active:shadow-[0_3px_8px_rgba(0,0,0,0.4)] -mr-1 mt-1"
                                            style={{ 
                                                background: "linear-gradient(135deg, #fcfcfc, #f5f5f5)", 
                                                border: "1px solid rgba(0,0,0,0.08)",
                                                borderBottom: "2px solid rgba(0,0,0,0.12)", 
                                                color: isMobile ? "#ef4444" : "#b91c1c",
                                                filter: "saturate(0.95)", 
                                                boxShadow: "0 4px 10px rgba(0,0,0,0.05)",
                                                textShadow: "0 1px 1px rgba(0, 0, 0, 0.08)"
                                            }}
                                            onClick={() => navigate(`/lancamentos?type=expense&month=${format(selectedMonth, "yyyy-MM-dd")}`)}
                                        >
                                            Ver Gastos <DynamicIcon name="ChevronRight" className="ml-1.5 h-3 w-3" strokeWidth={4} />
                                        </Button>
                                    </div>

                                    <div className="flex items-center justify-between mt-2">
                                        <div className="flex items-start gap-2">
                                            <Button
                                                onClick={() => navigate("/dashboard?filter=expenses")}
                                                className="p-0 flex items-center justify-center rounded-xl border-none transition-all active:scale-90 shrink-0"
                                                style={{ width: "var(--home-btn-h, 36px)", height: "var(--home-btn-h, 36px)", background: "#ef4444", filter: "saturate(0.95)", boxShadow: "0 4px 10px rgba(239,68,68,0.2), inset 0 1px 1px rgba(255,255,255,0.3)" }}
                                            >
                                                <TrendingDown className="h-[18px] w-[18px] text-white" strokeWidth={3} />
                                            </Button>
                                            <div className="flex flex-col items-start gap-0.5">
                                                <div 
                                                     className="flex items-center px-2 py-0.5 rounded-[10px] text-[10px] font-bold border-none tracking-tight leading-none h-[18px]"
                                                     style={{ 
                                                         backgroundColor: dStats.expenseVar >= 0 ? 'rgba(255,90,90,0.08)' : 'rgba(46,204,113,0.08)',
                                                         color: dStats.expenseVar >= 0 ? '#dc2626' : '#16a34a'
                                                     }}
                                                >
                                                    {dStats.expenseVar >= 0 ? "↑ +" : "↓ "} {Math.abs(dStats.expenseVar).toFixed(1)}%
                                                </div>
                                                <span className="text-[10px] font-medium leading-tight" style={{ color: "#4b5563" }}>Mês anterior</span>
                                            </div>
                                        </div>
                                        <Button
                                            className="px-4 rounded-[11px] font-bold text-white border-none transition-all hover:-translate-y-[1px] active:translate-y-[1px] active:shadow-[0_3px_8px_rgba(0,0,0,0.4)] w-[135px] -mr-1"
                                            style={{ height: isMobile ? "var(--home-btn-h, 36px)" : "40px", fontSize: isMobile ? "var(--home-btn-text, 14px)" : "15px", background: "linear-gradient(135deg, #ef4444, #dc2626)", borderBottom: "1px solid rgba(0,0,0,0.4)", filter: "saturate(0.95)", boxShadow: "0 6px 14px rgba(0,0,0,0.12)", textShadow: "0 1px 1px rgba(0, 0, 0, 0.15)" }}
                                            onClick={() => navigate("/despesas")}
                                        >
                                            <Plus className="mr-1.5 h-4 w-4 text-white" strokeWidth={4} />
                                            Nova Despesa
                                        </Button>
                                    </div>
                                </Card>

                                {/* CARD RECEITAS */}
                                <Card
                                    className="home-mobile-card relative overflow-hidden card-receitas h-full w-full flex flex-col justify-center rounded-[16px]"
                                    style={{
                                        borderRadius: "16px",
                                        background: "linear-gradient(180deg, #FFFFFF 0%, #FCFDFF 55%, #F8FBFF 100%)",
                                        backdropFilter: "blur(18px) saturate(1.4)",
                                        WebkitBackdropFilter: "blur(18px) saturate(1.4)",
                                        border: "1px solid rgba(255,255,255,.75)",
                                        backgroundClip: "padding-box",
                                        outline: "none",
                                        boxShadow: "0 10px 28px rgba(15,45,95,.10), 0 3px 10px rgba(15,45,95,.06), inset 0 1px 0 rgba(255,255,255,.95)"
                                    }}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex flex-col md:mt-3">
                                            <h2 className="font-extrabold leading-none tracking-tight mb-2 md:-mt-[1px] md:text-[16px]" style={{ color: "#15803d", fontFamily: "'Inter', sans-serif", fontSize: "var(--home-title-text, 15px)", marginTop: "var(--home-title-mt, 3px)" }}>Receitas</h2>
                                            <p className="font-[800] leading-none md:text-[25px]" style={{ marginTop: "var(--home-val-mt, -5px)", fontSize: "var(--home-val-text, 21px)", fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', color: isCurrentMonth ? "#1f2937" : "#4B5563", WebkitFontSmoothing: "antialiased", MozOsxFontSmoothing: "grayscale", letterSpacing: "-0.015em", fontVariantNumeric: "tabular-nums", fontFeatureSettings: '"tnum"', textShadow: "0 1px 0 rgba(255,255,255,0.5), 0 1px 2px rgba(0,0,0,0.1), 0 0 4px rgba(255,255,255,0.4)" }}>
                                                <FormatCurrencyStyled value={dStats.currentIncome} prefixColor={isCurrentMonth ? "#15803d" : undefined} />
                                            </p>
                                        </div>
                                        <Button
                                            className="h-9 md:h-[40px] px-4 rounded-[11px] font-bold text-sm md:text-[15px] whitespace-nowrap w-[135px] transition-all hover:-translate-y-[1px] active:translate-y-[1px] active:shadow-[0_3px_8px_rgba(0,0,0,0.4)] -mr-1 mt-1"
                                            style={{ 
                                                background: "linear-gradient(135deg, #fcfcfc, #f5f5f5)", 
                                                border: "1px solid rgba(0,0,0,0.08)",
                                                borderBottom: "2px solid rgba(0,0,0,0.12)", 
                                                color: "#15803d",
                                                filter: "saturate(0.95)", 
                                                boxShadow: "0 4px 10px rgba(0,0,0,0.05)",
                                                textShadow: "0 1px 1px rgba(0, 0, 0, 0.08)"
                                            }}
                                            onClick={() => navigate(`/lancamentos?type=income&month=${format(selectedMonth, "yyyy-MM-dd")}`)}
                                        >
                                            Ver Receitas <DynamicIcon name="ChevronRight" className="ml-1.5 h-3 w-3" strokeWidth={4} />
                                        </Button>
                                    </div>

                                    <div className="flex items-center justify-between mt-2">
                                        <div className="flex items-start gap-2">
                                            <Button
                                                onClick={() => navigate("/dashboard?filter=revenues")}
                                                className="p-0 flex items-center justify-center rounded-xl border-none transition-all active:scale-90 shrink-0"
                                                style={{ width: "var(--home-btn-h, 36px)", height: "var(--home-btn-h, 36px)", background: "linear-gradient(135deg, #22c55e, #16a34a)", filter: "saturate(0.95)", boxShadow: "0 4px 10px rgba(34,197,94,0.2), inset 0 1px 1px rgba(255,255,255,0.3)" }}
                                            >
                                                <TrendingUp className="h-[18px] w-[18px] text-white" strokeWidth={3} />
                                            </Button>
                                            <div className="flex flex-col items-start gap-0.5">
                                                <div 
                                                     className="flex items-center px-2 py-0.5 rounded-[10px] text-[10px] font-bold border-none tracking-tight leading-none h-[18px]"
                                                     style={{ 
                                                         backgroundColor: dStats.incomeVar >= 0 ? 'rgba(46,204,113,0.08)' : 'rgba(255,90,90,0.08)',
                                                         color: dStats.incomeVar >= 0 ? '#16a34a' : '#dc2626'
                                                     }}
                                                >
                                                    {dStats.incomeVar >= 0 ? "↑ +" : "↓ "} {Math.abs(dStats.incomeVar).toFixed(1)}%
                                                </div>
                                                <span className="text-[10px] font-medium leading-tight" style={{ color: "#4b5563" }}>Mês anterior</span>
                                            </div>
                                        </div>
                                        <Button
                                            className="px-4 rounded-[11px] font-bold text-white border-none transition-all hover:-translate-y-[1px] active:translate-y-[1px] active:shadow-[0_3px_8px_rgba(0,0,0,0.4)] w-[135px] -mr-1"
                                            style={{ height: isMobile ? "var(--home-btn-h, 36px)" : "40px", fontSize: isMobile ? "var(--home-btn-text, 14px)" : "15px", background: "linear-gradient(135deg, #22c55e, #16a34a)", borderBottom: "1px solid rgba(0,0,0,0.4)", filter: "saturate(0.95)", boxShadow: "0 6px 14px rgba(0,0,0,0.12)", textShadow: "0 1px 1px rgba(0, 0, 0, 0.15)" }}
                                            onClick={() => navigate("/receitas")}
                                        >
                                            <Plus className="mr-1.5 h-4 w-4 text-white" strokeWidth={4} />
                                            Nova Receita
                                        </Button>
                                    </div>
                                </Card>

                                <div id="cartoes-section" className="h-full w-full">
                                    <MobileCreditCardExpenses
                                        cartoes={cartoes}
                                        expenseInstallments={dExpenses}
                                        allCategories={allSubcategories as any}
                                        isMobile={isMobile}
                                        selectedMonth={dMonth}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-[21px] md:auto-rows-fr md:items-stretch">
                        {/* CARD PRINCIPAL â€” SALDO MENSAL (HERO) */}
                        <Card
                            className="pl-3 pr-[20px] pt-[8px] pb-[12px] rounded-[16px] relative overflow-hidden card-saldo md:p-6 md:flex md:flex-col h-full w-full justify-between"
                            style={{
                                borderRadius: "16px",
                                background: "linear-gradient(180deg, #FFFFFF 0%, #FCFDFF 55%, #F8FBFF 100%)",
                                backdropFilter: "blur(18px) saturate(1.4)",
                                WebkitBackdropFilter: "blur(18px) saturate(1.4)",
                                border: "1px solid rgba(255,255,255,.75)",
                                backgroundClip: "padding-box",
                                outline: "none",
                                boxShadow: "0 10px 28px rgba(15,45,95,.10), 0 3px 10px rgba(15,45,95,.06), inset 0 1px 0 rgba(255,255,255,.95)"
                            }}
                        >
                            <div className="flex flex-col h-full w-full justify-between relative z-20">
                                {/* HEADER */}
                                <div className="flex justify-between items-start w-full">
                                    <div className="flex flex-col">
                                        <h2 className="text-[15px] font-extrabold tracking-[0.5px] mb-1 md:text-[17px]" style={{ color: "#0556C3", fontFamily: "'Inter', sans-serif" }}>Saldo Atual</h2>
                                        <p className="text-[21px] font-[800] leading-none md:text-[25px]" style={{ marginTop: "-3px", fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', color: dStats.currentCaixaAtual < 0 ? (isMobile ? "#ef4444" : "#b91c1c") : (isCurrentMonth ? "#1f2937" : "#4B5563"), WebkitFontSmoothing: "antialiased", MozOsxFontSmoothing: "grayscale", letterSpacing: "-0.015em", fontVariantNumeric: "tabular-nums", fontFeatureSettings: '"tnum"', textShadow: "0 1px 0 rgba(255,255,255,0.5), 0 1px 2px rgba(0,0,0,0.1), 0 0 4px rgba(255,255,255,0.4)" }}>
                                            <FormatCurrencyStyled value={dStats.currentCaixaAtual} prefixColor={dStats.currentCaixaAtual < 0 ? (isMobile ? "#ef4444" : "#b91c1c") : (isCurrentMonth ? "#0556C3" : undefined)} />
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

                                {/* CONTENT/BASE */}
                                <div className="flex justify-between items-end w-full mt-4">
                                    <div className="flex items-center gap-2">
                                        <Button
                                            onClick={() => setActiveTrendModal("saldo")}
                                            className="w-9 h-9 p-0 flex items-center justify-center rounded-xl border-none transition-all active:scale-90 shrink-0"
                                            style={{ background: "#2563eb", filter: "saturate(0.95)", boxShadow: "0 4px 10px rgba(37,99,235,0.2), inset 0 1px 1px rgba(255,255,255,0.3)" }}
                                        >
                                            <DynamicIcon name="LineChart" className="h-[18px] w-[18px] text-white" strokeWidth={3} />
                                        </Button>
                                        <div className="flex flex-col items-start gap-[2px] mt-1">
                                            <span className="text-[10px] font-semibold leading-none whitespace-nowrap" style={{ color: "#0556C3" }}>Saldo Mensal</span>
                                            <span className="text-[13px] font-bold leading-none" style={{ color: "#334155" }}>{formatCurrency(dStats.currentBalance)}</span>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end justify-end pb-0.5 -mr-1">
                                        <svg viewBox="0 0 160 45" className="w-full max-w-[170px] h-[64px] overflow-visible">
                                            <defs>
                                                <linearGradient id="sparkline-grad" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%" stopColor="#2f80ff" stopOpacity="0.20" />
                                                    <stop offset="50%" stopColor="#2f80ff" stopOpacity="0.10" />
                                                    <stop offset="100%" stopColor="#2f80ff" stopOpacity="0.00" />
                                                </linearGradient>
                                                <filter id="point-shadow" x="-30%" y="-30%" width="160%" height="160%">
                                                    <feDropShadow dx="0" dy="1" stdDeviation="0.6" floodColor="#000" floodOpacity="0.15" />
                                                </filter>
                                                <filter id="red-glow" x="-40%" y="-40%" width="180%" height="180%">
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
                                                fill="url(#sparkline-grad)"
                                                style={{ transition: 'all 220ms ease-in-out' }}
                                            />
                                            <path
                                                d={linePath}
                                                fill="none"
                                                stroke="#0556C3"
                                                strokeWidth="2.5"
                                                strokeLinecap="round"
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
                                                        fill={isSelected ? "#EF6C6C" : "#0556C3"}
                                                        stroke="#fff"
                                                        strokeWidth={isSelected ? 1.6 : 1.2}
                                                        filter={isSelected ? "url(#red-glow)" : "url(#point-shadow)"}
                                                        style={{ transition: 'all 220ms ease-in-out' }}
                                                    />
                                                );
                                            })}
                                        </svg>
                                        <span className="text-[10px] font-semibold text-[#6b7280] mt-[8px] tracking-tight">
                                            Últimos 10 meses
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </Card>

                        {/* CARD RECEITAS */}
                        <Card
                            className="pl-3 pr-[20px] pt-[8px] pb-[12px] relative overflow-hidden card-receitas md:p-6 md:flex md:flex-col h-full w-full justify-between"
                            style={{
                                borderRadius: "16px",
                                background: "linear-gradient(180deg, #FFFFFF 0%, #FCFDFF 55%, #F8FBFF 100%)",
                                backdropFilter: "blur(18px) saturate(1.4)",
                                WebkitBackdropFilter: "blur(18px) saturate(1.4)",
                                border: "1px solid rgba(255,255,255,.75)",
                                backgroundClip: "padding-box",
                                outline: "none",
                                boxShadow: "0 10px 28px rgba(15,45,95,.10), 0 3px 10px rgba(15,45,95,.06), inset 0 1px 0 rgba(255,255,255,.95)"
                            }}
                        >
                            <div className="flex flex-col h-full w-full justify-between relative z-20">
                                {/* HEADER */}
                                <div className="flex justify-between items-start w-full">
                                    <div className="flex flex-col">
                                        <h2 className="text-[15px] font-extrabold tracking-[0.5px] mb-1 md:text-[17px]" style={{ color: "#15803d", fontFamily: "'Inter', sans-serif" }}>Receitas</h2>
                                        <p className="text-[21px] font-[800] leading-none md:text-[25px]" style={{ marginTop: "-3px", fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', color: isCurrentMonth ? "#1f2937" : "#4B5563", WebkitFontSmoothing: "antialiased", MozOsxFontSmoothing: "grayscale", letterSpacing: "-0.015em", fontVariantNumeric: "tabular-nums", fontFeatureSettings: '"tnum"', textShadow: "0 1px 0 rgba(255,255,255,0.5), 0 1px 2px rgba(0,0,0,0.1), 0 0 4px rgba(255,255,255,0.4)" }}>
                                            <FormatCurrencyStyled value={dStats.currentIncome} prefixColor={isCurrentMonth ? "#15803d" : undefined} />
                                        </p>
                                    </div>
                                    <div className="shrink-0 flex items-start">
                                        <Button
                                            className="h-9 md:h-[40px] px-4 rounded-[11px] font-bold text-sm md:text-[15px] whitespace-nowrap w-[150px] transition-all hover:-translate-y-[1px] active:translate-y-[1px] active:shadow-[0_3px_8px_rgba(0,0,0,0.4)]"
                                            style={{ 
                                                background: "linear-gradient(135deg, #fcfcfc, #f5f5f5)", 
                                                border: "1px solid rgba(0,0,0,0.08)",
                                                borderBottom: "2px solid rgba(0,0,0,0.12)", 
                                                color: "#15803d",
                                                filter: "saturate(0.95)", 
                                                boxShadow: "0 4px 10px rgba(0,0,0,0.05)",
                                                textShadow: "0 1px 1px rgba(0, 0, 0, 0.08)"
                                            }}
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
                                            )}>
                                                {dStats.incomeVar >= 0 ? "↑ +" : "↓ "} {Math.abs(dStats.incomeVar).toFixed(1)}%
                                            </div>
                                            <span className="text-[10px] font-medium leading-tight md:text-[12px]" style={{ color: "#4b5563" }}>Mês anterior</span>
                                        </div>
                                    </div>
                                    <div className="shrink-0 flex items-end">
                                        <Button
                                            className="h-9 md:h-[40px] px-4 rounded-[11px] font-bold text-sm md:text-[15px] text-white border-none transition-all hover:-translate-y-[1px] active:translate-y-[1px] active:shadow-[0_3px_8px_rgba(0,0,0,0.4)] w-[150px]"
                                            style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)", borderBottom: "1px solid rgba(0,0,0,0.4)", filter: "saturate(0.95)", boxShadow: "0 6px 14px rgba(0,0,0,0.12)", textShadow: "0 1px 1px rgba(0, 0, 0, 0.15)" }}
                                            onClick={() => navigate("/receitas")}
                                        >
                                            <Plus className="mr-1.5 h-4 w-4 text-white" strokeWidth={4} />
                                            Nova Receita
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </Card>

                        {/* CARD DESPESAS */}
                        <Card
                            className="pl-3 pr-[20px] pt-[8px] pb-[12px] relative overflow-hidden card-despesas md:p-6 md:flex md:flex-col h-full w-full justify-between"
                            style={{
                                borderRadius: "16px",
                                background: "linear-gradient(180deg, #FFFFFF 0%, #FCFDFF 55%, #F8FBFF 100%)",
                                backdropFilter: "blur(18px) saturate(1.4)",
                                WebkitBackdropFilter: "blur(18px) saturate(1.4)",
                                border: "1px solid rgba(255,255,255,.75)",
                                backgroundClip: "padding-box",
                                outline: "none",
                                boxShadow: "0 10px 28px rgba(15,45,95,.10), 0 3px 10px rgba(15,45,95,.06), inset 0 1px 0 rgba(255,255,255,.95)"
                            }}
                        >
                            <div className="flex flex-col h-full w-full justify-between relative z-20">
                                {/* HEADER */}
                                <div className="flex justify-between items-start w-full">
                                    <div className="flex flex-col">
                                        <h2 className="text-[15px] font-extrabold tracking-[0.5px] mb-1 md:text-[17px]" style={{ color: "#b91c1c", fontFamily: "'Inter', sans-serif" }}>Despesas</h2>
                                        <p className="text-[21px] font-[800] leading-none md:text-[25px]" style={{ marginTop: "-3px", fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', color: isCurrentMonth ? "#1f2937" : "#4B5563", WebkitFontSmoothing: "antialiased", MozOsxFontSmoothing: "grayscale", letterSpacing: "-0.015em", fontVariantNumeric: "tabular-nums", fontFeatureSettings: '"tnum"', textShadow: "0 1px 0 rgba(255,255,255,0.5), 0 1px 2px rgba(0,0,0,0.1), 0 0 4px rgba(255,255,255,0.4)" }}>
                                            <FormatCurrencyStyled value={dStats.currentExpenses} prefixColor={isCurrentMonth ? "#b91c1c" : undefined} />
                                        </p>
                                    </div>
                                    <div className="shrink-0 flex items-start">
                                        <Button
                                            className="h-9 md:h-[40px] px-4 rounded-[11px] font-bold text-sm md:text-[15px] whitespace-nowrap w-[150px] transition-all hover:-translate-y-[1px] active:translate-y-[1px] active:shadow-[0_3px_8px_rgba(0,0,0,0.4)]"
                                            style={{ 
                                                background: "linear-gradient(135deg, #fcfcfc, #f5f5f5)", 
                                                border: "1px solid rgba(0,0,0,0.08)",
                                                borderBottom: "2px solid rgba(0,0,0,0.12)", 
                                                color: "#b91c1c",
                                                filter: "saturate(0.95)", 
                                                boxShadow: "0 4px 10px rgba(0,0,0,0.05)",
                                                textShadow: "0 1px 1px rgba(0, 0, 0, 0.08)"
                                            }}
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
                                            )}>
                                                {dStats.expenseVar >= 0 ? "↑ +" : "↓ "} {Math.abs(dStats.expenseVar).toFixed(1)}%
                                            </div>
                                            <span className="text-[10px] font-medium leading-tight md:text-[12px]" style={{ color: "#4b5563" }}>Mês anterior</span>
                                        </div>
                                    </div>
                                    <div className="shrink-0 flex items-end">
                                        <Button
                                            className="h-9 md:h-[40px] px-4 rounded-[11px] font-bold text-sm md:text-[15px] text-white border-none transition-all hover:-translate-y-[1px] active:translate-y-[1px] active:shadow-[0_3px_8px_rgba(0,0,0,0.4)] w-[150px]"
                                            style={{ background: "linear-gradient(135deg, #ef4444, #dc2626)", borderBottom: "1px solid rgba(0,0,0,0.4)", filter: "saturate(0.95)", boxShadow: "0 6px 14px rgba(0,0,0,0.12)", textShadow: "0 1px 1px rgba(0, 0, 0, 0.15)" }}
                                            onClick={() => navigate("/despesas")}
                                        >
                                            <Plus className="mr-1.5 h-4 w-4 text-white" strokeWidth={4} />
                                            Nova Despesa
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </Card>

                        {/* CARD DE CARTÃƒO DE CRÃ‰DITO */}
                        <div id="cartoes-section" className="mb-4 h-full w-full flex">
                            <MobileCreditCardExpenses
                                cartoes={cartoes}
                                expenseInstallments={dExpenses}
                                allCategories={allSubcategories as any}
                                isMobile={isMobile}
                                selectedMonth={dMonth}
                            />
                        </div>
                    </div>
                )}
            </main>

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
                            const annualRev = allRevenues.filter(r => r.data.startsWith(year)).reduce((a, b) => a + Number(b.valor), 0);
                            const annualExp = allExpenseInstallments.filter(e => e.vencimento.startsWith(year)).reduce((a, b) => a + Number(b.valor_parcela), 0);
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
                                    <MonthlyBalanceBarChart revenues={allRevenues} expenseInstallments={allExpenseInstallments} currentDate={selectedMonth} isMobile={false} onMonthClick={(date) => setSelectedMonth(date)} />
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
                            const annualExp = allExpenseInstallments.filter(e => e.vencimento.startsWith(year)).reduce((a, b) => a + Number(b.valor_parcela), 0);
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
                                    <MonthlyExpenseBarChart expenseInstallments={allExpenseInstallments} currentDate={selectedMonth} isMobile={false} onMonthClick={(date) => setSelectedMonth(date)} />
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
                            const annualRev = allRevenues.filter(r => r.data.startsWith(year)).reduce((a, b) => a + Number(b.valor), 0);
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
                                    <MonthlyRevenueBarChart revenues={allRevenues} currentDate={selectedMonth} isMobile={false} onMonthClick={(date) => setSelectedMonth(date)} />
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
                className={cn(isMobile ? "fixed bottom-0 left-0 right-0 pt-2 pb-1 z-50 m-0 !bg-transparent" : "mt-8")}
                user={user}
            />
        </div >
    );
};
