import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import DynamicIcon from "@/components/DynamicIcon";
import { Footer } from "@/components/Footer";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Meta, AppCategory } from "@/types/finance";
import { cn, getBorderClass, formatCurrency } from "@/lib/utils";
import { format, addMonths, differenceInMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import CurrencyBR from "@/components/ui/currency-br";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useProfile } from "@/hooks/useProfile";
import { getCategoryColor } from "@/lib/categoryColors";
import EmojiPicker, { EmojiClickData } from "emoji-picker-react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

const UNSELECTED_VALUE = "unselected";
const toastDuration = 1000;
const toastSuccessStyle = { backgroundColor: '#FFFFFF', color: '#006000', border: '1px solid #E5FFE5' };
const toastErrorStyle = { backgroundColor: '#FFFFFF', color: '#FF2929', border: '1px solid #FFE5E5' };

export default function Metas() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const { data: profile } = useProfile(user?.id);
  const isExpired = profile?.isExpired;

  // Form states
  const [selectedParentId, setSelectedParentId] = useState(UNSELECTED_VALUE);
  const [nomeMeta, setNomeMeta] = useState("");
  const [icone, setIcone] = useState("🎯");
  const [valorObjetivo, setValorObjetivo] = useState<number | undefined>(undefined);
  const [valorMensal, setValorMensal] = useState<number | undefined>(undefined);
  const [dataLimite, setDataLimite] = useState<Date | undefined>(undefined);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [loadingForm, setLoadingForm] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, boolean>>({});

  // Edit states
  const [editingMeta, setEditingMeta] = useState<(Meta & { subcategoria?: AppCategory }) | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editSelectedParentId, setEditSelectedParentId] = useState(UNSELECTED_VALUE);
  const [editNomeMeta, setEditNomeMeta] = useState("");
  const [editIcone, setEditIcone] = useState("🎯");
  const [editValorObjetivo, setEditValorObjetivo] = useState<number | undefined>(undefined);
  const [editValorMensal, setEditValorMensal] = useState<number | undefined>(undefined);
  const [editDataLimite, setEditDataLimite] = useState<Date | undefined>(undefined);
  const [isEditCalendarOpen, setIsEditCalendarOpen] = useState(false);
  const [showEditEmojiPicker, setShowEditEmojiPicker] = useState(false);
  const [editValidationErrors, setEditValidationErrors] = useState<Record<string, boolean>>({});

  // Delete states
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [metaToDelete, setMetaToDelete] = useState<(Meta & { subcategoria?: AppCategory }) | null>(null);
  const [deleteHasDependencies, setDeleteHasDependencies] = useState(false);

  // Fetch all categories
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

  const parentCategories = useMemo(() => {
    return allCategories.filter(c => c.parent_id === null && !["receitas", "investimentos", "receitas e investimentos"].includes(c.nome.toLowerCase()));
  }, [allCategories]);

  // Fetch metas
  const { data: metas = [], isLoading: isLoadingMetas } = useQuery<Meta[]>({
    queryKey: ["metas", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("metas")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Meta[];
    },
    enabled: !!user,
  });

  // Fetch valor realizado for all metas (aggregated query)
  const metaCategoriaIds = useMemo(() => metas.map(m => m.categoria_id), [metas]);

  const { data: realizadoMap = {} } = useQuery<Record<string, number>>({
    queryKey: ["metas-realizado", user?.id, metaCategoriaIds],
    queryFn: async () => {
      if (!user?.id || metaCategoriaIds.length === 0) return {};
      
      // Buscar todas as despesas vinculadas às subcategorias das metas
      const { data: despesas, error: despError } = await supabase
        .from("despesas")
        .select("id, categoria_id")
        .eq("user_id", user.id)
        .in("categoria_id", metaCategoriaIds);
      
      if (despError) throw despError;
      if (!despesas || despesas.length === 0) return {};

      const despesaIds = despesas.map(d => d.id);
      
      // Buscar todas as parcelas pagas dessas despesas
      const { data: parcelas, error: parcError } = await supabase
        .from("despesas_parcelas")
        .select("despesa_id, valor_parcela")
        .in("despesa_id", despesaIds)
        .eq("pago", true);

      if (parcError) throw parcError;
      if (!parcelas || parcelas.length === 0) return {};

      // Mapear despesa_id → categoria_id
      const despesaCategoriaMap: Record<string, string> = {};
      despesas.forEach(d => {
        if (d.categoria_id) despesaCategoriaMap[d.id] = d.categoria_id;
      });

      // Agrupar por categoria_id
      const result: Record<string, number> = {};
      parcelas.forEach(p => {
        const catId = despesaCategoriaMap[p.despesa_id];
        if (catId) {
          result[catId] = (result[catId] || 0) + Number(p.valor_parcela);
        }
      });

      return result;
    },
    enabled: !!user && metaCategoriaIds.length > 0,
  });

  // Build calculated metas with subcategoria info
  const calculatedMetas = useMemo(() => {
    return metas.map(meta => {
      const subcategoria = allCategories.find(c => c.id === meta.categoria_id);
      const parentCat = subcategoria ? allCategories.find(c => c.id === subcategoria.parent_id) : null;
      const realizado = realizadoMap[meta.categoria_id] || 0;
      const restante = Math.max(0, meta.valor_objetivo - realizado);
      const percentual = meta.valor_objetivo > 0 ? Math.min(100, (realizado / meta.valor_objetivo) * 100) : 0;
      const concluida = percentual >= 100;

      // Previsão
      const mesesRestantes = meta.valor_mensal > 0 ? Math.ceil(restante / meta.valor_mensal) : null;
      const dataCriacao = meta.created_at ? new Date(meta.created_at) : new Date();
      const previsaoConclusao = mesesRestantes !== null ? addMonths(dataCriacao, Math.ceil(meta.valor_objetivo / meta.valor_mensal)) : null;
      
      // Previsão baseada no restante
      const previsaoRestante = mesesRestantes !== null ? addMonths(new Date(), mesesRestantes) : null;

      // Data limite analysis
      let valorMensalNecessario: number | null = null;
      let ritmoSuficiente: boolean | null = null;
      if (meta.data_limite) {
        const limite = new Date(meta.data_limite + "T12:00:00");
        const mesesAteLimite = Math.max(1, differenceInMonths(limite, new Date()));
        valorMensalNecessario = restante / mesesAteLimite;
        ritmoSuficiente = meta.valor_mensal >= valorMensalNecessario;
      }

      // Realizado mensal médio
      const mesesDesdeInicio = Math.max(1, differenceInMonths(new Date(), dataCriacao));
      const realizadoMensal = realizado / mesesDesdeInicio;

      return {
        ...meta,
        subcategoria,
        parentCat,
        realizado,
        restante,
        percentual,
        concluida,
        mesesRestantes,
        previsaoRestante,
        valorMensalNecessario,
        ritmoSuficiente,
        realizadoMensal,
      };
    });
  }, [metas, allCategories, realizadoMap]);

  // Stats
  const stats = useMemo(() => {
    const ativas = calculatedMetas.filter(m => !m.concluida).length;
    const concluidas = calculatedMetas.filter(m => m.concluida).length;
    const totalObjetivo = calculatedMetas.reduce((s, m) => s + m.valor_objetivo, 0);
    const totalRealizado = calculatedMetas.reduce((s, m) => s + m.realizado, 0);
    const progressoGeral = totalObjetivo > 0 ? Math.min(100, (totalRealizado / totalObjetivo) * 100) : 0;
    return { ativas, concluidas, totalObjetivo, totalRealizado, progressoGeral };
  }, [calculatedMetas]);

  // Próxima conquista (meta ativa mais perto de 100%)
  const proximaConquista = useMemo(() => {
    const ativas = calculatedMetas.filter(m => !m.concluida && m.percentual > 0);
    if (ativas.length === 0) return null;
    return ativas.sort((a, b) => b.percentual - a.percentual)[0];
  }, [calculatedMetas]);

  // Mutations
  const addMetaMutation = useMutation({
    mutationFn: async (params: { parentId: string; nome: string; icone: string; valorObjetivo: number; valorMensal: number; dataLimite?: string | null }) => {
      if (!user?.id) throw new Error("Usuário não autenticado.");
      
      const parent = allCategories.find(c => c.id === params.parentId);
      if (!parent) throw new Error("Categoria principal não encontrada.");

      // Verificar duplicidade
      const existingSub = allCategories.find(c => 
        c.parent_id === params.parentId && 
        c.nome.toLowerCase() === params.nome.toLowerCase() &&
        (c.user_id === user.id || c.user_id === null)
      );
      if (existingSub) throw new Error(`Já existe uma subcategoria "${params.nome}" nesta categoria.`);

      // 1. Criar subcategoria
      const subId = crypto.randomUUID();
      const corHerdada = getCategoryColor(parent, allCategories);
      const { error: subError } = await supabase
        .from("categorias")
        .insert({
          id: subId,
          nome: params.nome.trim(),
          icone: params.icone,
          cor: corHerdada,
          parent_id: params.parentId,
          user_id: user.id,
          forma_pagamento: null,
        });
      
      if (subError) throw subError;

      // 2. Criar meta
      const { error: metaError } = await supabase
        .from("metas")
        .insert({
          user_id: user.id,
          categoria_id: subId,
          valor_objetivo: params.valorObjetivo,
          valor_mensal: params.valorMensal,
          data_limite: params.dataLimite || null,
        });

      if (metaError) {
        // Rollback: remover subcategoria órfã
        await supabase.from("categorias").delete().eq("id", subId);
        throw metaError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["metas", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["categories", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["metas-realizado", user?.id] });
      toast.success("Meta criada com sucesso!", { style: toastSuccessStyle, duration: toastDuration });
      // Reset form
      setSelectedParentId(UNSELECTED_VALUE);
      setNomeMeta("");
      setIcone("🎯");
      setValorObjetivo(undefined);
      setValorMensal(undefined);
      setDataLimite(undefined);
      setValidationErrors({});
    },
    onError: (error) => {
      toast.error("Erro ao criar meta", { description: error.message, duration: toastDuration, style: toastErrorStyle });
    },
    onSettled: () => setLoadingForm(false),
  });

  const updateMetaMutation = useMutation({
    mutationFn: async (params: { metaId: string; categoriaId: string; nome: string; icone: string; parentId: string; valorObjetivo: number; valorMensal: number; dataLimite?: string | null }) => {
      if (!user?.id) throw new Error("Usuário não autenticado.");

      // Atualizar subcategoria (nome e ícone)
      const parent = allCategories.find(c => c.id === params.parentId);
      const corHerdada = parent ? getCategoryColor(parent, allCategories) : "hsl(210, 70%, 50%)";
      
      const { error: subError } = await supabase
        .from("categorias")
        .update({
          nome: params.nome.trim(),
          icone: params.icone,
          cor: corHerdada,
          parent_id: params.parentId,
        })
        .eq("id", params.categoriaId);
      
      if (subError) throw subError;

      // Atualizar meta
      const { error: metaError } = await supabase
        .from("metas")
        .update({
          valor_objetivo: params.valorObjetivo,
          valor_mensal: params.valorMensal,
          data_limite: params.dataLimite || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", params.metaId);

      if (metaError) throw metaError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["metas", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["categories", user?.id] });
      toast.success("Meta atualizada!", { style: toastSuccessStyle, duration: toastDuration });
      setIsEditModalOpen(false);
      setEditingMeta(null);
    },
    onError: (error) => {
      toast.error("Erro ao atualizar meta", { description: error.message, duration: toastDuration, style: toastErrorStyle });
    },
  });

  const deleteMetaMutation = useMutation({
    mutationFn: async (params: { metaId: string; categoriaId: string; deleteSubcategoria: boolean }) => {
      if (!user?.id) throw new Error("Usuário não autenticado.");

      // 1. Excluir a meta
      const { error: metaError } = await supabase
        .from("metas")
        .delete()
        .eq("id", params.metaId);
      if (metaError) throw metaError;

      // 2. Se não houver dependências, excluir a subcategoria
      if (params.deleteSubcategoria) {
        const { error: subError } = await supabase
          .from("categorias")
          .delete()
          .eq("id", params.categoriaId);
        if (subError) {
          console.warn("Subcategoria não pôde ser excluída (pode ter dependências):", subError.message);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["metas", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["categories", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["metas-realizado", user?.id] });
      toast.success("Meta excluída!", { style: toastSuccessStyle, duration: toastDuration });
      setIsConfirmDeleteOpen(false);
      setMetaToDelete(null);
    },
    onError: (error) => {
      toast.error("Erro ao excluir meta", { description: error.message, duration: toastDuration, style: toastErrorStyle });
      setIsConfirmDeleteOpen(false);
    },
  });

  // Handlers
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingForm(true);

    const newErrors: Record<string, boolean> = {};
    let hasError = false;

    if (!selectedParentId || selectedParentId === UNSELECTED_VALUE) { newErrors.selectedParentId = true; hasError = true; }
    if (!nomeMeta.trim()) { newErrors.nomeMeta = true; hasError = true; }
    if (valorObjetivo === undefined || valorObjetivo <= 0) { newErrors.valorObjetivo = true; hasError = true; }
    if (valorMensal === undefined || valorMensal <= 0) { newErrors.valorMensal = true; hasError = true; }

    setValidationErrors(newErrors);
    if (hasError) {
      toast.error("Preencha todos os campos obrigatórios", { duration: toastDuration, style: toastErrorStyle });
      setLoadingForm(false);
      return;
    }

    addMetaMutation.mutate({
      parentId: selectedParentId,
      nome: nomeMeta,
      icone,
      valorObjetivo: valorObjetivo!,
      valorMensal: valorMensal!,
      dataLimite: dataLimite ? format(dataLimite, "yyyy-MM-dd") : null,
    });
  };

  const handleBlockedClick = (e: React.MouseEvent) => {
    e.preventDefault();
    toast.error("🔒 Sua assinatura expirou. Renove para voltar a editar seus dados.", { duration: 2000, style: toastErrorStyle });
  };

  const handleEditClick = (meta: typeof calculatedMetas[0]) => {
    setEditingMeta(meta);
    setEditSelectedParentId(meta.subcategoria?.parent_id || UNSELECTED_VALUE);
    setEditNomeMeta(meta.subcategoria?.nome || "");
    setEditIcone(meta.subcategoria?.icone || "🎯");
    setEditValorObjetivo(meta.valor_objetivo);
    setEditValorMensal(meta.valor_mensal);
    setEditDataLimite(meta.data_limite ? new Date(meta.data_limite + "T12:00:00") : undefined);
    setEditValidationErrors({});
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = () => {
    if (!editingMeta) return;
    const newErrors: Record<string, boolean> = {};
    let hasError = false;

    if (!editSelectedParentId || editSelectedParentId === UNSELECTED_VALUE) { newErrors.editSelectedParentId = true; hasError = true; }
    if (!editNomeMeta.trim()) { newErrors.editNomeMeta = true; hasError = true; }
    if (editValorObjetivo === undefined || editValorObjetivo <= 0) { newErrors.editValorObjetivo = true; hasError = true; }
    if (editValorMensal === undefined || editValorMensal <= 0) { newErrors.editValorMensal = true; hasError = true; }

    setEditValidationErrors(newErrors);
    if (hasError) {
      toast.error("Preencha todos os campos obrigatórios", { duration: toastDuration, style: toastErrorStyle });
      return;
    }

    updateMetaMutation.mutate({
      metaId: editingMeta.id,
      categoriaId: editingMeta.categoria_id,
      nome: editNomeMeta,
      icone: editIcone,
      parentId: editSelectedParentId,
      valorObjetivo: editValorObjetivo!,
      valorMensal: editValorMensal!,
      dataLimite: editDataLimite ? format(editDataLimite, "yyyy-MM-dd") : null,
    });
  };

  const handleDeleteClick = async (meta: typeof calculatedMetas[0]) => {
    // Verificar dependências
    const { count, error } = await supabase
      .from("despesas")
      .select("id", { count: "exact", head: true })
      .eq("categoria_id", meta.categoria_id);
    
    const hasDeps = !error && (count || 0) > 0;
    setDeleteHasDependencies(hasDeps);
    setMetaToDelete(meta);
    setIsConfirmDeleteOpen(true);
  };

  const handleConfirmDelete = () => {
    if (!metaToDelete) return;
    deleteMetaMutation.mutate({
      metaId: metaToDelete.id,
      categoriaId: metaToDelete.categoria_id,
      deleteSubcategoria: !deleteHasDependencies,
    });
  };

  // Chart data
  const chartData = useMemo(() => {
    if (stats.totalObjetivo === 0) return [];
    return [
      { name: "Realizado", value: stats.totalRealizado, color: "#22c55e" },
      { name: "Restante", value: Math.max(0, stats.totalObjetivo - stats.totalRealizado), color: "#e2e8f0" },
    ];
  }, [stats]);

  // Loading state
  if (isLoadingMetas || isLoadingCategories) {
    return (
      <div className="flex-grow flex items-center justify-center min-h-[400px]">
        <div className="animate-pulse text-muted-foreground">Carregando Metas...</div>
      </div>
    );
  }

  // Card style reusable
  const cardStyle = {
    background: "linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 60%, rgba(234, 88, 12, 0.12) 100%)",
    backgroundBlendMode: "soft-light" as const,
    backdropFilter: "blur(6px)",
    outline: "1px solid rgba(234, 88, 12, 0.08)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.6), inset 0 -8px 20px rgba(0,0,0,0.03), inset 0 0 18px rgba(234, 88, 12, 0.10)"
  };

  const accentColor = "#C2410C"; // Orange-700 for Metas
  const accentColorLight = "#FFEDD5"; // Orange-100

  // Render form fields (shared between create + edit)
  const renderFormFields = (
    parentId: string, setParentIdFn: (v: string) => void,
    nome: string, setNomeFn: (v: string) => void,
    currentIcone: string, setIconeFn: (v: string) => void,
    vObj: number | undefined, setVObjFn: (v: number) => void,
    vMen: number | undefined, setVMenFn: (v: number) => void,
    dLim: Date | undefined, setDLimFn: (v: Date | undefined) => void,
    calOpen: boolean, setCalOpenFn: (v: boolean) => void,
    emojiOpen: boolean, setEmojiOpenFn: (v: boolean) => void,
    errors: Record<string, boolean>, setErrorsFn: (v: Record<string, boolean>) => void,
    fieldPrefix: string
  ) => (
    <>
      {/* Categoria */}
      <div className="space-y-[6px]">
        <Label className={cn("text-[#283c5a]", isMobile && "text-xs")}>Categoria</Label>
        <Select
          value={parentId}
          onValueChange={(v) => { setParentIdFn(v); setErrorsFn({ ...errors, [`${fieldPrefix}selectedParentId`]: false }); }}
        >
          <SelectTrigger className={cn(
            "rounded-xl input-3d-premium input-white font-bold transition-all duration-200",
            parentId === UNSELECTED_VALUE && "text-gray-400",
            isMobile && "h-9 text-sm",
            getBorderClass({ isInvalid: errors[`${fieldPrefix}selectedParentId`], isValid: errors[`${fieldPrefix}selectedParentId`] === false, variant: "green" })
          )}>
            <SelectValue placeholder="Selecione a categoria" />
          </SelectTrigger>
          <SelectContent className="rounded-2xl border-none shadow-xl w-[var(--radix-select-trigger-width)]">
            <SelectItem value={UNSELECTED_VALUE} disabled className={cn(isMobile && "text-sm")}>Selecione a categoria</SelectItem>
            {parentCategories.map(cat => (
              <SelectItem key={cat.id} value={cat.id} className={cn(isMobile && "text-sm")}>
                <span className="flex items-center gap-2">
                  <DynamicIcon name={cat.icone} className="h-4 w-4" />
                  <span>{cat.nome}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Nome da Meta + Ícone */}
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <div className="space-y-[6px]">
          <Label className={cn("text-[#283c5a]", isMobile && "text-xs")}>Nome da Meta</Label>
          <Input
            value={nome}
            onChange={(e) => { setNomeFn(e.target.value); setErrorsFn({ ...errors, [`${fieldPrefix}nomeMeta`]: false }); }}
            placeholder="Ex: Trocar de carro"
            className={cn(
              "rounded-xl input-3d-premium input-white font-bold transition-all duration-200",
              isMobile && "h-9 text-sm",
              getBorderClass({ isInvalid: errors[`${fieldPrefix}nomeMeta`], isValid: errors[`${fieldPrefix}nomeMeta`] === false, variant: "green" })
            )}
          />
        </div>
        <div className="space-y-[6px]">
          <Label className={cn("text-[#283c5a]", isMobile && "text-xs")}>Ícone</Label>
          <Button
            type="button"
            variant="outline"
            onClick={() => setEmojiOpenFn(true)}
            className={cn(
              "rounded-xl input-3d-premium input-white font-bold transition-all duration-200 text-2xl px-3",
              isMobile ? "h-9 w-12" : "h-10 w-14"
            )}
          >
            {currentIcone}
          </Button>
        </div>
      </div>

      {/* Emoji Picker Modal */}
      <Dialog open={emojiOpen} onOpenChange={setEmojiOpenFn}>
        <DialogContent
          className={cn(
            "p-0 overflow-hidden flex flex-col gap-0 !rounded-[28px] !border-2 !border-white shadow-2xl",
            isMobile ? "w-[98vw] max-w-full" : "sm:max-w-[850px]"
          )}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="h-14 flex items-center justify-center border-b bg-gray-50/50">
            <DialogTitle className="font-black text-center text-lg">
              Escolha um Ícone
            </DialogTitle>
          </div>
          <div className="p-2 bg-white flex justify-center">
            <EmojiPicker
              onEmojiClick={(emojiData: EmojiClickData) => { setIconeFn(emojiData.emoji); setEmojiOpenFn(false); }}
              width="100%"
              height={isMobile ? 440 : 480}
              autoFocusSearch={false}
              searchDisabled={false}
              previewConfig={{ showPreview: false }}
              skinTonesDisabled={true}
              searchPlaceholder="Buscar..."
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Valores */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-[6px]">
          <Label className={cn("text-[#283c5a]", isMobile && "text-xs")}>Valor da Meta (R$)</Label>
          <CurrencyBR
            value={vObj}
            onChange={(v) => { setVObjFn(v); setErrorsFn({ ...errors, [`${fieldPrefix}valorObjetivo`]: false }); }}
            className={cn(
              "rounded-xl input-3d-premium input-white font-bold px-3 transition-all duration-200",
              isMobile && "h-9 text-sm",
              getBorderClass({ isInvalid: errors[`${fieldPrefix}valorObjetivo`], isValid: errors[`${fieldPrefix}valorObjetivo`] === false, variant: "green" })
            )}
          />
        </div>
        <div className="space-y-[6px]">
          <Label className={cn("text-[#283c5a]", isMobile && "text-xs")}>Valor Mensal (R$)</Label>
          <CurrencyBR
            value={vMen}
            onChange={(v) => { setVMenFn(v); setErrorsFn({ ...errors, [`${fieldPrefix}valorMensal`]: false }); }}
            className={cn(
              "rounded-xl input-3d-premium input-white font-bold px-3 transition-all duration-200",
              isMobile && "h-9 text-sm",
              getBorderClass({ isInvalid: errors[`${fieldPrefix}valorMensal`], isValid: errors[`${fieldPrefix}valorMensal`] === false, variant: "green" })
            )}
          />
        </div>
      </div>

      {/* Data Limite (Opcional) */}
      <div className="space-y-[6px]">
        <Label className={cn("text-[#283c5a]", isMobile && "text-xs")}>Data Limite (opcional)</Label>
        <Popover open={calOpen} onOpenChange={setCalOpenFn}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              type="button"
              className={cn(
                "w-full justify-start text-left font-bold h-10 rounded-xl",
                "input-3d-premium input-white px-3 transition-all duration-200",
                !dLim && "text-gray-400",
                isMobile && "h-9 text-sm"
              )}
            >
              <DynamicIcon name="📅" className={cn("mr-2 h-4 w-4 text-primary", isMobile && "h-3.5 w-3.5")} />
              {dLim ? format(dLim, "PPP", { locale: ptBR }) : <span>Sem data limite</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className={cn("w-auto p-0", isMobile && "p-1")}>
            <Calendar
              mode="single"
              selected={dLim}
              onSelect={(d) => { setDLimFn(d); setCalOpenFn(false); }}
              locale={ptBR}
              showOutsideDays={false}
              className={cn(isMobile && "text-sm")}
              disabled={(date) => date < new Date()}
            />
          </PopoverContent>
        </Popover>
        {dLim && (
          <Button type="button" variant="ghost" size="sm" className="text-xs text-destructive h-6 px-2" onClick={() => setDLimFn(undefined)}>
            Remover data limite
          </Button>
        )}
      </div>
    </>
  );

  return (
    <div className={cn("flex flex-col global-bg", isMobile ? "bg-slate-50" : "pt-[72px]")}>
      <main className={cn("container-app flex-grow", isMobile ? "pt-16 pb-4" : "py-8")}>
        
        {/* Desktop Header */}
        {!isMobile && (
          <div className="flex items-center gap-4 mb-8">
            <div
              className="btn-3d p-2.5 rounded-xl flex items-center justify-center shadow-sm border-none transition-all h-auto w-auto"
              style={{ "--cor-topo": "#FFFFFF", "--cor-base": "#F1F5F9" } as any}
            >
              <DynamicIcon name="🎯" className="h-6 w-6" />
            </div>
            <h1
              className="text-3xl font-extrabold tracking-[0.5px] transition-all duration-300 text-slate-800"
              style={{ fontFamily: "'Inter', sans-serif", filter: "drop-shadow(0px 1px 2px rgba(0,0,0,0.15))" }}
            >
              Minhas Meta<span style={{ color: accentColor, fontWeight: 500, textShadow: "0 0 10px rgba(194, 65, 12, 0.4)" }}>s</span>
            </h1>
          </div>
        )}

        {isMobile ? (
          /* ==================== MOBILE LAYOUT ==================== */
          <div className="grid grid-cols-1 gap-4">
            {/* Form Card */}
            <Card
              className={cn("p-6 rounded-[24px] shadow-sm border border-[rgba(0,0,0,0.06)] card-saldo", isMobile && "p-4")}
              style={cardStyle}
            >
              <h2 className={cn("text-xl text-[#C2410C] font-black tracking-[0.2px] pb-[1px] m-0 leading-none text-left mb-4")} style={{ fontFamily: "'Inter', sans-serif" }}>🎯 Nova Meta</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                {renderFormFields(
                  selectedParentId, setSelectedParentId,
                  nomeMeta, setNomeMeta,
                  icone, setIcone,
                  valorObjetivo, (v) => setValorObjetivo(v),
                  valorMensal, (v) => setValorMensal(v),
                  dataLimite, setDataLimite,
                  isCalendarOpen, setIsCalendarOpen,
                  showEmojiPicker, setShowEmojiPicker,
                  validationErrors, setValidationErrors,
                  ""
                )}
                <Button
                  type={isExpired ? "button" : "submit"}
                  onClick={isExpired ? handleBlockedClick : undefined}
                  className={cn(
                    "w-full rounded-xl btn-3d font-black text-white border-none transition-all active:scale-95 shadow-[0_2px_4px_rgba(0,0,0,0.05)] text-lg flex items-center justify-center",
                    "h-11 text-lg",
                    isExpired && "opacity-80"
                  )}
                  style={{ "--cor-topo": "#EA580C", "--cor-base": "#C2410C" } as any}
                  disabled={!isExpired && loadingForm}
                >
                  {loadingForm && !isExpired ? "Criando..." : "Criar Meta"}
                  {isExpired && <span className="ml-1.5 text-base">🔒</span>}
                </Button>
              </form>
            </Card>

            {/* Metas List */}
            <div className="mt-2">
              <Card
                className={cn("p-6 rounded-[24px] shadow-sm border border-[rgba(0,0,0,0.06)] card-saldo text-card-foreground", isMobile && "p-4")}
                style={cardStyle}
              >
                <h2 className={cn("text-xl font-bold text-[#C2410C] mb-4")}>🎯 Minhas Metas</h2>
                <div className="space-y-5 max-h-[560px] overflow-y-auto no-scrollbar">
                  {calculatedMetas.length === 0 ? (
                    <p className="text-muted-foreground text-center py-12 bg-white/50 rounded-2xl border border-dashed border-gray-200">
                      Nenhuma meta cadastrada ainda.
                    </p>
                  ) : (
                    calculatedMetas.map((meta) => renderMetaCard(meta))
                  )}
                </div>
              </Card>
            </div>

            {/* Summary Card (Mobile) */}
            {calculatedMetas.length > 0 && (
              <div className="mt-2 py-6 px-[18px] shadow-sm rounded-[24px] border border-[#C2410C]/20" style={{ background: "linear-gradient(135deg, #f8fafc 0%, #fff7ed 50%, rgba(255, 237, 213, 0.9) 100%)" }}>
                <h3 className="text-sm font-black text-[#C2410C] uppercase tracking-widest mb-4">📊 Resumo das Metas</h3>
                <div className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-6">
                  {renderSummaryItem("🎯", "Metas Ativas", stats.ativas.toString())}
                  {renderSummaryItem("🏆", "Concluídas", stats.concluidas.toString(), true)}
                  {renderSummaryItem("💰", "Total Objetivos", formatCurrency(stats.totalObjetivo))}
                  {renderSummaryItem("📈", "Total Realizado", formatCurrency(stats.totalRealizado), true)}
                </div>
                {/* Progress bar */}
                <div className="mt-6">
                  <div className="flex justify-between mb-1">
                    <span className="text-[12px] font-medium text-[#C2410C] capitalize tracking-wide opacity-90">Progresso Geral</span>
                    <span className={cn("font-black text-slate-700", isMobile ? "text-[13px]" : "text-sm")}>{stats.progressoGeral.toFixed(1)}%</span>
                  </div>
                  <div className="w-full h-3 bg-orange-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${stats.progressoGeral}%`, background: "linear-gradient(90deg, #FB923C, #EA580C)" }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Próxima Conquista (Mobile) */}
            {proximaConquista && renderProximaConquista()}

            {/* Chart (Mobile) */}
            {calculatedMetas.length > 0 && renderChart()}
          </div>
        ) : (
          /* ==================== DESKTOP LAYOUT ==================== */
          <>
            {/* Desktop Summary Bar */}
            {calculatedMetas.length > 0 && (
              <div className="rounded-[24px] p-6 shadow-sm mb-8 hidden lg:flex items-center border border-[#C2410C]/20" style={{ background: "linear-gradient(135deg, #f8fafc 0%, #fff7ed 50%, rgba(255, 237, 213, 0.9) 100%)" }}>
                <div className="grid grid-cols-4 items-center gap-x-6 w-full">
                  {renderDesktopSummaryItem("🎯", "Metas Ativas", stats.ativas.toString())}
                  {renderDesktopSummaryItem("💰", "Total Objetivos", formatCurrency(stats.totalObjetivo), true)}
                  {renderDesktopSummaryItem("📈", "Total Realizado", formatCurrency(stats.totalRealizado), true)}
                  <div className="flex items-center justify-start gap-4 border-l border-slate-200 h-10 pl-6">
                    <DynamicIcon name="Percent" className="h-5 w-5" style={{ color: accentColor }} strokeWidth={3} />
                    <div className="flex flex-col">
                      <h4 className="text-[10px] font-black uppercase tracking-[0.2em] mb-1 leading-none opacity-90" style={{ color: accentColor }}>Progresso</h4>
                      <p className="text-xl font-bold text-slate-700 tracking-tight leading-none">{stats.progressoGeral.toFixed(1)}%</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className={cn("grid gap-8 lg:mb-8", "grid-cols-1 lg:grid-cols-[0.9fr_1.6fr]")}>
              {/* Form */}
              <div className="self-start">
                <Card
                  className="p-6 lg:p-8 rounded-[24px] shadow-sm border border-[rgba(0,0,0,0.06)] card-saldo h-fit"
                  style={cardStyle}
                >
                  <h2 className="text-2xl font-bold mb-6 lg:mb-8" style={{ color: accentColor }}>🎯 Nova Meta</h2>
                  <form onSubmit={handleSubmit} className="space-y-4 lg:space-y-6">
                    {renderFormFields(
                      selectedParentId, setSelectedParentId,
                      nomeMeta, setNomeMeta,
                      icone, setIcone,
                      valorObjetivo, (v) => setValorObjetivo(v),
                      valorMensal, (v) => setValorMensal(v),
                      dataLimite, setDataLimite,
                      isCalendarOpen, setIsCalendarOpen,
                      showEmojiPicker, setShowEmojiPicker,
                      validationErrors, setValidationErrors,
                      ""
                    )}
                    <Button
                      type={isExpired ? "button" : "submit"}
                      onClick={isExpired ? handleBlockedClick : undefined}
                      className={cn(
                        "w-full rounded-xl btn-3d font-black text-white border-none transition-all active:scale-95 shadow-[0_2px_4px_rgba(0,0,0,0.05)] text-lg flex items-center justify-center h-11",
                        isExpired && "opacity-80"
                      )}
                      style={{ "--cor-topo": "#EA580C", "--cor-base": "#C2410C" } as any}
                      disabled={!isExpired && loadingForm}
                    >
                      {loadingForm && !isExpired ? "Criando..." : "Criar Meta"}
                      {isExpired && <span className="ml-1.5 text-base">🔒</span>}
                    </Button>
                  </form>
                </Card>
              </div>

              {/* Metas List */}
              <div className="self-start">
                <Card
                  className="p-6 rounded-[24px] shadow-sm border border-[rgba(0,0,0,0.06)] card-saldo text-card-foreground h-fit"
                  style={cardStyle}
                >
                  <h2 className="text-2xl font-bold text-[#C2410C] mb-6">🎯 Minhas Metas</h2>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5 items-start lg:max-h-[480px] lg:overflow-y-auto lg:pr-2 custom-scrollbar">
                    {calculatedMetas.length === 0 ? (
                      <p className="text-muted-foreground text-center py-12 bg-white/50 rounded-2xl border border-dashed border-gray-200 lg:col-span-2">
                        Nenhuma meta cadastrada ainda.
                      </p>
                    ) : (
                      calculatedMetas.map((meta) => renderMetaCard(meta))
                    )}
                  </div>
                </Card>
              </div>
            </div>

            {/* Bottom row: Próxima Conquista + Chart */}
            {calculatedMetas.length > 0 && (
              <div className={cn("grid gap-8 lg:mb-[40px]", proximaConquista ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1")}>
                {proximaConquista && renderProximaConquista()}
                {renderChart()}
              </div>
            )}
          </>
        )}
      </main>

      {/* Edit Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={(open) => { if (!open) { setIsEditModalOpen(false); setEditingMeta(null); } }}>
        <DialogContent
          className={cn(
            isMobile ? "dialog-mobile w-[99%] max-w-[99%] !rounded-[22px] !px-4 !pb-6" : "sm:max-w-[500px] !rounded-[22px] !pb-6"
          )}
          style={{
            background: "linear-gradient(135deg, #f8fafc 0%, #fff7ed 100%)",
            backgroundBlendMode: "soft-light",
            backdropFilter: "blur(6px)",
            outline: "1px solid rgba(234, 88, 12, 0.12)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.6), inset 0 -8px 20px rgba(0,0,0,0.03), inset 0 0 18px rgba(234, 88, 12, 0.12)"
          }}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DialogHeader className={cn(isMobile ? "mt-[5px]" : "-mt-4")}>
            <DialogTitle className={cn("flex items-center justify-center gap-2 w-full font-black", !isMobile && "text-xl")}>
              <span>🎯</span>
              <span>Editar Meta</span>
            </DialogTitle>
          </DialogHeader>
          <div className={cn("space-y-4", isMobile ? "pb-2" : "pb-2")}>
            {renderFormFields(
              editSelectedParentId, setEditSelectedParentId,
              editNomeMeta, setEditNomeMeta,
              editIcone, setEditIcone,
              editValorObjetivo, (v) => setEditValorObjetivo(v),
              editValorMensal, (v) => setEditValorMensal(v),
              editDataLimite, setEditDataLimite,
              isEditCalendarOpen, setIsEditCalendarOpen,
              showEditEmojiPicker, setShowEditEmojiPicker,
              editValidationErrors, setEditValidationErrors,
              "edit"
            )}
            <Button
              type="button"
              onClick={handleEditSubmit}
              className={cn(
                "w-full rounded-xl btn-3d font-bold text-white border-none transition-all active:scale-95",
                isMobile ? "h-11 text-base !shadow-none mt-2" : "h-11 text-base shadow-md mt-2"
              )}
              style={{ "--cor-topo": "#EA580C", "--cor-base": "#C2410C" } as any}
              disabled={updateMetaMutation.isPending}
            >
              {updateMetaMutation.isPending ? "Atualizando..." : "Atualizar Meta"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <AlertDialog open={isConfirmDeleteOpen} onOpenChange={setIsConfirmDeleteOpen}>
        <AlertDialogContent
          className={cn(
            isMobile ? "dialog-mobile w-[99%] max-w-[99%] !px-4 p-4 !pb-4 min-h-[180px] !rounded-[22px] shadow-none border-none" : "sm:max-w-[425px] !pb-4 !rounded-[22px] shadow-none border-none"
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
              Excluir Meta
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              {deleteHasDependencies
                ? <>A meta será excluída, mas a subcategoria <span className="font-bold text-foreground">"{metaToDelete?.subcategoria?.nome}"</span> será mantida porque existem lançamentos vinculados a ela.</>
                : <>A meta <span className="font-bold text-foreground">"{metaToDelete?.subcategoria?.nome}"</span> e a subcategoria correspondente serão excluídas.</>
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter
            className={cn(
              "flex flex-col sm:flex-row justify-center gap-2",
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
              onClick={handleConfirmDelete}
              disabled={deleteMetaMutation.isPending}
              className={cn(
                "flex-1 rounded-2xl btn-3d font-black text-white border-none transition-all active:scale-95 shadow-[0_2px_4px_rgba(0,0,0,0.05)] text-lg h-11",
                isMobile && "h-12 text-lg"
              )}
              style={{ "--cor-topo": "#FF6B6B", "--cor-base": "#E54D4D" } as any}
            >
              {deleteMetaMutation.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Footer isMobile={isMobile} user={user} className={cn(isMobile ? "mt-0 mb-2 bg-transparent" : "mt-8")} />
    </div>
  );

  // ==================== RENDER HELPERS ====================

  function renderMetaCard(meta: typeof calculatedMetas[0]) {
    const catName = meta.subcategoria?.nome || "Meta";
    const catIcon = meta.subcategoria?.icone || "🎯";
    const parentName = meta.parentCat?.nome || "";

    return (
      <div
        key={meta.id}
        onClick={() => { if (isMobile) handleEditClick(meta); }}
        className="relative group overflow-hidden transition-all duration-300 py-[14px] px-4 rounded-[24px] border border-[rgba(0,0,0,0.08)] shadow-sm cursor-pointer active:scale-[0.98] h-fit"
        style={{ backgroundColor: "#FFFFFF" }}
      >
        {/* Top: Icon, Name, Category + Edit button */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-start gap-[5px] -ml-1.5">
            <DynamicIcon name={catIcon} className="h-9 w-9 text-[30px] leading-none" style={{ filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.15))" }} />
            <div className="flex flex-col">
              <h3 className="font-bold text-gray-800 leading-tight text-base">{catName}</h3>
              <p className="text-xs text-gray-600 font-bold">{parentName}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => { e.stopPropagation(); handleEditClick(meta); }}
            className="h-9 w-9 rounded-full bg-[linear-gradient(180deg,rgba(255,255,255,1)_0%,rgba(240,245,255,0.9)_100%)] border border-blue-200/50 shadow-[0_2px_4px_rgba(0,0,0,0.05),inset_0_1px_0_rgba(255,255,255,1),0_1px_0_rgba(0,0,0,0.08)] active:scale-95 active:shadow-inner transition-all duration-200"
          >
            <DynamicIcon name="SquarePen" className="h-4 w-4 text-[#3b82f6]" />
          </Button>
        </div>

        {/* Values */}
        <div className="flex flex-col gap-3">
          <div className="space-y-2">
            {/* Realizado / Objetivo */}
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-500 font-black uppercase tracking-wider leading-none mb-1">Realizado</span>
                <span className="font-bold tracking-tight text-2xl" style={{ color: accentColor }}>
                  {formatCurrency(meta.realizado)}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => { e.stopPropagation(); handleDeleteClick(meta); }}
                className="h-9 w-9 rounded-full bg-[linear-gradient(180deg,rgba(255,255,255,1)_0%,rgba(250,240,240,0.9)_100%)] border border-red-100 shadow-[0_2px_4px_rgba(0,0,0,0.05),inset_0_1px_0_rgba(255,255,255,1),0_1px_0_rgba(0,0,0,0.08)] active:scale-95 active:shadow-inner transition-all duration-200"
              >
                <DynamicIcon name="Trash2" className="h-4 w-4 text-[#ef4444]" />
              </Button>
            </div>

            <div className="text-xs font-bold text-slate-500">
              de {formatCurrency(meta.valor_objetivo)}
            </div>

            {/* Progress bar */}
            <div className="w-full h-3 bg-orange-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{
                  width: `${meta.percentual}%`,
                  background: meta.concluida
                    ? "linear-gradient(90deg, #22c55e, #16a34a)"
                    : "linear-gradient(90deg, #FB923C, #EA580C)"
                }}
              />
            </div>

            <div className="flex items-center justify-between">
              <span className={cn("text-sm font-black", meta.concluida ? "text-green-600" : "text-slate-700")}>
                {meta.concluida ? "🎉 Meta alcançada!" : `${meta.percentual.toFixed(1)}%`}
              </span>
              <span className="text-xs font-bold text-slate-400">
                Faltam {formatCurrency(meta.restante)}
              </span>
            </div>
          </div>

          {/* Bottom info */}
          <div className="flex items-end justify-between">
            {/* Planejado info */}
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-orange-200/50 shadow-[0_1px_2px_rgba(0,0,0,0.02)]" style={{ color: accentColor, background: accentColorLight }}>
              <DynamicIcon name="Calendar" className="h-3.5 w-3.5" />
              <div className="flex flex-col items-start leading-[1.1]">
                <span className="text-[13px] font-black">{formatCurrency(meta.valor_mensal)}/mês</span>
                {meta.realizadoMensal > 0 && (
                  <span className="text-[10px] opacity-70 font-bold">
                    Real: {formatCurrency(meta.realizadoMensal)}/mês
                  </span>
                )}
              </div>
            </div>

            {/* Previsão */}
            <div className="text-right">
              {meta.data_limite ? (
                <div className="flex flex-col items-end">
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Limite</span>
                  <span className="text-[12px] text-slate-500 font-black uppercase tracking-widest">
                    {format(new Date(meta.data_limite + "T12:00:00"), "MMM/yyyy", { locale: ptBR })}
                  </span>
                  {meta.ritmoSuficiente !== null && (
                    <span className={cn("text-[10px] font-bold mt-0.5", meta.ritmoSuficiente ? "text-green-600" : "text-amber-600")}>
                      {meta.ritmoSuficiente ? "🟢 Ritmo ok" : `⚠️ Precisa ${formatCurrency(meta.valorMensalNecessario || 0)}/mês`}
                    </span>
                  )}
                </div>
              ) : (
                meta.previsaoRestante && !meta.concluida && (
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Previsão</span>
                    <span className="text-[12px] text-slate-500 font-black uppercase tracking-widest">
                      {format(meta.previsaoRestante, "MMM/yyyy", { locale: ptBR })}
                    </span>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderSummaryItem(icon: string, label: string, value: string, _isRightColumn = false) {
    const isCurrency = value.includes("R$");
    const currencyPrefix = isCurrency ? (isMobile ? "" : "R$") : "";
    const currencyValue = isCurrency ? value.replace("R$", "").trim() : value;

    return (
      <div className="flex justify-start">
        <div className="flex items-start gap-2 text-left">
          <DynamicIcon name={icon} className="h-6 w-6 text-[24px] leading-none mt-0.5" style={{ color: accentColor }} strokeWidth={3} />
          <div className="flex flex-col items-start">
            <h4 className="text-[12px] font-medium capitalize tracking-wide leading-tight opacity-90 whitespace-nowrap mb-0.5" style={{ color: accentColor }}>{label}</h4>
            <p className="text-base font-bold text-slate-700 tracking-tight leading-none flex items-baseline gap-1">
              {isCurrency ? (
                <>
                  {currencyPrefix && <span className="text-[14px] font-medium" style={{ color: accentColor }}>{currencyPrefix}</span>}
                  <span className={cn(isMobile && "text-[16px]")}>{currencyValue}</span>
                </>
              ) : (
                <span className={cn(isMobile && "text-[16px]")}>{value}</span>
              )}
            </p>
          </div>
        </div>
      </div>
    );
  }

  function renderDesktopSummaryItem(icon: string, label: string, value: string, hasBorder = false) {
    return (
      <div className={cn("flex items-center justify-start gap-4", hasBorder && "border-l border-slate-200 h-10 pl-6")}>
        <DynamicIcon name={icon} className="h-6 w-6 text-[24px] leading-none" style={{ color: accentColor }} strokeWidth={3} />
        <div className="flex flex-col">
          <h4 className="text-[10px] font-black uppercase tracking-[0.2em] mb-1 leading-none opacity-90" style={{ color: accentColor }}>{label}</h4>
          <p className="text-xl font-bold text-slate-700 tracking-tight leading-none">{value}</p>
        </div>
      </div>
    );
  }

  function renderProximaConquista() {
    if (!proximaConquista) return null;
    const catName = proximaConquista.subcategoria?.nome || "Meta";
    const catIcon = proximaConquista.subcategoria?.icone || "🎯";
    return (
      <Card className="p-5 rounded-[24px] shadow-sm border border-amber-200/40 mt-4 lg:mt-0" style={{ background: "linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)" }}>
        <h3 className="text-sm font-black text-amber-700 uppercase tracking-widest mb-3">🏆 Próxima Conquista</h3>
        <div className="flex items-center gap-3 mb-3">
          <DynamicIcon name={catIcon} className="h-9 w-9 text-[30px] leading-none" style={{ filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.15))" }} />
          <div>
            <p className="font-bold text-gray-800">{catName}</p>
            <p className="text-sm font-bold text-amber-700">{proximaConquista.percentual.toFixed(1)}% concluído</p>
          </div>
        </div>
        <div className="w-full h-2.5 bg-amber-100 rounded-full overflow-hidden mb-2">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${proximaConquista.percentual}%`, background: "linear-gradient(90deg, #F59E0B, #D97706)" }}
          />
        </div>
        <div className="flex justify-between text-xs font-bold text-amber-600">
          <span>Faltam {formatCurrency(proximaConquista.restante)}</span>
          {proximaConquista.previsaoRestante && (
            <span>📅 {format(proximaConquista.previsaoRestante, "MMM/yyyy", { locale: ptBR })}</span>
          )}
        </div>
      </Card>
    );
  }

  function renderChart() {
    if (chartData.length === 0 || stats.totalObjetivo === 0) return null;
    return (
      <Card className="p-5 rounded-[24px] shadow-sm border border-[rgba(0,0,0,0.06)] mt-4 lg:mt-0" style={{ background: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)" }}>
        <h3 className="text-sm font-black text-slate-600 uppercase tracking-widest mb-3">📊 Progresso Geral</h3>
        <div className="flex items-center justify-center">
          <div className="relative" style={{ width: 140, height: 140 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={65}
                  dataKey="value"
                  strokeWidth={0}
                  startAngle={90}
                  endAngle={-270}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-black text-slate-700">{stats.progressoGeral.toFixed(0)}%</span>
            </div>
          </div>
        </div>
        <div className="flex justify-center gap-6 mt-3 text-xs font-bold">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ background: "#22c55e" }} />
            <span className="text-slate-600">Realizado</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ background: "#e2e8f0" }} />
            <span className="text-slate-600">Restante</span>
          </div>
        </div>
      </Card>
    );
  }
}
