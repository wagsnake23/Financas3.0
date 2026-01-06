import { useState, useEffect, useMemo } from "react";
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
import { toast } from "sonner";
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

import { Database } from "@/integrations/supabase/types";
import { MonthlyRevenueBarChart } from "@/components/MonthlyRevenueBarChart";
import { RevenueStatusToggle } from "@/components/revenue-form/RevenueStatusToggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
type ReceitaStatus = Database["public"]["Enums"]["receita_status"];

const UNSELECTED_VALUE = "unselected";
const RECURRING_INSTALLMENTS_COUNT = 120;
const toastDuration = 1000;
const toastSuccessStyle = { backgroundColor: "#F3FFF3", color: "#006000" };
const toastErrorStyle = { backgroundColor: "#F3FFF3", color: "#FF2929" };

export default function Receitas() {
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

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
      return data;
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
        return data as AppCategory[];
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
      toast.error("Usuário não autenticado.", {
        duration: toastDuration,
        style: toastErrorStyle,
      });
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
      toast.error("Preencha todos os campos obrigatórios", {
        duration: toastDuration,
        style: toastErrorStyle,
      });
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

      toast.success("Receita adicionada com sucesso!", {
        style: toastSuccessStyle,
        duration: toastDuration,
      });
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
      toast.error("Erro ao adicionar receita", {
        description: error.message,
        duration: toastDuration,
        style: toastErrorStyle,
      });
      console.error("Supabase error adding revenue:", error);
    } finally {
      setLoading(false);
    }
  };

  const oneOffFormContent = (
    <form
      onSubmit={handleSubmitOneOff}
      className={cn("w-full", isMobile ? "space-y-4" : "space-y-4")}
    >
      <div className={cn("space-y-2 -mt-1", isMobile && "w-[92%] mx-auto")}>
        <ToggleGroup
          type="single"
          value={isRecurring ? "recorrente" : "avulsa"}
          onValueChange={handleToggleChange}
          className={cn("w-full justify-center", isMobile && "gap-x-2")}
        >
          <ToggleGroupItem
            value="avulsa"
            className={cn(
              "flex-1 rounded-xl flex items-center justify-center border transition-all duration-200",
              "data-[state=on]:bg-[#25AF6A] data-[state=on]:text-white data-[state=on]:font-bold data-[state=on]:border-none",
              "data-[state=off]:bg-transparent data-[state=off]:border-border data-[state=off]:text-muted-foreground",
              isMobile && "h-8 py-0.5 text-sm"
            )}
          >
            <DynamicIcon
              name="⚡"
              className={cn(
                "mr-2 h-4 w-4 transition-colors",
                !isRecurring ? "text-white" : "text-muted-foreground"
              )}
            />{" "}
            Avulsa
          </ToggleGroupItem>
          <ToggleGroupItem
            value="recorrente"
            className={cn(
              "flex-1 rounded-xl flex items-center justify-center border transition-all duration-200",
              "data-[state=on]:bg-[#25AF6A] data-[state=on]:text-white data-[state=on]:font-bold data-[state=on]:border-none",
              "data-[state=off]:bg-transparent data-[state=off]:border-border data-[state=off]:text-muted-foreground",
              isMobile && "h-8 py-0.5 text-sm"
            )}
          >
            <DynamicIcon
              name="🔁"
              className={cn(
                "mr-2 h-4 w-4 transition-colors",
                isRecurring ? "text-white" : "text-muted-foreground"
              )}
            />{" "}
            Recorrente
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className={cn(isMobile && "w-[92%] mx-auto")}>
        <Label htmlFor="tipo" className={cn("text-gray-500 font-medium mb-1.5 inline-block", isMobile && "text-xs")}>
          Subcategoria de Receita
        </Label>
        <Select
          value={tipoReceitaId}
          onValueChange={(value) => {
            setTipoReceitaId(value);
            setValidationErrors((prev) => ({ ...prev, tipoReceitaId: false }));
          }}
        >
          <SelectTrigger
            className={cn(
              "rounded-xl bg-white border-[#E5E7EB] text-gray-800 font-medium transition-all duration-200",
              "focus:border-[#A8C5FF] focus:ring-4 focus:ring-[#A8C5FF]/10",
              isMobile ? "h-9 text-sm" : "h-10",
              getBorderClass({
                isInvalid: validationErrors.tipoReceitaId,
                isValid: validationErrors.tipoReceitaId === false,
              })
            )}
          >
            <SelectValue placeholder="Selecione a subcategoria de receita" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              value={UNSELECTED_VALUE}
              disabled
              className={cn(isMobile && "text-sm")}
            >
              Selecione a subcategoria de receita
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
      </div>

      <div className={cn(isMobile && "w-[92%] mx-auto")}>
        <Label htmlFor="data" className={cn("text-gray-500 font-medium mb-1.5 inline-block", isMobile && "text-xs")}>
          Data
        </Label>
        <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
          <PopoverTrigger asChild>
            <Button
              variant={"outline"}
              className={cn(
                "w-full justify-start text-left font-normal transition-all duration-200",
                "rounded-xl bg-white border-[#E5E7EB] text-gray-800 font-medium",
                "focus:border-[#A8C5FF] focus:ring-4 focus:ring-[#A8C5FF]/10",
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

      <div className={cn(isMobile && "w-[92%] mx-auto")}>
        <Label htmlFor="valor" className={cn("text-gray-500 font-medium mb-1.5 inline-block", isMobile && "text-xs")}>
          Valor (R$)
        </Label>
        <CurrencyBR
          value={valor}
          onChange={(v) => {
            setValor(v);
            setValidationErrors((prev) => ({ ...prev, valor: false }));
          }}
          className={cn(
            "w-full rounded-xl bg-white border-[#E5E7EB] text-gray-800 font-medium transition-all duration-200",
            "focus:border-[#A8C5FF] focus:ring-4 focus:ring-[#A8C5FF]/10 focus:bg-white",
            isMobile ? "h-9 text-sm" : "h-10",
            getBorderClass({
              isInvalid: validationErrors.valor,
              isValid: validationErrors.valor === false,
            })
          )}
        />
      </div>

      <div className={cn(isMobile && "w-[92%] mx-auto")}>
        <Label htmlFor="descricao" className={cn("text-gray-500 font-medium mb-1.5 inline-block", isMobile && "text-xs")}>
          Descrição
        </Label>
        <Textarea
          id="descricao"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="Detalhes sobre a receita..."
          rows={3}
          className={cn(
            "w-full rounded-xl bg-white border-[#E5E7EB] text-gray-800 font-medium placeholder:text-gray-400 transition-all duration-200",
            "focus:border-[#A8C5FF] focus:ring-4 focus:ring-[#A8C5FF]/10 focus:bg-white resize-none",
            isMobile ? "text-sm p-4" : "",
          )}
        />
      </div>

      {!isRecurring && (
        <div className={cn("space-y-2", isMobile && "w-[92%] mx-auto")}>
          <RevenueStatusToggle
            status={status}
            setStatus={(val) => setStatus(val as ReceitaStatus)}
            isMobile={isMobile}
          />
        </div>
      )}

      <div className={cn(isMobile && "w-[92%] mx-auto")}>
        <Button
          type="submit"
          className={cn(
            "w-full rounded-xl btn-3d font-bold text-white border-none transition-all active:scale-95 shadow-md",
            isMobile ? "h-9 text-sm" : "h-11 text-base"
          )}
          style={{ "--cor-topo": "#36E391", "--cor-base": "#1AA361" } as any}
          disabled={loading}
        >
          {loading ? "Salvando..." : "Salvar Receita"}
        </Button>
      </div>
    </form>
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
        "flex flex-col min-h-screen bg-[#F9FAFB] pt-14 md:pt-16",
        isMobile && "bg-[#F9FAFB]"
      )}
    >
      <Navigation />

      {/* HEADER PREMIUM — FINTECH STYLE (RECEITAS THEME) */}
      <div className="relative h-[200px] w-full bg-gradient-to-b from-[#1AA361] via-[#48DE95] to-[#F9FAFB] overflow-hidden">
        <div className="container mx-auto px-6 pt-3 md:pt-7 relative z-10">
          <div>
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-[#F0FFF4] shadow-sm flex items-center justify-center border border-[#25AF6A]/20 mt-1">
                <DynamicIcon
                  name="TrendingUp"
                  className="h-5 w-5 text-[#25AF6A]"
                />
              </div>
              <div className="flex flex-col">
                <h1 className="text-xl font-black text-white tracking-tight -mt-0.5">
                  Nova Receita
                </h1>
                <p className="text-sm text-white font-medium mt-0.5 leading-none">
                  Registre suas entradas financeiras
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <main
        className={cn(
          "container mx-auto px-4 -mt-32 relative z-20 max-w-[1200px] space-y-6 pb-20",
          !isMobile && "px-6"
        )}
      >
        <div className="flex flex-col space-y-6">
          <Card className={cn(
            "p-6 rounded-2xl shadow-sm w-full bg-[#FCFCFD] border border-gray-200",
            isMobile && "rounded-2xl max-h-[calc(100vh-150px)] overflow-y-auto"
          )}>
            {!isMobile && (
              <h2 className="text-xl font-semibold mb-6 flex items-center gap-2 text-success">
                <div className="p-2 rounded-full bg-soft-green/50 flex items-center justify-center">
                  <DynamicIcon
                    name="TrendingUp"
                    className="h-6 w-6 text-success"
                  />
                </div>
                Nova Receita
              </h2>
            )}
            {oneOffFormContent}
          </Card>

          {!isMobile && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              <TotalRevenueCard
                revenues={revenues}
                chartContent={
                  <MonthlyRevenueBarChart
                    revenues={revenues}
                    currentDate={new Date()} // Or selected month if available
                    isMobile={true}
                    onMonthClick={() => { }} // No action for now
                  />
                }
                annualTotalValue={revenues
                  .filter(r => new Date(r.data).getFullYear() === new Date().getFullYear())
                  .reduce((sum, r) => sum + r.valor, 0)
                }
              />

              <RevenueByTypeChart
                revenues={revenues}
                revenueTypes={incomeSubcategories}
              />
            </div>
          )}
        </div>
      </main>
      <Footer
        isMobile={isMobile}
        className={cn(isMobile ? "fixed bottom-0 left-0 right-0 py-2 bg-[#F9FAFB] z-50 m-0" : "mt-8")}
        user={user}
      />
    </div>
  );
}
