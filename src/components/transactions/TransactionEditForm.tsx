import React, { useState, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { AppCategory } from "@/types/finance";
import { Command, CommandInput, CommandList, CommandGroup, CommandItem } from "@/components/ui/command"; // Novos imports

interface TransactionEditFormProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: any;
  userId: string;
  allSubcategories: AppCategory[];
  cartoes: any[];
  isMobile: boolean;
}

const UNSELECTED_VALUE = "unselected";
const RECURRING_INSTALLMENTS_COUNT = 120;
const toastDuration = 1000;
const toastSuccessStyle = { backgroundColor: "#F3FFF3", color: "#006000" };
const toastErrorStyle = { backgroundColor: "#F3FFF3", color: "#FF2929" };

export const TransactionEditForm: React.FC<TransactionEditFormProps> = ({
  isOpen,
  onClose,
  transaction,
  userId,
  allSubcategories,
  cartoes,
  isMobile,
}) => {
  const queryClient = useQueryClient();

  const [valor, setValor] = useState<number | undefined>(undefined);
  const [descricao, setDescricao] = useState("");
  const [dataVencimento, setDataVencimento] = useState<Date | undefined>(
    new Date()
  );
  const [selectedSubcategoryId, setSelectedSubcategoryId] =
    useState<string>(UNSELECTED_VALUE);
  const [formaPagamento, setFormaPagamento] = useState<
    "dinheiro" | "pix" | "cartao" | "boleto"
  >("dinheiro");
  const [cartaoId, setCartaoId] = useState(UNSELECTED_VALUE);
  const [isPaid, setIsPaid] = useState(false);
  const [tipoPagamento, setTipoPagamento] = useState<
    "avista" | "parcelado" | "fixo"
  >("avista");
  const [numeroParcelas, setNumeroParcelas] = useState(1);
  const [isRecurring, setIsRecurring] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [validationErrors, setValidationErrors] = useState<
    Record<string, boolean>
  >({});

  // NOVO: Estados para o Command Menu de Subcategoria
  const [openCommand, setOpenCommand] = useState(false);
  const [commandSearch, setCommandSearch] = useState("");

  const expenseSubcategories = React.useMemo(() => {
    const filtered = allSubcategories.filter(
      (cat) => cat.parent_id !== "receitas_e_investimentos" &&
               cat.nome.toLowerCase().includes(commandSearch.toLowerCase())
    );
    return filtered.sort((a, b) => a.nome.localeCompare(b.nome));
  }, [allSubcategories, commandSearch]);

  const revenueSubcategories = React.useMemo(() => {
    const filtered = allSubcategories.filter(
      (cat) => cat.parent_id === "receitas_e_investimentos" &&
               cat.nome.toLowerCase().includes(commandSearch.toLowerCase())
    );
    return filtered.sort((a, b) => a.nome.localeCompare(b.nome));
  }, [allSubcategories, commandSearch]);

  const currentSubcategories =
    transaction?.type === "expense" ? expenseSubcategories : revenueSubcategories;

  const selectedCategory = React.useMemo(() => {
    return currentSubcategories.find(
      (cat) => cat.id === selectedSubcategoryId
    );
  }, [selectedSubcategoryId, currentSubcategories]);

  useEffect(() => {
    if (transaction) {
      setValor(transaction.valor_parcela || transaction.valor_total);
      setDescricao(transaction.descricao || "");
      setDataVencimento(
        transaction.vencimento ? new Date(transaction.vencimento) : new Date()
      );
      setSelectedSubcategoryId(transaction.categoria_id || UNSELECTED_VALUE);
      setFormaPagamento(transaction.forma_pagamento || "dinheiro");
      setCartaoId(transaction.cartao_id || UNSELECTED_VALUE);
      setIsPaid(transaction.pago || false);
      setTipoPagamento(transaction.tipo_pagamento || "avista");
      setNumeroParcelas(transaction.numero_parcelas || 1);
      setIsRecurring(transaction.is_recurring_master || false);
      setValidationErrors({});
      setCommandSearch(""); // Reset search when transaction changes
    }
  }, [transaction]);

  const handleSave = async () => {
    setLoading(true);
    const newErrors: Record<string, boolean> = {};
    let hasError = false;

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

    try {
      const formattedVencimento = formatInTimeZone(
        dataVencimento as Date,
        TARGET_TIMEZONE,
        "yyyy-MM-dd"
      );
      const formattedDataPagamento = isPaid
        ? formatInTimeZone(new Date(), TARGET_TIMEZONE, "yyyy-MM-dd HH:mm:ss")
        : null;

      if (transaction.type === "expense") {
        // Update master expense if it's a recurring master
        if (transaction.is_recurring_master) {
          const { error: masterError } = await supabase
            .from("despesas")
            .update({
              categoria_id: selectedSubcategoryId,
              forma_pagamento: formaPagamento,
              cartao_id: formaPagamento === "cartao" ? cartaoId : null,
              descricao: descricao,
              tipo_pagamento: tipoPagamento,
              valor_total: valor, // Update master's total value for recurring
            })
            .eq("id", transaction.despesa_id)
            .eq("user_id", userId);

          if (masterError) throw masterError;

          // Update the specific installment
          const { error: installmentError } = await supabase
            .from("despesas_parcelas")
            .update({
              valor_parcela: valor,
              vencimento: formattedVencimento,
              pago: isPaid,
              data_pagamento: formattedDataPagamento,
            })
            .eq("id", transaction.id)
            .eq("despesa_id", transaction.despesa_id);

          if (installmentError) throw installmentError;
        } else {
          // Update master expense for non-recurring
          const { error: masterError } = await supabase
            .from("despesas")
            .update({
              categoria_id: selectedSubcategoryId,
              forma_pagamento: formaPagamento,
              cartao_id: formaPagamento === "cartao" ? cartaoId : null,
              descricao: descricao,
              tipo_pagamento: tipoPagamento,
              valor_total: valor, // Update master's total value for non-recurring
              numero_parcelas: numeroParcelas,
            })
            .eq("id", transaction.despesa_id)
            .eq("user_id", userId);

          if (masterError) throw masterError;

          // Update the specific installment
          const { error: installmentError } = await supabase
            .from("despesas_parcelas")
            .update({
              valor_parcela: valor,
              vencimento: formattedVencimento,
              pago: isPaid,
              data_pagamento: formattedDataPagamento,
            })
            .eq("id", transaction.id)
            .eq("despesa_id", transaction.despesa_id);

          if (installmentError) throw installmentError;
        }
      } else if (transaction.type === "revenue") {
        // Update master revenue if it's a recurring master
        if (transaction.is_recurring_master) {
          const { error: masterError } = await supabase
            .from("receitas")
            .update({
              categoria_id: selectedSubcategoryId,
              forma_pagamento: formaPagamento,
              descricao: descricao,
              tipo_pagamento: tipoPagamento,
              valor_total: valor, // Update master's total value for recurring
            })
            .eq("id", transaction.receita_id)
            .eq("user_id", userId);

          if (masterError) throw masterError;

          // Update the specific installment
          const { error: installmentError } = await supabase
            .from("receitas_parcelas")
            .update({
              valor_parcela: valor,
              vencimento: formattedVencimento,
              pago: isPaid,
              data_pagamento: formattedDataPagamento,
            })
            .eq("id", transaction.id)
            .eq("receita_id", transaction.receita_id);

          if (installmentError) throw installmentError;
        } else {
          // Update master revenue for non-recurring
          const { error: masterError } = await supabase
            .from("receitas")
            .update({
              categoria_id: selectedSubcategoryId,
              forma_pagamento: formaPagamento,
              descricao: descricao,
              tipo_pagamento: tipoPagamento,
              valor_total: valor, // Update master's total value for non-recurring
              numero_parcelas: numeroParcelas,
            })
            .eq("id", transaction.receita_id)
            .eq("user_id", userId);

          if (masterError) throw masterError;

          // Update the specific installment
          const { error: installmentError } = await supabase
            .from("receitas_parcelas")
            .update({
              valor_parcela: valor,
              vencimento: formattedVencimento,
              pago: isPaid,
              data_pagamento: formattedDataPagamento,
            })
            .eq("id", transaction.id)
            .eq("receita_id", transaction.receita_id);

          if (installmentError) throw installmentError;
        }
      }

      toast.success("Lançamento atualizado com sucesso!", {
        style: toastSuccessStyle,
        duration: toastDuration,
      });
      queryClient.invalidateQueries({ queryKey: ["transactions", userId] });
      queryClient.invalidateQueries({ queryKey: ["expenses", userId] });
      queryClient.invalidateQueries({ queryKey: ["revenues", userId] });
      queryClient.invalidateQueries({
        queryKey: ["expenseInstallments", userId],
      });
      queryClient.invalidateQueries({
        queryKey: ["revenueInstallments", userId],
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

  const handleDelete = async () => {
    if (!transaction || !transaction.id) {
      toast.error("Transação inválida para exclusão.", {
        duration: toastDuration,
        style: toastErrorStyle,
      });
      return;
    }

    setLoading(true);
    try {
      if (transaction.type === "expense") {
        // If it's a recurring master, delete all associated installments and the master itself
        if (transaction.is_recurring_master) {
          const { error: installmentsError } = await supabase
            .from("despesas_parcelas")
            .delete()
            .eq("despesa_id", transaction.despesa_id);
          if (installmentsError) throw installmentsError;

          const { error: masterError } = await supabase
            .from("despesas")
            .delete()
            .eq("id", transaction.despesa_id);
          if (masterError) throw masterError;
        } else {
          // If it's a single installment or a non-recurring master, delete only the installment
          const { error } = await supabase
            .from("despesas_parcelas")
            .delete()
            .eq("id", transaction.id);
          if (error) throw error;

          // Check if there are other installments for this master. If not, delete the master.
          const { data: remainingInstallments, error: checkError } =
            await supabase
              .from("despesas_parcelas")
              .select("id")
              .eq("despesa_id", transaction.despesa_id);

          if (checkError) throw checkError;

          if (!remainingInstallments || remainingInstallments.length === 0) {
            const { error: masterDeleteError } = await supabase
              .from("despesas")
              .delete()
              .eq("id", transaction.despesa_id);
            if (masterDeleteError) throw masterDeleteError;
          }
        }
      } else if (transaction.type === "revenue") {
        // If it's a recurring master, delete all associated installments and the master itself
        if (transaction.is_recurring_master) {
          const { error: installmentsError } = await supabase
            .from("receitas_parcelas")
            .delete()
            .eq("receita_id", transaction.receita_id);
          if (installmentsError) throw installmentsError;

          const { error: masterError } = await supabase
            .from("receitas")
            .delete()
            .eq("id", transaction.receita_id);
          if (masterError) throw masterError;
        } else {
          // If it's a single installment or a non-recurring master, delete only the installment
          const { error } = await supabase
            .from("receitas_parcelas")
            .delete()
            .eq("id", transaction.id);
          if (error) throw error;

          // Check if there are other installments for this master. If not, delete the master.
          const { data: remainingInstallments, error: checkError } =
            await supabase
              .from("receitas_parcelas")
              .select("id")
              .eq("receita_id", transaction.receita_id);

          if (checkError) throw checkError;

          if (!remainingInstallments || remainingInstallments.length === 0) {
            const { error: masterDeleteError } = await supabase
              .from("receitas")
              .delete()
              .eq("id", transaction.receita_id);
            if (masterDeleteError) throw masterDeleteError;
          }
        }
      }

      toast.success("Lançamento excluído com sucesso!", {
        style: toastSuccessStyle,
        duration: toastDuration,
      });
      queryClient.invalidateQueries({ queryKey: ["transactions", userId] });
      queryClient.invalidateQueries({ queryKey: ["expenses", userId] });
      queryClient.invalidateQueries({ queryKey: ["revenues", userId] });
      queryClient.invalidateQueries({
        queryKey: ["expenseInstallments", userId],
      });
      queryClient.invalidateQueries({
        queryKey: ["revenueInstallments", userId],
      });
      onClose();
    } catch (error: any) {
      toast.error("Erro ao excluir lançamento", {
        description: error.message,
        duration: toastDuration,
        style: toastErrorStyle,
      });
      console.error("Supabase error deleting transaction:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className={cn(
          "sm:max-w-[425px] rounded-2xl",
          isMobile && "mobile-fullscreen-modal"
        )}
      >
        <DialogHeader className={cn(isMobile && "dialog-title-mobile")}>
          <DialogTitle className="text-center text-xl font-semibold text-gray-800">
            Editar Lançamento
          </DialogTitle>
        </DialogHeader>
        <div className={cn("grid gap-4 py-4", isMobile && "form-body")}>
          {/* Tipo de Transação (Despesa/Receita) */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label
              htmlFor="type"
              className={cn("text-right", isMobile && "text-xs col-span-1")}
            >
              Tipo
            </Label>
            <div className={cn("col-span-3", isMobile && "col-span-3")}>
              <Input
                id="type"
                value={transaction?.type === "expense" ? "Despesa" : "Receita"}
                readOnly
                className={cn(
                  "col-span-3 rounded-xl",
                  isMobile && "h-9 text-sm"
                )}
              />
            </div>
          </div>

          {/* Valor */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label
              htmlFor="valor"
              className={cn("text-right", isMobile && "text-xs col-span-1")}
            >
              Valor
            </Label>
            <div className={cn("col-span-3", isMobile && "col-span-3")}>
              <CurrencyBR
                value={valor}
                onValueChange={(value) => {
                  setValor(value);
                  setValidationErrors((prev) => ({ ...prev, valor: false }));
                }}
                placeholder="0,00"
                className={cn(
                  "rounded-xl",
                  isMobile && "h-9 text-sm",
                  getBorderClass({
                    isInvalid: validationErrors.valor,
                    isValid: validationErrors.valor === false,
                  })
                )}
              />
            </div>
          </div>

          {/* Subcategoria com Command Menu */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label
              htmlFor="subcategoria"
              className={cn("text-right", isMobile && "text-xs col-span-1")}
            >
              Subcategoria
            </Label>
            <div className={cn("col-span-3", isMobile && "col-span-3")}>
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
          </div>

          {/* Descrição */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label
              htmlFor="descricao"
              className={cn("text-right", isMobile && "text-xs col-span-1")}
            >
              Descrição
            </Label>
            <div className={cn("col-span-3", isMobile && "col-span-3")}>
              <Textarea
                id="descricao"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Detalhes sobre o lançamento..."
                rows={isMobile ? 2 : 3}
                className={cn("rounded-xl", isMobile && "text-sm")}
              />
            </div>
          </div>

          {/* Data de Vencimento */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label
              htmlFor="dataVencimento"
              className={cn("text-right", isMobile && "text-xs col-span-1")}
            >
              Vencimento
            </Label>
            <div className={cn("col-span-3", isMobile && "col-span-3")}>
              <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal rounded-xl",
                      !dataVencimento && "text-muted-foreground",
                      isMobile && "h-9 text-sm",
                      getBorderClass({
                        isInvalid: validationErrors.dataVencimento,
                        isValid: validationErrors.dataVencimento === false,
                      })
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dataVencimento ? (
                      format(dataVencimento, "PPP", { locale: ptBR })
                    ) : (
                      <span>Selecione uma data</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dataVencimento}
                    onSelect={(date) => {
                      setDataVencimento(date);
                      setIsCalendarOpen(false);
                      setValidationErrors((prev) => ({
                        ...prev,
                        dataVencimento: false,
                      }));
                    }}
                    initialFocus
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Forma de Pagamento */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label
              htmlFor="formaPagamento"
              className={cn("text-right", isMobile && "text-xs col-span-1")}
            >
              Pagamento
            </Label>
            <div className={cn("col-span-3", isMobile && "col-span-3")}>
              <Select
                value={formaPagamento}
                onValueChange={(value: "dinheiro" | "pix" | "cartao" | "boleto") => {
                  setFormaPagamento(value);
                  setValidationErrors((prev) => ({
                    ...prev,
                    formaPagamento: false,
                  }));
                }}
              >
                <SelectTrigger
                  className={cn(
                    "rounded-xl",
                    isMobile && "h-9 text-sm",
                    getBorderClass({
                      isInvalid: validationErrors.formaPagamento,
                      isValid: validationErrors.formaPagamento === false,
                    })
                  )}
                >
                  <SelectValue placeholder="Selecione a forma de pagamento" />
                </SelectTrigger>
                <SelectContent className={cn(isMobile && "text-sm")}>
                  <SelectItem value="dinheiro">Dinheiro</SelectItem>
                  <SelectItem value="pix">Pix</SelectItem>
                  <SelectItem value="cartao">Cartão</SelectItem>
                  <SelectItem value="boleto">Boleto</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Cartão (se formaPagamento for 'cartao') */}
          {formaPagamento === "cartao" && (
            <div className="grid grid-cols-4 items-center gap-4">
              <Label
                htmlFor="cartao"
                className={cn("text-right", isMobile && "text-xs col-span-1")}
              >
                Cartão
              </Label>
              <div className={cn("col-span-3", isMobile && "col-span-3")}>
                <Select
                  value={cartaoId}
                  onValueChange={(value) => {
                    setCartaoId(value);
                    setValidationErrors((prev) => ({
                      ...prev,
                      cartaoId: false,
                    }));
                  }}
                >
                  <SelectTrigger
                    className={cn(
                      "rounded-xl",
                      isMobile && "h-9 text-sm",
                      getBorderClass({
                        isInvalid: validationErrors.cartaoId,
                        isValid: validationErrors.cartaoId === false,
                      })
                    )}
                  >
                    <SelectValue placeholder="Selecione o cartão" />
                  </SelectTrigger>
                  <SelectContent className={cn(isMobile && "text-sm")}>
                    {cartoes.map((cartao) => (
                      <SelectItem key={cartao.id} value={cartao.id}>
                        {cartao.nome} ({cartao.ultimos_digitos})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Status de Pagamento (se não for recorrente) */}
          {!isRecurring && (
            <div className="grid grid-cols-4 items-center gap-4">
              <Label
                htmlFor="isPaid"
                className={cn("text-right", isMobile && "text-xs col-span-1")}
              >
                Status
              </Label>
              <div className={cn("col-span-3", isMobile && "col-span-3")}>
                <RadioGroup
                  value={isPaid ? "pago" : "pendente"}
                  onValueChange={(value) => setIsPaid(value === "pago")}
                  className={cn(
                    "flex space-x-4 radio-fix-click",
                    isMobile && "text-sm"
                  )}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="pago" id="r1" />
                    <Label htmlFor="r1">Pago</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="pendente" id="r2" />
                    <Label htmlFor="r2">Pendente</Label>
                  </div>
                </RadioGroup>
              </div>
            </div>
          )}
        </div>
        <DialogFooter
          className={cn(
            "flex justify-between sm:justify-between",
            isMobile && "flex-col-reverse gap-2"
          )}
        >
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={loading}
            className={cn("rounded-xl", isMobile && "h-9 text-sm")}
          >
            {loading ? "Excluindo..." : "Excluir"}
          </Button>
          <Button
            type="submit"
            onClick={handleSave}
            disabled={loading}
            className={cn("rounded-xl", isMobile && "h-9 text-sm")}
          >
            {loading ? "Salvando..." : "Salvar Alterações"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};