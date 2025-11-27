import { Card } from "@/components/ui/card";
import DynamicIcon from "./DynamicIcon";
import { Tables } from "@/integrations/supabase/types";
import { cn, formatCurrency } from "@/lib/utils"; // Importar formatCurrency

interface TotalExpensesCardProps {
  expenseInstallments: (Tables<'despesas_parcelas'> & { despesas: Pick<Tables<'despesas'>, 'categoria_id'> | null })[];
  isMobile?: boolean;
}

export const TotalExpensesCard = ({ expenseInstallments, isMobile }: TotalExpensesCardProps) => {
  const totalOverallExpenses = expenseInstallments
    .reduce((sum, p) => sum + p.valor_parcela, 0);

  return (
    <Card className={cn(
      "p-6 bg-gradient-to-br from-destructive/10 to-destructive/5 border-destructive/20 animate-fade-in rounded-xl shadow-sm", 
      isMobile ? "p-4 h-24" : "h-auto"
    )}>
      <div className="flex items-center justify-between">
        <div>
          <p className={cn("text-sm text-muted-foreground mb-1", isMobile && "text-xs", "font-roboto")}>Total Geral de Despesas</p>
          <p className={cn("text-3xl font-bold text-foreground", isMobile && "text-xl")}>{formatCurrency(totalOverallExpenses)}</p>
        </div>
        <DynamicIcon name="CreditCard" className={cn("h-12 w-12 text-destructive", isMobile && "h-8 w-8")} />
      </div>
    </Card>
  );
};