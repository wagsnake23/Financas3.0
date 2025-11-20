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
import { TotalRevenueCard } from "@/components/TotalRevenueCard";
import { RevenueByTypeChart } from "@/components/RevenueByTypeChart";
import DynamicIcon from "@/components/DynamicIcon";
import { AppCategory } from "@/types/finance";
import { format, isValid } from "date-fns";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { RecurringEntryFormContent } from "@/components/RecurringEntryFormContent";
import { CurrencyInput } from "@/components/ui/currency-input";

import { Database, Enums } from "@/integrations/supabase/types";
import { RevenueStatusToggle } from "@/components/revenue-form/RevenueStatusToggle";
type ReceitaStatus = Database['public']['Enums']['receita_status'];
type FormMode = 'one-off' | 'recurring';

const UNSELECTED_VALUE = "unselected";

export default function Receitas() {
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  const [formMode, setFormMode] = useState<FormMode>('one-off');

  const [tipoReceitaId, setTipoReceitaId] = useState(UNSELECTED_VALUE);
  const [valor, setValor] = useState<number | undefined>(undefined);
  const [data, setData] = useState<Date | undefined>(new Date());
  const [descricao, setDescricao] = useState("");
  const [status, setStatus] = useState<ReceitaStatus>('Pendente');
  const [loading, setLoading] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

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
      return data.filter(r => !r.is_fixed);
    },
    enabled: !!user && !authLoading,
  });

  // Modificado para buscar APENAS SUBCATEGORIAS (parent_id IS NOT NULL)
  const { data: fetchedCategories = [], isLoading: isLoadingCategories } = useQuery<AppCategory[]>({
    queryKey: ["categories", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("categorias")
        .select("*")
        .or(`user_id.eq.${user.id},user_id.is.null`)
        .not("parent_id", "is", null) // APENAS SUBCATEGORIAS
        .order("nome");
      if (error) throw error;
      return data as AppCategory[];
    },
    enabled: !!user && !authLoading,
  });

  // `fetchedCategories` agora já são as subcategorias.
  // Filtrar para obter apenas as subcategorias de 'receitas_e_investimentos'.
  const incomeSubcategories = useMemo(() => {
    return fetchedCategories.filter(cat => cat.parent_id === 'receitas_e_investimentos');
  }, [fetchedCategories]);

  const handleSubmitOneOff = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (valor === undefined || !data || tipoReceitaId === UNSELECTED_VALUE) {
      toast.error("Preencha todos os campos obrigatórios");
      setLoading(false);
      return;
    }

    const formattedDate = data 
      ? `${data.getFullYear()}-${(data.getMonth() + 1).toString().padStart(2, '0')}-${data.getDate().toString().padStart(2, '0')}` 
      : "";
      
    if (!isValid(data)) { // Adicionado verificação de validade da data
      toast.error("Data selecionada é inválida.");
      setLoading(false);
      return;
    }

    const newRevenueData = {
      user_id: user?.id,
      tipo_receita_id: tipoReceitaId === UNSELECTED_VALUE ? null : tipoReceitaId, // Convert UNSELECTED_VALUE to null
      valor: valor as number,
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
        style: { backgroundColor: 'hsl(var(--soft-green))', color: 'hsl(var(--success-darker))' }
      });
      setTipoReceitaId(UNSELECTED_VALUE);
      setValor(undefined);
      setData(new Date());
      setDescricao("");
      setStatus('Pendente');
      queryClient.invalidateQueries({ queryKey: ["revenues", user?.id] });
    }

    setLoading(false);
  };

  const handleRecurringFormSuccess = () => {
    setFormMode('one-off');
    queryClient.invalidateQueries({ queryKey: ["recurringEntries", user?.id] });
    queryClient.invalidateQueries({ queryKey: ["transactions"] });
  };

  const oneOffFormContent = (
    <form onSubmit={handleSubmitOneOff} className="space-y-4">
      <div>
        <Label htmlFor="tipo" className={cn(isMobile && "text-xs")}>Subcategoria de Receita</Label> {/* Label atualizada */}
        <div className="flex gap-2">
          <Select value={tipoReceitaId} onValueChange={setTipoReceitaId}>
            <SelectTrigger className={cn("rounded-xl", isMobile && "h-9 text-sm")}>
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
                if (!date) return;
                const fixedDate = new Date(
                  date.getFullYear(),
                  date.getMonth(),
                  date.getDate()
                );
                if (isValid(fixedDate)) { // Add isValid check
                  setData(fixedDate);
                } else {
                  console.error("Invalid date created from calendar selection in Receitas:", date);
                  toast.error("Data selecionada é inválida.");
                }
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
        <CurrencyInput
          id="valor"
          value={valor}
          onValueChange={(values) => setValor(values.floatValue)}
          placeholder="0,00"
          required
          className={cn("rounded-xl", isMobile && "h-9 text-sm")}
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
          className={cn("rounded-xl", isMobile && "text-sm")}
        />
      </div>

      <RevenueStatusToggle
        status={status}
        setStatus={setStatus}
        isMobile={isMobile}
      />

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
                  className="flex items-center justify-center gap-8 mb-4" // Aumentado o gap para mais espaço
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="one-off" id="one-off-revenue" className={cn(isMobile && "h-3.5 w-3.5", "peer")} />
                    <Label
                      htmlFor="one-off-revenue"
                      className={cn(
                        "text-sm font-normal text-muted-foreground",
                        isMobile && "text-xs",
                        "peer-data-[state=checked]:text-success peer-data-[state=checked]:font-bold", // Verde para Avulsa
                        "flex items-center" // Adicionado para alinhar ícone e texto
                      )}
                    >
                      <span>Avulsa</span>
                      <DynamicIcon name="💰" className={cn("ml-1", isMobile ? "h-4 w-4" : "h-5 w-5")} />
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="recurring" id="recurring-revenue" className={cn(isMobile && "h-3.5 w-3.5", "peer")} />
                    <Label
                      htmlFor="recurring-revenue"
                      className={cn(
                        "text-sm font-normal text-muted-foreground",
                        isMobile && "text-xs",
                        "peer-data-[state=checked]:text-primary peer-data-[state=checked]:font-bold", // Azul para Recorrente
                        "flex items-center" // Adicionado para alinhar ícone e texto
                      )}
                    >
                      <span>Recorrente</span>
                      <DynamicIcon name="📆" className={cn("ml-1 bg-transparent", isMobile ? "h-4 w-4" : "h-5 w-5")} />
                    </Label>
                  </div>
                </RadioGroup>
                {formMode === 'one-off' ? (
                  oneOffFormContent
                ) : (
                  <RecurringEntryFormContent
                    isMobile={isMobile}
                    onSuccess={handleRecurringFormSuccess}
                    fetchedCategories={incomeSubcategories} // Alterado para incomeSubcategories
                    isLoadingCategories={isLoadingCategories}
                    initialType="receita"
                  />
                )}
                <Footer isMobile={isMobile} />
              </div>
            ) : (
              <Card className="p-6 rounded-xl shadow-sm">
                <h2 className="text-xl font-semibold mb-4">Nova Receita</h2>
                <RadioGroup
                  value={formMode}
                  onValueChange={(value: FormMode) => setFormMode(value)}
                  className="flex items-center justify-center gap-8 mb-4" // Aumentado o gap para mais espaço
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="one-off" id="one-off-revenue-desktop" className="peer" />
                    <Label
                      htmlFor="one-off-revenue-desktop"
                      className={cn(
                        "text-sm font-normal text-muted-foreground",
                        "peer-data-[state=checked]:text-success peer-data-[state=checked]:font-bold", // Verde para Avulsa
                        "flex items-center" // Adicionado para alinhar ícone e texto
                      )}
                    >
                      <span>Receita Avulsa</span>
                      <DynamicIcon name="💰" className="ml-1 h-5 w-5" />
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="recurring" id="recurring-revenue-desktop" className="peer" />
                    <Label
                      htmlFor="recurring-revenue-desktop"
                      className={cn(
                        "text-sm font-normal text-muted-foreground",
                        "peer-data-[state=checked]:text-primary peer-data-[state=checked]:font-bold", // Azul para Recorrente
                        "flex items-center" // Adicionado para alinhar ícone e texto
                      )}
                    >
                      <span>Receita Recorrente</span>
                      <DynamicIcon name="📆" className="ml-1 h-5 w-5 bg-transparent" />
                    </Label>
                  </div>
                </RadioGroup>
                {formMode === 'one-off' ? (
                  oneOffFormContent
                ) : (
                  <RecurringEntryFormContent
                    isMobile={isMobile}
                    onSuccess={handleRecurringFormSuccess}
                    fetchedCategories={incomeSubcategories} // Alterado para incomeSubcategories
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