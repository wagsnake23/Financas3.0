import React from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import DynamicIcon from "@/components/DynamicIcon";
import { ptBR } from "date-fns/locale";
import { useIsMobile } from "@/hooks/use-mobile";

export interface DatePickerModalProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  date: Date | undefined;
  onSelect: (date: Date | undefined) => void;
}

export function DatePickerModal({ isOpen, setIsOpen, date, onSelect }: DatePickerModalProps) {
  const isMobile = useIsMobile();

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent
        className={cn(
          "p-0 border-none shadow-2xl gap-0 overflow-hidden !rounded-[21px]",
          isMobile ? "w-[95%] max-w-[340px]" : "w-[95%] max-w-[360px]"
        )}
        style={{ background: "#FFFFFF" }}
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-100 relative">
          <DialogTitle className="text-[#1e3a8a] text-lg font-black tracking-tight flex items-center gap-2" style={{ fontFamily: "'Inter', sans-serif" }}>
            <DynamicIcon name="📅" className="h-[22px] w-[22px]" />
            Escolher Data
          </DialogTitle>
        </div>

        <div className={cn(
          "flex justify-center bg-white p-3",
          [
            // Tabela e linhas (largura total e justify-between para alinhar com as setas)
            "[&_table]:w-full [&_thead>tr]:w-full [&_thead>tr]:justify-between [&_tbody>tr]:w-full [&_tbody>tr]:justify-between [&_tbody>tr]:mt-1",
            
            // Dias da semana (th)
            "[&_th:not(:first-child):not(:last-child)]:!text-slate-400 [&_th:not(:first-child):not(:last-child)]:!font-semibold",
            "[&_th:first-child]:!text-red-400/90 [&_th:last-child]:!text-red-400/90",
            "[&_th]:border [&_th]:border-slate-100/80 [&_th]:rounded-[6px] [&_th]:bg-slate-50/50 [&_th]:py-0.5",
            
            // Dias do mês (td > button) - Aplicando borda discreta em TODOS os dias
            "[&_td>button]:border [&_td>button]:border-slate-200/60 [&_td>button]:rounded-[8px]",
            
            // Data selecionada (alta prioridade)
            "[&_td>button[aria-selected='true']]:shadow-sm [&_td>button[aria-selected='true']]:!bg-[#1e3a8a] [&_td>button[aria-selected='true']]:font-bold [&_td>button[aria-selected='true']]:!border-[#1e3a8a] [&_td>button[aria-selected='true']]:!text-white",
          ]
        )}>
          <Calendar
            mode="single"
            selected={date}
            onSelect={(selectedDate) => {
              onSelect(selectedDate);
              setIsOpen(false);
            }}
            initialFocus
            locale={ptBR}
            showOutsideDays={true}
            fixedWeeks={true}
            className="w-full p-0"
            classNames={{
              nav_button: "flex items-center justify-center h-9 w-9 bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md transition-all active:scale-95 text-slate-600",
              nav_button_previous: "absolute left-0",
              nav_button_next: "absolute right-0",
              caption_dropdowns: "flex justify-center gap-1 z-10 [&>button]:font-black [&>button]:text-[#1e3a8a] [&>button]:text-[1.1rem]",
            }}
            modifiersClassNames={{
              sunday: "!text-red-400/90 !bg-transparent",
              saturday: "!text-red-400/90 !bg-transparent",
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
