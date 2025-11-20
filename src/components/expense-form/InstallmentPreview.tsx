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
      "p-3 animate-fade-in rounded-xl shadow-sm bg-soft-blue/20 border border-soft-blue flex flex-col gap-2",
      isMobile && "p-2"
    )}>
      {/* Título centralizado e menor */}
      <h3 className={cn("text-center text-sm text-muted-foreground", isMobile && "text-xs")}>
        Pré-visualização das Parcelas
      </h3>
      <div className="flex items-center justify-center gap-1"> {/* Conteúdo original centralizado, gap menor */}
        <DynamicIcon name="💳" className={cn("h-6 w-6", isMobile && "h-5 w-5")} /> {/* Aumentado o tamanho do ícone */}
        <p className={cn("font-semibold text-primary", isMobile && "text-sm")}>
          {summary.totalInstallments}x de R$ {summary.valuePerInstallment.toFixed(2)}
        </p>
      </div>
    </Card>
  );
};