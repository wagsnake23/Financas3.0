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
import { Footer } from "@/components/Footer";
import { cn } from "@/lib/utils";
import { AppCategory } from "@/types/finance";
import { Card } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import DynamicIcon from "@/components/DynamicIcon";

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
      .order("created_at");

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
        "flex flex-col min-h-screen bg-background md:pt-16",
        isMobile && "bg-[#F9FAFB]"
      )}
    >
      <Navigation />

      {/* HEADER PREMIUM — FINTECH STYLE (DESPESAS THEME) */}
      <div className={cn(
        "relative h-[220px] w-full overflow-hidden",
        isMobile ? "bg-gradient-to-b from-[#CC4B4B] via-[#CC4B4B] via-45% to-transparent" : "bg-background"
      )}>
        <div className={cn(
          "container mx-auto px-6 relative z-10 max-w-[1200px]",
          isMobile ? "fixed top-[46px] left-0 right-0 h-[70px] z-40 px-4 flex items-center bg-[#D44D4D]/0 justify-between" : "pt-12 md:pt-16 flex justify-between items-start"
        )}>
          <div>
            <div className="flex items-start gap-3">
              <Button
                variant="ghost"
                className={cn("btn-3d p-2 rounded-xl flex items-center justify-center shadow-sm border-none cursor-pointer hover:scale-105 active:scale-95 transition-all h-auto w-auto", isMobile ? "mt-0" : "mt-1")}
                style={isMobile ? { "--cor-topo": "#FFF5F5", "--cor-base": "#FFE4E6" } as any : { "--cor-topo": "#FFFFFF", "--cor-base": "#F1F5F9" } as any}
                onClick={() => navigate("/lancamentos?type=expense")}
              >
                <DynamicIcon
                  name="TrendingDown"
                  className={cn("!text-[#E54D4D]", isMobile ? "h-4 w-4" : "h-5 w-5")}
                  strokeWidth={4}
                />
              </Button>
              <div className="flex flex-col">
                <h1 className={cn("font-extrabold tracking-[0.5px] -mt-0.5", isMobile ? "text-xl text-white" : "text-2xl text-slate-800")} style={{ fontFamily: "'Inter', sans-serif" }}>
                  Nova Despesa
                </h1>
                <p className={cn("font-bold -mt-0.5 leading-none", isMobile ? "text-xs text-white" : "text-sm text-slate-500")}>
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
              className="!fixed top-[118px] left-4 right-4 py-2 rounded-[24px] shadow-[0_8px_30px_rgba(0,0,0,0.04)] border-none bottom-[92px] overflow-hidden z-30 card-despesas"
              style={{ backgroundColor: "transparent" }}
            >
              <div className="h-full overflow-y-auto [&::-webkit-scrollbar]:hidden space-y-4 px-4 pb-2">
                {formContent}
              </div>
            </Card>
            <div
              ref={setSubmitPortalRef}
              className={cn(
                "px-1",
                isMobile && "fixed bottom-[20px] left-0 right-0 z-[60] px-4 pt-[1px] pb-3 bg-transparent"
              )}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.6fr] gap-6">
            <div className="space-y-6 flex flex-col">
              <Card
                className="p-6 lg:pt-6 lg:px-6 lg:pb-[15px] rounded-[24px] shadow-sm card-despesas"
                style={{ backgroundColor: "transparent" }}
              >
                {formContent}
              </Card>
            </div>

            <div className="space-y-6 h-full flex flex-col">
              <ExpensesDashboard
                expenses={expenses}
                expenseInstallments={expenseInstallments}
                categories={allSubcategories}
                isMobile={isMobile}
              />
            </div>
          </div>
        )}
      </main>

      <Footer isMobile={isMobile} className={cn(isMobile ? "fixed bottom-0 left-0 right-0 pt-2 pb-1 z-50 m-0 bg-transparent" : "mt-auto pt-8")} user={user} />
    </div>
  );
}