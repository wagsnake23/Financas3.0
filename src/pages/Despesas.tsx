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
import { AppCategory } from "@/types/finance";
import { Card } from "@/components/ui/card";
// Removido: import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
// Removido: import { Label } from "@/components/ui/label";
// Removido: import DynamicIcon from "@/components/DynamicIcon";
import { toast } from "sonner";

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

  // Removido: const handleToggleChange = (value: string) => {
  // Removido:   setIsRecurring(value === "recorrente");
  // Removido: };

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
      
      {/* Removido: Toggle Avulsa / Recorrente */}
      {/* Removido: <div className="space-y-2 mb-4"> */}
      {/* Removido:   <Label className={cn(isMobile && "text-xs")}>Tipo de Lançamento</Label> */}
      {/* Removido:   <ToggleGroup  */}
      {/* Removido:     type="single"  */}
      {/* Removido:     value={isRecurring ? "recorrente" : "avulsa"}  */}
      {/* Removido:     onValueChange={handleToggleChange} */}
      {/* Removido:     className="w-full justify-center" */}
      {/* Removido:   > */}
      {/* Removido:     <ToggleGroupItem  */}
      {/* Removido:       value="avulsa"  */}
      {/* Removido:       className={cn( */}
      {/* Removido:         "flex-1 rounded-xl flex items-center justify-center border", */}
      {/* Removido:         "data-[state=on]:bg-primary data-[state=on]:border-primary data-[state=on]:text-primary-foreground data-[state=on]:font-bold", */}
      {/* Removido:         "data-[state=off]:bg-transparent data-[state=off]:border-border data-[state=off]:text-muted-foreground" */}
      {/* Removido:       )} */}
      {/* Removido:     > */}
      {/* Removido:       <DynamicIcon  */}
      {/* Removido:         name="Zap"  */}
      {/* Removido:         className={cn( */}
      {/* Removido:           "mr-2 h-4 w-4", */}
      {/* Removido:           "data-[state=on]:text-primary-foreground data-[state=off]:text-muted-foreground" */}
      {/* Removido:         )}  */}
      {/* Removido:       /> Avulsa */}
      {/* Removido:     </ToggleGroupItem> */}
      {/* Removido:     <ToggleGroupItem  */}
      {/* Removido:       value="recorrente"  */}
      {/* Removido:       className={cn( */}
      {/* Removido:         "flex-1 rounded-xl flex items-center justify-center border", */}
      {/* Removido:         "data-[state=on]:bg-primary data-[state=on]:border-primary data-[state=on]:text-primary-foreground data-[state=on]:font-bold", */}
      {/* Removido:         "data-[state=off]:bg-transparent data-[state=off]:border-border data-[state=off]:text-muted-foreground" */}
      {/* Removido:       )} */}
      {/* Removido:     > */}
      {/* Removido:       <DynamicIcon  */}
      {/* Removido:         name="Repeat"  */}
      {/* Removido:         className={cn( */}
      {/* Removido:           "mr-2 h-4 w-4", */}
      {/* Removido:           "data-[state=on]:text-primary-foreground data-[state=off]:text-muted-foreground" */}
      {/* Removido:         )}  */}
      {/* Removido:       /> Recorrente */}
      {/* Removido:     </ToggleGroupItem> */}
      {/* Removido:   </ToggleGroup> */}
      {/* Removido: </div> */}

      <ExpenseForm
        user={user}
        cartoes={cartoes}
        loadCartoes={loadCartoes}
        allSubcategories={allSubcategories}
        queryClient={queryClient}
        isMobile={isMobile}
        isRecurring={isRecurring} // Passar o estado isRecurring
        setIsRecurring={setIsRecurring} // Passar a função setIsRecurring
      />
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
                  <Footer isMobile={isMobile} /> {/* Footer para mobile, logo abaixo do formulário */}
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
      {!isMobile && <Footer isMobile={isMobile} />} {/* Footer para desktop, na parte inferior da página */}
    </ProtectedRoute>
  );
}