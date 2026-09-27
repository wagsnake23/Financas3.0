import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useToast } from "@/contexts/ToastContext";
import DynamicIcon from "@/components/DynamicIcon";
import { Save, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { AppCategory } from "@/types/finance";
import { format, addMonths, getDate } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  cn,
  getBorderClass,
  formatInTimeZone,
  TARGET_TIMEZONE,
} from "@/lib/utils";
import { Plus, ChevronDown, Target } from "lucide-react";
import { AddSubcategoryModal } from "./AddSubcategoryModal";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import CurrencyBR from "@/components/ui/currency-br";
import { Command, CommandInput, CommandList, CommandGroup, CommandItem } from "@/components/ui/command";
import { useProfile } from "@/hooks/useProfile";

import { PaymentDetails } from "./expense-form/PaymentDetails";
import { DateAndInstallmentFields } from "./expense-form/DateAndInstallmentFields";
import { TransactionStatusToggle } from "./expense-form/TransactionStatusToggle";
import { InstallmentPreview } from "./expense-form/InstallmentPreview";
import { TransactionTypeToggle } from "./expense-form/TransactionTypeToggle";

interface Cartao {
  id: string;
  nome: string;
  banco: string;
  ultimos_digitos: string;
  dia_fechamento: number;
  dia_vencimento: number;
}

interface ExpenseFormProps {
  user: User | null;
  cartoes: Cartao[];
  loadCartoes: () => void;
  allSubcategories: AppCategory[];
  queryClient: ReturnType<typeof useQueryClient>;
  isMobile: boolean;
  isRecurring: boolean;
  setIsRecurring: (value: boolean) => void;
  initialValor?: number;
  initialFormaPagamento?: "dinheiro" | "pix" | "cartao";
  initialCartaoId?: string;
  initialDescricao?: string;
  initialSubcategoryId?: string;
  initialTipoPagamento?: "avista" | "parcelado" | "fixo";
  initialNumeroParcelas?: number;
  initialDataVencimento?: Date;
  initialNfceId?: string;
  initialNfceCnpj?: string;
  initialNfceEstabelecimento?: string;
  onSuccess?: () => void;
}

const UNSELECTED_VALUE = "unselected";
const RECURRING_INSTALLMENTS_COUNT = 120;

