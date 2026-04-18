import React, { useMemo, useState } from "react";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
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
import { cn, formatCurrency } from "@/lib/utils";
import DynamicIcon from "@/components/DynamicIcon";
import { Button } from "@/components/ui/button";
import { useNavigate, useLocation } from "react-router-dom";
import { Card } from "@/components/ui/card";
import Loading from "@/components/Loading";

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

export default function Home() {
    const { user, loading: authLoading } = useAuth();
    const isMobile = useIsMobile();
    const navigate = useNavigate();
    const [selectedMonth, setSelectedMonth] = useState(new Date());

    // Fetch all revenues for memory-based filtering (needed for variations)
    const { data: allRevenues = [], isLoading: isLoadingRevenues, isPlaceholderData: isPlaceholderRevenues } = useQuery<
        Tables<"receitas">[]
    >({
        queryKey: ["allRevenues", user?.id, format(selectedMonth, "yyyy-MM")],
        queryFn: async () => {
            if (!user?.id) return [];
            // Fetch current and previous month to calculate variations
            const startRange = format(startOfMonth(subMonths(selectedMonth, 1)), "yyyy-MM-01");
            const endRange = format(endOfMonth(selectedMonth), "yyyy-MM-dd");
            const { data, error } = await supabase
                .from("receitas")
                .select("*")
                .eq("user_id", user.id)
                .gte("data", startRange)
                .lte("data", endRange);
            if (error) throw error;
            return data.filter((r: any) => r.data !== '1900-01-01');
        },
        enabled: !!user && !authLoading,
        placeholderData: keepPreviousData,
    });

    // Fetch all expense installments for memory-based filtering and Credit Card card
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
            queryKey: ["allExpenseInstallments", user?.id, format(selectedMonth, "yyyy-MM")],
            queryFn: async () => {
                if (!user?.id) return [];
                const startRange = format(startOfMonth(subMonths(selectedMonth, 1)), "yyyy-MM-01");
                const endRange = format(endOfMonth(selectedMonth), "yyyy-MM-dd");
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
            enabled: !!user && !authLoading,
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
        enabled: !!user && !authLoading,
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
        enabled: !!user && !authLoading,
    });

    // Fetch profile data
    const { data: profile } = useQuery({
        queryKey: ["profile", user?.id],
        queryFn: async () => {
            if (!user?.id) return null;
            const { data, error } = await supabase
                .from("profiles")
                .select("nome")
                .eq("id", user.id)
                .single();
            if (error) return null;
            return data;
        },
        enabled: !!user && !authLoading,
    });

    const stats = useMemo(() => {
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

        const calculateVar = (curr: number, prev: number) => {
            if (prev === 0) return curr > 0 ? 100 : 0;
            return ((curr - prev) / prev) * 100;
        };

        return {
            currentIncome,
            currentExpenses,
            currentBalance,
            incomeVar: calculateVar(currentIncome, previousIncome),
            expenseVar: calculateVar(currentExpenses, previousExpenses),
            balanceVar: calculateVar(currentBalance, previousBalance),
        };
    }, [allRevenues, allExpenseInstallments, selectedMonth]);

    // Snapshot mechanism to avoid flickering to R$ 0,00 during month transitions
    const lastStableData = React.useRef({
        stats,
        allExpenseInstallments,
        selectedMonth,
    });

    const isPlaceholder = isPlaceholderRevenues || isPlaceholderExpenses;

    if (!isPlaceholder && !isLoadingRevenues && !isLoadingExpenses && !authLoading) {
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

    // Scroll to cartoes if hash is present
    React.useEffect(() => {
        if (location.hash === "#cartoes") {
            const el = document.getElementById("cartoes-section");
            if (el) el.scrollIntoView({ behavior: "smooth" });
        }
    }, [location.hash]);

    // Só mostra o Loading se for o carregamento inicial (sem dados de receitas ou despesas ainda)
    const isInitialLoad = (isLoadingRevenues && allRevenues.length === 0) || (isLoadingExpenses && allExpenseInstallments.length === 0);

    if (authLoading || (isInitialLoad && !allRevenues.length && !allExpenseInstallments.length)) {
        return <Loading />;
    }

    const handlePrevMonth = () => setSelectedMonth((m) => subMonths(m, 1));
    const handleNextMonth = () => setSelectedMonth((m) => addMonths(m, 1));

    const fullName = profile?.nome || user?.user_metadata?.nome || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Usuário";
    const userName = fullName.trim().split(" ")[0];
    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour >= 5 && hour < 12) return "Bom dia";
        if (hour >= 12 && hour < 18) return "Boa tarde";
        return "Boa noite";
    };

    const greeting = getGreeting();
    const formattedDate = format(new Date(), "eee, dd MMM yyyy", { locale: ptBR });
    // Capitalize first letter of abbreviated weekday
    const todayStr = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);

    return (
        <div
            className={cn("flex flex-col min-h-[100dvh] relative overflow-hidden sky-bg")}
        >
            <Navigation />

            {/* HEADER AREA */}
            <div className="relative h-[220px] w-full overflow-hidden shrink-0">
                <div className={cn(
                    "container mx-auto px-6 relative z-10 max-w-[800px] md:max-w-[1050px]",
                    isMobile ? "fixed top-[46px] left-0 right-0 h-[52px] z-40 px-6 flex items-center bg-transparent justify-between" : "pt-16 md:pt-24 flex justify-between items-start"
                )}>
                    <div>
                        <h1 className={cn("font-bold text-white tracking-tight leading-none", isMobile ? "text-lg" : "text-2xl")}>
                            {greeting}, {userName} 👋
                        </h1>
                        <p className={cn("text-blue-100/80 font-medium uppercase tracking-widest leading-none", isMobile ? "text-[10px] -mt-0.5" : "text-sm -mt-0.5")}>
                            {todayStr}
                        </p>
                    </div>
                </div>
            </div>

            <main className={cn(
                "container mx-auto px-4 relative z-20 max-w-[800px] md:max-w-[1050px] !bg-transparent !bg-none !backdrop-blur-none !shadow-none",
                isMobile ? "-mt-32 pb-10" : "-mt-24 md:mt-2"
            )} style={{ background: 'transparent' }}>

                {isMobile ? (
                    <div className="relative !bg-transparent !bg-none !backdrop-blur-none">
                        <div
                            className="!fixed top-[96px] left-0 right-0 bottom-[20px] overflow-hidden z-30 px-[14px] pt-2 !bg-transparent !bg-none !backdrop-blur-none" style={{ background: 'transparent' }}
                        >
                            <div
                                className="h-full grid grid-cols-1 gap-3 pb-6 !bg-transparent !bg-none !backdrop-blur-none"
                                style={{
                                    background: 'transparent',
                                    gridTemplateRows: 'repeat(4, 1fr)'
                                }}
                            >
                                {/* CARD PRINCIPAL — SALDO MENSAL (HERO) */}
                                <Card
                                    className="pl-3 pr-[20px] pt-[8px] pb-[12px] rounded-[24px] relative overflow-hidden card-saldo h-full w-full flex flex-col justify-center mt-[2px]"
                                    style={{
                                        background: "linear-gradient(135deg, #f8fafc 0%, #eef2f7 60%, rgba(0, 102, 255, 0.08) 100%)",
                                        backgroundBlendMode: "soft-light",
                                        backdropFilter: "blur(6px)",
                                        border: "1px solid rgba(0,0,0,0.06)",
                                        outline: "1px solid rgba(0, 102, 255, 0.08)",
                                        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.6), inset 0 -8px 20px rgba(0,0,0,0.03), inset 0 0 18px rgba(0, 102, 255, 0.10)"
                                    }}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex flex-col">
                                            <h2 className="text-[14px] font-[800] tracking-tight mb-1" style={{ color: "#2563eb" }}>Saldo Mensal</h2>
                                            <p className="text-[22px] font-[800] tracking-tight leading-none md:text-[26px]" style={{ fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', color: "rgba(17, 24, 39, 0.92)", WebkitFontSmoothing: "antialiased", MozOsxFontSmoothing: "grayscale", letterSpacing: "-0.01em", fontVariantNumeric: "tabular-nums", fontFeatureSettings: '"tnum"' }}>
                                                {formatCurrency(dStats.currentBalance)}
                                            </p>
                                        </div>
                                        {/* Seletor de Mês (Posição Top Right) */}
                                        <div
                                            className="flex items-center justify-between px-1 rounded-[14px] transition-all h-9 w-[135px] -mr-2 bg-white/10 cursor-pointer"
                                            style={{ boxShadow: "0 4px 12px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.1)", borderBottom: "1px solid rgba(0,0,0,0.3)" }}
                                        >
                                            <button onClick={handlePrevMonth} className="text-[#4b5563] border-none rounded-[10px] p-0 h-7 w-7 flex items-center justify-center transition-all hover:-translate-y-[1px] active:translate-y-[1px] hover:opacity-90" style={{ background: "rgba(0, 0, 0, 0.10)" }}>
                                                <DynamicIcon name="ChevronLeft" className="h-3.5 w-3.5" strokeWidth={3} />
                                            </button>
                                            <span className="text-[12px] font-bold text-[#111827] px-1 flex-1 text-center uppercase tracking-tight pt-[1px] whitespace-nowrap">
                                                {format(selectedMonth, "MMM / y", { locale: ptBR }).replace(".", "")}
                                            </span>
                                            <button onClick={handleNextMonth} className="text-[#4b5563] border-none rounded-[10px] p-0 h-7 w-7 flex items-center justify-center transition-all hover:-translate-y-[1px] active:translate-y-[1px] hover:opacity-90" style={{ background: "rgba(0, 0, 0, 0.10)" }}>
                                                <DynamicIcon name="ChevronRight" className="h-3.5 w-3.5" strokeWidth={3} />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex items-center mt-1 gap-2">
                                        {/* Investments Icon Button */}
                                        <Button
                                            onClick={() => navigate("/dashboard?filter=investments")}
                                            className="w-9 h-9 p-0 flex items-center justify-center rounded-xl border-none transition-all active:scale-90 shrink-0"
                                            style={{ background: "#2563eb", filter: "saturate(0.95)", boxShadow: "0 6px 14px rgba(0,0,0,0.12)" }}
                                        >
                                            <DynamicIcon name="LineChart" className="h-[18px] w-[18px] text-white" strokeWidth={3} />
                                        </Button>
                                        <div className="flex flex-col items-start gap-0.5 mt-1">
                                            <div className={cn(
                                                "flex items-center px-2 py-0.5 rounded-[10px] text-[10px] font-bold border-none",
                                                dStats.balanceVar >= 0 ? "text-[#22c55e] bg-[#f0fdf4]" : "text-[#ef4444] bg-[#fef2f2]"
                                            )}>
                                                {dStats.balanceVar >= 0 ? "↑ +" : "↓ "} {Math.abs(dStats.balanceVar).toFixed(1)}%
                                            </div>
                                            <span className="text-[10px] font-medium leading-tight" style={{ color: "#4b5563" }}>Mês anterior</span>
                                        </div>
                                    </div>

                                    {/* Mini gráfico de barras (Posição Bottom Right) */}
                                    <div className="absolute bottom-1.5 right-5 pointer-events-none flex items-end overflow-visible">
                                        <div className="p-2 rounded-xl flex items-end">
                                            <MiniFinanceBars
                                                expenses={dStats.currentExpenses}
                                                revenues={dStats.currentIncome}
                                                balance={dStats.currentBalance}
                                            />
                                        </div>
                                    </div>
                                </Card>

                                {/* CARD DESPESAS */}
                                <Card
                                    className="pl-3 pr-[20px] pt-[8px] pb-[12px] relative overflow-hidden card-despesas h-full w-full flex flex-col justify-center"
                                    style={{
                                        borderRadius: "24px",
                                        background: "linear-gradient(135deg, #f8f6f6 0%, #f1eeee 60%, rgba(255, 59, 48, 0.10) 100%)",
                                        backgroundBlendMode: "soft-light",
                                        backdropFilter: "blur(6px)",
                                        border: "1px solid rgba(0,0,0,0.06)",
                                        outline: "1px solid rgba(255, 59, 48, 0.08)",
                                        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.6), inset 0 -8px 20px rgba(0,0,0,0.03), inset 0 0 18px rgba(255, 59, 48, 0.12)"
                                    }}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex flex-col md:mt-3">
                                            <h2 className="text-[14px] font-[800] tracking-tight mb-1 md:text-[16px]" style={{ color: "#dc2626" }}>Despesas</h2>
                                            <p className="text-[22px] font-[800] tracking-tight leading-none md:text-[26px]" style={{ fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', color: "rgba(17, 24, 39, 0.92)", WebkitFontSmoothing: "antialiased", MozOsxFontSmoothing: "grayscale", letterSpacing: "-0.01em", fontVariantNumeric: "tabular-nums", fontFeatureSettings: '"tnum"' }}>
                                                {formatCurrency(dStats.currentExpenses)}
                                            </p>
                                        </div>
                                        <Button
                                            className="h-9 px-3 rounded-[14px] font-bold text-[13px] whitespace-nowrap w-[135px] transition-all hover:-translate-y-[1px] active:translate-y-[1px] active:shadow-[0_3px_8px_rgba(0,0,0,0.4)] text-[#ef4444] -mr-2 mt-1 border-none"
                                            style={{ background: "linear-gradient(135deg, #fcfcfc, #f5f5f5)", borderBottom: "2px solid rgba(0,0,0,0.15)", filter: "saturate(0.95)", boxShadow: "0 6px 14px rgba(0,0,0,0.12)" }}
                                            onClick={() => navigate(`/lancamentos?type=expense&month=${format(selectedMonth, "yyyy-MM-dd")}`)}
                                        >
                                            Ver Gastos <DynamicIcon name="ChevronRight" className="ml-1.5 h-3 w-3" strokeWidth={4} />
                                        </Button>
                                    </div>

                                    <div className="flex items-center justify-between mt-1">
                                        <div className="flex items-start gap-2">
                                            <Button
                                                onClick={() => navigate("/dashboard?filter=expenses")}
                                                className="w-9 h-9 p-0 flex items-center justify-center rounded-xl border-none transition-all active:scale-90 shrink-0"
                                                style={{ background: "#ef4444", filter: "saturate(0.95)", boxShadow: "0 6px 14px rgba(0,0,0,0.12)" }}
                                            >
                                                <TrendingDown className="h-[18px] w-[18px] text-white" strokeWidth={3} />
                                            </Button>
                                            <div className="flex flex-col items-start gap-0.5">
                                                <div className={cn(
                                                     "flex items-center px-2 py-0.5 rounded-[10px] text-[10px] font-bold border-none tracking-tight leading-none h-[18px]",
                                                     dStats.expenseVar >= 0 ? "text-[#ef4444] bg-[#fef2f2]" : "text-[#22c55e] bg-[#f0fdf4]"
                                                )}>
                                                    {dStats.expenseVar >= 0 ? "↑ +" : "↓ "} {Math.abs(dStats.expenseVar).toFixed(1)}%
                                                </div>
                                                <span className="text-[10px] font-medium leading-tight" style={{ color: "#4b5563" }}>Mês anterior</span>
                                            </div>
                                        </div>
                                        <Button
                                            className="h-9 px-4 rounded-[14px] font-bold text-sm text-white border-none transition-all hover:-translate-y-[1px] active:translate-y-[1px] active:shadow-[0_3px_8px_rgba(0,0,0,0.4)] w-[135px] -mr-2"
                                            style={{ background: "linear-gradient(135deg, #ef4444, #dc2626)", borderBottom: "1px solid rgba(0,0,0,0.4)", filter: "saturate(0.95)", boxShadow: "0 6px 14px rgba(0,0,0,0.12)" }}
                                            onClick={() => navigate("/despesas")}
                                        >
                                            <Plus className="mr-1.5 h-4 w-4 text-white" strokeWidth={4} />
                                            Nova Despesa
                                        </Button>
                                    </div>
                                </Card>

                                {/* CARD RECEITAS */}
                                <Card
                                    className="pl-3 pr-[20px] pt-[8px] pb-[12px] relative overflow-hidden card-receitas h-full w-full flex flex-col justify-center"
                                    style={{
                                        borderRadius: "24px",
                                        background: "linear-gradient(135deg, #f4f8f6 0%, #edf4f0 60%, rgba(34, 197, 94, 0.10) 100%)",
                                        backgroundBlendMode: "soft-light",
                                        backdropFilter: "blur(6px)",
                                        border: "1px solid rgba(0,0,0,0.06)",
                                        outline: "1px solid rgba(34, 197, 94, 0.08)",
                                        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.6), inset 0 -8px 20px rgba(0,0,0,0.03), inset 0 0 18px rgba(34, 197, 94, 0.12)"
                                    }}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex flex-col md:mt-3">
                                            <h2 className="text-[14px] font-[800] tracking-tight mb-1 md:text-[16px]" style={{ color: "#16a34a" }}>Receitas</h2>
                                            <p className="text-[22px] font-[800] tracking-tight leading-none md:text-[26px]" style={{ fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', color: "rgba(17, 24, 39, 0.92)", WebkitFontSmoothing: "antialiased", MozOsxFontSmoothing: "grayscale", letterSpacing: "-0.01em", fontVariantNumeric: "tabular-nums", fontFeatureSettings: '"tnum"' }}>
                                                {formatCurrency(dStats.currentIncome)}
                                            </p>
                                        </div>
                                        <Button
                                            className="h-9 px-3 rounded-[14px] font-bold text-[13px] whitespace-nowrap w-[135px] transition-all hover:-translate-y-[1px] active:translate-y-[1px] active:shadow-[0_3px_8px_rgba(0,0,0,0.4)] text-[#22c55e] -mr-2 mt-1 border-none"
                                            style={{ background: "linear-gradient(135deg, #fcfcfc, #f5f5f5)", borderBottom: "2px solid rgba(0,0,0,0.15)", filter: "saturate(0.95)", boxShadow: "0 6px 14px rgba(0,0,0,0.12)" }}
                                            onClick={() => navigate(`/lancamentos?type=income&month=${format(selectedMonth, "yyyy-MM-dd")}`)}
                                        >
                                            Ver Receitas <DynamicIcon name="ChevronRight" className="ml-1.5 h-3 w-3" strokeWidth={4} />
                                        </Button>
                                    </div>

                                    <div className="flex items-center justify-between mt-1">
                                        <div className="flex items-start gap-2">
                                            <Button
                                                onClick={() => navigate("/dashboard?filter=revenues")}
                                                className="w-9 h-9 p-0 flex items-center justify-center rounded-xl border-none transition-all active:scale-90 shrink-0"
                                                style={{ background: "#22c55e", filter: "saturate(0.95)", boxShadow: "0 6px 14px rgba(0,0,0,0.12)" }}
                                            >
                                                <TrendingUp className="h-[18px] w-[18px] text-white" strokeWidth={3} />
                                            </Button>
                                            <div className="flex flex-col items-start gap-0.5">
                                                <div className={cn(
                                                     "flex items-center px-2 py-0.5 rounded-[10px] text-[10px] font-bold border-none tracking-tight leading-none h-[18px]",
                                                     dStats.incomeVar >= 0 ? "text-[#22c55e] bg-[#f0fdf4]" : "text-[#ef4444] bg-[#fef2f2]"
                                                )}>
                                                    {dStats.incomeVar >= 0 ? "↑ +" : "↓ "} {Math.abs(dStats.incomeVar).toFixed(1)}%
                                                </div>
                                                <span className="text-[10px] font-medium leading-tight" style={{ color: "#4b5563" }}>Mês anterior</span>
                                            </div>
                                        </div>
                                        <Button
                                            className="h-9 px-4 rounded-[14px] font-bold text-sm text-white border-none transition-all hover:-translate-y-[1px] active:translate-y-[1px] active:shadow-[0_3px_8px_rgba(0,0,0,0.4)] w-[135px] -mr-2"
                                            style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)", borderBottom: "1px solid rgba(0,0,0,0.4)", filter: "saturate(0.95)", boxShadow: "0 6px 14px rgba(0,0,0,0.12)" }}
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* CARD PRINCIPAL — SALDO MENSAL (HERO) */}
                        <Card
                            className="pl-3 pr-[20px] pt-[8px] pb-[12px] rounded-[24px] relative overflow-hidden card-saldo md:h-[170px] md:flex md:flex-col md:justify-center md:px-8"
                            style={{
                                background: "linear-gradient(135deg, #f8fafc 0%, #eef2f7 60%, rgba(0, 102, 255, 0.08) 100%)",
                                backgroundBlendMode: "soft-light",
                                backdropFilter: "blur(6px)",
                                border: "1px solid rgba(0,0,0,0.06)",
                                outline: "1px solid rgba(0, 102, 255, 0.08)",
                                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.6), inset 0 -8px 20px rgba(0,0,0,0.03), inset 0 0 18px rgba(0, 102, 255, 0.10)"
                            }}
                        >
                            <div className="flex justify-between items-start md:items-center mb-2 md:mb-4">
                                <div className="flex flex-col md:mt-3">
                                    <h2 className="text-[14px] font-[800] tracking-tight mb-1 md:text-[16px]" style={{ color: "#2563eb" }}>Saldo Mensal</h2>
                                    <p className="text-[22px] font-[800] tracking-tight leading-none md:text-[26px]" style={{ fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', color: "rgba(17, 24, 39, 0.92)", WebkitFontSmoothing: "antialiased", MozOsxFontSmoothing: "grayscale", letterSpacing: "-0.01em", fontVariantNumeric: "tabular-nums", fontFeatureSettings: '"tnum"' }}>
                                        {formatCurrency(dStats.currentBalance)}
                                    </p>
                                </div>
                                {/* Seletor de Mês (Posição Top Right) */}
                                <div
                                    className="flex items-center justify-between px-1 rounded-[14px] transition-all h-9 w-[135px] -mr-2 bg-white/10 cursor-pointer"
                                    style={{ boxShadow: "0 4px 12px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.1)", borderBottom: "1px solid rgba(0,0,0,0.3)" }}
                                >
                                    <button onClick={handlePrevMonth} className="text-[#4b5563] border-none rounded-[10px] p-0 h-7 w-7 flex items-center justify-center transition-all hover:-translate-y-[1px] active:translate-y-[1px] hover:opacity-90" style={{ background: "rgba(0, 0, 0, 0.10)" }}>
                                        <DynamicIcon name="ChevronLeft" className="h-3.5 w-3.5" strokeWidth={3} />
                                    </button>
                                    <span className="text-[12px] font-bold text-[#111827] px-1 flex-1 text-center uppercase tracking-tight pt-[1px] whitespace-nowrap md:text-[13px]">
                                        {format(selectedMonth, "MMM / y", { locale: ptBR }).replace(".", "")}
                                    </span>
                                    <button onClick={handleNextMonth} className="text-[#4b5563] border-none rounded-[10px] p-0 h-7 w-7 flex items-center justify-center transition-all hover:-translate-y-[1px] active:translate-y-[1px] hover:opacity-90" style={{ background: "rgba(0, 0, 0, 0.10)" }}>
                                        <DynamicIcon name="ChevronRight" className="h-3.5 w-3.5" strokeWidth={3} />
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center mt-1 md:mt-0 gap-2">
                                {/* Investments Icon Button */}
                                <Button
                                    onClick={() => navigate("/dashboard?filter=investments")}
                                    className="w-9 h-9 p-0 flex items-center justify-center rounded-xl border-none transition-all active:scale-90 shrink-0"
                                    style={{ background: "#2563eb", filter: "saturate(0.95)", boxShadow: "0 6px 14px rgba(0,0,0,0.12)" }}
                                >
                                    <DynamicIcon name="LineChart" className="h-[18px] w-[18px] text-white" strokeWidth={3} />
                                </Button>
                                <div className="flex flex-col items-start gap-0.5 mt-1">
                                    <div className={cn(
                                        "flex items-center px-2 py-0.5 rounded-[10px] text-[10px] font-bold md:text-[11px] border-none",
                                        dStats.balanceVar >= 0 ? "text-[#22c55e] bg-[#f0fdf4]" : "text-[#ef4444] bg-[#fef2f2]"
                                    )}>
                                        {dStats.balanceVar >= 0 ? "↑ +" : "↓ "} {Math.abs(dStats.balanceVar).toFixed(1)}%
                                    </div>
                                    <span className="text-[10px] font-medium leading-tight md:text-[12px]" style={{ color: "#4b5563" }}>Mês anterior</span>
                                </div>
                            </div>

                             <div className="absolute bottom-1.5 right-5 pointer-events-none flex items-end overflow-visible md:bottom-5 md:right-8">
                                 <div className="p-2 rounded-xl flex items-end">
                                     <MiniFinanceBars
                                         expenses={dStats.currentExpenses}
                                         revenues={dStats.currentIncome}
                                         balance={dStats.currentBalance}
                                         height={isMobile ? 32 : 48}
                                         showScaleLines={false}
                                     />
                                 </div>
                             </div>
                        </Card>

                        {/* CARD RECEITAS */}
                        <Card
                            className="pl-3 pr-[20px] pt-[8px] pb-[12px] relative overflow-hidden card-receitas md:h-[170px] md:flex md:flex-col md:justify-center md:px-8"
                            style={{
                                borderRadius: "24px",
                                background: "linear-gradient(135deg, #f4f8f6 0%, #edf4f0 60%, rgba(34, 197, 94, 0.10) 100%)",
                                backgroundBlendMode: "soft-light",
                                backdropFilter: "blur(6px)",
                                border: "1px solid rgba(0,0,0,0.06)",
                                outline: "1px solid rgba(34, 197, 94, 0.08)",
                                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.6), inset 0 -8px 20px rgba(0,0,0,0.03), inset 0 0 18px rgba(34, 197, 94, 0.12)"
                            }}
                        >
                            <div className="flex justify-between items-start md:items-center mb-2 md:mb-4">
                                <div className="flex flex-col md:mt-3">
                                    <h2 className="text-[14px] font-[800] tracking-tight mb-1 md:text-[16px]" style={{ color: "#16a34a" }}>Receitas</h2>
                                    <p className="text-[22px] font-[800] tracking-tight leading-none md:text-[26px]" style={{ fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', color: "rgba(17, 24, 39, 0.92)", WebkitFontSmoothing: "antialiased", MozOsxFontSmoothing: "grayscale", letterSpacing: "-0.01em", fontVariantNumeric: "tabular-nums", fontFeatureSettings: '"tnum"' }}>
                                        {formatCurrency(dStats.currentIncome)}
                                    </p>
                                </div>
                                <Button
                                    className="h-9 px-3 rounded-[14px] font-bold text-[13px] whitespace-nowrap w-[135px] transition-all hover:-translate-y-[1px] active:translate-y-[1px] active:shadow-[0_3px_8px_rgba(0,0,0,0.4)] text-[#22c55e] -mr-2 mt-1 md:text-[14px] border-none"
                                    style={{ background: "linear-gradient(135deg, #fcfcfc, #f5f5f5)", borderBottom: "2px solid rgba(0,0,0,0.15)", filter: "saturate(0.95)", boxShadow: "0 6px 14px rgba(0,0,0,0.12)" }}
                                    onClick={() => navigate(`/lancamentos?type=income&month=${format(selectedMonth, "yyyy-MM-dd")}`)}
                                >
                                    Ver Receitas <DynamicIcon name="ChevronRight" className="ml-1.5 h-3 w-3" strokeWidth={4} />
                                </Button>
                            </div>

                            <div className="flex items-center justify-between mt-1 md:mt-0">
                                <div className="flex items-start gap-2">
                                    <Button
                                        onClick={() => navigate("/dashboard?filter=revenues")}
                                        className="w-9 h-9 p-0 flex items-center justify-center rounded-xl border-none transition-all active:scale-90 shrink-0"
                                        style={{ background: "#22c55e", filter: "saturate(0.95)", boxShadow: "0 6px 14px rgba(0,0,0,0.12)" }}
                                    >
                                        <TrendingUp className="h-[18px] w-[18px] text-white" strokeWidth={3} />
                                    </Button>
                                    <div className="flex flex-col items-start gap-0.5 mt-1">
                                        <div className={cn(
                                             "flex items-center px-2 py-0.5 rounded-[10px] text-[10px] font-bold md:text-[11px] border-none tracking-tight leading-none h-[18px] md:h-[20px]",
                                             dStats.incomeVar >= 0 ? "text-[#22c55e] bg-[#f0fdf4]" : "text-[#ef4444] bg-[#fef2f2]"
                                        )}>
                                            {dStats.incomeVar >= 0 ? "↑ +" : "↓ "} {Math.abs(dStats.incomeVar).toFixed(1)}%
                                        </div>
                                        <span className="text-[12px] font-medium leading-tight md:text-[12px]" style={{ color: "#4b5563" }}>Mês anterior</span>
                                    </div>
                                </div>
                                <Button
                                    className="h-9 px-4 rounded-[14px] font-bold text-sm text-white border-none transition-all hover:-translate-y-[1px] active:translate-y-[1px] active:shadow-[0_3px_8px_rgba(0,0,0,0.4)] w-[135px] -mr-2 md:text-[15px]"
                                    style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)", borderBottom: "1px solid rgba(0,0,0,0.4)", filter: "saturate(0.95)", boxShadow: "0 6px 14px rgba(0,0,0,0.12)" }}
                                    onClick={() => navigate("/receitas")}
                                >
                                    <Plus className="mr-1.5 h-4 w-4 text-white" strokeWidth={4} />
                                    Nova Receita
                                </Button>
                            </div>
                        </Card>

                        {/* CARD DESPESAS */}
                        <Card
                            className="pl-3 pr-[20px] pt-[8px] pb-[12px] relative overflow-hidden card-despesas md:h-[170px] md:flex md:flex-col md:justify-center md:px-8"
                            style={{
                                borderRadius: "24px",
                                background: "linear-gradient(135deg, #f8f6f6 0%, #f1eeee 60%, rgba(255, 59, 48, 0.10) 100%)",
                                backgroundBlendMode: "soft-light",
                                backdropFilter: "blur(6px)",
                                border: "1px solid rgba(0,0,0,0.06)",
                                outline: "1px solid rgba(255, 59, 48, 0.08)",
                                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.6), inset 0 -8px 20px rgba(0,0,0,0.03), inset 0 0 18px rgba(255, 59, 48, 0.12)"
                            }}
                        >
                            <div className="flex justify-between items-start md:items-center mb-2 md:mb-4">
                                <div className="flex flex-col md:mt-3">
                                    <h2 className="text-[14px] font-[800] tracking-tight mb-1 md:text-[16px]" style={{ color: "#dc2626" }}>Despesas</h2>
                                    <p className="text-[22px] font-[800] tracking-tight leading-none md:text-[26px]" style={{ fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', color: "rgba(17, 24, 39, 0.92)", WebkitFontSmoothing: "antialiased", MozOsxFontSmoothing: "grayscale", letterSpacing: "-0.01em", fontVariantNumeric: "tabular-nums", fontFeatureSettings: '"tnum"' }}>
                                        {formatCurrency(dStats.currentExpenses)}
                                    </p>
                                </div>
                                <Button
                                    className="h-9 px-3 rounded-[14px] font-bold text-[13px] whitespace-nowrap w-[135px] transition-all hover:-translate-y-[1px] active:translate-y-[1px] active:shadow-[0_3px_8px_rgba(0,0,0,0.4)] text-[#ef4444] -mr-2 mt-1 md:text-[14px] border-none"
                                    style={{ background: "linear-gradient(135deg, #fcfcfc, #f5f5f5)", borderBottom: "2px solid rgba(0,0,0,0.15)", filter: "saturate(0.95)", boxShadow: "0 6px 14px rgba(0,0,0,0.12)" }}
                                    onClick={() => navigate(`/lancamentos?type=expense&month=${format(selectedMonth, "yyyy-MM-dd")}`)}
                                >
                                    Ver Gastos <DynamicIcon name="ChevronRight" className="ml-1.5 h-3 w-3" strokeWidth={4} />
                                </Button>
                            </div>

                            <div className="flex items-center justify-between mt-1 md:mt-0">
                                <div className="flex items-start gap-2">
                                    <Button
                                        onClick={() => navigate("/dashboard?filter=expenses")}
                                        className="w-9 h-9 p-0 flex items-center justify-center rounded-xl border-none transition-all active:scale-90 shrink-0"
                                        style={{ background: "#ef4444", filter: "saturate(0.95)", boxShadow: "0 6px 14px rgba(0,0,0,0.12)" }}
                                    >
                                        <TrendingDown className="h-[18px] w-[18px] text-white" strokeWidth={3} />
                                    </Button>
                                    <div className="flex flex-col items-start gap-0.5 mt-1">
                                        <div className={cn(
                                             "flex items-center px-2 py-0.5 rounded-[10px] text-[10px] font-bold md:text-[11px] border-none tracking-tight leading-none h-[18px] md:h-[20px]",
                                             dStats.expenseVar >= 0 ? "text-[#ef4444] bg-[#fef2f2]" : "text-[#22c55e] bg-[#f0fdf4]"
                                        )}>
                                            {dStats.expenseVar >= 0 ? "↑ +" : "↓ "} {Math.abs(dStats.expenseVar).toFixed(1)}%
                                        </div>
                                        <span className="text-[12px] font-medium leading-tight md:text-[12px]" style={{ color: "#4b5563" }}>Mês anterior</span>
                                    </div>
                                </div>
                                <Button
                                    className="h-9 px-4 rounded-[14px] font-bold text-sm text-white border-none transition-all hover:-translate-y-[1px] active:translate-y-[1px] active:shadow-[0_3px_8px_rgba(0,0,0,0.4)] w-[135px] -mr-2 md:text-[15px]"
                                    style={{ background: "linear-gradient(135deg, #ef4444, #dc2626)", borderBottom: "1px solid rgba(0,0,0,0.4)", filter: "saturate(0.95)", boxShadow: "0 6px 14px rgba(0,0,0,0.12)" }}
                                    onClick={() => navigate("/despesas")}
                                >
                                    <Plus className="mr-1.5 h-4 w-4 text-white" strokeWidth={4} />
                                    Nova Despesa
                                </Button>
                            </div>
                        </Card>

                        {/* CARD DE CARTÃO DE CRÉDITO */}
                        <div id="cartoes-section" className="md:h-[170px] mb-4">
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
            <Footer
                isMobile={isMobile}
                className={cn(isMobile ? "fixed bottom-0 left-0 right-0 py-2 z-50 m-0 !bg-transparent" : "mt-8")}
                user={user}
            />
        </div >
    );
};
