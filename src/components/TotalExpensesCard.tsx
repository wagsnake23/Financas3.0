import { Card } from "@/components/ui/card";
import DynamicIcon from "./DynamicIcon";
import { Tables } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils"; // Importar cn

interface TotalExpensesCardProps {
  expenseInstallments: (Tables<'despesas_parcelas'> & { despesas: Pick<Tables<'despesas'>, 'categoria_id' | 'is_fixed'> | null })[];
  isMobile?: boolean; // Adicionar prop isMobile
}

export const TotalExpensesCard = ({ expenseInstallments, isMobile }: TotalExpensesCardProps) => {
  const totalOverallExpenses = expenseInstallments
    .filter(p => !p.despesas?.is_fixed) // Filter out legacy fixed expenses
    .reduce((sum, p) => sum + p.valor_parcela, 0);

  return (
    <Card className={cn("p-6 bg-gradient-to-br from-destructive/10 to-destructive/5 border-destructive/20 animate-fade-in", isMobile && "p-4")}> {/* Ajustar padding */}
      <div className="flex items-center justify-between">
        <div>
          <p className={cn("text-sm text-muted-foreground mb-1", isMobile && "text-xs")}>Total Geral de Despesas</p> {/* Ajustar tamanho da fonte */}
          <p className={cn("text-3xl font-bold text-foreground", isMobile && "text-xl")}>R$ {totalOverallExpenses.toFixed(2)}</p> {/* Ajustar tamanho da fonte (de text-2xl para text-xl) */}
        </div>
        <DynamicIcon name="CreditCard" className={cn("h-12 w-12 text-destructive", isMobile && "h-10 w-10")} /> {/* Ajustar tamanho do ícone */}
      </div>
    </Card>
  );
};