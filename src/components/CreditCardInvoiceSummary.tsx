import React from "react";
import { Card } from "@/components/ui/card";
import DynamicIcon from "./DynamicIcon";
import { cn, formatCurrency, formatInTimeZone, TARGET_TIMEZONE } from "@/lib/utils"; // Importar formatCurrency, formatInTimeZone, TARGET_TIMEZONE
import { Button } from "@/components/ui/button"; // Importar Button
import { format } from "date-fns"; // Importar format
import { ptBR } from "date-fns/locale"; // Importar ptBR

interface CreditCardInvoiceSummaryProps {
  totalPaid: number;
  totalPending: number;
  totalCardExpenses: number;
  isMobile: boolean;
  formattedDueDate: string | null;
  formattedClosingDate: string | null;
  cardLastDigits: string | null;
  selectedMonth: Date; // NOVA PROP
  onPayInvoice: () => void;
  loadingPayInvoice: boolean;
  disablePayInvoiceButton: boolean;
}

export const CreditCardInvoiceSummary: React.FC<CreditCardInvoiceSummaryProps> = ({
  totalPaid,
  totalPending,
  totalCardExpenses,
  isMobile,
  formattedDueDate,
  formattedClosingDate,
  cardLastDigits,
  selectedMonth, // Usar a nova prop
  onPayInvoice,
  loadingPayInvoice,
  disablePayInvoiceButton,
}) => {
  const formattedBadgeMonth = format(selectedMonth, "MMM/yy", { locale: ptBR });

  return (
    <Card className={cn(
      "p-4 animate-fade-in space-y-2 bg-soft-blue/20 border border-soft-blue rounded-xl shadow-sm relative", // Adicionado 'relative'
      isMobile && "p-3 space-y-2"
    )}>
      {/* NOVO BADGE NO CANTO SUPERIOR DIREITO */}
      <div className={cn(
        "absolute top-2 right-2 text-right flex flex-col items-end",
        isMobile ? "top-1 right-1" : "top-2 right-2"
      )}>
        <span className={cn(
          "text-xs font-bold uppercase bg-primary/10 text-primary px-2 py-0.5 rounded-md",
          isMobile && "text-[0.6rem] px-1.5 py-0.5" // Ajuste de tamanho para mobile
        )}>
          {formattedBadgeMonth}
        </span>
        {formattedDueDate && (
          <span className={cn(
            "text-[10px] text-muted-foreground mt-[2px]",
            isMobile && "text-[0.5rem] mt-[1px]" // Ajuste de tamanho para mobile
          )}>
            Venc. {formattedDueDate}
          </span>
        )}
      </div>
      
      <div className={cn("flex items-start justify-between gap-4", isMobile && "flex-col items-center text-center gap-2")}>
        {/* Detalhes do Cartão (Esquerda) - Removido o mês e vencimento daqui */}
        <div className={cn("flex flex-col items-start", isMobile && "items-center")}>
          {/* Removido: Fatura: Novembro 2025 e Vencimento: 05/12 */}
        </div>

        {/* Valores (Centro, em uma linha) */}
        <div className={cn("flex items-center justify-center gap-4", isMobile && "gap-4 w-full")}> {/* Aumentado o gap para mobile */}
          <div className={cn("flex flex-col items-center justify-center", isMobile && "p-0.5")}>
            <DynamicIcon name="CheckCircle" className={cn("h-5 w-5 text-success mb-1", isMobile && "h-4 w-4 mb-0.5")} />
            <p className={cn("text-xs text-muted-foreground", isMobile && "text-[0.6rem]")}>Pago</p>
            <p className={cn("text-sm font-bold text-success", isMobile && "text-xs")}>{formatCurrency(totalPaid)}</p>
          </div>
          <div className={cn("flex flex-col items-center justify-center", isMobile && "p-0.5")}>
            <DynamicIcon name="Circle" className={cn("h-5 w-5 text-destructive mb-1", isMobile && "h-4 w-4 mb-0.5")} />
            <p className={cn("text-xs text-muted-foreground", isMobile && "text-[0.6rem]")}>Pendente</p>
            <p className={cn("text-sm font-bold text-destructive", isMobile && "text-xs")}>{formatCurrency(totalPending)}</p>
          </div>
          <div className={cn("flex flex-col items-center justify-center", isMobile && "p-0.5")}>
            <DynamicIcon name="CreditCard" className={cn("h-5 w-5 text-foreground mb-1", isMobile && "h-4 w-4 mb-0.5")} />
            <p className={cn("text-xs text-muted-foreground", isMobile && "text-[0.6rem]")}>Total Fatura</p>
            <p className={cn("text-sm font-bold text-foreground", isMobile && "text-xs")}>{formatCurrency(totalCardExpenses)}</p>
          </div>
        </div>
      </div>

      <div className={cn("mt-4", isMobile && "mt-3 flex justify-center")}> {/* Adicionado flex justify-center para centralizar o botão */}
        <Button
          variant="secondary"
          onClick={onPayInvoice}
          className={cn("rounded-xl", isMobile ? "w-auto max-w-[150px] h-8 px-2 text-xs" : "w-auto px-4")} /* Ajustado w-auto e max-w-[150px] */
          disabled={loadingPayInvoice || disablePayInvoiceButton}
        >
          <DynamicIcon name="CreditCard" className="mr-2 h-4 w-4" />
          {loadingPayInvoice ? "Pagando..." : "Pagar Fatura"}
        </Button>
      </div>
    </Card>
  );
};