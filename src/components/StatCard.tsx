import { Card } from "@/components/ui/card";
import DynamicIcon from "./DynamicIcon";
import { cn, formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button"; // Import Button

// NEW IMPORT
import { MonthNavigatorCompact } from "./MonthNavigatorCompact"; // Updated import

interface StatCardProps {
  // Renamed existing props for clarity and flexibility
  mainStatTitle: string;
  mainStatValue: number;

  // New props for an optional secondary stat block (like "Pago este mês")
  secondaryStatTitle?: string;
  secondaryStatValue?: number;

  // Existing props, adjusted
  icon?: string; // Make icon optional, as it might be hidden
  variant: "income" | "expense" | "balance" | "yield";
  trend?: string; // Still for main stat

  // Content for the top-right corner (e.g., MonthBadge or MonthNavigatorCompact)
  topRightContent?: React.ReactNode;

  // Option to hide the main icon (e.g., when topRightContent is present and icon is not desired)
  hideMainIcon?: boolean;

  children?: React.ReactNode; // For buttons
  chartContent?: React.ReactNode; // For charts
  isMobile?: boolean;
  childrenAlignment?: "start" | "end" | "center";
  // Removed onNextMonth prop as it will be handled by MonthNavigatorCompact
  annualTotalValue?: number; // NEW: Prop for the annual total value
  annualTotalLabel?: string; // NEW: Prop for the annual total label (e.g., "Total Anual")
  neumorphism?: boolean; // NEW PROP for Neumorphism style
  id?: string; // NEW: Prop for accessibility and scrolling
  isPercentage?: boolean; // NEW: Prop to display value as percentage
  className?: string; // NEW: Custom class name
  forceTransparentBackground?: boolean; // NEW: Force transparent background
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
  annualTotalValue, // Destructure new prop
  annualTotalLabel, // Destructure new prop
  neumorphism = false, // Default to false
  id, // Destructure new prop
  isPercentage = false,
  className,
  forceTransparentBackground = false,
}: StatCardProps) => {
  const variantStyles = {
    // MODIFIED: Reduced opacity for a lighter, softer background
    income: "bg-gradient-to-br from-success/8 to-success/4 border-success/20",
    expense:
      "bg-gradient-to-br from-destructive/8 to-destructive/4 border-destructive/20",
    balance:
      "bg-gradient-to-br from-secondary/8 to-secondary/4 border-secondary/20",
    yield:
      "bg-gradient-to-br from-yield/8 to-yield/4 border-yield/20",
  };

  const iconStyles = {
    income: "bg-success/10 text-success",
    expense: "bg-destructive/10 text-destructive",
    balance: "bg-secondary/10 text-secondary",
    yield: "bg-yield/10 text-yield",
  };

  // 🔹 NOVO: mapa de cores de fundo, sem remover nada do seu código
  const backgroundColors: Record<StatCardProps["variant"], string> = {
    income: "#F2FFFB", // Verde água ainda mais claro
    expense: "#FFF7F8", // Rosa ainda mais claro
    balance: "#F0F7FF", // Azul bem claro
    yield: "#FFF8F1", // Laranja bem claro
  };

  const cardPaddingClass = isMobile ? "p-1.5" : "p-6";
  const titleFontSizeClass = isMobile ? "text-xs" : "text-sm";
  // Removido valueFontSizeAndWeightClass e mainValueColorClass para aplicar diretamente
  const contentSpacingClass = isMobile ? "space-y-0" : "space-y-0.5"; // Adjusted spacing here

  return (
    <Card
      id={id}
      // 🔹 NOVO: apenas cor de fundo controlada aqui
      style={{
        backgroundColor: forceTransparentBackground ? "transparent" : (backgroundColors[variant] || undefined),
      }}
      className={cn(
        cardPaddingClass,
        "transition-all duration-300 animate-fade-in flex flex-col h-full relative", // Adicionado 'relative' aqui
        isMobile && "min-h-[90px]", // Reduzido de 110px para 90px
        variantStyles[variant],
        neumorphism
          ? cn(
            "rounded-3xl",
            "shadow-[inset_2px_2px_4px_rgba(0,0,0,0.05),_inset_-2px_-2px_4px_rgba(255,255,255,0.7)]"
          )
          : cn("rounded-xl shadow-sm"),
        className
      )}
    >
      {/* Top-right content (MonthNavigatorCompact or MonthBadge) */}
      {topRightContent && (
        <div
          className={cn(
            "absolute top-2 right-2", // Posiciona absolutamente no canto superior direito
            isMobile ? "top-1 right-1" : "top-2 right-2" // Ajusta para mobile
          )}
        >
          {topRightContent}
        </div>
      )}

      <div className="flex items-start justify-between">
        {/* Left and Middle Stats Container */}
        <div className="flex items-start gap-4">
          {" "}
          {/* Adjusted gap for spacing between stat blocks */}
          {/* Main Stat Block */}
          <div
            className={cn(
              "flex flex-col items-start pl-2 pt-1",
              contentSpacingClass
            )}
          >
            <p
              className={cn(
                titleFontSizeClass,
                "font-semibold text-muted-foreground",
                "font-roboto"
              )}
            >
              {mainStatTitle}
            </p>
            <p
              className={cn(
                "font-bold leading-none",
                isMobile ? "text-sm" : "text-base", // Tamanho e peso consistentes
                variant === "income"
                  ? "text-success"
                  : variant === "expense"
                    ? "text-destructive"
                    : variant === "yield"
                      ? "text-yield"
                      : mainStatValue >= 0 ? "text-primary" : "text-destructive", // Conditional for balance: blue if positive
                "font-roboto" // Fonte Roboto
              )}
            >
              {isPercentage ? `${mainStatValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%` : formatCurrency(mainStatValue)}
            </p>
            {trend && (
              <p className={cn("text-xs text-muted-foreground", "font-roboto")}>
                {trend}
              </p>
            )}
          </div>
          {/* Secondary Stat Block (e.g., "Pago este mês") */}
          {secondaryStatTitle && secondaryStatValue !== undefined && (
            <div
              className={cn(
                "flex flex-col items-start pl-2 pt-1",
                contentSpacingClass
              )}
            >
              <p
                className={cn(
                  titleFontSizeClass,
                  "font-semibold text-muted-foreground",
                  "font-roboto"
                )}
              >
                {secondaryStatTitle}
              </p>
              <p
                className={cn(
                  "font-bold leading-none",
                  isMobile ? "text-sm" : "text-base", // Tamanho e peso consistentes
                  secondaryStatTitle === "Pago este mês" || secondaryStatTitle === "Receita Atual"
                    ? "text-success"
                    : variant === "yield"
                      ? "text-yield"
                      : (secondaryStatTitle === "Saldo Projetado" || secondaryStatTitle === "Saldo Atual" || secondaryStatTitle === "Saldo Anual")
                        ? (secondaryStatValue >= 0
                          ? (variant === "balance" ? "text-primary" : "text-success")
                          : "text-destructive")
                        : "text-primary", // Cor consistente
                  "font-roboto" // Fonte Roboto
                )}
              >
                {formatCurrency(secondaryStatValue)}
              </p>
            </div>
          )}
        </div>

        {/* Optional Icon as Badge (Top Right) - Only if no topRightContent and not mobile */}
        {!hideMainIcon && icon && !topRightContent && !isMobile && (
          <div className={cn("p-2 rounded-xl h-fit shadow-sm", iconStyles[variant])}>
            <DynamicIcon name={icon} className="h-6 w-6" />
          </div>
        )}
      </div>
      {chartContent && (
        <div className={cn("mt-2", isMobile && "mt-1")}>{chartContent}</div>
      )}
      {children && (
        <div
          className={cn(
            "flex mt-auto",
            childrenAlignment === "start" && "justify-start",
            childrenAlignment === "end" && "justify-end",
            childrenAlignment === "center" && "justify-center",
            isMobile && "mt-0" // Alterado de mt-1 para mt-0 aqui
          )}
        >
          {children}
        </div>
      )}

      {/* Bottom-left content (Icon + Annual Total) */}
      {(!hideMainIcon && icon) ||
        (annualTotalValue !== undefined && annualTotalLabel) ? (
        <div
          className={cn(
            "absolute flex items-center gap-2", // Use flex to align icon and text
            isMobile ? "bottom-2 left-[14px]" : "bottom-4 left-8"
          )}
        >
          {!hideMainIcon && icon && (topRightContent || isMobile) && (
            <div
              className={cn(
                `rounded-xl shadow-sm`,
                iconStyles[variant],
                isMobile ? "p-1" : "p-2"
              )}
            >
              <DynamicIcon
                name={icon}
                className={cn(isMobile ? "h-4 w-4" : "h-6 w-6")}
              />
            </div>
          )}
          {annualTotalValue !== undefined && annualTotalLabel && (
            <div className={cn("flex flex-col items-start")}>
              {/* Removido classes de texto aqui */}
              <p
                className={cn(
                  titleFontSizeClass,
                  "text-muted-foreground leading-none",
                  "font-roboto"
                )}
              >
                {annualTotalLabel}
              </p>
              {/* Aplicado titleFontSizeClass e text-muted-foreground */}
              <p
                className={cn(
                  "font-bold leading-none",
                  isMobile ? "text-sm" : "text-base", // Tamanho e peso consistentes
                  variant === "income" ? "text-success" :
                    variant === "expense" ? "text-destructive" :
                      variant === "yield" ? "text-yield" :
                        (annualTotalValue || 0) >= 0 ? "text-primary" : "text-destructive", // Conditional for balance: blue if positive
                  "font-roboto" // Fonte Roboto
                )}
              >
                {formatCurrency(annualTotalValue)}
              </p>
            </div>
          )}
        </div>
      ) : null}
    </Card>
  );
};
