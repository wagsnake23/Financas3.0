import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { cn, getBorderClass, formatInTimeZone, TARGET_TIMEZONE, zonedTimeToUtcFallback } from "@/lib/utils"; // Importar zonedTimeToUtcFallback de utils
import { DatePickerModal } from "@/components/ui/DatePickerModal";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import DynamicIcon from "@/components/DynamicIcon"; // Importar DynamicIcon
import { AppCategory } from "@/types/finance";
import { Database, Tables } from "@/integrations/supabase/types"; // Importar Tables
import CurrencyBR from "@/components/ui/currency-br"; // Importar CurrencyBR
import { StatusToggleButton } from "@/components/StatusToggleButton";
import { AddCardDialog } from "@/components/AddCardDialog"; // NOVO: Importar AddCardDialog
import { ManageCardsDialog } from "@/components/ManageCardsDialog"; // NOVO: Importar ManageCardsDialog
import { User } from "@supabase/supabase-js"; // NOVO: Importar User
// Removido: import { zonedTimeToUtc } from 'date-fns-tz'; // Removido importação direta

type ReceitaStatus = Database['public']['Enums']['receita_status'];

interface TransactionOneOffFieldsProps {
  amount: number | undefined;
  setAmount: (amount: number | undefined) => void;
  date: Date | undefined;
  setDate: (date: Date | undefined) => void;
  category: string;
  setCategory: (category: string) => void;
  description: string;
  setDescription: (description: string) => void;
  status: ReceitaStatus; // Kept for consistency, but derived from isPaid
  setStatus: (status: ReceitaStatus) => void; // Kept for consistency, but derived from isPaid
  isCalendarOpen: boolean;
  setIsCalendarOpen: (open: boolean) => void;
  filteredCategories: AppCategory[];
  isMobile: boolean;
  transactionType: "income" | "expense";
  UNSELECTED_VALUE: string;
  isPaid: boolean;
  setIsPaid: (paid: boolean) => void;
  installmentNumber?: number; // NEW: installmentNumber
  totalInstallments?: number; // NEW: totalInstallments
  validationErrors: Record<string, boolean>; // NOVO: Adicionado validationErrors
  setValidationErrors: React.Dispatch<React.SetStateAction<Record<string, boolean>>>; // FIX: Adicionado setValidationErrors
  paidAtTimestamp: string | null; // NOVO: Adicionado paidAtTimestamp
  // NOVO: Props de forma de pagamento e cartão
  formaPagamento: "dinheiro" | "pix" | "cartao" | "boleto";
  setFormaPagamento: (value: "dinheiro" | "pix" | "cartao" | "boleto") => void;
  cartaoId: string;
  setCartaoId: (value: string) => void;
  cartoes: Tables<'cartoes'>[];
  refetchCartoes: () => void; // Renomeado de loadCartoes para refetchCartoes
}

