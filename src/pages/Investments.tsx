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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"; // Importar Tanstack Query hooks
import { TablesInsert, Tables } from "@/integrations/supabase/types"; // Importar tipos do Supabase
import { Investment, AppCategory } from "@/types/finance"; // Importar a interface Investment e AppCategory
import { cn, getBorderClass, formatCurrency, formatInTimeZone, TARGET_TIMEZONE } from "@/lib/utils"; // Importar cn, getBorderClass E formatCurrency, formatInTimeZone, TARGET_TIMEZONE
import { format, getYear, subMonths, addMonths, differenceInBusinessDays } from "date-fns"; // Importar format, getYear, subMonths, addMonths, differenceInBusinessDays
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
const toastSuccessStyle = { backgroundColor: '#FFFFFF', color: '#006000', border: '1px solid #E5FFE5' };
const toastErrorStyle = { backgroundColor: '#FFFFFF', color: '#FF2929', border: '1px solid #FFE5E5' };

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
  const [yieldViewMode, setYieldViewMode] = useState<"daily" | "monthly">("daily");
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

  const calculatedInvestments = useMemo(() => {
    return investments.map(inv => {
      // 1. Taxa diária: (1 + (rentabilidade / 100))^(1 / 252) - 1
      const taxaDiaria = Math.pow(1 + (inv.rentabilidade / 100), 1 / 252) - 1;

      // 2. Dias úteis passados
      const [year, month, day] = inv.data.split('-').map(Number);
      const investDate = new Date(year, month - 1, day);
      investDate.setHours(0, 0, 0, 0);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // differenceInBusinessDays returns the number of full business days between dates
      const diasUteis = differenceInBusinessDays(today, investDate);

      // 3. Valor atual virtual: valor_inicial × (1 + taxa_diaria)^(dias_uteis_passados)
      const valorAtualVirtual = inv.valor * Math.pow(1 + taxaDiaria, Math.max(0, diasUteis));

      // 4. Rendimento de hoje: valor_atual × taxa_diaria
      const rendimentoHojeVirtual = valorAtualVirtual * taxaDiaria;

      return {
        ...inv,
        valorAtualVirtual,
        rendimentoHojeVirtual,
        taxaDiaria
      };
    });
  }, [investments]);

  const totalProjectedAnnualYield = useMemo(() => {
    const rawTotal = calculatedInvestments.reduce((sum, inv) => {
      const annualRateDecimal = inv.rentabilidade / 100;
      const dailyRate = Math.pow(1 + annualRateDecimal, 1 / 252) - 1;
      const dailyRateTruncated = Math.trunc(dailyRate * 1e10) / 1e10;
      const annualRateDerived = Math.pow(1 + dailyRateTruncated, 252) - 1;
      return sum + (inv.valorAtualVirtual * annualRateDerived);
    }, 0);

    // Arredondamento Bancário (Round Half Even) para 2 casas
    const m = 100;
    const n = +(rawTotal * m).toFixed(8);
    const i = Math.floor(n);
    const f = n - i;
    const e = 1e-8;
    const rounded = (f > 0.5 - e && f < 0.5 + e)
      ? (i % 2 === 0 ? i : i + 1)
      : Math.round(n);

    return rounded / m;
  }, [investments]);

  const stats = useMemo(() => {
    const totalInvested = investments.reduce((sum, inv) => sum + inv.valor, 0);
    const totalCurrentBalance = calculatedInvestments.reduce((sum, inv) => sum + inv.valorAtualVirtual, 0);

    if (totalInvested === 0) return { totalInvested: 0, totalCurrentBalance: 0, avgProfitability: 0, totalDailyYieldRS: 0, totalMonthlyYieldRS: 0 };

    // taxa_anual_ponderada = Σ (valor_atual × (rentabilidade / 100)) ÷ Σ valor_atual
    const weightedSum = calculatedInvestments.reduce((sum, inv) => sum + (inv.valorAtualVirtual * (inv.rentabilidade / 100)), 0);
    const taxaAnualPonderada = weightedSum / totalCurrentBalance;
    const avgProfitability = taxaAnualPonderada * 100;

    // Rendimento Diário Total (R$) - Sum of virtual daily yields
    const totalDailyYieldRS = calculatedInvestments.reduce((sum, inv) => sum + inv.rendimentoHojeVirtual, 0);

    // Rendimento Mensal: juros compostos com base em 21 dias úteis
    // Para simplificar o rendimento mensal do portfólio, usamos a taxa média ponderada
    const dailyRate = Math.pow(1 + taxaAnualPonderada, 1 / 252) - 1;
    const dailyRateTruncated = Math.trunc(dailyRate * 1e10) / 1e10;
    const taxaMensal = Math.pow(1 + dailyRateTruncated, 21) - 1;
    const rawMonthYield = totalCurrentBalance * taxaMensal;

    // Arredondamento Bancário para o rendimento mensal
    const m = 100;
    const nm = +(rawMonthYield * m).toFixed(8);
    const im = Math.floor(nm);
    const fm = nm - im;
    const e = 1e-8;
    const monthRounded = (fm > 0.5 - e && fm < 0.5 + e)
      ? (im % 2 === 0 ? im : im + 1)
      : Math.round(nm);

    return {
      totalInvested,
      totalCurrentBalance,
      avgProfitability,
      totalDailyYieldRS,
      totalMonthlyYieldRS: monthRounded / m
    };
  }, [investments, calculatedInvestments]);

  if (authLoading || isLoadingInvestments || isLoadingCategories) { // Removido isLoadingAllRevenues
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Carregando Investimentos...</div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col bg-background", isMobile ? "bg-lancamentos-mobile-bg" : "pt-16")}> {/* Alterado min-h-screen para flex flex-col */}
      <Navigation />

      {/* Main Content */}
      <main className={cn("container mx-auto flex-grow", isMobile ? "px-4 pt-16 pb-4" : "max-w-[1200px] px-6 py-8")}> {/* Adicionado flex-grow e ajustado py-4 para mobile */}
        {!isMobile && (
          <h1 className="text-3xl font-bold mb-6">Dashboard Financeiro</h1>
        )}

        {/* REMOVIDO: MonthNavigator global */}

        {isMobile ? (
          <div className="grid grid-cols-1 gap-4">

            <Card
              className={cn(
                "p-6 rounded-[24px] shadow-sm border border-blue-100 card-saldo",
                isMobile && "border-none shadow-none bg-transparent p-4"
              )}
              style={{
                backgroundColor: "transparent",
                backgroundImage: "linear-gradient(135deg, rgba(215, 232, 255, 0.75), rgba(235, 245, 255, 0.8), rgba(215, 232, 255, 0.75))"
              }}
            >
              <h2 className={cn("text-2xl font-bold mb-6 text-[#0556C3]", isMobile && "text-xl mb-4")}>💶 Novo Investimento</h2>
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
                      "rounded-xl bg-white border-[#A5C2F9]/50 font-medium transition-all duration-200",
                      selectedInvestmentCategoryId === UNSELECTED_VALUE && "text-gray-400",
                      isMobile && "h-9 text-sm",
                      getBorderClass({ isInvalid: validationErrors.selectedInvestmentCategoryId, isValid: validationErrors.selectedInvestmentCategoryId === false })
                    )}>
                      <SelectValue placeholder="Selecione o tipo de investimento" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-none shadow-xl w-[var(--radix-select-trigger-width)]">
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
                      "rounded-xl bg-white border-[#A5C2F9]/50 font-medium transition-all duration-200",
                      isMobile && "h-9 text-sm"
                    )}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-none shadow-xl w-[var(--radix-select-trigger-width)]">
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
                        "rounded-xl bg-white border-[#A5C2F9]/50 font-medium transition-all duration-200 placeholder:text-gray-400",
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
                      placeholder="0,0000"
                      required
                      disabled={loadingForm}
                      decimalScale={4}
                      fixedDecimalScale={false}
                      maxLength={7}
                      className={cn(
                        "rounded-xl bg-white border-[#A5C2F9]/50 font-medium transition-all duration-200 placeholder:text-gray-400",
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
                          "bg-white border-[#A5C2F9]/50 transition-all duration-200",
                          !date && "text-gray-400",
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

                <Button
                  type="submit"
                  className={cn(
                    "w-full rounded-xl btn-3d font-bold text-white border-none transition-all active:scale-95",
                    isMobile ? "h-11 text-base !shadow-none" : "h-11 text-base shadow-md"
                  )}
                  style={{ "--cor-topo": "#0556C3", "--cor-base": "#03459C" } as any}
                  disabled={loadingForm}
                >
                  {loadingForm ? "Adicionando..." : "Adicionar Investimento"}
                </Button>
              </form>
            </Card>

            {/* Investments List */}
            <div>
              <Card
                className={cn("p-6 rounded-[24px] shadow-sm border border-blue-100 card-saldo", isMobile && "p-4 border-none shadow-none")}
                style={{ backgroundColor: "transparent" }}
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className={cn("text-2xl font-bold text-[#0556C3]", isMobile && "text-xl")}>💰 Meus Investimentos</h2>
                  <ToggleGroup
                    type="single"
                    value={yieldViewMode}
                    onValueChange={(v) => v && setYieldViewMode(v as "daily" | "monthly")}
                    className={cn(
                      "btn-3d flex items-center justify-between p-1 rounded-2xl transition-all h-9 w-[135px] border border-blue-200 shadow-none cursor-default",
                      isMobile && "-mt-1"
                    )}
                    style={{
                      "--cor-topo": "#E6F0FF",
                      "--cor-base": "#DCEBFF",
                      boxShadow: "inset 0px 1px 2px rgba(255, 255, 255, 0.25), inset 0px -2px 3px rgba(0, 0, 0, 0.1)"
                    } as any}
                  >
                    <ToggleGroupItem
                      value="daily"
                      className="rounded-xl flex-1 text-[12px] font-black h-7 transition-all data-[state=on]:bg-gradient-to-b data-[state=on]:from-[#6B95FF] data-[state=on]:to-[#4A74D4] data-[state=on]:text-white data-[state=on]:shadow-[inset_0px_1px_1px_rgba(255,255,255,0.4),inset_0px_-1px_1px_rgba(0,0,0,0.1)] text-[#1E6BCE]"
                    >
                      DIA
                    </ToggleGroupItem>
                    <ToggleGroupItem
                      value="monthly"
                      className="rounded-xl flex-1 text-[12px] font-black h-7 transition-all data-[state=on]:bg-gradient-to-b data-[state=on]:from-[#6B95FF] data-[state=on]:to-[#4A74D4] data-[state=on]:text-white data-[state=on]:shadow-[inset_0px_1px_1px_rgba(255,255,255,0.4),inset_0px_-1px_1px_rgba(0,0,0,0.1)] text-[#1E6BCE]"
                    >
                      MÊS
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>
                <div className="space-y-5 max-h-[480px] overflow-y-auto no-scrollbar pr-1">
                  {calculatedInvestments.length === 0 ? (
                    <p className="text-muted-foreground text-center py-12 bg-white/50 rounded-2xl border border-dashed border-gray-200">
                      Nenhum investimento cadastrado ainda.
                    </p>
                  ) : (
                    calculatedInvestments.map((investment) => {
                      const typeLabel = investmentTypes.find(t => t.value === investment.tipo)?.label || investment.tipo;
                      const investmentCategory = allSubcategories.find(cat => cat.id === investment.nome);
                      const investmentNameDisplay = investmentCategory?.nome || investment.nome;
                      const investmentIcon = investmentCategory?.icone || "MoreHorizontal";

                      // Yield calculation based on virtual current balance
                      const dailyYield = investment.rendimentoHojeVirtual;
                      const monthlyRate = Math.pow(1 + investment.taxaDiaria, 21) - 1;
                      const monthlyYield = investment.valorAtualVirtual * monthlyRate;

                      const [year, month, day] = investment.data.split('-').map(Number);
                      const dateObj = new Date(year, month - 1, day);
                      const formattedDate = format(dateObj, "dd MMM yyyy", { locale: ptBR });

                      return (
                        <div
                          key={investment.id}
                          className="relative group overflow-hidden transition-all duration-300 p-4 border border-blue-100 rounded-[20px] shadow-sm mb-2 last:mb-0"
                          style={{
                            backgroundImage: "linear-gradient(135deg, rgba(215, 232, 255, 0.75), rgba(235, 245, 255, 0.8), rgba(215, 232, 255, 0.75))"
                          }}
                        >
                          {/* 1. Top: Icon, Name, Type and Actions */}
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-start gap-3">
                              <DynamicIcon name={investmentIcon} className="h-6 w-6 text-primary/80" />
                              <div className="flex flex-col">
                                <h3 className="font-bold text-gray-800 leading-tight text-base">
                                  {investmentNameDisplay}
                                </h3>
                                <p className="text-xs text-gray-500 font-medium opacity-80">{typeLabel}</p>
                              </div>
                            </div>

                            <div className="flex items-center">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEditClick(investment)}
                                className="h-9 w-9 rounded-full bg-[linear-gradient(135deg,rgba(255,255,255,0.85),rgba(240,245,255,0.6))] border border-[rgba(120,150,255,0.25)] backdrop-blur-md shadow-[0_6px_14px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.6)] hover:shadow-[0_10px_20px_rgba(0,0,0,0.12)] hover:-translate-y-px transition-all duration-300 hover:bg-white"
                              >
                                <DynamicIcon name="Pencil" className="h-4 w-4 text-[#3b82f6]" />
                              </Button>
                            </div>
                          </div>

                          {/* 2. Main Value and Yield */}
                          <div className="flex flex-col justify-between gap-4">
                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="font-bold tracking-tight bg-gradient-to-r from-[#1E6BCE] to-[#8257E5] bg-clip-text text-transparent text-2xl">
                                  {formatCurrency(investment.valorAtualVirtual)}
                                </span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDelete(investment.id)}
                                  className="h-9 w-9 rounded-full bg-[linear-gradient(135deg,rgba(255,255,255,0.85),rgba(240,245,255,0.6))] border border-[rgba(120,150,255,0.25)] backdrop-blur-md shadow-[0_6px_14px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.6)] hover:shadow-[0_10px_20px_rgba(0,0,0,0.12)] hover:-translate-y-px transition-all duration-300 hover:bg-white"
                                >
                                  <DynamicIcon name="Trash2" className="h-4 w-4 text-[#ef4444]" />
                                </Button>
                              </div>

                              {/* Rendimento Diário / Mensal */}
                              <div className="flex items-center gap-1.5 text-[12px] font-bold text-success/90 w-fit ml-0.5">
                                <span className="text-sm">🔥</span>
                                <span>+ {formatCurrency(yieldViewMode === "daily" ? dailyYield : monthlyYield)} / {yieldViewMode === "daily" ? "dia" : "mês"}</span>
                              </div>
                            </div>

                            <div className="flex items-end justify-between">
                              {/* Profitability Badge */}
                              <div
                                className="inline-flex items-center gap-1.5 text-white px-3 py-1 rounded-full text-[11px] font-black bg-gradient-to-b from-[#6B95FF] to-[#4A74D4] shadow-[inset_0px_1px_1px_rgba(255,255,255,0.4),inset_0px_-1px_1px_rgba(0,0,0,0.1)]"
                              >
                                <DynamicIcon name="TrendingUp" className="h-3 w-3" />
                                <span>{investment.rentabilidade}% a.a.</span>
                              </div>

                              {/* Data Bottom Right */}
                              <div className="text-[13px] text-gray-400 font-black uppercase tracking-widest">
                                {formattedDate}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </Card>
              {isMobile && (
                <div className="mt-4">
                  {/* Mobile Stats Card - Glassmorphism */}
                  <div className="card-receitas p-6 shadow-[0_12px_28px_rgba(0,0,0,0.08)] rounded-[24px]">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-7">
                      {/* Total Investido */}
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2 mb-2">
                          <div
                            className="btn-3d p-2 rounded-xl shadow-sm border-none flex items-center justify-center"
                            style={{ "--cor-topo": "#1AA361", "--cor-base": "#15803d" } as any}
                          >
                            <DynamicIcon name="DollarSign" className="h-3.5 w-3.5 text-white" strokeWidth={3} />
                          </div>
                          <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Saldo Atual</h4>
                        </div>
                        <p className="text-lg font-bold text-slate-700 tracking-tight leading-none">{formatCurrency(stats.totalCurrentBalance)}</p>
                      </div>

                      {/* Rentabilidade Média */}
                      <div className="flex flex-col items-end text-right">
                        <div className="flex flex-row-reverse items-center gap-2 mb-2">
                          <div
                            className="btn-3d p-2 rounded-xl shadow-sm border-none flex items-center justify-center"
                            style={{ "--cor-topo": "#1AA361", "--cor-base": "#15803d" } as any}
                          >
                            <DynamicIcon name="Percent" className="h-3.5 w-3.5 text-white" strokeWidth={3} />
                          </div>
                          <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Média</h4>
                        </div>
                        <div className="flex items-baseline gap-0.5">
                          <p className="text-lg font-bold text-slate-700 tracking-tight leading-none">{stats.avgProfitability.toFixed(2)}%</p>
                          <span className="text-[8px] font-black text-gray-500 uppercase">a.a.</span>
                        </div>
                      </div>

                      {/* Rendimento Mensal */}
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2 mb-2">
                          <div
                            className="btn-3d p-2 rounded-xl shadow-sm border-none flex items-center justify-center"
                            style={{ "--cor-topo": "#1AA361", "--cor-base": "#15803d" } as any}
                          >
                            <DynamicIcon name="Calendar" className="h-3.5 w-3.5 text-white" strokeWidth={3} />
                          </div>
                          <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Mensal</h4>
                        </div>
                        <p className="text-lg font-bold text-slate-700 tracking-tight leading-none">{formatCurrency(stats.totalMonthlyYieldRS)}</p>
                      </div>

                      {/* Rendimento Diário */}
                      <div className="flex flex-col items-end text-right">
                        <div className="flex flex-row-reverse items-center gap-2 mb-2">
                          <div
                            className="btn-3d p-2 rounded-xl shadow-sm border-none flex items-center justify-center"
                            style={{ "--cor-topo": "#1AA361", "--cor-base": "#15803d" } as any}
                          >
                            <DynamicIcon name="Clock" className="h-3.5 w-3.5 text-white" strokeWidth={3} />
                          </div>
                          <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Diário</h4>
                        </div>
                        <p className="text-lg font-bold text-slate-700 tracking-tight leading-none">{formatCurrency(stats.totalDailyYieldRS)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div >
        ) : (
          <>
            <div className="card-receitas border-none rounded-[32px] p-8 shadow-sm mb-8">
              <div className="grid grid-cols-4 items-center gap-8">
                {/* Total Investido */}
                <div className="flex items-center gap-4">
                  <div
                    className="btn-3d p-3 rounded-2xl shadow-sm border-none flex items-center justify-center"
                    style={{ "--cor-topo": "#1AA361", "--cor-base": "#15803d" } as any}
                  >
                    <DynamicIcon name="DollarSign" className="h-6 w-6 text-white" strokeWidth={3} />
                  </div>
                  <div className="flex flex-col">
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1 leading-none">Saldo Atual</h4>
                    <p className="text-xl font-bold text-slate-700 tracking-tight leading-none">{formatCurrency(stats.totalCurrentBalance)}</p>
                  </div>
                </div>

                {/* Rendimento Mensal */}
                <div className="flex items-center justify-center gap-4 border-l border-success/10 h-10">
                  <div
                    className="btn-3d p-2.5 rounded-xl shadow-sm border-none flex items-center justify-center"
                    style={{ "--cor-topo": "#1AA361", "--cor-base": "#15803d" } as any}
                  >
                    <DynamicIcon name="Calendar" className="h-5 w-5 text-white" strokeWidth={3} />
                  </div>
                  <div className="flex flex-col">
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1 leading-none">Mensal</h4>
                    <p className="text-xl font-bold text-slate-700 tracking-tight leading-none">{formatCurrency(stats.totalMonthlyYieldRS)}</p>
                  </div>
                </div>

                {/* Rendimento Diário */}
                <div className="flex items-center justify-center gap-4 border-l border-success/10 h-10">
                  <div
                    className="btn-3d p-2.5 rounded-xl shadow-sm border-none flex items-center justify-center"
                    style={{ "--cor-topo": "#1AA361", "--cor-base": "#15803d" } as any}
                  >
                    <DynamicIcon name="Clock" className="h-5 w-5 text-white" strokeWidth={3} />
                  </div>
                  <div className="flex flex-col">
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1 leading-none">Diário</h4>
                    <p className="text-xl font-bold text-slate-700 tracking-tight leading-none">{formatCurrency(stats.totalDailyYieldRS)}</p>
                  </div>
                </div>

                {/* Rentabilidade Média */}
                <div className="flex flex-row-reverse items-center gap-4 border-l border-success/10 h-10">
                  <div
                    className="btn-3d p-3 rounded-2xl shadow-sm border-none flex items-center justify-center"
                    style={{ "--cor-topo": "#1AA361", "--cor-base": "#15803d" } as any}
                  >
                    <DynamicIcon name="Percent" className="h-6 w-6 text-white" strokeWidth={3} />
                  </div>
                  <div className="flex flex-col items-end">
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1 leading-none">Rentabilidade Média</h4>
                    <div className="flex items-baseline gap-1">
                      <p className="text-xl font-bold text-slate-700 tracking-tight leading-none">{stats.avgProfitability.toFixed(2)}%</p>
                      <span className="text-[10px] font-black text-gray-500 uppercase">a.a.</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className={cn("grid gap-8", isMobile ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-2")}>
              {/* Form */}
              <div>
                <Card
                  className={cn(
                    "p-6 rounded-[24px] shadow-sm border border-blue-100 card-saldo",
                    isMobile && "border-none shadow-none bg-transparent p-4"
                  )}
                  style={{
                    backgroundColor: "transparent",
                    backgroundImage: "linear-gradient(135deg, rgba(215, 232, 255, 0.75), rgba(235, 245, 255, 0.8), rgba(215, 232, 255, 0.75))"
                  }}
                >
                  <h2 className={cn("text-2xl font-bold mb-6 text-[#0556C3]", isMobile && "text-xl mb-4")}>💶 Novo Investimento</h2>
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
                          "rounded-xl bg-white border-[#A5C2F9]/50 font-medium transition-all duration-200",
                          isMobile && "h-9 text-sm",
                          getBorderClass({ isInvalid: validationErrors.selectedInvestmentCategoryId, isValid: validationErrors.selectedInvestmentCategoryId === false })
                        )}>
                          <SelectValue placeholder="Selecione o tipo de investimento" />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-none shadow-xl w-[var(--radix-select-trigger-width)]">
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
                          "rounded-xl bg-white border-[#A5C2F9]/50 font-medium transition-all duration-200",
                          isMobile && "h-9 text-sm"
                        )}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-none shadow-xl w-[var(--radix-select-trigger-width)]">
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
                            "rounded-xl bg-white border-[#A5C2F9]/50 font-medium transition-all duration-200",
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
                          placeholder="0,0000"
                          required
                          disabled={loadingForm}
                          decimalScale={4}
                          fixedDecimalScale={false}
                          maxLength={7}
                          className={cn(
                            "rounded-xl bg-white border-[#A5C2F9]/50 font-medium transition-all duration-200",
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
                              "bg-white border-[#A5C2F9]/50 transition-all duration-200",
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
                <Card
                  className={cn("p-6 rounded-[24px] shadow-sm border border-blue-100 card-saldo", isMobile && "p-4 border-none shadow-none")}
                  style={{ backgroundColor: "transparent" }}
                >
                  <div className="flex items-center justify-between mb-6">
                    <h2 className={cn("text-2xl font-bold text-[#0556C3]", isMobile && "text-xl")}>💰 Meus Investimentos</h2>
                    <ToggleGroup
                      type="single"
                      value={yieldViewMode}
                      onValueChange={(v) => v && setYieldViewMode(v as "daily" | "monthly")}
                      className={cn(
                        "btn-3d flex items-center justify-between p-1 rounded-2xl transition-all h-9 w-[135px] border border-blue-200 shadow-none cursor-default",
                        isMobile && "-mt-1"
                      )}
                      style={{
                        "--cor-topo": "#E6F0FF",
                        "--cor-base": "#DCEBFF",
                        boxShadow: "inset 0px 1px 2px rgba(255, 255, 255, 0.25), inset 0px -2px 3px rgba(0, 0, 0, 0.1)"
                      } as any}
                    >
                      <ToggleGroupItem
                        value="daily"
                        className="rounded-xl flex-1 text-[12px] font-black h-7 transition-all data-[state=on]:bg-gradient-to-b data-[state=on]:from-[#6B95FF] data-[state=on]:to-[#4A74D4] data-[state=on]:text-white data-[state=on]:shadow-[inset_0px_1px_1px_rgba(255,255,255,0.4),inset_0px_-1px_1px_rgba(0,0,0,0.1)] text-[#1E6BCE]"
                      >
                        DIA
                      </ToggleGroupItem>
                      <ToggleGroupItem
                        value="monthly"
                        className="rounded-xl flex-1 text-[12px] font-black h-7 transition-all data-[state=on]:bg-gradient-to-b data-[state=on]:from-[#6B95FF] data-[state=on]:to-[#4A74D4] data-[state=on]:text-white data-[state=on]:shadow-[inset_0px_1px_1px_rgba(255,255,255,0.4),inset_0px_-1px_1px_rgba(0,0,0,0.1)] text-[#1E6BCE]"
                      >
                        MÊS
                      </ToggleGroupItem>
                    </ToggleGroup>
                  </div>
                  <div className="space-y-5 max-h-[480px] overflow-y-auto no-scrollbar pr-1">
                    {calculatedInvestments.length === 0 ? (
                      <p className="text-muted-foreground text-center py-12 bg-white/50 rounded-2xl border border-dashed border-gray-200">
                        Nenhum investimento cadastrado ainda.
                      </p>
                    ) : (
                      calculatedInvestments.map((investment) => {
                        const typeLabel = investmentTypes.find(t => t.value === investment.tipo)?.label || investment.tipo;
                        const investmentCategory = allSubcategories.find(cat => cat.id === investment.nome);
                        const investmentNameDisplay = investmentCategory?.nome || investment.nome;
                        const investmentIcon = investmentCategory?.icone || "MoreHorizontal";

                        // Yield calculation based on virtual current balance
                        const dailyYield = investment.rendimentoHojeVirtual;
                        const monthlyRate = Math.pow(1 + investment.taxaDiaria, 21) - 1;
                        const monthlyYield = investment.valorAtualVirtual * monthlyRate;

                        const [year, month, day] = investment.data.split('-').map(Number);
                        const dateObj = new Date(year, month - 1, day);
                        const formattedDate = format(dateObj, "dd MMM yyyy", { locale: ptBR });

                        return (
                          <div
                            key={investment.id}
                            className={cn(
                              "relative group overflow-hidden transition-all duration-300 p-5 border border-blue-100 rounded-[20px] shadow-sm mb-2 last:mb-0",
                              isMobile && "p-4"
                            )}
                            style={{
                              backgroundImage: "linear-gradient(135deg, rgba(215, 232, 255, 0.75), rgba(235, 245, 255, 0.8), rgba(215, 232, 255, 0.75))"
                            }}
                          >
                            {/* 1. Top: Icon, Name, Type and Actions */}
                            <div className="flex items-start justify-between mb-5">
                              <div className="flex items-start gap-3">
                                <DynamicIcon name={investmentIcon} className="h-6 w-6 text-primary/80" />
                                <div className="flex flex-col">
                                  <h3 className={cn("font-bold text-gray-800 leading-tight", isMobile ? "text-base" : "text-[1.1rem]")}>
                                    {investmentNameDisplay}
                                  </h3>
                                  <p className="text-xs text-gray-500 font-medium opacity-80">{typeLabel}</p>
                                </div>
                              </div>

                              <div className="flex gap-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleEditClick(investment)}
                                  className="h-9 w-9 rounded-full bg-[linear-gradient(135deg,rgba(255,255,255,0.85),rgba(240,245,255,0.6))] border border-[rgba(120,150,255,0.25)] backdrop-blur-md shadow-[0_6px_14px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.6)] hover:shadow-[0_10px_20px_rgba(0,0,0,0.12)] hover:-translate-y-px transition-all duration-300 hover:bg-white"
                                >
                                  <DynamicIcon name="Pencil" className="h-4 w-4 text-[#3b82f6]" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDelete(investment.id)}
                                  className="h-9 w-9 rounded-full bg-[linear-gradient(135deg,rgba(255,255,255,0.85),rgba(240,245,255,0.6))] border border-[rgba(120,150,255,0.25)] backdrop-blur-md shadow-[0_6px_14px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.6)] hover:shadow-[0_10px_20px_rgba(0,0,0,0.12)] hover:-translate-y-px transition-all duration-300 hover:bg-white"
                                >
                                  <DynamicIcon name="Trash2" className="h-4 w-4 text-[#ef4444]" />
                                </Button>
                              </div>
                            </div>

                            {/* 2. Main Value and Yield */}
                            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                              <div className="space-y-1">
                                <div className="flex flex-col">
                                  <span className={cn(
                                    "font-bold tracking-tight bg-gradient-to-r from-[#1E6BCE] to-[#8257E5] bg-clip-text text-transparent",
                                    isMobile ? "text-2xl" : "text-3xl"
                                  )}>
                                    {formatCurrency(investment.valorAtualVirtual)}
                                  </span>
                                </div>

                                {/* Rendimento Diário / Mensal */}
                                <div className="flex items-center gap-1.5 text-[13px] font-bold text-success/90 w-fit ml-0.5">
                                  <span className="text-sm">🔥</span>
                                  <span>+ {formatCurrency(yieldViewMode === "daily" ? dailyYield : monthlyYield)} / {yieldViewMode === "daily" ? "dia" : "mês"}</span>
                                </div>
                              </div>

                              <div className="flex flex-col items-end gap-2">
                                {/* Profitability Badge */}
                                <div
                                  className="inline-flex items-center gap-1.5 text-white px-3.5 py-1.5 rounded-full text-[12px] font-black bg-gradient-to-b from-[#6B95FF] to-[#4A74D4] shadow-[inset_0px_1px_1px_rgba(255,255,255,0.4),inset_0px_-1px_1px_rgba(0,0,0,0.1)]"
                                >
                                  <DynamicIcon name="TrendingUp" className="h-3 w-3" />
                                  <span>{investment.rentabilidade}% a.a.</span>
                                </div>

                                {/* Data Bottom Right */}
                                <div className="text-[13px] sm:text-[14px] text-gray-400 font-black uppercase tracking-widest mt-1">
                                  {formattedDate}
                                </div>
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
                      mainStatTitle="Saldo Atual"
                      mainStatValue={stats.totalCurrentBalance}
                      icon="DollarSign"
                      variant="income" // Usar variant income para cor verde
                      isMobile={isMobile}
                    />
                  </div>
                )}
              </div >
            </div >
          </>
        )
        }
      </main >

      <Footer isMobile={isMobile} user={user} className={cn(isMobile && "py-2")} /> {/* Adicionado className para reduzir padding-y em mobile */}

      {/* Edit Investment Dialog */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className={cn(
          isMobile ? "dialog-mobile w-[99%] max-w-[99%] !rounded-[16px]" : "sm:max-w-[425px] sm:max-h-[90vh] overflow-y-auto"
        )}>
          <DialogHeader className={cn(
            "flex flex-row items-center justify-center gap-1",
            isMobile ? "mt-0" : "-mt-4"
          )}>
            <span className="text-2xl select-none">📝</span>
            <DialogTitle className="text-xl font-bold pb-[1px] text-center">Editar Investimento</DialogTitle>
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
        <AlertDialogContent className={cn(isMobile ? "dialog-mobile w-[99%] max-w-[99%] !rounded-[16px] !pb-7" : "sm:max-w-[425px] !pb-7 !rounded-[16px]")}>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center justify-center gap-2 text-center">
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
                "rounded-2xl border border-blue-200 bg-white text-blue-600 hover:bg-blue-50 hover:text-blue-700 font-extrabold",
                isMobile && "h-12 text-base flex-1 mt-0"
              )}
              onClick={() => setIsConfirmDeleteOpen(false)}
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={deleteInvestmentMutation.isPending}
              className={cn(
                "bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-2xl font-extrabold",
                isMobile && "h-12 text-base flex-1"
              )}
            >
              {deleteInvestmentMutation.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div >
  );
}