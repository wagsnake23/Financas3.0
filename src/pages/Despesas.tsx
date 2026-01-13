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

import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import DynamicIcon from "@/components/DynamicIcon";
import { TopExpensesBarChart } from "@/components/TopExpensesBarChart";

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

  const navigate = useNavigate();
  const [cartoes, setCartoes] = useState<Cartao[]>([]);
  const [isRecurring, setIsRecurring] = useState(false);
  const [submitPortalRef, setSubmitPortalRef] = useState<HTMLDivElement | null>(null);
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
      submitPortalRef={submitPortalRef}
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
        <div className={cn(
          "container mx-auto px-6 relative z-10 max-w-[1200px]",
          isMobile ? "fixed top-14 left-0 right-0 h-[70px] z-40 px-6 flex items-center bg-[#E54D4D]/0 justify-between" : "pt-3 md:pt-7 flex justify-between items-start"
        )}>
          <div>
            <div className="flex items-start gap-3">
              <div className={cn("p-2 rounded-xl bg-[#FFF5F5] shadow-sm flex items-center justify-center border border-[#E55B5B]/20", isMobile ? "mt-0" : "mt-1")}>
                <DynamicIcon
                  name="TrendingDown"
                  className={cn("text-[#E55B5B]", isMobile ? "h-4 w-4" : "h-5 w-5")}
                />
              </div>
              <div className="flex flex-col">
                <h1 className={cn("font-black text-white tracking-tight -mt-0.5", isMobile ? "text-xl" : "text-xl")}>
                  Nova Despesa
                </h1>
                <p className={cn("text-white font-medium -mt-0.5 leading-none", isMobile ? "text-xs" : "text-sm")}>
                  Registre seus gastos
                </p>
              </div>
            </div>
          </div>

          <Button
            onClick={() => navigate(-1)}
            className={cn(
              "btn-3d h-9 px-3 rounded-xl font-black text-xs shadow-sm border-none transition-all active:scale-95 !text-[#E54D4D] bg-white hover:bg-white/90",
              isMobile ? "h-8 px-2" : ""
            )}
            style={{ "--cor-topo": "#FFFFFF", "--cor-base": "#F1F5F9" } as any}
          >
            <DynamicIcon name="ChevronLeft" className="mr-1 h-4 w-4 !text-[#E54D4D]" strokeWidth={3} />
            Voltar
          </Button>
        </div>
      </div>

      <main
        className={cn(
          "container mx-auto px-4 relative z-20 max-w-[1200px] space-y-6",
          isMobile ? "-mt-32 pb-32" : "-mt-24 pb-20",
          !isMobile && "px-6"
        )}
      >
        {isMobile ? (
          <div className="relative">
            <Card
              className="!fixed top-[125px] left-4 right-4 p-4 rounded-[24px] shadow-[0_8px_30px_rgba(0,0,0,0.04)] border-none space-y-4 bottom-[92px] overflow-y-auto [&::-webkit-scrollbar]:hidden z-30 card-despesas"
              style={{ backgroundColor: "transparent" }}
            >
              {formContent}
            </Card>
            <div
              ref={setSubmitPortalRef}
              className={cn(
                "px-1",
                isMobile && "fixed bottom-[24px] left-0 right-0 z-[60] px-4 pt-1 pb-3 bg-transparent"
              )}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <div className="space-y-6">
              <Card
                className="p-6 rounded-[24px] shadow-sm border border-rose-100 card-despesas"
                style={{ backgroundColor: "transparent" }}
              >
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

      <Footer isMobile={isMobile} className={cn(isMobile ? "fixed bottom-0 left-0 right-0 py-2 z-50 m-0 bg-transparent" : "mt-8")} user={user} />
    </div>
  );
}