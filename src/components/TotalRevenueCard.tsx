import { Card } from "@/components/ui/card";
import { Tables } from "@/integrations/supabase/types";
import DynamicIcon from "./DynamicIcon";
import { cn } from "@/lib/utils"; // Importar cn

interface TotalRevenueCardProps {
  revenues: Tables<'receitas'>[];
  isMobile?: boolean; // Adicionar prop isMobile
}

export const TotalRevenueCard = ({ revenues, isMobile }: TotalRevenueCardProps) => {
  const totalIncome = revenues
    .filter(r => !r.is_fixed) // Filter out legacy fixed revenues
    .reduce((sum, r) => sum + r.valor, 0);

  return (
    <Card className={cn(
      "p-6 bg-gradient-to-br from-success/10 to-success/5 border-success/20 animate-fade-in rounded-xl shadow-sm",
      isMobile ? "p-4 h-24" : "h-auto" // Ajustar padding e altura para mobile
    )}>
      <div className="flex items-center justify-between">
        <div>
          <p className={cn("text-sm text-muted-foreground mb-1", isMobile && "text-xs")}>Total de Receitas</p>
          <p className={cn("text-3xl font-bold text-foreground", isMobile && "text-xl")}>R$ {totalIncome.toFixed(2)}</p>
        </div>
        <DynamicIcon name="DollarSign" className={cn("h-12 w-12 text-success", isMobile && "h-8 w-8")} /> {/* Ajustar tamanho do ícone */}
      </div>
    </Card>
  );
};