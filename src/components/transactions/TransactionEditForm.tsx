import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { toast } from "sonner";
import DynamicIcon from "@/components/DynamicIcon";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { User } from "@supabase/supabase-js";
import { AppCategory, TransactionInstallment } from "@/types/finance";
import { format, addMonths, getDate } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Check } from "lucide-react";
import {
  cn,
  getBorderClass,
  formatInTimeZone,
  TARGET_TIMEZONE,
} from "@/lib/utils";
import CurrencyBR from "@/components/ui/currency-br";
import { Command, CommandInput, CommandList, CommandGroup, CommandItem } from "@/components/ui/command";

import { PaymentDetails } from "../expense-form/PaymentDetails";
import { DateAndInstallmentFields } from "../expense-form/DateAndInstallmentFields";
import { TransactionStatusToggle } from "../expense-form/TransactionStatusToggle";
import { InstallmentPreview } from "../expense-form/InstallmentPreview";
import { TransactionTypeToggle } from "../expense-form/TransactionTypeToggle";

interface Cartao {
  id: string;
  nome: string;
  banco: string;
  ultimos_digitos: string;
  dia_fechamento: number;
  dia_vencimento: number;
}

interface TransactionEditFormProps {
  user: User | null;
  transaction: TransactionInstallment;
  cartoes: Cartao[];
  loadCartoes: () => void;
  allSubcategories: AppCategory[];
  queryClient: ReturnType<typeof useQueryClient>;
  isMobile: boolean;
  onClose: () => void;
}

const UNSELECTED_VALUE = "unselected";
const RECURRING_INSTALLMENTS_COUNT = 120;
const toastDuration = 1000;
const toastSuccessStyle = { backgroundColor: "#F3FFF3", color: "#006000" };
const toastErrorStyle = { backgroundColor: "#F3FFF3", color: "#FF2929" };

