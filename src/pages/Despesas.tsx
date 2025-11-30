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
import DynamicIcon from "@/components/DynamicIcon"; // Importar DynamicIcon
import { TopExpensesBarChart } from "@/components/TopExpensesBarChart"; // NOVO: Importar TopExpensesBarChart

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
  const [isRecurring, setIsRecurring] = useState(false); // Novo estado para o toggle

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

  // O formContent agora contém APENAS o formulário, sem o título
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

  return (
    <div className={cn("flex flex-col min-h-screen bg-background pt-16", isMobile && "bg-lancamentos-mobile-bg")}>
        <Navigation />
        {/* Container interno para o conteúdo, remover background explícito para mobile aqui */}
        <div className={cn("mx-auto space-y-6 flex-grow", isMobile ? "p-4 pt-2" : "max-w-[1200px] px-6 py-8")}>
          {/* (b) Header com <h1>Despesas */}
          {!isMobile && (
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">Despesas</h1>
                <p className="text-muted-foreground">Registre suas saídas financeiras</p>
              </div>
            </div>
          )}

          {/* (c) Card com título “Nova Despesa” e o formulário (fora da grid) */}
          {isMobile ? (
            <>
              <h2 className={cn("text-xl font-semibold mb-4 flex items-center gap-2 text-destructive", isMobile && "text-lg mb-4")}>
                <div className="p-2 rounded-full bg-soft-red/50 flex items-center justify-center">
                  <DynamicIcon name="TrendingDown" className="h-6 w-6 text-destructive" />
                </div>
                Nova Despesa
              </h2>
              {formContent}
              {/* Footer para mobile, com ajuste de padding-y */}
              <Footer isMobile={isMobile} className={cn(isMobile && "py-2")} user={user} />
            </>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start"> {/* Novo grid para desktop */}
              {/* Coluna Esquerda: Formulário e Total de Despesas */}
              <div className="space-y-6">
                <Card className="p-6 rounded-xl shadow-sm max-w-[700px] mx-auto">
                  <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-destructive">
                    <div className="p-2 rounded-full bg-soft-red/50 flex items-center justify-center">
                      <DynamicIcon name="TrendingDown" className="h-6 w-6 text-destructive" />
                    </div>
                    Nova Despesa
                  </h2>
                  {formContent}
                </Card>
                {/* Card Total de Despesas movido para abaixo do formulário */}
                <ExpensesDashboard
                  expenses={expenses}
                  expenseInstallments={expenseInstallments}
                  categories={allSubcategories}
                  isMobile={isMobile}
                />
              </div>

              {/* Coluna Direita: Outros dashboards e resumos */}
              <div className="space-y-6">
                {/* Gráfico de barras das Subcategorias por Valor */}
                <TopExpensesBarChart expenses={expenses} categories={allSubcategories} isMobile={isMobile} className="h-[200px]" />
              </div>
            </div>
          )}
        </div>
        {!isMobile && <Footer isMobile={isMobile} user={user} />} {/* Mantido para desktop, passando a prop user */}
    </div>
  );
}