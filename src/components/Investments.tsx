import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Navigation } from "@/components/Navigation";
import DynamicIcon from "@/components/DynamicIcon";
import { Footer } from "@/components/Footer";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/hooks/useAuth"; // Importar useAuth
import { supabase } from "@/integrations/supabase/client"; // Importar supabase
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"; // Importar Tanstack Query hooks
import { TablesInsert, Tables } from "@/integrations/supabase/types"; // Importar tipos do Supabase
import { Investment } from "@/types/finance"; // Importar a interface Investment
import { cn } from "@/lib/utils"; // Importar cn
import { format } from "date-fns"; // Importar format
import { ptBR } from "date-fns/locale"; // Importar ptBR
import { CalendarIcon } from "lucide-react"; // Importar CalendarIcon
import { Calendar } from "@/components/ui/calendar"; // Importar Calendar
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"; // Importar Popover components

const toastDuration = 1000; // 1 segundo para todos os dispositivos
const toastSuccessStyle = { backgroundColor: '#F3FFF3', color: '#006000' };
const toastErrorStyle = { backgroundColor: '#F3FFF3', color: '#FF2929' };

const Investments = () => {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();

  // Form states
  const [name, setName] = useState("");
  const [type, setType] = useState("fixed");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState<Date | undefined>(new Date()); // Alterado para Date | undefined
  const [profitability, setProfitability] = useState("");
  const [loadingForm, setLoadingForm] = useState(false); // Novo estado para loading do formulário
  const [isCalendarOpen, setIsCalendarOpen] = useState(false); // Estado para controlar a abertura do calendário

  const investmentTypes = [
    { value: "fixed", label: "Renda Fixa" },
    { value: "variable", label: "Renda Variável" },
    { value: "real-estate", label: "Fundos Imobiliários" },
    { value: "crypto", label: "Criptomoedas" },
    { value: "other", label: "Outros" },
  ];

  // Fetch investments using Tanstack Query
  const { data: investments = [], isLoading: isLoadingInvestments } = useQuery<Investment[]>({
    queryKey: ["investments", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("investimentos")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Investment[];
    },
    enabled: !!user?.id,
  });

  // Mutation for adding a new investment
  const addInvestmentMutation = useMutation({
    mutationFn: async (newInvestment: TablesInsert<'investimentos'>) => {
      const { data, error } = await supabase
        .from("investimentos")
        .insert(newInvestment)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["investments", user?.id] });
      toast.success("Investimento adicionado!", {
        style: toastSuccessStyle,
        duration: toastDuration
      });
      // Reset form
      setName("");
      setAmount("");
      setProfitability("");
      setDate(new Date()); // Reset para Date
      setType("fixed");
    },
    onError: (error) => {
      toast.error("Erro ao adicionar investimento", { description: error.message, duration: toastDuration, style: toastErrorStyle });
      console.error("Supabase error adding investment:", error);
    },
    onSettled: () => {
      setLoadingForm(false);
    }
  });

  // Mutation for deleting an investment
  const deleteInvestmentMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("investimentos")
        .delete()
        .eq("id", id)
        .eq("user_id", user?.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["investments", user?.id] });
      toast.success("Investimento removido!", {
        style: toastSuccessStyle,
        duration: toastDuration
      });
    },
    onError: (error) => {
      toast.error("Erro ao remover investimento", { description: error.message, duration: toastDuration, style: toastErrorStyle });
      console.error("Supabase error deleting investment:", error);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingForm(true);

    if (!user) {
      toast.error("Usuário não autenticado.", { duration: toastDuration, style: toastErrorStyle });
      setLoadingForm(false);
      return;
    }

    if (!name || !amount || !profitability || !date) { // Adicionado validação para 'date'
      toast.error("Preencha todos os campos obrigatórios", { duration: toastDuration, style: toastErrorStyle });
      setLoadingForm(false);
      return;
    }

    // Formatar a data usando os componentes locais para evitar problemas de fuso horário
    const formattedDate = date
      ? `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`
      : "";

    const newInvestmentData: TablesInsert<'investimentos'> = {
      user_id: user.id,
      nome: name,
      tipo: type,
      valor: parseFloat(amount),
      data: formattedDate, // Usar a data formatada
      rentabilidade: parseFloat(profitability),
    };

    addInvestmentMutation.mutate(newInvestmentData);
  };

  const handleDelete = (id: string) => {
    deleteInvestmentMutation.mutate(id);
  };

  const stats = useMemo(() => {
    const totalInvested = investments.reduce((sum, inv) => sum + inv.valor, 0);
    const avgProfitability = investments.length > 0
      ? investments.reduce((sum, inv) => sum + inv.rentabilidade, 0) / investments.length
      : 0;

    return { totalInvested, avgProfitability };
  }, [investments]);

  if (isLoadingInvestments) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Carregando Investimentos...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-16">
      <Navigation />

      {/* Main Content */}
      <main className={cn("container mx-auto py-8", isMobile ? "px-4" : "px-4")}>
        {/* Stats Cards - Ocultados em mobile */}
        {!isMobile && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <Card className="p-6 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20 rounded-xl shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Total Investido</p>
                  <p className="text-3xl font-bold text-foreground">R$ {stats.totalInvested.toFixed(2)}</p>
                </div>
                <DynamicIcon name="DollarSign" className="h-12 w-12 text-primary" />
              </div>
            </Card>

            <Card className="p-6 bg-gradient-to-br from-success/10 to-success/5 border-success/20 rounded-xl shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Rentabilidade Média</p>
                  <p className="text-3xl font-bold text-foreground">{stats.avgProfitability.toFixed(2)}%</p>
                </div>
                <DynamicIcon name="Percent" className="h-12 w-12 text-success" />
              </div>
            </Card>
          </div>
        )}

        <div className={cn("grid gap-8", isMobile ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-2")}>
          {/* Form */}
          <div>
            <Card className={cn("p-6 animate-slide-up rounded-xl shadow-sm", isMobile && "p-4")}>
              <h2 className={cn("text-2xl font-bold mb-6", isMobile && "text-xl mb-4")}>Novo Investimento</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className={cn(isMobile && "text-xs")}>Nome do Investimento</Label>
                  <Input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Tesouro Direto"
                    required
                    disabled={loadingForm}
                    className={cn(isMobile && "h-9 text-sm")}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="type" className={cn(isMobile && "text-xs")}>Tipo</Label>
                  <Select value={type} onValueChange={setType} disabled={loadingForm}>
                    <SelectTrigger className={cn(isMobile && "h-9 text-sm")}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {investmentTypes.map(t => (
                        <SelectItem key={t.value} value={t.value} className={cn(isMobile && "text-sm")}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Agrupando Valor Investido e Rentabilidade */}
                <div className={cn("grid gap-4", isMobile ? "grid-cols-2 gap-2" : "grid-cols-1")}>
                  <div className="space-y-2">
                    <Label htmlFor="amount" className={cn(isMobile && "text-xs")}>Valor Investido (R$)</Label>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0,00"
                      required
                      disabled={loadingForm}
                      className={cn(isMobile && "h-9 text-sm")}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="profitability" className={cn(isMobile && "text-xs")}>Rentabilidade</Label>
                    <Input
                      id="profitability"
                      type="number"
                      step="0.01"
                      value={profitability}
                      onChange={(e) => setProfitability(e.target.value)}
                      placeholder="Ex: 13.75"
                      required
                      disabled={loadingForm}
                      className={cn(isMobile && "h-9 text-sm")}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="date" className={cn(isMobile && "text-xs")}>Data do Investimento</Label>
                  <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-full justify-start text-left font-normal h-10",
                          !date && "text-muted-foreground",
                          isMobile && "h-9 text-sm"
                        )}
                        disabled={loadingForm}
                      >
                        <CalendarIcon className={cn("mr-2 h-4 w-4", isMobile && "h-3.5 w-3.5")} />
                        {date ? format(date, "PPP", { locale: ptBR }) : <span>Selecione uma data</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className={cn("w-auto p-0", isMobile && "p-1")}>
                      <Calendar
                        mode="single"
                        selected={date}
                        onSelect={(selectedDate) => {
                          setDate(selectedDate);
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

                <Button type="submit" className={cn("w-full", isMobile && "h-9 text-sm")} size="lg" disabled={loadingForm}>
                  {loadingForm ? "Adicionando..." : "Adicionar Investimento"}
                </Button>
              </form>
            </Card>
          </div>

          {/* Investments List */}
          <div>
            <Card className={cn("p-6 rounded-xl shadow-sm", isMobile && "p-4")}>
              <h2 className={cn("text-2xl font-bold mb-6", isMobile && "text-xl mb-4")}>Meus Investimentos</h2>
              <div className="space-y-3">
                {investments.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    Nenhum investimento cadastrado ainda.
                  </p>
                ) : (
                  investments.map((investment) => {
                    const typeLabel = investmentTypes.find(t => t.value === investment.tipo)?.label || investment.tipo;

                    return (
                      <div
                        key={investment.id}
                        className={cn("p-4 border border-border rounded-xl hover:border-primary/50 transition-all", isMobile && "p-3")}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h3 className={cn("font-semibold text-lg", isMobile && "text-base")}>{investment.nome}</h3>
                            <p className={cn("text-sm text-muted-foreground", isMobile && "text-xs")}>{typeLabel}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(investment.id)}
                            className={cn("text-destructive hover:text-destructive hover:bg-destructive/10", isMobile && "h-7 w-7")}
                          >
                            <DynamicIcon name="Trash2" className={cn("h-4 w-4", isMobile && "h-3.5 w-3.5")} />
                          </Button>
                        </div>

                        <div className={cn("grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-border", isMobile && "mt-2 pt-2")}>
                          <div>
                            <p className={cn("text-xs text-muted-foreground flex items-center gap-1", isMobile && "text-[0.6rem]")}>
                              <DynamicIcon name="DollarSign" className={cn("h-3 w-3", isMobile && "h-2.5 w-2.5")} />
                              Valor
                            </p>
                            <p className={cn("font-semibold", isMobile && "text-xs")}>R$ {investment.valor.toFixed(2)}</p>
                          </div>
                          <div>
                            <p className={cn("text-xs text-muted-foreground flex items-center gap-1", isMobile && "text-[0.6rem]")}>
                              <DynamicIcon name="Percent" className={cn("h-3 w-3", isMobile && "h-2.5 w-2.5")} />
                              Rentabilidade
                            </p>
                            <p className={cn("font-semibold text-success", isMobile && "text-xs")}>{investment.rentabilidade}% a.a.</p>
                          </div>
                          <div>
                            <p className={cn("text-xs text-muted-foreground flex items-center gap-1", isMobile && "text-[0.6rem]")}>
                              <DynamicIcon name="Calendar" className={cn("h-3 w-3", isMobile && "h-2.5 w-2.5")} />
                              Data
                            </p>
                            <p className={cn("font-semibold text-sm", isMobile && "text-xs")}>
                              {(() => {
                                const [year, month, day] = investment.data.split('-').map(Number);
                                const localDate = new Date(year, month - 1, day);
                                return localDate.toLocaleDateString('pt-BR');
                              })()}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </Card>
          </div>
        </div>
      </main>

      <Footer isMobile={isMobile} user={user} />
    </div>
  );
};

export default Investments;