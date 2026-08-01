import { Card } from "@/components/ui/card";
import { Tables } from "@/integrations/supabase/types";
import DynamicIcon from "./DynamicIcon";
import { cn, formatCurrency } from "@/lib/utils"; // Importar formatCurrency

interface TotalRevenueCardProps {
  revenues: Tables<'receitas'>[];
  isMobile?: boolean;
  chartContent?: React.ReactNode;
  annualTotalValue?: number;
  annualTotalLabel?: string;
}

export const TotalRevenueCard = ({
  revenues,
  isMobile,
  chartContent,
  annualTotalValue,
  annualTotalLabel,
}: TotalRevenueCardProps) => {
  const totalIncome = revenues
    .reduce((sum, r) => sum + r.valor, 0);

  return (
    <Card className={cn(
      "p-6 animate-fade-in rounded-3xl card-3d bg-soft-green-background flex flex-col relative",
      isMobile ? "p-4 min-h-[96px]" : "h-full min-h-[200px]"
    )}>
      <div className="flex items-start justify-between">
        <div>
          <p className={cn("text-sm font-semibold text-muted-foreground mb-1", isMobile && "text-xs", "font-roboto")}>Total de Receitas</p>
          <p className={cn("text-3xl font-bold text-success", isMobile && "text-xl", "font-roboto")}>{formatCurrency(totalIncome)}</p>
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
          "rounded-xl bg-success/10 p-2 text-success",
          isMobile ? "p-1" : "p-2"
        )}>
          <DynamicIcon name="DollarSign" className={cn(isMobile ? "h-4 w-4" : "h-6 w-6")} />
        </div>

        {annualTotalValue !== undefined && (
          <div className="flex flex-col">
            <p className="text-xs text-muted-foreground leading-none font-roboto">{annualTotalLabel || "Total Anual"}</p>
            <p className="text-sm font-bold text-success font-roboto">{formatCurrency(annualTotalValue)}</p>
          </div>
        )}
      </div>
    </Card>
  );
};