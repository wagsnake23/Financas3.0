import { Card } from "@/components/ui/card";
import DynamicIcon from "./DynamicIcon"; // Importar DynamicIcon
import { cn, formatCurrency } from "@/lib/utils"; // Importar cn e formatCurrency
import { Button } from "@/components/ui/button"; // Importar Button para o toggle

interface StatCardProps {
  title: string;
  value: number; // Alterado para number
  icon: string; // Alterado para string para usar DynamicIcon
  trend?: string;
  variant: "income" | "expense" | "balance";
  children?: React.ReactNode; // Adicionado a prop children (for buttons)
  chartContent?: React.ReactNode; // NEW: Prop for chart content
  isMobile?: boolean; // Adicionado a prop isMobile
  childrenAlignment?: "start" | "end" | "center"; // Nova prop para alinhamento dos filhos
  headerContent?: React.ReactNode; // NOVA PROP: Conteúdo para o cabeçalho (top-right)
  secondaryStat?: React.ReactNode; // NEW: Prop for a secondary stat next to the main value
}

export const StatCard = ({ 
  title, 
  value, // Agora é um número
  icon, 
  trend, 
  variant, 
  children, 
  chartContent, // NEW: Destructure chartContent
  isMobile, 
  childrenAlignment = "end", // Padrão para 'end'
  headerContent, // NOVA PROP
  secondaryStat, // NEW: Destructure secondaryStat
}: StatCardProps) => {
  const variantStyles = {
    income: "bg-gradient-to-br from-success/10 to-success/5 border-success/20",
    expense: "bg-gradient-to-br from-destructive/10 to-destructive/5 border-destructive/20",
    balance: "bg-gradient-to-br from-secondary/10 to-secondary/5 border-secondary/20",
  };

  const iconStyles = {
    income: "bg-success/10 text-success",
    expense: "bg-destructive/10 text-destructive",
    balance: "bg-secondary/10 text-secondary",
  };

  // Classes condicionais para mobile
  const cardPaddingClass = isMobile ? "p-1.5" : "p-6"; // Diminui o padding em mobile (de p-2 para p-1.5)
  const titleFontSizeClass = isMobile ? "text-[0.65rem]" : "text-sm"; // Diminui a fonte do título em mobile
  const valueFontSizeClass = isMobile ? "text-base" : "text-3xl"; // Diminui o tamanho da fonte do valor em mobile (de text-lg para text-base)
  const iconSizeClass = isMobile ? "h-3.5 w-3.5" : "h-6 w-6"; // Diminui o tamanho do ícone em mobile (de h-4 w-4 para h-3.5 w-3.5)
  const valueColorClass = isMobile
    ? variant === "income"
      ? "text-success" // Verde para receitas em mobile
      : variant === "expense"
        ? "text-destructive" // Vermelho para despesas em mobile
        : "text-secondary" // Cor secundária para saldo em mobile
    : "text-foreground"; // Cor padrão para desktop

  // NEW: Conditional spacing for mobile
  const contentSpacingClass = isMobile ? "space-y-0.5" : "space-y-1"; // Reduced spacing for mobile

  return (
    <Card className={cn(
      cardPaddingClass, // Aplica o padding condicional
      "transition-all duration-300 hover:shadow-lg animate-fade-in rounded-xl flex flex-col h-full", // Adicionado flex flex-col h-full
      isMobile && "min-h-[110px]", // Altura mínima para mobile - ALTERADO DE 140px PARA 110px
      variantStyles[variant]
    )}>
      <div className="flex items-start justify-between">
        <div className={cn(contentSpacingClass)}> {/* Apply conditional spacing here */}
          <p className={cn(titleFontSizeClass, "font-medium text-muted-foreground")}>{title}</p>
          <div className="flex items-baseline gap-2"> {/* Use items-baseline to align text baselines */}
            <p className={cn(valueFontSizeClass, "font-bold tracking-tight", valueColorClass)}>
              {formatCurrency(value)}
            </p>
            {secondaryStat && ( // Render secondary stat here
              <span className={cn(isMobile ? "text-xs" : "text-sm", "text-muted-foreground")}>
                {secondaryStat}
              </span>
            )}
          </div>
          {trend && (
            <p className="text-xs text-muted-foreground">{trend}</p>
          )}
        </div>
        {/* NEW: Container for header content and main icon */}
        <div className={cn("flex items-center gap-2", isMobile && "flex-row-reverse")}> {/* Added flex-row-reverse for mobile */}
          {headerContent && (
            <div className={cn(isMobile && "mt-0.5 mr-1")}> {/* Adjust margin for mobile if needed, add mr-1 */}
              {headerContent}
            </div>
          )}
          <div className={`p-1 rounded-xl ${iconStyles[variant]}`}> {/* Reduzido de p-1.5 para p-1 */}
            <DynamicIcon name={icon} className={iconSizeClass} /> {/* Aplica o tamanho do ícone condicional */}
          </div>
        </div>
      </div>
      {chartContent && ( // NEW: Render chartContent if provided
        <div className={cn("mt-2", isMobile && "mt-1")}> {/* Adjust margin for chart */}
          {chartContent}
        </div>
      )}
      {children && (
        <div className={cn(
          "flex mt-auto", // Usar mt-auto para empurrar para o final
          childrenAlignment === "start" && "justify-start",
          childrenAlignment === "end" && "justify-end",
          childrenAlignment === "center" && "justify-center",
          isMobile && "mt-2" // Ajustar margem superior para mobile
        )}>
          {children}
        </div>
      )}
    </Card>
  );
};