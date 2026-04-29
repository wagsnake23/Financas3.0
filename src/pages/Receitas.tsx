import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card"; // Corrected line
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/contexts/ToastContext";
import { Navigation } from "@/components/Navigation";
import { useIsMobile } from "@/hooks/use-mobile";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Tables } from "@/integrations/supabase/types";
import { TotalRevenueCard } from "@/components/TotalRevenueCard";
import { RevenueByTypeChart } from "@/components/RevenueByTypeChart";
import DynamicIcon from "@/components/DynamicIcon";
import { AppCategory } from "@/types/finance";
import { format, getDate, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import {
  cn,
  getBorderClass,
  formatInTimeZone,
  TARGET_TIMEZONE,
} from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Footer } from "@/components/Footer";
import CurrencyBR from "@/components/ui/currency-br";
import { Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AddSubcategoryModal } from "@/components/AddSubcategoryModal";
import { useMutation } from "@tanstack/react-query";

import { Database } from "@/integrations/supabase/types";
import { MonthlyRevenueBarChart } from "@/components/MonthlyRevenueBarChart";
import { RevenueStatusToggle } from "@/components/revenue-form/RevenueStatusToggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
type ReceitaStatus = Database["public"]["Enums"]["receita_status"];

const UNSELECTED_VALUE = "unselected";
const RECURRING_INSTALLMENTS_COUNT = 120;

