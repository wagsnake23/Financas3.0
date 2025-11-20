import React, { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { isValid } from "date-fns";
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
  const summary = useMemo(() => {
    if (valor === undefined || valor <= 0 || numeroParcelas <= 1 || !dataVencimento || !isValid(dataVencimento)) {
      return null;
    }

    const valorParcela = valor / numeroParcelas;
    return {
      totalInstallments: numeroParcelas,
      valuePerInstallment: valorParcela,
    };
  }, [valor, numeroParcelas, dataVencimento]);

  if (!summary) {
    return null;
  }

  return (
    <Card className={cn(
      "p-3 animate-fade-in rounded-xl shadow-sm bg-soft-blue/20 border border-soft-blue flex flex-col gap-2", // Alterado para flex-col e gap-2
      isMobile && "p-2"
    )}>
      <div className="flex items-center gap-2"> {/* Novo div para o título e ícone */}
        <DynamicIcon name="💳" className={cn("h-5 w-5", isMobile && "h-4 w-4")} /> {/* Ícone de emoji de cartão de crédito */}
        <h3 className={cn("font-semibold text-primary", isMobile && "text-sm")}>Pré-visualização das Parcelas</h3>
      </div>
      <div className="flex items-center justify-center gap-2"> {/* Conteúdo original centralizado */}
        <DynamicIcon name="CreditCard" className={cn("h-5 w-5 text-primary", isMobile && "h-4 w-4")} />
        <p className={cn("font-semibold text-primary", isMobile && "text-sm")}>
          {summary.totalInstallments}x de R$ {summary.valuePerInstallment.toFixed(2)}
        </p>
      </div>
    </Card>
  );
};