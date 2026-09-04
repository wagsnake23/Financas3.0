import { useState, useEffect, useCallback } from "react";
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
import { NfcePendentes } from "@/components/NfcePendentes";

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


  const [nfceId, setNfceId] = useState<string | undefined>(undefined);
  const [nfceCnpj, setNfceCnpj] = useState<string | undefined>(undefined);
  const [nfceEstabelecimento, setNfceEstabelecimento] = useState<string | undefined>(undefined);
  const [nfceValor, setNfceValor] = useState<number | undefined>(undefined);
  const [nfceFormaPagamento, setNfceFormaPagamento] = useState<"dinheiro" | "pix" | "cartao" | undefined>(undefined);
  const [nfceCartaoId, setNfceCartaoId] = useState<string | undefined>(undefined);
  const [nfceDescricao, setNfceDescricao] = useState<string | undefined>(undefined);
  const [nfceSubcategoryId, setNfceSubcategoryId] = useState<string | undefined>(undefined);
  const [nfceTipoPagamento, setNfceTipoPagamento] = useState<"avista" | "parcelado" | "fixo" | undefined>(undefined);
  const [nfceNumeroParcelas, setNfceNumeroParcelas] = useState<number | undefined>(undefined);
  const [nfceDataVencimento, setNfceDataVencimento] = useState<Date | undefined>(undefined);

  const NFCE_LIMITE = 10;

  // Conta NFC-es pendentes para validar limite antes de abrir o scanner
  const { data: nfcePendentesCount = 0 } = useQuery<number>({
    queryKey: ["nfcePendentesCount", user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      const { count, error } = await (supabase as any)
        .from("nfce_compras")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("status_importacao", "pendente");
      if (error) return 0;
      return count ?? 0;
    },
    enabled: !!user,
  });

  // Abre scanner somente se abaixo do limite de 10 pendentes
  const handleOpenScanner = () => {
    if (nfcePendentesCount >= NFCE_LIMITE) {
      showErrorToast(
        "Limite atingido",
        "Limite de 10 notas fiscais pendentes atingido. Registre ou exclua uma nota pendente para continuar."
      );
      return;
    }
    setIsScannerOpen(true);
  };

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

  const preencherFormularioNfce = useCallback(async (compra: any, categoriaSugerida?: string) => {
    let finalCategoryId = categoriaSugerida;

    // 1. Se não houver categoria sugerida e temos o CNPJ, buscar na tabela de aprendizado
    if (!finalCategoryId && compra.cnpj && user) {
      try {
        const { data: mapeamento } = await (supabase as any)
          .from('nfce_cnpj_categoria')
          .select('categoria_id')
          .eq('user_id', user.id)
          .eq('cnpj', compra.cnpj)
          .maybeSingle();

        if (mapeamento?.categoria_id) {
          finalCategoryId = mapeamento.categoria_id;
        }
      } catch (err) {
        console.error('[NFCE_PENDENTES] Erro ao buscar mapeamento:', err);
      }
    }

    // 2. Se ainda não houver categoria (fallback para Supermercado, buscando dinamicamente pelo nome)
    if (!finalCategoryId) {
      const supermercadoCat = allCategories.find(c => c.nome.toLowerCase().includes('supermercado'));
      if (supermercadoCat) {
        finalCategoryId = supermercadoCat.id;
      }
    }

    if (finalCategoryId) {
      setNfceSubcategoryId(finalCategoryId);
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

    setNfceId(compra.id);
    setNfceCnpj(compra.cnpj);
    setNfceEstabelecimento(compra.estabelecimento);

    if (isMobile) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [user, cartoes, isMobile, allCategories]);

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

    console.log("RESULTADO BRUTO:", { data, error });

    if (error) {
      console.error("ERRO INVOKE:", error);
    }

    if (data) {
      console.log("DATA RETORNADA:", JSON.stringify(data));
    }

    if (!data) {
        console.log("BRANCH EXECUTADA: (!data)");
        showErrorToast("Erro", "❌ Não foi possível importar a NFC-e (Sem resposta)");
        return;
    }

    if (data.duplicada) {
        console.log("BRANCH EXECUTADA: (data.duplicada)");
        showErrorToast("Atenção", "⚠ Nota fiscal já importada anteriormente");
        return;
    }

    if (!data.success) {
        console.log("BRANCH EXECUTADA: (!data.success)");
        console.error("ERRO NFC-E:", data);
        const errMessage = data?.error || error?.message || "";
        showErrorToast("Erro", `❌ Não foi possível importar NFC-e\n${errMessage}`);
        return;
    }

    const compra = data.compra;
    console.log("NFCE LIDA DO BANCO:", compra);
    console.log("NFCE ANTES MAPEAMENTO:", data);
    
    // Delegação do preenchimento para a função compartilhada
    preencherFormularioNfce(compra, data.categoria_id);

    const qtdProdutos = data.produtos ? data.produtos.length : 0;
    showSuccessToast("Sucesso", `✓ Nota fiscal importada com sucesso\n✓ ${qtdProdutos} produtos encontrados`);

    // Invalidar as queries para atualizar o card de pendentes imediatamente
    queryClient.invalidateQueries({ queryKey: ["nfcePendentes"] });
    queryClient.invalidateQueries({ queryKey: ["nfcePendentesCount"] });
  };



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
      initialNfceId={nfceId}
      initialNfceCnpj={nfceCnpj}
      initialNfceEstabelecimento={nfceEstabelecimento}
      onSuccess={() => {
        setNfceId(undefined);
        setNfceCnpj(undefined);
        setNfceEstabelecimento(undefined);
        queryClient.invalidateQueries({ queryKey: ["nfcePendentes"] });
        queryClient.invalidateQueries({ queryKey: ["nfcePendentesCount"] });
      }}
    />
  );

  // Handler: Registrar NFC-e pendente (reutiliza mesma lógica de handleScan)
  const handleRegistrarNfce = useCallback(async (compra: any) => {
    // Delegação do preenchimento para a função compartilhada
    preencherFormularioNfce(compra);
  }, [preencherFormularioNfce]);

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
                <div className="flex flex-col gap-6 pb-6 px-0">
                  <div className="nova-despesa-card rounded-[18px] p-4 mb-6 flex flex-col gap-4 relative overflow-hidden" style={{ background: "linear-gradient(180deg, #FFF9FA 0%, #FFF7F8 40%, #FFF6F7 100%)", border: "1px solid rgba(255,255,255,.85)", backgroundClip: "padding-box", boxShadow: "0 10px 30px rgba(15,23,42,.05), inset 0 1px 0 rgba(255,255,255,.95)", backdropFilter: "blur(18px) saturate(1.4)", WebkitBackdropFilter: "blur(18px) saturate(1.4)" }}>
                    {/* GLOW BRANCO: luminosidade base do canto superior direito */}
                    <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at top right, rgba(255,255,255,.95), transparent 45%)", pointerEvents: "none", zIndex: 0 }} />
                    
                    {/* SHAPE ROSA: maior, mais clara e mais evidente */}
                    <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at top right, rgba(255,210,220,.55), transparent 65%)", pointerEvents: "none", zIndex: 0 }} />
                    
                    {/* VÉU DE LUZ TOPO: overlay suave para dar sensação de vidro */}
                    <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(255,255,255,.35), transparent)", pointerEvents: "none", zIndex: 0 }} />
                    
                    {/* ILUMINAÇÃO LATERAL ESQUERDA */}
                    <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at left center, rgba(255,255,255,.55), transparent 70%)", pointerEvents: "none", zIndex: 0 }} />

                    {/* Luz suave no rodapé esquerdo */}
                    <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at bottom left, rgba(255,255,255,.95), transparent 55%)", pointerEvents: "none", zIndex: 0 }} />
                    
                    {/* SHAPE PRINCIPAL: Removida para manter a suavidade da referência */}
                    
                    {/* PONTO DE LUZ: Iluminação concentrada atrás do botão da câmera (top right, raio ~180px) */}
                    <div
                      aria-hidden="true"
                      style={{
                        position: "absolute",
                        top: 0,
                        right: 0,
                        width: "180px",
                        height: "180px",
                        background: "radial-gradient(circle at top right, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.2) 45%, transparent 100%)",
                        pointerEvents: "none",
                        zIndex: 0,
                      }}
                    />

                    {/* LINHAS CURVAS: Removidas para manter o visual limpo e apenas em gradiente como na foto de referência */}

                    <div style={{ position: "relative", zIndex: 1 }}>
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-start gap-3">
                        <Button
                          variant="ghost"
                          className="w-9 h-9 p-0 flex items-center justify-center cursor-pointer rounded-xl border-none shadow-none transition-all hover:scale-105 active:scale-90 shrink-0 mt-0"
                          style={{ background: "linear-gradient(135deg, #f87171, #ef4444)", filter: "saturate(0.95)", boxShadow: "0 8px 20px rgba(239,68,68,.22), inset 0 1px 0 rgba(255,255,255,.2)" }}
                          onClick={() => navigate("/lancamentos?type=expense")}
                        >
                          <DynamicIcon
                            name="TrendingDown"
                            className="h-[18px] w-[18px] !text-white"
                            strokeWidth={3}
                          />
                        </Button>
                        <div className="flex flex-col -translate-y-[4px]">
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
                        onClick={handleOpenScanner}
                        className="w-10 h-10 p-0 flex items-center justify-center cursor-pointer border-none transition-all active:scale-90 rounded-[14px]"
                        style={{ background: "rgba(255,245,248,0.6)", border: "1.5px solid rgba(255,255,255,0.9)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", boxShadow: "0 4px 14px rgba(239,68,68,0.06), inset 0 1px 2px rgba(255,255,255,0.8)" }}
                        aria-label="Importar Nota Fiscal"
                      >
                        <Camera 
                          className="w-[22px] h-[22px] text-[#1E293B]" 
                          strokeWidth={2} 
                        />
                      </Button>
                    </div>

                    {formContent}
                    </div>
                  </div>

                  <NfcePendentes
                    user={user}
                    isMobile={isMobile}
                    onRegistrar={handleRegistrarNfce}
                    pendentesCount={nfcePendentesCount}
                    limite={NFCE_LIMITE}
                  />
                  
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
                className="nova-despesa-card p-6 lg:pt-6 lg:px-6 lg:pb-[15px] rounded-[24px] card-despesas relative overflow-hidden"
                style={{ background: "linear-gradient(180deg, #FFF9FA 0%, #FFF7F8 40%, #FFF6F7 100%)", border: "1px solid rgba(255,255,255,.85)", backgroundClip: "padding-box", boxShadow: "0 10px 30px rgba(15,23,42,.05), inset 0 1px 0 rgba(255,255,255,.95)", backdropFilter: "blur(18px) saturate(1.4)", WebkitBackdropFilter: "blur(18px) saturate(1.4)" }}
              >
                {/* GLOW BRANCO: luminosidade base do canto superior direito */}
                <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at top right, rgba(255,255,255,.95), transparent 45%)", pointerEvents: "none", zIndex: 0, borderRadius: "inherit" }} />
                
                {/* SHAPE ROSA: maior, mais clara e mais evidente */}
                <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at top right, rgba(255,210,220,.55), transparent 65%)", pointerEvents: "none", zIndex: 0, borderRadius: "inherit" }} />
                
                {/* VÉU DE LUZ TOPO: overlay suave para dar sensação de vidro */}
                <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(255,255,255,.35), transparent)", pointerEvents: "none", zIndex: 0, borderRadius: "inherit" }} />

                {/* ILUMINAÇÃO LATERAL ESQUERDA */}
                <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at left center, rgba(255,255,255,.55), transparent 70%)", pointerEvents: "none", zIndex: 0, borderRadius: "inherit" }} />

                {/* Luz suave rodapé esquerdo */}
                <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at bottom left, rgba(255,255,255,.95), transparent 55%)", pointerEvents: "none", zIndex: 0, borderRadius: "inherit" }} />
                
                {/* SHAPE PRINCIPAL: Removida para manter a suavidade da referência */}
                
                {/* PONTO DE LUZ: Iluminação concentrada no canto superior direito (raio ~180px) */}
                <div
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    top: 0,
                    right: 0,
                    width: "180px",
                    height: "180px",
                    background: "radial-gradient(circle at top right, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.2) 45%, transparent 100%)",
                    pointerEvents: "none",
                    zIndex: 0,
                  }}
                />

                {/* LINHAS CURVAS: Removidas para manter o visual limpo e apenas em gradiente como na foto de referência */}
                <div style={{ position: "relative", zIndex: 1 }}>
                {formContent}
                </div>
              </Card>

              <NfcePendentes
                user={user}
                isMobile={isMobile}
                onRegistrar={handleRegistrarNfce}
                pendentesCount={nfcePendentesCount}
                limite={NFCE_LIMITE}
              />
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
