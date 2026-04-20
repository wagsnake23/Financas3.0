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
  trend?: string; // Percentual de tendência (ex: "+12%" ou "-8%")
  trendIsPositive?: boolean; // NEW: Se a tendência é positiva (melhorar) ou negativa (piorar)

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
  annualTotalValue,
  annualTotalLabel,
  trendIsPositive, // NEW
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
      titleColor: "hsl(var(--yield-darker))",
      badgeBg: "bg-purple-600",
      badgeShadow: "shadow-[0_0_12px_rgba(147,51,234,0.4)]"
    }
  };

  const headerBadgeStyles = {
    income: "bg-green-100/50 text-green-600 border border-green-200",
    expense: "bg-red-100/50 text-red-600 border border-red-200",
    balance: "bg-blue-100/50 text-blue-600 border border-blue-200",
    yield: "bg-purple-100/50 text-purple-600 border border-purple-200",
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
      {/* Top Section: Trend, Title/Value and Month Navigator */}
      <div className="flex justify-between items-start mb-1">
        <div className="flex items-center gap-3">
          {/* Tendência integrada ao Header (Formato Vertical Pill Compacto) */}
          {trend && trend.includes('%') && (
            <div className={cn(
              "flex flex-col items-center justify-center py-1 px-1.5 rounded-xl text-[10px] font-bold leading-none min-w-[34px] gap-0.5 self-center",
              headerBadgeStyles[variant]
            )}>
              <DynamicIcon 
                name={trendIsPositive ? "TrendingUp" : "TrendingDown"} 
                className="h-3 w-3" 
                strokeWidth={3} 
              />
              <span className="mt-0.5">{trend.split(' ')[0]}</span>
            </div>
          )}

          <div className="flex flex-col gap-0.5">
            <h2 
              className={cn("font-[800] tracking-tight", isMobile ? "text-[12px]" : "text-[13px]")} 
              style={{ color: currentStyle.titleColor }}
            >
              {mainStatTitle}
            </h2>
            <p 
              className={cn("font-semibold text-slate-950 font-roboto leading-none", isMobile ? "text-sm" : "text-base")}
            >
              {isPercentage ? `${mainStatValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%` : formatCurrency(mainStatValue)}
            </p>
          </div>
        </div>

        {topRightContent && (
          <div className="flex items-center mt-0 ml-2">
            {topRightContent}
          </div>
        )}
      </div>

      {/* Middle Section: Trend Info (Legacy text position remains for other info if needed, but trend goes to badge) */}
      <div className="flex flex-col gap-1 mt-1">
        {trend && !trend.includes('%') && (
          <p className={cn("text-[9px] md:text-[10px] font-bold opacity-80 mb-2", labelStyles[variant])}>
            {trend}
          </p>
        )}
      </div>

      {/* Chart Content (100% Width) */}
      {chartContent && (
        <div className={cn(
          "w-full flex items-end mt-10 pointer-events-none",
          isMobile ? "h-[50px]" : "h-[70px]"
        )}>
          {chartContent}
        </div>
      )}

      {/* Bottom Section: Metrics Aligned at the Bottom */}
      <div className="mt-0.5 flex justify-between items-end min-h-[40px]">
        {/* Left Side: Secondary Stats & Children (Horizontal alignment for metrics) */}
        <div className="flex items-end gap-4">
          {secondaryStatValue !== undefined && (
            <div className="flex flex-col items-start gap-0.5">
              <p className={cn("font-medium leading-none font-roboto", isMobile ? "text-[11px]" : "text-[12px]", labelStyles[variant])}>
                {secondaryStatTitle}
              </p>
              <p className={cn("font-semibold text-slate-950 font-roboto leading-none", isMobile ? "text-sm" : "text-base")}>
                {formatCurrency(secondaryStatValue)}
              </p>
            </div>
          )}

          {children && (
            <div className={cn(
              "flex items-center gap-2",
              childrenAlignment === "start" ? "justify-start" : "justify-end"
            )}>
              {children}
            </div>
          )}
        </div>

        {/* Right Side: Annual Totals (Aligned at bottom) */}
        <div className="flex items-end">
          {annualTotalValue !== undefined && (
            <div className="flex flex-col items-end gap-0.5">
              <p className={cn("font-medium leading-none font-roboto", isMobile ? "text-[11px]" : "text-[12px]", labelStyles[variant])}>
                {annualTotalLabel || "Total Anual"}
              </p>
              <p className={cn("font-semibold text-slate-950 font-roboto leading-none", isMobile ? "text-sm" : "text-base")}>
                {formatCurrency(annualTotalValue)}
              </p>
            </div>
          )}
        </div>
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

