import React, { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { format, addMonths, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import DynamicIcon from "@/components/DynamicIcon";

interface InstallmentPreviewProps {
  valor: number | undefined;
  numeroParcelas: number;
  dataVencimento: Date | undefined;
  isMobile: boolean;
}

export const InstallmentPreview: React.FC<InstallmentPreviewProps> = ({
  valor,
  numeroParcelas,
  dataVencimento,
  isMobile,
}) => {
  const installments = useMemo(() => {
    if (valor === undefined || valor <= 0 || numeroParcelas <= 1 || !dataVencimento || !isValid(dataVencimento)) {
      return [];
    }

    const valorParcela = valor / numeroParcelas;
    const generatedInstallments = [];

    for (let i = 0; i < numeroParcelas; i++) {
      const installmentDate = addMonths(dataVencimento, i);
      generatedInstallments.push({
        number: i + 1,
        value: valorParcela,
        dueDate: installmentDate,
      });
    }
    return generatedInstallments;
  }, [valor, numeroParcelas, dataVencimento]);

  if (installments.length === 0) {
    return null;
  }

  return (
    <Card className={cn("p-4 animate-fade-in rounded-xl shadow-sm bg-muted/20 border-dashed border-muted-foreground/30", isMobile && "p-3")}>
      <h3 className={cn("text-lg font-bold mb-3 text-center", isMobile && "text-base mb-2")}>
        Pré-visualização das Parcelas
      </h3>
      <ScrollArea className={cn("h-[150px]", isMobile && "h-[120px]")}>
        <div className="space-y-2 pr-2">
          {installments.map((installment) => (
            <div key={installment.number} className={cn("flex items-center justify-between p-2 rounded-md bg-background/50", isMobile && "p-1.5")}>
              <div className="flex items-center gap-2">
                <DynamicIcon name="CreditCard" className={cn("h-4 w-4 text-primary", isMobile && "h-3.5 w-3.5")} />
                <span className={cn("font-medium", isMobile && "text-sm")}>
                  Parcela {installment.number}/{numeroParcelas}
                </span>
              </div>
              <div className="text-right">
                <p className={cn("font-semibold text-destructive", isMobile && "text-sm")}>
                  R$ {installment.value.toFixed(2)}
                </p>
                <p className={cn("text-xs text-muted-foreground", isMobile && "text-[0.6rem]")}>
                  Venc: {format(installment.dueDate, "dd/MM/yyyy", { locale: ptBR })}
                </p>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </Card>
  );
};