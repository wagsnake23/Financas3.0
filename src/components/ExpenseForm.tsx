import React, { useState, useEffect } from "react";
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
import { toast } from "sonner";
import DynamicIcon from "@/components/DynamicIcon";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { User } from "@supabase/supabase-js";
import { AppCategory } from "@/types/finance";
import { format, addMonths, getDate } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Check, Search, ChevronsUpDown } from "lucide-react";
import {
  cn,
  getBorderClass,
  formatInTimeZone,
  TARGET_TIMEZONE,
} from "@/lib/utils";
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
}

const UNSELECTED_VALUE = "unselected";
const RECURRING_INSTALLMENTS_COUNT = 120;
const toastDuration = 1000;
const toastSuccessStyle = { backgroundColor: "#F3FFF3", color: "#006000" };
const toastErrorStyle = { backgroundColor: "#F3FFF3", color: "#FF2929" };

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
}) => {
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

  const [validationErrors, setValidationErrors] = useState<
    Record<string, boolean>
  >({});

  // NOVO: Estados para o Command Menu
  const [openCommand, setOpenCommand] = useState(false);
  const [commandSearch, setCommandSearch] = useState("");

  const expenseSubcategories = React.useMemo(() => {
    // Filtrar as subcategorias com base no termo de busca
    const filtered = allSubcategories.filter(
      (cat) => cat.parent_id !== "receitas_e_investimentos" &&
               cat.nome.toLowerCase().includes(commandSearch.toLowerCase())
    );
    // Ordenar por nome
    return filtered.sort((a, b) => a.nome.localeCompare(b.nome));
  }, [allSubcategories, commandSearch]);

  // Encontrar a subcategoria selecionada para exibição
  const selectedCategory = React.useMemo(() => {
    return expenseSubcategories.find(
      (cat) => cat.id === selectedSubcategoryId
    );
  }, [selectedSubcategoryId, expenseSubcategories]);

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

      toast.success("Despesa adicionada com sucesso!", {
        style: toastSuccessStyle,
        duration: toastDuration,
      });

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
    } catch (error: any) {
      toast.error("Erro ao adicionar despesa", {
        description: error.message,
        duration: toastDuration,
        style: toastErrorStyle,
      });
      console.error("Supabase error adding expense:", error);
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
        {" "}
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
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Search className="h-4 w-4 shrink-0 opacity-50" />
                  <span>Buscar subcategoria...</span>
                </span>
              )}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent 
            side="bottom"
            className={cn("p-0", "w-[var(--radix-popover-trigger-width)]")}
          >
            <Command>
              <CommandInput
                placeholder="Buscar subcategoria..."
                value={commandSearch}
                onValueChange={setCommandSearch}
              />
              <CommandList className="max-h-[5rem] overflow-y-auto"> {/* Altura máxima ajustada aqui */}
                <CommandGroup>
                  {expenseSubcategories.length === 0 ? (
                    <CommandItem disabled>Nenhuma subcategoria encontrada.</CommandItem>
                  ) : (
                    expenseSubcategories.map((cat) => (
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
          {" "}
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
        {loading ? "Salvando..." : "Salvar Despesa"}
      </Button>
    </form>
  );
};