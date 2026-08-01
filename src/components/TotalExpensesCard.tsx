import { Card } from "@/components/ui/card";
import DynamicIcon from "./DynamicIcon";
import { Tables } from "@/integrations/supabase/types";
import { cn, formatCurrency } from "@/lib/utils"; // Importar formatCurrency

interface TotalExpensesCardProps {
  expenseInstallments: (Tables<'despesas_parcelas'> & { despesas: Pick<Tables<'despesas'>, 'categoria_id'> | null })[];
  isMobile?: boolean;
  chartContent?: React.ReactNode;
  annualTotalValue?: number;
  annualTotalLabel?: string;
}

export const TotalExpensesCard = ({
  expenseInstallments,
  isMobile,
  chartContent,
  annualTotalValue,
  annualTotalLabel,
}: TotalExpensesCardProps) => {
  const totalOverallExpenses = expenseInstallments
    .reduce((sum, p) => sum + p.valor_parcela, 0);

  return (
    <Card className={cn(
      "p-6 animate-fade-in rounded-3xl card-3d bg-soft-red-background flex flex-col relative",
      isMobile ? "p-4 min-h-[96px]" : "h-full min-h-[200px]"
    )}>
      <div className="flex items-start justify-between">
        <div>
          <p className={cn("text-sm font-semibold text-muted-foreground mb-1", isMobile && "text-xs", "font-roboto")}>Total Geral de Despesas</p>
          <p className={cn("text-3xl font-bold text-destructive", isMobile && "text-xl", "font-roboto")}>{formatCurrency(totalOverallExpenses)}</p>
        </div>
      </div>

      {chartContent && (
        <div className="mt-4 flex-grow">
          {chartContent}
        </div>
      )}

      <div className={cn(
        "flex items-center gap-2",
        isMobile ? "absolute bottom-2 left-2" : "mt-4"
      )}>
        <div className={cn(
          "rounded-xl bg-destructive/10 p-2 text-destructive",
          isMobile ? "p-1" : "p-2"
        )}>
          <DynamicIcon name="CreditCard" className={cn(isMobile ? "h-4 w-4" : "h-6 w-6")} />
        </div>

        {annualTotalValue !== undefined && (
          <div className="flex flex-col">
            <p className="text-xs text-muted-foreground leading-none font-roboto">{annualTotalLabel || "Total Anual"}</p>
            <p className="text-sm font-bold text-destructive font-roboto">{formatCurrency(annualTotalValue)}</p>
          </div>
        )}
      </div>
    </Card>
  );
};