import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/contexts/ToastContext";
import DynamicIcon from "@/components/DynamicIcon";
import { Footer } from "@/components/Footer";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/hooks/useAuth"; // Importar useAuth
import { supabase } from "@/integrations/supabase/client"; // Importar supabase
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"; // Importar Tanstack Query hooks
import { TablesInsert, Tables } from "@/integrations/supabase/types"; // Importar tipos do Supabase
import { Investment, AppCategory } from "@/types/finance"; // Importar a interface Investment e AppCategory
import { cn, getBorderClass, formatCurrency, formatInTimeZone, TARGET_TIMEZONE, getAliquotaIR, getTipoTributacao, IndexadorHistorico, buildIndexadorMap, calcularRendimentoComCDI } from "@/lib/utils"; // Importar getBorderClass, formatInTimeZone, TARGET_TIMEZONE, getAliquotaIR, getTipoTributacao, IndexadorHistorico, buildIndexadorMap, calcularRendimentoComCDI
import { format, getYear, subMonths, addMonths, addDays, differenceInBusinessDays, parseISO } from "date-fns"; // Importar format, getYear, subMonths, addMonths, addDays, differenceInBusinessDays, parseISO
import { ptBR } from "date-fns/locale"; // Importar ptBR
import { CalendarIcon, Lock } from "lucide-react"; // Importar CalendarIcon e Lock
import { Calendar } from "@/components/ui/calendar"; // Importar Calendar
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"; // Importar Popover components
import { DatePickerModal } from "@/components/ui/DatePickerModal";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useProfile } from "@/hooks/useProfile";

const UNSELECTED_VALUE = "unselected";
// Removido toast styles isolados

