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
import { useSearchParams } from "react-router-dom"; // Importar useSearchParams

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
  const isMobile = useIsMobile();
  const [searchParams] = useSearchParams(); // Hook para ler parâmetros da URL

  const initialFormMode: FormMode = (searchParams.get('mode') as FormMode) || 'one-off';
  const [formMode, setFormMode] = useState<FormMode>(initialFormMode);
  const [cartoes, setCartoes] = useState<Cartao[]>([]);

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
            "flex flex-col items-center justify-between rounded-xl border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground shadow-sm",
            "transition-all duration-200", // Adicionado para transição suave
            "hover:border-destructive", // Borda vermelha no hover
            "hover:bg-destructive/5", // Fundo vermelho suave no hover
            "hover:text-destructive", // Texto vermelho no hover
            "hover:font-bold", // Negrito no hover
            "text-muted-foreground", // Cor padrão do texto
            "font-normal", // Peso da fonte padrão
            "relative", // Necessário para o peer-data
            "peer-data-[state=checked]:border-destructive", // Borda vermelha quando selecionado
            "peer-data-[state=checked]:bg-destructive/5", // Fundo vermelho suave quando selecionado
            "peer-data-[state=checked]:text-destructive", // Texto vermelho quando selecionado
            "peer-data-[state=checked]:font-bold", // Negrito quando selecionado
            isMobile ? "py-1.5 px-3 text-xs" : "py-2 px-4 text-sm"
          )}
        >
          <RadioGroupItem value="one-off" id="one-off-expense" className="sr-only peer" /> {/* Adicionado peer */}
          <DynamicIcon name="CreditCard" className={cn("mb-3 h-6 w-6 text-destructive", isMobile && "mb-1 h-5 w-5")} />
          <span>Avulsa</span>
        </Label>
        <Label
          htmlFor="recurring-expense"
          className={cn(
            "flex flex-col items-center justify-between rounded-xl border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground shadow-sm",
            "transition-all duration-200", // Adicionado para transição suave
            "hover:border-primary", // Borda azul no hover
            "hover:bg-primary/5", // Fundo azul suave no hover
            "hover:text-primary", // Texto azul no hover
            "hover:font-bold", // Negrito no hover
            "text-muted-foreground", // Cor padrão do texto
            "font-normal", // Peso da fonte padrão
            "relative", // Necessário para o peer-data
            "peer-data-[state=checked]:border-primary", // Borda azul quando selecionado
            "peer-data-[state=checked]:bg-primary/5", // Fundo azul suave quando selecionado
            "peer-data-[state=checked]:text-primary", // Texto azul quando selecionado
            "peer-data-[state=checked]:font-bold", // Negrito quando selecionado
            isMobile ? "py-1.5 px-3 text-xs" : "py-2 px-4 text-sm"
          )}
        >
          <RadioGroupItem value="recurring" id="recurring-expense" className="sr-only peer" /> {/* Adicionado peer */}
          <DynamicIcon name="Repeat" className={cn("mb-3 h-6 w-6 text-primary", isMobile && "mb-1 h-5 w-5")} />
          <span>Recorrente</span>
        </Label>
      </RadioGroup>

      {formMode === 'one-off' ? (
        <ExpenseForm
          user={user}
          cartoes={cartoes}
          loadCartoes={loadCartoes}
          allSubcategories={allSubcategories}
          queryClient={queryClient}
          isMobile={isMobile}
        />
      ) : (
        <RecurringEntryFormContent
          isMobile={isMobile}
          onSuccess={handleRecurringFormSuccess}
          fetchedCategories={allCategories}
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
                    categories={allSubcategories}
                    isMobile={isMobile}
                  />
                </>
              )}
            </div>
          </div>

          {!isMobile && (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                <TopCategoriesByValue expenses={expenses} categories={allSubcategories} />
                <MostUsedCategories expenses={expenses} categories={allSubcategories} />
              </div>
              <CategoryDistributionSummary expenses={expenses} categories={allSubcategories} />
            </>
          )}
        </div>
      </div>
      <Footer isMobile={isMobile} />
    </ProtectedRoute>
  );
}