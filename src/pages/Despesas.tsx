import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Navigation } from "@/components/Navigation";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { ExpensesDashboard } from "@/components/ExpensesDashboard";
import Loading from "@/components/Loading";
import { useIsMobile } from "@/hooks/use-mobile";
import { useExpenseData } from "@/hooks/useExpenseData";
import { ExpenseForm } from "@/components/ExpenseForm";
import { TopCategoriesByValue } from "@/components/TopCategoriesByValue";
import { MostUsedCategories } from "@/components/MostUsedCategories";
import { CategoryDistributionSummary } from "@/components/CategoryDistributionSummary";
import { Footer } from "@/components/Footer";
import { cn } from "@/lib/utils";
import { AppCategory } from "@/types/finance";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import DynamicIcon from "@/components/DynamicIcon";
import { TopExpensesBarChart } from "@/components/TopExpensesBarChart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Cartao {
  id: string;
  nome: string;
  banco: string;
  ultimos_digitos: string;
  dia_fechamento: number;
  dia_vencimento: number;
}

const UNSELECTED_VALUE = "unselected";

export default function Despesas() {
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  const [cartoes, setCartoes] = useState<Cartao[]>([]);
  const [isRecurring, setIsRecurring] = useState(false);

  // Estados para o seletor de mês e ano
  const currentMonth = new Date().getMonth() + 1; // Mês atual (1-12)
  const currentYear = new Date().getFullYear();
  const [selectedMonth, setSelectedMonth] = useState<number | null>(currentMonth);
  const [selectedYear, setSelectedYear] = useState<number | null>(currentYear);

  const {
    allSubcategories,
    expenses,
    expenseInstallments,
    isLoading: isLoadingExpenseData,
  } = useExpenseData(user, UNSELECTED_VALUE, !!user && !authLoading);

  const { data: allCategories = [], isLoading: isLoadingCategories } = useQuery<AppCategory[]>({
    queryKey: ["categories", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("categorias")
        .select("*")
        .or(`user_id.eq.${user.id},user_id.is.null`)
        .not("parent_id", "is", null)
        .order("nome");
      if (error) throw error;
      return data as AppCategory[];
    },
    enabled: !!user && !authLoading,
  });

  useEffect(() => {
    if (user && !authLoading) {
      loadCartoes();
    }
  }, [user, authLoading]);

  const loadCartoes = async () => {
    const { data, error } = await supabase
      .from("cartoes")
      .select("*")
      .eq("user_id", user?.id)
      .order("nome");

    if (error) {
      console.error(error);
    } else {
      setCartoes(data || []);
    }
  };

  if (authLoading || isLoadingExpenseData || isLoadingCategories) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Carregando Despesas...</div>
      </div>
    );
  }

  const formContent = (
    <ExpenseForm
      user={user}
      cartoes={cartoes}
      loadCartoes={loadCartoes}
      allSubcategories={allSubcategories}
      queryClient={queryClient}
      isMobile={isMobile}
      isRecurring={isRecurring}
      setIsRecurring={setIsRecurring}
    />
  );

  // Opções de meses
  const monthOptions = Array.from({ length: 12 }, (_, i) => ({
    value: (i + 1).toString(),
    label: new Date(0, i).toLocaleString("pt-BR", { month: "long" }),
  }));

  // Opções de anos (ex: 5 anos para trás e o ano atual)
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i).map(year => ({
    value: year.toString(),
    label: year.toString(),
  })).reverse(); // Para exibir do mais antigo para o mais novo

  return (
    <div className={cn("flex flex-col min-h-screen bg-background pt-16", isMobile && "bg-lancamentos-mobile-bg")}>
        <Navigation />
        <div className={cn("mx-auto space-y-6 flex-grow", isMobile ? "p-4 pt-2" : "max-w-[1200px] px-6 py-8")}>
          {!isMobile && (
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">Despesas</h1>
                <p className="text-muted-foreground">Registre suas saídas financeiras</p>
              </div>
            </div>
          )}

          {isMobile ? (
            <>
              <h2 className={cn("text-xl font-semibold mb-4 flex items-center gap-2 text-destructive", isMobile && "text-lg mb-4")}>
                <DynamicIcon name="💸" className="h-6 w-6 text-destructive" />
                Nova Despesa
              </h2>
              {formContent}
              <Footer isMobile={isMobile} className={cn(isMobile && "py-2")} user={user} />
            </>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              <Card className="p-6 rounded-xl shadow-sm max-w-[700px] mx-auto">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-destructive">
                  <DynamicIcon name="💸" className="h-6 w-6 text-destructive" />
                  Nova Despesa
                </h2>
                {formContent}
              </Card>

              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-1 gap-6 items-start">
                  <ExpensesDashboard
                    expenses={expenses}
                    expenseInstallments={expenseInstallments}
                    categories={allSubcategories}
                    isMobile={isMobile}
                  />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                  <TopCategoriesByValue expenses={expenses} categories={allSubcategories} />
                  <MostUsedCategories expenses={expenses} categories={allSubcategories} />
                </div>
                <CategoryDistributionSummary expenses={expenses} categories={allSubcategories} />

                {/* Seletores de Mês e Ano para o gráfico */}
                <div className="flex gap-4 mb-4">
                  <Select
                    onValueChange={(value) => setSelectedMonth(Number(value))}
                    value={selectedMonth?.toString() || ""}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Selecione o Mês" />
                    </SelectTrigger>
                    <SelectContent>
                      {monthOptions.map((month) => (
                        <SelectItem key={month.value} value={month.value}>
                          {month.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    onValueChange={(value) => setSelectedYear(Number(value))}
                    value={selectedYear?.toString() || ""}
                  >
                    <SelectTrigger className="w-[120px]">
                      <SelectValue placeholder="Selecione o Ano" />
                    </SelectTrigger>
                    <SelectContent>
                      {yearOptions.map((year) => (
                        <SelectItem key={year.value} value={year.value}>
                          {year.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <TopExpensesBarChart
                  expenses={expenses}
                  categories={allSubcategories}
                  isMobile={isMobile}
                  selectedMonth={selectedMonth}
                  selectedYear={selectedYear}
                />
              </div>
            </div>
          )}
        </div>
        {!isMobile && <Footer isMobile={isMobile} user={user} />}
    </div>
  );
}