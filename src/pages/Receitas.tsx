import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { CalendarIcon } from "lucide-react"; // Linha corrigida aqui
import { cn, getBorderClass, formatInTimeZone, TARGET_TIMEZONE } from "@/lib/utils"; // Importar formatInTimeZone e TARGET_TIMEZONE
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Footer } from "@/components/Footer";
import CurrencyBR from "@/components/ui/currency-br"; // Importar CurrencyBR

import { Database } from "@/integrations/supabase/types";
import { RevenueStatusToggle } from "@/components/revenue-form/RevenueStatusToggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
type ReceitaStatus = Database['public']['Enums']['receita_status'];

const UNSELECTED_VALUE = "unselected";
const RECURRING_INSTALLMENTS_COUNT = 120;
const toastDuration = 1000; // 1 segundo para todos os dispositivos
const toastSuccessStyle = { backgroundColor: '#F3FFF3', color: '#006000' };
const toastErrorStyle = { backgroundColor: '#F3FFF3', color: '#FF2929' };

export default function Receitas() {
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  const [tipoReceitaId, setTipoReceitaId] = useState(UNSELECTED_VALUE);
  const [valor, setValor] = useState<number | undefined>(undefined);
  const [data, setData] = useState<Date | undefined>(new Date());
  const [descricao, setDescricao] = useState("");
  const [status, setStatus] = useState<ReceitaStatus>('Pendente');
  const [loading, setLoading] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, boolean>>({}); // NOVO ESTADO

  const { data: revenues = [], isLoading: isLoadingRevenues } = useQuery<Tables<'receitas'>[]>({
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

  const { data: fetchedCategories = [], isLoading: isLoadingCategories } = useQuery<AppCategory[]>({
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
    return fetchedCategories.filter(cat => cat.parent_id === 'receitas_e_investimentos');
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
      toast.error("Usuário não autenticado.", { duration: toastDuration, style: toastErrorStyle });
      setLoading(false);
      return;
    }
    
    if (valor === undefined || valor <= 0) { // Adicionado validação para valor > 0
      newErrors.valor = true;
      hasError = true;
    } else {
      newErrors.valor = false; // Mark as valid
    }
    if (!data) {
      newErrors.data = true;
      hasError = true;
    } else {
      newErrors.data = false; // Mark as valid
    }
    if (tipoReceitaId === UNSELECTED_VALUE) {
      newErrors.tipoReceitaId = true;
      hasError = true;
    } else {
      newErrors.tipoReceitaId = false; // Mark as valid
    }

    setValidationErrors(newErrors); // Atualiza os erros de validação

    if (hasError) {
      toast.error("Preencha todos os campos obrigatórios", { duration: toastDuration, style: toastErrorStyle });
      setLoading(false);
      return;
    }

    const formattedDate = data 
      ? formatInTimeZone(data, TARGET_TIMEZONE, 'yyyy-MM-dd') // Usar formatInTimeZone
      : "";

    let masterRevenueId: string | null = null;

    try {
      if (isRecurring) {
        const recurrenceDay = getDate(data);
        // 1. Create the master recurring revenue entry (this will be the first occurrence)
        const { data: masterData, error: masterError } = await supabase
          .from("receitas")
          .insert({
            user_id: user?.id,
            tipo_receita_id: tipoReceitaId === UNSELECTED_VALUE ? null : tipoReceitaId,
            valor: valor as number,
            data: formattedDate, // Data da primeira ocorrência
            descricao,
            status: 'Prevista', // Master é sempre 'Prevista'
            is_recurring_master: true,
            recurrence_day: recurrenceDay,
          })
          .select()
          .single();

        if (masterError) throw masterError;
        masterRevenueId = masterData.id;

        // Atualiza o registro mestre para referenciar a si mesmo como recurrence_id
        const { error: updateMasterError } = await supabase
          .from("receitas")
          .update({ recurrence_id: masterRevenueId })
          .eq("id", masterRevenueId);
        
        if (updateMasterError) throw updateMasterError;

        // 2. Call RPC to generate ALL occurrences, including the first one (which is the master itself)
        const { error: rpcError } = await supabase.rpc('generate_recurring_entries', {
          p_user_id: user?.id,
          p_transaction_type: 'income',
          p_master_id: masterRevenueId,
          p_first_occurrence_date: formattedDate, // Already a 'YYYY-MM-DD' string
          p_monthly_amount: valor as number,
          p_category_id: tipoReceitaId === UNSELECTED_VALUE ? null : tipoReceitaId,
          p_description: descricao,
          p_status: 'Prevista', // Required enum value
          p_recurrence_day: recurrenceDay,
          p_total_installments: RECURRING_INSTALLMENTS_COUNT,
          p_forma_pagamento: null,
          p_cartao_id: null,
          p_tipo_pagamento: null,
        });

        if (rpcError) throw rpcError;

      } else {
        // Create a one-off revenue entry (as before)
        const newRevenueData = {
          user_id: user?.id,
          tipo_receita_id: tipoReceitaId === UNSELECTED_VALUE ? null : tipoReceitaId,
          valor: valor as number,
          data: formattedDate,
          descricao,
          status,
          is_recurring_master: false,
          recurrence_id: null,
          recurrence_day: null,
        };

        const { error } = await supabase.from("receitas").insert(newRevenueData);
        if (error) throw error;
      }

      toast.success("Receita adicionada com sucesso!", {
        style: toastSuccessStyle,
        duration: toastDuration
      });
      setTipoReceitaId(UNSELECTED_VALUE);
      setValor(undefined);
      setData(new Date());
      setDescricao("");
      setStatus('Pendente');
      setIsRecurring(false);
      setValidationErrors({}); // Limpa os erros após o sucesso
      queryClient.invalidateQueries({ queryKey: ["revenues", user?.id] });

    } catch (error: any) {
      toast.error("Erro ao adicionar receita", { description: error.message, duration: toastDuration, style: toastErrorStyle });
      console.error("Supabase error adding revenue:", error);
    } finally {
      setLoading(false);
    }
  };

  const oneOffFormContent = (
    <form onSubmit={handleSubmitOneOff} className={cn("w-full", isMobile ? "space-y-3" : "space-y-4")}>
      {isMobile && ( // Título para mobile
        <h2 className={cn("text-xl font-semibold mb-4 flex items-center gap-2 text-success")}>
          <div className="p-2 rounded-full bg-soft-green/50 flex items-center justify-center">
            <DynamicIcon name="TrendingUp" className="h-6 w-6 text-success" />
          </div>
          Nova Receita
        </h2>
      )}
      <div className="space-y-2">
        <Label className={cn(isMobile && "text-xs")}>Tipo de Lançamento</Label>
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
              "data-[state=on]:bg-primary data-[state=on]:border-primary data-[state=on]:text-primary-foreground data-[state=on]:font-bold",
              "data-[state=off]:bg-transparent data-[state=off]:border-border data-[state=off]:text-muted-foreground",
              isMobile && "h-8 py-0.5 text-sm" // Aumentado o tamanho da fonte para mobile
            )}
          >
            <DynamicIcon 
              name="⚡" 
              className={cn(
                "mr-2 h-4 w-4",
                "data-[state=on]:text-primary-foreground data-[state=off]:text-muted-foreground"
              )} 
            /> Avulsa
          </ToggleGroupItem>
          <ToggleGroupItem 
            value="recorrente" 
            className={cn(
                "flex-1 rounded-xl flex items-center justify-center border",
                "data-[state=on]:bg-primary data-[state=on]:border-primary data-[state=on]:text-primary-foreground data-[state=on]:font-bold",
                "data-[state=off]:bg-transparent data-[state=off]:border-border data-[state=off]:text-muted-foreground",
                isMobile && "h-8 py-0.5 text-sm" // Aumentado o tamanho da fonte para mobile
              )}
            >
              <DynamicIcon 
                name="🔁" 
                className={cn(
                  "mr-2 h-4 w-4",
                  "data-[state=on]:text-primary-foreground data-[state=off]:text-muted-foreground"
                )} 
              /> Recorrente
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        <div>
          <Label htmlFor="tipo" className={cn(isMobile && "text-xs")}>Subcategoria de Receita</Label>
          <div className="flex gap-2">
            <Select 
              value={tipoReceitaId} 
              onValueChange={(value) => {
                setTipoReceitaId(value);
                setValidationErrors(prev => ({ ...prev, tipoReceitaId: false })); // Limpa erro ao mudar
              }}
            >
              <SelectTrigger className={cn(
                "w-full rounded-xl", 
                isMobile && "h-9 text-sm", 
                getBorderClass({ isInvalid: validationErrors.tipoReceitaId, isValid: validationErrors.tipoReceitaId === false })
              )}>
                <SelectValue placeholder="Selecione a subcategoria de receita" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNSELECTED_VALUE} disabled className={cn(isMobile && "text-sm")}>Selecione a subcategoria de receita</SelectItem>
                {incomeSubcategories.length === 0 ? (
                  <SelectItem value={UNSELECTED_VALUE} disabled className={cn(isMobile && "text-sm")}>Nenhum tipo de receita disponível</SelectItem>
                ) : (
                  incomeSubcategories
                    .map((tipo) => (
                      <SelectItem key={tipo.id} value={tipo.id} className={cn(isMobile && "text-sm")}>
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
        </div>

        <div>
          <Label htmlFor="data" className={cn(isMobile && "text-xs")}>Data</Label>
          <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
            <PopoverTrigger asChild>
              <Button
                variant={"outline"}
                className={cn(
                  "w-full justify-start text-left font-normal h-10 rounded-xl",
                  !data && "text-muted-foreground",
                  isMobile && "h-9 text-sm",
                  getBorderClass({ isInvalid: validationErrors.data, isValid: validationErrors.data === false })
                )}
              >
                <DynamicIcon name="📅" className={cn("mr-2 h-4 w-4 text-primary", isMobile && "h-3.5 w-3.5")} /> {/* Ícone de emoji colorido */}
                {data ? format(data, "PPP", { locale: ptBR }) : <span>Selecione uma data</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className={cn("w-auto p-0", isMobile && "p-1")}>
              <Calendar
                mode="single"
                selected={data}
                onSelect={(date) => {
                  setData(date);
                  setIsCalendarOpen(false);
                  setValidationErrors(prev => ({ ...prev, data: false })); // Limpa erro ao selecionar
                }}
                initialFocus
                locale={ptBR}
                showOutsideDays={false}
                className={cn(isMobile && "text-sm")}
              />
            </PopoverContent>
          </Popover>
        </div>

        <div>
          <Label htmlFor="valor" className={cn(isMobile && "text-xs")}>Valor (R$)</Label>
          <CurrencyBR
            value={valor}
            onChange={(v) => {
              setValor(v);
              setValidationErrors(prev => ({ ...prev, valor: false })); // Limpa erro ao digitar
            }}
            className={cn(
              "w-full rounded-xl", 
              isMobile && "h-9 text-sm", 
              getBorderClass({ isInvalid: validationErrors.valor, isValid: validationErrors.valor === false })
            )} 
          />
        </div>

        <div>
          <Label htmlFor="descricao" className={cn(isMobile && "text-xs")}>Descrição</Label>
          <Textarea
            id="descricao"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Detalhes sobre a receita..."
            rows={3}
            className={cn("w-full rounded-xl", isMobile && "text-sm")}
          />
        </div>

        {!isRecurring && (
          <RevenueStatusToggle
            status={status}
            setStatus={setStatus}
            isMobile={isMobile}
            className={cn(isMobile && "w-full")}
          />
        )}

        <Button type="submit" className={cn("w-full rounded-xl", isMobile && "h-9 text-sm")} disabled={loading}>
          {loading ? "Salvando..." : "Salvar Receita"}
        </Button>
      </form>
    );

    if (authLoading || isLoadingRevenues || isLoadingCategories) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-pulse text-muted-foreground">Carregando Receitas...</div>
        </div>
      );
    }

    return (
      <div className={cn("flex flex-col min-h-screen bg-background pt-16", isMobile && "bg-lancamentos-mobile-bg")}>
          <Navigation />
          <div className={cn("mx-auto space-y-6 flex-grow", isMobile ? "p-4 pt-2" : "max-w-[1200px] px-6 py-8")}>
            {!isMobile && (
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold">Receitas</h1>
                  <p className="text-muted-foreground">Registre suas entradas financeiras</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
              {isMobile ? (
                <>
                  <Card className="w-full !max-w-full flex-shrink-0 rounded-xl shadow-none border-none"> {/* Removed p-4 here */}
                    {oneOffFormContent}
                  </Card>
                  <Footer isMobile={isMobile} className={cn(isMobile && "py-2")} user={user} />
                </>
              ) : (
                <Card className="p-6 rounded-xl shadow-sm max-w-[700px] mx-auto">
                  <h2 className="text-xl font-semibold mb-4 flex items-center gap-2"> {/* Adicionado flex items-center gap-2 */}
                    <div className="p-2 rounded-full bg-soft-green/50 flex items-center justify-center">
                      <DynamicIcon name="TrendingUp" className="h-6 w-6 text-success" />
                    </div>
                    Nova Receita
                  </h2>
                  {oneOffFormContent}
                </Card>
              )}

              {!isMobile && (
                <div className="flex flex-col h-full">
                  <TotalRevenueCard revenues={revenues} />
                  <div className="h-6" />
                  <div className="flex-grow" />
                  <RevenueByTypeChart revenues={revenues} revenueTypes={incomeSubcategories} />
                </div>
              )}
            </div>
          </div>
          {/* O Footer para desktop foi movido para cá, dentro do div principal do componente Receitas */}
          {!isMobile && <Footer isMobile={isMobile} user={user} />}
      </div>
    );
  }