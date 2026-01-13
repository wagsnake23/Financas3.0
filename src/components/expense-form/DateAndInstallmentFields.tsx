import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import DynamicIcon from "@/components/DynamicIcon"; // Importar DynamicIcon
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn, getBorderClass } from "@/lib/utils"; // Importar getBorderClass

interface DateAndInstallmentFieldsProps {
  dataVencimento: Date | undefined;
  setDataVencimento: (date: Date | undefined) => void;
  isCalendarOpen: boolean;
  setIsCalendarOpen: (open: boolean) => void;
  validationErrors: Record<string, boolean>;
  setValidationErrors: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  isMobile: boolean;
  tipoPagamento: "avista" | "parcelado" | "fixo"; // Nova prop (incluindo fixo para compatibilidade)
  // Removido: numeroParcelas: number;
  // Removido: setNumeroParcelas: (value: number) => void;
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
  // Removido: numeroParcelas,
  // Removido: setNumeroParcelas,
}) => {
  const dateLabel = tipoPagamento === "parcelado" ? "Data da Primeira Parcela" : "Data de Vencimento";

  return (
    <div className={cn("grid gap-4", "grid-cols-1")}> {/* Ajustado para sempre 1 coluna */}
      <div>
        <Label htmlFor="dataVencimento" className={cn("text-gray-800 font-medium mb-1.5 inline-block", isMobile && "text-xs")}>
          {dateLabel}
        </Label>
        <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
          <PopoverTrigger asChild>
            <Button
              variant={"outline"}
              className={cn(
                "w-full justify-start text-left font-normal transition-all duration-200 input-3d-premium",
                "rounded-xl text-gray-800 font-medium",
                !dataVencimento && "text-muted-foreground",
                isMobile && "h-9 text-sm",
                getBorderClass({ isInvalid: validationErrors.dataVencimento, isValid: validationErrors.dataVencimento === false })
              )}
            >
              <DynamicIcon name="📅" className={cn("mr-2 h-4 w-4 text-gray-500", isMobile && "h-4 w-4")} />
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

      {/* Removido o bloco de Número de Parcelas */}
    </div>
  );
};