export default function Receitas() {
  const { user, loading: authLoading } = useAuth();
  const { showSuccessToast, showErrorToast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  const [submitPortalRef, setSubmitPortalRef] = useState<HTMLDivElement | null>(null);
  const [tipoReceitaId, setTipoReceitaId] = useState(UNSELECTED_VALUE);
  const [valor, setValor] = useState<number | undefined>(undefined);
  const [data, setData] = useState<Date | undefined>(new Date());
  const [descricao, setDescricao] = useState("");
  const [status, setStatus] = useState<ReceitaStatus>("Pendente");
  const [loading, setLoading] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [validationErrors, setValidationErrors] = useState<
    Record<string, boolean>
  >({});
  const [isAddSubcategoryModalOpen, setIsAddSubcategoryModalOpen] = useState(false);

  const addCategoryMutation = useMutation({
    mutationFn: async (newCategory: Omit<AppCategory, "id" | "user_id" | "created_at">) => {
      if (!user?.id) throw new Error("User not authenticated.");
      const categoryToInsert = {
        ...newCategory,
        id: crypto.randomUUID(),
        user_id: user.id,
        forma_pagamento: null,
      };
      const { data, error } = await supabase
        .from("categorias")
        .insert(categoryToInsert)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      // Optimistically update the categories cache to include the new one immediately
      queryClient.setQueryData(["categories", user?.id], (old: AppCategory[] | undefined) => {
        return old ? [...old, data] : [data];
      });

      queryClient.invalidateQueries({ queryKey: ["categories", user?.id] });
      showSuccessToast("Sucesso", "Subcategoria adicionada!");
      setTipoReceitaId(data.id);
      setIsAddSubcategoryModalOpen(false);
    },
    onError: (error: any) => {
      showErrorToast("Erro", error.message || "Erro ao adicionar subcategoria");
    },
  });

  const { data: revenues = [], isLoading: isLoadingRevenues } = useQuery<
    Tables<"receitas">[]
  >({
    queryKey: ["revenues", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("receitas")
        .select("*, status, is_recurring_master, recurrence_id, recurrence_day")
        .eq("user_id", user.id)
        .order("data", { ascending: false });
      if (error) throw error;
      return data.filter((r: any) => r.data !== '1900-01-01');
    },
    enabled: !!user && !authLoading,
  });

  const { data: fetchedCategories = [], isLoading: isLoadingCategories } =
    useQuery<AppCategory[]>({
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

          if (lowerNome.includes("ações") || lowerNome.includes("acoes")) {
            if (lowerNome.includes("dividendos") || lowerNome.includes("venda")) return false;
          }
          if (lowerNome.includes("criptomoedas") || lowerNome.includes("crypto") || lowerNome.includes("bitcoin")) {
            if (cryptoAdded) return false;
            cryptoAdded = true;
          }
          // Consolidação de Poupança
          if (lowerNome.includes("poupança") || lowerNome.includes("poupanca")) {
            if (poupancaAdded) return false;
            poupancaAdded = true;
          }
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
      enabled: !!user && !authLoading,
    });

  const incomeSubcategories = useMemo(() => {
    return fetchedCategories.filter(
      (cat) => cat.parent_id === "receitas_e_investimentos"
    );
  }, [fetchedCategories]);

  useEffect(() => {
    setStatus(isRecurring ? "Prevista" : "Pendente");
  }, [isRecurring]);

  const handleToggleChange = (value: string) => {
    setIsRecurring(value === "recorrente");
  };

  const handleSubmitOneOff = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const newErrors: Record<string, boolean> = {};
    let hasError = false;

    if (!user) {
      showErrorToast("Erro de Autenticação", "Usuário não autenticado.");
      setLoading(false);
      return;
    }

    if (valor === undefined || valor <= 0) {
      newErrors.valor = true;
      hasError = true;
    } else {
      newErrors.valor = false;
    }
    if (!data) {
      newErrors.data = true;
      hasError = true;
    } else {
      newErrors.data = false;
    }
    if (tipoReceitaId === UNSELECTED_VALUE) {
      newErrors.tipoReceitaId = true;
      hasError = true;
    } else {
      newErrors.tipoReceitaId = false;
    }

    setValidationErrors(newErrors);

    if (hasError) {
      showErrorToast("Validação", "Preencha todos os campos obrigatórios");
      setLoading(false);
      return;
    }

    const formattedDate = data
      ? formatInTimeZone(data, TARGET_TIMEZONE, "yyyy-MM-dd")
      : "";

    let masterRevenueId: string | null = null;

    try {
      if (isRecurring) {
        const recurrenceDay = getDate(data);
        const { data: masterData, error: masterError } = await supabase
          .from("receitas")
          .insert({
            user_id: user?.id,
            tipo_receita_id:
              tipoReceitaId === UNSELECTED_VALUE ? null : tipoReceitaId,
            valor: valor as number,
            data: formattedDate,
            descricao,
            status: "Prevista",
            is_recurring_master: true,
            recurrence_day: recurrenceDay,
          })
          .select()
          .single();

        if (masterError) throw masterError;
        masterRevenueId = masterData.id;

        const { error: updateMasterError } = await supabase
          .from("receitas")
          .update({ recurrence_id: masterRevenueId })
          .eq("id", masterRevenueId);

        if (updateMasterError) throw updateMasterError;

        const { error: rpcError } = await supabase.rpc(
          "generate_recurring_entries",
          {
            p_user_id: user?.id,
            p_transaction_type: "income",
            p_master_id: masterRevenueId,
            p_first_occurrence_date: formattedDate,
            p_monthly_amount: valor as number,
            p_category_id:
              tipoReceitaId === UNSELECTED_VALUE ? null : tipoReceitaId,
            p_description: descricao,
            p_status: "Prevista",
            p_recurrence_day: recurrenceDay,
            p_total_installments: RECURRING_INSTALLMENTS_COUNT,
            p_forma_pagamento: null,
            p_cartao_id: null,
            p_tipo_pagamento: null,
          }
        );

        if (rpcError) throw rpcError;
      } else {
        const newRevenueData = {
          user_id: user?.id,
          tipo_receita_id:
            tipoReceitaId === UNSELECTED_VALUE ? null : tipoReceitaId,
          valor: valor as number,
          data: formattedDate,
          descricao,
          status,
          is_recurring_master: false,
          recurrence_id: null,
          recurrence_day: null,
        };

        const { error } = await supabase
          .from("receitas")
          .insert(newRevenueData);
        if (error) throw error;
      }

      showSuccessToast("Sucesso", "Receita adicionada com sucesso!");
      setTipoReceitaId(UNSELECTED_VALUE);
      setValor(undefined);
      setData(new Date());
      setDescricao("");
      setStatus("Pendente");
      setIsRecurring(false);
      setValidationErrors({});
      queryClient.invalidateQueries({ queryKey: ["revenues", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["allRevenues"] });
    } catch (error: any) {
      showErrorToast("Erro", error.message || "Erro ao adicionar receita");
      console.error("Supabase error adding revenue:", error);
    } finally {
      setLoading(false);
    }
  };

  const oneOffFormContent = (
    <>
      <form
        id="income-form"
        onSubmit={handleSubmitOneOff}
        className={cn("w-full", isMobile ? "space-y-4" : "space-y-6")}
      >
        <div className={cn("space-y-2 pt-2", isMobile && "w-full mx-auto")}>
          <ToggleGroup
            type="single"
            value={isRecurring ? "recorrente" : "avulsa"}
            onValueChange={handleToggleChange}
            className={cn("w-full justify-center", isMobile ? "gap-x-2" : "gap-x-4")}
          >
            <ToggleGroupItem
              value="avulsa"
              className={cn(
                "btn-3d flex-1 rounded-xl flex items-center justify-center border-none transition-all duration-200 shadow-[0_2px_4px_rgba(0,0,0,0.05)]",
                !isRecurring ? "!text-white font-bold" : "!text-[#1AA361]/80 font-medium",
                isMobile && "h-9 py-0.5 text-sm"
              )}
              style={!isRecurring
                ? { "--cor-topo": "#25AF6A", "--cor-base": "#1AA361" } as any
                : { "--cor-topo": "#FFFFFF", "--cor-base": "#F1F5F9", boxShadow: "inset 0px 1px 2px rgba(255, 255, 255, 0.25), inset 0px -2px 3px rgba(0, 0, 0, 0.15)" } as any
              }
            >
              <DynamicIcon
                name="Zap"
                className={cn(
                  "mr-2 h-4 w-4 transition-colors",
                  !isRecurring ? "!text-white" : "!text-[#1AA361]/80"
                )}
              />{" "}
              Avulsa
            </ToggleGroupItem>
            <ToggleGroupItem
              value="recorrente"
              className={cn(
                "btn-3d flex-1 rounded-xl flex items-center justify-center border-none transition-all duration-200 shadow-[0_2px_4px_rgba(0,0,0,0.05)]",
                isRecurring ? "!text-white font-bold" : "!text-[#1AA361]/80 font-medium",
                isMobile && "h-9 py-0.5 text-sm"
              )}
              style={isRecurring
                ? { "--cor-topo": "#25AF6A", "--cor-base": "#1AA361" } as any
                : { "--cor-topo": "#FFFFFF", "--cor-base": "#F1F5F9", boxShadow: "inset 0px 1px 2px rgba(255, 255, 255, 0.25), inset 0px -2px 3px rgba(0, 0, 0, 0.15)" } as any
              }
            >
              <DynamicIcon
                name="Repeat"
                className={cn(
                  "mr-2 h-4 w-4 transition-colors",
                  isRecurring ? "!text-white" : "!text-[#1AA361]/80"
                )}
              />{" "}
              Recorrente
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        <div className={cn(isMobile && "w-full mx-auto")}>
          <Label htmlFor="tipo" className={cn("text-gray-800 font-medium mb-1.5 inline-block", isMobile && "text-xs")}>
            Subcategoria de Receita
          </Label>
          <div className="flex gap-2">
            <Select
              value={tipoReceitaId}
              onValueChange={(value) => {
                setTipoReceitaId(value);
                setValidationErrors((prev) => ({ ...prev, tipoReceitaId: false }));
              }}
            >
              <SelectTrigger
                className={cn(
                  "flex-1 transition-all duration-200 input-3d-premium",
                  isMobile ? "h-9 text-sm" : "h-10",
                  getBorderClass({
                    isInvalid: validationErrors.tipoReceitaId,
                    isValid: validationErrors.tipoReceitaId === false,
                  })
                )}
              >
                <SelectValue placeholder="Selecione a subcategoria" />
              </SelectTrigger>
              <SelectContent className="w-[--radix-select-trigger-width] rounded-2xl border-none shadow-xl">
                <SelectItem
                  value={UNSELECTED_VALUE}
                  disabled
                  className={cn(isMobile && "text-sm")}
                >
                  Selecione a subcategoria
                </SelectItem>
                {incomeSubcategories.length === 0 ? (
                  <SelectItem
                    value={UNSELECTED_VALUE}
                    disabled
                    className={cn(isMobile && "text-sm")}
                  >
                    Nenhum tipo de receita disponível
                  </SelectItem>
                ) : (
                  incomeSubcategories.map((tipo) => (
                    <SelectItem
                      key={tipo.id}
                      value={tipo.id}
                      className={cn(isMobile && "text-sm")}
                    >
                      <span className="flex items-center gap-2">
                        <span>{tipo.icone}</span>
                        <span>{tipo.nome}</span>
                      </span>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <Button
              type="button"
              size="icon"
              onClick={() => setIsAddSubcategoryModalOpen(true)}
              className={cn(
                "btn-3d w-8 h-9 p-0 flex items-center justify-center rounded-xl shadow-sm border border-green-200 transition-all active:scale-90 flex-shrink-0",
                isMobile ? "h-9 w-8" : "h-10 w-9"
              )}
              style={{ "--cor-topo": "#25AF6A", "--cor-base": "#1AA361" } as any}
            >
              <Plus className="h-[18px] w-[18px] !text-white" />
            </Button>
          </div>
        </div>

        <div className={cn(isMobile && "w-full mx-auto")}>
          <Label htmlFor="valor" className={cn("text-gray-800 font-medium mb-1.5 inline-block", isMobile && "text-xs")}>
            Valor (R$)
          </Label>
          <CurrencyBR
            value={valor}
            onChange={(v) => {
              setValor(v);
              setValidationErrors((prev) => ({ ...prev, valor: false }));
            }}
            className={cn(
              "w-full transition-all duration-200 input-3d-premium",
              isMobile ? "h-9 text-sm" : "h-10",
              getBorderClass({
                isInvalid: validationErrors.valor,
                isValid: validationErrors.valor === false,
              })
            )}
          />
        </div>

        <div className={cn(isMobile && "w-full mx-auto")}>
          <Label htmlFor="data" className={cn("text-gray-800 font-medium mb-1.5 inline-block", isMobile && "text-xs")}>
            Data
          </Label>
          <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
            <PopoverTrigger asChild>
              <Button
                variant={"outline"}
                className={cn(
                  "w-full justify-start text-left font-normal transition-all duration-200 input-3d-premium",
                  isMobile ? "h-9 text-sm" : "h-10",
                  !data && "text-muted-foreground",
                  getBorderClass({
                    isInvalid: validationErrors.data,
                    isValid: validationErrors.data === false,
                  })
                )}
              >
                <DynamicIcon
                  name="📅"
                  className={cn(
                    "mr-2 h-4 w-4 text-gray-500",
                    isMobile && "h-4 w-4"
                  )}
                />
                {data ? (
                  format(data, "PPP", { locale: ptBR })
                ) : (
                  <span>Selecione uma data</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className={cn("w-auto p-0", isMobile && "p-1")}>
              <Calendar
                mode="single"
                selected={data}
                onSelect={(date) => {
                  setData(date);
                  setIsCalendarOpen(false);
                  setValidationErrors((prev) => ({ ...prev, data: false }));
                }}
                initialFocus
                locale={ptBR}
                showOutsideDays={false}
                className={cn(isMobile && "text-sm")}
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className={cn(isMobile && "w-full mx-auto")}>
          <Label htmlFor="descricao" className={cn("text-gray-800 font-medium mb-0.5 inline-block", isMobile && "text-xs")}>
            Descrição
          </Label>
          <Textarea
            id="descricao"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Detalhes sobre a receita..."
            rows={2}
            maxLength={45}
            className={cn(
              "w-full transition-all duration-200 input-3d-premium resize-none min-h-[56px] h-[56px] py-1.5 px-3",
              isMobile ? "text-sm" : "",
            )}
          />
        </div>

        {!isRecurring && (
          <div className={cn("space-y-2", isMobile && "w-full mx-auto")}>
            <RevenueStatusToggle
              status={status}
              setStatus={(val) => setStatus(val as ReceitaStatus)}
              isMobile={isMobile}
            />
          </div>
        )}

        {/* Submit Button Logic */}
        {(() => {
          const SubmitButton = (
            <Button
              type="submit"
              form="income-form"
              className={cn(
                "w-full rounded-xl btn-3d font-extrabold tracking-[0.5px] text-white border-none transition-all active:scale-95 shadow-[0_2px_4px_rgba(0,0,0,0.05)] text-lg",
                isMobile ? "h-11 text-lg" : "h-11 text-lg"
              )}
              style={{ "--cor-topo": "#25AF6A", "--cor-base": "#1AA361", fontFamily: "'Inter', sans-serif" } as any}
              disabled={loading}
            >
              {loading ? "Salvando..." : "Salvar Receita"}
            </Button>
          );

          return isMobile && submitPortalRef
            ? createPortal(SubmitButton, submitPortalRef)
            : (
              <div className={cn(isMobile && "w-full mx-auto")}>
                {SubmitButton}
              </div>
            );
        })()}
      </form>
      <AddSubcategoryModal
        isOpen={isAddSubcategoryModalOpen}
        onOpenChange={setIsAddSubcategoryModalOpen}
        onAddCategory={(cat) => addCategoryMutation.mutate(cat)}
        allCategories={fetchedCategories}
        defaultParentId="receitas_e_investimentos"
      />
    </>
  );

  if (authLoading || isLoadingRevenues || isLoadingCategories) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">
          Carregando Receitas...
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col min-h-screen bg-background md:pt-16",
        isMobile && "bg-[#F9FAFB]"
      )}
    >
      <Navigation />

      {/* HEADER PREMIUM — FINTECH STYLE (RECEITAS THEME) */}
      <div className={cn(
        "relative h-[220px] w-full overflow-hidden",
        isMobile ? "bg-gradient-to-b from-[#1AA361] via-[#1AA361] via-45% to-transparent" : "bg-background"
      )}>
        <div className={cn(
          "container mx-auto px-6 relative z-10 max-w-[1200px]",
          isMobile ? "fixed top-[46px] left-0 right-0 h-[70px] z-40 px-4 flex items-center bg-[#218C5C]/0 justify-between" : "pt-12 md:pt-16 flex justify-between items-start"
        )}>
          <div>
            <div className="flex items-start gap-3">
              <Button
                variant="ghost"
                className={cn("btn-3d p-2 rounded-xl flex items-center justify-center shadow-sm border-none cursor-pointer hover:scale-105 active:scale-95 transition-all h-auto w-auto", isMobile ? "mt-0" : "mt-1")}
                style={isMobile ? { "--cor-topo": "#F0FDF4", "--cor-base": "#DCFCE7" } as any : { "--cor-topo": "#FFFFFF", "--cor-base": "#F1F5F9" } as any}
                onClick={() => navigate("/lancamentos?type=income")}
              >
                <DynamicIcon
                  name="TrendingUp"
                  className={cn("!text-[#1AA361]", isMobile ? "h-4 w-4" : "h-5 w-5")}
                  strokeWidth={4}
                />
              </Button>
              <div className="flex flex-col">
                <h1 className={cn("font-extrabold tracking-[0.5px] -mt-0.5", isMobile ? "text-xl text-white" : "text-2xl text-slate-800")} style={{ fontFamily: "'Inter', sans-serif" }}>
                  Nova Receita
                </h1>
                <p className={cn("font-bold -mt-0.5 leading-none", isMobile ? "text-xs text-white" : "text-sm text-slate-500")}>
                  Registre seus ganhos
                </p>
              </div>
            </div>
          </div>

          <Button
            onClick={() => navigate(-1)}
            className={cn(
              "btn-3d h-9 px-3 rounded-xl font-black text-xs shadow-sm border-none transition-all active:scale-95 !text-[#1AA361] bg-white hover:bg-white/90",
              isMobile ? "h-8 px-2" : ""
            )}
            style={{ "--cor-topo": "#FFFFFF", "--cor-base": "#F1F5F9" } as any}
          >
            <DynamicIcon name="ChevronLeft" className="mr-1 h-4 w-4 !text-[#1AA361]" strokeWidth={3} />
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
              className="!fixed top-[118px] left-4 right-4 py-2 rounded-[24px] shadow-[0_8px_30px_rgba(0,0,0,0.04)] border-none bottom-[92px] overflow-hidden z-30 card-receitas"
              style={{ backgroundColor: "transparent" }}
            >
              <div className="h-full overflow-y-auto [&::-webkit-scrollbar]:hidden space-y-4 px-4 pb-2">
                {oneOffFormContent}
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
            <div className="space-y-6">
              <Card
                className="p-6 lg:px-6 rounded-[24px] shadow-sm card-receitas"
                style={{ backgroundColor: "transparent" }}
              >
                {oneOffFormContent}
              </Card>
            </div>

            <div className="h-full">
              <RevenueByTypeChart
                revenues={revenues.filter(r => {
                  const revenueDate = new Date(r.data);
                  const now = new Date();
                  return revenueDate.getMonth() === now.getMonth() && 
                         revenueDate.getFullYear() === now.getFullYear();
                })}
                revenueTypes={incomeSubcategories}
                annualTotalValue={revenues
                  .filter(r => new Date(r.data).getFullYear() === new Date().getFullYear())
                  .reduce((sum, r) => sum + r.valor, 0)
                }
              />
            </div>
          </div>
        )}
      </main>
      <Footer
        isMobile={isMobile}
        className={cn(isMobile ? "fixed bottom-0 left-0 right-0 pt-2 pb-1 bg-transparent z-50 m-0" : "mt-auto pt-8")}
        user={user}
      />
    </div>
  );
}
