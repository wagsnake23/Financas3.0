import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { cn, getBorderClass } from "@/lib/utils"; // Importar getBorderClass
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import DynamicIcon from "@/components/DynamicIcon"; // Importar DynamicIcon
import { AppCategory } from "@/types/finance";
import { Database } from "@/integrations/supabase/types";
import CurrencyBR from "@/components/ui/currency-br"; // Importar CurrencyBR
import { StatusToggleButton } from "@/components/StatusToggleButton";

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
}) => {
  const isExpenseInstallment = transactionType === "expense" && totalInstallments && totalInstallments > 1;

  return (
    <>
      {/* Subcategoria */}
      <div className="space-y-2">
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
        <div className="space-y-2">
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
          <div className="space-y-2">
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

      {/* Data (abaixo de Valor e Parcela) */}
      <div className="space-y-2">
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

      <div className="space-y-2">
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

      <div className="flex flex-col items-start space-y-2">
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
                value={format(new Date(paidAtTimestamp), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                readOnly
                disabled
                className={cn("rounded-xl bg-muted/50 text-muted-foreground", isMobile && "h-9 text-sm")}
              />
            </div>
          )}
        </div>
      </div>
    </>
  );
};