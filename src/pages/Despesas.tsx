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
// Removed: import { QrCodeScannerModal } from "@/components/QrCodeScannerModal"; // Importar o novo modal
// Removed: import { Button } from "@/components/ui/button"; // Adicionado: Importação do componente Button

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
  // Removed: const [isQrScannerOpen, setIsQrScannerOpen] = useState(false); // Estado para controlar o modal do QR Code

  // Removed: Estados para preencher o formulário com dados da NFC-e
  // Removed: const [nfceValor, setNfceValor] = useState<number | undefined>(undefined);
  // Removed: const [nfceFormaPagamento, setNfceFormaPagamento] = useState<"dinheiro" | "pix" | "cartao" | "boleto">("dinheiro");
  // Removed: const [nfceCartaoId, setNfceCartaoId] = useState(UNSELECTED_VALUE);
  // Removed: const [nfceDescricao, setNfceDescricao] = useState(""); // Para itens da nota

  const {
    allSubcategories,
    expenses,
    expenseInstallments,
    isLoading: isLoadingExpenseData,
  } = useExpenseData(user, UNSELECTED_VALUE, !!user && !authLoading);

  const { data: allCategories = [], isLoading: isLoadingCategories } = useQuery<
    AppCategory
  >({
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

  // Removed: const handleImportNfceData = (data: { totalAmount: number; paymentMethod: string; items: { description: string; quantity: number; unitValue: number; total: number; }[] }) => {
  // Removed:   setNfceValor(data.totalAmount);
  // Removed:   // Mapear a forma de pagamento da API para o formato do formulário
  // Removed:   let mappedPaymentMethod: "dinheiro" | "pix" | "cartao" | "boleto" = "dinheiro";
  // Removed:   if (data.paymentMethod === "pix") mappedPaymentMethod = "pix";
  // Removed:   else if (data.paymentMethod === "credit_card" || data.paymentMethod === "debit_card") mappedPaymentMethod = "cartao";
  // Removed:   else if (data.paymentMethod === "cash") mappedPaymentMethod = "dinheiro";
  // Removed:   else if (data.paymentMethod === "boleto") mappedPaymentMethod = "boleto";
    
  // Removed:   setNfceFormaPagamento(mappedPaymentMethod);

  // Removed:   // Se for cartão, tentar encontrar um cartão existente ou deixar para o usuário selecionar
  // Removed:   if (mappedPaymentMethod === "cartao" && cartoes.length > 0) {
  // Removed:     // TODO: Lógica mais sofisticada para tentar preencher o cartaoId automaticamente
  // Removed:     // Por enquanto, apenas seleciona o primeiro ou deixa UNSELECTED_VALUE
  // Removed:     setNfceCartaoId(cartoes[0].id); 
  // Removed:   } else {
  // Removed:     setNfceCartaoId(UNSELECTED_VALUE);
  // Removed:   }

  // Removed:   // Concatenar descrições dos itens para o campo de descrição
  // Removed:   const itemsDescription = data.items.map(item => `${item.description} (x${item.quantity})`).join(", ");
  // Removed:   setNfceDescricao(`NFC-e: ${itemsDescription}`);

  // Removed:   toast.success("Dados da NFC-e importados para o formulário!", { duration: 1000 });
  // Removed: };

  if (authLoading || isLoadingExpenseData || isLoadingCategories) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">
          Carregando Despesas...
        </div>
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
      // Removed: Passar dados da NFC-e para o formulário
      // Removed: initialValor={nfceValor}
      // Removed: initialFormaPagamento={nfceFormaPagamento}
      // Removed: initialCartaoId={nfceCartaoId}
      // Removed: initialDescricao={nfceDescricao}
    />
  );

  return (
    <div
      className={cn(
        "flex flex-col min-h-screen bg-background pt-16",
        isMobile && "bg-lancamentos-mobile-bg"
      )}
    >
      <Navigation />

      {/* CONTAINER AJUSTADO */}
      <div
        className={cn(
          "mx-auto space-y-6",
          !isMobile && "flex-grow", // flex-grow apenas no desktop
          isMobile ? "p-4 pt-2" : "max-w-[1200px] px-6 py-8"
        )}
      >
        {!isMobile && (
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Despesas</h1>
              <p className="text-muted-foreground">
                Registre suas saídas financeiras
              </p>
            </div>
          </div>
        )}

        {isMobile ? (
          <Card className="w-full !max-w-full p-4 rounded-xl shadow-none border-none space-y-4">
            <div className="flex items-center justify-between"> {/* Flex container for title and button */}
              <h2 className="text-xl font-semibold flex items-center gap-2 text-destructive">
                <div className="p-2 rounded-full bg-soft-red/50 flex items-center justify-center">
                  <DynamicIcon
                    name="TrendingDown"
                    className="h-6 w-6 text-destructive"
                  />
                </div>
                Nova Despesa
              </h2>
              {/* Removed: <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setIsQrScannerOpen(true)}
                className="rounded-xl bg-soft-blue text-primary hover:bg-soft-blue/80 h-9 w-9"
              >
                <DynamicIcon name="📷" className="w-4 h-4" />
              </Button> */}
            </div>

            {formContent}

            <Footer isMobile={isMobile} className="pt-2" user={user} />
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <div className="space-y-6">
              <Card className="p-6 rounded-xl shadow-sm max-w-[700px] mx-auto">
                <div className="flex items-center justify-between mb-4"> {/* Flex container for title and button */}
                  <h2 className="text-xl font-semibold flex items-center gap-2 text-destructive">
                    <div className="p-2 rounded-full bg-soft-red/50 flex items-center justify-center">
                      <DynamicIcon
                        name="TrendingDown"
                        className="h-6 w-6 text-destructive"
                      />
                    </div>
                    Nova Despesa
                  </h2>
                  {/* Removed: <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setIsQrScannerOpen(true)}
                    className="rounded-xl bg-soft-blue text-primary hover:bg-soft-blue/80 h-9 w-9"
                  >
                    <DynamicIcon name="📷" className="w-4 h-4" />
                  </Button> */}
                </div>
                {formContent}
              </Card>

              <ExpensesDashboard
                expenses={expenses}
                expenseInstallments={expenseInstallments}
                categories={allSubcategories}
                isMobile={isMobile}
              />
            </div>

            <div className="space-y-6">
              <TopExpensesBarChart
                expenses={expenses}
                categories={allSubcategories}
                isMobile={isMobile}
                className="h-[200px]"
              />
            </div>
          </div>
        )}
      </div>

      {!isMobile && <Footer isMobile={isMobile} user={user} />}

      {/* Removed: <QrCodeScannerModal
        isOpen={isQrScannerOpen}
        onOpenChange={setIsQrScannerOpen}
        onImportData={handleImportNfceData}
      /> */}
    </div>
  );
}