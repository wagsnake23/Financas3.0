import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AppCategory } from "@/types/finance";
import { cn } from "@/lib/utils";
import { CurrencyInput } from "@/components/ui/currency-input";
import { StatusToggleButton } from "@/components/StatusToggleButton";
import { Database } from "@/integrations/supabase/types";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";

type ReceitaStatus = Database['public']['Enums']['receita_status'];

interface CommonFieldsProps {
  title: string;
  setTitle: (title: string) => void;
  value: number | undefined;
  setValue: (value: number | undefined) => void;
  categoryId: string;
  setCategoryId: (id: string) => void;
  filteredCategories: AppCategory[];
  getCategoryDisplayName: (id: string) => string;
  loading: boolean;
  isMobile: boolean;
  hideTitle?: boolean;
  categoryLabel?: string;
  isPaid: boolean;
  setIsPaid: (paid: boolean) => void;
  transactionType: "income" | "expense";
  editOption: "thisMonth" | "thisMonthForward" | "all";
  // UPDATED PROPS FOR DUE DAY
  dueDay: Date | undefined; // Changed to Date | undefined
  setDueDay: (date: Date | undefined) => void; // Changed to accept Date | undefined
  isDueDayCalendarOpen: boolean; // NEW
  setIsDueDayCalendarOpen: (open: boolean) => void; // NEW
}

const UNSELECTED_VALUE = "unselected";

export const CommonFields: React.FC<CommonFieldsProps> = ({
  title,
  setTitle,
  value,
  setValue,
  categoryId,
  setCategoryId,
  filteredCategories,
  getCategoryDisplayName,
  loading,
  isMobile,
  hideTitle = false,
  categoryLabel = "Subcategoria",
  isPaid,
  setIsPaid,
  transactionType,
  editOption,
  // UPDATED PROPS FOR DUE DAY
  dueDay,
  setDueDay,
  isDueDayCalendarOpen,
  setIsDueDayCalendarOpen,
}) => {
  const showStatusToggleNextToValue = isMobile && editOption === "thisMonth";
  const showValueAndDueDayInline = isMobile && (editOption === "thisMonthForward" || editOption === "all");

  const dueDayLabel = isMobile && editOption === "thisMonthForward" 
    ? "Data de vencimento Deste Mês em diante" 
    : "Dia do Venc.";

  return (
    <div className="space-y-4">
      {/* Subcategoria - FIRST FIELD */}
      <div className="space-y-2">
        <Label htmlFor="category" className={cn(isMobile && "text-xs")}>{categoryLabel}</Label>
        <Select value={categoryId} onValueChange={setCategoryId} disabled={loading}>
          <SelectTrigger className={cn("rounded-xl", isMobile && "h-9 text-sm")}>
            <SelectValue placeholder="Selecione a subcategoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={UNSELECTED_VALUE} disabled className={cn(isMobile && "text-sm")}>Selecione a subcategoria</SelectItem>
            {filteredCategories.length === 0 ? (
              <SelectItem value={UNSELECTED_VALUE} disabled className={cn(isMobile && "text-sm")}>Nenhuma subcategoria disponível</SelectItem>
            ) : (
              filteredCategories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id} className={cn(isMobile && "text-sm")}>
                    <span className="flex items-center gap-2">
                      <span>{cat.icone}</span>
                      <span>{getCategoryDisplayName(cat.id)}</span>
                    </span>
                  </SelectItem>
                ))
            )}
          </SelectContent>
        </Select>
      </div>

      {!hideTitle && (
        <div className="space-y-2">
          <Label htmlFor="title" className={cn(isMobile && "text-xs")}>Título</Label>
          <Input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            disabled={loading}
            className={cn("rounded-xl", isMobile && "h-9 text-sm")}
          />
        </div>
      )}

      {/* Value and Due Day (conditional layout) */}
      {showValueAndDueDayInline ? (
        <div className="grid grid-cols-2 gap-4"> {/* Two columns for mobile */}
          <div className="space-y-2">
            <Label htmlFor="value" className={cn(isMobile && "text-xs")}>Valor (R$)</Label>
            <CurrencyInput
              id="value"
              value={value}
              onValueChange={(values) => setValue(values.floatValue)}
              placeholder="0,00"
              required
              disabled={loading}
              className={cn("rounded-xl", isMobile && "h-9 text-sm")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dueDay" className={cn(isMobile && "text-xs")}>{dueDayLabel}</Label>
            <Popover open={isDueDayCalendarOpen} onOpenChange={setIsDueDayCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "w-full justify-start text-left font-normal h-10 rounded-xl",
                    !dueDay && "text-muted-foreground",
                    isMobile && "h-9 text-sm"
                  )}
                  disabled={loading}
                >
                  <CalendarIcon className={cn("mr-2 h-4 w-4", isMobile && "h-3.5 w-3.5")} />
                  {dueDay ? format(dueDay, "PPP", { locale: ptBR }) : <span>Selecione uma data</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className={cn("w-auto p-0", isMobile && "p-1")}>
                <Calendar
                  mode="single"
                  selected={dueDay}
                  onSelect={(date) => {
                    if (!date) return;
                    const fixedDate = new Date(
                      date.getFullYear(),
                      date.getMonth(),
                      date.getDate()
                    );
                    setDueDay(fixedDate);
                    setIsDueDayCalendarOpen(false);
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
      ) : (
        // Default layout for value (not mobile or not thisMonthForward/all)
        <div className="space-y-2">
          <Label htmlFor="value" className={cn(isMobile && "text-xs")}>Valor (R$)</Label>
          <div className={cn("flex items-end gap-2", showStatusToggleNextToValue && "flex-row")}>
            <CurrencyInput
              id="value"
              value={value}
              onValueChange={(values) => setValue(values.floatValue)}
              placeholder="0,00"
              required
              disabled={loading}
              className={cn("rounded-xl", isMobile && "h-9 text-sm", showStatusToggleNextToValue && "flex-1")}
            />
            {showStatusToggleNextToValue && (
              <StatusToggleButton
                currentStatus={isPaid ? "Recebida" : "Pendente"}
                transactionType={transactionType}
                onToggle={() => setIsPaid(!isPaid)}
                isMobile={isMobile}
                disabled={loading}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};