import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/hooks/useProfile";
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
import { useIsMobile } from "@/hooks/use-mobile";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Tables } from "@/integrations/supabase/types";
import { TotalRevenueCard } from "@/components/TotalRevenueCard";
import { RevenueByTypeChart } from "@/components/RevenueByTypeChart";
import DynamicIcon from "@/components/DynamicIcon";
import { AppCategory } from "@/types/finance";
import { format, getDate, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Save, Lock } from "lucide-react";
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
import { DatePickerModal } from "@/components/ui/DatePickerModal";
import { Footer } from "@/components/Footer";
import CurrencyBR from "@/components/ui/currency-br";
import { Plus } from "lucide-react";
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
  const { user } = useAuth();
  const { data: profile } = useProfile(user?.id);
  const isExpired = profile?.isExpired;
  const { showSuccessToast, showErrorToast } = useToast();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const handleBlockedClick = (e: React.MouseEvent) => {
    e.preventDefault();
    showErrorToast("🔒 Sua assinatura expirou. Renove para voltar a editar seus dados.");
    setTimeout(() => {
      window.dispatchEvent(new Event("open-subscription-modal"));
    }, 2000);
  };

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
    enabled: !!user,
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
        className={cn(isMobile ? "space-y-3 w-full" : "space-y-6 w-full")}
      >
        <div className="pt-2">
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
                  !isRecurring ? "!text-white font-bold" : "!text-slate-400 font-medium",
                  isMobile && "!h-[39px] py-0.5 text-sm"
                )}
                style={!isRecurring
                  ? { "--cor-topo": "#25AF6A", "--cor-base": "#1AA361" } as any
                  : { "--cor-topo": "#FFFFFF", "--cor-base": "#F1F5F9", boxShadow: "inset 0px 1px 0px rgba(0, 0, 0, 0.1), inset 0px -2px 3px rgba(0, 0, 0, 0.15)" } as any
                }
            >
              <DynamicIcon
                name="Zap"
                className={cn(
                  "mr-2 h-4 w-4 transition-colors",
                  !isRecurring ? "!text-white" : "!text-slate-400"
                )}
              />{" "}
              Avulsa
            </ToggleGroupItem>
            <ToggleGroupItem
              value="recorrente"
              className={cn(
                "btn-3d flex-1 rounded-xl flex items-center justify-center border-none transition-all duration-200 shadow-[0_2px_4px_rgba(0,0,0,0.05)]",
                  isRecurring ? "!text-white font-bold" : "!text-slate-400 font-medium",
                  isMobile && "!h-[39px] py-0.5 text-sm"
                )}
                style={isRecurring
                  ? { "--cor-topo": "#25AF6A", "--cor-base": "#1AA361" } as any
                  : { "--cor-topo": "#FFFFFF", "--cor-base": "#F1F5F9", boxShadow: "inset 0px 1px 0px rgba(0, 0, 0, 0.1), inset 0px -2px 3px rgba(0, 0, 0, 0.15)" } as any
                }
            >
              <DynamicIcon
                name="Repeat"
                className={cn(
                  "mr-2 h-4 w-4 transition-colors",
                  isRecurring ? "!text-white" : "!text-slate-400"
                )}
              />{" "}
              Recorrente
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        <div>
          <Label htmlFor="tipo" className={cn("text-slate-500 font-semibold mb-1.5 inline-block", isMobile ? "text-[13px]" : "text-[15px]")}>
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
                  "flex-1 rounded-xl text-gray-800 font-medium transition-all duration-200 bg-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] input-3d-premium",
                  isMobile ? "!h-[39px] text-sm" : "h-10",
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
              variant="ghost"
              onClick={() => setIsAddSubcategoryModalOpen(true)}
              className={cn(
                "btn-3d p-0 flex items-center justify-center rounded-xl shadow-[0_2px_4px_rgba(0,0,0,0.05)] border-none transition-all active:scale-90 flex-shrink-0 !opacity-100 bg-transparent",
                isMobile ? "!h-[39px] w-[34px] text-sm" : "h-10 w-9 text-base"
              )}
              style={{ "--cor-topo": "#25AF6A", "--cor-base": "#1AA361", opacity: 1 } as any}
            >
              <Plus className="h-[18px] w-[18px] text-white" strokeWidth={3.5} />
            </Button>
          </div>
        </div>

        <div>
          <Label htmlFor="valor" className={cn("text-slate-500 font-semibold mb-1.5 inline-block", isMobile ? "text-[13px]" : "text-[15px]")}>
            Valor (R$)
          </Label>
          <CurrencyBR
            value={valor}
            onChange={(v) => {
              setValor(v);
              setValidationErrors((prev) => ({ ...prev, valor: false }));
            }}
            className={cn(
              isMobile ? "!h-[39px] text-sm" : "h-10",
              "w-full text-gray-800 font-medium transition-all duration-200 bg-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] rounded-xl input-3d-premium",
              getBorderClass({
                isInvalid: validationErrors.valor,
                isValid: validationErrors.valor === false,
              })
            )}
          />
        </div>

        <div>
          <Label htmlFor="data" className={cn("text-slate-500 font-semibold mb-1.5 inline-block", isMobile ? "text-[13px]" : "text-[15px]")}>
            Data
          </Label>
          <Button
            type="button"
            variant={"outline"}
            onClick={() => setIsCalendarOpen(true)}
            className={cn(
              "w-full justify-start text-left font-normal transition-all duration-200 input-3d-premium",
              isMobile ? "!h-[39px] text-sm" : "h-10",
              !data && "text-muted-foreground",
              getBorderClass({
                isInvalid: validationErrors.data,
                isValid: validationErrors.data === false,
              })
            )}
          >
            <DynamicIcon name="📅" className="mr-2 h-4 w-4 text-[#1e3a8a]/70" />
            {data ? format(data, "PPP", { locale: ptBR }) : <span>Selecione uma data</span>}
          </Button>
          <DatePickerModal 
            isOpen={isCalendarOpen}
            setIsOpen={setIsCalendarOpen}
            date={data}
            onSelect={(date) => {
              setData(date);
              setValidationErrors((prev) => ({ ...prev, data: false }));
            }}
          />
        </div>

        <div>
          <Label htmlFor="descricao" className={cn("text-slate-500 font-semibold mb-0.5 inline-block", isMobile ? "text-[13px]" : "text-[15px]")}>
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
              "input-3d-premium resize-none py-1.5 px-3",
              isMobile ? "min-h-[61px] h-[61px] text-sm" : "min-h-[51px] h-[51px]",
              getBorderClass({})
            )}
          />
        </div>

        {!isRecurring && (
          <div className={cn(isMobile && "mt-3 mb-1")}>
            <RevenueStatusToggle
              status={status}
              setStatus={(val) => setStatus(val as ReceitaStatus)}
              isMobile={isMobile}
            />
          </div>
        )}

        {/* Submit Button Logic */}
        <div>
          <Button
            type={isExpired ? "button" : "submit"}
            form={isExpired ? undefined : "income-form"}
            onClick={isExpired ? handleBlockedClick : undefined}
            className={cn(
              "w-full rounded-xl btn-3d font-extrabold tracking-[0.5px] text-white border-none transition-all active:scale-95 shadow-[0_2px_4px_rgba(0,0,0,0.05)] text-lg flex items-center justify-center gap-2",
              isMobile ? "h-11 text-lg" : "h-12 text-lg",
              isExpired && "opacity-80"
            )}
            style={{ "--cor-topo": "#25AF6A", "--cor-base": "#1AA361", fontFamily: "'Inter', sans-serif" } as any}
            disabled={!isExpired && loading}
          >
            <Save className="h-5 w-5" strokeWidth={2.5} />
            {loading && !isExpired ? "Salvando..." : "Salvar Receita"}
            {isExpired && <span className="ml-1.5 text-base">🔒</span>}
          </Button>
        </div>
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

  if (isLoadingRevenues || isLoadingCategories) {
    return (
      <div className="flex-grow flex items-center justify-center min-h-[400px]">
        <div className="animate-pulse text-muted-foreground">
          Carregando Receitas...
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col min-h-screen md:pt-[72px]",
        isMobile ? "bg-white" : "global-bg"
      )}
    >

      {/* HEADER PREMIUM — FINTECH STYLE (RECEITAS THEME) */}
      {!isMobile && (
        <div className="relative h-[220px] w-full overflow-hidden bg-transparent">
          <div className="container-app relative z-10 pt-[28px] md:pt-[42px] flex justify-between items-start">
            <div>
              <div className="flex items-start gap-3">
                <Button
                  variant="ghost"
                  className="btn-3d btn-3d-icon border-none mt-1 p-2 rounded-xl flex items-center justify-center cursor-pointer hover:scale-105 active:scale-95 transition-all h-auto w-auto"
                  style={{ "--cor-topo": "#FFFFFF", "--cor-base": "#F1F5F9" } as any}
                  onClick={() => navigate("/lancamentos?type=income")}
                >
                  <DynamicIcon
                    name="TrendingUp"
                    className="!text-[#1AA361] h-6 w-6"
                    strokeWidth={4}
                  />
                </Button>
                <div className="flex flex-col">
                  <h1 className="font-extrabold tracking-[0.5px] -mt-0.5 text-2xl text-[#1AA361]" style={{ fontFamily: "'Inter', sans-serif" }}>
                    Nova Receita
                  </h1>
                  <p className="text-sm font-bold text-slate-500 -mt-0.5 tracking-wider opacity-80">
                    Registre seus ganhos
                  </p>
                </div>
              </div>
            </div>

            <Button
              onClick={() => navigate(-1)}
              className="btn-3d h-9 px-3 rounded-xl font-black text-xs shadow-sm border-none transition-all active:scale-95 !text-[#1AA361] bg-white hover:bg-white/90"
              style={{ "--cor-topo": "#FFFFFF", "--cor-base": "#F1F5F9" } as any}
            >
              <DynamicIcon name="ChevronLeft" className="mr-1 h-4 w-4 !text-[#1AA361]" strokeWidth={3} />
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
          <div className="!fixed top-[56px] left-0 right-0 pt-0 pb-0 bottom-0 overflow-hidden z-30 container-app bg-white">
            <div className="h-full overflow-y-auto [&::-webkit-scrollbar]:hidden pb-0 px-0 pt-1">
              <div className="flex flex-col gap-6 pb-6 px-[2px]">
                <div className="flex justify-between items-start pt-2">
                  <div className="flex items-start gap-3">
                    <Button
                      variant="ghost"
                      className="w-9 h-9 p-0 flex items-center justify-center cursor-pointer rounded-xl border-none transition-all hover:scale-105 active:scale-90 shrink-0 mt-0"
                      style={{ background: "#1AA361", filter: "saturate(0.95)", boxShadow: "0 6px 14px rgba(0,0,0,0.12)" }}
                      onClick={() => navigate("/lancamentos?type=income")}
                    >
                      <DynamicIcon
                        name="TrendingUp"
                        className="h-[18px] w-[18px] !text-white"
                        strokeWidth={3}
                      />
                    </Button>
                    <div className="flex flex-col">
                      <h1 className="font-extrabold tracking-[0.5px] -mt-0.5 text-xl text-[#1AA361]" style={{ fontFamily: "'Inter', sans-serif" }}>
                        Nova Receita
                      </h1>
                      <p className="font-medium -mt-0.5 leading-none text-xs text-slate-500">
                        Registre seus ganhos
                      </p>
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    onClick={() => navigate(-1)}
                    className="h-8 px-2 font-black text-sm transition-all active:scale-95 !text-[#1AA361] hover:bg-transparent bg-transparent border-none p-0 shadow-none"
                  >
                    <DynamicIcon name="ArrowLeft" className="mr-1.5 h-4 w-4 !text-[#1AA361]" strokeWidth={3} />
                    Voltar
                  </Button>
                </div>

                {oneOffFormContent}
              </div>
              <div style={{ marginTop: "-12px", marginBottom: "0px" }}>
                <Footer isMobile={isMobile} user={user} />
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.6fr] gap-6">
            <div className="space-y-6">
              <Card
                className="p-6 lg:px-6 rounded-[24px] shadow-sm card-receitas"
                style={{ backgroundColor: "#FFFFFF" }}
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