export default function Investments() { // Alterado para export default function
  const { user } = useAuth(); // Obter authLoading
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { showSuccessToast, showErrorToast } = useToast();



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

  const incomeInvestmentSubcategories = useMemo(() => {
    return allSubcategories.filter(cat => cat.parent_id === 'receitas_e_investimentos');
  }, [allSubcategories]);

  // Form states for adding new investment
  const { data: profile } = useProfile(user?.id);
  const isExpired = profile?.isExpired;

  const handleBlockedClick = (e: React.MouseEvent) => {
    e.preventDefault();
    showErrorToast("🔒 Sua assinatura expirou. Renove para voltar a editar seus dados.");
    setTimeout(() => {
      window.dispatchEvent(new Event("open-subscription-modal"));
    }, 2000);
  };

  const [institution, setInstitution] = useState(UNSELECTED_VALUE); // Changed from 'name'
  const [selectedInvestmentCategoryId, setSelectedInvestmentCategoryId] = useState(UNSELECTED_VALUE); // Changed from 'name'
  const [type, setType] = useState("fixed");
  const [amount, setAmount] = useState<number | undefined>(undefined); // Alterado para number | undefined
  const [date, setDate] = useState<Date | undefined>(new Date()); // Alterado para Date | undefined
  const [profitability, setProfitability] = useState<number | undefined>(undefined); // Alterado para number | undefined
  const [loadingForm, setLoadingForm] = useState(false); // Novo estado para loading do formulário
  const [isCalendarOpen, setIsCalendarOpen] = useState(false); // Estado para controlar a abertura do calendário
  const [yieldViewMode, setYieldViewMode] = useState<"daily" | "monthly">("daily");
  const [tipoRentabilidade, setTipoRentabilidade] = useState<"fixo" | "indexado">("indexado");
  const [indexador, setIndexador] = useState<"CDI" | "IPCA">("CDI");
  const [percentualIndexador, setPercentualIndexador] = useState<number | undefined>();
  const [isConfirmRescueOpen, setIsConfirmRescueOpen] = useState(false);
  const [investmentToRescue, setInvestmentToRescue] = useState<any>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, boolean>>({}); // NOVO ESTADO
  const [simulationPeriod, setSimulationPeriod] = useState<"diário" | "mensal" | "anual">("diário");

  // Fetch active indexers (CDI/IPCA)
  const { data: indexadores = [] } = useQuery<IndexadorHistorico[]>({
    queryKey: ["indexadores-cdi"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("indexadores")
        .select("tipo, taxa_anual, data_inicio, taxa_diaria, taxa_mensal")
        .order("data_inicio", { ascending: true });
      if (error) throw error;
      return data as IndexadorHistorico[];
    },
  });

  const cdi = useMemo(() => {
    const cdis = indexadores.filter(i => i.tipo === "CDI");
    if (cdis.length === 0) return 10.65;
    return [...cdis].sort((a, b) => b.data_inicio.localeCompare(a.data_inicio))[0].taxa_anual;
  }, [indexadores]);

  const cdiDiario = useMemo(() => {
    const cdis = indexadores.filter(i => i.tipo === "CDI");
    if (cdis.length === 0) return Math.pow(1 + 0.1065, 1 / 252) - 1;
    return [...cdis].sort((a, b) => b.data_inicio.localeCompare(a.data_inicio))[0].taxa_diaria;
  }, [indexadores]);

  const ipca = useMemo(() => {
    const ipcas = indexadores.filter(i => i.tipo === "IPCA");
    if (ipcas.length === 0) return 4.5; // Fallback aprox
    const latest = [...ipcas].sort((a, b) => b.data_inicio.localeCompare(a.data_inicio))[0];
    const mensal = latest.taxa_mensal || 0;
    // Anualizar IPCA mensal: (1 + ipcaMensal)^12 - 1
    return (Math.pow(1 + mensal, 12) - 1) * 100;
  }, [indexadores]);

  const ipcaAnualReal = useMemo(() => {
    const ipcas = indexadores.filter(i => i.tipo === "IPCA");
    if (ipcas.length === 0) return 4.5;
    return [...ipcas].sort((a, b) => b.data_inicio.localeCompare(a.data_inicio))[0].taxa_anual || 4.5;
  }, [indexadores]);

  const indexadorMapCDI = useMemo(() => {
    const map = buildIndexadorMap(indexadores.filter(i => i.tipo === "CDI"));
    console.log("CDI Map size:", map.size);
    return map;
  }, [indexadores]);

  const indexadorMapIPCA = useMemo(() => {
    const map = buildIndexadorMap(indexadores.filter(i => i.tipo === "IPCA"));
    console.log("IPCA Map size:", map.size);
    return map;
  }, [indexadores]);

  const taxaEstimada = useMemo(() => {
    if (tipoRentabilidade === "fixo") return profitability || 0;
    if (indexador === "CDI") {
      return (cdi * (percentualIndexador || 100) / 100);
    }
    // IPCA+ (composta conforme instrução): (1 + ipcaAnual) * (1 + taxaReal) - 1
    const ipcaAnualDec = ipca / 100;
    const taxaRealDec = (percentualIndexador || 0) / 100;
    return ((1 + ipcaAnualDec) * (1 + taxaRealDec) - 1) * 100;
  }, [tipoRentabilidade, indexador, percentualIndexador, profitability, cdi, ipca]);

  const metricsNewForm = useMemo(() => {
    const categoria = allSubcategories.find(c => c.id === selectedInvestmentCategoryId);
    const tipoTributacao = categoria?.tipo_tributacao ?? "regressivo";

    // Calcular data fim baseada no período da simulação para projetar IR
    let endDate = new Date();
    if (simulationPeriod === "mensal") {
      endDate = addDays(new Date(), 31);
    } else if (simulationPeriod === "anual") {
      endDate = addDays(new Date(), 366);
    }

    const aliquota = getAliquotaIR(date || new Date(), endDate, tipoTributacao);

    // Usar IPCA anual real se o período for anual, caso contrário usar IPCA projetado (global)
    const ipcaUtilizado = simulationPeriod === "anual" ? ipcaAnualReal : ipca;

    // Taxa Estimada Bruta (sem arredondamento)
    let taxaBrutaSimulacao = 0;
    if (tipoRentabilidade === "fixo") {
      taxaBrutaSimulacao = (profitability || 0) / 100;
    } else if (indexador === "CDI") {
      taxaBrutaSimulacao = (cdi / 100) * (percentualIndexador || 100) / 100;
    } else {
      // IPCA+
      const ipcaDec = ipcaUtilizado / 100;
      const realDec = (percentualIndexador || 0) / 100;
      taxaBrutaSimulacao = (1 + ipcaDec) * (1 + realDec) - 1;
    }

    // Taxa Diária Exata (Conforme solicitado para CDI ou Juros Compostos para os demais)
    let taxaDiaria = 0;
    if (indexador === "CDI" && tipoRentabilidade === "indexado") {
      taxaDiaria = (cdiDiario || (Math.pow(1 + cdi / 100, 1 / 252) - 1)) * (percentualIndexador || 100) / 100;
    } else {
      taxaDiaria = Math.pow(1 + taxaBrutaSimulacao, 1 / 252) - 1;
    }

    let rendimentoBrutoPeriodo = 0;
    if (simulationPeriod === "diário") {
      rendimentoBrutoPeriodo = (amount || 0) * taxaDiaria;
    } else if (simulationPeriod === "mensal") {
      const taxaMensal = Math.pow(1 + taxaBrutaSimulacao, 1 / 12) - 1;
      rendimentoBrutoPeriodo = (amount || 0) * taxaMensal;
    } else if (simulationPeriod === "anual") {
      rendimentoBrutoPeriodo = (amount || 0) * taxaBrutaSimulacao;
    }

    const rendimentoLiquidoPeriodo = rendimentoBrutoPeriodo * (1 - aliquota / 100);
    const valorIR = rendimentoBrutoPeriodo - rendimentoLiquidoPeriodo;
    const taxaLiquida = (taxaBrutaSimulacao * 100) * (1 - aliquota / 100);

    // Indicadores dinâmicos para exibição no card
    let cdiLabel = "";
    let ipcaLabel = "";

    if (simulationPeriod === "diário") {
      const cdiDia = (Math.pow(1 + (cdi / 100), 1 / 252) - 1) * 100;
      const ipcaDia = (Math.pow(1 + (ipcaUtilizado / 100), 1 / 365) - 1) * 100;
      cdiLabel = `CDI: ${cdiDia.toFixed(4).replace('.', ',')}% a.d.`;
      ipcaLabel = `IPCA: ${ipcaDia.toFixed(4).replace('.', ',')}% a.d.`;
    } else if (simulationPeriod === "mensal") {
      const cdiMes = (Math.pow(1 + (cdi / 100), 1 / 12) - 1) * 100;
      const ipcaMes = (Math.pow(1 + (ipca / 100), 1 / 12) - 1) * 100;
      cdiLabel = `CDI: ${cdiMes.toFixed(2).replace('.', ',')}% a.m.`;
      ipcaLabel = `IPCA: ${ipcaMes.toFixed(2).replace('.', ',')}% a.m.`;
    } else {
      cdiLabel = `CDI: ${cdi.toFixed(2).replace('.', ',')}% a.a.`;
      ipcaLabel = `IPCA: ${ipcaAnualReal.toFixed(2).replace('.', ',')}% a.a.`;
    }

    return {
      tipoTributacao,
      aliquota,
      rendimentoBrutoPeriodo,
      rendimentoLiquidoPeriodo,
      valorIR,
      taxaLiquida,
      taxaBruta: taxaEstimada,
      cdiLabel,
      ipcaLabel
    };
  }, [amount, taxaEstimada, date, allSubcategories, selectedInvestmentCategoryId, simulationPeriod, indexador, cdi, cdiDiario, ipca, ipcaAnualReal]);

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
    enabled: !!user, // Passando enabled
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
      showSuccessToast("Investimento adicionado!");
      // Reset form
      setSelectedInvestmentCategoryId(UNSELECTED_VALUE); // Reset
      setAmount(undefined); // Reset para undefined
      setProfitability(undefined); // Reset para undefined
      setPercentualIndexador(undefined); // Reset percentual indexador
      setTipoRentabilidade("indexado"); // Reinicia como indexado
      setDate(new Date()); // Reset para Date
      setType("fixed");
      setValidationErrors({}); // Clear errors on success
    },
    onError: (error) => {
      showErrorToast("Erro ao adicionar investimento", error.message);
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
      showSuccessToast("Investimento removido!");
      setIsConfirmDeleteOpen(false); // Fechar o diálogo após sucesso
      setInvestmentToDeleteId(null); // Limpar o ID
    },
    onError: (error) => {
      showErrorToast("Erro ao remover investimento", error.message);
      console.error("Supabase error deleting investment:", error);
      setIsConfirmDeleteOpen(false); // Fechar o diálogo mesmo em caso de erro
      setInvestmentToDeleteId(null); // Limpar o ID
    }
  });

  // Mutation for rescuing an investment
  const rescueInvestmentMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!user?.id) throw new Error("Usuário não autenticado.");
      const { error } = await supabase
        .from("investimentos")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["investments", user?.id] });
      showSuccessToast("Investimento resgatado!");
      setIsConfirmRescueOpen(false);
      setInvestmentToRescue(null);
    },
    onError: (error) => {
      showErrorToast("Erro ao resgatar investimento", error.message);
      console.error("Supabase error rescuing investment:", error);
      setIsConfirmRescueOpen(false);
      setInvestmentToRescue(null);
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingForm(true);

    const newErrors: Record<string, boolean> = {};
    let hasError = false;

    if (!user) {
      showErrorToast("Usuário não autenticado.");
      setLoadingForm(false);
      return;
    }

    if (!selectedInvestmentCategoryId || selectedInvestmentCategoryId === UNSELECTED_VALUE || selectedInvestmentCategoryId.trim() === "") {
      newErrors.selectedInvestmentCategoryId = true;
      hasError = true;
    }
    if (amount === undefined || amount <= 0) {
      newErrors.amount = true;
      hasError = true;
    }
    if (tipoRentabilidade === "fixo" && (profitability === undefined || profitability < 0)) {
      newErrors.profitability = true;
      hasError = true;
    }
    if (tipoRentabilidade === "indexado") {
      if (percentualIndexador === undefined || percentualIndexador <= 0) {
        newErrors.percentualIndexador = true;
        hasError = true;
      }
    }
    if (!date) {
      newErrors.date = true;
      hasError = true;
    }

    setValidationErrors(newErrors);
    if (hasError) {
      if (newErrors.selectedInvestmentCategoryId) {
        setTimeout(() => {
          document.getElementById("investment-category")?.focus();
        }, 10);
      }
      showErrorToast("Preencha todos os campos obrigatórios");
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
      tipo_rentabilidade: tipoRentabilidade,
      taxa_fixa: tipoRentabilidade === "fixo" ? profitability : null,
      indexador: tipoRentabilidade === "indexado" ? indexador : null,
      percentual_indexador: tipoRentabilidade === "indexado" ? percentualIndexador : null,
      origem_investimento: "saldo_atual",
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

  const handleRescue = (investment: any) => {
    setInvestmentToRescue(investment);
    setIsConfirmRescueOpen(true);
  };

  const handleConfirmRescue = () => {
    if (investmentToRescue) {
      rescueInvestmentMutation.mutate(investmentToRescue.id);
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
    queryClient.invalidateQueries({ queryKey: ["indexadores"] }); // Also refresh indexers if needed
    showSuccessToast("Investimento atualizado!");
    handleCancelEdit();
  };

  const calculatedInvestments = useMemo(() => {
    return (investments || []).map(inv => {
      let idxMap: Map<string, number> | undefined;
      if (inv.tipo_rentabilidade === "indexado") {
        if (inv.indexador === "CDI") idxMap = indexadorMapCDI;
        else if (inv.indexador === "IPCA") idxMap = indexadorMapIPCA;
      }

      const tipoTributacao = getTipoTributacao(inv, allSubcategories);

      console.log(`Calculando ${inv.tipo} (${inv.id}):`, {
        tipoRentabilidade: inv.tipo_rentabilidade,
        indexador: inv.indexador,
        percentualIndexador: inv.percentual_indexador,
        tipoTributacao
      });

      const pIndexador = inv.tipo_rentabilidade === "indexado" ? (inv.percentual_indexador || 100) : 100;

      console.log(`Debug Investimento ${inv.id}:`, {
        rawPercentual: inv.percentual_indexador,
        finalPercentual: pIndexador,
        tipo: inv.tipo,
        valor: inv.valor
      });

      // Cálculo de rendimento usando dados históricos (Engine Real - Provisão Diária)
      const {
        valorAtual: valorLiquido,
        ultimaTaxaAplicada: taxaDiaria,
        rendimentoBrutoAcumulado: rendimentoBruto,
        irProvisionado: valorIR
      } = calcularRendimentoComCDI({
        valorInicial: inv.valor,
        dataInicio: inv.data,
        dataFim: inv.data_resgate || null,
        indexadorMap: idxMap || new Map<string, number>(),
        indexador: inv.indexador ?? "CDI",
        percentualIndexador: pIndexador,
        taxaFixaAnual: inv.tipo_rentabilidade === "fixo" ? (inv.taxa_fixa || 0) : null,
        tipoTributacao
      });

      const rendimentoLiquido = valorLiquido - inv.valor;
      const investDate = typeof inv.data === 'string' ? new Date(`${inv.data}T12:00:00`) : new Date(inv.data);
      const aliquotaIR = getAliquotaIR(investDate, new Date(), tipoTributacao);

      const rentabilidadeBruta = inv.tipo_rentabilidade === "indexado"
        ? (inv.indexador === "CDI"
          ? (cdi * (inv.percentual_indexador || 100) / 100)
          : (((1 + (ipca / 100)) * (1 + ((inv.percentual_indexador || 0) / 100)) - 1) * 100))
        : (inv.taxa_fixa || 0);

      const rentabilidadeLiquida = rentabilidadeBruta * (1 - aliquotaIR / 100);

      const rendimentoBrutoDia = valorLiquido * taxaDiaria;
      const rendimentoHojeLiquido = rendimentoBrutoDia * (1 - aliquotaIR / 100);

      return {
        ...inv,
        tipoTributacao,
        rentabilidade: rentabilidadeBruta,
        rentabilidadeLiquida,
        valorAtualVirtual: inv.valor + rendimentoBruto, // Saldo bruto para fins informativos
        rendimentoHojeVirtual: rendimentoHojeLiquido,
        taxaDiaria,
        aliquotaIR,
        rendimentoBruto,
        imposto: valorIR,
        rendimentoLiquido,
        valorLiquido
      };
    });
  }, [investments, cdi, ipca, allSubcategories, indexadorMapCDI, indexadorMapIPCA]);

  const totalProjectedAnnualYield = useMemo(() => {
    const rawTotal = calculatedInvestments.reduce((sum, inv) => {
      const annualRateDecimal = inv.rentabilidade / 100; // already derived in calculatedInvestments
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
    const totalCurrentBalance = calculatedInvestments.reduce((sum, inv) => sum + inv.valorLiquido, 0);

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



  return (
    <div className={cn("flex flex-col min-h-[100dvh] relative global-bg", isMobile ? "pt-0" : "pt-[72px]")}>
      {isMobile && (
          <div
              className="absolute inset-0 z-10 pointer-events-none"
              style={{
                  background: "linear-gradient(180deg, #FAFAFA 0%, #FAFAFA 75%, #F8F9FB 88%, #FCFCFE 100%)"
              }}
          />
      )}

      {/* HEADER PREMIUM — FINTECH STYLE (INVESTMENTS THEME) */}
      {!isMobile && (
        <div className="relative h-[160px] w-full overflow-hidden bg-transparent">
          <div className="container-app relative z-10 pt-[28px] md:pt-[42px] flex justify-between items-start">
            <div>
              <div className="flex items-start gap-3">
                <div
                  className="btn-3d btn-3d-icon p-2 rounded-xl flex items-center justify-center border-none cursor-default h-auto w-auto mt-1"
                  style={{ "--cor-topo": "#FFFFFF", "--cor-base": "#F1F5F9" } as any}
                >
                  <span className="text-xl select-none">📈</span>
                </div>
                <div className="flex flex-col">
                  <h1 className="text-2xl font-extrabold text-[#1e3a8a] tracking-[0.5px] -mt-0.5" style={{ fontFamily: "'Inter', sans-serif" }}>
                    Meus Investimentos
                  </h1>
                  <p className="text-sm font-bold text-slate-500 -mt-0.5 tracking-wider opacity-80">
                    Carteira e Rendimentos
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-1 font-bold text-sm !text-[#1e3a8a] hover:opacity-80 transition-colors bg-transparent border-none outline-none focus:outline-none shadow-none mt-2 pr-4 cursor-pointer"
            >
              <DynamicIcon name="ArrowLeft" className="h-[18px] w-[18px]" strokeWidth={2.5} />
              Voltar
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className={cn("container-app relative z-20 flex-grow", isMobile ? "pt-[calc(4rem+env(safe-area-inset-top))] pb-4" : "pt-0 pb-8 -mt-6")}>
        {!isMobile && (
          <>

            {/* 🔹 NOVO: Card de resumo unificado (DESKTOP) */}
            <div className="rounded-[18px] p-6 shadow-sm mb-8 hidden lg:flex items-center border border-[rgba(15,23,42,0.10)]" style={{ backgroundColor: "#FFFFFF" }}>
              <div className="grid grid-cols-4 items-center gap-x-6 w-full">
                {/* Total Investido */}
                <div className="flex items-center justify-start gap-4">
                  <div
                    className="p-2.5 rounded-xl flex items-center justify-center bg-white shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
                    style={{ border: "1px solid rgba(0,0,0,0.04)" }}
                  >
                    <DynamicIcon name="DollarSign" className="h-5 w-5 text-[#0556C3]" strokeWidth={3} />
                  </div>
                  <div className="flex flex-col">
                    <h4 className="text-[10px] font-black text-[#0556C3] uppercase tracking-[0.2em] mb-1 leading-none">Saldo Líquido Total</h4>
                    <p className="text-xl font-bold text-slate-700 tracking-tight leading-none">{formatCurrency(stats.totalCurrentBalance)}</p>
                  </div>
                </div>

                {/* Rentabilidade Média */}
                <div className="flex items-center justify-start gap-4 border-l border-[rgba(0,102,255,0.15)] h-10 pl-6">
                  <div
                    className="p-2.5 rounded-xl flex items-center justify-center bg-white shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
                    style={{ border: "1px solid rgba(0,0,0,0.04)" }}
                  >
                    <DynamicIcon name="Percent" className="h-5 w-5 text-[#0556C3]" strokeWidth={3} />
                  </div>
                  <div className="flex flex-col">
                    <h4 className="text-[10px] font-black text-[#0556C3] uppercase tracking-[0.2em] mb-1 leading-none">Média</h4>
                    <div className="flex items-baseline gap-1">
                      <p className="text-xl font-bold text-slate-700 tracking-tight leading-none">{stats.avgProfitability.toFixed(2)}%</p>
                      <span className="text-[10px] font-black text-slate-500 uppercase">a.a.</span>
                    </div>
                  </div>
                </div>

                {/* Rendimento Diário */}
                <div className="flex items-center justify-start gap-4 border-l border-[rgba(0,102,255,0.15)] h-10 pl-6">
                  <div
                    className="p-2.5 rounded-xl flex items-center justify-center bg-white shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
                    style={{ border: "1px solid rgba(0,0,0,0.04)" }}
                  >
                    <DynamicIcon name="Clock" className="h-5 w-5 text-[#0556C3]" strokeWidth={3} />
                  </div>
                  <div className="flex flex-col">
                    <h4 className="text-[10px] font-black text-[#0556C3] uppercase tracking-[0.2em] mb-1 leading-none">Diário</h4>
                    <p className="text-xl font-bold text-slate-700 tracking-tight leading-none">{formatCurrency(stats.totalDailyYieldRS)}</p>
                  </div>
                </div>

                {/* Rendimento Mensal */}
                <div className="flex items-center justify-start gap-4 border-l border-[rgba(0,102,255,0.15)] h-10 pl-6">
                  <div
                    className="p-2.5 rounded-xl flex items-center justify-center bg-white shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
                    style={{ border: "1px solid rgba(0,0,0,0.04)" }}
                  >
                    <DynamicIcon name="Calendar" className="h-5 w-5 text-[#0556C3]" strokeWidth={3} />
                  </div>
                  <div className="flex flex-col">
                    <h4 className="text-[10px] font-black text-[#0556C3] uppercase tracking-[0.2em] mb-1 leading-none">Mensal</h4>
                    <p className="text-xl font-bold text-slate-700 tracking-tight leading-none">{formatCurrency(stats.totalMonthlyYieldRS)}</p>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* REMOVIDO: MonthNavigator global */}

        {isMobile ? (
          <div className="grid grid-cols-1 gap-4">

            <Card
              className={cn(
                "p-6 rounded-[18px] shadow-sm border border-[rgba(15,23,42,0.10)] card-despesas",
                isMobile && "p-4"
              )}
              style={{ background: "linear-gradient(135deg, #ffffff 0%, #f9fafb 100%)", backgroundBlendMode: "soft-light" }}
            >
              <h2 className={cn("text-xl text-[#0556C3] font-extrabold tracking-[0.2px] pb-[1px] m-0 leading-none text-left mb-6", isMobile && "mb-4")} style={{ fontFamily: "'Inter', sans-serif" }}>💶 Novo Investimento</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-[6px]">
                  <Label htmlFor="investment-category" className={cn("text-[#283c5a]", isMobile && "text-xs")}>Nome do Investimento <span className="text-red-500 font-bold">*</span></Label>
                  <Select
                    value={selectedInvestmentCategoryId}
                    onValueChange={(value) => {
                      setSelectedInvestmentCategoryId(value);
                      setValidationErrors(prev => ({ ...prev, selectedInvestmentCategoryId: false }));
                    }}
                    disabled={loadingForm}
                  >
                    <SelectTrigger id="investment-category" className={cn(
                      "rounded-xl input-3d-premium font-bold transition-all duration-200",
                      selectedInvestmentCategoryId === UNSELECTED_VALUE && "text-gray-400",
                      isMobile && "h-9 text-sm",
                      getBorderClass({ isInvalid: validationErrors.selectedInvestmentCategoryId, isValid: validationErrors.selectedInvestmentCategoryId === false, variant: "green" })
                    )}>
                      <SelectValue placeholder="Selecione o investimento" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-none shadow-xl w-[var(--radix-select-trigger-width)]">
                      <SelectItem value={UNSELECTED_VALUE} disabled className={cn(isMobile && "text-sm")}>Selecione o investimento</SelectItem>
                      {incomeInvestmentSubcategories.length === 0 && (
                        <SelectItem value={UNSELECTED_VALUE} disabled className={cn(isMobile && "text-sm")}>Nenhum investimento disponível</SelectItem>
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



                <div className={cn(
                  "grid gap-2",
                  tipoRentabilidade === "indexado" ? "grid-cols-2" : "grid-cols-1"
                )}>
                  <div className="space-y-[6px]">
                    <Label className={cn("text-[#283c5a]", isMobile && "text-xs")}>Rentabilidade</Label>
                    <Select
                      value={tipoRentabilidade}
                      onValueChange={(v: "fixo" | "indexado") => {
                        setTipoRentabilidade(v);
                        if (v === "fixo") {
                          setPercentualIndexador(undefined);
                        } else {
                          setProfitability(undefined);
                        }
                      }}
                    >
                      <SelectTrigger className={cn("rounded-xl input-3d-premium font-bold transition-all duration-200", isMobile && "h-9 text-sm")}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl border-none shadow-xl">
                        <SelectItem value="fixo" className="text-sm">Fixa</SelectItem>
                        <SelectItem value="indexado" className="text-sm">Indexada</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {tipoRentabilidade === "indexado" && (
                    <div className="space-y-[6px] animate-in fade-in slide-in-from-left-2 duration-300">
                      <Label className={cn("text-[#283c5a]", isMobile && "text-xs")}>Indexador</Label>
                      <Select value={indexador} onValueChange={(v) => setIndexador(v as "CDI" | "IPCA")}>
                        <SelectTrigger className={cn("rounded-xl input-3d-premium font-bold transition-all duration-200", isMobile && "h-9 text-sm")}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-none shadow-xl">
                          <SelectItem value="CDI" className="text-sm">CDI</SelectItem>
                          <SelectItem value="IPCA" className="text-sm">IPCA</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                <div className={cn("grid gap-2", "grid-cols-2")}>
                  {tipoRentabilidade === "fixo" ? (
                    <div className="space-y-[6px]">
                      <Label htmlFor="profitability" className={cn("text-[#283c5a]", isMobile && "text-xs")}>Rentabilidade % a.a</Label>
                      <NumericInput
                        id="profitability"
                        value={profitability === undefined ? "" : profitability}
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
                          "rounded-xl input-3d-premium font-bold px-3 transition-all duration-200",
                          isMobile && "h-9 text-sm",
                          getBorderClass({ isInvalid: validationErrors.profitability, isValid: validationErrors.profitability === false, variant: "green" })
                        )}
                      />
                    </div>
                  ) : (
                    <div className="space-y-[6px]">
                      <Label className={cn("text-[#283c5a]", isMobile && "text-xs")}>{indexador === "IPCA" ? "IPCA + %" : `% do ${indexador || "Indexador"}`}</Label>
                      <NumericInput
                        value={percentualIndexador === undefined ? "" : percentualIndexador}
                        onValueChange={(v) => {
                          setPercentualIndexador(v.floatValue);
                          setValidationErrors(prev => ({ ...prev, percentualIndexador: false }));
                        }}
                        placeholder="0,00"
                        className={cn(
                          "h-9 rounded-xl input-3d-premium font-bold px-3 text-sm",
                          getBorderClass({ isInvalid: validationErrors.percentualIndexador, variant: "green" })
                        )}
                      />
                    </div>
                  )}

                  <div className="space-y-[6px]">
                    <Label htmlFor="amount" className={cn("text-[#283c5a]", isMobile && "text-xs")}>Valor Investido (R$)</Label>
                    <CurrencyBR
                      value={amount}
                      onChange={(v) => {
                        setAmount(v);
                        setValidationErrors(prev => ({ ...prev, amount: false }));
                      }}
                      disabled={loadingForm}
                      className={cn(
                        "rounded-xl input-3d-premium font-bold px-3 transition-all duration-200",
                        isMobile && "h-9 text-sm",
                        getBorderClass({ isInvalid: validationErrors.amount, isValid: validationErrors.amount === false, variant: "green" })
                      )}
                    />
                  </div>
                </div>

                {/* Card de Simulação Compacto e Unificado */}
                {amount !== undefined && (tipoRentabilidade === "fixo" ? profitability !== undefined : percentualIndexador !== undefined) && (
                  <div className="px-3 pt-[10px] pb-[9px] rounded-xl bg-slate-50 border border-slate-200 animate-in fade-in slide-in-from-bottom-2 duration-300 shadow-sm">
                    {/* Linha 1: Header */}
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-[#0556C3]">SIMULAÇÃO</span>

                      <Select
                        value={simulationPeriod}
                        onValueChange={(v: any) => setSimulationPeriod(v)}
                      >
                        <SelectTrigger className="w-auto h-7 bg-slate-200 border border-slate-300 border-b-2 rounded-xl px-2 text-[10px] text-slate-700 font-bold hover:bg-slate-300 transition-all active:translate-y-[1px] active:border-b-0 shadow-sm gap-1 focus:ring-0 focus:ring-offset-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-slate-200 shadow-lg min-w-[100px]">
                          <SelectItem value="diário" className="text-xs">Diário</SelectItem>
                          <SelectItem value="mensal" className="text-xs">Mensal</SelectItem>
                          <SelectItem value="anual" className="text-xs">Anual</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-2">
                      {/* Coluna Esquerda: IR */}
                      <div className="flex flex-col gap-y-0.5 opacity-90">
                        <span className="text-[11px] text-slate-500 uppercase font-medium">IR (IMPOSTO)</span>
                        <span className="text-sm font-semibold text-red-400 leading-tight">
                          - {formatCurrency(metricsNewForm.valorIR)}
                        </span>
                        <span className="text-[11px] font-medium text-red-400/90 leading-tight">
                          {metricsNewForm.tipoTributacao === "isento" ? "0%" : `${metricsNewForm.aliquota.toString().replace('.', ',')}%`}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium mt-0.5">
                          {metricsNewForm.ipcaLabel}
                        </span>
                      </div>

                      {/* Coluna Direita: Rentabilidade */}
                      <div className="flex flex-col gap-y-0.5 items-end text-right border-l border-slate-200/50 pl-4">
                        <span className="text-[11px] text-slate-500 uppercase font-medium whitespace-nowrap">RENT. LÍQUIDA</span>
                        <span className="text-sm font-semibold text-green-600 leading-tight">
                          {formatCurrency(metricsNewForm.rendimentoLiquidoPeriodo)}
                        </span>
                        <span className="text-[11px] font-medium text-green-500/80 leading-tight">
                          {metricsNewForm.taxaLiquida.toFixed(2).replace('.', ',')}% a.a.
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium mt-0.5">
                          {metricsNewForm.cdiLabel}
                        </span>
                      </div>
                    </div>
                  </div>
                )}


                <div className="space-y-[6px]">
                  <Label htmlFor="date" className={cn("text-[#283c5a]", isMobile && "text-xs")}>Data do Investimento</Label>
                  <Button
                    type="button"
                    variant={"outline"}
                    onClick={() => setIsCalendarOpen(true)}
                    className={cn(
                      "w-full justify-start text-left font-bold h-10 rounded-xl",
                      "input-3d-premium px-3 transition-all duration-200",
                      !date && "text-gray-400",
                      isMobile && "h-9 text-sm",
                      getBorderClass({ isInvalid: validationErrors.date, isValid: validationErrors.date === false, variant: "green" })
                    )}
                    disabled={loadingForm}
                  >
                    <DynamicIcon name="📅" className={cn("mr-2 h-4 w-4 text-primary", isMobile && "h-3.5 w-3.5")} />
                    {date ? format(date, "PPP", { locale: ptBR }) : <span>Selecione uma data</span>}
                  </Button>
                  <DatePickerModal 
                    isOpen={isCalendarOpen}
                    setIsOpen={setIsCalendarOpen}
                    date={date}
                    onSelect={(selectedDate) => {
                      setDate(selectedDate);
                      setValidationErrors(prev => ({ ...prev, date: false }));
                    }}
                  />
                </div>

                <Button
                  type={isExpired ? "button" : "submit"}
                  onClick={isExpired ? handleBlockedClick : undefined}
                  className={cn(
                    "w-full rounded-xl btn-3d font-extrabold tracking-[0.5px] text-white border-none transition-all active:scale-95 shadow-[0_2px_4px_rgba(0,0,0,0.05)] text-lg flex items-center justify-center",
                    isMobile ? "h-11 text-lg" : "h-11 text-lg",
                    isExpired && "opacity-80"
                  )}
                  style={{ "--cor-topo": "#0556C3", "--cor-base": "#04469E", fontFamily: "'Inter', sans-serif" } as any}
                  disabled={!isExpired && loadingForm}
                >
                  {loadingForm && !isExpired ? "Adicionando..." : "Adicionar Investimento"}
                  {isExpired && <span className="ml-1.5 text-base">🔒</span>}
                </Button>
              </form>
            </Card>

            {/* Investments List */}
            <div className="mt-2">
              <Card
                className={cn("p-6 rounded-[18px] shadow-sm border border-[rgba(15,23,42,0.10)] card-despesas text-card-foreground", isMobile && "p-4")}
                style={{ backgroundColor: "#FFFFFF" }}
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className={cn("text-2xl font-extrabold text-[#0556C3]", isMobile && "text-xl")}>💰 Meus Investimentos</h2>
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
                      className="rounded-xl flex-1 text-[12px] font-black h-7 transition-all data-[state=on]:bg-gradient-to-b data-[state=on]:from-[#4B76D1] data-[state=on]:to-[#3555A2] data-[state=on]:text-white data-[state=on]:shadow-[inset_0px_1px_1px_rgba(255,255,255,0.4),inset_0px_-1px_1px_rgba(0,0,0,0.1)] text-[#1E6BCE]"
                    >
                      DIA
                    </ToggleGroupItem>
                    <ToggleGroupItem
                      value="monthly"
                      className="rounded-xl flex-1 text-[12px] font-black h-7 transition-all data-[state=on]:bg-gradient-to-b data-[state=on]:from-[#4B76D1] data-[state=on]:to-[#3555A2] data-[state=on]:text-white data-[state=on]:shadow-[inset_0px_1px_1px_rgba(255,255,255,0.4),inset_0px_-1px_1px_rgba(0,0,0,0.1)] text-[#1E6BCE]"
                    >
                      MÊS
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>
                <div className="space-y-5 max-h-[480px] overflow-y-auto no-scrollbar">
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
                          onClick={() => { if (isMobile) handleEditClick(investment); }}
                          className="relative group overflow-hidden transition-all duration-300 py-[14px] pl-4 pr-[52px] rounded-[16px] mb-4 last:mb-0 border border-[rgba(0,0,0,0.08)] shadow-sm cursor-pointer active:scale-[0.98]"
                          style={{
                            backgroundColor: "#FFFFFF"
                          }}
                        >
                          {/* Coluna Vertical de Ações (Direita) */}
                          <div className="absolute right-3 top-0 bottom-0 flex flex-col justify-center gap-3">
                            <Button
                              type="button"
                              size="icon"
                              onClick={(e) => { e.stopPropagation(); handleEditClick(investment); }}
                              className={cn(
                                "p-0 flex items-center justify-center rounded-xl transition-all active:scale-90 flex-shrink-0 !opacity-100",
                                isMobile
                                  ? "bg-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] input-3d-premium !border-slate-400/60 border hover:bg-slate-50 h-8 w-8 text-sm"
                                  : "bg-transparent border-none hover:bg-slate-100 h-8 w-8 text-sm"
                              )}
                            >
                              <span className={cn(isMobile ? "text-base" : "text-sm")}>✏️</span>
                            </Button>

                            <Button
                              type="button"
                              size="icon"
                              onClick={(e) => { e.stopPropagation(); handleDelete(investment.id); }}
                              className={cn(
                                "p-0 flex items-center justify-center rounded-xl transition-all active:scale-90 flex-shrink-0 !opacity-100",
                                isMobile
                                  ? "bg-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] input-3d-premium !border-slate-400/60 border hover:bg-slate-50 h-8 w-8 text-sm"
                                  : "bg-transparent border-none hover:bg-slate-100 h-8 w-8 text-sm"
                              )}
                            >
                              <DynamicIcon name="Trash2" className={cn("text-red-500", isMobile ? "h-[18px] w-[18px]" : "h-4 w-4")} />
                            </Button>

                            {investment.origem_investimento === 'saldo_atual' && investment.status !== 'resgatado' && (
                              <Button
                                type="button"
                                size="icon"
                                onClick={(e) => { e.stopPropagation(); handleRescue(investment); }}
                                className={cn(
                                  "p-0 flex items-center justify-center rounded-xl transition-all active:scale-90 flex-shrink-0 !opacity-100",
                                  isMobile
                                    ? "bg-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] input-3d-premium !border-slate-400/60 border hover:bg-slate-50 h-8 w-8 text-sm"
                                    : "bg-transparent border-none hover:bg-slate-100 h-8 w-8 text-sm"
                                )}
                                title="Resgatar Investimento"
                              >
                                <span className={cn(isMobile ? "text-base" : "text-sm")}>💰</span>
                              </Button>
                            )}
                          </div>

                          {/* 1. Top: Icon, Name, Type */}
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-start gap-[5px] -ml-1.5">
                              <DynamicIcon name={investmentIcon} className="h-9 w-9 text-primary/80" style={{ filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.15))" }} />
                              <div className="flex flex-col">
                                <h3 className="font-bold text-gray-800 leading-tight text-base">
                                  {investmentNameDisplay}
                                </h3>
                                <p className="text-xs text-gray-600 font-bold flex items-center gap-2">
                                  {typeLabel}
                                  {investment.status === 'resgatado' && (
                                    <span className="bg-slate-100 text-slate-500 text-[9px] px-1.5 py-0.5 rounded-md border border-slate-200">
                                      Resgatado {investment.data_resgate && `em ${format(new Date(investment.data_resgate), "dd/MM/yyyy")}`}
                                    </span>
                                  )}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* 2. Main Value and Yield */}
                          <div className="flex flex-col justify-between gap-4">
                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <div className="flex flex-col">
                                  <span className="text-[10px] text-slate-500 font-black uppercase tracking-wider leading-none mb-1">Saldo Líquido Total</span>
                                  <span className="font-bold tracking-tight text-[#0556C3] text-2xl">
                                    {formatCurrency(investment.valorLiquido)}
                                  </span>
                                </div>
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
                                className="inline-flex items-center gap-1.5 text-[#1E40AF] px-3.5 py-1.5 rounded-full bg-[#E6F0FF] border border-[#BFDBFE]/50 shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
                              >
                                <DynamicIcon name="TrendingUp" className="h-3.5 w-3.5" />
                                <div className="flex flex-col items-start leading-[1.1]">
                                  <span className="text-[13px] font-black">
                                    {investment.rentabilidadeLiquida.toFixed(2)}%
                                  </span>
                                  <span className="text-[10px] opacity-70 font-bold">
                                    {investment.tipo_rentabilidade === "indexado"
                                      ? `${investment.percentual_indexador}% ${investment.indexador}`
                                      : `Bruto: ${investment.rentabilidade.toFixed(2)}%`}
                                  </span>
                                </div>
                              </div>

                              {/* Data Bottom Right */}
                              <div className="text-[12px] text-slate-500 font-black uppercase tracking-widest">
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

              {/* 🔹 NOVO: Card de resumo unificado (MOBILE) */}
              <div className="mt-6 py-6 px-[22px] shadow-sm rounded-[18px] border border-[rgba(15,23,42,0.10)]" style={{ backgroundColor: "#FFFFFF" }}>
                <div className="grid grid-cols-2 gap-x-4 gap-y-7">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2 mb-2">
                      <div
                        className="p-2 rounded-xl flex items-center justify-center shadow-[0_2px_8px_rgba(5,86,195,0.3)]"
                        style={{ background: "#0556C3" }}
                      >
                        <DynamicIcon name="DollarSign" className="h-3.5 w-3.5 text-white" strokeWidth={3} />
                      </div>
                      <h4 className="text-[11px] font-bold text-[#0556C3] tracking-widest leading-none">Saldo líquido total</h4>
                    </div>
                    <p className="text-lg font-bold text-slate-700 tracking-tight leading-none">{formatCurrency(stats.totalCurrentBalance)}</p>
                  </div>

                  <div className="flex flex-col items-end text-right">
                    <div className="flex flex-row-reverse items-center gap-2 mb-2">
                      <div
                        className="p-2 rounded-xl flex items-center justify-center shadow-[0_2px_8px_rgba(5,86,195,0.3)]"
                        style={{ background: "#0556C3" }}
                      >
                        <DynamicIcon name="Percent" className="h-3.5 w-3.5 text-white" strokeWidth={3} />
                      </div>
                      <h4 className="text-[11px] font-bold text-[#0556C3] tracking-widest leading-none">Média</h4>
                    </div>
                    <div className="flex items-baseline gap-0.5">
                      <p className="text-lg font-bold text-slate-700 tracking-tight leading-none">{stats.avgProfitability.toFixed(2)}%</p>
                      <span className="text-[8px] font-black text-gray-500 uppercase">a.a.</span>
                    </div>
                  </div>

                  <div className="flex flex-col">
                    <div className="flex items-center gap-2 mb-2">
                      <div
                        className="p-2 rounded-xl flex items-center justify-center shadow-[0_2px_8px_rgba(5,86,195,0.3)]"
                        style={{ background: "#0556C3" }}
                      >
                        <DynamicIcon name="Calendar" className="h-3.5 w-3.5 text-white" strokeWidth={3} />
                      </div>
                      <h4 className="text-[11px] font-bold text-[#0556C3] tracking-widest leading-none">Mensal</h4>
                    </div>
                    <p className="text-lg font-bold text-slate-700 tracking-tight leading-none">{formatCurrency(stats.totalMonthlyYieldRS)}</p>
                  </div>

                  <div className="flex flex-col items-end text-right">
                    <div className="flex flex-row-reverse items-center gap-2 mb-2">
                      <div
                        className="p-2 rounded-xl flex items-center justify-center shadow-[0_2px_8px_rgba(5,86,195,0.3)]"
                        style={{ background: "#0556C3" }}
                      >
                        <DynamicIcon name="Clock" className="h-3.5 w-3.5 text-white" strokeWidth={3} />
                      </div>
                      <h4 className="text-[11px] font-bold text-[#0556C3] tracking-widest leading-none">Diário</h4>
                    </div>
                    <p className="text-lg font-bold text-slate-700 tracking-tight leading-none">{formatCurrency(stats.totalDailyYieldRS)}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className={cn("grid gap-8 lg:mb-[40px] lg:items-start", isMobile ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-[0.9fr_1.6fr]")}>
            {/* Form */}
            <div>
              <Card
                className={cn(
                  "p-6 lg:pb-4 rounded-[18px] shadow-sm border border-[rgba(15,23,42,0.10)] card-despesas",
                  isMobile && "border-none shadow-none bg-transparent p-4 h-auto"
                )}
                style={{ background: "linear-gradient(135deg, #ffffff 0%, #f9fafb 100%)", backgroundBlendMode: "soft-light" }}
              >
                <h2 className={cn("text-2xl font-extrabold mb-6", isMobile && "text-xl mb-4")} style={{ color: "#0556C3" }}>💶 Novo Investimento</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="investment-category" className={cn(isMobile && "text-xs")}>Nome do Investimento <span className="text-red-500 font-bold">*</span></Label>
                    <Select
                      value={selectedInvestmentCategoryId}
                      onValueChange={(value) => {
                        setSelectedInvestmentCategoryId(value);
                        setValidationErrors(prev => ({ ...prev, selectedInvestmentCategoryId: false }));
                      }}
                      disabled={loadingForm}
                    >
                      <SelectTrigger id="investment-category" className={cn(
                        "rounded-xl input-3d-premium font-medium transition-all duration-200",
                        isMobile && "h-9 text-sm",
                        getBorderClass({ isInvalid: validationErrors.selectedInvestmentCategoryId, isValid: validationErrors.selectedInvestmentCategoryId === false })
                      )}>
                        <SelectValue placeholder="Selecione o investimento" />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl border-none shadow-xl w-[var(--radix-select-trigger-width)]">
                        <SelectItem value={UNSELECTED_VALUE} disabled className={cn(isMobile && "text-sm")}>Selecione o investimento</SelectItem>
                        {incomeInvestmentSubcategories.length === 0 && (
                          <SelectItem value={UNSELECTED_VALUE} disabled className={cn(isMobile && "text-sm")}>Nenhum investimento disponível</SelectItem>
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



                  <div className={cn(
                    "grid gap-4",
                    tipoRentabilidade === "indexado" ? "grid-cols-2" : "grid-cols-1"
                  )}>
                    <div className="space-y-2">
                      <Label className={cn(isMobile && "text-xs")}>Rentabilidade</Label>
                      <Select
                        value={tipoRentabilidade}
                        onValueChange={(v: "fixo" | "indexado") => {
                          setTipoRentabilidade(v);
                          if (v === "fixo") {
                            setPercentualIndexador(undefined);
                          } else {
                            setProfitability(undefined);
                          }
                        }}
                      >
                        <SelectTrigger className={cn("rounded-xl input-3d-premium font-medium transition-all duration-200", isMobile && "h-9 text-sm")}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-none shadow-xl">
                          <SelectItem value="fixo" className="text-sm">Fixa</SelectItem>
                          <SelectItem value="indexado" className="text-sm">Indexada</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {tipoRentabilidade === "indexado" && (
                      <div className="space-y-2 animate-in fade-in slide-in-from-left-4 duration-300">
                        <Label className={cn(isMobile && "text-xs")}>Indexador</Label>
                        <Select value={indexador} onValueChange={(v) => setIndexador(v as "CDI" | "IPCA")}>
                          <SelectTrigger className="h-10 rounded-xl input-3d-premium text-sm font-bold">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-2xl border-none shadow-xl">
                            <SelectItem value="CDI">CDI</SelectItem>
                            <SelectItem value="IPCA">IPCA</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {tipoRentabilidade === "fixo" ? (
                      <div className="space-y-2">
                        <Label htmlFor="profitability" className={cn(isMobile && "text-xs")}>Rentabilidade % a.a</Label>
                        <NumericInput
                          id="profitability"
                          value={profitability === undefined ? "" : profitability}
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
                            "rounded-xl input-3d-premium font-medium transition-all duration-200 placeholder:text-slate-300 placeholder:font-normal",
                            isMobile && "h-9 text-sm",
                            getBorderClass({ isInvalid: validationErrors.profitability, isValid: validationErrors.profitability === false })
                          )}
                        />
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Label className={cn(isMobile && "text-xs")}>{indexador === "IPCA" ? "IPCA + %" : `% do ${indexador || "Indexador"}`}</Label>
                        <NumericInput
                          value={percentualIndexador === undefined ? "" : percentualIndexador}
                          onValueChange={(v) => {
                            setPercentualIndexador(v.floatValue);
                            setValidationErrors(prev => ({ ...prev, percentualIndexador: false }));
                          }}
                          placeholder="0,00"
                          className={cn(
                            "h-10 rounded-xl input-3d-premium text-sm font-bold placeholder:text-slate-300 placeholder:font-normal",
                            getBorderClass({ isInvalid: validationErrors.percentualIndexador })
                          )}
                        />
                      </div>
                    )}

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
                          "rounded-xl input-3d-premium font-medium transition-all duration-200",
                          isMobile && "h-9 text-sm",
                          getBorderClass({ isInvalid: validationErrors.amount, isValid: validationErrors.amount === false })
                        )}
                      />
                    </div>
                  </div>

                  {/* Card de Simulação Desktop Compacto e Unificado */}
                  {(!isMobile || (amount !== undefined && (tipoRentabilidade === "fixo" ? profitability !== undefined : percentualIndexador !== undefined))) && (
                    <div className="p-2 md:p-3 -my-1.5 md:my-0 rounded-xl bg-slate-50 border border-slate-200 animate-in fade-in slide-in-from-bottom-2 duration-300 shadow-sm">
                      {/* Linha 1: Header */}
                      <div className="flex items-center justify-between mb-1 md:mb-2">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-[#0556C3]">SIMULAÇÃO</span>

                        <Select
                          value={simulationPeriod}
                          onValueChange={(v: any) => setSimulationPeriod(v)}
                        >
                          <SelectTrigger className="w-auto h-7 bg-slate-200 border border-slate-300 border-b-2 rounded-xl px-2 text-[10px] text-slate-700 font-bold hover:bg-slate-300 transition-all active:translate-y-[1px] active:border-b-0 shadow-sm gap-1 focus:ring-0 focus:ring-offset-0">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl border-slate-200 shadow-lg min-w-[100px]">
                            <SelectItem value="diário" className="text-xs">Diário</SelectItem>
                            <SelectItem value="mensal" className="text-xs">Mensal</SelectItem>
                            <SelectItem value="anual" className="text-xs">Anual</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid grid-cols-2">
                        {/* Coluna Esquerda: IR */}
                        <div className="flex flex-col gap-y-0.5 opacity-90">
                          <span className="text-[11px] text-slate-500 uppercase font-medium">IR (IMPOSTO)</span>
                          <span className="text-sm font-semibold text-red-400 leading-tight">
                            - {formatCurrency(metricsNewForm.valorIR)}
                          </span>
                          <span className="text-[11px] font-medium text-red-400/90 leading-tight">
                            {metricsNewForm.tipoTributacao === "isento" ? "0%" : `${metricsNewForm.aliquota.toString().replace('.', ',')}%`}
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium mt-0.5">
                            {metricsNewForm.ipcaLabel}
                          </span>
                        </div>

                        {/* Coluna Direita: Rentabilidade */}
                        <div className="flex flex-col gap-y-0.5 items-end text-right border-l border-slate-200/50 pl-4">
                          <span className="text-[11px] text-slate-500 uppercase font-medium whitespace-nowrap">RENT. LÍQUIDA</span>
                          <span className="text-sm font-semibold text-green-600 leading-tight">
                            {formatCurrency(metricsNewForm.rendimentoLiquidoPeriodo)}
                          </span>
                          <span className="text-[11px] font-medium text-green-500/80 leading-tight">
                            {metricsNewForm.taxaLiquida.toFixed(2).replace('.', ',')}% a.a.
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium mt-0.5">
                            {metricsNewForm.cdiLabel}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Grupo Compacto: Origem e Data */}
                  <div className="flex flex-col w-full gap-0 md:gap-3">

                    {/* Data do Investimento */}
                    <div className="space-y-0.5 md:space-y-2 md:-mt-1">
                      <Label htmlFor="date" className="block text-xs md:text-sm leading-none md:leading-normal">Data do Investimento</Label>
                      <Button
                        type="button"
                        variant={"outline"}
                        onClick={() => setIsCalendarOpen(true)}
                        className={cn(
                          "w-full justify-start text-left font-medium h-10 rounded-xl",
                          "input-3d-premium transition-all duration-200",
                          !date && "text-muted-foreground",
                          isMobile && "h-9 text-sm",
                          getBorderClass({ isInvalid: validationErrors.date, isValid: validationErrors.date === false })
                        )}
                        disabled={loadingForm}
                      >
                        <DynamicIcon name="📅" className={cn("mr-2 h-4 w-4 text-[#1e3a8a]/70", isMobile && "h-3.5 w-3.5")} />
                        {date ? format(date, "PPP", { locale: ptBR }) : <span>Selecione uma data</span>}
                      </Button>
                      <DatePickerModal 
                        isOpen={isCalendarOpen}
                        setIsOpen={setIsCalendarOpen}
                        date={date}
                        onSelect={(selectedDate) => {
                          setDate(selectedDate);
                          setValidationErrors(prev => ({ ...prev, date: false }));
                        }}
                      />
                    </div>
                  </div>

                  <Button
                    type={isExpired ? "button" : "submit"}
                    onClick={isExpired ? handleBlockedClick : undefined}
                    className={cn(
                      "w-full rounded-xl btn-3d font-extrabold tracking-[0.5px] text-white border-none transition-all active:scale-95 shadow-[0_2px_4px_rgba(0,0,0,0.05)] text-lg flex items-center justify-center",
                      isMobile ? "h-11 text-lg" : "h-[46px] text-lg mt-[14px]",
                      isExpired && "opacity-80"
                    )}
                    style={{ "--cor-topo": "#0556C3", "--cor-base": "#04469E", fontFamily: "'Inter', sans-serif" } as any}
                    disabled={!isExpired && loadingForm}
                  >
                    {loadingForm && !isExpired ? "Adicionando..." : "Adicionar Investimento"}
                    {isExpired && <span className="ml-1.5 text-base">🔒</span>}
                  </Button>
                </form>
              </Card>
            </div>

            {/* Investments List */}
            <div>
              <Card
                className={cn("p-6 lg:pb-4 rounded-[18px] shadow-sm border border-[rgba(15,23,42,0.10)] card-despesas text-card-foreground", isMobile && "p-4")}
                style={{ backgroundColor: "#FFFFFF" }}
              >
                <div className={cn("flex items-center justify-between", isMobile ? "mb-[19px]" : "mb-6")}>
                  <h2 className={cn("text-2xl font-extrabold", isMobile && "text-xl")} style={{ color: "#0556C3" }}>💰 Meus Investimentos</h2>
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
                      className="rounded-xl flex-1 text-[12px] font-black h-7 transition-all data-[state=on]:bg-gradient-to-b data-[state=on]:from-[#4B76D1] data-[state=on]:to-[#3555A2] data-[state=on]:text-white data-[state=on]:shadow-[inset_0px_1px_1px_rgba(255,255,255,0.4),inset_0px_-1px_1px_rgba(0,0,0,0.1)] text-[#1E6BCE]"
                    >
                      DIA
                    </ToggleGroupItem>
                    <ToggleGroupItem
                      value="monthly"
                      className="rounded-xl flex-1 text-[12px] font-black h-7 transition-all data-[state=on]:bg-gradient-to-b data-[state=on]:from-[#4B76D1] data-[state=on]:to-[#3555A2] data-[state=on]:text-white data-[state=on]:shadow-[inset_0px_1px_1px_rgba(255,255,255,0.4),inset_0px_-1px_1px_rgba(0,0,0,0.1)] text-[#1E6BCE]"
                    >
                      MÊS
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>
                <div className={cn("overflow-y-auto no-scrollbar", isMobile ? "space-y-[12px] max-h-[490px]" : "space-y-3.5 max-h-[480px]")}>
                  {calculatedInvestments.filter(i => i.status !== 'resgatado').length === 0 ? (
                    <p className="text-muted-foreground text-center py-12 bg-white/50 rounded-2xl border border-dashed border-gray-200">
                      Nenhum investimento cadastrado ainda.
                    </p>
                  ) : (
                    calculatedInvestments.filter(i => i.status !== 'resgatado').map((investment) => {
                      const typeLabel = investmentTypes.find(t => t.value === investment.tipo)?.label || investment.tipo;
                      const investmentCategory = allSubcategories.find(cat => cat.id === investment.nome);
                      let investmentNameDisplay = investmentCategory?.nome || investment.nome;
                      const lowerDisplay = investmentNameDisplay.toLowerCase();

                      // Consolidação visual para Criptomoedas na lista
                      if (lowerDisplay.includes("criptomoedas") ||
                        lowerDisplay.includes("crypto") ||
                        lowerDisplay.includes("bitcoin")) {
                        investmentNameDisplay = "Criptomoedas";
                      }

                      // Consolidação visual para Ações na lista
                      if (lowerDisplay.includes("ações") || lowerDisplay.includes("acoes")) {
                        if (lowerDisplay.includes("dividendos") || lowerDisplay.includes("venda")) {
                          investmentNameDisplay = "Ações";
                        }
                      }

                      // Consolidação visual para Poupança na lista
                      if (lowerDisplay.includes("poupança") || lowerDisplay.includes("poupanca")) {
                        investmentNameDisplay = "Poupança";
                      }

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
                          onClick={() => { if (isMobile) handleEditClick(investment); }}
                          className={cn(
                            "relative group overflow-hidden transition-all duration-300 rounded-[16px] border border-[rgba(15,23,42,0.10)] shadow-sm",
                            isMobile ? "pt-[12px] pb-[13px] px-4 cursor-pointer active:scale-[0.98]" : "py-4 px-5"
                          )}
                          style={{
                            backgroundColor: "#FFFFFF",
                            border: "1px solid rgba(0,0,0,0.08)",
                            boxShadow: "0 2px 8px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,1)"
                          }}
                        >
                          {/* 1. Top: Icon, Name, Type and Actions */}
                          <div className={cn("flex items-start justify-between mb-3.5", isMobile && "mb-3")}>
                            <div className="flex items-start gap-1.5 -ml-1">
                              <DynamicIcon name={investmentIcon} className="h-8 w-8 text-primary/80 mt-1" style={{ filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.15))" }} />
                              <div className="flex flex-col">
                                <h3 className={cn("font-bold text-gray-800 leading-none mb-1.5", isMobile ? "text-base" : "text-[1.05rem]")}>
                                  {investmentNameDisplay}
                                </h3>
                                <p className="text-[11px] text-gray-500 font-bold leading-none">{typeLabel}</p>
                              </div>
                            </div>

                            <div className="flex gap-1.5">
                              <Button
                                type="button"
                                size="icon"
                                onClick={(e) => { e.stopPropagation(); handleEditClick(investment); }}
                                className={cn(
                                  "p-0 flex items-center justify-center rounded-xl transition-all active:scale-90 flex-shrink-0 !opacity-100",
                                  isMobile
                                    ? "bg-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] input-3d-premium !border-slate-400/60 border hover:bg-slate-50 h-8 w-8 text-sm"
                                    : "bg-transparent border-none hover:bg-slate-100 h-8 w-8 text-sm"
                                )}
                              >
                                <span className={cn(isMobile ? "text-base" : "text-sm")}>✏️</span>
                              </Button>
                              {investment.origem_investimento === 'saldo_atual' && investment.status !== 'resgatado' && (
                                <Button
                                  type="button"
                                  size="icon"
                                  onClick={(e) => { e.stopPropagation(); handleRescue(investment); }}
                                  className={cn(
                                    "p-0 flex items-center justify-center rounded-xl transition-all active:scale-90 flex-shrink-0 !opacity-100",
                                    isMobile
                                      ? "bg-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] input-3d-premium !border-slate-400/60 border hover:bg-slate-50 h-8 w-8 text-sm"
                                      : "bg-transparent border-none hover:bg-slate-100 h-8 w-8 text-sm"
                                  )}
                                  title="Resgatar Investimento"
                                >
                                  <span className={cn(isMobile ? "text-base" : "text-sm")}>💰</span>
                                </Button>
                              )}
                              <Button
                                type="button"
                                size="icon"
                                onClick={(e) => { e.stopPropagation(); handleDelete(investment.id); }}
                                className={cn(
                                  "p-0 flex items-center justify-center rounded-xl transition-all active:scale-90 flex-shrink-0 !opacity-100",
                                  isMobile
                                    ? "bg-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] input-3d-premium !border-slate-400/60 border hover:bg-slate-50 h-8 w-8 text-sm"
                                    : "bg-transparent border-none hover:bg-slate-100 h-8 w-8 text-sm"
                                )}
                              >
                                <DynamicIcon name="Trash2" className={cn("text-red-500", isMobile ? "h-[18px] w-[18px]" : "h-4 w-4")} />
                              </Button>
                            </div>
                          </div>

                          {/* 2. Main Value and Yield */}
                          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                            <div className="space-y-[7px]">
                              <div className="flex flex-col">
                                <span className="text-[9px] text-slate-500 font-black uppercase tracking-wider leading-none mb-0.5">Saldo Líquido Total</span>
                                <span className={cn(
                                  "font-bold tracking-tight text-[#0556C3]",
                                  isMobile ? "text-[1.4rem]" : "text-[1.4rem]"
                                )}>
                                  {formatCurrency(investment.valorLiquido)}
                                </span>
                              </div>

                              {/* Rendimento Diário / Mensal */}
                              <div className="flex items-center gap-1 text-[12px] font-bold text-success/90 w-fit ml-0.5">
                                <span className="text-[13px]">🔥</span>
                                <span>+ {formatCurrency(yieldViewMode === "daily" ? dailyYield : monthlyYield)} / {yieldViewMode === "daily" ? "dia" : "mês"}</span>
                              </div>
                            </div>

                            <div className="flex flex-col items-end gap-1.5">
                              {/* Profitability Badge */}
                              <div
                                className="inline-flex items-center gap-1 text-[#1E40AF] px-3 py-1 rounded-full bg-[#E6F0FF] border border-[#BFDBFE]/50 shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
                              >
                                <DynamicIcon name="TrendingUp" className="h-3 w-3" />
                                <div className="flex flex-col items-start leading-none">
                                  <span className="text-[12px] font-black">
                                    {investment.rentabilidadeLiquida.toFixed(2)}%
                                  </span>
                                  <span className="text-[9px] opacity-70 font-bold mt-0.5">
                                    {investment.tipo_rentabilidade === "indexado"
                                      ? `${investment.percentual_indexador}% ${investment.indexador}`
                                      : `Bruto: ${investment.rentabilidade.toFixed(2)}%`}
                                  </span>
                                </div>
                              </div>

                              {/* Data Bottom Right */}
                              <div className="text-[11px] sm:text-[12px] text-slate-400 font-black uppercase tracking-widest mt-1">
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

            </div>
          </div>
        )
        }
      </main>

      <Footer isMobile={isMobile} user={user} className={cn(isMobile && "py-2")} /> {/* Adicionado className para reduzir padding-y em mobile */}

      {/* Edit Investment Dialog */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent
          className={cn(
            isMobile ? "dialog-mobile w-[99%] max-w-[99%] !rounded-[22px] !px-4 !pb-4" : "sm:max-w-[425px] sm:max-h-[90vh] overflow-y-auto !rounded-[22px]",
            "shadow-none border-none"
          )}
          style={{
            background: "linear-gradient(180deg, #FBFCFE 0%, #F6F8FB 100%)",
            backgroundBlendMode: "soft-light",
            backdropFilter: "blur(6px)",
            border: "1px solid rgba(0,0,0,0.06)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.6), inset 0 -8px 20px rgba(0,0,0,0.02), 0 20px 25px -5px rgba(0, 0, 0, 0.1)"
          }}
        >
          <DialogHeader className={cn(
            "flex flex-row items-center justify-start gap-1 pb-0 mb-0 !space-y-0 transform translate-y-[5px]",
            isMobile ? "-mt-[2px] -mb-2" : "-mt-[10px] pl-1"
          )}>
            <span className="text-xl select-none">📋</span>
            <DialogTitle className="text-[19px] font-bold tracking-[0.2px] pb-[1px] m-0 leading-none text-left" style={{ fontFamily: "'Inter', sans-serif" }}>Detalhes do Investimento</DialogTitle>
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
              indexadorMapCDI={indexadorMapCDI}
              indexadorMapIPCA={indexadorMapIPCA}
              onRescueClick={() => {
                handleCancelEdit();
                handleRescue(editingInvestment);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={isConfirmDeleteOpen} onOpenChange={setIsConfirmDeleteOpen}>
        <AlertDialogContent
          className={cn(
            isMobile ? "dialog-mobile w-[99%] max-w-[99%] !px-4 p-4 !pb-4 min-h-[180px] !rounded-[22px] shadow-none border-none" : "sm:max-w-[425px] !pb-4 !rounded-[22px] shadow-none border-none"
          )}
          style={{
            background: "linear-gradient(135deg, #ffffff 0%, #f9fafb 100%)",
            backgroundBlendMode: "soft-light",
            backdropFilter: "blur(6px)",
            border: "1px solid rgba(0,0,0,0.06)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.6), inset 0 -8px 20px rgba(0,0,0,0.02), 0 20px 25px -5px rgba(0, 0, 0, 0.1)"
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center justify-center gap-2 text-xl font-black">
              <DynamicIcon name="Trash2" className="h-6 w-6 text-destructive" />
              Confirmar Exclusão
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              Tem certeza que deseja excluir este investimento? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter
            className={cn(
              "flex flex-col sm:flex-row justify-center gap-2",
              isMobile && "flex-row items-center justify-between"
            )}
          >
            <AlertDialogCancel
              disabled={deleteInvestmentMutation.isPending}
              className={cn(
                "flex-1 rounded-xl btn-3d font-black !text-[#1E40AF] border-none transition-all active:scale-95 shadow-[0_2px_4px_rgba(0,0,0,0.05)] text-lg mt-0 h-11",
                isMobile && "h-11 text-lg"
              )}
              style={{ "--cor-topo": "#E0E7FF", "--cor-base": "#C7D2FE" } as any}
              onClick={() => setIsConfirmDeleteOpen(false)}
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={deleteInvestmentMutation.isPending}
              className={cn(
                "flex-1 rounded-2xl btn-3d font-black text-white border-none transition-all active:scale-95 shadow-[0_2px_4px_rgba(0,0,0,0.05)] text-lg h-11",
                isMobile && "h-12 text-lg"
              )}
              style={{ "--cor-topo": "#FF6B6B", "--cor-base": "#E54D4D" } as any}
            >
              {deleteInvestmentMutation.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isConfirmRescueOpen} onOpenChange={setIsConfirmRescueOpen}>
        <AlertDialogContent
          className={cn(
            isMobile ? "dialog-mobile w-[99%] max-w-[99%] !px-4 p-4 !pb-4 min-h-[180px] !rounded-[22px] shadow-none border-none" : "sm:max-w-[425px] !pb-4 !rounded-[22px] shadow-none border-none"
          )}
          style={{
            background: "linear-gradient(135deg, #ffffff 0%, #f9fafb 100%)",
            backgroundBlendMode: "soft-light",
            backdropFilter: "blur(6px)",
            border: "1px solid rgba(0,0,0,0.06)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.6), inset 0 -8px 20px rgba(0,0,0,0.02), 0 20px 25px -5px rgba(0, 0, 0, 0.1)"
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center justify-center gap-2 text-xl font-black text-[#0556C3]">
              💰 Resgatar Investimento
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center flex flex-col gap-2">
              <span>Deseja resgatar este investimento?</span>
              <span>O valor líquido será devolvido ao Caixa Atual.</span>

              {investmentToRescue && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-left mt-2 flex flex-col gap-1.5 shadow-[inset_0_1px_3px_rgba(0,0,0,0.02)]">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 font-semibold">Valor Investido:</span>
                    <span className="text-slate-700 font-black">{formatCurrency(investmentToRescue.valor)}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 font-semibold">Rendimento Líquido:</span>
                    <span className="text-green-600 font-black">+{formatCurrency(investmentToRescue.rendimentoLiquido)}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs border-b border-slate-200/60 pb-1.5 mb-0.5">
                    <span className="text-slate-500 font-semibold">Imposto de Renda:</span>
                    <span className="text-red-500 font-black">-{formatCurrency(investmentToRescue.imposto)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-600 font-bold">Saldo Líquido Total:</span>
                    <span className="text-[#0556C3] font-black text-lg leading-none">{formatCurrency(investmentToRescue.valorLiquido)}</span>
                  </div>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter
            className={cn(
              "flex flex-col sm:flex-row justify-center gap-2 mt-4",
              isMobile && "flex-row items-center justify-between mt-2"
            )}
          >
            <AlertDialogCancel
              disabled={rescueInvestmentMutation.isPending}
              className={cn(
                "flex-1 rounded-xl btn-3d font-black !text-[#1E40AF] border-none transition-all active:scale-95 shadow-[0_2px_4px_rgba(0,0,0,0.05)] text-lg mt-0 h-11",
                isMobile && "h-11 text-lg"
              )}
              style={{ "--cor-topo": "#E0E7FF", "--cor-base": "#C7D2FE" } as any}
              onClick={() => setIsConfirmRescueOpen(false)}
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmRescue}
              disabled={rescueInvestmentMutation.isPending}
              className={cn(
                "flex-1 rounded-2xl btn-3d font-black text-white border-none transition-all active:scale-95 shadow-[0_2px_4px_rgba(0,0,0,0.05)] text-lg h-11",
                isMobile && "h-12 text-lg"
              )}
              style={{ "--cor-topo": "#3B82F6", "--cor-base": "#2563EB" } as any}
            >
              {rescueInvestmentMutation.isPending ? "Aguarde..." : "Resgatar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}


