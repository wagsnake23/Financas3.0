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
import { Investment, AppCategory } from "@/types/finance"; // Importar a interface Investment e AppCategory
import { cn, getBorderClass, formatCurrency, formatInTimeZone, TARGET_TIMEZONE } from "@/lib/utils"; // Importar cn, getBorderClass E formatCurrency, formatInTimeZone, TARGET_TIMEZONE
import { format, getYear, subMonths, addMonths } from "date-fns"; // Importar format, getYear, subMonths, addMonths
import { ptBR } from "date-fns/locale"; // Importar ptBR
import { CalendarIcon } from "lucide-react"; // Importar CalendarIcon
import { Calendar } from "@/components/ui/calendar"; // Importar Calendar
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"; // Importar Popover components
import CurrencyBR from "@/components/ui/currency-br"; // Importar CurrencyBR
import { NumericInput } from "@/components/ui/numeric-input"; // Importar NumericInput
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"; // Importar Dialog components
import { EditInvestmentDialog } from "@/components/EditInvestmentDialog"; // Importar o novo componente de diálogo
import { StatCard } from "@/components/StatCard"; // Importar StatCard
import { useNavigate } from "react-router-dom"; // NOVO: Importar useNavigate
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"; // NOVO: Importar AlertDialog

const UNSELECTED_VALUE = "unselected";
const toastDuration = 1000; // 1 segundo para todos os dispositivos
const toastSuccessStyle = { backgroundColor: '#F3FFF3', color: '#006000' };
const toastErrorStyle = { backgroundColor: '#F3FFF3', color: '#FF2929' };