export const ExpenseForm: React.FC<ExpenseFormProps> = ({
  user,
  cartoes,
  loadCartoes,
  allSubcategories,
  queryClient,
  isMobile,
  isRecurring,
  setIsRecurring,
  initialValor,
  initialFormaPagamento,
  initialCartaoId,
  initialDescricao,
  initialSubcategoryId,
  initialTipoPagamento,
  initialNumeroParcelas,
  initialDataVencimento,
  initialNfceId,
  initialNfceCnpj,
  initialNfceEstabelecimento,
  onSuccess,
}) => {
  const { showSuccessToast, showErrorToast } = useToast();
  
  const { data: profile } = useProfile(user?.id);
  const isExpired = profile?.isExpired;
  
  const handleBlockedClick = (e: React.MouseEvent) => {
    e.preventDefault();
    showErrorToast("🔒 Sua assinatura expirou. Renove para voltar a adicionar despesas.");
    setTimeout(() => {
      window.dispatchEvent(new Event("open-subscription-modal"));
    }, 2000);
  };

  const [selectedSubcategoryId, setSelectedSubcategoryId] =
    useState<string>(UNSELECTED_VALUE);
  const [formaPagamento, setFormaPagamento] = useState<
    "dinheiro" | "pix" | "cartao"
  >("cartao");
  const [tipoPagamento, setTipoPagamento] = useState<
    "avista" | "parcelado" | "fixo"
  >("avista");
  const [cartaoId, setCartaoId] = useState(UNSELECTED_VALUE);
  const [valor, setValor] = useState<number | undefined>(undefined);
  const [descricao, setDescricao] = useState("");
  const [dataVencimento, setDataVencimento] = useState<Date | undefined>(
    new Date()
  );
  const [numeroParcelas, setNumeroParcelas] = useState(1);
  const [loading, setLoading] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isPaid, setIsPaid] = useState(false);

  const [isAddSubcategoryModalOpen, setIsAddSubcategoryModalOpen] = useState(false);
  const [isSubcategoryOpen, setIsSubcategoryOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [validationErrors, setValidationErrors] = useState<
    Record<string, boolean>
  >({});

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
      setSelectedSubcategoryId(data.id);
      setIsAddSubcategoryModalOpen(false);
    },
    onError: (error: any) => {
      showErrorToast("Erro", error.message || "Erro ao adicionar subcategoria");
    },
  });

  const { data: metasData = [] } = useQuery({
    queryKey: ["metas", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("metas")
        .select("categoria_id")
        .eq("user_id", user.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
  const metaCategoryIds = React.useMemo(() => metasData.map(m => m.categoria_id), [metasData]);

  const expenseSubcategories = React.useMemo(() => {
    return allSubcategories
      .filter((cat) => cat.parent_id !== null && cat.parent_id !== "receitas_e_investimentos")
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [allSubcategories]);

  const filteredSubcategories = React.useMemo(() => {
    if (!searchQuery) return expenseSubcategories;
    const normalizedQuery = searchQuery.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return expenseSubcategories.filter(cat => {
      const normalizedName = cat.nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return normalizedName.includes(normalizedQuery);
    });
  }, [searchQuery, expenseSubcategories]);

  // Efeito para aplicar os dados iniciais da NFC-e
  useEffect(() => {
    if (initialValor !== undefined) setValor(initialValor);
    if (initialFormaPagamento !== undefined) setFormaPagamento(initialFormaPagamento);
    if (initialCartaoId !== undefined && initialCartaoId !== UNSELECTED_VALUE) setCartaoId(initialCartaoId);
    if (initialDescricao !== undefined) setDescricao(initialDescricao);
    if (initialSubcategoryId !== undefined && initialSubcategoryId !== UNSELECTED_VALUE) setSelectedSubcategoryId(initialSubcategoryId);
    if (initialTipoPagamento !== undefined) setTipoPagamento(initialTipoPagamento);
    if (initialNumeroParcelas !== undefined) setNumeroParcelas(initialNumeroParcelas);
    if (initialDataVencimento !== undefined) setDataVencimento(initialDataVencimento);
  }, [initialValor, initialFormaPagamento, initialCartaoId, initialDescricao, initialSubcategoryId, initialTipoPagamento, initialNumeroParcelas, initialDataVencimento]);


  useEffect(() => {
    // Lógica inteligente: compras à vista no dinheiro/pix são marcadas como pagas.
    // Cartão de crédito ou parcelados sempre começam como pendentes.
    if (tipoPagamento === "avista" && (formaPagamento === "pix" || formaPagamento === "dinheiro")) {
      setIsPaid(true);
    } else {
      setIsPaid(false);
    }
  }, [formaPagamento, tipoPagamento, isRecurring]);

  // NOVO useEffect isolado para sincronizar isRecurring com tipoPagamento
  useEffect(() => {
    if (typeof setIsRecurring === "function") {
      if (tipoPagamento === "fixo") {
        setIsRecurring(true);
      } else {
        setIsRecurring(false);
      }
    } else {
      console.error(
        "ExpenseForm: setIsRecurring não é uma função no novo useEffect de tipoPagamento.",
        setIsRecurring
      );
    }
  }, [tipoPagamento, setIsRecurring]);

  // Effect for handling recurrence logic and setting numeroParcelas
  useEffect(() => {
    if (isRecurring) {
      // If "Recorrente" is selected (tipoPagamento === "fixo")
      setNumeroParcelas(RECURRING_INSTALLMENTS_COUNT);
    } else {
      // If "Avulsa" is selected (tipoPagamento === "avista" or "parcelado")
      if (tipoPagamento === "avista") {
        setNumeroParcelas(1); // Avista always has 1 installment
      } else if (tipoPagamento === "parcelado") {
        // When switching to "parcelado" from "fixo, reset to 1.
        if (numeroParcelas === RECURRING_INSTALLMENTS_COUNT) {
          setNumeroParcelas(1);
        }
      }
    }
  }, [
    isRecurring,
    tipoPagamento,
    setNumeroParcelas,
    numeroParcelas,
  ]);

  // Effect for handling tipoPagamento changes (and its impact on formaPagamento and numeroParcelas)
  useEffect(() => {
    if (isRecurring) return;

    if (tipoPagamento === "parcelado") {
      setFormaPagamento("cartao");
    }
  }, [tipoPagamento, isRecurring, setFormaPagamento]);

  // Funções para sincronização inversa (botão -> tipoPagamento)
  const handleSelectAvulsa = () => {
    setIsRecurring(false);
    setTipoPagamento("avista");
  };

  const handleSelectRecorrente = () => {
    setIsRecurring(true);
    setTipoPagamento("fixo");
  };

  const handleSubmit = async (e: React.FormEvent) => {
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
    }
    if (!dataVencimento) {
      newErrors.dataVencimento = true;
      hasError = true;
    }
    if (selectedSubcategoryId === UNSELECTED_VALUE) {
      newErrors.selectedSubcategoryId = true;
      hasError = true;
    }
    if (formaPagamento === "cartao" && cartaoId === UNSELECTED_VALUE) {
      newErrors.cartaoId = true;
      hasError = true;
    }
    if (
      !isRecurring &&
      tipoPagamento === "parcelado" &&
      (numeroParcelas <= 0 || !Number.isInteger(numeroParcelas))
    ) {
      newErrors.numeroParcelas = true;
      hasError = true;
    }

    setValidationErrors(newErrors);

    if (hasError) {
      showErrorToast("Validação", "Preencha todos os campos obrigatórios");
      setLoading(false);
      return;
    }

    const valorTotal = valor as number;
    const currentTimestamp = formatInTimeZone(
      new Date(),
      TARGET_TIMEZONE,
      "yyyy-MM-dd HH:mm:ss"
    );
    const recurrenceDay = getDate(dataVencimento as Date);

    try {
      const { data: despesaData, error: despesaError } = await supabase
        .from("despesas")
        .insert({
          user_id: user.id,
          categoria_id:
            selectedSubcategoryId === UNSELECTED_VALUE
              ? null
              : selectedSubcategoryId,
          forma_pagamento: formaPagamento,
          tipo_pagamento: isRecurring ? "fixo" : tipoPagamento,
          cartao_id: formaPagamento === "cartao" ? cartaoId : null,
          valor_total: isRecurring ? 0 : valorTotal,
          numero_parcelas: isRecurring ? 0 : numeroParcelas,
          descricao,
          is_recurring_master: isRecurring,
          data_competencia: formatInTimeZone(
            dataVencimento as Date,
            TARGET_TIMEZONE,
            "yyyy-MM-dd"
          ),
        })
        .select()
        .single();

      if (despesaError) throw despesaError;

      const valorParcela = isRecurring
        ? valorTotal
        : tipoPagamento === "parcelado"
          ? valorTotal / numeroParcelas
          : valorTotal;

      const formattedFirstInstallmentDate = formatInTimeZone(
        dataVencimento as Date,
        TARGET_TIMEZONE,
        "yyyy-MM-dd"
      );

      if (isRecurring) {
        const { error: rpcError } = await supabase.rpc(
          "generate_recurring_entries",
          {
            p_user_id: user.id,
            p_transaction_type: "expense",
            p_master_id: despesaData.id,
            p_first_occurrence_date: formattedFirstInstallmentDate,
            p_monthly_amount: valorParcela,
            p_category_id:
              selectedSubcategoryId === UNSELECTED_VALUE
                ? null
                : selectedSubcategoryId,
            p_description: descricao,
            p_status: "Pendente",
            p_recurrence_day: recurrenceDay,
            p_total_installments: RECURRING_INSTALLMENTS_COUNT,
            p_forma_pagamento: formaPagamento,
            p_cartao_id: formaPagamento === "cartao" ? cartaoId : null,
            p_tipo_pagamento: tipoPagamento,
          }
        );

        if (rpcError) throw rpcError;
      } else {
        const installmentsToInsert = [];
        installmentsToInsert.push({
          despesa_id: despesaData.id,
          numero_parcela: 1,
          valor_parcela: valorParcela,
          vencimento: formattedFirstInstallmentDate,
          pago: tipoPagamento === "avista" ? isPaid : false,
          data_pagamento:
            tipoPagamento === "avista" && isPaid
              ? formatInTimeZone(
                new Date(),
                TARGET_TIMEZONE,
                "yyyy-MM-dd HH:mm:ss"
              )
              : null,
        });

        for (let i = 1; i < numeroParcelas; i++) {
          const installmentDate = addMonths(dataVencimento as Date, i);
          const formattedInstallmentDate = formatInTimeZone(
            installmentDate,
            TARGET_TIMEZONE,
            "yyyy-MM-dd"
          );

          installmentsToInsert.push({
            despesa_id: despesaData.id,
            numero_parcela: i + 1,
            valor_parcela: valorParcela,
            vencimento: formattedInstallmentDate,
            pago: false,
            data_pagamento: null,
          });
        }
        const { error: parcelaError } = await supabase
          .from("despesas_parcelas")
          .insert(installmentsToInsert);

        if (parcelaError) throw parcelaError;
      }

      // NOVO: Link da NFCE com a despesa
      if (initialNfceId) {
        
        try {
          const { error: linkError } = await (supabase as any)
            .from('nfce_compras')
            .update({ 
              despesa_id: despesaData.id,
              status_importacao: 'processada'
            })
            .eq('id', initialNfceId);
            
          if (linkError) {
            console.error('[NFCE] ERRO AO LINKAR:', linkError);
          } else {
          }
        } catch (err) {
          console.error('[NFCE] EXCEÇÃO FATAL AO LINKAR NFCE:', err);
        }
      }

      showSuccessToast("Sucesso", "Despesa adicionada com sucesso!");

      if (initialNfceCnpj && selectedSubcategoryId && selectedSubcategoryId !== UNSELECTED_VALUE && user) {

        try {
          const { data: existingMapping } = await (supabase as any)
            .from('nfce_cnpj_categoria')
            .select('id')
            .eq('user_id', user.id)
            .eq('cnpj', initialNfceCnpj)
            .maybeSingle();

          if (existingMapping) {
            const { error: updateError } = await (supabase as any)
              .from('nfce_cnpj_categoria')
              .update({
                categoria_id: selectedSubcategoryId,
                estabelecimento: initialNfceEstabelecimento || '',
                updated_at: new Date().toISOString()
              })
              .eq('id', existingMapping.id);
            if (updateError) throw updateError;
          } else {
            const { error: insertError } = await (supabase as any)
              .from('nfce_cnpj_categoria')
              .insert({
                user_id: user.id,
                cnpj: initialNfceCnpj,
                estabelecimento: initialNfceEstabelecimento || '',
                categoria_id: selectedSubcategoryId
              });
            if (insertError) throw insertError;
          }
        } catch (mappingError) {
          console.error('[NFCE] ERRO MAPEAMENTO', mappingError);
        }
      }

      setSelectedSubcategoryId(UNSELECTED_VALUE);
      setFormaPagamento("cartao");
      setTipoPagamento("avista");
      setCartaoId(UNSELECTED_VALUE);
      setValor(undefined);
      setDescricao("");
      setDataVencimento(new Date());
      setNumeroParcelas(1);
      setIsPaid(false);
      setValidationErrors({});
      queryClient.invalidateQueries({ queryKey: ["expenses", user?.id] });
      queryClient.invalidateQueries({
        queryKey: ["expenseInstallments", user?.id],
      });
      queryClient.invalidateQueries({ queryKey: ["allExpenseInstallments"] });
      
      setLoading(false);
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      showErrorToast("Erro", error.message || "Erro ao adicionar despesa");
      console.error("Supabase error adding expense:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      id="expense-form"
      onSubmit={handleSubmit}
      className={cn(isMobile ? "space-y-3 w-full" : "space-y-6 w-full")}
    >
      {/* Toggle Avulsa / Recorrente */}
      {/* Toggle Avulsa / Recorrente */}
      {!isMobile && (
        <div className="pt-2">
          <TransactionTypeToggle
            isRecurring={isRecurring}
            onSelectAvulsa={handleSelectAvulsa}
            onSelectRecorrente={handleSelectRecorrente}
            isMobile={isMobile}
          />
        </div>
      )}

      <div>
        <Label htmlFor="subcategoria" className={cn("text-[#64748B] font-[600] mb-1.5 inline-block", isMobile ? "text-[13px]" : "text-[15px]")}>
          Subcategoria
        </Label>
        <div className="flex gap-2">
          <Popover open={isSubcategoryOpen} onOpenChange={(open) => {
            setIsSubcategoryOpen(open);
            if (open) setSearchQuery("");
          }}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={isSubcategoryOpen}
                className={cn(
                  "flex-1 min-w-0 justify-between font-medium transition-all duration-200 input-3d-premium rounded-xl text-left border-slate-200 border",
                  isMobile ? "!h-[39px] text-sm px-3" : "h-10 px-3",
                  getBorderClass({
                    isInvalid: validationErrors.selectedSubcategoryId,
                    isValid: validationErrors.selectedSubcategoryId === false,
                  }),
                  selectedSubcategoryId === UNSELECTED_VALUE ? "text-slate-500 font-normal" : "text-gray-800"
                )}
                style={{ fontWeight: selectedSubcategoryId === UNSELECTED_VALUE ? "normal" : 500 }}
              >
                {selectedSubcategoryId !== UNSELECTED_VALUE
                  ? (() => {
                      const sel = expenseSubcategories.find((cat) => cat.id === selectedSubcategoryId);
                      return sel ? (
                        <span className="flex items-center gap-2 truncate min-w-0">
                          <span className="shrink-0"><DynamicIcon name={sel.icone} className="w-4 h-4" /></span>
                          <span className="truncate">{sel.nome}</span>
                        </span>
                      ) : (
                        <span className="truncate">Selecione a subcategoria</span>
                      );
                    })()
                  : <span className="truncate">Selecione a subcategoria</span>}
                <ChevronDown className="h-4 w-4 shrink-0 opacity-50 ml-2" />
              </Button>
            </PopoverTrigger>
            <PopoverContent 
               className="p-0 rounded-2xl shadow-xl w-[--radix-popover-trigger-width] bg-white border border-slate-100 !backdrop-blur-none" 
               align="start"
            >
              <div className="flex flex-col max-h-[320px]">
                <div className="flex items-center border-b border-slate-100 px-3 shrink-0">
                   <span className="text-sm mr-2 opacity-70">🔎</span>
                   <input 
                     className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-slate-400 disabled:cursor-not-allowed disabled:opacity-50" 
                     placeholder="Buscar subcategoria..." 
                     value={searchQuery}
                     onChange={(e) => setSearchQuery(e.target.value)}
                   />
                </div>
                <div className="overflow-y-auto p-1.5 scroll-smooth no-scrollbar">
                  {filteredSubcategories.length === 0 ? (
                    <div className="py-6 text-center text-sm text-slate-500">
                      Nenhuma subcategoria encontrada.
                    </div>
                  ) : (
                    filteredSubcategories.map((cat) => {
                      const isMeta = metaCategoryIds.includes(cat.id);
                      return (
                        <div
                          key={cat.id}
                          className={cn(
                            "relative flex w-full select-none items-center rounded-xl px-2.5 py-1 text-sm outline-none cursor-pointer transition-colors mb-0.5 last:mb-0",
                            isMeta ? "bg-[#FFF6ED] hover:bg-[#FFEAD5] border border-[#FFEDD5]/50" : "hover:bg-slate-100/80 active:bg-slate-200/60"
                          )}
                          onClick={() => {
                            setSelectedSubcategoryId(cat.id);
                            setValidationErrors((prev) => ({
                              ...prev,
                              selectedSubcategoryId: false,
                            }));
                            setIsSubcategoryOpen(false);
                          }}
                        >
                          <span className="flex items-center gap-2.5 w-full">
                            <span className="shrink-0"><DynamicIcon name={cat.icone} className="w-5 h-5" /></span>
                            <span className="text-slate-700 font-medium truncate">{cat.nome}</span>
                            {isMeta && <Target className="h-4 w-4 text-orange-500 ml-auto shrink-0 opacity-80" strokeWidth={2.5} />}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </PopoverContent>
          </Popover>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() => setIsAddSubcategoryModalOpen(true)}
            className={cn(
              "btn-3d p-0 flex items-center justify-center rounded-xl shadow-none border-none transition-all active:scale-90 flex-shrink-0 !opacity-100 bg-transparent",
              isMobile ? "!h-[39px] w-[34px] text-sm" : "h-10 w-9 text-base"
            )}
            style={{ "--cor-topo": "#F87171", "--cor-base": "#EF4444", boxShadow: "0 2px 6px rgba(239,68,68,.12), inset 0 1px 0 rgba(255,255,255,.35)", opacity: 1 } as any}
          >
            <Plus className="h-[18px] w-[18px] !text-white" strokeWidth={3.5} style={{ color: "#ffffff" }} />
          </Button>
        </div>
      </div>

      <AddSubcategoryModal
        isOpen={isAddSubcategoryModalOpen}
        onOpenChange={setIsAddSubcategoryModalOpen}
        onAddCategory={(cat) => addCategoryMutation.mutate(cat)}
        allCategories={allSubcategories}
        excludeCategoryIds={["receitas_e_investimentos"]}
      />


      <PaymentDetails
        valor={valor}
        setValor={setValor}
        formaPagamento={formaPagamento}
        setFormaPagamento={setFormaPagamento}
        cartaoId={cartaoId}
        setCartaoId={setCartaoId}
        cartoes={cartoes}
        loadCartoes={loadCartoes}
        user={user}
        validationErrors={validationErrors}
        setValidationErrors={setValidationErrors}
        isMobile={isMobile}
        UNSELECTED_VALUE={UNSELECTED_VALUE}
        tipoPagamento={tipoPagamento}
        setTipoPagamento={setTipoPagamento}
        numeroParcelas={numeroParcelas}
        setNumeroParcelas={setNumeroParcelas}
        isRecurring={isRecurring}
        setIsRecurring={setIsRecurring}
        isPaid={isPaid}
        setIsPaid={setIsPaid}
      />

      {
        tipoPagamento === "parcelado" && numeroParcelas > 1 && !isRecurring && (
          <InstallmentPreview
            valor={valor}
            numeroParcelas={numeroParcelas}
            dataVencimento={dataVencimento}
            isMobile={isMobile}
          />
        )
      }

      <DateAndInstallmentFields
        dataVencimento={dataVencimento}
        setDataVencimento={setDataVencimento}
        isCalendarOpen={isCalendarOpen}
        setIsCalendarOpen={setIsCalendarOpen}
        validationErrors={validationErrors}
        setValidationErrors={setValidationErrors}
        isMobile={isMobile}
        tipoPagamento={tipoPagamento}
      />

      {createPortal && <></>} {/* Dummy usage to ensure import is used if tree-shaking is aggressive? No need. */}

      <div>
        <Label htmlFor="descricao" className={cn("text-[#64748B] font-[600] mb-0.5 inline-block", isMobile ? "text-[13px]" : "text-[15px]")}>
          Descrição
        </Label>
        <Textarea
          id="descricao"
          value={descricao}
          onChange={(e) => {
            let val = e.target.value;
            if (val.length > 0) {
              val = val.charAt(0).toUpperCase() + val.slice(1);
            }
            setDescricao(val);
          }}
          placeholder="Detalhes sobre a despesa..."
          rows={2}
          maxLength={45}
          className={cn(
            "input-3d-premium resize-none py-1.5 px-3", isMobile ? "min-h-[61px] h-[61px]" : "min-h-[51px] h-[51px]",
            "text-gray-800 font-medium transition-all duration-200",
            isMobile ? "text-sm" : "",
            getBorderClass({ isValid: false })
          )}
        />
      </div>

      {
        !isMobile && !isRecurring && tipoPagamento === "avista" && (
          <div className="mt-2">
            {" "}
            <TransactionStatusToggle
              isPaid={isPaid}
              setIsPaid={setIsPaid}
              isMobile={isMobile}
            />
          </div>
        )
      }


      {/* Submit Button Logic */}
      <div>
        <Button
          type={isExpired ? "button" : "submit"}
          form={isExpired ? undefined : "expense-form"}
          onClick={isExpired ? handleBlockedClick : undefined}
          className={cn(
            "w-full rounded-xl btn-3d font-extrabold tracking-[0.5px] text-white border-none transition-all active:scale-95 shadow-[0_2px_4px_rgba(0,0,0,0.05)] text-lg flex items-center justify-center gap-2",
            isMobile ? "h-11 text-lg" : "h-12 text-lg",
            isExpired && "opacity-80"
          )}
          style={{ "--cor-topo": "#EE5D5D", "--cor-base": "#E54D4D", fontFamily: "'Inter', sans-serif", boxShadow: "0 6px 16px rgba(239,68,68,.18), inset 0 1px 0 rgba(255,255,255,.25)" } as any}
          disabled={!isExpired && loading}
        >
          <Save className="h-5 w-5" strokeWidth={2.5} />
          {loading && !isExpired ? "Salvando..." : "Salvar Despesa"}
          {isExpired && <span className="ml-1.5 text-base">🔒</span>}
        </Button>
      </div>
    </form >
  );
};
