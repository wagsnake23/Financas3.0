import { Card } from "@/components/ui/card";
import { Tables } from "@/integrations/supabase/types";
import DynamicIcon from "./DynamicIcon";

interface TotalRevenueCardProps {
  revenues: Tables<'receitas'>[];
}

export const TotalRevenueCard = ({ revenues }: TotalRevenueCardProps) => {
  const totalIncome = revenues
    .filter(r => !r.is_fixed) // Filter out legacy fixed revenues
    .reduce((sum, r) => sum + r.valor, 0);

  return (
    <Card className="p-6 bg-gradient-to-br from-success/10 to-success/5 border-success/20 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground mb-1">Total de Receitas</p>
          <p className="text-3xl font-bold text-foreground">R$ {totalIncome.toFixed(2)}</p>
        </div>
        <DynamicIcon name="DollarSign" className="h-12 w-12 text-success" />
      </div>
    </Card>
  );
};