export const TransactionEditForm: React.FC<TransactionEditFormProps> = ({
  user,
  transaction,
  cartoes,
  loadCartoes,
  allSubcategories,
  queryClient,
  isMobile,
  onClose,
}) => {
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string>(
    transaction.categoria_id || UNSELECTED_VALUE
  );
  const [formaPagamento, setFormaPagamento] = useState<
    "dinheiro" | "pix" | "cartao" | "boleto"
  >(transaction.forma_pagamento || "dinheiro");
  const [tipoPagamento, setTipoPagamento] = useState<
    "avista" | "parcelado" | "fixo"
  >(transaction.tipo_pagamento || "avista");
  const [cartaoId, setCartaoId] = useState(transaction.cartao_id || UNSELECTED_VALUE);
  const [valor, setValor] = useState<number | undefined>(
    transaction.valor_parcela
  );
  const [descricao, setDescricao] = useState(transaction.descricao || "");
  const [dataVencimento, setDataVencimento] = useState<Date | undefined>(
    transaction.vencimento ? new Date(transaction.vencimento) : new Date()
  );
  const [numeroParcelas, setNumeroParcelas] = useState(
    transaction.numero_parcelas || 1
  );
  const [loading, setLoading] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isPaid, setIsPaid] = useState(transaction.pago || false);
  const [isRecurring, setIsRecurring] = useState(
    transaction.is_recurring_master || false
  );

  const [validationErrors, setValidationErrors] = useState<
    Record<string, boolean>
  >({});

  // NOVO: Estados para o Command Menu
  const [openCommand, setOpenCommand] = useState(false);
  const [commandSearch, setCommandSearch] = useState("");

  const expenseSubcategories = React.useMemo(() => {
    const filtered = allSubcategories.filter(
      (cat) => cat.parent_id !== "receitas_e_investimentos" &&
               cat.nome.toLowerCase().includes(commandSearch.toLowerCase())
    );
    return filtered.sort((a, b) => a.nome.localeCompare(b.nome));
  }, [allSubcategories, commandSearch]);

  const incomeSubcategories = React.useMemo(() => {
    const filtered = allSubcategories.filter(
      (cat) => cat.parent_id === "receitas_e_investimentos" &&
               cat.nome.toLowerCase().includes(commandSearch.toLowerCase())
    );
    return filtered.sort((a, b) => a.nome.localeCompare(b.nome));
  }, [allSubcategories, commandSearch]);

  const currentSubcategories =
    transaction.tipo_transacao === "expense"
      ? expenseSubcategories
      : incomeSubcategories;

  // Encontrar a subcategoria selecionada para exibição
  const selectedCategory = React.useMemo(() => {
    return currentSubcategories.find(
      (cat) => cat.id === selectedSubcategoryId
    );
  }, [selectedSubcategoryId, currentSubcategories]);

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

  useEffect(() => {
    if (typeof setIsRecurring === "function") {
      if (tipoPagamento === "fixo") {
        setIsRecurring(true);
      } else {
        setIsRecurring(false);
      }
    } else {
      console.error(
        "TransactionEditForm: setIsRecurring não é uma função no novo useEffect de tipoPagamento.",
        setIsRecurring
      );
    }
  }, [tipoPagamento, setIsRecurring]);

  useEffect(() => {
    if (isRecurring) {
      setNumeroParcelas(RECURRING_INSTALLMENTS_COUNT);
      setIsPaid(false);
    } else {
      if (tipoPagamento === "avista") {
        setNumeroParcelas(1);
        setIsPaid(true);
      } else if (tipoPagamento === "parcelado") {
        if (numeroParcelas === RECURRING_INSTALLMENTS_COUNT) {
          setNumeroParcelas(1);
        }
        setIsPaid(false);
      }
    }
  }, [
    isRecurring,
    tipoPagamento,
    setNumeroParcelas,
    setIsPaid,
    numeroParcelas,
  ]);

  useEffect(() => {
    if (isRecurring) return;

    if (tipoPagamento === "parcelado") {
      setFormaPagamento("cartao");
    }
  }, [tipoPagamento, isRecurring, setFormaPagamento]);

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
      toast.error("Preencha todos os campos obrigatórios", {
        duration: toastDuration,
        style: toastErrorStyle,
      });
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
      // Update master transaction (despesas or receitas)
      const masterTable =
        transaction.tipo_transacao === "expense" ? "despesas" : "receitas";
      const { error: masterError } = await supabase
        .from(masterTable)
        .update({
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
        .eq("id", transaction.master_id);

      if (masterError) throw masterError;

      // Update the specific installment
      const installmentTable =
        transaction.tipo_transacao === "expense"
          ? "despesas_parcelas"
          : "receitas_parcelas";

      const { error: installmentError } = await supabase
        .from(installmentTable)
        .update({
          valor_parcela: valorTotal,
          vencimento: formatInTimeZone(
            dataVencimento as Date,
            TARGET_TIMEZONE,
            "yyyy-MM-dd"
          ),
          pago: isPaid,
          data_pagamento: isPaid
            ? formatInTimeZone(
                new Date(),
                TARGET_TIMEZONE,
                "yyyy-MM-dd HH:mm:ss"
              )
            : null,
        })
        .eq("id", transaction.id);

      if (installmentError) throw installmentError;

      toast.success("Lançamento atualizado com sucesso!", {
        style: toastSuccessStyle,
        duration: toastDuration,
      });

      queryClient.invalidateQueries({ queryKey: ["expenses", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["incomes", user?.id] });
      queryClient.invalidateQueries({
        queryKey: ["expenseInstallments", user?.id],
      });
      queryClient.invalidateQueries({
        queryKey: ["incomeInstallments", user?.id],
      });
      onClose();
    } catch (error: any) {
      toast.error("Erro ao atualizar lançamento", {
        description: error.message,
        duration: toastDuration,
        style: toastErrorStyle,
      });
      console.error("Supabase error updating transaction:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(isMobile ? "space-y-3 w-full" : "space-y-4 w-full")}
    >
      {/* Toggle Avulsa / Recorrente */}
      <div className={cn(isMobile && "mt-0")}>
        <TransactionTypeToggle
          isRecurring={isRecurring}
          onSelectAvulsa={handleSelectAvulsa}
          onSelectRecorrente={handleSelectRecorrente}
          isMobile={isMobile}
        />
      </div>

      {/* Subcategoria com Command Menu */}
      <div>
        <Label htmlFor="subcategoria" className={cn(isMobile && "text-xs")}>
          Subcategoria
        </Label>
        <Popover open={openCommand} onOpenChange={setOpenCommand}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={openCommand}
              className={cn(
                "w-full justify-between rounded-xl",
                isMobile && "h-9 text-sm",
                getBorderClass({
                  isInvalid: validationErrors.selectedSubcategoryId,
                  isValid: validationErrors.selectedSubcategoryId === false,
                })
              )}
            >
              {selectedCategory ? (
                <span className="flex items-center gap-2">
                  <span>{selectedCategory.icone}</span>
                  <span>{selectedCategory.nome}</span>
                </span>
              ) : (
                "Selecione a subcategoria..."
              )}
              {/* Removido o ícone ChevronDown explícito aqui */}
            </Button>
          </PopoverTrigger>
          <PopoverContent className={cn("w-full p-0", isMobile && "w-[95vw]")}>
            <Command>
              <CommandInput
                placeholder="Buscar subcategoria..."
                value={commandSearch}
                onValueChange={setCommandSearch}
              />
              <CommandList>
                <CommandGroup>
                  {currentSubcategories.length === 0 ? (
                    <CommandItem disabled>Nenhuma subcategoria encontrada.</CommandItem>
                  ) : (
                    currentSubcategories.map((cat) => (
                      <CommandItem
                        key={cat.id}
                        value={cat.nome}
                        onSelect={() => {
                          setSelectedSubcategoryId(cat.id);
                          setOpenCommand(false);
                          setCommandSearch("");
                          setValidationErrors((prev) => ({
                            ...prev,
                            selectedSubcategoryId: false,
                          }));
                        }}
                        className={cn(isMobile && "text-sm")}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            selectedSubcategoryId === cat.id
                              ? "opacity-100"
                              : "opacity-0"
                          )}
                        />
                        <span className="flex items-center gap-2">
                          <span>{cat.icone}</span>
                          <span>{cat.nome}</span>
                        </span>
                      </CommandItem>
                    ))
                  )}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

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

      {tipoPagamento === "parcelado" && numeroParcelas > 1 && !isRecurring && (
        <InstallmentPreview
          valor={valor}
          numeroParcelas={numeroParcelas}
          dataVencimento={dataVencimento}
          isMobile={isMobile}
        />
      )}

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

      <div>
        <Label htmlFor="descricao" className={cn(isMobile && "text-xs")}>
          Descrição
        </Label>
        <Textarea
          id="descricao"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="Detalhes sobre a despesa..."
          rows={isMobile ? 2 : 3}
          className={cn("rounded-xl", isMobile && "text-sm")}
        />
      </div>

      {!isRecurring && tipoPagamento === "avista" && (
        <div className={cn(isMobile && "mt-2")}>
          <TransactionStatusToggle
            isPaid={isPaid}
            setIsPaid={setIsPaid}
            isMobile={isMobile}
          />
        </div>
      )}

      <Button
        type="submit"
        className={cn("w-full rounded-xl", isMobile && "h-9 text-sm")}
        disabled={loading}
      >
        {loading ? "Salvando..." : "Salvar Lançamento"}
      </Button>
    </form>
  );
};