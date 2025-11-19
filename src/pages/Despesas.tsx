import { useState, useEffect } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Navigation } from "@/components/Navigation";
import { useQueryClient, useQuery } from "@tanstack/react-query"; // Importar useQuery
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"; // Importar RadioGroup
import { Label } from "@/components/ui/label"; // Importar Label
import DynamicIcon from "@/components/DynamicIcon"; // Importar DynamicIcon
import { RecurringEntryFormContent } from "@/components/RecurringEntryFormContent"; // Importar o novo componente
import { AppCategory } from "@/types/finance"; // Importar AppCategory

interface Cartao {
  id: string;
  nome: string;
  banco: string;
  ultimos_digitos: string;
  dia_fechamento: number;
  dia_vencimento: number;
}

type FormMode = 'one-off' | 'recurring'; // Novo tipo para o modo do formulário

const UNSELECTED_VALUE = "unselected";

export default function Despesas() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [cartoes, setCartoes] = useState<Cartao[]>([]);
  const isMobile = useIsMobile();
  const [selectedParentCategoryId, setSelectedParentCategoryId] = useState<string>(UNSELECTED_VALUE);

  // Form mode state
  const [formMode, setFormMode] = useState<FormMode>('one-off');

  const {
    fetchedCategories,
    rootExpenseCategories,
    filteredSubcategories,
    expenses,
    expenseInstallments,
    isLoading: isLoadingExpenseData,
  } = useExpenseData(user, selectedParentCategoryId);

  // Fetch ALL categories from Supabase (user-specific and default ones with user_id: null)
  const { data: allCategories = [], isLoading: isLoadingCategories } = useQuery<AppCategory[]>({
    queryKey: ["categories", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("categorias")
        .select("*")
        .or(`user_id.eq.${user.id},user_id.is.null`)
        .order("nome");
      if (error) throw error;
      return data as AppCategory[];
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (user) {
      loadCartoes();
    }
  }, [user]);

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

  const handleRecurringFormSuccess = () => {
    setFormMode('one-off'); // Volta para o formulário avulso após o sucesso
    queryClient.invalidateQueries({ queryKey: ["recurringEntries", user?.id] });
    queryClient.invalidateQueries({ queryKey: ["transactions"] }); // Invalida o cache de transações para o useTransactionsData
  };

  if (isLoadingExpenseData || isLoadingCategories) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Carregando Despesas...</div>
      </div>
    );
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-destructive/5 pt-16">
        <Navigation />
        <div className={cn("max-w-4xl mx-auto space-y-6", isMobile ? "p-4 pt-2" : "p-6")}>
          {!isMobile && (
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">Despesas</h1>
                <p className="text-muted-foreground">Registre suas saídas financeiras</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* Formulário Nova Despesa (esquerda em desktop, topo em mobile) */}
            <div className="order-2 lg:order-1 lg:col-span-2">
              <div className={cn("p-6", isMobile && "p-0")}>
                <h2 className={cn("text-xl font-semibold mb-4", isMobile && "text-lg mb-3")}>Nova Despesa</h2>
                <RadioGroup
                  value={formMode}
                  onValueChange={(value: FormMode) => setFormMode(value)}
                  className={cn("grid gap-2 mb-4", isMobile ? "grid-cols-2" : "grid-cols-2")}
                >
                  <Label
                    htmlFor="one-off-expense"
                    className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-2 hover:bg-accent hover:text-accent-foreground [&:has([data-state=checked])]:border-primary text-sm"
                  >
                    <RadioGroupItem value="one-off" id="one-off-expense" className="sr-only" />
                    <DynamicIcon name="CreditCard" className="mb-1 h-5 w-5" />
                    <span>Avulsa</span>
                  </Label>
                  <Label
                    htmlFor="recurring-expense"
                    className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-2 hover:bg-accent hover:text-accent-foreground [&:has([data-state=checked])]:border-primary text-sm"
                  >
                    <RadioGroupItem value="recurring" id="recurring-expense" className="sr-only" />
                    <DynamicIcon name="Repeat" className="mb-1 h-5 w-5" />
                    <span>Recorrente</span>
                  </Label>
                </RadioGroup>

                {formMode === 'one-off' ? (
                  <ExpenseForm
                    user={user}
                    cartoes={cartoes}
                    loadCartoes={loadCartoes}
                    rootExpenseCategories={rootExpenseCategories}
                    filteredSubcategories={filteredSubcategories}
                    selectedParentCategoryId={selectedParentCategoryId}
                    setSelectedParentCategoryId={setSelectedParentCategoryId}
                    queryClient={queryClient}
                    isMobile={isMobile}
                  />
                ) : (
                  <RecurringEntryFormContent
                    isMobile={isMobile}
                    onSuccess={handleRecurringFormSuccess}
                    fetchedCategories={allCategories} // Passar todas as categorias
                    isLoadingCategories={isLoadingCategories}
                    initialType="despesa"
                  />
                )}
              </div>
            </div>

            {/* Dashboard de Despesas (direita em desktop, ocultado em mobile) */}
            <div className="order-1 lg:order-2 lg:col-span-1 space-y-6">
              {!isMobile && (
                <>
                  <ExpensesDashboard 
                    expenses={expenses} 
                    expenseInstallments={expenseInstallments} 
                    categories={fetchedCategories}
                    isMobile={isMobile}
                  />
                </>
              )}
            </div>
          </div>

          {/* Novas seções de dashboard abaixo do formulário */}
          {!isMobile && (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                <TopCategoriesByValue expenses={expenses} categories={fetchedCategories} />
                <MostUsedCategories expenses={expenses} categories={fetchedCategories} />
              </div>
              <CategoryDistributionSummary expenses={expenses} categories={fetchedCategories} />
            </>
          )}
        </div>
      </div>
      <Footer isMobile={isMobile} />
    </ProtectedRoute>
  );
}