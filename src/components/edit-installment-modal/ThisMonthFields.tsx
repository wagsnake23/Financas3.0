import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";

interface ThisMonthFieldsProps {
  overrideDueDate: Date | undefined;
  setOverrideDueDate: (date: Date | undefined) => void;
  isOverrideDueDateCalendarOpen: boolean;
  setIsOverrideDueDateCalendarOpen: (open: boolean) => void;
  note: string;
  setNote: (note: string) => void;
  isPaid: boolean;
  setIsPaid: (paid: boolean) => void;
  loading: boolean;
  isMobile: boolean;
}

export const ThisMonthFields: React.FC<ThisMonthFieldsProps> = ({
  overrideDueDate,
  setOverrideDueDate,
  isOverrideDueDateCalendarOpen,
  setIsOverrideDueDateCalendarOpen,
  note,
  setNote,
  isPaid,
  setIsPaid,
  loading,
  isMobile,
}) => {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="overrideDueDate" className={cn(isMobile && "text-xs")}>Data de Vencimento (Este Mês)</Label>
        <Popover open={isOverrideDueDateCalendarOpen} onOpenChange={setIsOverrideDueDateCalendarOpen}>
          <PopoverTrigger asChild>
            <Button
              variant={"outline"}
              className={cn(
                "w-full justify-start text-left font-normal h-10",
                !overrideDueDate && "text-muted-foreground",
                isMobile && "h-9 text-sm"
              )}
              disabled={loading}
            >
              <CalendarIcon className={cn("mr-2 h-4 w-4", isMobile && "h-3.5 w-3.5")} />
              {overrideDueDate ? format(overrideDueDate, "PPP", { locale: ptBR }) : <span>Selecione uma data</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className={cn("w-auto p-0", isMobile && "p-1")}>
            <Calendar
              mode="single"
              selected={overrideDueDate}
              onSelect={setOverrideDueDate}
              initialFocus
              locale={ptBR}
              showOutsideDays={false}
              className={cn(isMobile && "text-sm")}
            />
          </PopoverContent>
        </Popover>
      </div>
      <div className="space-y-2">
        <Label htmlFor="note" className={cn(isMobile && "text-xs")}>Observação (Este Mês)</Label>
        <Input
          id="note"
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          disabled={loading}
          className={cn(isMobile && "h-9 text-sm")}
        />
      </div>
      <div className="flex items-center space-x-2">
        <Checkbox
          id="isPaid"
          checked={isPaid}
          onCheckedChange={(checked: boolean) => setIsPaid(checked)}
          disabled={loading}
          className={cn(isMobile && "h-4 w-4")}
        />
        <Label htmlFor="isPaid" className={cn("text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70", isMobile && "text-xs")}>
          Marcar como Pago/Recebido
        </Label>
      </div>
    </>
  );
};