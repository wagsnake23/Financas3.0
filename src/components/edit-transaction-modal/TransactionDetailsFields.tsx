import React, { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { cn, getBorderClass, formatInTimeZone, TARGET_TIMEZONE, isValidUuid } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import DynamicIcon from "@/components/DynamicIcon";
import { AppCategory, TransactionType } from "@/types/finance";
import { Database, Tables } from "@/integrations/supabase/types";
import CurrencyBR from "@/components/ui/currency-br";
import { StatusToggleButton } from "@/components/StatusToggleButton";
import { AddCardDialog } from "@/components/AddCardDialog";
import { ManageCardsDialog } from "@/components/ManageCardsDialog";
import { User } from "@supabase/supabase-js";

type ReceitaStatus = Database['public']['Enums']['receita_status'];

interface TransactionDetailsFieldsProps {
  amount: number | undefined;
  setAmount: (amount: number | undefined) => void;
  date: Date | undefined;
  setDate: (date: Date | undefined) => void;
  category: string;
  setCategory: (category: string) => void;
  description: string;
  setDescription: (description: string) => void;
  isCalendarOpen: boolean;
  setIsCalendarOpen: (open: boolean) => void;
  filteredCategories: AppCategory[];
  isMobile: boolean;
  transactionType: TransactionType;
  UNSELECTED_VALUE: string;
  isPaid: boolean;
  setIsPaid: (paid: boolean) => void;
  installmentNumber?: number;
  totalInstallments?: number;
  validationErrors: Record<string, boolean>;
  setValidationErrors: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  paidAtTimestamp: string | null;
  formaPagamento: "dinheiro" | "pix" | "cartao";
  setFormaPagamento: (value: "dinheiro" | "pix" | "cartao") => void;
  cartaoId: string;
  setCartaoId: (value: string) => void;
  cartoes: Tables<'cartoes'>[];
  refetchCartoes: () => void;
  tipoPagamento?: "avista" | "parcelado" | "fixo";
}

export const TransactionDetailsFields: React.FC<TransactionDetailsFieldsProps> = ({
  amount,
  setAmount,
  date,
  setDate,
  category,
  setCategory,
  description,
  setDescription,
  isCalendarOpen,
  setIsCalendarOpen,
  filteredCategories,
  isMobile,
  transactionType,
  UNSELECTED_VALUE,
  isPaid,
  setIsPaid,
  installmentNumber,
  totalInstallments,
  validationErrors,
  setValidationErrors,
  paidAtTimestamp,
  formaPagamento,
  setFormaPagamento,
  cartaoId,
  setCartaoId,
  cartoes,
  refetchCartoes,
  tipoPagamento,
}) => {
  const getBorderColor = (errorKey: string) => {
    return validationErrors[errorKey] ? "!border-destructive !border-[1px]" : "!border-slate-300/70 !border-[1px]";
  };

  const isExpenseInstallment = (transactionType === "expense" && totalInstallments && totalInstallments > 1);
  const isRecurringIncome = (transactionType === "income" && totalInstallments && totalInstallments > 1);
  const showInstallmentField = isExpenseInstallment || isRecurringIncome;
  const dummyUser: User = { id: "dummy-user-id", email: "dummy@example.com", app_metadata: {}, user_metadata: {}, aud: "", created_at: "" };

  const paymentOptions = useMemo(() => {
    const baseOptions = [
      { value: UNSELECTED_VALUE, label: "Selecione a forma de pagamento", disabled: true },
      { value: "dinheiro", label: "💰 Dinheiro" },
      { value: "pix", label: "📲 Pix" },
    ];

    if (isMobile) {
      // On mobile, integrate credit cards directly
      const cardOptions = cartoes.map(card => ({
        value: card.id, // Use card ID as value
        label: `💳 Cartão: ${card.nome} ${card.ultimos_digitos}`
      }));
      return [...baseOptions, { value: "cartao", label: "💳 Cartão" }, ...cardOptions]; // Adicionado "Cartão" como opção genérica para mobile
    } else {
      // On desktop, keep "Cartão" as a separate option
      return [...baseOptions, { value: "cartao", label: "💳 Cartão" }];
    }
  }, [cartoes, isMobile, UNSELECTED_VALUE]);

  const handleFormaPagamentoChange = (value: string) => {
    if (isMobile) {
      if (isValidUuid(value)) { // If a card ID is selected
        setFormaPagamento("cartao");
        setCartaoId(value);
      } else { // If a non-card option is selected
        setFormaPagamento(value as "dinheiro" | "pix");
        setCartaoId(UNSELECTED_VALUE);
      }
    } else {
      setFormaPagamento(value as "dinheiro" | "pix" | "cartao");
      if (value !== "cartao") {
        setCartaoId(UNSELECTED_VALUE);
      }
    }
    setValidationErrors(prev => ({ ...prev, formaPagamento: false }));
    setValidationErrors(prev => ({ ...prev, cartaoId: false })); // Clear cartaoId error too
  };

  // Determine the value for the Select component
  const selectValue = useMemo(() => {
    if (isMobile && formaPagamento === "cartao") {
      return cartaoId;
    }
    return formaPagamento;
  }, [isMobile, formaPagamento, cartaoId]);

  return (
    <div className={cn("space-y-3", isMobile && "w-full space-y-1.5")}>
      {/* Subcategoria */}
      <div className={cn(isMobile && "space-y-1")}>
        <Label htmlFor="category" className={cn("text-gray-800 font-medium mb-0.5 inline-block", isMobile && "text-xs")}>Subcategoria</Label>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className={cn("rounded-xl font-medium transition-all duration-200 bg-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] text-gray-800", isMobile ? "h-9 text-sm" : "h-10", getBorderColor("category"), getBorderClass({ isInvalid: validationErrors.category, isValid: validationErrors.category === false }))}>
            <SelectValue placeholder="Selecione a subcategoria" />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value={UNSELECTED_VALUE} disabled className={cn(isMobile && "text-sm")}>Selecione a subcategoria</SelectItem>
            {filteredCategories.length === 0 ? (
              <SelectItem value={UNSELECTED_VALUE} disabled className={cn(isMobile && "text-sm")}>Nenhuma subcategoria disponível</SelectItem>
            ) : (
              filteredCategories
                .map((cat) => (
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
      </div>

      {/* Valor e Parcela (lado a lado) */}
      <div className={cn("grid gap-4", isMobile ? "grid-cols-2 gap-2" : "grid-cols-2")}>
        {/* Valor */}
        <div className={cn(isMobile && "space-y-1")}>
          <Label htmlFor="amount" className={cn("text-gray-800 font-medium mb-0.5 inline-block", isMobile && "text-xs")}>Valor (R$)</Label>
          <CurrencyBR
            value={amount}
            onChange={(v) => {
              setAmount(v);
              setValidationErrors(prev => ({ ...prev, amount: false }));
            }}
            className={cn("rounded-xl font-medium transition-all duration-200 bg-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] text-gray-800", isMobile ? "h-9 text-sm" : "h-10", getBorderColor("amount"), getBorderClass({ isInvalid: validationErrors.amount, isValid: validationErrors.amount === false }))}
          />
        </div>

        {/* Parcela (condicional) */}
        {showInstallmentField && (
          <div className={cn(isMobile && "space-y-1")}>
            <Label className={cn("text-gray-800 font-medium mb-0.5 inline-block", isMobile && "text-xs")}>{tipoPagamento === 'fixo' ? "Recorrência" : "Parcela"}</Label>
            <Input
              value={tipoPagamento === 'fixo' ? "Recorrente" : `${String(installmentNumber || 0).padStart(2, '0')} de ${String(totalInstallments || 0).padStart(2, '0')}`}
              readOnly
              disabled
              className={cn("rounded-xl font-medium transition-all duration-200 bg-white shadow-[inset_0_2px_4px_rgba(59,130,246,0.15)] !text-blue-500 !border-blue-300/50 !border-[1px] !bg-transparent", isMobile && "h-9 text-sm")}
            />
          </div>
        )}
      </div>

      {/* Forma de Pagamento */}
      {transactionType === "expense" && (
        <div className={cn(isMobile && "space-y-1")}>
          <Label className={cn("text-gray-800 font-medium mb-0.5 inline-block", isMobile && "text-xs")}>Forma de Pagamento</Label>
          <Select
            value={selectValue}
            onValueChange={handleFormaPagamentoChange}
          >
            <SelectTrigger className={cn("rounded-xl font-medium transition-all duration-200 bg-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] text-gray-800", isMobile ? "h-9 text-sm" : "h-10", getBorderColor("formaPagamento"), getBorderClass({ isInvalid: validationErrors.formaPagamento, isValid: validationErrors.formaPagamento === false }))}>
              <SelectValue placeholder="Selecione a forma de pagamento" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              {paymentOptions.map((option) => (
                <SelectItem
                  key={option.value}
                  value={option.value}
                  disabled={option.disabled}
                  className={cn(isMobile && "text-sm")}
                >
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Seleção de Cartão de Crédito (condicional - APENAS DESKTOP) */}
      {transactionType === "expense" && formaPagamento === "cartao" && !isMobile && (
        <div className={cn(isMobile && "space-y-1")}>
          <Label className={cn("text-gray-800 font-medium mb-0.5 inline-block", isMobile && "text-xs")}>Cartão de Crédito</Label>
          <div className="flex gap-2">
            <Select
              value={cartaoId}
              onValueChange={(value: string) => {
                setCartaoId(value);
                setValidationErrors(prev => ({ ...prev, cartaoId: false }));
              }}
            >
              <SelectTrigger className={cn("rounded-xl font-medium transition-all duration-200 bg-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] text-gray-800", isMobile ? "h-9 text-sm" : "h-10", getBorderColor("cartaoId"), getBorderClass({ isInvalid: validationErrors.cartaoId, isValid: validationErrors.cartaoId === false }))}>
                <SelectValue placeholder="Selecione o cartão" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value={UNSELECTED_VALUE} disabled className={cn(isMobile && "text-sm")}>Selecione o cartão</SelectItem>
                {cartoes.map((card) => (
                  <SelectItem key={card.id} value={card.id} className={cn(isMobile && "text-sm")}>
                    Cartão: {card.nome} {card.ultimos_digitos}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <AddCardDialog user={dummyUser} onCardAdded={refetchCartoes} />
            <ManageCardsDialog cards={cartoes} onCardUpdated={refetchCartoes} onCardDeleted={refetchCartoes} />
          </div>
        </div>
      )}

      {/* Data (abaixo de Valor e Parcela) */}
      <div className={cn("relative", isMobile && "space-y-1")}>
        <Label htmlFor="date" className={cn("text-gray-800 font-medium mb-0.5 inline-block", isMobile && "text-xs")}>Data</Label>

        <div className="relative w-full">
          <Button
            type="button"
            variant={"outline"}
            onClick={() => setIsCalendarOpen(!isCalendarOpen)}
            className={cn(
              "w-full justify-start text-left font-medium rounded-xl transition-all duration-200 bg-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] text-gray-800",
              !date && "text-muted-foreground",
              isMobile ? "h-9 text-sm" : "h-10",
              getBorderColor("date"),
              getBorderClass({ isInvalid: validationErrors.date, isValid: validationErrors.date === false })
            )}
          >
            <DynamicIcon name="📅" className={cn("mr-2 h-4 w-4 text-primary", isMobile && "h-3.5 w-3.5")} /> {/* Ícone de emoji colorido */}
            {date ? format(date, "PPP", { locale: ptBR }) : <span>Selecione uma data</span>}
          </Button>

          {isCalendarOpen && (
            <div
              className={cn(
                "absolute top-full left-0 z-[100] mt-1 w-full min-w-full max-w-full overflow-hidden",
                "rounded-[24px] border border-blue-100/50 bg-white shadow-[0_15px_45px_rgba(0,0,0,0.15)] animate-in fade-in zoom-in-95 duration-200",
                isMobile ? "h-[340px]" : "h-[460px]"
              )}
            >
              <Calendar
                mode="single"
                selected={date}
                onSelect={(selectedDate) => {
                  setDate(selectedDate);
                  setIsCalendarOpen(false);
                }}
                initialFocus
                locale={ptBR}
                showOutsideDays={true}
                className="w-full h-full p-2"
              />
            </div>
          )}
        </div>
      </div>

      {/* Campo de Descrição re-adicionado e verificado para editabilidade e exibição */}
      <div className={cn(isMobile && "space-y-1")}>
        <Label htmlFor="description" className={cn("text-gray-800 font-medium mb-0.5 inline-block", isMobile && "text-xs")}>Descrição</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Adicione uma descrição..."
          rows={2}
          maxLength={45}
          className={cn(
            "rounded-xl font-medium transition-all duration-200 bg-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] text-gray-800 resize-none min-h-[56px] h-[56px] py-1.5 px-3",
            isMobile && "text-sm",
            getBorderColor("description")
          )}
          disabled={false} // Garantindo que não esteja desabilitado
        />
      </div>

    </div>
  );
};