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
    AppCategory[]
  >({
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
        "flex flex-col min-h-screen bg-[#F9FAFB] pt-14 md:pt-16",
        isMobile && "bg-[#F9FAFB]"
      )}
    >
      <Navigation />

      {/* HEADER PREMIUM — FINTECH STYLE (DESPESAS THEME) */}
      <div className="relative h-[200px] w-full bg-gradient-to-b from-[#E54D4D] via-[#FF6B6B] to-[#F9FAFB] overflow-hidden">
        <div className="container mx-auto px-6 pt-3 md:pt-7 relative z-10">
          <div>
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-[#FFF5F5] shadow-sm flex items-center justify-center border border-[#E55B5B]/20 mt-1">
                <DynamicIcon
                  name="TrendingDown"
                  className="h-5 w-5 text-[#E55B5B]"
                />
              </div>
              <div className="flex flex-col">
                <h1 className="text-xl font-black text-white tracking-tight -mt-0.5">
                  Nova Despesa
                </h1>
                <p className="text-sm text-white font-medium mt-0.5 leading-none">
                  Registre suas saídas financeiras
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <main
        className={cn(
          "container mx-auto px-4 -mt-32 relative z-20 max-w-[1200px] space-y-6 pb-20",
          !isMobile && "px-6"
        )}
      >
        {isMobile ? (
          <div className="space-y-6">
            <Card className="w-full !max-w-full p-4 rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-gray-200 space-y-4 bg-[#FCFCFD] max-h-[calc(100vh-150px)] overflow-y-auto">
              {formContent}
            </Card>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <div className="space-y-6">
              <Card className="p-6 rounded-2xl shadow-sm border border-gray-200 bg-[#FCFCFD]">
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
              />
            </div>
          </div>
        )}
      </main>

      <Footer isMobile={isMobile} className={cn(isMobile ? "fixed bottom-0 left-0 right-0 py-2 z-50 m-0 bg-[#F9FAFB]" : "mt-8")} user={user} />
    </div>
  );
}