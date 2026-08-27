import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import DynamicIcon from "@/components/DynamicIcon"; // Importar DynamicIcon
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn, getBorderClass } from "@/lib/utils";
import { DatePickerModal } from "@/components/ui/DatePickerModal";

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
}) => {
  const dateLabel = tipoPagamento === "parcelado" ? "Data da Primeira Parcela" : "Data de Vencimento";

  if (isMobile) {
    return (
      <div className="grid gap-4 grid-cols-1">
        <div className="relative">
          <Label htmlFor="dataVencimento" className="text-slate-500 font-semibold mb-1.5 inline-block text-[13px]">
            {dateLabel}
          </Label>
          
          <div className="relative w-full">
            <Button
              type="button"
              variant={"outline"}
              onClick={() => setIsCalendarOpen(true)}
              className={cn(
                "w-full justify-start text-left font-normal transition-all duration-200 input-3d-premium",
                !dataVencimento && "text-muted-foreground",
                "h-9 text-sm",
                getBorderClass({ isInvalid: validationErrors.dataVencimento, isValid: validationErrors.dataVencimento === false })
              )}
            >
              <DynamicIcon name="📅" className="mr-2 h-4 w-4 text-gray-500" />
              {dataVencimento ? format(dataVencimento, "PPP", { locale: ptBR }) : <span>Selecione uma data</span>}
            </Button>
            <DatePickerModal 
              isOpen={isCalendarOpen}
              setIsOpen={setIsCalendarOpen}
              date={dataVencimento}
              onSelect={(date) => {
                setDataVencimento(date);
                setValidationErrors(prev => ({ ...prev, dataVencimento: false }));
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4 grid-cols-1">
      <div className="relative">
        <Label htmlFor="dataVencimento" className="text-slate-500 font-semibold mb-1.5 inline-block text-[15px]">
          {dateLabel}
        </Label>
        
        <div className="relative w-full">
          <Button
            type="button"
            variant={"outline"}
            onClick={() => setIsCalendarOpen(true)}
            className={cn(
              "w-full justify-start text-left font-normal h-11 rounded-xl transition-all duration-200 shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] input-3d-premium",
              !dataVencimento && "text-muted-foreground",
              getBorderClass({ isInvalid: validationErrors.dataVencimento, isValid: validationErrors.dataVencimento === false })
            )}
          >
            <DynamicIcon name="📅" className="mr-2 h-4 w-4 text-gray-500" />
            {dataVencimento ? format(dataVencimento, "PPP", { locale: ptBR }) : <span>Selecione uma data</span>}
          </Button>
          <DatePickerModal 
            isOpen={isCalendarOpen}
            setIsOpen={setIsCalendarOpen}
            date={dataVencimento}
            onSelect={(date) => {
              setDataVencimento(date);
              setValidationErrors(prev => ({ ...prev, dataVencimento: false }));
            }}
          />
        </div>
      </div>
    </div>
  );
};