export default function Investments() { // Alterado para export default function
  const { user, loading: authLoading } = useAuth(); // Obter authLoading
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const navigate = useNavigate();



  // No longer needed here as yields are calculated from investments
  /*
  const { data: allRevenues = [], isLoading: isLoadingAllRevenues } = useQuery<Tables<"receitas">[]>({
    ...
  });
  */

  // Fetch all subcategories
  const { data: allSubcategories = [], isLoading: isLoadingCategories } = useQuery<AppCategory[]>({
    queryKey: ["categories", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("categorias")
        .select("*")
        .or(`user_id.eq.${user.id},user_id.is.null`)
        .not("parent_id", "is", null) // Only subcategories
        .order("nome");
      if (error) throw error;
      return data as AppCategory[];
    },
    enabled: !!user && !authLoading,
  });

  const incomeInvestmentSubcategories = useMemo(() => {
    return allSubcategories.filter(cat => cat.parent_id === 'receitas_e_investimentos');
  }, [allSubcategories]);

  // Form states for adding new investment
  const [selectedInvestmentCategoryId, setSelectedInvestmentCategoryId] = useState(UNSELECTED_VALUE); // Changed from 'name'
  const [type, setType] = useState("fixed");
  const [amount, setAmount] = useState<number | undefined>(undefined); // Alterado para number | undefined
  const [date, setDate] = useState<Date | undefined>(new Date()); // Alterado para Date | undefined
  const [profitability, setProfitability] = useState<number | undefined>(undefined); // Alterado para number | undefined
  const [loadingForm, setLoadingForm] = useState(false); // Novo estado para loading do formulário
  const [isCalendarOpen, setIsCalendarOpen] = useState(false); // Estado para controlar a abertura do calendário
  const [validationErrors, setValidationErrors] = useState<Record<string, boolean>>({}); // NOVO ESTADO

  // States for editing investment
  const [editingInvestment, setEditingInvestment] = useState<Investment | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // NOVO: Estados para o diálogo de confirmação de exclusão
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [investmentToDeleteId, setInvestmentToDeleteId] = useState<string | null>(null);

  const investmentTypes = [
    { value: "fixed", label: "Renda Fixa", icon: "🏦" },
    { value: "variable", label: "Renda Variável", icon: "📊" },
    { value: "real-estate", label: "Fundos Imobiliários", icon: "🏢" },
    { value: "crypto", label: "Criptomoedas", icon: "🪙" },
    { value: "other", label: "Outros", icon: "🎯" },
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
    enabled: !!user && !authLoading, // Passando enabled
  });

  // Mutation for adding a new investment
  const addInvestmentMutation = useMutation({
    mutationFn: async (newInvestment: TablesInsert<'investimentos'>) => {
      if (!user?.id) throw new Error("Usuário não autenticado."); // Adicionado verificação
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
      setSelectedInvestmentCategoryId(UNSELECTED_VALUE); // Reset
      setAmount(undefined); // Reset para undefined
      setProfitability(undefined); // Reset para undefined
      setDate(new Date()); // Reset para Date
      setType("fixed");
      setValidationErrors({}); // Clear errors on success
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
      if (!user?.id) throw new Error("Usuário não autenticado."); // Adicionado verificação
      const { error } = await supabase
        .from("investimentos")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id); // Adicionado eq("user_id", user.id) para segurança
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["investments", user?.id] });
      toast.success("Investimento removido!", {
        style: toastSuccessStyle,
        duration: toastDuration
      });
      setIsConfirmDeleteOpen(false); // Fechar o diálogo após sucesso
      setInvestmentToDeleteId(null); // Limpar o ID
    },
    onError: (error) => {
      toast.error("Erro ao remover investimento", { description: error.message, duration: toastDuration, style: toastErrorStyle });
      console.error("Supabase error deleting investment:", error);
      setIsConfirmDeleteOpen(false); // Fechar o diálogo mesmo em caso de erro
      setInvestmentToDeleteId(null); // Limpar o ID
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingForm(true);

    const newErrors: Record<string, boolean> = {};
    let hasError = false;

    if (!user) {
      toast.error("Usuário não autenticado.", { duration: toastDuration, style: toastErrorStyle });
      setLoadingForm(false);
      return;
    }

    if (!selectedInvestmentCategoryId || selectedInvestmentCategoryId === UNSELECTED_VALUE) {
      newErrors.selectedInvestmentCategoryId = true;
      hasError = true;
    }
    if (amount === undefined || amount <= 0) {
      newErrors.amount = true;
      hasError = true;
    }
    if (profitability === undefined || profitability < 0) { // Assuming profitability can be 0
      newErrors.profitability = true;
      hasError = true;
    }
    if (!date) {
      newErrors.date = true;
      hasError = true;
    }

    setValidationErrors(newErrors);
    if (hasError) {
      toast.error("Preencha todos os campos obrigatórios", { duration: toastDuration, style: toastErrorStyle });
      setLoadingForm(false);
      return;
    }

    // Formatar a data usando os componentes locais para evitar problemas de fuso horário
    const formattedDate = date
      ? formatInTimeZone(date, TARGET_TIMEZONE, 'yyyy-MM-dd') // Usar formatInTimeZone
      : "";

    const newInvestmentData: TablesInsert<'investimentos'> = {
      user_id: user.id,
      nome: selectedInvestmentCategoryId, // Store category ID
      tipo: type,
      valor: amount, // Usar o valor como number
      data: formattedDate, // Usar a data formatada
      rentabilidade: profitability, // Usar o valor como number
    };

    addInvestmentMutation.mutate(newInvestmentData);
  };

  // NOVO: Função para abrir o diálogo de confirmação
  const handleDelete = (id: string) => {
    setInvestmentToDeleteId(id);
    setIsConfirmDeleteOpen(true);
  };

  // NOVO: Função para confirmar a exclusão
  const handleConfirmDelete = () => {
    if (investmentToDeleteId) {
      deleteInvestmentMutation.mutate(investmentToDeleteId);
    }
  };

  const handleEditClick = (investment: Investment) => {
    setEditingInvestment(investment); // investment.nome will be the category ID
    setIsEditModalOpen(true);
  };

  const handleCancelEdit = () => {
    setEditingInvestment(null);
    setIsEditModalOpen(false);
  };

  const handleUpdateSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["investments", user?.id] });
    toast.success("Investimento atualizado!", {
      style: toastSuccessStyle,
      duration: toastDuration
    });
    handleCancelEdit();
  };

  const totalProjectedAnnualYield = useMemo(() => {
    return investments.reduce((sum, inv) => sum + (inv.valor * (inv.rentabilidade / 100)), 0);
  }, [investments]);

  const stats = useMemo(() => {
    const totalInvested = investments.reduce((sum, inv) => sum + inv.valor, 0);
    const avgProfitability = investments.length > 0
      ? investments.reduce((sum, inv) => sum + inv.rentabilidade, 0) / investments.length
      : 0;

    return { totalInvested, avgProfitability };
  }, [investments]);

  if (authLoading || isLoadingInvestments || isLoadingCategories) { // Removido isLoadingAllRevenues
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Carregando Investimentos...</div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col bg-background pt-16", isMobile && "bg-lancamentos-mobile-bg")}> {/* Alterado min-h-screen para flex flex-col */}
      <Navigation />

      {/* Main Content */}
      <main className={cn("container mx-auto flex-grow", isMobile ? "px-4 py-4" : "max-w-[1200px] px-6 py-8")}> {/* Adicionado flex-grow e ajustado py-4 para mobile */}
        {!isMobile && (
          <h1 className="text-3xl font-bold mb-6">Dashboard Financeiro</h1>
        )}

        {/* REMOVIDO: MonthNavigator global */}

        {isMobile ? (
          <div className="grid grid-cols-1 gap-4">

            <Card className={cn("p-6 animate-slide-up rounded-xl shadow-sm bg-white", isMobile ? "p-4" : "max-w-[700px] mx-auto")}>
              <h2 className={cn("text-2xl font-bold mb-6", isMobile && "text-xl mb-4")}>💶 Novo Investimento</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="investment-category" className={cn(isMobile && "text-xs")}>Nome do Investimento</Label>
                  <Select
                    value={selectedInvestmentCategoryId}
                    onValueChange={(value) => {
                      setSelectedInvestmentCategoryId(value);
                      setValidationErrors(prev => ({ ...prev, selectedInvestmentCategoryId: false }));
                    }}
                    disabled={loadingForm}
                  >
                    <SelectTrigger id="investment-category" className={cn(
                      "rounded-xl bg-white border-[#D1D5DB] font-medium transition-all duration-200",
                      isMobile && "h-9 text-sm",
                      getBorderClass({ isInvalid: validationErrors.selectedInvestmentCategoryId, isValid: validationErrors.selectedInvestmentCategoryId === false })
                    )}>
                      <SelectValue placeholder="Selecione o tipo de investimento" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={UNSELECTED_VALUE} disabled className={cn(isMobile && "text-sm")}>Selecione o tipo de investimento</SelectItem>
                      {incomeInvestmentSubcategories.length === 0 && (
                        <SelectItem value={UNSELECTED_VALUE} disabled className={cn(isMobile && "text-sm")}>Nenhum tipo de investimento disponível</SelectItem>
                      )}
                      {incomeInvestmentSubcategories.length > 0 && (
                        <>
                          {incomeInvestmentSubcategories.map(cat => (
                            <SelectItem key={cat.id} value={cat.id} className={cn(isMobile && "text-sm")}>
                              <span className="flex items-center gap-2">
                                <DynamicIcon name={cat.icone} className="h-4 w-4" />
                                <span>{cat.nome}</span>
                              </span>
                            </SelectItem>
                          ))}
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="type" className={cn(isMobile && "text-xs")}>Tipo</Label>
                  <Select value={type} onValueChange={setType} disabled={loadingForm}>
                    <SelectTrigger className={cn(
                      "rounded-xl bg-white border-[#D1D5DB] font-medium transition-all duration-200",
                      isMobile && "h-9 text-sm"
                    )}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {investmentTypes.map(t => (
                        <SelectItem key={t.value} value={t.value} className={cn(isMobile && "text-sm")}>
                          <span className="flex items-center gap-2">
                            <DynamicIcon name={t.icon} className="h-4 w-4" />
                            {t.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Agrupando Valor Investido e Rentabilidade */}
                <div className={cn("grid gap-4", isMobile ? "grid-cols-2 gap-2" : "grid-cols-1")}>
                  <div className="space-y-2">
                    <Label htmlFor="amount" className={cn(isMobile && "text-xs")}>Valor Investido (R$)</Label>
                    <CurrencyBR
                      value={amount}
                      onChange={(v) => {
                        setAmount(v);
                        setValidationErrors(prev => ({ ...prev, amount: false }));
                      }}
                      disabled={loadingForm}
                      className={cn(
                        "rounded-xl bg-white border-[#D1D5DB] font-medium transition-all duration-200",
                        isMobile && "h-9 text-sm",
                        getBorderClass({ isInvalid: validationErrors.amount, isValid: validationErrors.amount === false })
                      )}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="profitability" className={cn(isMobile && "text-xs")}>Rentabilidade % a.a</Label>
                    <NumericInput
                      id="profitability"
                      value={profitability}
                      onValueChange={(values) => {
                        setProfitability(values.floatValue);
                        setValidationErrors(prev => ({ ...prev, profitability: false }));
                      }}
                      placeholder="0,00"
                      required
                      disabled={loadingForm}
                      className={cn(
                        "rounded-xl bg-white border-[#D1D5DB] font-medium transition-all duration-200",
                        isMobile && "h-9 text-sm",
                        getBorderClass({ isInvalid: validationErrors.profitability, isValid: validationErrors.profitability === false })
                      )}
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
                          "w-full justify-start text-left font-medium h-10 rounded-xl",
                          "bg-white border-[#D1D5DB] transition-all duration-200",
                          !date && "text-muted-foreground",
                          isMobile && "h-9 text-sm",
                          getBorderClass({ isInvalid: validationErrors.date, isValid: validationErrors.date === false })
                        )}
                        disabled={loadingForm}
                      >
                        <DynamicIcon name="📅" className={cn("mr-2 h-4 w-4 text-primary", isMobile && "h-3.5 w-3.5")} />
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
                          setValidationErrors(prev => ({ ...prev, date: false }));
                        }}
                        initialFocus
                        locale={ptBR}
                        showOutsideDays={false}
                        className={cn(isMobile && "text-sm")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <Button type="submit" className={cn("w-full rounded-xl", isMobile && "h-9 text-sm")} size="lg" disabled={loadingForm}>
                  {loadingForm ? "Adicionando..." : "Adicionar Investimento"}
                </Button>
              </form>
            </Card>

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
                      const investmentCategory = allSubcategories.find(cat => cat.id === investment.nome);
                      const investmentNameDisplay = investmentCategory?.nome || investment.nome; // Fallback to ID if not found
                      const investmentIcon = investmentCategory?.icone || "MoreHorizontal"; // Fallback icon

                      return (
                        <div
                          key={investment.id}
                          className={cn("p-4 border border-border rounded-lg hover:border-primary/50 transition-all", isMobile && "p-3")}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2"> {/* Added flex container for icon and name */}
                              <DynamicIcon name={investmentIcon} className={cn("h-5 w-5 text-primary", isMobile && "h-4 w-4")} /> {/* Display icon */}
                              <div>
                                <h3 className={cn("font-semibold text-lg", isMobile && "text-base")}>{investmentNameDisplay}</h3> {/* Use display name */}
                                <p className={cn("text-sm text-muted-foreground", isMobile && "text-xs")}>{typeLabel}</p>
                              </div>
                            </div>
                            <div className="flex gap-1"> {/* Container para os botões de ação */}
                              <Button
                                variant="ghost"
                                size={isMobile ? "icon" : "sm"} // Ajustado para 'icon' em mobile
                                onClick={() => handleEditClick(investment)}
                                className={cn("text-primary hover:text-primary hover:bg-primary/10", isMobile && "h-8 w-8")} // Aumentado o tamanho do botão
                              >
                                <DynamicIcon name="Pencil" className={cn("h-4 w-4", isMobile && "h-4 w-4")} /> {/* Mantido o tamanho do ícone */}
                              </Button>
                              <Button
                                variant="ghost"
                                size={isMobile ? "icon" : "sm"} // Ajustado para 'icon' em mobile
                                onClick={() => handleDelete(investment.id)} // Agora chama handleDelete para abrir o diálogo
                                className={cn("text-destructive hover:text-destructive hover:bg-destructive/10", isMobile && "h-8 w-8")} // Aumentado o tamanho do botão
                              >
                                <DynamicIcon name="Trash2" className={cn("h-4 w-4", isMobile && "h-4 w-4")} /> {/* Mantido o tamanho do ícone */}
                              </Button>
                            </div>
                          </div>

                          <div className={cn("grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-border", isMobile && "mt-2 pt-2")}>
                            <div>
                              <p className={cn("text-xs text-muted-foreground flex items-center gap-1", isMobile && "text-[0.6rem]")}>
                                <DynamicIcon name="💰" className={cn("h-3 w-3", isMobile && "h-2.5 w-2.5")} />
                                Valor
                              </p>
                              <p className={cn("font-semibold", isMobile && "text-xs")}>{formatCurrency(investment.valor)}</p>
                            </div>
                            <div>
                              <p className={cn("text-xs text-muted-foreground flex items-center gap-1", isMobile && "text-[0.6rem]")}>
                                <DynamicIcon name="📈" className={cn("h-3 w-3", isMobile && "h-2.5 w-2.5")} />
                                Porcentagem
                              </p>
                              <p className={cn("font-semibold text-success", isMobile && "text-xs")}>{investment.rentabilidade}% a.a.</p>
                            </div>
                            <div>
                              <p className={cn("text-xs text-muted-foreground flex items-center gap-1", isMobile && "text-[0.6rem]")}>
                                <DynamicIcon name="📅" className={cn("h-3 w-3", isMobile && "h-2.5 w-2.5")} />
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
              {isMobile && (
                <div className="mt-4"> {/* Adiciona margem superior para separar da lista */}
                  <StatCard
                    mainStatTitle="Total Investido"
                    mainStatValue={stats.totalInvested}
                    icon="DollarSign"
                    variant="income" // Usar variant income para cor verde
                    isMobile={isMobile}
                  />
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              <StatCard
                mainStatTitle="Total Investido"
                mainStatValue={stats.totalInvested}
                icon="DollarSign"
                variant="income"
                isMobile={isMobile}
                neumorphism={true}
              />

              <StatCard
                mainStatTitle="Rentabilidade Média"
                mainStatValue={stats.avgProfitability}
                secondaryStatTitle="Média Geral"
                secondaryStatValue={stats.avgProfitability}
                icon="Percent"
                variant="income"
                isMobile={isMobile}
                neumorphism={true}
              />
            </div>

            <div className={cn("grid gap-8", isMobile ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-2")}>
              {/* Form */}
              <div>
                <Card className={cn("p-6 animate-slide-up rounded-xl shadow-sm bg-white", isMobile ? "p-4" : "max-w-[700px] mx-auto")}>
                  <h2 className={cn("text-2xl font-bold mb-6", isMobile && "text-xl mb-4")}>💶 Novo Investimento</h2>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="investment-category" className={cn(isMobile && "text-xs")}>Nome do Investimento</Label>
                      <Select
                        value={selectedInvestmentCategoryId}
                        onValueChange={(value) => {
                          setSelectedInvestmentCategoryId(value);
                          setValidationErrors(prev => ({ ...prev, selectedInvestmentCategoryId: false }));
                        }}
                        disabled={loadingForm}
                      >
                        <SelectTrigger id="investment-category" className={cn(
                          "rounded-xl bg-white border-[#D1D5DB] font-medium transition-all duration-200",
                          isMobile && "h-9 text-sm",
                          getBorderClass({ isInvalid: validationErrors.selectedInvestmentCategoryId, isValid: validationErrors.selectedInvestmentCategoryId === false })
                        )}>
                          <SelectValue placeholder="Selecione o tipo de investimento" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={UNSELECTED_VALUE} disabled className={cn(isMobile && "text-sm")}>Selecione o tipo de investimento</SelectItem>
                          {incomeInvestmentSubcategories.length === 0 && (
                            <SelectItem value={UNSELECTED_VALUE} disabled className={cn(isMobile && "text-sm")}>Nenhum tipo de investimento disponível</SelectItem>
                          )}
                          {incomeInvestmentSubcategories.length > 0 && (
                            <>
                              {incomeInvestmentSubcategories.map(cat => (
                                <SelectItem key={cat.id} value={cat.id} className={cn(isMobile && "text-sm")}>
                                  <span className="flex items-center gap-2">
                                    <DynamicIcon name={cat.icone} className="h-4 w-4" />
                                    <span>{cat.nome}</span>
                                  </span>
                                </SelectItem>
                              ))}
                            </>
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="type" className={cn(isMobile && "text-xs")}>Tipo</Label>
                      <Select value={type} onValueChange={setType} disabled={loadingForm}>
                        <SelectTrigger className={cn(
                          "rounded-xl bg-white border-[#D1D5DB] font-medium transition-all duration-200",
                          isMobile && "h-9 text-sm"
                        )}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {investmentTypes.map(t => (
                            <SelectItem key={t.value} value={t.value} className={cn(isMobile && "text-sm")}>
                              <span className="flex items-center gap-2">
                                <DynamicIcon name={t.icon} className="h-4 w-4" />
                                {t.label}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Agrupando Valor Investido e Rentabilidade */}
                    <div className={cn("grid gap-4", isMobile ? "grid-cols-2 gap-2" : "grid-cols-1")}>
                      <div className="space-y-2">
                        <Label htmlFor="amount" className={cn(isMobile && "text-xs")}>Valor Investido (R$)</Label>
                        <CurrencyBR
                          value={amount}
                          onChange={(v) => {
                            setAmount(v);
                            setValidationErrors(prev => ({ ...prev, amount: false }));
                          }}
                          disabled={loadingForm}
                          className={cn(
                            "rounded-xl bg-white border-[#D1D5DB] font-medium transition-all duration-200",
                            isMobile && "h-9 text-sm",
                            getBorderClass({ isInvalid: validationErrors.amount, isValid: validationErrors.amount === false })
                          )}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="profitability" className={cn(isMobile && "text-xs")}>Rentabilidade % a.a</Label>
                        <NumericInput
                          id="profitability"
                          value={profitability}
                          onValueChange={(values) => {
                            setProfitability(values.floatValue);
                            setValidationErrors(prev => ({ ...prev, profitability: false }));
                          }}
                          placeholder="0,00"
                          required
                          disabled={loadingForm}
                          className={cn(
                            "rounded-xl bg-white border-[#D1D5DB] font-medium transition-all duration-200",
                            isMobile && "h-9 text-sm",
                            getBorderClass({ isInvalid: validationErrors.profitability, isValid: validationErrors.profitability === false })
                          )}
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
                              "w-full justify-start text-left font-medium h-10 rounded-xl",
                              "bg-white border-[#D1D5DB] transition-all duration-200",
                              !date && "text-muted-foreground",
                              isMobile && "h-9 text-sm",
                              getBorderClass({ isInvalid: validationErrors.date, isValid: validationErrors.date === false })
                            )}
                            disabled={loadingForm}
                          >
                            <DynamicIcon name="📅" className={cn("mr-2 h-4 w-4 text-primary", isMobile && "h-3.5 w-3.5")} />
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
                              setValidationErrors(prev => ({ ...prev, date: false }));
                            }}
                            initialFocus
                            locale={ptBR}
                            showOutsideDays={false}
                            className={cn(isMobile && "text-sm")}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    <Button type="submit" className={cn("w-full rounded-xl", isMobile && "h-9 text-sm")} size="lg" disabled={loadingForm}>
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
                        const investmentCategory = allSubcategories.find(cat => cat.id === investment.nome);
                        const investmentNameDisplay = investmentCategory?.nome || investment.nome; // Fallback to ID if not found
                        const investmentIcon = investmentCategory?.icone || "MoreHorizontal"; // Fallback icon

                        return (
                          <div
                            key={investment.id}
                            className={cn("p-4 border border-border rounded-xl hover:border-primary/50 transition-all shadow-sm", isMobile && "p-3")}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-2"> {/* Added flex container for icon and name */}
                                <DynamicIcon name={investmentIcon} className={cn("h-5 w-5 text-primary", isMobile && "h-4 w-4")} /> {/* Display icon */}
                                <div>
                                  <h3 className={cn("font-semibold text-lg", isMobile && "text-base")}>{investmentNameDisplay}</h3> {/* Use display name */}
                                  <p className={cn("text-sm text-muted-foreground", isMobile && "text-xs")}>{typeLabel}</p>
                                </div>
                              </div>
                              <div className="flex gap-1"> {/* Container para os botões de ação */}
                                <Button
                                  variant="ghost"
                                  size={isMobile ? "icon" : "sm"} // Ajustado para 'icon' em mobile
                                  onClick={() => handleEditClick(investment)}
                                  className={cn("text-primary hover:text-primary hover:bg-primary/10", isMobile && "h-8 w-8")} // Aumentado o tamanho do botão
                                >
                                  <DynamicIcon name="Pencil" className={cn("h-4 w-4", isMobile && "h-4 w-4")} /> {/* Mantido o tamanho do ícone */}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size={isMobile ? "icon" : "sm"} // Ajustado para 'icon' em mobile
                                  onClick={() => handleDelete(investment.id)} // Agora chama handleDelete para abrir o diálogo
                                  className={cn("text-destructive hover:text-destructive hover:bg-destructive/10", isMobile && "h-8 w-8")} // Aumentado o tamanho do botão
                                >
                                  <DynamicIcon name="Trash2" className={cn("h-4 w-4", isMobile && "h-4 w-4")} /> {/* Mantido o tamanho do ícone */}
                                </Button>
                              </div>
                            </div>

                            <div className={cn("grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-border", isMobile && "mt-2 pt-2")}>
                              <div>
                                <p className={cn("text-xs text-muted-foreground flex items-center gap-1", isMobile && "text-[0.6rem]")}>
                                  <DynamicIcon name="💰" className={cn("h-3 w-3", isMobile && "h-2.5 w-2.5")} />
                                  Valor
                                </p>
                                <p className={cn("font-semibold", isMobile && "text-xs")}>{formatCurrency(investment.valor)}</p>
                              </div>
                              <div>
                                <p className={cn("text-xs text-muted-foreground flex items-center gap-1", isMobile && "text-[0.6rem]")}>
                                  <DynamicIcon name="📈" className={cn("h-3 w-3", isMobile && "h-2.5 w-2.5")} />
                                  Porcentagem
                                </p>
                                <p className={cn("font-semibold text-success", isMobile && "text-xs")}>{investment.rentabilidade}% a.a.</p>
                              </div>
                              <div>
                                <p className={cn("text-xs text-muted-foreground flex items-center gap-1", isMobile && "text-[0.6rem]")}>
                                  <DynamicIcon name="📅" className={cn("h-3 w-3", isMobile && "h-2.5 w-2.5")} />
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
                {isMobile && (
                  <div className="mt-4"> {/* Adiciona margem superior para separar da lista */}
                    <StatCard
                      mainStatTitle="Total Investido"
                      mainStatValue={stats.totalInvested}
                      icon="DollarSign"
                      variant="income" // Usar variant income para cor verde
                      isMobile={isMobile}
                    />
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </main>

      <Footer isMobile={isMobile} user={user} className={cn(isMobile && "py-2")} /> {/* Adicionado className para reduzir padding-y em mobile */}

      {/* Edit Investment Dialog */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className={cn("w-full rounded-xl bg-gradient-to-br from-[#E3F2FD] to-white border-blue-100", isMobile ? "max-w-sm p-4" : "sm:max-w-[425px]")}>
          <DialogHeader>
            <DialogTitle>Editar Investimento</DialogTitle>
          </DialogHeader>
          {editingInvestment && (
            <EditInvestmentDialog
              investmentToEdit={editingInvestment}
              onUpdateSuccess={handleUpdateSuccess}
              onCancelEdit={handleCancelEdit}
              user={user}
              investmentTypes={investmentTypes}
              isMobile={isMobile}
              allSubcategories={allSubcategories}
              incomeInvestmentSubcategories={incomeInvestmentSubcategories}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* NOVO: AlertDialog para confirmação de exclusão */}
      <AlertDialog open={isConfirmDeleteOpen} onOpenChange={setIsConfirmDeleteOpen}>
        <div /> {/* Placeholder to avoid issues with Dialog triggers if any, but AlertDialog doesn't need it */}
        <AlertDialogContent className={cn("w-full rounded-xl", isMobile ? "max-w-[98vw] p-4 min-h-[180px]" : "sm:max-w-[425px]")}>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <DynamicIcon name="Trash2" className="h-6 w-6 text-destructive" />
              Confirmar Exclusão
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este investimento? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className={cn(
            "flex flex-col sm:flex-row justify-center gap-2",
            isMobile && "flex-row items-center justify-between"
          )}>
            <AlertDialogCancel
              disabled={deleteInvestmentMutation.isPending}
              className={cn(
                "rounded-xl",
                isMobile && "h-10 text-sm flex-1 bg-soft-blue hover:bg-soft-blue/80 text-primary mt-0"
              )}
              onClick={() => setIsConfirmDeleteOpen(false)}
            >
              {isMobile && <DynamicIcon name="❌" className="mr-1 h-4 w-4" />}
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={deleteInvestmentMutation.isPending}
              className={cn(
                "bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-xl",
                isMobile && "h-10 text-sm flex-1"
              )}
            >
              {isMobile && <DynamicIcon name="🗑️" className="mr-1 h-4 w-4" />}
              {deleteInvestmentMutation.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}