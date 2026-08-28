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
      <div className={cn("space-y-2", isMobile && "space-y-1")}> {/* Removido mt-[-1rem] para mobile */}
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
              className={cn("rounded-xl bg-muted/50 text-muted-foreground", isMobile && "!h-[39px] !min-h-[39px] !max-h-[39px] text-sm")}
            />
          </div>
        )}
      </div>

      {/* NOVO: Forma de Pagamento */}
      {transactionType === "expense" && ( // Apenas para despesas
        <div className={cn("space-y-2", isMobile && "space-y-1")}>
          <Label className={cn(isMobile && "text-xs")}>Forma de Pagamento</Label>
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
            <SelectTrigger className={cn("rounded-xl", isMobile && "h-9 text-sm", getBorderClass({ isInvalid: validationErrors.formaPagamento, isValid: validationErrors.formaPagamento === false }))}>
              <SelectValue placeholder="Selecione a forma de pagamento" />
            </SelectTrigger>
            <SelectContent>
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
          <Button
            type="button"
            variant={"outline"}
            onClick={() => setIsCalendarOpen(true)}
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

          <DatePickerModal 
            isOpen={isCalendarOpen}
            setIsOpen={setIsCalendarOpen}
            date={date}
            onSelect={setDate}
          />
      </div>

      <div className={cn("space-y-2", isMobile && "space-y-1")}>
        <Label htmlFor="description" className={cn(isMobile && "text-xs")}>Descrição</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Adicione uma descrição..."
          rows={3}
          className={cn("rounded-xl", isMobile && "text-sm")}
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
                className={cn("rounded-xl bg-muted/40 text-gray-900 font-bold", isMobile && "h-9 text-sm")}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
