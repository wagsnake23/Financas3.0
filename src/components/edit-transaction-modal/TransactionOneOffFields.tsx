import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { AppCategory } from "@/types/finance";
import { Database } from "@/integrations/supabase/types";
import { CurrencyInput } from "@/components/ui/currency-input"; // Importar CurrencyInput
import { StatusToggleButton } from "@/components/StatusToggleButton"; // NEW IMPORT

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
  filteredCategories: AppCategory[]; // Agora contém apenas subcategorias
  isMobile: boolean;
  isFixedLegacy?: boolean;
  transactionType: "income" | "expense";
  UNSELECTED_VALUE: string;
  isPaid: boolean; // NEW PROP
  setIsPaid: (paid: boolean) => void; // NEW PROP
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
  filteredCategories, // Usar filteredCategories diretamente (já são subcategorias)
  isMobile,
  isFixedLegacy,
  transactionType,
  UNSELECTED_VALUE,
  isPaid, // NEW
  setIsPaid, // NEW
}) => {
  return (
    <>
      {/* Subcategoria */}
      <div className="space-y-2">
        <Label htmlFor="category" className={cn(isMobile && "text-xs")}>Subcategoria</Label>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className={cn("rounded-xl", isMobile && "h-9 text-sm")}>
            <SelectValue placeholder="Selecione a subcategoria" /> {/* Placeholder atualizado */}
          </SelectTrigger>
          <SelectContent>
            {/* Removido o item "Selecione..." */}
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Valor */}
        <div className="space-y-2">
          <Label htmlFor="amount" className={cn(isMobile && "text-xs")}>Valor (R$)</Label>
          <CurrencyInput
            id="amount"
            value={amount}
            onValueChange={(values) => setAmount(values.floatValue)}
            placeholder="0,00"
            required
            className={cn("rounded-xl", isMobile && "h-9 text-sm")}
          />
        </div>

        {/* Data */}
        <div className="space-y-2">
          <Label htmlFor="date" className={cn(isMobile && "text-xs")}>Data</Label>
          <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
            <PopoverTrigger asChild>
              <Button
                variant={"outline"}
                className={cn(
                  "w-full justify-start text-left font-normal h-10 rounded-xl",
                  !date && "text-muted-foreground",
                  isMobile && "h-9 text-sm"
                )}
                disabled={isFixedLegacy}
              >
                <CalendarIcon className={cn("mr-2 h-4 w-4", isMobile && "h-3.5 w-3.5")} />
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

      {/* Replaced RevenueStatusToggle with StatusToggleButton */}
      <div className="flex flex-col items-start space-y-2"> {/* Adicionado flex-col items-start e space-y-2 */}
        <Label className={cn(isMobile && "text-xs")}>Status</Label>
        <StatusToggleButton
          currentStatus={isPaid ? "Recebida" : "Pendente"} // Map isPaid to ReceitaStatus
          transactionType={transactionType}
          onToggle={() => setIsPaid(!isPaid)}
          isMobile={isMobile}
          disabled={isFixedLegacy} // Disable if legacy fixed, as status is not directly editable
        />
      </div>
    </>
  );
};