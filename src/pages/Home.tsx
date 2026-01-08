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

export default function Home() {
    const { user, loading: authLoading } = useAuth();
    const isMobile = useIsMobile();
    const navigate = useNavigate();
    const [selectedMonth, setSelectedMonth] = useState(new Date());

    // Fetch all revenues for memory-based filtering (needed for variations)
    const { data: allRevenues = [], isLoading: isLoadingRevenues } = useQuery<
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
            return data;
        },
        enabled: !!user && !authLoading,
        placeholderData: keepPreviousData,
    });

    // Fetch all expense installments for memory-based filtering and Credit Card card
    const { data: allExpenseInstallments = [], isLoading: isLoadingExpenses } =
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
                .order("nome");
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
    const formattedDate = format(new Date(), "eee, dd MMM yyyy", { locale: ptBR });
    // Capitalize first letter of abbreviated weekday
    const todayStr = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);

    return (
        <div className={cn("flex flex-col min-h-screen pb-10 bg-[#F8FAFC]")}>
            <Navigation />

            {/* NOVO HEADER PREMIUM — FINTECH STYLE */}
            <div className="relative h-[220px] w-full bg-gradient-to-b from-[#0A4A9B] via-[#1E6BCE] to-[#F8FAFC] overflow-hidden">
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10" />
                <div className="container mx-auto px-6 pt-16 md:pt-24 relative z-10 max-w-[1000px]">
                    <div>
                        <h1 className="text-xl font-bold text-white tracking-tight">
                            Olá, {userName} 👋
                        </h1>
                        <p className="text-xs text-blue-100/80 font-medium mt-1 uppercase tracking-widest">
                            {todayStr}
                        </p>
                    </div>
                </div>
            </div>

            <main className={cn("container mx-auto px-4 -mt-24 md:-mt-16 relative z-20 max-w-[1000px]")}>

                {/* CARD PRINCIPAL — SALDO MENSAL (HERO) */}
                <Card
                    className="px-5 pt-2.5 pb-2 mb-3 rounded-[28px] border-none shadow-[0_10px_30px_rgba(0,0,0,0.08)] relative overflow-hidden bg-white"
                >
                    <div className="flex justify-between items-start mb-0">
                        <div className="flex items-center gap-2">
                            <Wallet className="h-6 w-6 text-[#1E6BCE]" />
                            <div className="flex flex-col">
                                <h2 className="text-[15px] font-black text-[#1E6BCE] tracking-tight">Saldo Mensal</h2>
                            </div>
                        </div>

                        {/* Seletor de Mês */}
                        <div
                            className="btn-3d flex items-center justify-between p-1 rounded-full transition-all h-9 w-[135px] border-none"
                            style={{ "--cor-topo": "#4D8EFF", "--cor-base": "#2B75D6", cursor: "default", boxShadow: "0px 4px 10px rgba(0, 0, 0, 0.15), inset 0px 1px 1px rgba(255, 255, 255, 0.3)" } as any}
                        >
                            <button onClick={handlePrevMonth} className="text-white hover:bg-white/20 rounded-full p-1 transition-all">
                                <DynamicIcon name="ChevronLeft" className="h-4 w-4" strokeWidth={3} />
                            </button>
                            <span className="text-[12px] font-black text-white px-1 flex-1 text-center uppercase tracking-tight">
                                {format(selectedMonth, "MMM / y", { locale: ptBR }).replace(".", "")}
                            </span>
                            <button onClick={handleNextMonth} className="text-white hover:bg-white/20 rounded-full p-1 transition-all">
                                <DynamicIcon name="ChevronRight" className="h-4 w-4" strokeWidth={3} />
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-col -mt-1">
                        <p className="text-[18px] font-black text-gray-700 tracking-tight mb-0.5">
                            {formatCurrency(stats.currentBalance)}
                        </p>
                        <div className="flex items-center gap-2">
                            <div className={cn(
                                "flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold",
                                stats.balanceVar >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                            )}>
                                {stats.balanceVar >= 0 ? "↑ +" : "↓ "} {Math.abs(stats.balanceVar).toFixed(1)}%
                            </div>
                            <span className="text-[10px] text-gray-400 font-medium">em relação ao mês anterior</span>
                        </div>
                    </div>
                </Card>

                <div className="grid grid-cols-1 gap-4 mb-4">
                    {/* CARD DESPESAS */}
                    <Card
                        className="px-4 pt-2.5 pb-2 rounded-[24px] border border-rose-100 shadow-[0_4px_12px_rgba(0,0,0,0.03)] relative bg-white"
                        style={{ background: "linear-gradient(180deg, #FFFFFF 0%, #FFF9F9 100%)" }}
                    >
                        <div className="flex justify-between items-start mb-2">
                            <div className="flex flex-col">
                                <h2 className="text-[15px] font-black tracking-tight mb-1" style={{ color: "#DC2626" }}>Despesas</h2>
                                <p className="text-[17px] font-black text-gray-700 tracking-tight leading-none">
                                    {formatCurrency(stats.currentExpenses)}
                                </p>
                            </div>
                            <Button
                                className="h-9 px-3 rounded-2xl font-black text-[13px] shadow-sm whitespace-nowrap w-[135px] bg-white transition-all text-[#E54D4D] hover:bg-[#E54D4D] hover:text-white hover:border-[#E54D4D]"
                                style={{ borderColor: "rgba(229, 77, 77, 0.3)", borderStyle: "solid", borderWidth: "1px" }}
                                onClick={() => navigate("/lancamentos?type=expense")}
                            >
                                Ver Gastos <DynamicIcon name="ChevronRight" className="ml-1.5 h-3 w-3" strokeWidth={3} />
                            </Button>
                        </div>

                        <div className="flex items-center justify-between mt-1">
                            <div className="flex items-start gap-2">
                                <Button
                                    onClick={() => navigate("/dashboard?filter=expenses")}
                                    className="btn-3d w-9 h-9 p-0 flex items-center justify-center rounded-xl shadow-sm border border-rose-300 transition-all active:scale-90"
                                    style={{ "--cor-topo": "#FF6B6B", "--cor-base": "#E54D4D" } as any}
                                >
                                    <TrendingDown className="h-[18px] w-[18px] text-white" />
                                </Button>
                                <div className={cn(
                                    "flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold",
                                    stats.expenseVar >= 0 ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"
                                )}>
                                    {stats.expenseVar >= 0 ? "↑ +" : "↓ "} {Math.abs(stats.expenseVar).toFixed(1)}%
                                </div>
                            </div>
                            <Button
                                className="btn-3d h-9 px-4 rounded-2xl font-bold text-xs shadow-md text-white border-none transition-all active:scale-95 w-[135px]"
                                style={{ "--cor-topo": "#FF6B6B", "--cor-base": "#E54D4D" } as any}
                                onClick={() => navigate("/despesas")}
                            >
                                <Plus className="mr-1.5 h-4 w-4" strokeWidth={3} />
                                Nova Despesa
                            </Button>
                        </div>
                    </Card>

                    {/* CARD DE RECEITAS */}
                    {/* CARD RECEITAS */}
                    <Card
                        className="px-4 pt-2.5 pb-2 rounded-[24px] border border-emerald-100 shadow-[0_4px_12px_rgba(0,0,0,0.03)] relative bg-white"
                        style={{ background: "linear-gradient(180deg, #FFFFFF 0%, #F9FFFA 100%)" }}
                    >
                        <div className="flex justify-between items-start mb-2">
                            <div className="flex flex-col">
                                <h2 className="text-[15px] font-black tracking-tight mb-0.5" style={{ color: "#16A34A" }}>Receitas</h2>
                                <p className="text-[17px] font-black text-gray-700 tracking-tight leading-none">
                                    {formatCurrency(stats.currentIncome)}
                                </p>
                            </div>
                            <Button
                                className="h-9 px-3 rounded-2xl font-black text-[13px] shadow-sm whitespace-nowrap w-[135px] bg-white transition-all text-[#1AA361] hover:bg-[#1AA361] hover:text-white hover:border-[#1AA361]"
                                style={{ borderColor: "rgba(26, 163, 97, 0.3)", borderStyle: "solid", borderWidth: "1px" }}
                                onClick={() => navigate("/lancamentos?type=income")}
                            >
                                Ver Receitas <DynamicIcon name="ChevronRight" className="ml-1.5 h-3 w-3" strokeWidth={3} />
                            </Button>
                        </div>

                        <div className="flex items-center justify-between mt-1">
                            <div className="flex items-start gap-2">
                                <Button
                                    onClick={() => navigate("/dashboard?filter=revenues")}
                                    className="btn-3d w-9 h-9 p-0 flex items-center justify-center rounded-xl shadow-sm border border-emerald-300 transition-all active:scale-90"
                                    style={{ "--cor-topo": "#36E391", "--cor-base": "#1AA361" } as any}
                                >
                                    <TrendingUp className="h-[18px] w-[18px] text-white" />
                                </Button>
                                <div className={cn(
                                    "flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold",
                                    stats.incomeVar >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                                )}>
                                    {stats.incomeVar >= 0 ? "↑ +" : "↓ "} {Math.abs(stats.incomeVar).toFixed(1)}%
                                </div>
                            </div>
                            <Button
                                className="btn-3d h-9 px-4 rounded-2xl font-bold text-xs shadow-md text-white border-none transition-all active:scale-95 w-[135px]"
                                style={{ "--cor-topo": "#36E391", "--cor-base": "#1AA361" } as any}
                                onClick={() => navigate("/receitas")}
                            >
                                <Plus className="mr-1.5 h-4 w-4" strokeWidth={3} />
                                Nova Receita
                            </Button>
                        </div>
                    </Card>

                    {/* CARD DE CARTÃO DE CRÉDITO */}
                    <div id="cartoes-section">
                        <MobileCreditCardExpenses
                            cartoes={cartoes}
                            expenseInstallments={allExpenseInstallments}
                            allCategories={allSubcategories as any}
                            isMobile={isMobile}
                            selectedMonth={selectedMonth}
                        />
                    </div>
                </div>
            </main>
            <Footer
                isMobile={isMobile}
                className={cn(isMobile ? "fixed bottom-0 left-0 right-0 py-2 z-50 m-0" : "mt-8")}
                user={user}
            />
        </div>
    );
};
