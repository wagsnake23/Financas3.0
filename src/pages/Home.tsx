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

const MiniFinanceBars = ({ expenses, revenues, balance }: { expenses: number, revenues: number, balance: number }) => {
    const maxVal = Math.max(Math.abs(expenses), Math.abs(revenues), Math.abs(balance), 1);
    const getH = (val: number) => Math.max((Math.abs(val) / maxVal) * 32, 2);

    const BarItem = ({ val, color, label, width }: { val: number, color: string, label: string, width: string }) => (
        <div className="flex flex-col items-center gap-1">
            <div
                className="transition-all duration-500 ease-out"
                style={{
                    height: `${getH(val)}px`,
                    width: width,
                    backgroundColor: color,
                    borderRadius: "3px"
                }}
            />
            <span className="text-[9px] font-black text-gray-400 uppercase tracking-tighter leading-none">{label}</span>
        </div>
    );

    return (
        <div className="relative flex items-end gap-1 px-1 pb-1">
            {/* Reference scale lines */}
            <div className="absolute left-0 right-0 h-[0.5px] bg-gray-300/30" style={{ bottom: "48px" }} />
            <div className="absolute left-0 right-0 h-[1px] bg-gray-200 bottom-[14.5px]" />

            <BarItem val={expenses} color="#FF7070" label="D" width="15px" />
            <BarItem val={revenues} color="#66E0A3" label="R" width="15px" />
            <BarItem val={balance} color="#6B95FF" label="S" width="15px" />
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
    const formattedDate = format(new Date(), "eee, dd MMM yyyy", { locale: ptBR });
    // Capitalize first letter of abbreviated weekday
    const todayStr = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);

    return (
        <div
            className={cn("flex flex-col min-h-screen pb-10 relative overflow-hidden sky-bg")}
        >
            <Navigation />

            {/* HEADER AREA */}
            <div className="relative h-[220px] w-full overflow-hidden">
                <div className="container mx-auto px-6 pt-16 md:pt-24 relative z-10 max-w-[800px]">
                    <div className="flex justify-between items-start">
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
            </div>

            <main className={cn("container mx-auto px-4 -mt-24 md:mt-2 relative z-20 max-w-[800px]")}>

                {/* CARD PRINCIPAL — SALDO MENSAL (HERO) */}
                <Card
                    className="pl-3 pr-[20px] pt-[12px] pb-[12px] mb-3 rounded-[28px] border-none shadow-[0_10px_30px_rgba(0,0,0,0.08)] relative overflow-hidden card-saldo"
                    style={{ backgroundColor: "transparent" }}
                >
                    <div className="flex justify-between items-start mb-2">
                        <div className="flex flex-col">
                            <h2 className="text-[15px] font-black tracking-tight mb-1" style={{ color: "#1E6BCE" }}>Saldo Mensal</h2>
                            <p className="text-[18px] font-black text-gray-700 tracking-tight leading-none">
                                {formatCurrency(dStats.currentBalance)}
                            </p>
                        </div>
                        {/* Seletor de Mês (Posição Top Right - Match "Ver Gastos") */}
                        <div
                            className="btn-3d flex items-center justify-between px-1 rounded-2xl transition-all h-9 w-[135px] -mr-1 border border-blue-200 shadow-none cursor-default"
                            style={{ "--cor-topo": "#E6F0FF", "--cor-base": "#DCEBFF", boxShadow: "inset 0px 1px 2px rgba(255, 255, 255, 0.25), inset 0px -2px 3px rgba(0, 0, 0, 0.1)" } as any}
                        >
                            <button onClick={handlePrevMonth} className="text-white hover:opacity-90 rounded-full p-0 h-6 w-6 flex items-center justify-center transition-all shadow-sm" style={{ background: "linear-gradient(180deg, #6B95FF 0%, #4A74D4 100%)", boxShadow: "inset 0px 1px 1px rgba(255, 255, 255, 0.4), inset 0px -1px 1px rgba(0, 0, 0, 0.1)" }}>
                                <DynamicIcon name="ChevronLeft" className="h-3.5 w-3.5" strokeWidth={4} />
                            </button>
                            <span className="text-[12px] font-black text-[#1E6BCE] px-1 flex-1 text-center uppercase tracking-tight pt-[1px] whitespace-nowrap">
                                {format(selectedMonth, "MMM / y", { locale: ptBR }).replace(".", "")}
                            </span>
                            <button onClick={handleNextMonth} className="text-white hover:opacity-90 rounded-full p-0 h-6 w-6 flex items-center justify-center transition-all shadow-sm" style={{ background: "linear-gradient(180deg, #6B95FF 0%, #4A74D4 100%)", boxShadow: "inset 0px 1px 1px rgba(255, 255, 255, 0.4), inset 0px -1px 1px rgba(0, 0, 0, 0.1)" }}>
                                <DynamicIcon name="ChevronRight" className="h-3.5 w-3.5" strokeWidth={4} />
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center mt-1 gap-2">
                        {/* Investments Icon Button */}
                        <Button
                            onClick={() => navigate("/dashboard?filter=investments")}
                            className="btn-3d w-9 h-9 p-0 flex items-center justify-center rounded-xl shadow-sm border border-blue-200 transition-all active:scale-90 shrink-0"
                            style={{ "--cor-topo": "#6B95FF", "--cor-base": "#4A74D4" } as any}
                        >
                            <DynamicIcon name="LineChart" className="h-[18px] w-[18px] text-white" strokeWidth={3} />
                        </Button>
                        <div className="flex flex-col items-start gap-0.5">
                            <div className={cn(
                                "flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold",
                                dStats.balanceVar >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                            )}>
                                {dStats.balanceVar >= 0 ? "↑ +" : "↓ "} {Math.abs(dStats.balanceVar).toFixed(1)}%
                            </div>
                            <span className="text-[10px] text-gray-400 font-medium leading-tight">Mês anterior</span>
                        </div>
                    </div>

                    {/* Mini gráfico de barras (Posição Bottom Right) */}
                    <div className="absolute bottom-1.5 right-5 pointer-events-none h-0 flex items-end overflow-visible">
                        <MiniFinanceBars
                            expenses={dStats.currentExpenses}
                            revenues={dStats.currentIncome}
                            balance={dStats.currentBalance}
                        />
                    </div>
                </Card>

                <div className="grid grid-cols-1 gap-3 mb-4">
                    {/* CARD DESPESAS */}
                    <Card
                        className="pl-3 pr-[20px] pt-[12px] pb-[12px] rounded-[24px] border border-white shadow-[0_4px_12px_rgba(0,0,0,0.03)] relative card-despesas"
                        style={{ backgroundColor: "transparent" }}
                    >
                        <div className="flex justify-between items-start mb-2">
                            <div className="flex flex-col">
                                <h2 className="text-[15px] font-black tracking-tight mb-1" style={{ color: "#E54D4D" }}>Despesas</h2>
                                <p className="text-[17px] font-black text-gray-700 tracking-tight leading-none">
                                    {formatCurrency(dStats.currentExpenses)}
                                </p>
                            </div>
                            <Button
                                className="btn-3d h-9 px-3 rounded-2xl font-black text-[13px] shadow-none whitespace-nowrap w-[135px] transition-all active:scale-95 !text-[#E54D4D] bg-white hover:bg-white/90 border border-rose-200 -mr-1"
                                style={{ "--cor-topo": "#FFFFFF", "--cor-base": "#F1F5F9", boxShadow: "inset 0px 1px 2px rgba(255, 255, 255, 0.25), inset 0px -2px 3px rgba(0, 0, 0, 0.15)" } as any}
                                onClick={() => navigate(`/lancamentos?type=expense&month=${format(selectedMonth, "yyyy-MM-dd")}`)}
                            >
                                Ver Gastos <DynamicIcon name="ChevronRight" className="ml-1.5 h-3 w-3" strokeWidth={3} />
                            </Button>
                        </div>

                        <div className="flex items-center justify-between mt-1">
                            <div className="flex items-start gap-2">
                                <Button
                                    onClick={() => navigate("/dashboard?filter=expenses")}
                                    className="btn-3d w-9 h-9 p-0 flex items-center justify-center rounded-xl shadow-sm border border-rose-200 transition-all active:scale-90 shrink-0"
                                    style={{ "--cor-topo": "#FF7070", "--cor-base": "#D64545" } as any}
                                >
                                    <TrendingDown className="h-[18px] w-[18px] text-white" strokeWidth={3} />
                                </Button>
                                <div className="flex flex-col items-start gap-0.5">
                                    <div className={cn(
                                        "flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold",
                                        dStats.expenseVar >= 0 ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"
                                    )}>
                                        {dStats.expenseVar >= 0 ? "↑ +" : "↓ "} {Math.abs(dStats.expenseVar).toFixed(1)}%
                                    </div>
                                    <span className="text-[10px] text-gray-400 font-medium leading-tight">Mês anterior</span>
                                </div>
                            </div>
                            <Button
                                className="btn-3d h-9 px-4 rounded-2xl font-bold text-xs shadow-md text-white border-none transition-all active:scale-95 w-[135px] -mr-1"
                                style={{ "--cor-topo": "#FF7070", "--cor-base": "#D64545" } as any}
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
                        className="pl-3 pr-[20px] pt-[12px] pb-[12px] rounded-[24px] border border-white shadow-[0_4px_12px_rgba(0,0,0,0.03)] relative card-receitas"
                        style={{ backgroundColor: "transparent" }}
                    >
                        <div className="flex justify-between items-start mb-2">
                            <div className="flex flex-col">
                                <h2 className="text-[15px] font-black tracking-tight mb-0.5" style={{ color: "#1AA361" }}>Receitas</h2>
                                <p className="text-[17px] font-black text-gray-700 tracking-tight leading-none">
                                    {formatCurrency(dStats.currentIncome)}
                                </p>
                            </div>
                            <Button
                                className="btn-3d h-9 px-3 rounded-2xl font-black text-[13px] shadow-none whitespace-nowrap w-[135px] transition-all active:scale-95 !text-[#1AA361] bg-white hover:bg-white/90 border border-emerald-200 -mr-1"
                                style={{ "--cor-topo": "#FFFFFF", "--cor-base": "#F1F5F9", boxShadow: "inset 0px 1px 2px rgba(255, 255, 255, 0.25), inset 0px -2px 3px rgba(0, 0, 0, 0.15)" } as any}
                                onClick={() => navigate(`/lancamentos?type=income&month=${format(selectedMonth, "yyyy-MM-dd")}`)}
                            >
                                Ver Receitas <DynamicIcon name="ChevronRight" className="ml-1.5 h-3 w-3" strokeWidth={3} />
                            </Button>
                        </div>

                        <div className="flex items-center justify-between mt-1">
                            <div className="flex items-start gap-2">
                                <Button
                                    onClick={() => navigate("/dashboard?filter=revenues")}
                                    className="btn-3d w-9 h-9 p-0 flex items-center justify-center rounded-xl shadow-sm border border-emerald-200 transition-all active:scale-90 shrink-0"
                                    style={{ "--cor-topo": "#66E0A3", "--cor-base": "#2DAD70" } as any}
                                >
                                    <TrendingUp className="h-[18px] w-[18px] text-white" strokeWidth={3} />
                                </Button>
                                <div className="flex flex-col items-start gap-0.5">
                                    <div className={cn(
                                        "flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold",
                                        dStats.incomeVar >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                                    )}>
                                        {dStats.incomeVar >= 0 ? "↑ +" : "↓ "} {Math.abs(dStats.incomeVar).toFixed(1)}%
                                    </div>
                                    <span className="text-[10px] text-gray-400 font-medium leading-tight">Mês anterior</span>
                                </div>
                            </div>
                            <Button
                                className="btn-3d h-9 px-4 rounded-2xl font-bold text-xs shadow-md text-white border-none transition-all active:scale-95 w-[135px] -mr-1"
                                style={{ "--cor-topo": "#66E0A3", "--cor-base": "#2DAD70" } as any}
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
                            expenseInstallments={dExpenses}
                            allCategories={allSubcategories as any}
                            isMobile={isMobile}
                            selectedMonth={dMonth}
                        />
                    </div>
                </div>
            </main>
            <Footer
                isMobile={isMobile}
                className={cn(isMobile ? "fixed bottom-0 left-0 right-0 py-2 z-50 m-0" : "mt-8")}
                user={user}
            />
        </div >
    );
};
