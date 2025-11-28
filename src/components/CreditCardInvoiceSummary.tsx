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
      "p-4 animate-fade-in space-y-2 bg-soft-blue/20 border border-soft-blue rounded-xl shadow-sm",
      isMobile && "p-3 space-y-2"
    )}>
      {/* Contêiner principal para todos os status e o badge, alinhados horizontalmente */}
      <div className={cn("flex items-center justify-between w-full", isMobile ? "gap-1" : "gap-2")}>
        {/* Pago */}
        <div className={cn("flex flex-col items-center justify-center flex-1", isMobile && "p-0.5")}>
          <DynamicIcon name="CheckCircle" className={cn("h-5 w-5 text-success mb-1", isMobile && "h-4 w-4 mb-0.5")} />
          <p className={cn("text-xs text-muted-foreground", isMobile && "text-[0.6rem]")}>Pago</p>
          <p className={cn("text-sm font-bold text-success", isMobile && "text-xs")}>{formatCurrency(totalPaid)}</p>
        </div>
        {/* Pendente */}
        <div className={cn("flex flex-col items-center justify-center flex-1", isMobile && "p-0.5")}>
          <DynamicIcon name="Circle" className={cn("h-5 w-5 text-destructive mb-1", isMobile && "h-4 w-4 mb-0.5")} />
          <p className={cn("text-xs text-muted-foreground", isMobile && "text-[0.6rem]")}>Pendente</p>
          <p className={cn("text-sm font-bold text-destructive", isMobile && "text-xs")}>{formatCurrency(totalPending)}</p>
        </div>
        {/* Total Fatura */}
        <div className={cn("flex flex-col items-center justify-center flex-1", isMobile && "p-0.5")}>
          <DynamicIcon name="CreditCard" className={cn("h-5 w-5 text-foreground mb-1", isMobile && "h-4 w-4 mb-0.5")} />
          <p className={cn("text-xs text-muted-foreground", isMobile && "text-[0.6rem]")}>Total Fatura</p>
          <p className={cn("text-sm font-bold text-foreground", isMobile && "text-xs")}>{formatCurrency(totalCardExpenses)}</p>
        </div>

        {/* Badge (agora ao lado dos valores) */}
        <div className={cn(
          "flex flex-col items-end text-right gap-0 flex-none", // Adicionado flex-none para que o badge não cresça
          isMobile && "items-center text-center"
        )}>
          <span className={cn(
            "text-xs font-bold uppercase text-primary px-2 py-0.5 rounded-md",
            isMobile && "text-[0.6rem] px-1.5 py-0.5"
          )}>
            {formattedBadgeMonth}
          </span>
          {formattedDueDate && (
            <span className={cn(
              "text-[10px] text-muted-foreground leading-none mt-[2px]",
              isMobile && "text-[0.5rem] mt-[1px]"
            )}>
              Venc. {formattedDueDate}
            </span>
          )}
        </div>
      </div>

      {/* Botão "Pagar Fatura" isolado abaixo e centralizado */}
      <div className={cn("flex justify-center mt-3", isMobile && "mt-2")}>
        <Button
          variant="secondary"
          onClick={onPayInvoice}
          className={cn("rounded-xl", isMobile ? "w-auto max-w-[150px] h-8 px-2 text-xs" : "w-auto px-4")}
          disabled={loadingPayInvoice || disablePayInvoiceButton}
        >
          <DynamicIcon name="CreditCard" className="mr-2 h-4 w-4" />
          {loadingPayInvoice ? "Pagando..." : "Pagar Fatura"}
        </Button>
      </div>
    </Card>
  );
};