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
import { Plus } from "lucide-react";
import { AddSubcategoryModal } from "./AddSubcategoryModal";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import CurrencyBR from "@/components/ui/currency-br";
import { Command, CommandInput, CommandList, CommandGroup, CommandItem } from "@/components/ui/command";

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
  initialFormaPagamento?: "dinheiro" | "pix" | "cartao" | "boleto";
  initialCartaoId?: string;
  initialDescricao?: string;
  submitPortalRef?: HTMLDivElement | null;
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
  submitPortalRef,
}) => {
  const { showSuccessToast, showErrorToast } = useToast();
  const [selectedSubcategoryId, setSelectedSubcategoryId] =
    useState<string>(UNSELECTED_VALUE);
  const [formaPagamento, setFormaPagamento] = useState<
    "dinheiro" | "pix" | "cartao" | "boleto"
  >("dinheiro");
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

  const expenseSubcategories = React.useMemo(() => {
    return allSubcategories
      .filter((cat) => cat.parent_id !== null && cat.parent_id !== "receitas_e_investimentos")
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [allSubcategories]);

  // Efeito para aplicar os dados iniciais da NFC-e
  useEffect(() => {
    if (initialValor !== undefined) setValor(initialValor);
    if (initialFormaPagamento !== undefined) setFormaPagamento(initialFormaPagamento);
    if (initialCartaoId !== undefined) setCartaoId(initialCartaoId);
    if (initialDescricao !== undefined) setDescricao(initialDescricao);
  }, [initialValor, initialFormaPagamento, initialCartaoId, initialDescricao]);


  useEffect(() => {
    if (isRecurring) {
      setIsPaid(false);
    } else if (tipoPagamento === "parcelado") {
      setIsPaid(false);
    } else if (formaPagamento === "cartao") {
      setIsPaid(false);
    } else {
      setIsPaid(true);
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
      setIsPaid(false); // Recurring expenses are initially pending
    } else {
      // If "Avulsa" is selected (tipoPagamento === "avista" or "parcelado")
      if (tipoPagamento === "avista") {
        setNumeroParcelas(1); // Avista always has 1 installment
        setIsPaid(true); // Avista is usually paid immediately
      } else if (tipoPagamento === "parcelado") {
        // When switching to "parcelado" from "fixo, reset to 1.
        // Otherwise, if it was "avista" (numeroParcelas was 1) or user input, keep it.
        if (numeroParcelas === RECURRING_INSTALLMENTS_COUNT) {
          setNumeroParcelas(1);
        }
        setIsPaid(false); // Parcelado is initially pending
      }
    }
  }, [
    isRecurring,
    tipoPagamento,
    setNumeroParcelas,
    setIsPaid,
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

      showSuccessToast("Sucesso", "Despesa adicionada com sucesso!");

      setSelectedSubcategoryId(UNSELECTED_VALUE);
      setFormaPagamento("dinheiro");
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
      className={cn(isMobile ? "space-y-3 w-full" : "space-y-4 w-full")}
    >
      {/* Toggle Avulsa / Recorrente */}
      {/* Toggle Avulsa / Recorrente */}
      {!isMobile && (
        <div className={cn(isMobile && "mt-0")}>
          {" "}
          <TransactionTypeToggle
            isRecurring={isRecurring}
            onSelectAvulsa={handleSelectAvulsa}
            onSelectRecorrente={handleSelectRecorrente}
            isMobile={isMobile}
          />
        </div>
      )}

      <div>
        <Label htmlFor="subcategoria" className={cn("text-gray-500 font-medium mb-1.5 inline-block", isMobile && "text-xs")}>
          Subcategoria
        </Label>
        <div className="flex gap-2">
          <Select
            value={selectedSubcategoryId}
            onValueChange={(value) => {
              setSelectedSubcategoryId(value);
              setValidationErrors((prev) => ({
                ...prev,
                selectedSubcategoryId: false,
              }));
            }}
          >
            <SelectTrigger
              className={cn(
                "flex-1 rounded-xl bg-white border-[#FFE5E5] text-gray-800 font-medium transition-all duration-200",
                isMobile && "h-9 text-sm",
                getBorderClass({
                  isInvalid: validationErrors.selectedSubcategoryId,
                  isValid: validationErrors.selectedSubcategoryId === false,
                })
              )}
            >
              <SelectValue placeholder="Selecione a subcategoria" />
            </SelectTrigger>
            <SelectContent className="max-h-[280px]">
              <SelectItem value={UNSELECTED_VALUE} disabled className={cn(isMobile && "text-sm")}>
                Selecione a subcategoria
              </SelectItem>
              {expenseSubcategories.length === 0 ? (
                <SelectItem value={UNSELECTED_VALUE} disabled className={cn(isMobile && "text-sm")}>
                  Nenhuma subcategoria encontrada
                </SelectItem>
              ) : (
                expenseSubcategories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id} className={cn(isMobile && "text-sm")}>
                    <span className="flex items-center gap-2">
                      <span>{cat.icone}</span>
                      <span>{cat.nome}</span>
                    </span>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          <Button
            type="button"
            size="icon"
            onClick={() => setIsAddSubcategoryModalOpen(true)}
            className={cn(
              "btn-3d w-8 h-9 p-0 flex items-center justify-center rounded-xl shadow-sm border border-red-200 transition-all active:scale-90 flex-shrink-0",
              isMobile && "w-8 h-9"
            )}
            style={{ "--cor-topo": "#FF6B6B", "--cor-base": "#E54D4D" } as any}
          >
            <Plus className="h-[18px] w-[18px] text-white" />
          </Button>
        </div>
      </div>

      <AddSubcategoryModal
        isOpen={isAddSubcategoryModalOpen}
        onOpenChange={setIsAddSubcategoryModalOpen}
        onAddCategory={(cat) => addCategoryMutation.mutate(cat)}
        allCategories={allSubcategories} // Passing all categories (including parent ones)
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
        <Label htmlFor="descricao" className={cn("text-gray-500 font-medium mb-1.5 inline-block", isMobile && "text-xs")}>
          Descrição
        </Label>
        <Textarea
          id="descricao"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="Detalhes sobre a despesa..."
          rows={isMobile ? 1 : 3}
          maxLength={50}
          className={cn(
            "rounded-xl bg-white border-[#FFE5E5] text-gray-800 font-medium placeholder:text-gray-400 transition-all duration-200 resize-none",
            isMobile && "text-sm p-4",
            getBorderClass({})
          )}
        />
      </div>

      {
        !isRecurring && tipoPagamento === "avista" && (
          <div className={cn(isMobile && "mt-2")}>
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
      {(() => {
        const SubmitButton = (
          <Button
            type="submit"
            form="expense-form"
            className={cn(
              "w-full rounded-xl btn-3d font-bold text-white border-none transition-all active:scale-95",
              isMobile ? "h-11 text-base !shadow-none" : "h-11 text-base shadow-md"
            )}
            style={{ "--cor-topo": "#FF6B6B", "--cor-base": "#E54D4D" } as any}
            disabled={loading}
          >
            {loading ? "Salvando..." : "Salvar Despesa"}
          </Button>
        );

        return isMobile && submitPortalRef
          ? createPortal(SubmitButton, submitPortalRef)
          : SubmitButton;
      })()}
    </form >
  );
};