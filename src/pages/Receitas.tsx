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
          .not("parent_id", "is", null)
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
      <div className={cn("space-y-2", isMobile && "w-[92%] mx-auto")}>
        <ToggleGroup
          type="single"
          value={isRecurring ? "recorrente" : "avulsa"}
          onValueChange={handleToggleChange}
          className={cn("w-full justify-center", isMobile && "gap-x-2")}
        >
          <ToggleGroupItem
            value="avulsa"
            className={cn(
              "flex-1 rounded-xl flex items-center justify-center border",
              "data-[state=on]:bg-success data-[state=on]:border-success data-[state=on]:text-success-foreground data-[state=on]:font-bold",
              "data-[state=off]:bg-transparent data-[state=off]:border-border data-[state=off]:text-muted-foreground",
              isMobile && "h-8 py-0.5 text-sm"
            )}
          >
            <DynamicIcon
              name="⚡"
              className={cn(
                "mr-2 h-4 w-4",
                "data-[state=on]:text-success-foreground data-[state=off]:text-muted-foreground"
              )}
            />{" "}
            Avulsa
          </ToggleGroupItem>
          <ToggleGroupItem
            value="recorrente"
            className={cn(
              "flex-1 rounded-xl flex items-center justify-center border",
              "data-[state=on]:bg-success data-[state=on]:border-success data-[state=on]:text-success-foreground data-[state=on]:font-bold",
              "data-[state=off]:bg-transparent data-[state=off]:border-border data-[state=off]:text-muted-foreground",
              isMobile && "h-8 py-0.5 text-sm"
            )}
          >
            <DynamicIcon
              name="🔁"
              className={cn(
                "mr-2 h-4 w-4",
                "data-[state=on]:text-success-foreground data-[state=off]:text-muted-foreground"
              )}
            />{" "}
            Recorrente
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className={cn(isMobile && "w-[92%] mx-auto")}>
        <Label htmlFor="tipo" className={cn(isMobile && "text-xs text-gray-600")}>
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
              "rounded-xl bg-[#F5F5F5]",
              isMobile ? "h-9 text-sm" : "",
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
        <Label htmlFor="data" className={cn(isMobile && "text-xs text-gray-600")}>
          Data
        </Label>
        <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
          <PopoverTrigger asChild>
            <Button
              variant={"outline"}
              className={cn(
                "w-full justify-start text-left font-normal h-10 rounded-xl bg-[#F5F5F5]",
                isMobile ? "h-9 text-sm" : "",
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
                  "mr-2 h-4 w-4 text-primary",
                  isMobile && "h-3.5 w-3.5"
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
        <Label htmlFor="valor" className={cn(isMobile && "text-xs text-gray-600")}>
          Valor (R$)
        </Label>
        <CurrencyBR
          value={valor}
          onChange={(v) => {
            setValor(v);
            setValidationErrors((prev) => ({ ...prev, valor: false }));
          }}
          className={cn(
            "w-full rounded-xl bg-[#F5F5F5]",
            isMobile ? "h-9 text-sm" : "",
            getBorderClass({
              isInvalid: validationErrors.valor,
              isValid: validationErrors.valor === false,
            })
          )}
        />
      </div>

      <div className={cn(isMobile && "w-[92%] mx-auto")}>
        <Label htmlFor="descricao" className={cn(isMobile && "text-xs text-gray-600")}>
          Descrição
        </Label>
        <Textarea
          id="descricao"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="Detalhes sobre a receita..."
          rows={3}
          className={cn(
            "w-full rounded-xl bg-[#F5F5F5] placeholder:text-gray-400",
            isMobile ? "text-sm" : "",
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
          variant="success"
          className={cn("w-full rounded-xl", isMobile && "h-9 text-sm")}
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
        "flex flex-col min-h-screen bg-background pt-16",
        isMobile && "bg-white text-black"
      )}
    >
      <Navigation />
      <div
        className={cn(
          "space-y-6 flex-grow",
          isMobile ? "w-full px-0 pt-0 pb-20" : "mx-auto max-w-[1200px] px-6 py-8"
        )}
      >
        {!isMobile && (
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Receitas</h1>
              <p className="text-muted-foreground">
                Registre suas entradas financeiras
              </p>
            </div>
          </div>
        )}

        {isMobile ? (
          <Card className="w-full !max-w-full m-0 p-6 rounded-none shadow-none border-none space-y-6 bg-white">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold flex items-center gap-2 text-success">
                <div className="p-2 rounded-full bg-soft-green/50 flex items-center justify-center">
                  <DynamicIcon name="TrendingUp" className="h-6 w-6 text-success" />
                </div>
                Nova Receita
              </h2>
            </div>

            {oneOffFormContent}
          </Card>
        ) : (
          <div className="flex flex-col space-y-6">
            <Card className="p-6 rounded-xl shadow-sm w-full">
              <h2 className="text-xl font-semibold mb-6 flex items-center gap-2 text-success">
                <div className="p-2 rounded-full bg-soft-green/50 flex items-center justify-center">
                  <DynamicIcon
                    name="TrendingUp"
                    className="h-6 w-6 text-success"
                  />
                </div>
                Nova Receita
              </h2>
              {oneOffFormContent}
            </Card>

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
          </div>
        )}
      </div>
      <Footer
        isMobile={isMobile}
        className={cn(isMobile ? "fixed bottom-0 left-0 right-0 py-2 bg-white/80 backdrop-blur-sm z-50 m-0" : "mt-8")}
        user={user}
      />
    </div>
  );
}
