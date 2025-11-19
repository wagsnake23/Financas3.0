import { useState, useEffect } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import DynamicIcon from "@/components/DynamicIcon";
import { RecurringEntryFormContent } from "@/components/RecurringEntryFormContent";
import { AppCategory } from "@/types/finance";
import { Card } from "@/components/ui/card";

interface Cartao {
  id: string;
  nome: string;
  banco: string;
  ultimos_digitos: string;
  dia_fechamento: number;
  dia_vencimento: number;
}

type FormMode = 'one-off' | 'recurring';

const UNSELECTED_VALUE = "unselected";

export default function Despesas() {
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  // Removido selectedParentCategoryId, pois não é mais necessário para a seleção
  const isMobile = useIsMobile();

  const [formMode, setFormMode] = useState<FormMode>('one-off');
  const [cartoes, setCartoes] = useState<Cartao[]>([]); // Adicionado: Declaração de cartoes como estado

  const {
    allSubcategories, // Renomeado de fetchedCategories para allSubcategories
    expenses,
    expenseInstallments,
    isLoading: isLoadingExpenseData,
  } = useExpenseData(user, UNSELECTED_VALUE, !!user && !authLoading); // Passando UNSELECTED_VALUE para selectedParentCategoryId, pois não é mais usado para filtrar

  // Fetch ALL categories from Supabase (user-specific and default ones with user_id: null)
  // Este hook agora busca APENAS SUBCATEGORIAS
  const { data: allCategories = [], isLoading: isLoadingCategories } = useQuery<AppCategory[]>({
    queryKey: ["categories", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("categorias")
        .select("*")
        .or(`user_id.eq.${user.id},user_id.is.null`)
        .not("parent_id", "is", null) // APENAS SUBCATEGORIAS
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

  const handleRecurringFormSuccess = () => {
    setFormMode('one-off');
    queryClient.invalidateQueries({ queryKey: ["recurringEntries", user?.id] });
    queryClient.invalidateQueries({ queryKey: ["transactions"] });
  };

  if (authLoading || isLoadingExpenseData || isLoadingCategories) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Carregando Despesas...</div>
      </div>
    );
  }

  const formContent = (
    <>
      <h2 className={cn("text-xl font-semibold mb-4", isMobile && "text-lg mb-3")}>Nova Despesa</h2>
      <RadioGroup
        value={formMode}
        onValueChange={(value: FormMode) => setFormMode(value)}
        className={cn("grid gap-2 mb-4", isMobile ? "grid-cols-2" : "grid-cols-2")}
      >
        <Label
          htmlFor="one-off-expense"
          className={cn(
            "flex items-center justify-center rounded-xl border-2 border-muted bg-popover hover:bg-accent hover:text-accent-foreground [&:has([data-state=checked])]:border-destructive",
            isMobile ? "py-1.5 px-3 text-xs" : "py-2 px-4 text-sm"
          )}
        >
          <RadioGroupItem value="one-off" id="one-off-expense" className="sr-only" />
          <DynamicIcon name="CreditCard" className={cn("mr-1", isMobile ? "h-4 w-4" : "h-5 w-5")} color="hsl(var(--destructive))" />
          <span>Avulsa</span>
        </Label>
        <Label
          htmlFor="recurring-expense"
          className={cn(
            "flex items-center justify-center rounded-xl border-2 border-muted bg-popover hover:bg-accent hover:text-accent-foreground [&:has([data-state=checked])]:border-primary",
            isMobile ? "py-1.5 px-3 text-xs" : "py-2 px-4 text-sm"
          )}
        >
          <RadioGroupItem value="recurring" id="recurring-expense" className="sr-only" />
          <DynamicIcon name="Repeat" className={cn("mr-1", isMobile ? "h-4 w-4" : "h-5 w-5")} color="hsl(var(--primary))" />
          <span>Recorrente</span>
        </Label>
      </RadioGroup>

      {formMode === 'one-off' ? (
        <ExpenseForm
          user={user}
          cartoes={cartoes}
          loadCartoes={loadCartoes}
          allSubcategories={allSubcategories} // Passando allSubcategories
          queryClient={queryClient}
          isMobile={isMobile}
        />
      ) : (
        <RecurringEntryFormContent
          isMobile={isMobile}
          onSuccess={handleRecurringFormSuccess}
          fetchedCategories={allCategories} // allCategories agora são as subcategorias
          isLoadingCategories={isLoadingCategories}
          initialType="despesa"
        />
      )}
    </>
  );

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
            <div className="order-2 lg:order-1 lg:col-span-2">
              {isMobile ? (
                <div className="px-4 pt-0">
                  {formContent}
                </div>
              ) : (
                <Card className="p-6 rounded-xl shadow-sm">
                  {formContent}
                </Card>
              )}
            </div>

            <div className="order-1 lg:order-2 lg:col-span-1 space-y-6">
              {!isMobile && (
                <>
                  <ExpensesDashboard 
                    expenses={expenses} 
                    expenseInstallments={expenseInstallments} 
                    categories={allSubcategories} // Passando allSubcategories
                    isMobile={isMobile}
                  />
                </>
              )}
            </div>
          </div>

          {!isMobile && (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                <TopCategoriesByValue expenses={expenses} categories={allSubcategories} /> {/* Passando allSubcategories */}
                <MostUsedCategories expenses={expenses} categories={allSubcategories} /> {/* Passando allSubcategories */}
              </div>
              <CategoryDistributionSummary expenses={expenses} categories={allSubcategories} /> {/* Passando allSubcategories */}
            </>
          )}
        </div>
      </div>
      <Footer isMobile={isMobile} />
    </ProtectedRoute>
  );
}