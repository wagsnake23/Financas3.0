import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/contexts/ToastContext";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ExpensesDashboard } from "@/components/ExpensesDashboard";
import Loading from "@/components/Loading";
import { useIsMobile } from "@/hooks/use-mobile";
import { useExpenseData } from "@/hooks/useExpenseData";
import { ExpenseForm } from "@/components/ExpenseForm";
import { Footer } from "@/components/Footer";
import { BarcodeScannerModal } from "@/components/expense-form/BarcodeScannerModal";
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
import { Camera } from "lucide-react";

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
  const { user } = useAuth();
  const { showSuccessToast, showErrorToast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  const navigate = useNavigate();
  const [cartoes, setCartoes] = useState<Cartao[]>([]);
  const [isRecurring, setIsRecurring] = useState(false);

  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const handleScan = async (barcode: string) => {
    console.log("QR CODE LIDO:", barcode);
    console.log("URL NFCE:", barcode);
    console.log("CHAMANDO EDGE FUNCTION");
    setIsScannerOpen(false);

    const { data, error } = await supabase.functions.invoke(
      'importar-nfce',
      {
        body: { url: barcode }
      }
    );

    console.log("RESPOSTA EDGE:", data);
    console.log("ERRO EDGE:", error);

    if (!data) {
        showErrorToast("Erro", "❌ Não foi possível importar a NFC-e (Sem resposta)");
        return;
    }

    if (data.duplicada) {
        showErrorToast("Atenção", "⚠ Nota fiscal já importada anteriormente");
        return;
    }

    if (!data.success) {
        console.error("ERRO NFC-E:", data);
        showErrorToast("Erro", `❌ Não foi possível importar NFC-e\nDetalhe: ${data?.error || error?.message || 'Erro desconhecido'}`);
        return;
    }

    const compra = data.compra;
    
    const supermercado = allCategories.find((cat: any) => cat.nome.toLowerCase() === 'supermercado');
    if (supermercado) {
        setNfceSubcategoryId(supermercado.id);
    }
    
    setNfceValor(compra.valor_total);
    
    let formaPgto: "dinheiro" | "pix" | "cartao" = "dinheiro";
    if (compra.forma_pagamento?.toLowerCase().includes("cart")) formaPgto = "cartao";
    else if (compra.forma_pagamento?.toLowerCase().includes("pix")) formaPgto = "pix";
    
    setNfceFormaPagamento(formaPgto);

    if (formaPgto === "cartao" && cartoes.length > 0) {
        setNfceCartaoId(cartoes[0].id);
    }
    
    const parcelas = compra.numero_parcelas || 1;
    setNfceTipoPagamento(parcelas > 1 ? "parcelado" : "avista");
    setNfceNumeroParcelas(parcelas);
    
    if (compra.data_compra) {
        setNfceDataVencimento(new Date(compra.data_compra));
    }
    
    let desc = compra.estabelecimento || "";
    if (desc.length > 35) desc = desc.substring(0, 35);
    setNfceDescricao(desc);

    const qtdProdutos = data.produtos ? data.produtos.length : 0;
    showSuccessToast("Sucesso", `✓ Nota fiscal importada com sucesso\n✓ ${qtdProdutos} produtos encontrados`);
  };

  const [nfceValor, setNfceValor] = useState<number | undefined>(undefined);
  const [nfceFormaPagamento, setNfceFormaPagamento] = useState<"dinheiro" | "pix" | "cartao" | undefined>(undefined);
  const [nfceCartaoId, setNfceCartaoId] = useState<string | undefined>(undefined);
  const [nfceDescricao, setNfceDescricao] = useState<string | undefined>(undefined);
  const [nfceSubcategoryId, setNfceSubcategoryId] = useState<string | undefined>(undefined);
  const [nfceTipoPagamento, setNfceTipoPagamento] = useState<"avista" | "parcelado" | "fixo" | undefined>(undefined);
  const [nfceNumeroParcelas, setNfceNumeroParcelas] = useState<number | undefined>(undefined);
  const [nfceDataVencimento, setNfceDataVencimento] = useState<Date | undefined>(undefined);

  const {
    allSubcategories,
    expenses,
    expenseInstallments,
    isLoading: isLoadingExpenseData,
  } = useExpenseData(user, UNSELECTED_VALUE, !!user);

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

      // Normalização e Limpeza de Categorias (Sincronizado com Categories.tsx)
      let cryptoAdded = false;
      let poupancaAdded = false;
      const normalizedData = (data as AppCategory[])
        .filter(cat => {
          const lowerNome = cat.nome.toLowerCase();

          // Filtro de Aportes
          if (lowerNome.includes("aportes") || lowerNome.includes("entrada de capital")) return false;

          // Filtro de Ações: remover dividendos e venda
          if (lowerNome.includes("ações") || lowerNome.includes("acoes")) {
            if (lowerNome.includes("dividendos") || lowerNome.includes("venda")) return false;
          }

          // Consolidação de Criptomoedas
          if (lowerNome.includes("criptomoedas") || lowerNome.includes("crypto") || lowerNome.includes("bitcoin")) {
            if (cryptoAdded) return false;
            cryptoAdded = true;
          }

          // Consolidação de Poupança
          if (lowerNome.includes("poupança") || lowerNome.includes("poupanca")) {
            if (poupancaAdded) return false;
            poupancaAdded = true;
          }

          // Novos filtros solicitados: remover subcategorias específicas
          const filterOut = [
            "juros sobre capital",
            "reembolsos",
            "tesouro",
            "rendimentos de fundos",
            "outros rendimentos",
            "dividendos",
            "receitas extras",
            "aluguel de imóveis",
            "criptomoedas"
          ];

          if (filterOut.some(term => lowerNome.includes(term))) return false;

          return true;
        })
        .map(cat => {
          if (cat.id === "familia_filhos") return { ...cat, nome: "Família" };
          const lowerNome = cat.nome.toLowerCase();
          if (lowerNome.includes("criptomoedas") || lowerNome.includes("crypto") || lowerNome.includes("bitcoin")) {
            return { ...cat, nome: "Criptomoedas" };
          }
          if (lowerNome.includes("poupança") || lowerNome.includes("poupanca")) {
            return { ...cat, nome: "Poupança" };
          }
          return cat;
        });

      return normalizedData;
    },
    enabled: !!user,
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
      initialValor={nfceValor}
      initialFormaPagamento={nfceFormaPagamento}
      initialCartaoId={nfceCartaoId}
      initialDescricao={nfceDescricao}
      initialSubcategoryId={nfceSubcategoryId}
      initialTipoPagamento={nfceTipoPagamento}
      initialNumeroParcelas={nfceNumeroParcelas}
      initialDataVencimento={nfceDataVencimento}
    />
  );

  return (
    <div
      className={cn(
        "flex flex-col min-h-screen md:pt-[72px]",
        !isMobile && "global-bg"
      )}
      style={isMobile ? {
        background: "linear-gradient(180deg, #FAFAFA 0%, #FAFAFA 48px, #FFFFFF 110px, #FFFFFF calc(100% - 120px), #FCFCFE 100%)"
      } : undefined}
    >

      {/* HEADER PREMIUM — FINTECH STYLE (DESPESAS THEME) */}
      {!isMobile && (
        <div className="relative h-[220px] w-full overflow-hidden bg-transparent">
          <div className="container-app relative z-10 pt-[28px] md:pt-[42px] flex justify-between items-start">
            <div>
              <div className="flex items-start gap-3">
                <Button
                  variant="ghost"
                  className="btn-3d btn-3d-icon border-none mt-1 p-2 rounded-xl flex items-center justify-center cursor-pointer hover:scale-105 active:scale-95 transition-all h-auto w-auto"
                  style={{ "--cor-topo": "#FFFFFF", "--cor-base": "#F1F5F9" } as any}
                  onClick={() => navigate("/lancamentos?type=expense")}
                >
                  <DynamicIcon
                    name="TrendingDown"
                    className="!text-[#EF4444] h-6 w-6"
                    strokeWidth={4}
                  />
                </Button>
                <div className="flex flex-col">
                  <h1 className="font-extrabold tracking-[0.5px] -mt-0.5 text-2xl text-[#EF4444]" style={{ fontFamily: "'Inter', sans-serif" }}>
                    Nova Despesa
                  </h1>
                  <p className="text-sm font-bold text-slate-500 -mt-0.5 tracking-wider opacity-80">
                    Registre seus gastos
                  </p>
                </div>
              </div>
            </div>

            <Button
              onClick={() => navigate(-1)}
              className="btn-3d h-9 px-3 rounded-xl font-black text-xs shadow-sm border-none transition-all active:scale-95 !text-[#E54D4D] bg-white hover:bg-white/90"
              style={{ "--cor-topo": "#FFFFFF", "--cor-base": "#F1F5F9" } as any}
            >
              <DynamicIcon name="ChevronLeft" className="mr-1 h-4 w-4 !text-[#E54D4D]" strokeWidth={3} />
              Voltar
            </Button>
          </div>
        </div>
      )}

      <main
        className={cn(
          "container-app relative z-20 flex-grow",
          isMobile ? "pb-0" : "-mt-[86px] pb-20 space-y-6"
        )}
      >
        {isMobile ? (
          <div className="relative">
            <div
              className="!fixed top-[calc(3.5rem+env(safe-area-inset-top))] left-0 right-0 pt-0 pb-0 bottom-0 overflow-hidden z-30 container-app bg-transparent"
            >
              <div className="h-full overflow-y-auto [&::-webkit-scrollbar]:hidden pb-0 px-0 pt-1">
                <div className="flex flex-col gap-6 pb-6 px-[2px]">
                  <div className="flex justify-between items-start pt-2">
                    <div className="flex items-start gap-3">
                      <Button
                        variant="ghost"
                        className="w-9 h-9 p-0 flex items-center justify-center cursor-pointer rounded-xl border-none shadow-none transition-all hover:scale-105 active:scale-90 shrink-0 mt-0"
                        style={{ background: "#ef4444", filter: "saturate(0.95)" }}
                        onClick={() => navigate("/lancamentos?type=expense")}
                      >
                        <DynamicIcon
                          name="TrendingDown"
                          className="h-[18px] w-[18px] !text-white"
                          strokeWidth={3}
                        />
                      </Button>
                      <div className="flex flex-col">
                        <h1 className="font-extrabold tracking-[0.5px] -mt-0.5 text-xl text-[#EF4444]" style={{ fontFamily: "'Inter', sans-serif" }}>
                          Nova Despesa
                        </h1>
                        <p className="font-medium -mt-0.5 leading-none text-xs text-slate-500">
                          Registre seus gastos
                        </p>
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      onClick={() => setIsScannerOpen(true)}
                      className="w-10 h-10 p-0 flex items-center justify-center cursor-pointer border-none bg-transparent hover:bg-transparent transition-all active:scale-90"
                      aria-label="Importar Nota Fiscal"
                    >
                      <Camera 
                        className="w-6 h-6 text-[#2F3542]" 
                        strokeWidth={2.2} 
                        style={{ filter: "drop-shadow(0px 1px 2px rgba(0, 0, 0, 0.2)) drop-shadow(0px 1px 1px rgba(255, 255, 255, 0.5))" }}
                      />
                    </Button>
                  </div>

                  {formContent}
                  
                  {isScannerOpen && (
                    <BarcodeScannerModal 
                      onScan={handleScan}
                      onClose={() => setIsScannerOpen(false)}
                    />
                  )}
                </div>

                <div style={{ marginTop: "-12px", marginBottom: "0px" }}>
                  <Footer isMobile={isMobile} user={user} />
                </div>
              </div>
            </div>

          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.6fr] gap-6">
            <div className="space-y-6 flex flex-col">
              <Card
                className="p-6 lg:pt-6 lg:px-6 lg:pb-[15px] rounded-[24px] shadow-sm card-despesas"
                style={{ backgroundColor: "#FFFFFF" }}
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

      {!isMobile && (
        <Footer
          isMobile={isMobile}
          className="mt-auto pt-8"
          user={user}
        />
      )}
    </div>
  );
}
