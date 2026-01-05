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
        staleTime: 1000 * 60 * 5, // 5 minutos de cache "fresco"
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
            staleTime: 1000 * 60 * 5, // 5 minutos de cache "fresco"
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

    const fullName = profile?.nome || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Usuário";
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
                <div className="container mx-auto px-6 pt-16 relative z-10">
                    <div className="animate-fade-in">
                        <h1 className="text-xl font-bold text-white tracking-tight">
                            Olá, {userName} 👋
                        </h1>
                        <p className="text-xs text-blue-100/80 font-medium mt-1 uppercase tracking-widest">
                            {todayStr}
                        </p>
                    </div>
                </div>
            </div>

            <main className={cn("container mx-auto px-4 -mt-20 relative z-20 max-w-[1200px]")}>

                {/* CARD PRINCIPAL — SALDO MENSAL (HERO) */}
                <Card
                    className="px-5 py-4 mb-4 rounded-[28px] border-none shadow-[0_10px_30px_rgba(0,0,0,0.08)] relative overflow-hidden animate-slide-up bg-white"
                >
                    <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-blue-50 rounded-2xl text-primary">
                                <Wallet className="h-6 w-6" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[15px] font-black text-primary/90 uppercase tracking-tighter">Saldo Mensal</span>
                            </div>
                        </div>

                        {/* Seletor de Mês */}
                        <div className="flex items-center justify-between bg-white p-1 rounded-full border-2 border-primary/20 shadow-sm transition-all h-9 w-[135px]">
                            <button onClick={handlePrevMonth} className="text-primary hover:bg-primary/10 rounded-full p-1 transition-all">
                                <DynamicIcon name="ChevronLeft" className="h-4 w-4" strokeWidth={3} />
                            </button>
                            <span className="text-[11px] font-black text-primary px-1 flex-1 text-center uppercase tracking-tight">
                                {format(selectedMonth, "MMM / y", { locale: ptBR }).replace(".", "")}
                            </span>
                            <button onClick={handleNextMonth} className="text-primary hover:bg-primary/10 rounded-full p-1 transition-all">
                                <DynamicIcon name="ChevronRight" className="h-4 w-4" strokeWidth={3} />
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-col">
                        <p className="text-[26px] font-black text-gray-800 tracking-tight mb-1">
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
                        className="p-4 rounded-[24px] border-none shadow-[0_4px_12px_rgba(0,0,0,0.03)] relative animate-slide-up delay-100 bg-white"
                        style={{ background: "linear-gradient(180deg, #FFFFFF 0%, #FFF9F9 100%)" }}
                    >
                        <div className="flex justify-between items-center mb-4">
                            <div className="flex items-center gap-3">
                                <Button
                                    onClick={() => navigate("/dashboard?filter=expenses")}
                                    className="btn-3d w-10 h-10 p-0 flex items-center justify-center rounded-xl shadow-sm border border-rose-300 transition-all active:scale-90"
                                    style={{ "--cor-topo": "#FF8A8A", "--cor-base": "#F06666" } as any}
                                >
                                    <TrendingDown className="h-5 w-5 text-white" />
                                </Button>
                                <h2 className="text-[13px] font-black text-rose-600 uppercase tracking-widest">Despesas</h2>
                            </div>
                            <Button
                                className="h-9 px-3 rounded-2xl font-bold text-[11px] shadow-sm whitespace-nowrap w-[135px] bg-white border border-rose-200 text-rose-500 hover:bg-rose-50 transition-colors"
                                onClick={() => navigate("/lancamentos?type=expense")}
                            >
                                Ver Gastos <DynamicIcon name="ChevronRight" className="ml-1.5 h-3 w-3" strokeWidth={3} />
                            </Button>
                        </div>

                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-[22px] font-black text-gray-800 tracking-tight leading-none mb-1">
                                    {formatCurrency(stats.currentExpenses)}
                                </p>
                                <p className="text-[10px] text-rose-400 font-bold uppercase">
                                    {stats.expenseVar >= 0 ? "↑ aumentou" : "↓ diminuiu"} {Math.abs(stats.expenseVar).toFixed(1)}%
                                </p>
                            </div>
                            <Button
                                className="h-9 px-4 rounded-2xl font-bold text-xs shadow-md bg-gradient-to-r from-rose-500 to-rose-600 text-white border-none hover:shadow-lg transition-all active:scale-95 w-[135px]"
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
                        className="p-4 rounded-[24px] border-none shadow-[0_4px_12px_rgba(0,0,0,0.03)] relative animate-slide-up delay-200 bg-white"
                        style={{ background: "linear-gradient(180deg, #FFFFFF 0%, #F9FFFA 100%)" }}
                    >
                        <div className="flex justify-between items-center mb-4">
                            <div className="flex items-center gap-3">
                                <Button
                                    onClick={() => navigate("/dashboard?filter=revenues")}
                                    className="btn-3d w-10 h-10 p-0 flex items-center justify-center rounded-xl shadow-sm border border-emerald-300 transition-all active:scale-90"
                                    style={{ "--cor-topo": "#52DCA2", "--cor-base": "#38C48B" } as any}
                                >
                                    <TrendingUp className="h-5 w-5 text-white" />
                                </Button>
                                <h2 className="text-[13px] font-black text-emerald-600 uppercase tracking-widest">Receitas</h2>
                            </div>
                            <Button
                                className="h-9 px-3 rounded-2xl font-bold text-[11px] shadow-sm whitespace-nowrap w-[135px] bg-white border border-emerald-200 text-emerald-500 hover:bg-emerald-50 transition-colors"
                                onClick={() => navigate("/lancamentos?type=income")}
                            >
                                Ver Receitas <DynamicIcon name="ChevronRight" className="ml-1.5 h-3 w-3" strokeWidth={3} />
                            </Button>
                        </div>

                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-[22px] font-black text-gray-800 tracking-tight leading-none mb-1">
                                    {formatCurrency(stats.currentIncome)}
                                </p>
                                <p className="text-[10px] text-emerald-400 font-bold uppercase">
                                    {stats.incomeVar >= 0 ? "↑ aumentou" : "↓ diminuiu"} {Math.abs(stats.incomeVar).toFixed(1)}%
                                </p>
                            </div>
                            <Button
                                className="h-9 px-4 rounded-2xl font-bold text-xs shadow-md bg-gradient-to-r from-emerald-500 to-emerald-600 text-white border-none hover:shadow-lg transition-all active:scale-95 w-[135px]"
                                onClick={() => navigate("/receitas")}
                            >
                                <Plus className="mr-1.5 h-4 w-4" strokeWidth={3} />
                                Nova Receita
                            </Button>
                        </div>
                    </Card>

                    {/* CARD DE CARTÃO DE CRÉDITO */}
                    <div id="cartoes-section" className="animate-slide-up delay-300">
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
                className={cn(isMobile ? "fixed bottom-0 left-0 right-0 py-2 bg-white/80 backdrop-blur-sm z-50 m-0" : "mt-8")}
                user={user}
            />
        </div>
    );
};
