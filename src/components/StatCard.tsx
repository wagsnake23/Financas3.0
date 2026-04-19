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
  secondaryStatContent?: React.ReactNode; // NEW: Custom content for secondary stat
  bottomRightContent?: React.ReactNode; // NEW: Content for bottom-right corner matching bottom-left alignment
  glass?: boolean; // NEW: Glassmorphism style
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
  secondaryStatContent, // Destructure new prop
  bottomRightContent, // Destructure new prop
  glass = false, // Destructure new prop
}: StatCardProps) => {
  const premiumStyles = {
    income: {
      background: "linear-gradient(135deg, #f4f8f6 0%, #edf4f0 60%, rgba(34, 197, 94, 0.10) 100%)",
      outline: "1px solid rgba(34, 197, 94, 0.08)",
      shadow: "inset 0 1px 0 rgba(255,255,255,0.6), inset 0 -8px 20px rgba(0,0,0,0.03), inset 0 0 18px rgba(34, 197, 94, 0.12)",
      titleColor: "#16a34a"
    },
    expense: {
      background: "linear-gradient(135deg, #f8f6f6 0%, #f1eeee 60%, rgba(255, 59, 48, 0.10) 100%)",
      outline: "1px solid rgba(255, 59, 48, 0.08)",
      shadow: "inset 0 1px 0 rgba(255,255,255,0.6), inset 0 -8px 20px rgba(0,0,0,0.03), inset 0 0 18px rgba(255, 59, 48, 0.12)",
      titleColor: "#dc2626"
    },
    balance: {
      background: "linear-gradient(135deg, #f8fafc 0%, #eef2f7 60%, rgba(0, 102, 255, 0.08) 100%)",
      outline: "1px solid rgba(0, 102, 255, 0.08)",
      shadow: "inset 0 1px 0 rgba(255,255,255,0.6), inset 0 -8px 20px rgba(0,0,0,0.03), inset 0 0 18px rgba(0, 102, 255, 0.10)",
      titleColor: "#2563eb"
    },
    yield: {
      background: "linear-gradient(135deg, #f8f6ff 0%, #f0ebff 60%, rgba(147, 51, 234, 0.12) 100%)",
      outline: "1px solid rgba(147, 51, 234, 0.08)",
      shadow: "inset 0 1px 0 rgba(255,255,255,0.6), inset 0 -8px 20px rgba(0,0,0,0.03), inset 0 0 18px rgba(147, 51, 234, 0.12)",
      titleColor: "hsl(var(--yield-darker))"
    }
  };

  const labelStyles = {
    income: "text-[hsl(var(--success-darker))]",
    expense: "text-[hsl(var(--destructive-darker))]",
    balance: "text-[hsl(var(--primary-darker))]",
    yield: "text-[hsl(var(--yield-darker))]",
  };

  const currentStyle = premiumStyles[variant];

  return (
    <Card
      id={id}
      style={{
        background: currentStyle.background,
        backgroundBlendMode: "soft-light",
        backdropFilter: "blur(6px)",
        border: "1px solid rgba(0,0,0,0.06)",
        outline: currentStyle.outline,
        boxShadow: currentStyle.shadow,
      }}
      className={cn(
        "transition-all duration-300 animate-fade-in flex flex-col relative overflow-hidden",
        isMobile ? "p-3 min-h-[140px]" : "p-6 h-full min-h-[200px]",
        className
      )}
    >
      {/* Top Section: Title/Value and Month Navigator */}
      <div className="flex justify-between items-start mb-1">
        <div className="flex flex-col">
          <h2 
            className={cn("font-[800] tracking-tight", isMobile ? "text-[12px]" : "text-[13px]")} 
            style={{ color: currentStyle.titleColor }}
          >
            {mainStatTitle}
          </h2>
          <p 
            className={cn("font-[800] tracking-tight leading-none", isMobile ? "text-[18px]" : "text-[20px]")} 
            style={{ 
              fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', 
              color: "rgba(17, 24, 39, 0.92)", 
              WebkitFontSmoothing: "antialiased" 
            }}
          >
            {isPercentage ? `${mainStatValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%` : formatCurrency(mainStatValue)}
          </p>
        </div>

        {topRightContent && (
          <div className="flex items-center -mr-2 mt-0">
            {topRightContent}
          </div>
        )}
      </div>

      {/* Middle Section: Trend */}
      {trend && (
        <p className={cn("text-[9px] md:text-[10px] font-bold opacity-80 mb-2", labelStyles[variant])}>
          {trend}
        </p>
      )}

      {/* Chart Content (100% Width) */}
      {chartContent && (
        <div className={cn(
          "w-full flex items-end mt-10 pointer-events-none",
          isMobile ? "h-[50px]" : "h-[70px]"
        )}>
          {chartContent}
        </div>
      )}

      {/* Bottom Section: Annual Totals and Secondary Stats */}
      <div className="mt-0.5 flex justify-between items-end min-h-[40px]">
        <div className="flex flex-col gap-2">
          {annualTotalValue !== undefined && (
            <div className="flex flex-col items-start">
              <span className="text-[10px] font-bold opacity-70 uppercase tracking-tighter" style={{ color: currentStyle.titleColor }}>
                {annualTotalLabel || "Total Anual"}
              </span>
              <span className="text-sm font-bold text-slate-700 leading-none">
                {formatCurrency(annualTotalValue)}
              </span>
            </div>
          )}

          {secondaryStatTitle && secondaryStatValue !== undefined && (
            <div className="flex flex-col items-start">
              <span className="text-[10px] font-bold opacity-70 uppercase tracking-tighter" style={{ color: currentStyle.titleColor }}>
                {secondaryStatTitle}
              </span>
              <span className="text-sm font-bold text-slate-700 leading-none">
                {formatCurrency(secondaryStatValue)}
              </span>
            </div>
          )}
        </div>

        {/* Buttons / Children */}
        {children && (
          <div className={cn("flex gap-2", childrenAlignment === "end" ? "justify-end" : "justify-start")}>
            {children}
          </div>
        )}
      </div>

      {/* Legacy Port Case */}
      {bottomRightContent && !chartContent && (
        <div className="absolute bottom-4 right-8">
          {bottomRightContent}
        </div>
      )}
    </Card>
  );
};

