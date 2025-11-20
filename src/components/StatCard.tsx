import { Card } from "@/components/ui/card";
import DynamicIcon from "./DynamicIcon"; // Importar DynamicIcon
import { cn } from "@/lib/utils"; // Importar cn para classes condicionais
import { Button } from "@/components/ui/button"; // Importar Button para o toggle

interface StatCardProps {
  title: string;
  value: string;
  icon: string; // Alterado para string para usar DynamicIcon
  trend?: string;
  variant: "income" | "expense" | "balance";
  children?: React.ReactNode; // Adicionado a prop children
  isMobile?: boolean; // Adicionado a prop isMobile
  showValue?: boolean; // Nova prop para controlar a visibilidade do valor
  onToggleVisibility?: () => void; // Nova prop para a função de alternância
  childrenAlignment?: "start" | "end" | "center"; // Nova prop para alinhamento dos filhos
  headerContent?: React.ReactNode; // NOVA PROP: Conteúdo para o cabeçalho (top-right)
}

export const StatCard = ({ 
  title, 
  value, 
  icon, 
  trend, 
  variant, 
  children, 
  isMobile, 
  showValue = true, 
  onToggleVisibility,
  childrenAlignment = "end", // Padrão para 'end'
  headerContent // NOVA PROP
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
      "transition-all duration-300 hover:shadow-lg animate-fade-in rounded-xl", // Adicionado rounded-xl
      variantStyles[variant]
    )}>
      <div className="flex items-start justify-between">
        <div className={cn(contentSpacingClass)}> {/* Apply conditional spacing here */}
          <p className={cn(titleFontSizeClass, "font-medium text-muted-foreground")}>{title}</p>
          <div className="flex items-center gap-2">
            <p className={cn(valueFontSizeClass, "font-bold tracking-tight", valueColorClass)}>
              {showValue ? value : "R$ *****"}
            </p>
            {isMobile && onToggleVisibility && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggleVisibility}
                className="h-5 w-5 text-muted-foreground hover:text-foreground" // Botão de toggle menor
              >
                <DynamicIcon name={showValue ? "EyeOff" : "Eye"} className="h-3.5 w-3.5" /> {/* Ícone menor */}
              </Button>
            )}
          </div>
          {trend && (
            <p className="text-xs text-muted-foreground">{trend}</p>
          )}
        </div>
        {/* NEW: Container for header content and main icon */}
        <div className="flex items-center gap-2"> {/* Added gap-2 for spacing between badge and icon */}
          {headerContent && (
            <div className={cn(isMobile ? "mt-0.5" : "mt-0")}> {/* Adjust margin for mobile if needed */}
              {headerContent}
            </div>
          )}
          <div className={`p-1 rounded-xl ${iconStyles[variant]}`}> {/* Reduzido de p-1.5 para p-1 */}
            <DynamicIcon name={icon} className={iconSizeClass} /> {/* Aplica o tamanho do ícone condicional */}
          </div>
        </div>
      </div>
      {children && (
        <div className={cn(
          "flex mt-1", 
          childrenAlignment === "start" && "justify-start",
          childrenAlignment === "end" && "justify-end",
          childrenAlignment === "center" && "justify-center",
          isMobile && "mt-1"
        )}>
          {children}
        </div>
      )}
    </Card>
  );
};