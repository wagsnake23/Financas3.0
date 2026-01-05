import React, { useMemo, useState } from "react";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Tables } from "@/integrations/supabase/types";
import { MobileCreditCardExpenses } from "@/components/MobileCreditCardExpenses";
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
import { useNavigate } from "react-router-dom";
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
        <div className={cn("flex flex-col min-h-screen pt-14 bg-white")}>
            <Navigation />
            <main className={cn("container mx-auto flex-grow", isMobile ? "px-3 pt-5 pb-20" : "max-w-[1200px] px-6 py-6")}>

                {/* TOPO DA HOME */}
                <div className="mb-2 animate-fade-in px-1">
                    <h1 className="text-base font-bold text-gray-900">
                        Olá, {userName} 👋
                    </h1>
                    <p className="text-[10px] text-gray-500 font-medium">
                        {todayStr}
                    </p>
                </div>

                {/* CARD PRINCIPAL — SALDO MENSAL */}
                <Card
                    className="p-3 mb-3 rounded-2xl border border-primary/20 shadow-sm relative overflow-hidden animate-slide-up"
                    style={{ background: "linear-gradient(135deg, #FFFFFF 0%, #F0F7FF 100%)" }}
                >
                    <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-1.5">
                            <DynamicIcon name="Wallet" className="h-5 w-5 text-[#2563EB]" />
                            <h2 className="text-[12px] font-extrabold text-primary uppercase tracking-widest">Saldo Mensal</h2>
                        </div>

                        {/* Seletor de Mês */}
                        <div className="flex items-center justify-between gap-1 bg-white px-2 rounded-full border border-primary/30 shadow-sm transition-all min-w-[125px] h-[30px]">
                            <button onClick={handlePrevMonth} className="text-primary hover:scale-110 transition-transform p-0.5">
                                <DynamicIcon name="ChevronLeft" className="h-3.5 w-3.5" strokeWidth={3} />
                            </button>
                            <span className="text-[11px] font-extrabold text-primary uppercase min-w-[65px] text-center tracking-tight leading-none">
                                {format(selectedMonth, "MMM/yyyy", { locale: ptBR }).replace(".", "")}
                            </span>
                            <button onClick={handleNextMonth} className="text-primary hover:scale-110 transition-transform p-0.5">
                                <DynamicIcon name="ChevronRight" className="h-3.5 w-3.5" strokeWidth={3} />
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-[17px] font-bold text-gray-700 mb-0.5 leading-none">
                                {formatCurrency(stats.currentBalance)}
                            </p>
                            <p className="text-[10px] text-gray-400 font-semibold">
                                {stats.balanceVar >= 0 ? "↑ +" : "↓ "} {Math.abs(stats.balanceVar).toFixed(1)}% vs ant.
                            </p>
                        </div>
                    </div>
                </Card>

                <div className="grid grid-cols-1 gap-3 mb-3">
                    <Card
                        className="p-3 rounded-2xl border border-destructive/10 shadow-sm relative animate-slide-up delay-100"
                        style={{ background: "linear-gradient(135deg, #FFFFFF 0%, #FFF8F8 100%)" }}
                    >
                        <div className="flex justify-between items-center mb-2">
                            <div className="flex items-center gap-2">
                                <Button
                                    onClick={() => navigate("/dashboard?filter=expenses")}
                                    className="btn-3d w-8 h-8 p-0 flex items-center justify-center rounded-xl shadow-sm border border-destructive/30"
                                    style={{ "--cor-topo": "#FF8A8A", "--cor-base": "#F06666" } as any}
                                >
                                    <DynamicIcon name="TrendingDown" className="h-4 w-4" />
                                </Button>
                                <h2 className="text-[12px] font-extrabold text-destructive uppercase tracking-wider">Despesas</h2>
                            </div>
                            <Button
                                className="h-[30px] px-3 rounded-xl font-bold text-[11px] shadow-sm whitespace-nowrap min-w-[125px] bg-white border border-destructive text-destructive hover:bg-destructive/5 transition-colors"
                                onClick={() => navigate("/lancamentos?type=expense")}
                            >
                                Ver Gastos <DynamicIcon name="ChevronRight" className="ml-1.5 h-3 w-3" strokeWidth={3} />
                            </Button>
                        </div>

                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-[17px] font-bold text-gray-700 mb-0.5 leading-none">
                                    {formatCurrency(stats.currentExpenses)}
                                </p>
                                <p className="text-[10px] text-destructive/70 font-semibold">
                                    {stats.expenseVar >= 0 ? "↑ +" : "↓ "} {Math.abs(stats.expenseVar).toFixed(1)}% vs ant.
                                </p>
                            </div>
                            <Button
                                className="btn-3d h-[30px] px-3 rounded-xl font-bold text-[11px] shadow-sm ml-2 whitespace-nowrap min-w-[125px]"
                                style={{ "--cor-topo": "#FF8A8A", "--cor-base": "#F06666" } as any}
                                onClick={() => navigate("/despesas")}
                            >
                                <DynamicIcon name="Plus" className="mr-1.5 h-3.5 w-3.5" />
                                Nova Despesa
                            </Button>
                        </div>
                    </Card>

                    {/* CARD DE RECEITAS */}
                    <Card
                        className="p-3 rounded-2xl border border-success/10 shadow-sm relative animate-slide-up delay-200"
                        style={{ background: "linear-gradient(135deg, #FFFFFF 0%, #F4FFF9 100%)" }}
                    >
                        <div className="flex justify-between items-center mb-2">
                            <div className="flex items-center gap-2">
                                <Button
                                    onClick={() => navigate("/dashboard?filter=revenues")}
                                    className="btn-3d w-8 h-8 p-0 flex items-center justify-center rounded-xl shadow-sm border border-success/30"
                                    style={{ "--cor-topo": "#52DCA2", "--cor-base": "#38C48B" } as any}
                                >
                                    <DynamicIcon name="TrendingUp" className="h-4 w-4" />
                                </Button>
                                <h2 className="text-[12px] font-extrabold text-success uppercase tracking-wider">Receitas</h2>
                            </div>
                            <Button
                                className="h-[30px] px-3 rounded-xl font-bold text-[11px] shadow-sm whitespace-nowrap min-w-[125px] bg-white border border-success text-success hover:bg-success/5 transition-colors"
                                onClick={() => navigate("/lancamentos?type=income")}
                            >
                                Ver Receitas <DynamicIcon name="ChevronRight" className="ml-1.5 h-3 w-3" strokeWidth={3} />
                            </Button>
                        </div>

                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-[17px] font-bold text-gray-700 mb-0.5 leading-none">
                                    {formatCurrency(stats.currentIncome)}
                                </p>
                                <p className="text-[10px] text-success/70 font-semibold">
                                    {stats.incomeVar >= 0 ? "↑ +" : "↓ "} {Math.abs(stats.incomeVar).toFixed(1)}% vs ant.
                                </p>
                            </div>
                            <Button
                                className="btn-3d h-[30px] px-3 rounded-xl font-bold text-[11px] shadow-sm ml-2 whitespace-nowrap min-w-[125px]"
                                style={{ "--cor-topo": "#52DCA2", "--cor-base": "#38C48B" } as any}
                                onClick={() => navigate("/receitas")}
                            >
                                <DynamicIcon name="Plus" className="mr-1.5 h-3.5 w-3.5" />
                                Nova Receita
                            </Button>
                        </div>
                    </Card>

                    {/* CARD DE CARTÃO DE CRÉDITO */}
                    <div className="animate-slide-up delay-300">
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
}
