import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface DateAndInstallmentFieldsProps {
  dataVencimento: Date | undefined;
  setDataVencimento: (date: Date | undefined) => void;
  isCalendarOpen: boolean;
  setIsCalendarOpen: (open: boolean) => void;
  validationErrors: Record<string, boolean>;
  setValidationErrors: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  isMobile: boolean;
  tipoPagamento: "avista" | "parcelado"; // Nova prop
  numeroParcelas: number; // Nova prop
  setNumeroParcelas: (value: number) => void; // Nova prop
}

export const DateAndInstallmentFields: React.FC<DateAndInstallmentFieldsProps> = ({
  dataVencimento,
  setDataVencimento,
  isCalendarOpen,
  setIsCalendarOpen,
  validationErrors,
  setValidationErrors,
  isMobile,
  tipoPagamento,
  numeroParcelas,
  setNumeroParcelas,
}) => {
  const dateLabel = tipoPagamento === "parcelado" ? "Data da Primeira Parcela" : "Data de Vencimento";

  return (
    <div className={cn("grid gap-4", tipoPagamento === "parcelado" ? "grid-cols-2" : "grid-cols-1")}>
      <div>
        <Label htmlFor="dataVencimento" className={cn(isMobile && "text-xs")}>
          {dateLabel}
        </Label>
        <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
          <PopoverTrigger asChild>
            <Button
              variant={"outline"}
              className={cn(
                "w-full justify-start text-left font-normal h-10 rounded-xl",
                !dataVencimento && "text-muted-foreground",
                isMobile && "h-9 text-sm",
                validationErrors.dataVencimento && "border-destructive"
              )}
            >
              <CalendarIcon className={cn("mr-2 h-4 w-4", isMobile && "h-3.5 w-3.5")} />
              {dataVencimento ? format(dataVencimento, "PPP", { locale: ptBR }) : <span>Selecione uma data</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className={cn("w-auto p-0", isMobile && "p-1")}>
            <Calendar
              mode="single"
              selected={dataVencimento}
              onSelect={(date) => {
                setDataVencimento(date);
                setIsCalendarOpen(false);
                setValidationErrors(prev => ({ ...prev, dataVencimento: false }));
              }}
              initialFocus
              locale={ptBR}
              showOutsideDays={false}
              className={cn(isMobile && "text-sm")}
            />
          </PopoverContent>
        </Popover>
      </div>

      {tipoPagamento === "parcelado" && (
        <div>
          <Label htmlFor="numeroParcelas" className={cn(isMobile && "text-xs")}>
            Número de Parcelas
          </Label>
          <Input
            id="numeroParcelas"
            type="number"
            min="2"
            value={numeroParcelas}
            onChange={(e) => {
              const value = parseInt(e.target.value);
              setNumeroParcelas(isNaN(value) ? 1 : value);
              setValidationErrors(prev => ({ ...prev, numeroParcelas: false }));
            }}
            placeholder="Ex: 3"
            required
            className={cn("rounded-xl", isMobile && "h-9 text-sm", validationErrors.numeroParcelas && "border-destructive")}
          />
        </div>
      )}
    </div>
  );
};