import { Card } from "@/components/ui/card";
import DynamicIcon from "./DynamicIcon";
import { cn, formatCurrency } from "@/lib/utils";

interface StatCardProps {
  // Renamed existing props for clarity and flexibility
  mainStatTitle: string;
  mainStatValue: number;
  
  // New props for an optional secondary stat block (like "Pago este mês")
  secondaryStatTitle?: string;
  secondaryStatValue?: number;

  // Existing props, adjusted
  icon?: string; // Make icon optional, as it might be hidden
  variant: "income" | "expense" | "balance";
  trend?: string; // Still for main stat
  
  // Content for the top-right corner (e.g., MonthBadge)
  topRightContent?: React.ReactNode; 
  
// Option to hide the main icon (e.g., when topRightContent is present and icon is not desired)
  hideMainIcon?: boolean; 

  children?: React.ReactNode; // For buttons
  chartContent?: React.ReactNode; // For charts
  isMobile?: boolean;
  childrenAlignment?: "start" | "end" | "center";
}

export const StatCard = ({ 
  mainStatTitle, 
  mainStatValue, 
  secondaryStatTitle, 
  secondaryStatValue,
  icon, // Now optional
  variant, 
  trend, 
  topRightContent, 
  hideMainIcon = false, // Default to false
  children, 
  chartContent, 
  isMobile, 
  childrenAlignment = "end", 
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

  const cardPaddingClass = isMobile ? "p-1.5" : "p-6";
  const titleFontSizeClass = isMobile ? "text-xs" : "text-sm";
  const valueFontSizeAndWeightClass = isMobile ? "text-base font-medium" : "text-3xl font-bold"; 
  const iconSizeClass = isMobile ? "h-3.5 w-3.5" : "h-6 w-6";
  const mainValueColorClass = isMobile
    ? variant === "income"
      ? "text-success"
      : variant === "expense"
        ? "text-destructive"
        : "text-secondary"
    : "text-foreground";

  const contentSpacingClass = isMobile ? "space-y-0.5" : "space-y-1";

  return (
    <Card className={cn(
      cardPaddingClass,
      "transition-all duration-300 hover:shadow-lg animate-fade-in rounded-xl flex flex-col h-full relative", // Adicionado 'relative' aqui
      isMobile && "min-h-[110px]",
      variantStyles[variant]
    )}>
      <div className="flex items-start justify-between">
        {/* Left and Middle Stats Container */}
        <div className="flex items-start gap-4"> {/* Adjusted gap for spacing between stat blocks */}
          {/* Main Stat Block */}
          <div className={cn("flex flex-col items-start", contentSpacingClass)}>
            <p className={cn(titleFontSizeClass, "font-semibold text-muted-foreground", "font-roboto")}>{mainStatTitle}</p>
            <p className={cn(valueFontSizeAndWeightClass, "tracking-tight", mainValueColorClass)}>
              {formatCurrency(mainStatValue)}
            </p>
            {trend && (
              <p className={cn("text-xs text-muted-foreground", "font-roboto")}>{trend}</p>
            )}
          </div>

          {/* Secondary Stat Block (e.g., "Pago este mês") */}
          {secondaryStatTitle && secondaryStatValue !== undefined && (
            <div className={cn("flex flex-col items-start", contentSpacingClass)}>
              <p className={cn(titleFontSizeClass, "font-semibold text-muted-foreground", "font-roboto")}>{secondaryStatTitle}</p>
              <p className={cn(
                valueFontSizeAndWeightClass, // Usando a classe unificada
                "tracking-tight", 
                // Conditional color for secondary stat value
                secondaryStatTitle === "Pago este mês" ? "text-success" : 
                (secondaryStatTitle === "Saldo Atual" ? "text-primary" : "text-foreground") // Alterado para text-primary
              )}>
                {formatCurrency(secondaryStatValue)}
              </p>
            </div>
          )}
        </div>

        {/* Right Section: Top-right content (MonthBadge) */}
        <div className={cn("flex items-start gap-2", isMobile && "flex-row-reverse")}> {/* Alterado items-center para items-start */}
          {topRightContent && (
            <div className={cn(isMobile && "mr-1")}> {/* Removido mt-0.5 */}
              {topRightContent}
            </div>
          )}
          {/* REMOVIDO: O ícone principal não é mais renderizado aqui */}
        </div>
      </div>
      {chartContent && (
        <div className={cn("mt-2", isMobile && "mt-1")}>
          {chartContent}
        </div>
      )}
      {children && (
        <div className={cn(
          "flex mt-auto",
          childrenAlignment === "start" && "justify-start",
          childrenAlignment === "end" && "justify-end",
          childrenAlignment === "center" && "justify-center",
          isMobile && "mt-2"
        )}>
          {children}
        </div>
      )}

      {/* NOVO: Ícone principal na parte inferior esquerda */}
      {!hideMainIcon && icon && (
        <div className={cn(
          `absolute rounded-xl`,
          iconStyles[variant],
          isMobile ? "bottom-2 left-2 p-1" : "bottom-4 left-4 p-2" // Ajuste de padding e posição para mobile/desktop
        )}>
          <DynamicIcon name={icon} className={cn(isMobile ? "h-4 w-4" : "h-6 w-6")} /> {/* Ajuste de tamanho do ícone */}
        </div>
      )}
    </Card>
  );
};