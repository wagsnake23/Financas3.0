import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/contexts/ToastContext";
import DynamicIcon from "@/components/DynamicIcon";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { AppCategory } from "@/types/finance";
import { cn, formatCurrency } from "@/lib/utils";
import { MonthNavigatorCompact } from "@/components/MonthNavigatorCompact";
import { LayoutGrid, Tag, Calendar, Settings, BadgeDollarSign, Trash2, Check } from "lucide-react";
import { MonthNavigator } from "@/components/MonthNavigator";
import { useOrcamentos } from "@/hooks/useOrcamentos";
import { startOfMonth, endOfMonth, format, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import CurrencyBR from "@/components/ui/currency-br";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Footer } from "@/components/Footer";
const UNSELECTED_VALUE = "unselected";

export default function Orcamentos() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const { showErrorToast, showSuccessToast } = useToast();

  const [currentDate, setCurrentDate] = useState(() => new Date());
  const mesAno = format(currentDate, "yyyy-MM");
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);

  const {
    orcamentos = [],
    isLoading: isOrcamentosLoading,
    saveOrcamento,
    isSaving,
    deleteOrcamento,
    isDeleting,
    syncOrcamentos,
    isSyncing
  } = useOrcamentos(user?.id, mesAno);

  // Fetch Categories
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
    enabled: !!user,
  });

  const parentCategories = useMemo(() => allCategories.filter(c => c.parent_id === null), [allCategories]);
  const subCategories = useMemo(() => allCategories.filter(c => c.parent_id !== null), [allCategories]);

  // Fetch Receitas do mês
  const { data: receitas = [] } = useQuery({
    queryKey: ["receitas-mes", user?.id, mesAno],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("receitas")
        .select("valor, status")
        .eq("user_id", user.id)
        .gte("data", format(monthStart, "yyyy-MM-dd"))
        .lte("data", format(monthEnd, "yyyy-MM-dd"))
        .neq("status", "Cancelada");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const receitaPrevista = useMemo(() => receitas.reduce((acc, curr) => acc + curr.valor, 0), [receitas]);

  // Fetch Realizado (Despesas do mês)
  const orcamentoSubIds = useMemo(() => orcamentos.map(o => o.categoria_id), [orcamentos]);
  
  const { data: realizadoMap = {} } = useQuery<Record<string, number>>({
    queryKey: ["orcamentos-realizado", user?.id, mesAno, orcamentoSubIds],
    queryFn: async () => {
      if (!user?.id || orcamentoSubIds.length === 0) return {};
      
      const { data: despesas, error: despError } = await supabase
        .from("despesas")
        .select("id, categoria_id")
        .eq("user_id", user.id)
        .in("categoria_id", orcamentoSubIds);
      
      if (despError) throw despError;
      if (!despesas || despesas.length === 0) return {};

      const despesaIds = despesas.map(d => d.id);
      
      const { data: parcelas, error: parcError } = await supabase
        .from("despesas_parcelas")
        .select("despesa_id, valor_parcela")
        .in("despesa_id", despesaIds)
        .gte("vencimento", format(monthStart, "yyyy-MM-dd"))
        .lte("vencimento", format(monthEnd, "yyyy-MM-dd"));

      if (parcError) throw parcError;
      if (!parcelas || parcelas.length === 0) return {};

      const despesaCategoriaMap: Record<string, string> = {};
      despesas.forEach(d => {
        if (d.categoria_id) despesaCategoriaMap[d.id] = d.categoria_id;
      });

      const result: Record<string, number> = {};
      parcelas.forEach(p => {
        const catId = despesaCategoriaMap[p.despesa_id];
        if (catId) {
          result[catId] = (result[catId] || 0) + p.valor_parcela;
        }
      });

      return result;
    },
    enabled: !!user && orcamentoSubIds.length > 0,
  });

  // LOGICA DE AUTO-CRIAÇÃO E REPLICAÇÃO SILENCIOSA
  useEffect(() => {
    async function handleAutoSync() {
      if (!user?.id || isLoadingCategories || isOrcamentosLoading || isSyncing) return;
      
      // Checar se o usuário tem QUALQUER orçamento na vida
      const { data: anyOrcamento, error: checkError } = await supabase
        .from("orcamentos")
        .select("id")
        .eq("user_id", user.id)
        .limit(1);

      if (checkError) return;

      if (!anyOrcamento || anyOrcamento.length === 0) {
        // Primeiro acesso absoluto: criar zerado para todas as subcategorias
        if (subCategories.length > 0) {
          const toInsert = subCategories.map(sub => ({
            user_id: user.id,
            categoria_id: sub.id,
            mes_ano: mesAno,
            tipo_planejamento: "valor",
            valor_planejado: 0,
            percentual_planejado: 0,
          }));
          await syncOrcamentos(toInsert);
        }
        return;
      }

      // Usuário já tem histórico, mas o mês atual está vazio
      if (orcamentos.length === 0) {
        // Buscar último mês existente
        const { data: lastOrcamentos, error: lastError } = await supabase
          .from("orcamentos")
          .select("*")
          .eq("user_id", user.id)
          .order("mes_ano", { ascending: false })
          .limit(100);

        if (lastError || !lastOrcamentos || lastOrcamentos.length === 0) return;

        const lastMesAno = lastOrcamentos[0].mes_ano;
        const orcamentosToCopy = lastOrcamentos.filter(o => o.mes_ano === lastMesAno);

        const toInsert = orcamentosToCopy.map(o => ({
          user_id: user.id,
          categoria_id: o.categoria_id,
          mes_ano: mesAno,
          tipo_planejamento: o.tipo_planejamento,
          valor_planejado: o.valor_planejado,
          percentual_planejado: o.percentual_planejado,
        }));
        
        const existingCatIds = new Set(toInsert.map(i => i.categoria_id));
        subCategories.forEach(sub => {
          if (!existingCatIds.has(sub.id)) {
            toInsert.push({
              user_id: user.id,
              categoria_id: sub.id,
              mes_ano: mesAno,
              tipo_planejamento: "valor",
              valor_planejado: 0,
              percentual_planejado: 0,
            });
          }
        });

        await syncOrcamentos(toInsert);
        return;
      }

      // Mês atual tem orçamento. Sincronizar subcategorias novas faltantes.
      const existingCatIds = new Set(orcamentos.map(o => o.categoria_id));
      const missingSubs = subCategories.filter(sub => !existingCatIds.has(sub.id));
      
      if (missingSubs.length > 0) {
        const toInsert = missingSubs.map(sub => ({
          user_id: user.id,
          categoria_id: sub.id,
          mes_ano: mesAno,
          tipo_planejamento: "valor",
          valor_planejado: 0,
          percentual_planejado: 0,
        }));
        await syncOrcamentos(toInsert);
      }
    }

    handleAutoSync();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, mesAno, isOrcamentosLoading, isLoadingCategories]);

  // Estruturação dos dados para a View
  const calculatedOrcamentos = useMemo(() => {
    return orcamentos.map(orc => {
      const subCat = subCategories.find(c => c.id === orc.categoria_id);
      const parentCat = subCat ? parentCategories.find(p => p.id === subCat.parent_id) : null;
      
      let absoluto = orc.tipo_planejamento === "valor" 
        ? orc.valor_planejado 
        : (receitaPrevista * (orc.percentual_planejado || 0)) / 100;
      
      const gasto = realizadoMap[orc.categoria_id] || 0;
      const percentualGasto = absoluto > 0 ? (gasto / absoluto) * 100 : (gasto > 0 ? 100 : 0);
      const excedido = gasto > absoluto;
      const restante = absoluto - gasto;

      return {
        ...orc,
        absoluto,
        gasto,
        percentualGasto,
        excedido,
        restante,
        subCat,
        parentCat,
      };
    }).filter(o => o.subCat != null);
  }, [orcamentos, subCategories, parentCategories, receitaPrevista, realizadoMap]);

  // Agrupamento por Categoria Pai
  const groupedOrcamentos = useMemo(() => {
    const groups: Record<string, { 
      parent: AppCategory; 
      items: typeof calculatedOrcamentos;
      totalPlanejado: number;
      totalGasto: number;
      ativosCount: number;
    }> = {};
    
    calculatedOrcamentos.forEach(item => {
      // Exibir apenas se houver planejamento ou gasto
      if (item.absoluto > 0 || item.gasto > 0) {
        const p = item.parentCat;
        if (p) {
          if (!groups[p.id]) {
            groups[p.id] = { parent: p, items: [], totalPlanejado: 0, totalGasto: 0, ativosCount: 0 };
          }
          groups[p.id].items.push(item);
          groups[p.id].totalPlanejado += item.absoluto;
          groups[p.id].totalGasto += item.gasto;
          groups[p.id].ativosCount += 1;
        }
      }
    });

    Object.values(groups).forEach(g => {
      g.items.sort((a, b) => b.gasto - a.gasto);
    });

    return Object.values(groups).sort((a, b) => b.totalGasto - a.totalGasto);
  }, [calculatedOrcamentos]);

  // Indicadores Superiores
  const totalPlanejado = calculatedOrcamentos.reduce((acc, curr) => acc + curr.absoluto, 0);
  const totalRealizado = calculatedOrcamentos.reduce((acc, curr) => acc + curr.gasto, 0);
  const disponivel = receitaPrevista - totalRealizado;
  const saldoPlanejado = receitaPrevista - totalPlanejado;

  const planejadoUltrapassaReceita = totalPlanejado > receitaPrevista;
  const realizadoUltrapassaPlanejado = totalRealizado > totalPlanejado;

  // Estados Form Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<typeof calculatedOrcamentos[0] | null>(null);
  
  const [formParentId, setFormParentId] = useState<string>(UNSELECTED_VALUE);
  const [formSubId, setFormSubId] = useState<string>(UNSELECTED_VALUE);
  const [formTipo, setFormTipo] = useState<"valor" | "percentual">("valor");
  const [formValor, setFormValor] = useState<number | undefined>(undefined);
  const [formAbrangencia, setFormAbrangencia] = useState<"current_month" | "future_months">("future_months");

  const formSubOptions = useMemo(() => {
    if (formParentId === UNSELECTED_VALUE) return [];
    const subs = subCategories.filter(s => s.parent_id === formParentId);
    if (editingItem) {
      return subs.filter(s => s.id === editingItem.categoria_id);
    }
    return subs.filter(sub => {
      const orc = orcamentos.find(o => o.categoria_id === sub.id);
      const temPlanejamento = orc && (orc.tipo_planejamento === "valor" ? orc.valor_planejado > 0 : (orc.percentual_planejado || 0) > 0);
      return !temPlanejamento;
    });
  }, [formParentId, subCategories, editingItem, orcamentos]);

  const handleOpenEdit = (item: typeof calculatedOrcamentos[0]) => {
    setEditingItem(item);
    setFormParentId(item.parentCat?.id || UNSELECTED_VALUE);
    setFormSubId(item.categoria_id);
    setFormTipo(item.tipo_planejamento as "valor" | "percentual");
    setFormValor(item.tipo_planejamento === "valor" ? item.valor_planejado : item.percentual_planejado);
    setFormAbrangencia("future_months");
    setIsModalOpen(true);
  };

  const handleOpenAdd = () => {
    setEditingItem(null);
    setFormParentId(UNSELECTED_VALUE);
    setFormSubId(UNSELECTED_VALUE);
    setFormTipo("valor");
    setFormValor(undefined);
    setFormAbrangencia("future_months");
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (formSubId === UNSELECTED_VALUE) {
      showErrorToast("Selecione uma subcategoria válida.");
      return;
    }
    if (formValor === undefined || formValor < 0) {
      showErrorToast("Informe um valor válido.");
      return;
    }

    try {
      const existingOrc = orcamentos.find(o => o.categoria_id === formSubId);
      await saveOrcamento({
        id: editingItem?.id || existingOrc?.id,
        user_id: user?.id || "",
        categoria_id: formSubId,
        mes_ano: mesAno,
        tipo_planejamento: formTipo,
        valor_planejado: formTipo === "valor" ? formValor : 0,
        percentual_planejado: formTipo === "percentual" ? formValor : 0,
        applyToFuture: formAbrangencia === "future_months",
      });
      showSuccessToast("Planejamento salvo com sucesso!");
      setIsModalOpen(false);
    } catch (e: any) {
      showErrorToast("Erro ao salvar planejamento.");
    }
  };

  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);

  const handleDelete = async () => {
    if (!editingItem) return;
    try {
      await deleteOrcamento(editingItem.id);
      showSuccessToast("Planejamento removido com sucesso.");
      setIsConfirmDeleteOpen(false);
      setIsModalOpen(false);
    } catch (e: any) {
      showErrorToast("Erro ao remover planejamento.");
    }
  };

  const navigate = useNavigate();

  if (isOrcamentosLoading || isLoadingCategories) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 rounded-full border-4 border-slate-200 border-t-primary animate-spin" />
      </div>
    );
  }

  return (
    <div 
      className={cn("flex flex-col min-h-screen relative", !isMobile ? "global-bg pt-[72px]" : "pt-[calc(3.5rem+env(safe-area-inset-top))]")}
    >
      
      {/* HEADER PREMIUM — FINTECH STYLE (ORÇAMENTOS) */}
      {!isMobile && (
        <div className="relative h-[220px] w-full overflow-hidden bg-transparent">
          <div className="container-app relative z-10 pt-[28px] md:pt-[42px] flex justify-between items-start">
            <div>
              <div className="flex items-start gap-3">
                <div
                  className="btn-3d btn-3d-icon p-2 rounded-xl flex items-center justify-center border-none cursor-default h-auto w-auto mt-1"
                  style={{ "--cor-topo": "#FFFFFF", "--cor-base": "#F1F5F9" } as any}
                >
                  <span className="text-xl select-none">🧮</span>
                </div>
                <div className="flex flex-col">
                  <h1 className="text-2xl font-extrabold text-[#1e3a8a] tracking-[0.5px] -mt-0.5" style={{ fontFamily: "'Inter', sans-serif" }}>
                    Planejamento Mensal
                  </h1>
                  <p className="text-sm font-bold text-slate-500 -mt-0.5 tracking-wider opacity-80">
                    Planeje e acompanhe seus gastos
                  </p>
                </div>
              </div>
            </div>

            <Button 
              onClick={handleOpenAdd}
              className="h-[40px] px-5 rounded-xl font-semibold text-[17px] bg-[#1E3A8B] hover:bg-[#1C2F55] text-white/95 shadow-sm border-none transition-all active:scale-95 flex items-center justify-center gap-1.5 mt-1"
            >
              <DynamicIcon name="Plus" className="w-5 h-5" strokeWidth={3} />
              Novo Planejamento
            </Button>
          </div>
        </div>
      )}

      <main 
        className={cn("container-app flex-grow", isMobile ? "pt-0 pb-4" : "pt-0 pb-8 -mt-[86px] space-y-6")}
        style={isMobile ? {
          background: "linear-gradient(180deg, #FAFAFA 0%, #FAFAFA 48px, #FFFFFF 110px, #FFFFFF calc(100% - 120px), #FCFCFE 100%)"
        } : undefined}
      >
        {/* Cabeçalho Mobile Reformulado */}
        {isMobile && (
          <div className="flex flex-col">
            {/* Seletor de Mês */}
            <div className="relative flex items-center justify-center w-full shrink-0 mb-4 h-8">
              <MonthNavigator
                selectedMonth={currentDate}
                onPreviousMonth={() => setCurrentDate(subMonths(currentDate, 1))}
                onNextMonth={() => setCurrentDate(addMonths(currentDate, 1))}
                isMobile={isMobile}
                onBack={undefined}
                backButtonColor="#1e3a8a"
              />
            </div>
            


            {/* Bloco Planejamento do Mês */}
            <div className="flex flex-col bg-white rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.04)] border border-slate-200/80 p-3 mb-4">
              <div className="flex items-start gap-1.5 mb-2.5">
                <span className="text-[1.2rem] select-none mt-[1px]">🧮</span>
                <div className="flex flex-col">
                  <h2 className="text-[1.05rem] font-bold text-[#0556C3] tracking-[0.2px] leading-tight" style={{ fontFamily: "'Inter', sans-serif" }}>
                    Planejamento Mensal
                  </h2>
                  <span className="text-[13px] font-medium text-slate-500 mt-0 leading-tight">
                    {(new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(currentDate).replace(' de ', '/')).charAt(0).toUpperCase() + (new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(currentDate).replace(' de ', '/')).slice(1)}
                  </span>
                </div>
              </div>
              
              {(() => {
                const disponivelPlanejamento = Math.max(0, totalPlanejado - totalRealizado);
                const saldoNaoPlanejado = Math.max(0, receitaPrevista - totalPlanejado);
                
                const pctDispPlan = receitaPrevista > 0 ? Math.round((disponivelPlanejamento / receitaPrevista) * 100) : 0;
                const pctNaoPlan = receitaPrevista > 0 ? Math.round((saldoNaoPlanejado / receitaPrevista) * 100) : 0;
                
                const isExcedidoReceita = totalRealizado > receitaPrevista;
                const pctVermelhoVisual = isExcedidoReceita ? 15 : 0; 
                const pctAzulVisual = isExcedidoReceita ? 85 : (receitaPrevista > 0 ? Math.min(100, (totalRealizado / receitaPrevista) * 100) : 0);
                const pctRoxoVisual = isExcedidoReceita ? 0 : (receitaPrevista > 0 ? Math.min(100 - pctAzulVisual, (disponivelPlanejamento / receitaPrevista) * 100) : 0);

                return (
                  <div className="flex flex-col gap-1.5">
                    {/* Valores Superiores */}
                    <div className="flex justify-between items-start mb-0.5">
                      <div className="flex flex-col gap-0">
                        <span className="font-medium text-slate-500 text-[11px] leading-tight">Utilizado</span>
                        <span className="font-bold text-[#0556C3] text-[15px] leading-tight mt-[1px]">{formatCurrency(totalRealizado)}</span>
                      </div>
                      <div className="flex flex-col items-end gap-0">
                        <span className="font-medium text-slate-500 text-[11px] leading-tight">Planejado</span>
                        <span className="font-bold text-purple-600 text-[15px] leading-tight mt-[1px]">{formatCurrency(totalPlanejado)}</span>
                      </div>
                    </div>

                    {/* Barra de Progresso Inteligente */}
                    <div className="flex w-full bg-slate-300/70 rounded-full h-[12px] overflow-hidden shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)] mt-0.5 mb-1.5">
                      <div 
                        className="h-full bg-[#0556C3]/90 transition-all duration-500"
                        style={{ width: `${pctAzulVisual}%` }}
                      />
                      <div 
                        className="h-full bg-purple-500/90 transition-all duration-500"
                        style={{ width: `${pctRoxoVisual}%` }}
                      />
                      {isExcedidoReceita && (
                        <div 
                          className="h-full bg-red-500/90 transition-all duration-500"
                          style={{ width: `${pctVermelhoVisual}%` }}
                        />
                      )}
                    </div>
                    
                    {/* Status Inferior */}
                    <div className="flex justify-between items-start mt-0.5">
                      <div className="flex flex-col gap-0">
                        <span className="font-medium text-slate-500 text-[11px] leading-tight">Disponível</span>
                        <span className="font-bold text-purple-600 text-[13px] leading-tight mt-[1px]">{formatCurrency(disponivelPlanejamento)}</span>
                      </div>
                      <div className="flex flex-col items-end gap-0">
                        <span className="font-medium text-slate-500 text-[11px] leading-tight">Não Planejado</span>
                        <span className="font-bold text-slate-500 text-[13px] leading-tight mt-[1px]">{formatCurrency(saldoNaoPlanejado)}</span>
                      </div>
                    </div>

                    {/* Botão Novo Planejamento Mobile */}
                    <Button 
                      onClick={handleOpenAdd}
                      className="h-[36px] w-full mt-1.5 px-0 rounded-xl font-semibold text-[14px] bg-[#0556C3] hover:bg-[#044299] text-white shadow-sm border-none transition-all active:scale-95 flex items-center justify-center gap-1.5"
                    >
                      <DynamicIcon name="Plus" className="w-[14px] h-[14px] text-white" strokeWidth={2.5} />
                      Novo Planejamento
                    </Button>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* Controles: Seletor de Mês (Apenas Desktop) */}
        {!isMobile && (
          <div className="relative flex flex-row justify-center items-center w-full shrink-0 -mt-[63px] mb-4 h-10">
            <MonthNavigator
              selectedMonth={currentDate}
              onPreviousMonth={() => setCurrentDate(subMonths(currentDate, 1))}
              onNextMonth={() => setCurrentDate(addMonths(currentDate, 1))}
              isMobile={false}
              backButtonColor="#1e3a8a"
            />
          </div>
        )}

        {/* Card Resumo Superior (Apenas Desktop) */}
        {!isMobile && (
          <div className="grid grid-cols-5 gap-3 mb-6">
            <Card 
              className="rounded-[16px] bg-white shadow-sm flex flex-col p-4 pt-5 relative overflow-hidden border border-slate-100 min-h-[110px]"
              style={{ background: "linear-gradient(180deg, rgba(59, 130, 246, 0.04) 0%, rgba(59, 130, 246, 0) 40%), #ffffff" }}
            >
              <div className="absolute top-0 left-0 w-full h-[3px] bg-blue-500" />
              <div className="absolute top-4 right-4 w-[34px] h-[34px] rounded-full bg-blue-500/10 flex items-center justify-center">
                <DynamicIcon name="TrendingUp" className="w-[18px] h-[18px] text-blue-600" strokeWidth={2.5} />
              </div>
              <span className="font-semibold text-slate-500 uppercase tracking-wider text-[11px] mb-1 pr-10">Receita Prevista</span>
              <span className="font-bold text-slate-800 text-[1.15rem] leading-none">{formatCurrency(receitaPrevista)}</span>
              <div className="mt-1.5">
                <span className="text-[12px] font-semibold text-blue-600/90 leading-none">
                  100% da receita
                </span>
              </div>
            </Card>

            <Card 
              className="rounded-[16px] bg-white shadow-sm flex flex-col p-4 pt-5 relative overflow-hidden border border-slate-100 min-h-[110px]"
              style={{ background: "linear-gradient(180deg, rgba(168, 85, 247, 0.04) 0%, rgba(168, 85, 247, 0) 40%), #ffffff" }}
            >
              <div className="absolute top-0 left-0 w-full h-[3px] bg-purple-500" />
              <div className="absolute top-4 right-4 w-[34px] h-[34px] rounded-full bg-purple-500/10 flex items-center justify-center">
                <DynamicIcon name="Target" className="w-[18px] h-[18px] text-purple-600" strokeWidth={2.5} />
              </div>
              <span className={cn("font-semibold uppercase tracking-wider text-[11px] mb-1 pr-10", planejadoUltrapassaReceita ? "text-red-500" : "text-slate-500")}>Total Planejado</span>
              <span className={cn("font-bold text-[1.15rem] leading-none", planejadoUltrapassaReceita ? "text-red-600" : "text-slate-800")}>{formatCurrency(totalPlanejado)}</span>
              <div className="mt-1.5">
                <span className={cn("text-[12px] font-semibold leading-none", planejadoUltrapassaReceita ? "text-red-500/90" : "text-purple-600/90")}>
                  {receitaPrevista > 0 ? Math.round((totalPlanejado / receitaPrevista) * 100) : 0}% da receita
                </span>
              </div>
            </Card>

            <Card 
              className="rounded-[16px] bg-white shadow-sm flex flex-col p-4 pt-5 relative overflow-hidden border border-slate-100 min-h-[110px]"
              style={{ background: "linear-gradient(180deg, rgba(239, 68, 68, 0.04) 0%, rgba(239, 68, 68, 0) 40%), #ffffff" }}
            >
              <div className="absolute top-0 left-0 w-full h-[3px] bg-red-500" />
              <div className="absolute top-4 right-4 w-[34px] h-[34px] rounded-full bg-red-500/10 flex items-center justify-center">
                <DynamicIcon name="Receipt" className="w-[18px] h-[18px] text-red-600" strokeWidth={2.5} />
              </div>
              <span className="font-semibold text-slate-500 uppercase tracking-wider text-[11px] mb-1 pr-10">Total Gasto</span>
              <span className="font-bold text-slate-800 text-[1.15rem] leading-none">{formatCurrency(totalRealizado)}</span>
              <div className="mt-1.5">
                <span className="text-[12px] font-semibold text-red-600/90 leading-none">
                  {receitaPrevista > 0 ? Math.round((totalRealizado / receitaPrevista) * 100) : 0}% da receita
                </span>
              </div>
            </Card>

            <Card 
              className="rounded-[16px] bg-white shadow-sm flex flex-col p-4 pt-5 relative overflow-hidden border border-slate-100 min-h-[110px]"
              style={{ background: "linear-gradient(180deg, rgba(16, 185, 129, 0.04) 0%, rgba(16, 185, 129, 0) 40%), #ffffff" }}
            >
              <div className="absolute top-0 left-0 w-full h-[3px] bg-emerald-500" />
              <div className="absolute top-4 right-4 w-[34px] h-[34px] rounded-full bg-emerald-500/10 flex items-center justify-center">
                <DynamicIcon name="Wallet" className="w-[18px] h-[18px] text-emerald-600" strokeWidth={2.5} />
              </div>
              <span className="font-semibold text-slate-500 uppercase tracking-wider text-[11px] mb-1 pr-10">Saldo Disponível</span>
              <span className={cn("font-bold text-[1.15rem] leading-none", disponivel < 0 ? "text-red-600" : "text-slate-800")}>{formatCurrency(disponivel)}</span>
              <div className="mt-1.5">
                <span className={cn("text-[12px] font-semibold leading-none", disponivel < 0 ? "text-red-500/90" : "text-emerald-600/90")}>
                  {receitaPrevista > 0 ? Math.round((disponivel / receitaPrevista) * 100) : 0}% da receita
                </span>
              </div>
            </Card>

            <Card 
              className="rounded-[16px] bg-white shadow-sm flex flex-col p-4 pt-5 relative overflow-hidden border border-slate-100 min-h-[110px] col-span-1"
              style={{ background: "linear-gradient(180deg, rgba(245, 158, 11, 0.04) 0%, rgba(245, 158, 11, 0) 40%), #ffffff" }}
            >
              <div className="absolute top-0 left-0 w-full h-[3px] bg-amber-500" />
              <div className="absolute top-4 right-4 w-[34px] h-[34px] rounded-full bg-amber-500/10 flex items-center justify-center">
                <DynamicIcon name="Landmark" className="w-[18px] h-[18px] text-amber-600" strokeWidth={2.5} />
              </div>
              <span className="font-semibold text-slate-500 uppercase tracking-wider text-[11px] mb-1 pr-10">Saldo Não Planejado</span>
              <span className={cn("font-bold text-[1.15rem] leading-none", saldoPlanejado < 0 ? "text-red-600" : "text-slate-800")}>{formatCurrency(saldoPlanejado)}</span>
              <div className="mt-1.5">
                <span className={cn("text-[12px] font-semibold leading-none", saldoPlanejado < 0 ? "text-red-500/90" : "text-amber-600/90")}>
                  {receitaPrevista > 0 ? Math.round((saldoPlanejado / receitaPrevista) * 100) : 0}% da receita
                </span>
              </div>
            </Card>
          </div>
        )}

        {/* Lista de Orçamentos Agrupados */}
        <div className={cn("flex flex-col", isMobile ? "gap-4 pb-0" : "gap-6 pb-24")}>
          {groupedOrcamentos.length === 0 ? (
            <div className="text-center py-10 text-slate-500">
              Nenhuma subcategoria disponível para orçamento.
            </div>
          ) : (
            <Accordion type="single" collapsible className="w-full grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4 items-start">
              {groupedOrcamentos.map((group) => {
                const semPlanejamento = group.totalPlanejado <= 0;
                const pctGasto = semPlanejamento ? 0 : (group.totalGasto / group.totalPlanejado) * 100;
                const pctClamped = Math.min(100, Math.max(0, pctGasto));
                const excedido = group.totalGasto > group.totalPlanejado;
                const atingido = group.totalGasto === group.totalPlanejado && !semPlanejamento;
                const restante = group.totalPlanejado - group.totalGasto;
                const groupPctReceita = receitaPrevista > 0 ? Math.round((group.totalPlanejado / receitaPrevista) * 100) : 0;

                let progressColor = "bg-emerald-500/85 border border-emerald-600/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.25)]";
                if (semPlanejamento) progressColor = "bg-transparent";
                else if (excedido) progressColor = "bg-red-500/85 border border-red-600/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.25)]";
                else if (atingido) progressColor = "bg-[#0556C3]/85 border border-[#044299]/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.25)]";

                return (
                  <AccordionItem key={group.parent.id} value={group.parent.id} className="border border-slate-200/80 bg-white rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.04)] overflow-hidden">
                    <AccordionTrigger className={cn("hover:no-underline hover:bg-slate-50/50 transition-colors [&[data-state=open]]:bg-slate-50/50", isMobile ? "px-3 py-[5px] min-h-[101px]" : "p-4 min-h-[115px]")}>
                      <div className="flex flex-col w-full text-left">
                        <div className={cn("flex justify-between items-start", isMobile ? "mb-2" : "mb-3")}>
                          <div className="flex items-start gap-2.5">
                            <div className={cn("flex items-center justify-center shrink-0 leading-none", isMobile ? "mt-[2px]" : "mt-[1px]")}>
                              <DynamicIcon name={group.parent.icone || "Tag"} className={cn("leading-none", isMobile ? "text-[32px]" : "text-[38px]")} style={{ color: group.parent.cor }} />
                            </div>
                            <div className="flex flex-col">
                              <span className={cn("font-bold text-slate-800 leading-tight", isMobile ? "text-sm" : "font-semibold")}>{group.parent.nome}</span>
                              <span className={cn("font-semibold text-slate-400 mt-0.5", isMobile ? "text-[11px]" : "text-[12px]")}>
                                {semPlanejamento ? "Planejamento não definido" : `Planejado: ${formatCurrency(group.totalPlanejado)}`}
                              </span>
                            </div>
                          </div>
                          <div className="flex flex-col items-end mr-2">
                            <span className={cn("font-bold", excedido && !semPlanejamento ? "text-red-600" : "text-slate-700", isMobile ? "text-[13px]" : "")}>
                              {formatCurrency(group.totalGasto)}
                            </span>
                            <span className={cn("font-bold text-slate-400 uppercase tracking-wider mt-0.5", isMobile ? "text-[9px]" : "text-[10px]")}>Gasto</span>
                          </div>
                        </div>

                        <div className="flex flex-col gap-2 pr-2">
                          <div className={cn("w-full bg-slate-200/70 rounded-full overflow-hidden shadow-[inset_0_1px_3px_rgba(0,0,0,0.12)]", isMobile ? "h-2" : "h-2.5")}>
                            <div 
                              className={cn("h-full rounded-full transition-all duration-500 ease-out", progressColor)}
                              style={{ width: `${pctClamped}%` }}
                            />
                          </div>
                          <div className="flex justify-between items-center text-xs mt-0.5">
                            {semPlanejamento ? (
                              <span className={cn("font-bold text-slate-500", isMobile ? "text-[10px]" : "text-xs")}>{groupPctReceita}% da receita <span className="text-slate-300 font-normal mx-0.5">|</span> {group.ativosCount} ativos</span>
                            ) : (
                              <span className={cn("font-bold text-slate-500", isMobile ? "text-[10px]" : "text-xs")}>{groupPctReceita}% da receita <span className="text-slate-300 font-normal mx-0.5">|</span> {group.ativosCount} ativos</span>
                            )}
                            
                            {semPlanejamento ? null : excedido ? (
                              <span className={cn("bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold", isMobile ? "text-[9px]" : "text-[10px]")}>
                                Excedido em {formatCurrency(Math.abs(restante))}
                              </span>
                            ) : atingido ? (
                              <span className={cn("font-semibold text-[#0556C3]", isMobile ? "text-[10px]" : "text-xs")}>Planejamento atingido</span>
                            ) : (
                              <span className={cn("font-semibold text-emerald-600", isMobile ? "text-[10px]" : "text-xs")}>Restam {formatCurrency(restante)}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="border-t border-slate-100 bg-transparent px-3 py-3">
                      <div className="flex flex-col gap-3">
                        {group.items.map((item) => {
                          const semPlanejamentoItem = item.absoluto <= 0;
                          const itemPctGasto = semPlanejamentoItem ? 0 : (item.gasto / item.absoluto) * 100;
                          const itemPctClamped = Math.min(100, Math.max(0, itemPctGasto));
                          const itemExcedido = item.gasto > item.absoluto;
                          const itemAtingido = item.gasto === item.absoluto && !semPlanejamentoItem;
                          const itemRestante = item.absoluto - item.gasto;

                          let itemProgressColor = "bg-emerald-400/90 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]";
                          let itemBorderColor = "border-emerald-500/20";
                          
                          if (semPlanejamentoItem) {
                            itemProgressColor = "bg-transparent";
                            itemBorderColor = "border-slate-400/20";
                          }
                          else if (itemExcedido) {
                            itemProgressColor = "bg-red-400/90 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]";
                            itemBorderColor = "border-red-500/20";
                          }
                          else if (itemAtingido) {
                            itemProgressColor = "bg-[#3B82F6]/90 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]";
                            itemBorderColor = "border-blue-500/20";
                          }

                          return (
                            <div 
                              key={item.id}
                              onClick={() => handleOpenEdit(item)}
                              className={cn(
                                "flex flex-col w-full p-3 rounded-xl border cursor-pointer transition-colors hover:bg-slate-50/80 active:bg-slate-100/50",
                                itemBorderColor
                              )}
                            >
                              <div className="flex flex-col gap-1.5 w-full">
                                {/* Header da linha */}
                                <div className="flex items-center gap-3 w-full mt-0.5">
                                  <DynamicIcon name={item.subCat?.icone || "Tag"} className="w-[28px] h-[28px] shrink-0" style={{ color: item.subCat?.cor }} />
                                  <div className="flex flex-col flex-1 min-w-0 gap-[4px]">
                                    <div className="flex justify-between items-center w-full">
                                      <span className="font-bold text-slate-700 text-[14.5px] leading-none truncate pr-2">
                                        {item.subCat?.nome}
                                      </span>
                                      <span className={cn("font-bold text-[14px] leading-none shrink-0", itemExcedido && !semPlanejamentoItem ? "text-red-600" : "text-slate-800")}>
                                        {formatCurrency(item.gasto)}
                                      </span>
                                    </div>
                                    <div className="flex justify-between items-center w-full">
                                      <span className="text-[11px] font-semibold text-[#0556C3]/70 leading-none truncate pr-2">
                                        {receitaPrevista > 0 ? Math.round((item.gasto / receitaPrevista) * 100) : 0}% da receita
                                      </span>
                                      <span className="font-semibold text-slate-400 text-[10.5px] leading-none shrink-0">
                                        {semPlanejamentoItem ? "Não planejado" : `de ${formatCurrency(item.absoluto)}`}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                
                                {/* Progresso e Status */}
                                <div className="flex items-center gap-2.5 w-full mt-0.5">
                                  <div className="flex-1 bg-slate-200 rounded-full h-1.5 overflow-hidden shadow-[inset_0_1px_2px_rgba(0,0,0,0.06)]">
                                    <div 
                                      className={cn("h-full rounded-full transition-all duration-500", itemProgressColor)}
                                      style={{ width: semPlanejamentoItem ? '0%' : `${itemPctClamped}%` }}
                                    />
                                  </div>
                                  {!semPlanejamentoItem ? (
                                    <span className={cn(
                                      "text-[10px] font-bold shrink-0",
                                      itemExcedido ? "text-red-600" : itemAtingido ? "text-[#0556C3]" : "text-emerald-600"
                                    )}>
                                      {itemExcedido ? `Excedido ${formatCurrency(Math.abs(itemRestante))}` : itemAtingido ? "Atingido" : `Restam ${formatCurrency(itemRestante)}`}
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-bold text-slate-400 shrink-0">
                                      Sem planejamento
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          )}
        </div>
      </main>



      {/* Modal de Inclusão / Edição */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent
          onOpenAutoFocus={(e) => e.preventDefault()}
          className={cn(
            isMobile ? "dialog-mobile w-[calc(100%-4px)] max-w-[calc(100%-4px)] !rounded-[19px] !px-3 pb-4" : "sm:max-w-[425px] sm:max-h-[90vh] overflow-y-auto !rounded-[19px] sm:!pb-[19px]",
            "shadow-none border-none bg-[#FAFAFA]"
          )}
          style={{
            border: isMobile ? "2px solid #FFFFFF" : "none",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.6), inset 0 -8px 20px rgba(0,0,0,0.02), 0 20px 25px -5px rgba(0, 0, 0, 0.1)"
          }}
        >
          <DialogHeader
            className={cn(
              "flex flex-col items-start justify-start",
              isMobile ? "mb-[4px]" : "mb-[12px]",
              isMobile && "absolute top-3.5 left-4 right-12 text-left",
              !isMobile && "-mt-2"
            )}
          >
            <div className="flex flex-col w-full transition-all gap-[3px] md:gap-0 pr-6">
              <div className="flex flex-row items-center justify-start gap-3 w-full">
                <DialogTitle className="text-[19px] md:text-[21px] font-extrabold text-[#0556C3]/90 tracking-[0.2px] pb-[1px] m-0 leading-none text-left shrink truncate" style={{ fontFamily: "'Inter', sans-serif" }}>
                  {editingItem ? "Editar Planejamento" : "Novo Planejamento"}
                </DialogTitle>
              </div>
            </div>
          </DialogHeader>

          <div className={cn("flex flex-col gap-5", isMobile ? "pt-[36px]" : "pt-[2px]")}>
            {/* Categoria Pai */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 ml-1">
                <span className="text-[16px] leading-none">🗂️</span>
                <Label className="text-[14px] font-medium text-slate-600">Categoria principal</Label>
              </div>
              <Select 
                value={formParentId} 
                onValueChange={(val) => {
                  setFormParentId(val);
                  setFormSubId(UNSELECTED_VALUE);
                }}
                disabled={!!editingItem} // Só leitura na edição
              >
                <SelectTrigger className="h-[50px] md:h-[53px] text-[15px] rounded-xl font-medium transition-all duration-200 shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] input-3d-premium input-white text-gray-800">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent className="max-h-[250px] rounded-xl border-slate-100 shadow-xl">
                  {parentCategories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id} className="rounded-lg py-2.5">
                      <div className="flex items-center gap-2">
                        <DynamicIcon name={cat.icone} className="w-4 h-4" style={{ color: cat.cor }} />
                        <span className="font-semibold text-slate-700">{cat.nome}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Subcategoria */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 ml-1">
                <span className="text-[16px] leading-none">🏷️</span>
                <Label className="text-[14px] font-medium text-slate-600">Subcategoria (alvo)</Label>
              </div>
              {formParentId !== UNSELECTED_VALUE && formSubOptions.length === 0 && !editingItem ? (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <p className="text-sm font-medium text-amber-800 leading-tight">
                    Nenhuma subcategoria disponível.
                  </p>
                  <p className="text-[11.5px] font-medium text-amber-700/80 mt-1">
                    Todas as subcategorias desta categoria já possuem planejamento para este mês.
                  </p>
                </div>
              ) : (
                <Select 
                  value={formSubId} 
                  onValueChange={setFormSubId}
                  disabled={!!editingItem || formParentId === UNSELECTED_VALUE}
                >
                  <SelectTrigger className="h-[50px] md:h-[53px] text-[15px] rounded-xl font-medium transition-all duration-200 shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] input-3d-premium input-white text-gray-800">
                    <SelectValue placeholder="Selecione a subcategoria..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-[250px] rounded-xl border-slate-100 shadow-xl">
                    {formSubOptions.map(cat => (
                      <SelectItem key={cat.id} value={cat.id} className="rounded-lg py-2.5">
                        <div className="flex items-center gap-2">
                          <DynamicIcon name={cat.icone} className="w-4 h-4" style={{ color: cat.cor }} />
                          <span className="font-semibold text-slate-700">{cat.nome}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Abrangência */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 ml-1">
                <span className="text-[16px] leading-none">📅</span>
                <Label className="text-[14px] font-medium text-slate-600">Abrangência</Label>
              </div>
              <RadioGroup value={formAbrangencia} onValueChange={(val: "current_month" | "future_months") => setFormAbrangencia(val)} className="grid grid-cols-2 gap-2 md:gap-3">
                <div className={cn("relative flex items-center p-2 md:p-3 h-[46px] rounded-xl border-2 cursor-pointer transition-all", formAbrangencia === "future_months" ? "border-[#0556C3]/90 bg-[#0556C3]/5" : "border-slate-200 bg-white hover:border-slate-300")} onClick={() => setFormAbrangencia("future_months")}>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="future_months" id="abr1" className="data-[state=checked]:after:bg-[#0556C3]/90 data-[state=checked]:border-[#0556C3]/90 text-[#0556C3]/90 shrink-0" />
                    <Label htmlFor="abr1" className="font-bold text-slate-700 cursor-pointer text-[12px] sm:text-sm leading-tight">Aplicar aos próximos meses</Label>
                  </div>
                </div>
                <div className={cn("relative flex items-center p-2 md:p-3 h-[46px] rounded-xl border-2 cursor-pointer transition-all", formAbrangencia === "current_month" ? "border-[#0556C3]/90 bg-[#0556C3]/5" : "border-slate-200 bg-white hover:border-slate-300")} onClick={() => setFormAbrangencia("current_month")}>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="current_month" id="abr2" className="data-[state=checked]:after:bg-[#0556C3]/90 data-[state=checked]:border-[#0556C3]/90 text-[#0556C3]/90 shrink-0" />
                    <Label htmlFor="abr2" className="font-bold text-slate-700 cursor-pointer text-[12px] sm:text-sm leading-tight">Apenas este mês</Label>
                  </div>
                </div>
              </RadioGroup>
            </div>

            {/* Tipo de Planejamento */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 ml-1">
                <span className="text-[16px] leading-none">⚙️</span>
                <Label className="text-[14px] font-medium text-slate-600">Tipo de planejamento</Label>
              </div>
              <RadioGroup value={formTipo} onValueChange={(val: "valor" | "percentual") => { setFormTipo(val); setFormValor(undefined); }} className="grid grid-cols-2 gap-2 md:gap-3">
                <div className={cn("relative flex items-center p-2 md:p-3 h-[46px] rounded-xl border-2 cursor-pointer transition-all", formTipo === "valor" ? "border-[#0556C3]/90 bg-[#0556C3]/5" : "border-slate-200 bg-white hover:border-slate-300")} onClick={() => { setFormTipo("valor"); setFormValor(undefined); }}>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="valor" id="r1" className="data-[state=checked]:after:bg-[#0556C3]/90 data-[state=checked]:border-[#0556C3]/90 text-[#0556C3]/90 shrink-0" />
                    <Label htmlFor="r1" className="font-bold text-slate-700 cursor-pointer text-[12px] sm:text-sm leading-tight">Valor Fixo (R$)</Label>
                  </div>
                </div>
                <div className={cn("relative flex items-center p-2 md:p-3 h-[46px] rounded-xl border-2 cursor-pointer transition-all", formTipo === "percentual" ? "border-[#0556C3]/90 bg-[#0556C3]/5" : "border-slate-200 bg-white hover:border-slate-300")} onClick={() => { setFormTipo("percentual"); setFormValor(undefined); }}>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="percentual" id="r2" className="data-[state=checked]:after:bg-[#0556C3]/90 data-[state=checked]:border-[#0556C3]/90 text-[#0556C3]/90 shrink-0" />
                    <Label htmlFor="r2" className="font-bold text-slate-700 cursor-pointer text-[12px] sm:text-sm leading-tight">Percentual (%)</Label>
                  </div>
                </div>
              </RadioGroup>
            </div>

            {/* Valor */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 ml-1">
                <span className="text-[16px] leading-none">💰</span>
                <Label className="text-[14px] font-medium text-slate-600">
                  {formTipo === "valor" ? "Valor planejado" : "Percentual da receita"}
                </Label>
              </div>
              {formTipo === "valor" ? (
                <CurrencyBR
                  value={formValor || 0}
                  onChange={setFormValor}
                  className="h-[50px] md:h-[53px] text-[18px] font-semibold rounded-xl transition-all duration-200 shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] input-3d-premium input-white text-gray-800"
                  placeholder="R$ 0,00"
                />
              ) : (
                <div className="relative">
                  <Input 
                    type="number"
                    value={formValor || ""}
                    onChange={(e) => setFormValor(parseFloat(e.target.value))}
                    className="h-[50px] md:h-[53px] text-[18px] font-semibold rounded-xl pl-4 pr-10 transition-all duration-200 shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] input-3d-premium input-white text-gray-800"
                    placeholder="0"
                    step="0.1"
                    min="0"
                    max="100"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-semibold">%</span>
                </div>
              )}
              {(() => {
                if (formValor === undefined || formValor === 0) return null;
                const valorInformadoNum = formValor;
                const valorEmReais = formTipo === "valor" ? valorInformadoNum : ((receitaPrevista * valorInformadoNum) / 100);
                const pctReceita = receitaPrevista > 0 ? (valorEmReais / receitaPrevista) * 100 : 0;
                const isHighPct = pctReceita > 80;
                
                const planejadoAnterior = editingItem ? editingItem.absoluto : 0;
                const novoTotalPlanejado = totalPlanejado - planejadoAnterior + valorEmReais;
                const saldoRestante = receitaPrevista - novoTotalPlanejado;
                const excedeReceita = saldoRestante < 0;

                if (excedeReceita) {
                  return (
                    <div className="text-[12px] font-semibold text-red-600 mt-2 ml-1">
                      ⚠ Excede o saldo disponível em {formatCurrency(Math.abs(saldoRestante))}
                    </div>
                  );
                }

                return (
                  <div className="flex items-center text-[12px] mt-2 ml-1">
                    <span className="font-semibold text-emerald-600">
                      {formatCurrency(saldoRestante)} disponíveis
                    </span>
                    <span className="text-slate-300 mx-1.5">|</span>
                    <span className={cn("font-semibold", isHighPct ? "text-amber-500" : "text-[#0556C3]")}>
                      {pctReceita.toFixed(1).replace('.', ',')}% da receita
                    </span>
                  </div>
                );
              })()}
            </div>

            <div className={cn("grid gap-2 w-full pt-1", editingItem ? "grid-cols-2" : "grid-cols-1")}>
              {editingItem && (
                <Button
                  type="button"
                  onClick={() => setIsConfirmDeleteOpen(true)}
                  className="w-full rounded-[14px] font-extrabold tracking-[0.2px] border border-slate-300 transition-all active:scale-95 text-[18px] h-[44px] flex items-center justify-center gap-1.5 bg-white text-red-500 hover:bg-slate-50"
                  disabled={isSaving}
                >
                  <Trash2 className="w-5 h-5" />
                  Excluir
                </Button>
              )}
              <Button
                type="button"
                className="w-full rounded-[14px] font-extrabold tracking-[0.2px] text-white border-none transition-all active:scale-95 text-[18px] h-[44px] flex items-center justify-center gap-1.5 btn-3d-modal disabled:opacity-50 disabled:pointer-events-none"
                style={{ "--cor-topo": "#25AF6A", "--cor-base": "#1AA361" } as any}
                disabled={isSaving || (formParentId !== UNSELECTED_VALUE && formSubOptions.length === 0 && !editingItem)}
                onClick={handleSave}
              >
                {isSaving ? "Salvando..." : (
                  <>
                    <Check className="w-5 h-5" strokeWidth={3} />
                    Salvar
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm Delete Dialog */}
      <AlertDialog open={isConfirmDeleteOpen} onOpenChange={setIsConfirmDeleteOpen}>
        <AlertDialogContent
          className={cn(
            isMobile ? "dialog-mobile w-[99%] max-w-[99%] !px-4 p-4 !pb-4 min-h-[180px] !rounded-[22px] shadow-none border-none" : "sm:max-w-[400px] !pb-4 !rounded-[22px] shadow-none border-none"
          )}
          style={{
            background: "linear-gradient(135deg, #ffffff 0%, #f9fafb 100%)",
            backgroundBlendMode: "soft-light",
            backdropFilter: "blur(6px)",
            border: "1px solid rgba(0,0,0,0.06)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.6), inset 0 -8px 20px rgba(0,0,0,0.02), 0 20px 25px -5px rgba(0, 0, 0, 0.1)"
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center justify-center gap-2 text-xl font-black">
              <DynamicIcon name="Trash2" className="h-6 w-6 text-destructive" />
              Confirmar Exclusão
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              Tem certeza que deseja excluir este planejamento? Esta ação não afetará os lançamentos reais.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter
            className={cn(
              "flex flex-col sm:flex-row justify-center gap-2 mt-4",
              isMobile && "flex-row items-center justify-between"
            )}
          >
            <AlertDialogCancel
              className={cn(
                "flex-1 rounded-xl btn-3d font-black !text-[#1E40AF] border-none transition-all active:scale-95 shadow-[0_2px_4px_rgba(0,0,0,0.05)] text-lg mt-0 h-11",
                isMobile && "h-11 text-lg"
              )}
              style={{ "--cor-topo": "#E0E7FF", "--cor-base": "#C7D2FE" } as any}
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className={cn(
                "flex-1 rounded-2xl btn-3d font-black text-white border-none transition-all active:scale-95 shadow-[0_2px_4px_rgba(0,0,0,0.05)] text-lg h-11",
                isMobile && "h-12 text-lg"
              )}
              style={{ "--cor-topo": "#FF6B6B", "--cor-base": "#E54D4D" } as any}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Footer
        isMobile={isMobile}
        user={user}
        className={cn(isMobile ? "relative w-full mt-2 mb-[env(safe-area-inset-bottom,16px)] pt-2 pb-2 z-20 !bg-transparent" : "mt-8")}
      />
    </div>
  );
}
