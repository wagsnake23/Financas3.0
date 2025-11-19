import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { Enums } from "@/integrations/supabase/types";

interface RecurringMasterFieldsProps {
  dueDay: string;
  setDueDay: (day: string) => void;
  frequency: Enums<'recurring_frequency'>;
  setFrequency: (freq: Enums<'recurring_frequency'>) => void;
  startDate: Date | undefined;
  setStartDate: (date: Date | undefined) => void;
  isStartDateCalendarOpen: boolean;
  setIsStartDateCalendarOpen: (open: boolean) => void;
  endDate: Date | undefined;
  setEndDate: (date: Date | undefined) => void;
  isEndDateCalendarOpen: boolean;
  setIsEndDateCalendarOpen: (open: boolean) => void;
  status: Enums<'recurring_status'>;
  setStatus: (status: Enums<'recurring_status'>) => void;
  loading: boolean;
  isMobile: boolean;
  showStartDate?: boolean; // Para a opção "Toda a recorrência"
  showPreserveExceptions?: boolean; // Para a opção "Toda a recorrência"
  preserveExceptions?: boolean;
  setPreserveExceptions?: (checked: boolean) => void;
}

export const RecurringMasterFields: React.FC<RecurringMasterFieldsProps> = ({
  dueDay,
  setDueDay,
  frequency,
  setFrequency,
  startDate,
  setStartDate,
  isStartDateCalendarOpen,
  setIsStartDateCalendarOpen,
  endDate,
  setEndDate,
  isEndDateCalendarOpen,
  setIsEndDateCalendarOpen,
  status,
  setStatus,
  loading,
  isMobile,
  showStartDate = false,
  showPreserveExceptions = false,
  preserveExceptions,
  setPreserveExceptions,
}) => {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="dueDay" className={cn(isMobile && "text-xs")}>Dia de Vencimento</Label>
          <Input
            id="dueDay"
            type="number"
            min="1"
            max="31"
            value={dueDay}
            onChange={(e) => setDueDay(e.target.value)}
            required
            disabled={loading}
            className={cn(isMobile && "h-9 text-sm")}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="frequency" className={cn(isMobile && "text-xs")}>Frequência</Label>
          <Select value={frequency} onValueChange={(value: Enums<'recurring_frequency'>) => setFrequency(value)} disabled={loading}>
            <SelectTrigger className={cn(isMobile && "h-9 text-sm")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly" className={cn(isMobile && "text-sm")}>Mensal</SelectItem>
              <SelectItem value="quarterly" className={cn(isMobile && "text-sm")}>Trimestral</SelectItem>
              <SelectItem value="annually" className={cn(isMobile && "text-sm")}>Anual</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {showStartDate && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="startDate" className={cn(isMobile && "text-xs")}>Data de Início</Label>
            <Popover open={isStartDateCalendarOpen} onOpenChange={setIsStartDateCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "w-full justify-start text-left font-normal h-10",
                    !startDate && "text-muted-foreground",
                    isMobile && "h-9 text-sm"
                  )}
                  disabled={loading}
                >
                  <CalendarIcon className={cn("mr-2 h-4 w-4", isMobile && "h-3.5 w-3.5")} />
                  {startDate ? format(startDate, "PPP", { locale: ptBR }) : <span>Selecione uma data</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className={cn("w-auto p-0", isMobile && "p-1")}>
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={setStartDate}
                  initialFocus
                  locale={ptBR}
                  showOutsideDays={false}
                  className={cn(isMobile && "text-sm")}
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-2">
            <Label htmlFor="endDate" className={cn(isMobile && "text-xs")}>Data de Fim (Opcional)</Label>
            <Popover open={isEndDateCalendarOpen} onOpenChange={setIsEndDateCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "w-full justify-start text-left font-normal h-10",
                    !endDate && "text-muted-foreground",
                    isMobile && "h-9 text-sm"
                  )}
                  disabled={loading}
                >
                  <CalendarIcon className={cn("mr-2 h-4 w-4", isMobile && "h-3.5 w-3.5")} />
                  {endDate ? format(endDate, "PPP", { locale: ptBR }) : <span>Selecione uma data</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className={cn("w-auto p-0", isMobile && "p-1")}>
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={setEndDate}
                  initialFocus
                  locale={ptBR}
                  showOutsideDays={false}
                  className={cn(isMobile && "text-sm")}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="status" className={cn(isMobile && "text-xs")}>Status da Recorrência</Label>
        <Select value={status} onValueChange={(value: Enums<'recurring_status'>) => setStatus(value)} disabled={loading}>
          <SelectTrigger className={cn(isMobile && "h-9 text-sm")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active" className={cn(isMobile && "text-sm")}>Ativa</SelectItem>
            <SelectItem value="canceled" className={cn(isMobile && "text-sm")}>Cancelada</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {showPreserveExceptions && setPreserveExceptions && (
        <div className="flex items-center space-x-2">
          <Checkbox
            id="preserveExceptions"
            checked={preserveExceptions}
            onCheckedChange={(checked: boolean) => setPreserveExceptions(checked)}
            disabled={loading}
            className={cn(isMobile && "h-4 w-4")}
          />
          <Label htmlFor="preserveExceptions" className={cn("text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70", isMobile && "text-xs")}>
            Manter exceções existentes
          </Label>
        </div>
      )}
    </div>
  );
};