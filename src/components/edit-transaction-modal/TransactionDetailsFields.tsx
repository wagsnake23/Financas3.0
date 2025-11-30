import React, { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
  formaPagamento: "dinheiro" | "pix" | "cartao" | "boleto";
  setFormaPagamento: (value: "dinheiro" | "pix" | "cartao" | "boleto") => void;
  cartaoId: string;
  setCartaoId: (value: string) => void;
  cartoes: Tables<'cartoes'>[];
  refetchCartoes: () => void;
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
}) => {
  const isExpenseInstallment = transactionType === "expense" && totalInstallments && totalInstallments > 1;
  const dummyUser: User = { id: "dummy-user-id", email: "dummy@example.com", app_metadata: {}, user_metadata: {}, aud: "", created_at: "" };

  const paymentOptions = useMemo(() => {
    const baseOptions = [
      { value: UNSELECTED_VALUE, label: "Selecione a forma de pagamento", disabled: true },
      { value: "dinheiro", label: "💰 Dinheiro" },
      { value: "pix", label: "📲 Pix" },
      { value: "boleto", label: "📑 Boleto" },
    ];

    if (isMobile) {
      // On mobile, integrate credit cards directly
      const cardOptions = cartoes.map(card => ({
        value: card.id, // Use card ID as value
        label: `💳 Cartão: ${card.nome} (****${card.ultimos_digitos})`
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
        setFormaPagamento(value as "dinheiro" | "pix" | "boleto");
        setCartaoId(UNSELECTED_VALUE);
      }
    } else {
      setFormaPagamento(value as "dinheiro" | "pix" | "cartao" | "boleto");
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
    <div className={cn("space-y-4", isMobile && "w-full space-y-2")}>
      {/* Subcategoria */}
      <div className={cn("space-y-2", isMobile && "space-y-1")}>
        <Label htmlFor="category" className={cn(isMobile && "text-xs")}>Subcategoria</Label>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className={cn("rounded-xl", isMobile && "h-9 text-sm", getBorderClass({ isInvalid: validationErrors.category, isValid: validationErrors.category === false }))}>
            <SelectValue placeholder="Selecione a subcategoria" />
          </SelectTrigger>
          <SelectContent>
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
        <div className={cn("space-y-2", isMobile && "space-y-1")}>
          <Label htmlFor="amount" className={cn(isMobile && "text-xs")}>Valor (R$)</Label>
          <CurrencyBR
            value={amount}
            onChange={(v) => {
              setAmount(v);
              setValidationErrors(prev => ({ ...prev, amount: false }));
            }}
            className={cn("rounded-xl", isMobile && "h-9 text-sm", getBorderClass({ isInvalid: validationErrors.amount, isValid: validationErrors.amount === false }))}
          />
        </div>

        {/* Parcela (condicional) */}
        {isExpenseInstallment && (
          <div className={cn("space-y-2", isMobile && "space-y-1")}>
            <Label className={cn(isMobile && "text-xs")}>Parcela</Label>
            <Input
              value={`${installmentNumber || 0} de ${totalInstallments || 0}`}
              readOnly
              disabled
              className={cn("rounded-xl bg-muted/50 text-muted-foreground", isMobile && "h-9 text-sm")}
            />
          </div>
        )}
      </div>

      {/* Forma de Pagamento */}
      {transactionType === "expense" && (
        <div className={cn("space-y-2", isMobile && "space-y-1")}>
          <Label className={cn(isMobile && "text-xs")}>Forma de Pagamento</Label>
          <Select 
            value={selectValue} 
            onValueChange={handleFormaPagamentoChange}
          >
            <SelectTrigger className={cn("rounded-xl", isMobile && "h-9 text-sm", getBorderClass({ isInvalid: validationErrors.formaPagamento, isValid: validationErrors.formaPagamento === false }))}>
              <SelectValue placeholder="Selecione a forma de pagamento" />
            </SelectTrigger>
          <SelectContent>
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
        <div className={cn("space-y-2", isMobile && "space-y-1")}>
          <Label className={cn(isMobile && "text-xs")}>Cartão de Crédito</Label>
          <div className="flex gap-2">
            <Select 
              value={cartaoId} 
              onValueChange={(value: string) => {
                setCartaoId(value);
                setValidationErrors(prev => ({ ...prev, cartaoId: false }));
              }}
            >
              <SelectTrigger className={cn("rounded-xl", isMobile && "h-9 text-sm", getBorderClass({ isInvalid: validationErrors.cartaoId, isValid: validationErrors.cartaoId === false }))}>
                <SelectValue placeholder="Selecione o cartão" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNSELECTED_VALUE} disabled className={cn(isMobile && "text-sm")}>Selecione o cartão</SelectItem>
                {cartoes.map((card) => (
                  <SelectItem key={card.id} value={card.id} className={cn(isMobile && "text-sm")}>
                    {card.nome} - {card.banco} (****{card.ultimos_digitos})
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
      <div className={cn("space-y-2", isMobile && "space-y-1")}>
        <Label htmlFor="date" className={cn(isMobile && "text-xs")}>Data</Label>
        <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
          <PopoverTrigger asChild>
            <Button
              variant={"outline"}
              className={cn(
                "w-full justify-start text-left font-normal h-10 rounded-xl",
                !date && "text-muted-foreground",
                isMobile && "h-9 text-sm",
                getBorderClass({ isInvalid: validationErrors.date, isValid: validationErrors.date === false })
              )}
            >
              <DynamicIcon name="📅" className={cn("mr-2 h-4 w-4 text-primary", isMobile && "h-3.5 w-3.5")} /> {/* Ícone de emoji colorido */}
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
              }}
              initialFocus
              locale={ptBR}
              showOutsideDays={false}
              className={cn(isMobile && "text-sm")}
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Campo de Descrição re-adicionado e verificado para editabilidade e exibição */}
      <div className={cn("space-y-2", isMobile && "space-y-1")}>
        <Label htmlFor="description" className={cn(isMobile && "text-xs")}>Descrição</Label>
        <Textarea
          id="description"
          value={description} 
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Adicione uma descrição..."
          rows={3}
          className={cn("rounded-xl", isMobile && "text-sm")}
          disabled={false} // Garantindo que não esteja desabilitado
        />
      </div>

      <div className={cn("flex flex-col items-start space-y-2", isMobile && "space-y-1")}>
        <Label className={cn(isMobile && "text-xs")}>Status</Label>
        <div className="flex items-center gap-2 w-full"> {/* Container para o toggle e o timestamp */}
          <StatusToggleButton
            currentStatus={isPaid ? "Recebida" : "Pendente"}
            transactionType={transactionType}
            onToggle={() => setIsPaid(!isPaid)}
            isMobile={isMobile}
          />
          {paidAtTimestamp && (
            <div className="flex-1">
              <Label htmlFor="paidAt" className={cn(isMobile && "text-xs", "sr-only")}>Data/Hora Pagamento</Label>
              <Input
                id="paidAt"
                type="text"
                value={paidAtTimestamp 
                    ? formatInTimeZone(
                        paidAtTimestamp, // Simplificado para passar a string diretamente
                        TARGET_TIMEZONE, 
                        "dd/MM/yyyy HH:mm", 
                        { locale: ptBR }
                      ) 
                    : ''
                }
                readOnly
                disabled
                className={cn("rounded-xl bg-muted/50 text-muted-foreground border-none", isMobile && "h-9 text-sm")}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};