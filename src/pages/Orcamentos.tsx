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
import { LayoutGrid, Tag, Calendar, Settings, BadgeDollarSign, Trash2, Check, Save, Bell } from "lucide-react";
import { MonthNavigator } from "@/components/MonthNavigator";
import { useOrcamentos } from "@/hooks/useOrcamentos";
import { useCategories } from "@/hooks/useCategories";
import { startOfMonth, endOfMonth, format, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
    isSyncing,
    deleteOrcamentosMassAction,
    isDeletingMass
  } = useOrcamentos(user?.id, mesAno);

  // Fetch Categories via SSOT
  const { data: allCategories = [], isLoading: isLoadingCategories } = useCategories(user?.id);

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
  const allSubIds = useMemo(() => subCategories.map(s => s.id), [subCategories]);

  const { data: realizadoMap = {} } = useQuery<Record<string, number>>({
    queryKey: ["orcamentos-realizado", user?.id, mesAno, allSubIds],
    queryFn: async () => {
      if (!user?.id || allSubIds.length === 0) return {};

      const { data: despesas, error: despError } = await supabase
        .from("despesas")
        .select("id, categoria_id")
        .eq("user_id", user.id)
        .in("categoria_id", allSubIds);

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
    enabled: !!user && allSubIds.length > 0,
  });

  // LOGICA DE AUTO-CRIAÇÃO E REPLICAÇÃO SILENCIOSA
  useEffect(() => {
    async function handleAutoSync() {
      if (!user?.id || isLoadingCategories || isOrcamentosLoading || isSyncing) return;

      const clearedFrom = localStorage.getItem(`orcamentos_cleared_from_${user.id}`);
      if (clearedFrom && mesAno >= clearedFrom) return;

      const clearedExact = localStorage.getItem(`orcamentos_cleared_exact_${user.id}_${mesAno}`);
      if (clearedExact === "true") return;

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
    return subCategories.map(subCat => {
      const orc = orcamentos.find(o => o.categoria_id === subCat.id);
      const parentCat = parentCategories.find(p => p.id === subCat.parent_id) || null;

      const gasto = realizadoMap[subCat.id] || 0;

      let absoluto = 0;
      if (orc) {
        absoluto = orc.tipo_planejamento === "valor"
          ? orc.valor_planejado
          : (receitaPrevista * (orc.percentual_planejado || 0)) / 100;
      }

      const percentualGasto = absoluto > 0 ? (gasto / absoluto) * 100 : (gasto > 0 ? 100 : 0);
      const excedido = gasto > absoluto;
      const restante = absoluto - gasto;

      return {
        ...(orc || { id: `virtual-${subCat.id}`, user_id: user?.id || "", categoria_id: subCat.id, mes_ano: mesAno, tipo_planejamento: "valor" as const, valor_planejado: 0, percentual_planejado: 0, created_at: "", updated_at: "" }),
        absoluto,
        gasto,
        percentualGasto,
        excedido,
        restante,
        subCat,
        parentCat,
      };
    }).filter(o => o.parentCat != null);
  }, [orcamentos, subCategories, parentCategories, receitaPrevista, realizadoMap, mesAno, user?.id]);

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

  // Auditoria de diagnóstico removida (dados de depuração)

  // Estados Form Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<typeof calculatedOrcamentos[0] | null>(null);

  const [formParentId, setFormParentId] = useState<string>(UNSELECTED_VALUE);
  const [formSubId, setFormSubId] = useState<string>(UNSELECTED_VALUE);
  const [formValor, setFormValor] = useState<number | undefined>(undefined);
  const [formAbrangencia, setFormAbrangencia] = useState<"current_month" | "future_months">("current_month");

  // Estados Delete Modal
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteApplyToFuture, setDeleteApplyToFuture] = useState<boolean>(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Estados Pending Bell
  const [isPendingPopoverOpen, setIsPendingPopoverOpen] = useState(false);
  const [isPlanejandoTudo, setIsPlanejandoTudo] = useState(false);

  const handlePlanejaTudo = async () => {
    if (!user?.id || isPlanejandoTudo || pendingOrcamentos.length === 0) return;
    setIsPlanejandoTudo(true);
    try {
      for (const item of pendingOrcamentos) {
        // Look up any existing orcamento for this category in this month
        // (even if it has valor_planejado = 0). Pass its id so saveOrcamento
        // takes the UPDATE path, avoiding the unique constraint violation.
        const existingOrc = orcamentos?.find(o => o.categoria_id === item.categoria_id);
        const payload = {
          id: existingOrc?.id,
          user_id: user.id,
          categoria_id: item.categoria_id,
          mes_ano: mesAno,
          tipo_planejamento: "valor" as const,
          valor_planejado: item.gasto,
          percentual_planejado: 0,
          applyToFuture: false,
        };
        await saveOrcamento(payload);
      }
      setIsPendingPopoverOpen(false);
      showSuccessToast("Planejamentos criados com sucesso!");
    } catch (err: any) {
      showErrorToast(err.message || "Erro ao planejar categorias.");
    } finally {
      setIsPlanejandoTudo(false);
    }
  };

  const pendingOrcamentos = useMemo(() => {
    return calculatedOrcamentos
      .filter(o => o.gasto > 0 && o.absoluto <= 0)
      .sort((a, b) => b.gasto - a.gasto);
  }, [calculatedOrcamentos]);

  const renderPendingBell = () => {
    const hasPending = pendingOrcamentos.length > 0;

    return (
      <Popover open={isPendingPopoverOpen} onOpenChange={setIsPendingPopoverOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "relative flex items-center justify-center w-[36px] h-[36px] rounded-full transition-colors shrink-0",
              !hasPending ? "pointer-events-none" : "",
              isMobile
                ? (hasPending ? "text-[#112B5E] hover:bg-slate-200/50" : "text-slate-400 bg-transparent")
                : (hasPending ? "text-[#112B5E] hover:bg-black/5 bg-transparent" : "text-slate-400 bg-transparent")
            )}
            title="Categorias sem planejamento"
          >
            <Bell className={cn("h-[20px] w-[20px]", hasPending ? "text-[#112B5E]" : "text-slate-400")} strokeWidth={hasPending ? 2.5 : 2} />
            {hasPending && (
              <span className="absolute top-[2px] right-[2px] flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-red-500 px-[3px] text-[9.5px] font-bold text-white border-[2px] border-white">
                {pendingOrcamentos.length > 9 ? "9+" : pendingOrcamentos.length}
              </span>
            )}
          </button>
        </PopoverTrigger>

        {hasPending && (
          <PopoverContent
            align={isMobile ? "center" : "end"}
            collisionPadding={isMobile ? 18 : 16}
            sideOffset={isMobile ? -3 : 8}
            className={cn("p-0 rounded-[14px] shadow-xl border border-slate-200 overflow-hidden z-[100] bg-white", isMobile ? "w-[calc(100vw-37px)]" : "w-[320px]")}
            style={{ maxHeight: '60vh', overflowY: 'auto', background: '#FFFFFF', backdropFilter: 'none', WebkitBackdropFilter: 'none' }}
          >
            <div className="p-3.5 bg-slate-100 border-b border-[#E5E7EB] flex items-center justify-between gap-2">
              <h3 className="font-bold text-slate-800 text-[14px] flex items-center gap-2">
                <span className="text-[16px]">⚠️</span> Sem Planejamento
              </h3>
              <button
                type="button"
                onClick={handlePlanejaTudo}
                disabled={isPlanejandoTudo}
                className="flex items-center gap-1 px-2.5 py-1 rounded-[8px] text-[11.5px] font-bold text-white transition-all active:scale-95 disabled:opacity-60 shrink-0"
                style={{ background: "linear-gradient(135deg, #3B82F6, #2563EB)" }}
              >
                {isPlanejandoTudo ? (
                  <span className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin inline-block" />
                ) : (
                  <span>✓</span>
                )}
                Planejar Tudo
              </button>
            </div>

            <div className="flex flex-col">
              {pendingOrcamentos.map((item) => (
                <button
                  key={item.categoria_id}
                  onClick={() => {
                    setIsPendingPopoverOpen(false);
                    handleOpenEdit(item);
                  }}
                  className="flex items-center justify-between px-4 py-3 border-b border-[#E5E7EB] last:border-0 hover:bg-slate-50 transition-colors text-left"
                >
                  <div className="flex items-center gap-2.5 truncate mr-3 flex-1">
                    <DynamicIcon name={item.subCat?.icone || "FolderKanban"} className="w-[18px] h-[18px] shrink-0 opacity-90" />
                    <span className="text-[13px] font-semibold text-slate-700 truncate">
                      {item.subCat?.nome}
                    </span>
                  </div>
                  <span className="text-[13px] font-bold text-red-500 whitespace-nowrap">
                    {formatCurrency(item.gasto)}
                  </span>
                </button>
              ))}
            </div>
          </PopoverContent>
        )}
      </Popover>
    );
  };

  // Fetch impact count for delete
  const { data: deleteAffectedCount = null, isLoading: isLoadingDeleteCount } = useQuery({
    queryKey: ["orcamentos-count", user?.id, mesAno, deleteApplyToFuture],
    queryFn: async () => {
      if (!user?.id || !isDeleteModalOpen) return null;
      let query = supabase.from("orcamentos").select("id", { count: "exact" }).eq("user_id", user.id);
      if (deleteApplyToFuture) query = query.gte("mes_ano", mesAno);
      else query = query.eq("mes_ano", mesAno);
      const { count, error } = await query;
      if (error) throw error;
      return count;
    },
    enabled: isDeleteModalOpen && !!user?.id,
  });

  const handleOpenDelete = () => {
    setDeleteApplyToFuture(false);
    setShowDeleteConfirm(false);
    setIsDeleteModalOpen(true);
  };

  const handleTriggerDeleteMass = () => {
    if (deleteAffectedCount === 0) {
      showErrorToast("Não existem planejamentos para remover no período selecionado.");
      return;
    }
    setShowDeleteConfirm(true);
  };

  const handleDeleteMass = async () => {
    try {
      if (deleteOrcamentosMassAction) {
        await deleteOrcamentosMassAction({
          mes_ano: mesAno,
          applyToFuture: deleteApplyToFuture
        });

        // Registrar a exclusão manual para evitar que o Auto Sync recrie os orçamentos
        if (deleteApplyToFuture) {
          localStorage.setItem(`orcamentos_cleared_from_${user?.id}`, mesAno);
        } else {
          localStorage.setItem(`orcamentos_cleared_exact_${user?.id}_${mesAno}`, "true");
        }

        showSuccessToast("Planejamentos excluídos com sucesso!");
        setIsDeleteModalOpen(false);
        setShowDeleteConfirm(false);
      }
    } catch (error: any) {
      console.error(error);
      showErrorToast(error.message || "Erro ao excluir planejamentos.");
    }
  };

  const formSubOptions = useMemo(() => {
    if (formParentId === UNSELECTED_VALUE) return [];
    const subs = subCategories.filter(s => s.parent_id === formParentId);
    if (editingItem) {
      return subs.filter(s => s.id === editingItem.categoria_id);
    }
    return subs;
  }, [formParentId, subCategories, editingItem]);

  const handleOpenEdit = (item: typeof calculatedOrcamentos[0]) => {
    setEditingItem(item);
    setFormParentId(item.parentCat?.id || UNSELECTED_VALUE);
    setFormSubId(item.categoria_id);

    const valorInicial = item.absoluto > 0 ? item.absoluto : item.gasto;
    setFormValor(valorInicial);

    setFormAbrangencia("current_month");
    setIsModalOpen(true);
  };

  const handleOpenAdd = () => {
    setEditingItem(null);
    setFormParentId(UNSELECTED_VALUE);
    setFormSubId(UNSELECTED_VALUE);
    setFormValor(undefined);
    setFormAbrangencia("current_month");
    setIsModalOpen(true);
  };

  const handleSubCategoryChange = (subId: string) => {
    setFormSubId(subId);

    if (subId === UNSELECTED_VALUE) {
      setFormValor(undefined);
      return;
    }

    const existingOrc = orcamentos.find(o => o.categoria_id === subId);
    if (existingOrc) {
      setFormValor(existingOrc.valor_planejado);
      return;
    }

    const calcCat = calculatedOrcamentos.find(c => c.categoria_id === subId);
    if (calcCat && calcCat.gasto > 0) {
      setFormValor(calcCat.gasto);
      return;
    }

    setFormValor(0);
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
        tipo_planejamento: "valor",
        valor_planejado: formValor,
        percentual_planejado: 0,
        applyToFuture: formAbrangencia === "future_months",
      });
      showSuccessToast("Planejamento salvo com sucesso!");
      setIsModalOpen(false);
    } catch (e: any) {
      showErrorToast("Erro ao salvar planejamento.");
    }
  };

  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [deleteValidationAlert, setDeleteValidationAlert] = useState<{
    open: boolean;
    type: "current" | "future";
    category?: string;
    parentCatName?: string;
    parentCatIcon?: string;
    month?: string;
    spent?: number;
  } | null>(null);
  const [isCheckingExpenses, setIsCheckingExpenses] = useState(false);

  const handleTriggerDelete = async () => {
    if (!editingItem) return;

    const subCatId = editingItem.categoria_id;
    const isFuture = formAbrangencia === "future_months";

    if (editingItem.gasto > 0) {
      setDeleteValidationAlert({
        open: true,
        type: "current",
        category: editingItem.subCat?.nome,
        parentCatName: editingItem.parentCat?.nome,
        parentCatIcon: editingItem.parentCat?.icone,
        month: format(new Date(mesAno + "-01T00:00:00"), "MMMM/yyyy", { locale: ptBR }),
        spent: editingItem.gasto
      });
      return;
    }

    if (!isFuture) {
      setIsConfirmDeleteOpen(true);
    } else {
      setIsCheckingExpenses(true);
      try {
        const nextMonthStart = format(addMonths(new Date(mesAno + "-01T00:00:00"), 1), "yyyy-MM-dd");

        const { data: despesas, error: despError } = await supabase
          .from("despesas")
          .select("id")
          .eq("user_id", user?.id)
          .eq("categoria_id", subCatId);

        if (despError) throw despError;

        if (despesas && despesas.length > 0) {
          const despesaIds = despesas.map((d: any) => d.id);

          const { data: parcelas, error: parcError } = await supabase
            .from("despesas_parcelas")
            .select("id")
            .in("despesa_id", despesaIds)
            .gte("vencimento", nextMonthStart)
            .limit(1);

          if (parcError) throw parcError;

          if (parcelas && parcelas.length > 0) {
            setDeleteValidationAlert({
              open: true,
              type: "future"
            });
            return;
          }
        }

        setIsConfirmDeleteOpen(true);
      } catch (err) {
        showErrorToast("Erro ao verificar lançamentos futuros.");
      } finally {
        setIsCheckingExpenses(false);
      }
    }
  };

  const handleDelete = async () => {
    if (!editingItem) return;
    try {
      await deleteOrcamento({
        id: editingItem.id,
        applyToFuture: formAbrangencia === "future_months",
        categoria_id: formSubId,
        mes_ano: mesAno,
      });
      showSuccessToast("Planejamento removido com sucesso.");
      setIsConfirmDeleteOpen(false);
      setIsModalOpen(false);
    } catch (e: any) {
      showErrorToast("Erro ao remover planejamento.");
    }
  };

  const navigate = useNavigate();

  const renderAccordionGroup = (group: any) => {
    const semPlanejamento = group.totalPlanejado <= 0;
    const excedido = group.totalGasto > group.totalPlanejado;
    const atingido = group.totalGasto === group.totalPlanejado && !semPlanejamento;
    const restante = group.totalPlanejado - group.totalGasto;
    const groupPctReceita = receitaPrevista > 0 ? Math.round(((semPlanejamento ? group.totalGasto : group.totalPlanejado) / receitaPrevista) * 100) : 0;
    const groupPctGasto = receitaPrevista > 0 ? Math.round((group.totalGasto / receitaPrevista) * 100) : 0;

    let pctVerde = 0;
    let pctRoxo = 0;
    let pctVermelho = 0;

    if (group.totalPlanejado > 0) {
      if (excedido) {
        pctVerde = 0;
        pctRoxo = (group.totalPlanejado / group.totalGasto) * 100;
        pctVermelho = ((group.totalGasto - group.totalPlanejado) / group.totalGasto) * 100;
      } else if (atingido) {
        pctVerde = 100;
        pctRoxo = 0;
      } else {
        pctVerde = (group.totalGasto / group.totalPlanejado) * 100;
        pctRoxo = ((group.totalPlanejado - group.totalGasto) / group.totalPlanejado) * 100;
      }
    }

    return (
      <AccordionItem
        key={group.parent.id}
        value={group.parent.id}
        className={cn(
          "border border-[#E2E8F0] bg-[#F7F9FC] rounded-2xl shadow-[0_2px_8px_rgba(15,23,42,0.04)] overflow-hidden transition-all duration-200",
          "data-[state=open]:bg-[#EAF2FF] data-[state=open]:border-[#C9DCFF]",
          isMobile ? "mb-[3px]" : "mb-0"
        )}
      >
        <AccordionTrigger
          className={cn(
            "group hover:no-underline hover:bg-transparent transition-colors",
            "[&[data-state=open]]:bg-transparent [&>svg]:w-5 [&>svg]:h-5 [&>svg]:text-slate-500 [&[data-state=open]>svg]:text-[#2563EB] [&>svg]:stroke-[4px]",
            isMobile ? "px-3 py-2.5" : "p-4"
          )}
        >
          <div className="flex flex-col w-full text-left">
            <div className={cn("flex items-center w-full", isMobile ? "gap-3 mb-2" : "gap-4 mb-4")}>
              <div className="flex items-center justify-center shrink-0 leading-none transition-all duration-200 group-data-[state=open]:drop-shadow-sm group-data-[state=open]:brightness-110">
                <DynamicIcon name={group.parent.icone || "Tag"} className={cn("leading-none", isMobile ? "text-[32px]" : "text-[38px]")} style={{ color: group.parent.cor }} />
              </div>
              <div className={cn("flex flex-col flex-1 min-w-0", isMobile ? "gap-0" : "gap-[2px]")}>
                <div className="flex justify-between items-center w-full">
                  <span className={cn(
                    "font-semibold group-data-[state=open]:font-bold transition-all text-[#112B5E] leading-none tracking-tight truncate pr-2",
                    isMobile ? "text-[16px]" : "text-[18px]"
                  )}>
                    {group.parent.nome}
                  </span>
                  <span className={cn("font-bold leading-none shrink-0", isMobile ? "text-[14px]" : "text-[15px]", excedido && !semPlanejamento ? "text-red-600" : "text-[#112B5E]")}>
                    {formatCurrency(group.totalGasto)}
                  </span>
                </div>
                <div className={cn("flex justify-between items-center w-full", isMobile ? "mt-0" : "mt-0.5")}>
                  <span className={cn("font-semibold leading-none truncate pr-2 text-[#1D6FF0]", isMobile ? "text-[12.5px]" : "text-[13.5px]")}>
                    {groupPctReceita}% da receita
                  </span>
                  <span className={cn("font-semibold leading-none shrink-0", isMobile ? "text-[11px]" : "text-[12px]",
                    semPlanejamento ? "text-slate-400" : (atingido || excedido) ? "text-purple-600" : "text-purple-500/75"
                  )}>
                    {semPlanejamento ? "Sem planejamento" : `de ${formatCurrency(group.totalPlanejado)}`}
                  </span>
                </div>
              </div>
            </div>

            <div className={cn("flex flex-col pr-1", isMobile ? "gap-2" : "gap-2.5")}>
              <div className="relative flex w-full rounded-full h-[8px] overflow-hidden" style={{ background: 'linear-gradient(180deg, #E2E8F0, #CBD5E1)' }}>
                <div className="absolute inset-0 rounded-full border border-slate-300/40 pointer-events-none z-30" style={{ boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.15)' }} />                            <div
                  className="h-full transition-all duration-500 relative z-10"
                  style={{ width: `${pctVerde}%`, background: atingido ? '#5A95F8' : '#43C47F', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.18), inset 0 -1px 0 rgba(0,0,0,.04)' }}
                />
                <div
                  className="h-full transition-all duration-500 relative z-0"
                  style={{ width: `${pctRoxo}%`, background: excedido ? '#9333EA' : '#C4B5FD', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.18), inset 0 -1px 0 rgba(0,0,0,.04)' }}
                />
                {excedido && (
                  <div
                    className="h-full transition-all duration-500 relative z-20"
                    style={{ width: `${pctVermelho}%`, background: 'linear-gradient(90deg, #EF4444, #DC2626)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.18), inset 0 -1px 0 rgba(0,0,0,.04)' }}
                  />
                )}
              </div>
              <div className={cn("flex justify-between items-center", isMobile ? "mt-0" : "mt-1")}>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 text-[11px] font-medium">{group.ativosCount} ativos | {groupPctGasto}% gasto</span>
                </div>

                {semPlanejamento ? null : excedido ? (
                  <span className={cn("inline-flex items-center justify-center px-3 py-[3px] leading-tight rounded-[26px] bg-red-100/80 text-red-700 border border-red-500/20 shadow-[0_2px_4px_rgba(239,68,68,0.08)] font-bold", isMobile ? "text-[10px]" : "text-[11px]")}>
                    Excedido em {formatCurrency(Math.abs(restante))}
                  </span>
                ) : atingido ? (
                  <span className={cn("font-semibold text-blue-500", isMobile ? "text-[12px]" : "text-[13px]")}>Planejamento atingido</span>
                ) : (
                  <span className={cn("font-semibold text-emerald-600", isMobile ? "text-[11px]" : "text-xs")}>Restam {formatCurrency(restante)}</span>
                )}
              </div>
            </div>
          </div>
        </AccordionTrigger>
        <AccordionContent className="border-t border-[#E5EEF8] bg-transparent px-2 pt-3 pb-2 mt-1">
          <div className="flex flex-col gap-[10px]">
            {group.items.map((item) => {
              const semPlanejamentoItem = item.absoluto <= 0;
              const itemExcedido = item.gasto > item.absoluto;
              const itemAtingido = item.gasto === item.absoluto && !semPlanejamentoItem;
              const itemRestante = item.absoluto - item.gasto;

              let itemPctVerde = 0;
              let itemPctRoxo = 0;
              let itemPctVermelho = 0;

              if (item.absoluto > 0) {
                if (itemExcedido) {
                  itemPctVerde = 0;
                  itemPctRoxo = (item.absoluto / item.gasto) * 100;
                  itemPctVermelho = ((item.gasto - item.absoluto) / item.gasto) * 100;
                } else if (itemAtingido) {
                  itemPctVerde = 100;
                  itemPctRoxo = 0;
                } else {
                  itemPctVerde = (item.gasto / item.absoluto) * 100;
                  itemPctRoxo = ((item.absoluto - item.gasto) / item.absoluto) * 100;
                }
              }

              return (
                <div
                  key={item.id}
                  onClick={() => handleOpenEdit(item)}
                  className={cn(
                    "flex flex-col w-full bg-[#FFFFFF] cursor-pointer",
                    "border border-[#D9E3F2] rounded-[16px] shadow-[0_3px_8px_rgba(15,23,42,0.06),inset_0_1px_0_rgba(255,255,255,0.9)]",
                    "transition-all duration-[180ms] ease-out",
                    isMobile ? "px-[14px] py-[11px]" : "p-[14px]",
                    !isMobile && "hover:bg-[#FAFCFF] hover:border-[#C9DBF5] hover:-translate-y-[1px]",
                    "active:shadow-[0_1px_2px_rgba(15,23,42,0.04),inset_0_1px_0_rgba(255,255,255,0.9)]",
                    isMobile && "active:scale-[0.98] active:transition-transform active:duration-[100ms] active:ease-out"
                  )}
                >
                  <div className="flex flex-col gap-1.5 w-full">
                    {/* Header da linha */}
                    <div className="flex items-center gap-3 w-full mt-0.5">
                      <DynamicIcon name={item.subCat?.icone || "Tag"} className="w-[30px] h-[30px] text-[30px] shrink-0" style={{ color: item.subCat?.cor }} />
                      <div className="flex flex-col flex-1 min-w-0 gap-[2px]">
                        <div className="flex justify-between items-center w-full">
                          <span className="font-bold text-[#112B5E] text-[14.5px] leading-none truncate pr-2">
                            {item.subCat?.nome}
                          </span>
                          <span className={cn("font-bold text-[14px] leading-none shrink-0", itemExcedido && !semPlanejamentoItem ? "text-red-600" : "text-[#112B5E]")}>
                            {formatCurrency(item.gasto)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center w-full">
                          <span className="font-semibold leading-none truncate pr-2 text-[12px] text-[#1D6FF0]">
                            {receitaPrevista > 0 ? Math.round(((semPlanejamentoItem ? item.gasto : item.absoluto) / receitaPrevista) * 100) : 0}% da receita
                          </span>
                          <span className={cn("font-semibold leading-none shrink-0 text-[10.5px]",
                            semPlanejamentoItem ? "text-slate-400" : ((itemAtingido || itemExcedido) ? "text-purple-600" : "text-purple-500/75")
                          )}>
                            {semPlanejamentoItem ? "Sem planejamento" : `de ${formatCurrency(item.absoluto)}`}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Progresso e Status */}
                    <div className="flex items-center gap-2.5 w-full mt-0.5">
                      <div className="relative flex flex-1 rounded-full h-[6px] overflow-hidden" style={{ background: 'linear-gradient(180deg, #E2E8F0, #CBD5E1)' }}>
                        <div className="absolute inset-0 rounded-full border border-slate-300/40 pointer-events-none z-30" style={{ boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.15)' }} />                                      <div
                          className="h-full transition-all duration-500 relative z-10"
                          style={{ width: `${itemPctVerde}%`, background: itemAtingido ? '#5A95F8' : '#43C47F', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.18), inset 0 -1px 0 rgba(0,0,0,.04)' }}
                        />
                        <div
                          className="h-full transition-all duration-500 relative z-0"
                          style={{ width: `${itemPctRoxo}%`, background: itemExcedido ? '#9333EA' : '#C4B5FD', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.18), inset 0 -1px 0 rgba(0,0,0,.04)' }}
                        />
                        {itemExcedido && (
                          <div
                            className="h-full transition-all duration-500 relative z-20"
                            style={{ width: `${itemPctVermelho}%`, background: 'linear-gradient(90deg, #EF4444, #DC2626)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.18), inset 0 -1px 0 rgba(0,0,0,.04)' }}
                          />
                        )}
                      </div>
                      {!semPlanejamentoItem ? (
                        <span className={cn(
                          "text-[11px] font-bold shrink-0",
                          itemExcedido ? "text-red-600" : itemAtingido ? "text-blue-500" : "text-emerald-600"
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
  };


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
          <div className="container-app relative z-10 pt-[28px] md:pt-[42px] flex justify-between items-start">            <div className="flex-1">
            <div className="flex flex-col items-start gap-1 w-full">
              <div className="flex items-center gap-2">
                <span className="text-[22px] select-none leading-none -mt-0.5">🧮</span>
                <h1 className="text-2xl font-extrabold text-[#112B5E] tracking-[0.5px] leading-none" style={{ fontFamily: "'Inter', sans-serif" }}>
                  Planejamento Mensal
                </h1>
                {renderPendingBell()}
              </div>
              {(() => {
                const disponivelPlanejamento = Math.max(0, totalPlanejado - totalRealizado);
                const isExcedidoReceita = totalRealizado > receitaPrevista;

                let pctAzulVisual = isExcedidoReceita ? 85 : (receitaPrevista > 0 ? Math.min(100, (totalRealizado / receitaPrevista) * 100) : 0);
                let pctRoxoVisual = isExcedidoReceita ? 0 : (receitaPrevista > 0 ? Math.min(100 - pctAzulVisual, (disponivelPlanejamento / receitaPrevista) * 100) : 0);
                let pctVermelhoVisual = isExcedidoReceita ? 15 : 0;

                return (
                  <div className="w-[280px] mt-[1px]">
                    <div
                      className="relative flex w-full rounded-full h-[11px] overflow-hidden"
                      style={{
                        background: "#D4DBE5",
                        boxShadow: "inset 0 3px 8px rgba(0,0,0,0.18), inset 0 -2px 4px rgba(255,255,255,0.55), 0 1px 2px rgba(0,0,0,0.08)",
                        border: "1px solid rgba(255,255,255,0.65)"
                      }}
                    >
                      <div className="absolute top-0 left-0 w-full h-full rounded-full pointer-events-none z-30" style={{ background: "linear-gradient(to bottom, rgba(255,255,255,0.18), transparent 35%)" }} />
                      <div
                        className="h-full transition-all duration-500 relative z-10"
                        style={{
                          width: `${pctAzulVisual}%`,
                          background: "linear-gradient(90deg, #1D4ED8, #2563EB, #3B82F6)",
                          boxShadow: "inset 0 2px 3px rgba(255,255,255,0.25), inset 0 -2px 3px rgba(0,0,0,0.08)"
                        }}
                      >
                      </div>
                      <div
                        className="h-full transition-all duration-500 relative z-0"
                        style={{
                          width: `${pctRoxoVisual}%`,
                          background: "linear-gradient(90deg, #9333EA, #A855F7, #C084FC)",
                          boxShadow: "inset 0 2px 3px rgba(255,255,255,0.25), inset 0 -2px 3px rgba(0,0,0,0.08)"
                        }}
                      />
                      {isExcedidoReceita && (
                        <div
                          className="h-full transition-all duration-500 relative z-20"
                          style={{
                            width: `${pctVermelhoVisual}%`,
                            background: "linear-gradient(180deg, #F87171 0%, #DC2626 45%, #B91C1C 100%)",
                            boxShadow: "inset 0 2px 3px rgba(255,255,255,0.25), inset 0 -2px 3px rgba(0,0,0,0.08)"
                          }}
                        />
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

            <div className="hidden md:flex items-center gap-3">
              <Button
                onClick={handleOpenDelete}
                className="h-[40px] px-5 rounded-[11px] font-bold text-[14px] text-red-600 bg-white border border-red-500/30 hover:bg-red-50 hover:border-red-500/50 transition-all flex items-center justify-center gap-2 mt-1 shadow-sm"
              >
                <Trash2 className="h-4 w-4" />
                Excluir Planejamento
              </Button>
              <Button
                onClick={handleOpenAdd}
                className="h-[40px] px-5 rounded-[11px] font-bold text-[15px] text-white border-none transition-all hover:-translate-y-[1px] active:translate-y-[1px] active:shadow-[0_3px_8px_rgba(0,0,0,0.4)] flex items-center justify-center gap-1 mt-1"
                style={{ background: "linear-gradient(135deg, #3B82F6, #2563EB, #1D4ED8)", borderBottom: "1px solid rgba(0,0,0,0.4)", boxShadow: "0 4px 12px rgba(0,0,0,.08), inset 0 1px 0 rgba(255,255,255,.25)", textShadow: "0 1px 1px rgba(0, 0, 0, 0.15)" }}
              >
                <span className="text-[18px] leading-none mb-[2px] font-medium">+</span>
                Novo Planejamento
              </Button>
            </div>
          </div>
        </div>
      )}
      <main
        className={cn("container-app flex-grow", isMobile ? "pt-0 pb-2" : "pt-0 pb-8 -mt-[86px] space-y-6")}
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
                onSelectMonth={setCurrentDate}
                isMobile={isMobile}
                onBack={undefined}
                backButtonColor="#1e3a8a"
              />
            </div>



            {/* Bloco Planejamento do Mês */}
            <div className="flex flex-col rounded-2xl shadow-[0_8px_24px_rgba(15,23,42,.06)] border border-slate-200/80 px-3 pb-3 pt-2 mb-4" style={{ background: "linear-gradient(180deg, #FFFFFF, #FAFBFD)" }}>
              <div className="flex items-start justify-between mb-2.5">
                <div className="flex items-start gap-1.5">
                  <span className="text-[1.2rem] select-none mt-[5px]">🧮</span>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <h2 className="text-[1.05rem] font-bold text-[#112B5E] tracking-[0.2px] leading-tight" style={{ fontFamily: "'Inter', sans-serif" }}>
                        Planejamento Mensal
                      </h2>
                      {renderPendingBell()}
                    </div>
                    <span className="text-[13px] font-medium text-slate-500 mt-[-5px] leading-tight">
                      {(new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(currentDate).replace(' de ', '/')).charAt(0).toUpperCase() + (new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(currentDate).replace(' de ', '/')).slice(1)}
                    </span>
                  </div>
                </div>

                <button
                  onClick={handleOpenDelete}
                  disabled={orcamentos.length === 0}
                  className="flex items-center justify-center text-red-500 transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:text-red-600 active:scale-95 mt-[8px]"
                  title={orcamentos.length === 0 ? "Nenhum planejamento para excluir" : "Excluir Planejamentos"}
                >
                  <Trash2 className="w-[18px] h-[18px]" strokeWidth={2.5} />
                </button>
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
                        <span className="font-bold text-[#1D6FF0] text-[15px] leading-tight mt-[1px]">{formatCurrency(totalRealizado)}</span>
                      </div>
                      <div className="flex flex-col items-end gap-0">
                        <span className="font-medium text-slate-500 text-[11px] leading-tight">Planejado</span>
                        <span className="font-bold text-purple-600 text-[15px] leading-tight mt-[1px]">{formatCurrency(totalPlanejado)}</span>
                      </div>
                    </div>

                    {/* Barra de Progresso Inteligente */}
                    <div
                      className="relative flex w-full rounded-full h-[26px] overflow-hidden mt-0.5 mb-1.5"
                      style={{
                        background: "#D4DBE5",
                        boxShadow: "inset 0 3px 8px rgba(0,0,0,0.18), inset 0 -2px 4px rgba(255,255,255,0.55), 0 1px 2px rgba(0,0,0,0.08)",
                        border: "1px solid rgba(255,255,255,0.65)"
                      }}
                    >
                      <div className="absolute top-0 left-0 w-full h-full rounded-full pointer-events-none z-30" style={{ background: "linear-gradient(to bottom, rgba(255,255,255,0.18), transparent 35%)" }} />
                      <div
                        className="h-full transition-all duration-500 relative z-10"
                        style={{
                          width: `${pctAzulVisual}%`,
                          background: "linear-gradient(180deg, #3EA0FF 0%, #1677FF 45%, #0F5FD7 100%)",
                          boxShadow: "inset 0 2px 3px rgba(255,255,255,0.25), inset 0 -2px 3px rgba(0,0,0,0.08)"
                        }}
                      />
                      <div
                        className="h-full transition-all duration-500 relative z-0"
                        style={{
                          width: `${pctRoxoVisual}%`,
                          background: "linear-gradient(180deg, #D8B4FE 0%, #C084FC 45%, #A855F7 100%)",
                          boxShadow: "inset 0 2px 3px rgba(255,255,255,0.25), inset 0 -2px 3px rgba(0,0,0,0.08)"
                        }}
                      />
                      {isExcedidoReceita && (
                        <div
                          className="h-full transition-all duration-500 relative z-20"
                          style={{
                            width: `${pctVermelhoVisual}%`,
                            background: "linear-gradient(180deg, #f87171 0%, #dc2626 45%, #991b1b 100%)",
                            boxShadow: "inset 0 2px 3px rgba(255,255,255,0.25), inset 0 -2px 3px rgba(0,0,0,0.08)"
                          }}
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
                        <span className="font-medium text-slate-500 text-[11px] leading-tight">Sem Planejamento</span>
                        <span className="font-bold text-slate-500 text-[13px] leading-tight mt-[1px]">{formatCurrency(saldoNaoPlanejado)}</span>
                      </div>
                    </div>

                    {/* Botão Novo Planejamento Mobile */}
                    <Button
                      onClick={handleOpenAdd}
                      className="h-[36px] w-full mt-1.5 px-0 rounded-[11px] font-bold text-sm text-white border-none transition-all hover:-translate-y-[1px] active:translate-y-[1px] active:shadow-[0_3px_8px_rgba(0,0,0,0.4)] flex items-center justify-center gap-1"
                      style={{ background: "linear-gradient(135deg, #3B82F6, #2563EB, #1D4ED8)", borderBottom: "1px solid rgba(0,0,0,0.4)", boxShadow: "0 4px 12px rgba(0,0,0,.08), inset 0 1px 0 rgba(255,255,255,.25)", textShadow: "0 1px 1px rgba(0, 0, 0, 0.15)" }}
                    >
                      <span className="text-[18px] leading-none mb-[2px] font-medium">+</span>
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
          <div className="relative flex flex-row justify-center items-center w-full shrink-0 -mt-[48px] mb-4 h-10">
            <MonthNavigator
              selectedMonth={currentDate}
              onPreviousMonth={() => setCurrentDate(subMonths(currentDate, 1))}
              onNextMonth={() => setCurrentDate(addMonths(currentDate, 1))}
              onSelectMonth={setCurrentDate}
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
                <span className="text-[12px] font-semibold text-[#1D6FF0] leading-none">
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
                <span className="text-[12px] font-semibold text-[#1D6FF0] leading-none">
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
                <span className="text-[12px] font-semibold text-[#1D6FF0] leading-none">
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
                <span className="text-[12px] font-semibold text-[#1D6FF0] leading-none">
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
              <span className="font-semibold text-slate-500 uppercase tracking-wider text-[11px] mb-1 pr-10">Saldo Sem Planejamento</span>
              <span className={cn("font-bold text-[1.15rem] leading-none", saldoPlanejado < 0 ? "text-red-600" : "text-slate-800")}>{formatCurrency(saldoPlanejado)}</span>
              <div className="mt-1.5">
                <span className="text-[12px] font-semibold text-[#1D6FF0] leading-none">
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
            <>
              <Accordion type="single" collapsible className={cn("w-full items-start", isMobile ? "grid grid-cols-1 gap-3" : "grid grid-cols-2 gap-3")}>

                {isMobile ? (
                  groupedOrcamentos.map((group) => renderAccordionGroup(group))
                ) : (
                  <>
                    <div className="flex flex-col gap-3 w-full">
                      {groupedOrcamentos.filter((_, i) => i % 2 === 0).map((group) => renderAccordionGroup(group))}
                    </div>
                    <div className="flex flex-col gap-3 w-full">
                      {groupedOrcamentos.filter((_, i) => i % 2 === 1).map((group) => renderAccordionGroup(group))}
                    </div>
                  </>
                )}
              </Accordion>
            </>
          )}
        </div>
      </main>



      {/* Modal de Inclusão / Edição */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent
          onOpenAutoFocus={(e) => e.preventDefault()}
          className={cn(
            isMobile ? "dialog-mobile w-[calc(100%-4px)] max-w-[calc(100%-4px)] !rounded-[19px] !px-3 !pb-[13px]" : "sm:max-w-[421px] sm:max-h-[90vh] overflow-y-auto !rounded-[19px] sm:!pb-[16px]",
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
                <DialogTitle className="text-[19px] md:text-[21px] font-extrabold text-[#112B5E] tracking-[0.2px] pb-[1px] m-0 leading-none text-left shrink truncate" style={{ fontFamily: "'Inter', sans-serif" }}>
                  {editingItem ? "Editar Planejamento" : "Novo Planejamento"}
                </DialogTitle>
              </div>
            </div>
          </DialogHeader>

          <div className={cn("flex flex-col gap-5", isMobile ? "pt-[36px]" : "pt-[2px]")}>
            {/* Categoria Pai */}
            <div className="space-y-1.5">
              <div className="flex items-center ml-1">
                <Label className="text-[14px] font-medium text-slate-600">Categoria principal</Label>
              </div>
              <Select
                value={formParentId}
                onValueChange={(val) => {
                  setFormParentId(val);
                  setFormSubId(UNSELECTED_VALUE);
                  setFormValor(undefined);
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
              <div className="flex items-center ml-1">
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
                  onValueChange={handleSubCategoryChange}
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
              <div className="flex items-center ml-1">
                <Label className="text-[14px] font-medium text-slate-600">Abrangência</Label>
              </div>
              <RadioGroup value={formAbrangencia} onValueChange={(val: "current_month" | "future_months") => setFormAbrangencia(val)} className="grid grid-cols-2 gap-2 md:gap-3">
                <div className={cn("relative flex items-center p-2 md:p-3 h-[42px] rounded-xl border cursor-pointer transition-all", formAbrangencia === "current_month" ? "border-[#2F6FED] bg-[#F5F9FF]" : "border-[#D7E1EE] bg-white hover:border-slate-300")} onClick={() => setFormAbrangencia("current_month")}>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="current_month" id="abr2" className="data-[state=checked]:after:bg-[#2F6FED] data-[state=checked]:border-[#2F6FED] text-[#2F6FED] shrink-0" />
                    <Label htmlFor="abr2" className="font-bold text-slate-700 cursor-pointer text-[12px] sm:text-sm leading-tight">Apenas este mês</Label>
                  </div>
                </div>
                <div className={cn("relative flex items-center p-2 md:p-3 h-[42px] rounded-xl border cursor-pointer transition-all", formAbrangencia === "future_months" ? "border-[#2F6FED] bg-[#F5F9FF]" : "border-[#D7E1EE] bg-white hover:border-slate-300")} onClick={() => setFormAbrangencia("future_months")}>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="future_months" id="abr1" className="data-[state=checked]:after:bg-[#2F6FED] data-[state=checked]:border-[#2F6FED] text-[#2F6FED] shrink-0" />
                    <Label htmlFor="abr1" className="font-bold text-slate-700 cursor-pointer text-[12px] sm:text-sm leading-tight">Aplicar aos próximos meses</Label>
                  </div>
                </div>
              </RadioGroup>
            </div>

            {/* Valor */}
            <div className="space-y-1.5">
              <div className="flex items-center ml-1">
                <Label className="text-[14px] font-medium text-slate-600">
                  Valor planejado
                </Label>
              </div>
              <CurrencyBR
                value={formValor || 0}
                onChange={setFormValor}
                className="h-[50px] md:h-[53px] text-[18px] font-semibold rounded-xl transition-all duration-200 shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] input-3d-premium input-white text-gray-800 disabled:opacity-75 disabled:bg-slate-50"
                placeholder="R$ 0,00"
              />
              {(() => {
                const valorEmReais = formValor || 0;
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
                    <span className="font-semibold text-[#1D6FF0]">
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
                  onClick={handleTriggerDelete}
                  className="w-full rounded-[14px] font-extrabold tracking-[0.2px] border border-slate-300 transition-all active:scale-95 text-[18px] h-[44px] flex items-center justify-center gap-[6px] bg-white text-red-500 hover:bg-slate-50"
                  disabled={isSaving || isCheckingExpenses}
                >
                  <Trash2 className="w-[18px] h-[18px]" strokeWidth={2.5} />
                  {isCheckingExpenses ? "Verificando..." : "Excluir"}
                </Button>
              )}
              <Button
                type="button"
                className="w-full rounded-[14px] font-extrabold tracking-[0.2px] text-white border-none transition-all active:scale-95 text-[18px] h-[44px] flex items-center justify-center gap-[6px] btn-3d-modal disabled:opacity-50 disabled:pointer-events-none"
                style={{ "--cor-topo": "#25AF6A", "--cor-base": "#1AA361" } as any}
                disabled={isSaving || isCheckingExpenses || (formParentId !== UNSELECTED_VALUE && formSubOptions.length === 0 && !editingItem)}
                onClick={handleSave}
              >
                {isSaving ? "Salvando..." : (
                  <>
                    <Save className="w-[18px] h-[18px]" strokeWidth={2.5} />
                    Salvar
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* EXCLUIR PLANEJAMENTO MODAL */}
      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent
          className={cn(
            isMobile ? "dialog-mobile w-[99%] max-w-[99%] !px-4 p-4 !pb-4 min-h-[300px] !rounded-[22px] shadow-none border-none" : "sm:max-w-[400px] !pb-5 !rounded-[22px] shadow-none border-none"
          )}
          style={{
            background: "linear-gradient(135deg, #ffffff 0%, #f9fafb 100%)",
            backgroundBlendMode: "soft-light",
            backdropFilter: "blur(6px)",
            border: "1px solid rgba(0,0,0,0.06)",
            boxShadow: "0 10px 40px -10px rgba(0,0,0,0.08), 0 0 0 1px rgba(255,255,255,0.5) inset"
          }}
        >
          <DialogHeader className={cn("flex flex-row items-center justify-between !text-left !mt-0 relative pb-2", isMobile ? "!mb-3" : "!mb-4")} style={{ borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
            <div className="flex flex-col w-full transition-all gap-[3px] md:gap-0 pr-6">
              <div className="flex flex-row items-center justify-start gap-3 w-full">
                <DialogTitle className="text-[19px] md:text-[21px] font-extrabold text-[#ef4444]/90 tracking-[0.2px] pb-[1px] m-0 leading-none text-left shrink truncate" style={{ fontFamily: "'Inter', sans-serif" }}>
                  Excluir Planejamentos
                </DialogTitle>
              </div>
              <p className="text-[13px] text-slate-500 font-medium leading-snug mt-2">
                Remova os valores planejados do período selecionado. Os gastos já registrados permanecerão intactos.
              </p>
            </div>
          </DialogHeader>

          <div className="flex flex-col gap-5 w-full">
            <div className="grid gap-3 w-full mt-2">
              <Label className="font-bold text-[13px] text-slate-700 ml-1">Abrangência da Exclusão <span className="text-red-500">*</span></Label>
              <RadioGroup
                value={deleteApplyToFuture ? "future_months" : "current_month"}
                onValueChange={(val) => setDeleteApplyToFuture(val === "future_months")}
                className="flex flex-col gap-3"
              >
                <div className={cn(
                  "flex items-center space-x-3 border p-3.5 rounded-2xl cursor-pointer transition-all duration-200",
                  !deleteApplyToFuture ? "border-red-500 bg-red-50/50 shadow-sm" : "border-slate-200 hover:border-slate-300 bg-white"
                )}
                  onClick={() => setDeleteApplyToFuture(false)}>
                  <RadioGroupItem value="current_month" id="del-current" className={cn("w-5 h-5", !deleteApplyToFuture ? "text-red-500 border-red-500 after:bg-red-500" : "border-slate-300")} />
                  <div className="flex flex-col flex-1 leading-tight gap-1">
                    <Label htmlFor="del-current" className={cn("font-bold cursor-pointer text-[14px]", !deleteApplyToFuture ? "text-red-500" : "text-slate-700")}>Excluir somente este mês</Label>
                  </div>
                </div>

                <div className={cn(
                  "flex items-center space-x-3 border p-3.5 rounded-2xl cursor-pointer transition-all duration-200",
                  deleteApplyToFuture ? "border-red-500 bg-red-50/50 shadow-sm" : "border-slate-200 hover:border-slate-300 bg-white"
                )}
                  onClick={() => setDeleteApplyToFuture(true)}>
                  <RadioGroupItem value="future_months" id="del-future" className={cn("w-5 h-5", deleteApplyToFuture ? "text-red-500 border-red-500 after:bg-red-500" : "border-slate-300")} />
                  <div className="flex flex-col flex-1 leading-tight gap-1">
                    <Label htmlFor="del-future" className={cn("font-bold cursor-pointer text-[14px]", deleteApplyToFuture ? "text-red-500" : "text-slate-700")}>Aplicar aos próximos meses</Label>
                  </div>
                </div>
              </RadioGroup>
            </div>



            <div className="grid gap-2 w-full pt-1">
              <Button
                type="button"
                className="w-full rounded-[14px] font-extrabold tracking-[0.2px] text-white border-none transition-all active:scale-95 text-[18px] h-[44px] flex items-center justify-center gap-[6px] btn-3d-modal disabled:opacity-50 disabled:pointer-events-none"
                style={{ "--cor-topo": "#EF4444", "--cor-base": "#DC2626" } as any}
                disabled={isDeletingMass || isLoadingDeleteCount}
                onClick={handleTriggerDeleteMass}
              >
                {isDeletingMass ? "Excluindo..." : (
                  <>
                    <Trash2 className="w-[18px] h-[18px]" strokeWidth={2.5} />
                    Excluir Planejamentos
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="sm:max-w-[400px] !rounded-[22px] dialog-mobile w-[96%] max-w-[96%] border-none shadow-xl bg-white p-6">
          <AlertDialogHeader className="mb-2">
            <AlertDialogTitle className="flex items-center justify-center gap-2 text-xl font-bold text-slate-800 tracking-tight leading-tight m-0">
              <DynamicIcon name="AlertTriangle" className="h-[24px] w-[24px] text-amber-500" />
              Atenção
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center text-slate-600 text-[15px] font-medium leading-relaxed mt-2">
              Esta ação removerá apenas os valores planejados.<br /><br />
              Nenhuma despesa, parcelamento ou lançamento financeiro será excluído.<br /><br />
              Deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex items-center gap-3 w-full mt-4">
            <AlertDialogCancel
              className="w-full rounded-[14px] font-extrabold tracking-[0.2px] border border-slate-300 transition-all active:scale-95 text-[18px] h-[44px] flex items-center justify-center gap-[6px] bg-white text-slate-600 hover:bg-slate-50 m-0"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDeleteMass(); }}
              className="w-full rounded-[14px] font-extrabold tracking-[0.2px] text-white border-none transition-all active:scale-95 text-[18px] h-[44px] flex items-center justify-center gap-[6px] btn-3d-modal m-0"
              style={{ "--cor-topo": "#EF4444", "--cor-base": "#DC2626" } as any}
            >
              {isDeletingMass ? "Aguarde..." : (
                <>
                  <Trash2 className="w-[18px] h-[18px]" strokeWidth={2.5} />
                  Excluir
                </>
              )}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Validation Alert */}
      <AlertDialog open={deleteValidationAlert?.open || false} onOpenChange={(open) => !open && setDeleteValidationAlert(null)}>
        <AlertDialogContent
          className={cn("sm:max-w-[340px] !p-5 !pb-4 !rounded-2xl shadow-lg border border-[#DCE8F7] dialog-mobile w-[96%] max-w-[96%]")}
          style={{ backgroundColor: "#F5F9FF" }}
        >
          <AlertDialogHeader className="text-center space-y-3">
            <AlertDialogTitle className="flex items-center justify-center gap-2 text-[19px] font-black text-red-600 m-0 leading-none">
              <DynamicIcon name="AlertTriangle" className="h-[22px] w-[22px]" />
              Exclusão Bloqueada
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center flex flex-col gap-3 text-slate-700 m-0">
              <p className="text-[14px] leading-[1.3] m-0 font-medium">
                {deleteValidationAlert?.type === "current"
                  ? "Existem gastos registrados nesta subcategoria."
                  : "Foram encontrados gastos vinculados a esta subcategoria em períodos futuros."}
              </p>

              {deleteValidationAlert?.type === "current" && (
                <div className="flex flex-col mt-1 gap-2">
                  {/* Informações da Subcategoria */}
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-[20px] leading-none">🛒</span>
                    <span className="font-[700] text-[17px] text-slate-800 tracking-tight">{deleteValidationAlert.category}</span>
                  </div>

                  {/* Valor Gasto */}
                  <div className="flex flex-col items-center justify-center">
                    <span className="font-black text-red-600 text-[28px] leading-none tracking-tight mb-0.5">
                      {deleteValidationAlert.spent !== undefined ? formatCurrency(deleteValidationAlert.spent) : 'R$ 0,00'}
                    </span>
                    <span className="text-[14px] text-slate-500 font-medium">
                      Valor já gasto em <span className="capitalize">{deleteValidationAlert.month}</span>
                    </span>
                  </div>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-0 flex justify-center sm:justify-center w-full">
            <AlertDialogCancel
              className="w-[85%] max-w-[280px] rounded-[14px] font-extrabold tracking-[0.2px] text-white border-none transition-all active:scale-95 text-[18px] h-[44px] flex items-center justify-center btn-3d-modal m-0 mx-auto"
              style={{ "--cor-topo": "#3B82F6", "--cor-base": "#2563EB" } as any}
            >
              Entendi
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
              {formAbrangencia === "future_months"
                ? "Deseja excluir este planejamento deste mês e de todos os meses futuros?"
                : "Deseja excluir este planejamento apenas do mês atual?"}
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
