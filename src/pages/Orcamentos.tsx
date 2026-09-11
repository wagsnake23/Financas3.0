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
    const groups: Record<string, { parent: AppCategory; items: typeof calculatedOrcamentos }> = {};
    
    calculatedOrcamentos.forEach(item => {
      const p = item.parentCat;
      if (p) {
        if (!groups[p.id]) {
          groups[p.id] = { parent: p, items: [] };
        }
        groups[p.id].items.push(item);
      }
    });

    Object.values(groups).forEach(g => {
      g.items.sort((a, b) => b.absoluto - a.absoluto);
    });

    return Object.values(groups).sort((a, b) => a.parent.nome.localeCompare(b.parent.nome));
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

  const formSubOptions = useMemo(() => {
    if (formParentId === UNSELECTED_VALUE) return [];
    return subCategories.filter(s => s.parent_id === formParentId);
  }, [formParentId, subCategories]);

  const handleOpenEdit = (item: typeof calculatedOrcamentos[0]) => {
    setEditingItem(item);
    setFormParentId(item.parentCat?.id || UNSELECTED_VALUE);
    setFormSubId(item.categoria_id);
    setFormTipo(item.tipo_planejamento as "valor" | "percentual");
    setFormValor(item.tipo_planejamento === "valor" ? item.valor_planejado : item.percentual_planejado);
    setIsModalOpen(true);
  };

  const handleOpenAdd = () => {
    setEditingItem(null);
    setFormParentId(UNSELECTED_VALUE);
    setFormSubId(UNSELECTED_VALUE);
    setFormTipo("valor");
    setFormValor(undefined);
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
      await saveOrcamento({
        id: editingItem?.id,
        user_id: user?.id || "",
        categoria_id: formSubId,
        mes_ano: mesAno,
        tipo_planejamento: formTipo,
        valor_planejado: formTipo === "valor" ? formValor : 0,
        percentual_planejado: formTipo === "percentual" ? formValor : 0,
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
      className={cn("flex flex-col min-h-screen relative", !isMobile ? "global-bg pt-[72px]" : "pt-0")}
      style={isMobile ? {
        background: "linear-gradient(180deg, #FAFAFA 0%, #FAFAFA 48px, #FFFFFF 110px, #FFFFFF calc(100% - 120px), #FCFCFE 100%)"
      } : undefined}
    >
      
      {/* HEADER PREMIUM — FINTECH STYLE (ORÇAMENTOS) */}
      {!isMobile && (
        <div className="relative h-[160px] w-full overflow-hidden bg-transparent">
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
              onClick={() => navigate(-1)}
              className="btn-3d h-9 px-3 rounded-xl font-black text-xs shadow-sm border-none transition-all active:scale-95 !text-[#1e3a8a] bg-white hover:bg-white/90"
              style={{ "--cor-topo": "#FFFFFF", "--cor-base": "#F1F5F9" } as any}
            >
              <DynamicIcon name="ChevronLeft" className="mr-1 h-4 w-4 !text-[#1e3a8a]" strokeWidth={3} />
              Voltar
            </Button>
          </div>
        </div>
      )}

      <main className={cn("container-app flex-grow", isMobile ? "pt-16 pb-4" : "pt-0 pb-8 -mt-6")}>
        {/* Cabeçalho Mobile */}
        {isMobile && (
          <div className="flex flex-col gap-4 mb-6">
            <div className="flex items-start gap-3 mb-2 px-1">
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
        )}

        {/* Controles: Seletor de Mês e Novo Planejamento (Apenas Mobile) */}
        <div className="flex flex-row justify-between items-center mb-6 gap-2">
          <MonthNavigatorCompact 
            selectedMonth={currentDate}
            onPreviousMonth={() => setCurrentDate(subMonths(currentDate, 1))}
            onNextMonth={() => setCurrentDate(addMonths(currentDate, 1))}
            variant="balance"
            premiumMode={true}
          />
          {isMobile && (
            <Button 
              onClick={handleOpenAdd}
              className="h-[34px] px-3 rounded-full font-bold text-xs bg-[#1E3A8B] hover:bg-[#1C2F55] text-white shadow-sm border-none transition-all active:scale-95 flex items-center justify-center"
            >
              <DynamicIcon name="Plus" className="w-4 h-4" strokeWidth={3} />
            </Button>
          )}
        </div>
          


        {/* Card Resumo Superior */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <Card className="p-4 rounded-2xl bg-gradient-to-br from-blue-50 to-white shadow-sm border-blue-100 flex flex-col justify-center">
            <span className="text-xs font-semibold text-blue-700 uppercase tracking-wider mb-1">Receita Prevista</span>
            <span className="text-lg font-bold text-slate-800">{formatCurrency(receitaPrevista)}</span>
          </Card>
          <Card className={cn(
            "p-4 rounded-2xl shadow-sm flex flex-col justify-center transition-colors",
            planejadoUltrapassaReceita ? "bg-red-50 border-red-200" : "bg-white border-slate-100"
          )}>
            <span className={cn("text-xs font-semibold uppercase tracking-wider mb-1", planejadoUltrapassaReceita ? "text-red-700" : "text-slate-500")}>Total Planejado</span>
            <span className={cn("text-lg font-bold", planejadoUltrapassaReceita ? "text-red-700" : "text-slate-800")}>{formatCurrency(totalPlanejado)}</span>
          </Card>
          <Card className={cn(
            "p-4 rounded-2xl shadow-sm flex flex-col justify-center transition-colors",
            realizadoUltrapassaPlanejado ? "bg-red-50 border-red-200" : "bg-white border-slate-100"
          )}>
            <span className={cn("text-xs font-semibold uppercase tracking-wider mb-1", realizadoUltrapassaPlanejado ? "text-red-700" : "text-slate-500")}>Total Realizado</span>
            <span className={cn("text-lg font-bold", realizadoUltrapassaPlanejado ? "text-red-700" : "text-slate-800")}>{formatCurrency(totalRealizado)}</span>
          </Card>
          <Card className="p-4 rounded-2xl bg-white shadow-sm border-slate-100 flex flex-col justify-center">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Disponível</span>
            <span className={cn("text-lg font-bold", disponivel < 0 ? "text-red-600" : "text-emerald-600")}>{formatCurrency(disponivel)}</span>
          </Card>
          <Card className="p-4 rounded-2xl bg-white shadow-sm border-slate-100 flex flex-col justify-center col-span-2 md:col-span-1">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Saldo Planejado</span>
            <span className={cn("text-lg font-bold", saldoPlanejado < 0 ? "text-red-600" : "text-slate-800")}>{formatCurrency(saldoPlanejado)}</span>
          </Card>
        </div>

        {/* Lista de Orçamentos Agrupados */}
        <div className="flex flex-col gap-8 pb-24">
          {groupedOrcamentos.length === 0 ? (
            <div className="text-center py-10 text-slate-500">
              Nenhuma subcategoria disponível para orçamento.
            </div>
          ) : (
            groupedOrcamentos.map((group) => (
              <div key={group.parent.id} className="flex flex-col gap-3">
                <div className="flex items-center gap-2 pl-1 mb-1">
                  <DynamicIcon name={group.parent.icone} className="w-5 h-5 text-slate-400" />
                  <h3 className="text-base font-bold text-slate-700">{group.parent.nome}</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {group.items.map((item) => {
                    const pctClamped = Math.min(100, Math.max(0, item.percentualGasto));
                    
                    let progressColor = "bg-emerald-500";
                    if (item.percentualGasto > 100) progressColor = "bg-red-500";
                    else if (item.percentualGasto >= 80) progressColor = "bg-amber-500";

                    return (
                      <Card 
                        key={item.id} 
                        className="p-4 rounded-2xl border-slate-100/60 shadow-[0_2px_10px_rgba(0,0,0,0.04)] hover:shadow-md cursor-pointer transition-all active:scale-[0.98] group"
                        onClick={() => handleOpenEdit(item)}
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${item.subCat?.cor}15` }}>
                              <DynamicIcon name={item.subCat?.icone || "Tag"} className="w-5 h-5" style={{ color: item.subCat?.cor }} />
                            </div>
                            <div className="flex flex-col">
                              <span className="font-semibold text-slate-800 leading-tight">{item.subCat?.nome}</span>
                              <span className="text-[11px] font-medium text-slate-400 mt-0.5">
                                Planejado: {formatCurrency(item.absoluto)} {item.tipo_planejamento === "percentual" && `(${item.percentual_planejado}%)`}
                              </span>
                            </div>
                          </div>
                          <div className="flex flex-col items-end">
                            <span className={cn("font-bold", item.excedido ? "text-red-600" : "text-slate-700")}>
                              {formatCurrency(item.gasto)}
                            </span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Gasto</span>
                          </div>
                        </div>

                        <div className="flex flex-col gap-2">
                          <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className={cn("h-full rounded-full transition-all duration-500 ease-out", progressColor)}
                              style={{ width: `${pctClamped}%` }}
                            />
                          </div>
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-bold text-slate-500">{item.percentualGasto.toFixed(0)}%</span>
                            <span className={cn("font-semibold", item.excedido ? "text-red-500" : "text-emerald-600")}>
                              {item.excedido ? `⚠ Excedido em ${formatCurrency(Math.abs(item.restante))}` : `Restam ${formatCurrency(item.restante)}`}
                            </span>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      {/* FAB - Floating Action Button (Apenas Desktop) */}
      {!isMobile && (
        <button 
          onClick={handleOpenAdd}
          className="fixed bottom-[90px] md:bottom-8 right-4 md:right-8 w-14 h-14 rounded-full bg-[#0556C3] text-white shadow-lg shadow-blue-500/30 flex items-center justify-center hover:scale-105 active:scale-95 transition-all z-40"
        >
          <DynamicIcon name="Plus" className="w-6 h-6" strokeWidth={3} />
        </button>
      )}

      {/* Modal de Inclusão / Edição */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="w-[95vw] max-w-md rounded-3xl p-6 border-slate-100 shadow-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-xl font-bold text-slate-800">
              {editingItem ? "Editar Planejamento" : "Novo Planejamento"}
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-5">
            {/* Categoria Pai */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Categoria Principal</Label>
              <Select 
                value={formParentId} 
                onValueChange={(val) => {
                  setFormParentId(val);
                  setFormSubId(UNSELECTED_VALUE);
                }}
                disabled={!!editingItem} // Só leitura na edição
              >
                <SelectTrigger className="h-12 rounded-xl bg-slate-50 border-slate-200">
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
              <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Subcategoria (Alvo)</Label>
              <Select 
                value={formSubId} 
                onValueChange={setFormSubId}
                disabled={!!editingItem || formParentId === UNSELECTED_VALUE}
              >
                <SelectTrigger className="h-12 rounded-xl bg-slate-50 border-slate-200">
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
            </div>

            {/* Tipo de Planejamento */}
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Tipo de Planejamento</Label>
              <RadioGroup value={formTipo} onValueChange={(val: "valor" | "percentual") => {
                setFormTipo(val);
                setFormValor(undefined);
              }} className="flex gap-4">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="valor" id="r1" />
                  <Label htmlFor="r1" className="font-semibold text-slate-700 cursor-pointer">Valor Fixo (R$)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="percentual" id="r2" />
                  <Label htmlFor="r2" className="font-semibold text-slate-700 cursor-pointer">Percentual (%)</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Valor */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">
                {formTipo === "valor" ? "Valor Planejado" : "Percentual da Receita"}
              </Label>
              {formTipo === "valor" ? (
                <CurrencyBR
                  value={formValor || 0}
                  onChange={setFormValor}
                  className="h-14 text-xl font-bold bg-slate-50 rounded-xl"
                  placeholder="R$ 0,00"
                />
              ) : (
                <div className="relative">
                  <Input 
                    type="number"
                    value={formValor || ""}
                    onChange={(e) => setFormValor(parseFloat(e.target.value))}
                    className="h-14 text-xl font-bold bg-slate-50 rounded-xl pl-4 pr-10"
                    placeholder="0"
                    step="0.1"
                    min="0"
                    max="100"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">%</span>
                </div>
              )}
              {formTipo === "percentual" && formValor !== undefined && (
                <p className="text-xs text-slate-500 ml-1 mt-1">
                  Corresponde a aprox. <strong className="text-slate-700">{formatCurrency((receitaPrevista * formValor) / 100)}</strong>
                </p>
              )}
            </div>

            <div className="flex gap-3 pt-4">
              {editingItem && (
                <Button 
                  variant="outline" 
                  onClick={() => setIsConfirmDeleteOpen(true)}
                  className="h-12 rounded-xl text-red-500 border-red-200 hover:bg-red-50 hover:border-red-300 font-bold w-12 shrink-0 px-0"
                >
                  <DynamicIcon name="Trash2" className="w-5 h-5" />
                </Button>
              )}
              <Button 
                onClick={handleSave}
                disabled={isSaving}
                className="h-12 rounded-xl bg-[#1E3A8B] hover:bg-[#1C2F55] text-white font-bold text-[15px] flex-1 shadow-md"
              >
                {isSaving ? "Salvando..." : "Salvar Planejamento"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm Delete Dialog */}
      <AlertDialog open={isConfirmDeleteOpen} onOpenChange={setIsConfirmDeleteOpen}>
        <AlertDialogContent className="rounded-[24px] max-w-[90vw] w-[360px] p-6 border-slate-100 shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold text-slate-800">Excluir planejamento?</AlertDialogTitle>
            <AlertDialogDescription className="text-[15px] text-slate-500 mt-2">
              Esta ação removerá este planejamento. Os lançamentos reais não serão afetados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6 flex-col-reverse sm:flex-row gap-2 sm:gap-3">
            <AlertDialogCancel className="h-12 rounded-xl font-semibold border-slate-200 sm:mt-0">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="h-12 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold"
            >
              Sim, excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