export const TransactionOneOffFields: React.FC<TransactionOneOffFieldsProps> = ({
  amount,
  setAmount,
  date,
  setDate,
  category,
  setCategory,
  description,
  setDescription,
  status, // Still passed, but its value will be derived from isPaid
  setStatus, // Still passed, but its function will be replaced by setIsPaid
  isCalendarOpen,
  setIsCalendarOpen,
  filteredCategories,
  isMobile,
  transactionType,
  UNSELECTED_VALUE,
  isPaid,
  setIsPaid,
  installmentNumber, // NEW
  totalInstallments, // NEW
  validationErrors, // NOVO
  setValidationErrors, // FIX: Desestruturado setValidationErrors
  paidAtTimestamp, // NOVO
  // NOVO: Props de forma de pagamento e cartão
  formaPagamento,
  setFormaPagamento,
  cartaoId,
  setCartaoId,
  cartoes,
  refetchCartoes, // Renomeado
}) => {
  const isExpenseInstallment = transactionType === "expense" && totalInstallments && totalInstallments > 1;

  // Dummy user for AddCardDialog and ManageCardsDialog, as they require it.
  // In a real scenario, this would come from context or props.
  const dummyUser: User = { id: "dummy-user-id", email: "dummy@example.com", app_metadata: {}, user_metadata: {}, aud: "", created_at: "" };

  return (
    <div className={cn("space-y-4", isMobile && "w-full space-y-2")}> {/* Removido max-w-[280px] mx-auto */}
      {/* Subcategoria */}
      <div className={cn("space-y-2 pb-[4px]", isMobile && "space-y-1 !pb-[7px]")}> {/* Removido mt-[-1rem] para mobile */}
        <Label htmlFor="category" className={cn("text-[#64748B] font-semibold", isMobile && "text-xs -mb-[2px] block")}>Subcategoria</Label>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className={cn("input-3d-premium input-white modal-edit-input !text-[#263449] !h-[40px] box-border", getBorderClass({ isInvalid: validationErrors.category, isValid: validationErrors.category === false }))}>
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
        <div className={cn("space-y-2", isMobile && "space-y-1")}>
          <Label htmlFor="amount" className={cn("text-[#64748B] font-semibold", isMobile && "text-xs -mb-[2px] block")}>Valor (R$)</Label>
          <CurrencyBR
            value={amount}
            onChange={(v) => {
              setAmount(v);
              setValidationErrors(prev => ({ ...prev, amount: false }));
            }}
            className={cn("input-3d-premium input-white modal-edit-input !text-[#263449] !h-[40px] box-border", getBorderClass({ isInvalid: validationErrors.amount, isValid: validationErrors.amount === false }))}
          />
        </div>

        {/* Campo Informativo para Despesas (Sempre visível) */}
        {transactionType === "expense" && (
          <div className={cn("space-y-2", isMobile && "space-y-1")}>
            <Label className={cn("text-[#64748B] font-semibold", isMobile && "text-xs -mb-[2px] block")}>
              {isExpenseInstallment ? "Parcela" : "Tipo"}
            </Label>
            <Input
              value={isExpenseInstallment ? `${installmentNumber || 0} de ${totalInstallments || 0}` : "À vista"}
              readOnly
              disabled
              className={cn("input-3d-premium modal-info-input !h-[40px] box-border")}
            />
          </div>
        )}
      </div>

      {/* NOVO: Forma de Pagamento */}
      {transactionType === "expense" && ( // Apenas para despesas
        <div className={cn("space-y-2 pb-[4px]", isMobile && "space-y-1 !pb-[7px]")}>
          <Label className={cn("text-[#64748B] font-semibold", isMobile && "text-xs -mb-[2px] block")}>Forma de Pagamento</Label>
          <Select
            value={formaPagamento}
            onValueChange={(value: "dinheiro" | "pix" | "cartao" | "boleto") => {
              setFormaPagamento(value);
              if (value !== "cartao") {
                setCartaoId(UNSELECTED_VALUE); // Resetar cartão se não for "cartao"
              }
              setValidationErrors(prev => ({ ...prev, formaPagamento: false }));
            }}
          >
            <SelectTrigger className={cn("input-3d-premium input-white modal-edit-input !text-[#263449] !h-[40px] box-border", getBorderClass({ isInvalid: validationErrors.formaPagamento, isValid: validationErrors.formaPagamento === false }))}>
              <SelectValue placeholder="Selecione a forma de pagamento" />
            </SelectTrigger>
            <SelectContent className="rounded-2xl border-none shadow-xl">
              <SelectItem value={UNSELECTED_VALUE} disabled className={cn(isMobile && "text-sm")}>Selecione a forma de pagamento</SelectItem>
              <SelectItem value="dinheiro" className={cn(isMobile && "text-sm")}>
                <span className="flex items-center gap-2"><span className="emoji">💰</span> Dinheiro</span>
              </SelectItem>
              <SelectItem value="pix" className={cn(isMobile && "text-sm")}>
                <span className="flex items-center gap-2"><span className="emoji">🪙</span> Pix</span>
              </SelectItem>
              <SelectItem value="cartao" className={cn(isMobile && "text-sm")}>
                <span className="flex items-center gap-2"><span className="emoji">💳</span> Cartão</span>
              </SelectItem>
              <SelectItem value="boleto" className={cn(isMobile && "text-sm")}>
                <span className="flex items-center gap-2"><span className="emoji">📑</span> Boleto</span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* NOVO: Seleção de Cartão de Crédito (condicional) */}
      {transactionType === "expense" && formaPagamento === "cartao" && (
        <div className={cn("space-y-2 pb-[4px]", isMobile && "space-y-1 !pb-[7px]")}>
          <Label className={cn("text-[#64748B] font-semibold", isMobile && "text-xs -mb-[2px] block")}>Cartão de Crédito</Label>
          <div className="flex gap-2">
            <Select
              value={cartaoId}
              onValueChange={(value: string) => {
                setCartaoId(value);
                setValidationErrors(prev => ({ ...prev, cartaoId: false }));
              }}
            >
              <SelectTrigger className={cn("input-3d-premium modal-edit-input !text-[#263449] !h-[40px] box-border", getBorderClass({ isInvalid: validationErrors.cartaoId, isValid: validationErrors.cartaoId === false }))}>
                <SelectValue placeholder="Selecione o cartão" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl border-none shadow-xl">
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
      <div className={cn("space-y-2 pb-[4px]", isMobile && "space-y-1 !pb-[7px]")}>
        <Label htmlFor="date" className={cn("text-[#64748B] font-semibold", isMobile && "text-xs -mb-[2px] block")}>Data</Label>
          <Button
            type="button"
            variant={"outline"}
            onClick={() => setIsCalendarOpen(true)}
            className={cn(
              "w-full justify-start pl-3 text-left font-normal input-3d-premium input-white modal-edit-input !text-[#263449] !h-[40px] box-border",
              !date && "text-muted-foreground",
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

      <div className={cn("space-y-2", isMobile && "space-y-1")}>
        <Label htmlFor="description" className={cn("text-[#64748B] font-semibold", isMobile && "text-xs -mb-[2px] block")}>Descrição</Label>
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
            rows={3}
            maxLength={100}
            className={cn("resize-y input-3d-premium input-white modal-edit-input !text-[#263449] !pb-6")}
          />
          <div className="absolute bottom-1.5 right-2 text-[11px] font-medium text-[#64748B] pointer-events-none">
            {description.length}/100
          </div>
        </div>
      </div>

      <div className={cn("flex flex-col items-start space-y-2", isMobile && "space-y-1")}>
        <Label className={cn("text-[#64748B] font-semibold", isMobile && "text-xs")}>Status</Label>
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
                className={cn("input-3d-premium opacity-70 !bg-[#FFFFFF] !border !border-[#D1DCE8] !text-[#263449]")}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
