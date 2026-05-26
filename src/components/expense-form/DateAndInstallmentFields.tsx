import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
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
      <div className="relative">
        <Label htmlFor="dataVencimento" className={cn("text-slate-500 font-semibold mb-1.5 inline-block", isMobile ? "text-[13px]" : "text-[15px]")}>
          {dateLabel}
        </Label>
        
        <div className="relative w-full">
          <Button
            type="button"
            variant={"outline"}
            onClick={() => setIsCalendarOpen(!isCalendarOpen)}
            className={cn(
              "w-full justify-start text-left font-normal transition-all duration-200 input-3d-premium",
              !dataVencimento && "text-muted-foreground",
              isMobile && "h-9 text-sm",
              getBorderClass({ isInvalid: validationErrors.dataVencimento, isValid: validationErrors.dataVencimento === false })
            )}
          >
            <DynamicIcon name="📅" className={cn("mr-2 h-4 w-4 text-gray-500", isMobile && "h-4 w-4")} />
            {dataVencimento ? format(dataVencimento, "PPP", { locale: ptBR }) : <span>Selecione uma data</span>}
          </Button>

          {isCalendarOpen && (
            <div 
              className={cn(
                "absolute top-full left-0 z-[100] mt-1 w-full min-w-full max-w-full overflow-hidden",
                "rounded-[24px] border border-blue-100/50 bg-white shadow-[0_15px_45px_rgba(0,0,0,0.15)] animate-in fade-in zoom-in-95 duration-200",
                isMobile ? "h-[340px]" : "h-[460px]"
              )}
            >
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
                showOutsideDays={true}
                className="w-full h-full p-2"
              />
            </div>
          )}
        </div>
      </div>

      {/* Removido o bloco de Número de Parcelas */}
    </div>
  );
};