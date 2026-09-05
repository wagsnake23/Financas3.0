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
      "p-6 animate-fade-in rounded-3xl flex flex-col relative overflow-hidden",
      isMobile ? "p-4 min-h-[96px]" : "h-full min-h-[200px]"
    )}
    style={{
      background: "radial-gradient(circle at top right, rgba(255,255,255,.85), transparent 60%), linear-gradient(135deg, rgba(239,68,68,.06) 0%, rgba(239,68,68,.10) 35%, rgba(239,68,68,.05) 70%, transparent 100%), #FFF5F5",
      border: "1px solid rgba(255,255,255,0.85)",
      backgroundClip: "padding-box",
      outline: "none",
      boxShadow: "0 8px 24px rgba(239,68,68,0.06), 0 2px 6px rgba(239,68,68,0.03), inset 0 1px 0 rgba(255,255,255,.95)"
    }}>
      {/* Formas orgânicas temáticas de fundo */}
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none overflow-hidden rounded-3xl" style={{ zIndex: 0 }}>
        <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox={isMobile ? "0 0 400 180" : "0 0 500 220"}>
          <defs>
            <linearGradient id={isMobile ? "wave-grad-total-exp-mob" : "wave-grad-total-exp-desk"} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.75" />
              <stop offset="100%" stopColor="#FFFFFF" stopOpacity={isMobile ? "0.15" : "0.12"} />
            </linearGradient>
          </defs>
          {/* Curva suave superior */}
          <path d={isMobile ? "M 60,0 C 150,55 240,65 380,15 L 400,0 Z" : "M 80,0 C 180,60 300,75 480,20 L 500,0 Z"} fill="rgba(255,255,255,0.5)" />
          {/* Onda orgânica inferior */}
          <path d={isMobile ? "M 0,180 Q 120,115 220,135 T 400,85 L 400,180 Z" : "M 0,220 Q 150,135 280,165 T 500,105 L 500,220 Z"} fill={`url(#${isMobile ? "wave-grad-total-exp-mob" : "wave-grad-total-exp-desk"})`} />
        </svg>
      </div>

      <div className="flex flex-col h-full w-full justify-between relative z-20">
        <div className="flex items-start justify-between">
          <div>
            <p className={cn("text-sm text-muted-foreground mb-1", isMobile && "text-xs", "font-roboto")} style={{ fontWeight: 700 }}>Total Geral de Despesas</p>
            <p className={cn("text-3xl text-destructive", isMobile && "text-xl", "font-roboto")} style={{ fontWeight: 800, letterSpacing: "-0.02em" }}>{formatCurrency(totalOverallExpenses)}</p>
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
            "rounded-xl bg-destructive/10 p-2 text-destructive flex items-center justify-center",
            isMobile ? "p-1" : "p-2"
          )}
          style={{
            border: "1px solid rgba(255,255,255,.80)",
            backdropFilter: "blur(6px)",
            boxShadow: "0 2px 6px rgba(0,0,0,.04)"
          }}>
            <DynamicIcon name="CreditCard" className={cn(isMobile ? "h-4 w-4" : "h-6 w-6")} />
          </div>

          {annualTotalValue !== undefined && (
            <div className="flex flex-col">
              <p className="text-xs text-muted-foreground leading-none font-roboto" style={{ fontWeight: 700 }}>{annualTotalLabel || "Total Anual"}</p>
              <p className="text-sm text-destructive font-roboto" style={{ fontWeight: 800, letterSpacing: "-0.02em" }}>{formatCurrency(annualTotalValue)}</p>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};
