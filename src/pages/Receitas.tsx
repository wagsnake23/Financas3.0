import { useState, useEffect, useMemo } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
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
import { TotalRevenueCard } => "@/components/TotalRevenueCard";
import { RevenueByTypeChart } from "@/components/RevenueByTypeChart";
import DynamicIcon from "@/components/DynamicIcon";
import { AppCategory } from "@/types/finance";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Footer } from "@/components/Footer";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"; // Importar RadioGroup
import { RecurringEntryFormContent } from "@/components/RecurringEntryFormContent"; // Importar o novo componente

// Import the new enum type
import { Database, Enums } from "@/integrations/supabase/types";
type ReceitaStatus = Database['public']['Enums']['receita_status'];
type FormMode = 'one-off' | 'recurring'; // Novo tipo para o modo do formulário

const UNSELECTED_VALUE = "unselected"; // Valor único para representar 'não selecionado'

export default function Receitas() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  // Form mode state
  const [formMode, setFormMode] = useState<FormMode>('one-off');

  // Form states for one-off revenue
  const [tipoReceitaId, setTipoReceitaId] = useState(UNSELECTED_VALUE);
  const [valor, setValor] = useState("");
  const [data, setData] = useState<Date | undefined>(new Date());
  const [descricao, setDescricao] = useState("");
  const [status, setStatus] = useState<ReceitaStatus>('Pendente');
  const [loading, setLoading] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  // Fetch receitas using Tanstack Query
  const { data: revenues = [], isLoading: isLoadingRevenues } = useQuery<Tables<'receitas'>[]>({
    queryKey: ["revenues", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("receitas")
        .select("*, is_fixed, recurrence_frequency, recurrence_installments_count, status")
        .eq("user_id", user.id)
        .order("data", { ascending: false });
      if (error) throw error;
      return data.filter(r => !r.is_fixed); // Filter out legacy fixed revenues
    },
    enabled: !!user?.id,
  });

  // Fetch ALL categories from Supabase (user-specific and default ones with user_id: null)
  const { data: fetchedCategories = [], isLoading: isLoadingCategories } = useQuery<AppCategory[]>({
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
    enabled: !!user?.id,
  });

  // Filter for income-related categories (subcategories of 'Receitas e Investimentos' root)
  const incomeSubcategories = useMemo(() => {
    return fetchedCategories.filter(cat => cat.parent_id === 'receitas_e_investimentos');
  }, [fetchedCategories]);

  const handleSubmitOneOff = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (!valor || !data || tipoReceitaId === UNSELECTED_VALUE) {
      toast.error("Preencha todos os campos obrigatórios");
      setLoading(false);
      return;
    }

    const formattedDate = data 
      ? `${data.getFullYear()}-${(data.getMonth() + 1).toString().padStart(2, '0')}-${data.getDate().toString().padStart(2, '0')}` 
      : "";

    const newRevenueData = {
      user_id: user?.id,
      tipo_receita_id: tipoReceitaId,
      valor: parseFloat(valor),
      data: formattedDate,
      descricao,
      status,
      is_fixed: false,
      recurrence_frequency: null,
      recurrence_installments_count: null,
    };

    const { error } = await supabase.from("receitas").insert(newRevenueData);

    if (error) {
      toast.error("Erro ao adicionar receita", { description: error.message });
      console.error("Supabase error adding revenue:", error);
    } else {
      toast.success("Receita adicionada com sucesso!", {
        style: { backgroundColor: 'hsl(var(--soft-green))', color: 'hsl(var(--success))' }
      });
      setTipoReceitaId(UNSELECTED_VALUE);
      setValor("");
      setData(new Date());
      setDescricao("");
      setStatus('Pendente');
      queryClient.invalidateQueries({ queryKey: ["revenues", user?.id] });
    }

    setLoading(false);
  };

  const handleRecurringFormSuccess = () => {
    setFormMode('one-off'); // Volta para o formulário avulso após o sucesso
    queryClient.invalidateQueries({ queryKey: ["recurringEntries", user?.id] });
    queryClient.invalidateQueries({ queryKey: ["transactions"] }); // Invalida o cache de transações para o useTransactionsData
  };

  const oneOffFormContent = (
    <form onSubmit={handleSubmitOneOff} className="space-y-4">
      <div>
        <Label htmlFor="tipo" className={cn(isMobile && "text-xs")}>Tipo de Receita</Label>
        <div className="flex gap-2">
          <Select value={tipoReceitaId} onValueChange={setTipoReceitaId}>
            <SelectTrigger className={cn(isMobile && "h-9 text-sm")}>
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
                "w-full justify-start text-left font-normal h-10",
                !data && "text-muted-foreground",
                isMobile && "h-9 text-sm"
              )}
            >
              <CalendarIcon className={cn("mr-2 h-4 w-4", isMobile && "h-3.5 w-3.5")} />
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
        <Input
          id="valor"
          type="number"
          step="0.01"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          required
          placeholder="0,00"
          className={cn(isMobile && "h-9 text-sm")}
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
          className={cn(isMobile && "text-sm")}
        />
      </div>

      <div>
        <Label htmlFor="status" className={cn(isMobile && "text-xs")}>Status da Receita</Label>
        <Select value={status} onValueChange={(value: ReceitaStatus) => setStatus(value)}>
          <SelectTrigger className={cn(isMobile && "h-9 text-sm")}>
            <SelectValue placeholder="Selecione o status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Prevista" className={cn(isMobile && "text-sm")}>Prevista</SelectItem>
            <SelectItem value="Pendente" className={cn(isMobile && "text-sm")}>Pendente</SelectItem>
            <SelectItem value="Recebida" className={cn(isMobile && "text-sm")}>Recebida</SelectItem>
            <SelectItem value="Cancelada" className={cn(isMobile && "text-sm")}>Cancelada</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Button type="submit" className={cn("w-full", isMobile && "h-9 text-sm")} disabled={loading}>
        {loading ? "Salvando..." : "Salvar Receita"}
      </Button>
    </form>
  );

  if (isLoadingRevenues || isLoadingCategories) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Carregando Receitas...</div>
      </div>
    );
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-success/5 pt-16">
        <Navigation />
        <div className="max-w-4xl mx-auto p-6 space-y-6">
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
              <div className="px-4 pt-0">
                <h2 className="text-xl font-semibold mb-4">Nova Receita</h2>
                <RadioGroup
                  value={formMode}
                  onValueChange={(value: FormMode) => setFormMode(value)}
                  className="grid grid-cols-2 gap-2 mb-4"
                >
                  <Label
                    htmlFor="one-off-revenue"
                    className={cn(
                      "flex items-center justify-center rounded-md border-2 border-muted bg-popover hover:bg-accent hover:text-accent-foreground [&:has([data-state=checked])]:border-success",
                      isMobile ? "py-1.5 px-3 text-xs" : "py-2 px-4 text-sm" // Menor padding
                    )}
                  >
                    <RadioGroupItem value="one-off" id="one-off-revenue" className="sr-only" />
                    <DynamicIcon name="DollarSign" className={cn("mr-1", isMobile ? "h-4 w-4" : "h-5 w-5")} color="hsl(var(--success))" />
                    <span>Avulsa</span>
                  </Label>
                  <Label
                    htmlFor="recurring-revenue"
                    className={cn(
                      "flex items-center justify-center rounded-md border-2 border-muted bg-popover hover:bg-accent hover:text-accent-foreground [&:has([data-state=checked])]:border-primary",
                      isMobile ? "py-1.5 px-3 text-xs" : "py-2 px-4 text-sm" // Menor padding
                    )}
                  >
                    <RadioGroupItem value="recurring" id="recurring-revenue" className="sr-only" />
                    <DynamicIcon name="Repeat" className={cn("mr-1", isMobile ? "h-4 w-4" : "h-5 w-5")} color="hsl(var(--primary))" />
                    <span>Recorrente</span>
                  </Label>
                </RadioGroup>
                {formMode === 'one-off' ? (
                  oneOffFormContent
                ) : (
                  <RecurringEntryFormContent
                    isMobile={isMobile}
                    onSuccess={handleRecurringFormSuccess}
                    fetchedCategories={fetchedCategories}
                    isLoadingCategories={isLoadingCategories}
                    initialType="receita"
                  />
                )}
                <Footer isMobile={isMobile} />
              </div>
            ) : (
              <Card className="p-6">
                <h2 className="text-xl font-semibold mb-4">Nova Receita</h2>
                <RadioGroup
                  value={formMode}
                  onValueChange={(value: FormMode) => setFormMode(value)}
                  className="grid grid-cols-2 gap-2 mb-4"
                >
                  <Label
                    htmlFor="one-off-revenue-desktop"
                    className={cn(
                      "flex items-center justify-center rounded-md border-2 border-muted bg-popover hover:bg-accent hover:text-accent-foreground [&:has([data-state=checked])]:border-success",
                      "py-2 px-4 text-sm" // Desktop size, menor padding
                    )}
                  >
                    <RadioGroupItem value="one-off" id="one-off-revenue-desktop" className="sr-only" />
                    <DynamicIcon name="DollarSign" className="mr-1 h-5 w-5" color="hsl(var(--success))" />
                    <span>Receita Avulsa</span>
                  </Label>
                  <Label
                    htmlFor="recurring-revenue-desktop"
                    className={cn(
                      "flex items-center justify-center rounded-md border-2 border-muted bg-popover hover:bg-accent hover:text-accent-foreground [&:has([data-state=checked])]:border-primary",
                      "py-2 px-4 text-sm" // Desktop size, menor padding
                    )}
                  >
                    <RadioGroupItem value="recurring" id="recurring-revenue-desktop" className="sr-only" />
                    <DynamicIcon name="Repeat" className="mr-1 h-5 w-5" color="hsl(var(--primary))" />
                    <span>Receita Recorrente</span>
                  </Label>
                </RadioGroup>
                {formMode === 'one-off' ? (
                  oneOffFormContent
                ) : (
                  <RecurringEntryFormContent
                    isMobile={isMobile}
                    onSuccess={handleRecurringFormSuccess}
                    fetchedCategories={fetchedCategories}
                    isLoadingCategories={isLoadingCategories}
                    initialType="receita"
                  />
                )}
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
      </div>
      {!isMobile && <Footer isMobile={isMobile} />}
    </ProtectedRoute>
  );
}