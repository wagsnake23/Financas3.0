import React, { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DatePickerModal } from "@/components/ui/DatePickerModal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogClose } from "@/components/ui/dialog";
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
  isRecurringTransaction?: boolean;
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
  isRecurringTransaction,
}) => {
  const getBorderColor = (errorKey: string) => {
    return validationErrors[errorKey] ? "!border-destructive !border-[1px]" : "!border-slate-300/70 !border-[1px]";
  };

  const isExpenseInstallment = (transactionType === "expense" && totalInstallments && totalInstallments > 1);
  const showInstallmentField = isExpenseInstallment || (transactionType === "expense" && tipoPagamento === "fixo");
  const dummyUser: User = { id: "dummy-user-id", email: "dummy@example.com", app_metadata: {}, user_metadata: {}, aud: "", created_at: "" };

  const paymentOptions = useMemo(() => {
    const baseOptions = [
      { value: UNSELECTED_VALUE, label: "Selecione a forma de pagamento", disabled: true },
      { value: "dinheiro", label: "💰 Dinheiro" },
      { value: "pix", label: "🪙 Pix" },
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
      <div className={cn("pb-[4px]", isMobile && "space-y-1 !pb-[7px]")}>
        <Label htmlFor="category" className={cn("text-[#64748B] font-semibold", isMobile ? "text-xs -mb-[2px] block" : "mb-0.5 inline-block")}>Subcategoria</Label>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className={cn("input-3d-premium input-white modal-edit-input !text-[#263449] !h-[40px] box-border", getBorderColor("category"), getBorderClass({ isInvalid: validationErrors.category, isValid: validationErrors.category === false }))}>
            <SelectValue placeholder="Selecione a subcategoria" />
          </SelectTrigger>
          <SelectContent className="rounded-2xl border-none shadow-xl">
            <SelectItem value={UNSELECTED_VALUE} disabled className={cn(isMobile && "text-sm")}>Selecione a subcategoria</SelectItem>
            {filteredCategories.length === 0 ? (
              <SelectItem value={UNSELECTED_VALUE} disabled className={cn(isMobile && "text-sm")}>Nenhuma subcategoria disponível</SelectItem>
            ) : (
              filteredCategories
                .map((cat) => (
                  <SelectItem key={cat.id} value={cat.id} className={cn(isMobile && "text-sm")}>
                    <span className="flex items-center gap-2">
                      <span className="shrink-0"><DynamicIcon name={cat.icone} className="w-5 h-5" /></span>
                      <span>{cat.nome}</span>
                    </span>
                  </SelectItem>
                ))
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Valor e Parcela (lado a lado) */}
      <div className={cn("grid gap-4 pb-[4px]", isMobile ? "grid-cols-2 gap-2 !pb-[7px]" : "grid-cols-2")}>
        {/* Valor */}
        <div className={cn(isMobile && "space-y-1")}>
          <Label htmlFor="amount" className={cn("text-[#64748B] font-semibold", isMobile ? "text-xs -mb-[2px] block" : "mb-0.5 inline-block")}>Valor (R$)</Label>
          <CurrencyBR
            value={amount}
            onChange={(v) => {
              setAmount(v);
              setValidationErrors(prev => ({ ...prev, amount: false }));
            }}
            className={cn("input-3d-premium input-white modal-edit-input !text-[#263449] !h-[40px] box-border", getBorderColor("amount"), getBorderClass({ isInvalid: validationErrors.amount, isValid: validationErrors.amount === false }))}
          />
        </div>

        {/* Campo Informativo para Despesas (Sempre visível) */}
        {transactionType === "expense" && (
          <div className={cn(isMobile && "space-y-1")}>
            <Label className={cn("text-[#64748B] font-semibold", isMobile ? "text-xs -mb-[2px] block" : "mb-0.5 inline-block")}>
              {showInstallmentField ? (tipoPagamento === 'fixo' ? "Recorrência" : "Parcela") : "Tipo"}
            </Label>
            <Input
              value={showInstallmentField ? (tipoPagamento === 'fixo' ? "Recorrente" : `${String(installmentNumber || 0).padStart(2, '0')} de ${String(totalInstallments || 0).padStart(2, '0')}`) : "À vista"}
              readOnly
              disabled
              className={cn("input-3d-premium modal-info-input !h-[40px] box-border")}
            />
          </div>
        )}

        {/* Tipo (para Receitas) */}
        {transactionType === "income" && (
          <div className={cn(isMobile && "space-y-1")}>
            <Label className={cn("text-[#64748B] font-semibold", isMobile ? "text-xs -mb-[2px] block" : "mb-0.5 inline-block")}>Tipo</Label>
            <Input
              value={isRecurringTransaction ? "Recorrente" : "Avulsa"}
              readOnly
              disabled
              className={cn("input-3d-premium modal-info-input !h-[40px] box-border")}
            />
          </div>
        )}
      </div>

      {/* Forma de Pagamento */}
      {transactionType === "expense" && (
        <div className={cn("pb-[4px]", isMobile && "space-y-1 !pb-[7px]")}>
          <Label className={cn("text-[#64748B] font-semibold", isMobile ? "text-xs -mb-[2px] block" : "mb-0.5 inline-block")}>Forma de Pagamento</Label>
          <Select
            value={selectValue}
            onValueChange={handleFormaPagamentoChange}
          >
            <SelectTrigger className={cn("input-3d-premium input-white modal-edit-input !text-[#263449] !h-[40px] box-border", getBorderColor("formaPagamento"), getBorderClass({ isInvalid: validationErrors.formaPagamento, isValid: validationErrors.formaPagamento === false }))}>
              <SelectValue placeholder="Selecione a forma de pagamento" />
            </SelectTrigger>
            <SelectContent className="rounded-2xl border-none shadow-xl">
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
        <div className={cn("pb-[4px]", isMobile && "space-y-1 !pb-[7px]")}>
          <Label className={cn("text-[#64748B] font-semibold mb-0.5 inline-block", isMobile && "text-xs")}>Cartão de Crédito</Label>
          <div className="flex gap-2">
            <Select
              value={cartaoId}
              onValueChange={(value: string) => {
                setCartaoId(value);
                setValidationErrors(prev => ({ ...prev, cartaoId: false }));
              }}
            >
              <SelectTrigger className={cn("input-3d-premium modal-edit-input !text-[#263449] !h-[40px] box-border", getBorderColor("cartaoId"), getBorderClass({ isInvalid: validationErrors.cartaoId, isValid: validationErrors.cartaoId === false }))}>
                <SelectValue placeholder="Selecione o cartão" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl border-none shadow-xl">
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
      <div className={cn("relative pb-[4px]", isMobile && "space-y-1 !pb-[7px]")}>
        <Label htmlFor="date" className={cn("text-[#64748B] font-semibold", isMobile ? "text-xs -mb-[2px] block" : "mb-0.5 inline-block")}>Data</Label>

        <div className="relative w-full">
          <Button
            type="button"
            variant={"outline"}
            onClick={() => setIsCalendarOpen(!isCalendarOpen)}
            className={cn(
              "w-full justify-start pl-3 text-left font-normal input-3d-premium input-white modal-edit-input !text-[#263449] !h-[40px] box-border",
              !date && "text-muted-foreground",
              getBorderColor("date"),
              getBorderClass({ isInvalid: validationErrors.date, isValid: validationErrors.date === false })
            )}
          >
            <DynamicIcon name="📅" className={cn("mr-2 h-4 w-4 text-primary", isMobile && "h-3.5 w-3.5")} /> {/* Ícone de emoji colorido */}
            {date ? format(date, "PPP", { locale: ptBR }) : <span>Selecione uma data</span>}
          </Button>

      <DatePickerModal 
        isOpen={isCalendarOpen}
        setIsOpen={setIsCalendarOpen}
        date={date}
        onSelect={setDate}
      />
        </div>
      </div>

      {/* Campo de Descrição re-adicionado e verificado para editabilidade e exibição */}
      <div className={cn(isMobile && "space-y-1")}>
        <Label htmlFor="description" className={cn("text-[#64748B] font-semibold", isMobile ? "text-xs -mb-[2px] block" : "mb-0.5 inline-block")}>Descrição</Label>
        <div className="relative w-full">
          <Textarea
            id="description"
            value={description}
            onChange={(e) => {
              let val = e.target.value;
              if (val.length > 100) val = val.slice(0, 100);
              if (val.length > 0) {
                val = val.charAt(0).toUpperCase() + val.slice(1);
              }
              setDescription(val);
            }}
            onPaste={(e) => {
              const text = e.clipboardData.getData('text');
              if (description.length + text.length > 100) {
                e.preventDefault();
                const remaining = 100 - description.length;
                const newText = text.slice(0, remaining);
                setDescription(description + newText);
              }
            }}
            placeholder="Adicione uma descrição..."
            rows={2}
            maxLength={100}
            className={cn(
              "resize-y input-3d-premium input-white modal-edit-input !text-[#263449] !pb-6",
              getBorderColor("description")
            )}
            disabled={false}
          />
          <div className="absolute bottom-1.5 right-2 text-[11px] font-medium text-[#64748B] pointer-events-none">
            {description.length}/100
          </div>
        </div>
      </div>

    </div>
  );
};
