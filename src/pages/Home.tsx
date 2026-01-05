import React, { useMemo, useState } from "react";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
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

    if (authLoading || isLoadingRevenues || isLoadingExpenses || isLoadingCartoes) {
        return <Loading />;
    }

    const handlePrevMonth = () => setSelectedMonth((m) => subMonths(m, 1));
    const handleNextMonth = () => setSelectedMonth((m) => addMonths(m, 1));

    const userName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Usuário";
    const formattedDate = format(new Date(), "eee, dd MMM yyyy", { locale: ptBR });
    // Capitalize first letter of abbreviated weekday
    const todayStr = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);

    return (
        <div className={cn("flex flex-col min-h-screen pt-16", isMobile ? "bg-lancamentos-mobile-bg" : "bg-[#F6FAFF]")}>
            <Navigation />
            <main className={cn("container mx-auto flex-grow", isMobile ? "px-4 py-4 pb-24" : "max-w-[1200px] px-6 py-6")}>

                {/* TOPO DA HOME */}
                <div className="mb-4 animate-fade-in px-1">
                    <h1 className="text-lg font-bold text-gray-800">
                        Olá, {userName} 👋
                    </h1>
                    <p className="text-[11px] text-gray-400 font-medium">
                        {todayStr}
                    </p>
                </div>

                {/* CARD PRINCIPAL — SALDO MENSAL */}
                <Card
                    className="p-4 mb-5 rounded-2xl border-none shadow-md relative overflow-hidden animate-slide-up"
                    style={{ background: "linear-gradient(135deg, #FFFFFF 0%, #F2FFFB 100%)" }}
                >
                    <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-2.5">
                            <div className="p-2 bg-success/10 rounded-xl text-success">
                                <DynamicIcon name="Wallet" className="h-5 w-5" />
                            </div>
                            <h2 className="text-[11px] font-extrabold text-success/70 uppercase tracking-widest">Saldo Mensal</h2>
                        </div>

                        {/* Seletor de Mês */}
                        <div className="flex items-center gap-1.5 bg-success/10 px-2.5 py-1 rounded-full transition-colors border-none shadow-none">
                            <button onClick={handlePrevMonth} className="text-success/80 hover:scale-110 transition-transform p-1">
                                <DynamicIcon name="ChevronLeft" className="h-4 w-4" />
                            </button>
                            <span className="text-[10px] font-bold text-success/90 uppercase min-w-[55px] text-center">
                                {format(selectedMonth, "MMM/yyyy", { locale: ptBR }).replace(".", "")}
                            </span>
                            <button onClick={handleNextMonth} className="text-success/80 hover:scale-110 transition-transform p-1">
                                <DynamicIcon name="ChevronRight" className="h-4 w-4" />
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center gap-2.5 mb-0.5">
                        <span className="text-xl font-bold text-gray-700 tracking-tight">
                            {formatCurrency(stats.currentBalance)}
                        </span>
                        <div className={cn(
                            "flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold",
                            stats.balanceVar >= 0 ? "bg-success/10 text-success/80" : "bg-destructive/10 text-destructive/80"
                        )}>
                            {stats.balanceVar >= 0 ? "↑ +" : "↓ "} {Math.abs(stats.balanceVar).toFixed(0)}%
                        </div>
                    </div>
                    <p className="text-[10px] text-gray-400 font-medium">
                        {stats.balanceVar >= 0 ? "↑ +" : "↓ "} {Math.abs(stats.balanceVar).toFixed(1)}% em relação ao mês anterior
                    </p>
                </Card>

                <div className="grid grid-cols-1 gap-4 mb-5">
                    {/* CARD DE DESPESAS */}
                    <Card
                        className="p-4 rounded-2xl border-none shadow-sm relative animate-slide-up delay-100"
                        style={{ background: "linear-gradient(135deg, #FFFFFF 0%, #FFF8F8 100%)" }}
                    >
                        <div className="flex justify-between items-center mb-3">
                            <div className="flex items-center gap-2.5">
                                <button
                                    onClick={() => navigate("/dashboard?filter=expenses")}
                                    className="p-2 bg-destructive/10 rounded-xl text-destructive/80 hover:bg-destructive/20 active:scale-95 transition-all"
                                >
                                    <DynamicIcon name="TrendingDown" className="h-4 w-4" />
                                </button>
                                <h2 className="text-[11px] font-extrabold text-destructive/60 uppercase tracking-wider">Despesas</h2>
                            </div>
                            <button
                                onClick={() => navigate("/lancamentos?type=expense")}
                                className="px-3 py-1 rounded-full bg-destructive/10 text-[10px] font-bold text-destructive/80 hover:bg-destructive/20 transition-colors flex items-center gap-1.5"
                            >
                                Ver Gastos <DynamicIcon name="ChevronRight" className="h-3 w-3" />
                            </button>
                        </div>

                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-lg font-bold text-gray-700 mb-0.5 leading-none">
                                    {formatCurrency(stats.currentExpenses)}
                                </p>
                                <p className="text-[10px] text-destructive/70 font-semibold">
                                    {stats.expenseVar >= 0 ? "↑ +" : "↓ "} {Math.abs(stats.expenseVar).toFixed(1)}% vs mês anterior
                                </p>
                            </div>
                        </div>

                        <div className="mt-4">
                            <Button
                                className="btn-3d w-full h-[34px] rounded-xl font-bold text-xs shadow-md"
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
                        className="p-4 rounded-2xl border-none shadow-sm relative animate-slide-up delay-200"
                        style={{ background: "linear-gradient(135deg, #FFFFFF 0%, #F4FFF9 100%)" }}
                    >
                        <div className="flex justify-between items-center mb-3">
                            <div className="flex items-center gap-2.5">
                                <button
                                    onClick={() => navigate("/dashboard?filter=revenues")}
                                    className="p-2 bg-success/15 rounded-xl text-success/80 hover:bg-success/25 active:scale-95 transition-all"
                                >
                                    <DynamicIcon name="TrendingUp" className="h-4 w-4" />
                                </button>
                                <h2 className="text-[11px] font-extrabold text-success/60 uppercase tracking-wider">Receitas</h2>
                            </div>
                            <button
                                onClick={() => navigate("/lancamentos?type=income")}
                                className="px-3 py-1 rounded-full bg-success/15 text-[10px] font-bold text-success/80 hover:bg-success/25 transition-colors flex items-center gap-1.5"
                            >
                                Ver Receitas <DynamicIcon name="ChevronRight" className="h-3 w-3" />
                            </button>
                        </div>

                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-lg font-bold text-gray-700 mb-0.5 leading-none">
                                    {formatCurrency(stats.currentIncome)}
                                </p>
                                <p className="text-[10px] text-success/70 font-semibold">
                                    {stats.incomeVar >= 0 ? "↑ +" : "↓ "} {Math.abs(stats.incomeVar).toFixed(1)}% vs mês anterior
                                </p>
                            </div>
                        </div>

                        <div className="mt-4">
                            <Button
                                className="btn-3d w-full h-[34px] rounded-xl font-bold text-xs shadow-md"
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
