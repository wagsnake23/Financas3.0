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
  dashboardPremiumStyle?: boolean; // NEW: Apply premium dashboard modern styles
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
  dashboardPremiumStyle = false, // Destructure new prop
}: StatCardProps) => {
  const premiumStyles = {
    income: {
      background: dashboardPremiumStyle ? "radial-gradient(circle at top right, rgba(255,255,255,.85), transparent 60%), linear-gradient(135deg, rgba(34,197,94,.20) 0%, rgba(34,197,94,.12) 35%, rgba(34,197,94,.06) 70%, transparent 100%), #F0FDF4" : "linear-gradient(135deg, rgba(34, 197, 94, 0.09) 0%, #FFFFFF 20%, #FFFFFF 80%, rgba(34, 197, 94, 0.09) 100%)",
      border: dashboardPremiumStyle ? "1px solid rgba(255, 255, 255, 0.85)" : "none",
      outline: dashboardPremiumStyle ? "none" : "1px solid rgba(34, 197, 94, 0.05)",
      shadow: dashboardPremiumStyle ? "0 8px 24px rgba(34,197,94,0.10), 0 2px 6px rgba(34,197,94,0.05), inset 0 1px 0 rgba(255,255,255,.95)" : "inset 0 1px 0 rgba(255,255,255,1), inset 0 -4px 12px rgba(0,0,0,0.01), inset 0 0 14px rgba(34, 197, 94, 0.09)",
      titleColor: "#16a34a"
    },
    expense: {
      background: dashboardPremiumStyle ? "radial-gradient(circle at top right, rgba(255,255,255,.85), transparent 60%), linear-gradient(135deg, rgba(239,68,68,.20) 0%, rgba(239,68,68,.12) 35%, rgba(239,68,68,.06) 70%, transparent 100%), #FEF2F2" : "linear-gradient(135deg, rgba(239, 68, 68, 0.09) 0%, #FFFFFF 20%, #FFFFFF 80%, rgba(239, 68, 68, 0.09) 100%)",
      border: dashboardPremiumStyle ? "1px solid rgba(255, 255, 255, 0.85)" : "none",
      outline: dashboardPremiumStyle ? "none" : "1px solid rgba(239, 68, 68, 0.05)",
      shadow: dashboardPremiumStyle ? "0 8px 24px rgba(239,68,68,0.10), 0 2px 6px rgba(239,68,68,0.05), inset 0 1px 0 rgba(255,255,255,.95)" : "inset 0 1px 0 rgba(255,255,255,1), inset 0 -4px 12px rgba(0,0,0,0.01), inset 0 0 14px rgba(239, 68, 68, 0.09)",
      titleColor: "#dc2626"
    },
    balance: {
      background: dashboardPremiumStyle ? "radial-gradient(circle at top right, rgba(255,255,255,.85), transparent 60%), linear-gradient(135deg, rgba(59,130,246,.20) 0%, rgba(59,130,246,.12) 35%, rgba(59,130,246,.06) 70%, transparent 100%), #EFF6FF" : "linear-gradient(135deg, rgba(59, 130, 246, 0.09) 0%, #FFFFFF 20%, #FFFFFF 80%, rgba(59, 130, 246, 0.09) 100%)",
      border: dashboardPremiumStyle ? "1px solid rgba(255, 255, 255, 0.85)" : "none",
      outline: dashboardPremiumStyle ? "none" : "1px solid rgba(59, 130, 246, 0.05)",
      shadow: dashboardPremiumStyle ? "0 8px 24px rgba(59,130,246,0.10), 0 2px 6px rgba(59,130,246,0.05), inset 0 1px 0 rgba(255,255,255,.95)" : "inset 0 1px 0 rgba(255,255,255,1), inset 0 -4px 12px rgba(0,0,0,0.01), inset 0 0 14px rgba(59, 130, 246, 0.09)",
      titleColor: "#2563eb"
    },
    yield: {
      background: dashboardPremiumStyle ? "radial-gradient(circle at top right, rgba(255,255,255,.85), transparent 60%), linear-gradient(135deg, rgba(124,58,237,.20) 0%, rgba(124,58,237,.12) 35%, rgba(124,58,237,.06) 70%, transparent 100%), #F7F2FF" : "linear-gradient(135deg, rgba(147, 51, 234, 0.09) 0%, #FFFFFF 20%, #FFFFFF 80%, rgba(147, 51, 234, 0.09) 100%)",
      border: dashboardPremiumStyle ? "1px solid rgba(255, 255, 255, 0.85)" : "none",
      outline: dashboardPremiumStyle ? "none" : "1px solid rgba(147, 51, 234, 0.05)",
      shadow: dashboardPremiumStyle ? "0 8px 24px rgba(124,58,237,0.10), 0 2px 6px rgba(124,58,237,0.05), inset 0 1px 0 rgba(255,255,255,.95)" : "inset 0 1px 0 rgba(255,255,255,1), inset 0 -4px 12px rgba(0,0,0,0.01), inset 0 0 14px rgba(147, 51, 234, 0.09)",
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

  const iconStyles = {
    income: "bg-green-100/80 text-green-600",
    expense: "bg-red-100/80 text-red-600",
    balance: "bg-blue-100/80 text-blue-600",
    yield: "bg-purple-100/80 text-purple-600",
  };

  const currentStyle = premiumStyles[variant];

  return (
    <Card
      id={id}
      style={{
        background: currentStyle.background,
        backgroundBlendMode: "soft-light",
        backdropFilter: dashboardPremiumStyle ? "none" : "blur(6px)",
        backgroundClip: dashboardPremiumStyle ? "padding-box" : undefined,
        border: dashboardPremiumStyle ? currentStyle.border : "1px solid rgba(0,0,0,0.06)",
        outline: currentStyle.outline,
        boxShadow: currentStyle.shadow,
      }}
      className={cn(
        "transition-all duration-300 animate-fade-in flex flex-col relative overflow-hidden",
        dashboardPremiumStyle ? "rounded-[24px]" : "",
        isMobile ? "p-4 min-h-[140px]" : "p-7 h-full min-h-[200px] rounded-3xl",
        className
      )}
    >
      {/* Formas orgânicas temáticas de fundo */}
      {dashboardPremiumStyle && (
        <div aria-hidden="true" className="absolute inset-0 pointer-events-none overflow-hidden rounded-[24px]" style={{ zIndex: 0 }}>
          <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox={isMobile ? "0 0 400 180" : "0 0 500 220"}>
            <defs>
              <linearGradient id={`wave-grad-${variant}-${isMobile ? "mob" : "desk"}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.75" />
                <stop offset="100%" stopColor="#FFFFFF" stopOpacity={isMobile ? "0.15" : "0.12"} />
              </linearGradient>
            </defs>
            <path d={isMobile ? "M 60,0 C 150,55 240,65 380,15 L 400,0 Z" : "M 80,0 C 180,60 300,75 480,20 L 500,0 Z"} fill="rgba(255,255,255,0.5)" />
            <path d={isMobile ? "M 0,180 Q 120,115 220,135 T 400,85 L 400,180 Z" : "M 0,220 Q 150,135 280,165 T 500,105 L 500,220 Z"} fill={`url(#wave-grad-${variant}-${isMobile ? "mob" : "desk"})`} />
          </svg>
        </div>
      )}

      <div className={cn("flex flex-col h-full w-full justify-between relative", dashboardPremiumStyle ? "z-20" : "")}>
      {/* Top Section: Trend, Title/Value and Month Navigator */}
      <div className="flex justify-between items-start mb-1 -mt-[2px] w-full">
        <div className="flex items-center gap-3">
          <div className="flex flex-col gap-0">
            <div className="flex items-center gap-1.5 -translate-y-[2px]">
              {icon && !hideMainIcon && (
                <div className="flex items-center justify-center">
                  <DynamicIcon 
                    name={icon} 
                    className={cn(isMobile ? "w-[16px] h-[16px]" : "w-[18px] h-[18px]")} 
                    style={{ color: currentStyle.titleColor }} 
                    strokeWidth={isMobile ? 2.5 : 2.5}
                  />
                </div>
              )}
              <h2 
                className={cn("font-semibold tracking-wide", isMobile ? "text-[15px]" : "text-[17px]")} 
                style={{ 
                  color: currentStyle.titleColor, 
                  textShadow: dashboardPremiumStyle ? "0px 1px 1px rgba(255,255,255,1), 0px 1px 2px rgba(0,0,0,0.02)" : "none" 
                }}
              >
                {mainStatTitle}
              </h2>
            </div>
            <p 
              className={cn("font-extrabold text-slate-800 font-roboto leading-none tracking-tight -mt-1.5", isMobile ? "text-[18px]" : "text-[22px]")}
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
          "w-full flex items-end pointer-events-none mt-6 relative",
          isMobile ? "h-[75px]" : "h-[100px]" // Increased by ~50% from 50/70
        )}>
          {chartContent}
        </div>
      )}

      {/* Bottom Section: Metrics Aligned at the Bottom */}
      <div className="mt-0.5 flex justify-between items-end min-h-[40px]">
        {/* Left Side: Secondary Stats & Children (Horizontal alignment for metrics) */}
        <div className="flex items-end gap-4">
          {secondaryStatValue !== undefined && (
            <div className="flex flex-col items-start gap-0 md:gap-0.5">
              <p 
                className={cn("font-medium leading-none font-roboto opacity-90", isMobile ? "text-[13px]" : "text-[14px]")}
                style={{ color: currentStyle.titleColor }}
              >
                {secondaryStatTitle}
              </p>
              <p className={cn("font-extrabold text-slate-800 font-roboto leading-none tracking-tight", isMobile ? "text-[15px]" : "text-[16px]")}>
                {formatCurrency(secondaryStatValue)}
              </p>
            </div>
          )}

          {/* Tendência integrada ao Bottom */}
          {trend && trend.includes('%') && (
            <div className={cn(
              "flex items-center justify-center px-1.5 py-0.5 rounded-full text-[10px] font-bold leading-none gap-1 mb-[3px] shadow-sm",
              dashboardPremiumStyle 
                ? ((variant === 'expense' ? !trendIsPositive : trendIsPositive) ? "bg-emerald-100/70 text-emerald-700" : "bg-rose-100/70 text-rose-700")
                : headerBadgeStyles[variant]
            )}>
              <DynamicIcon 
                name={trendIsPositive ? "TrendingUp" : "TrendingDown"} 
                className="h-3 w-3" 
                strokeWidth={3} 
              />
              <span>{trend.split(' ')[0].replace(/[+-]/g, '')}</span>
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
            <div className={cn(
              "flex flex-col items-end gap-0 md:gap-0.5",
              dashboardPremiumStyle ? "items-end translate-y-[2px]" : "items-end"
            )}>
              {dashboardPremiumStyle ? (
                <div className="flex items-center gap-1.5" style={{ color: currentStyle.titleColor }}>
                  <DynamicIcon name="Wallet" className="hidden md:block h-3 w-3 opacity-75" />
                  <p className={cn("font-medium leading-none font-roboto opacity-90", isMobile ? "text-[13px]" : "text-[14px]")}>{annualTotalLabel || "Total anual"}</p>
                </div>
              ) : (
                <p 
                  className={cn("font-medium leading-none font-roboto opacity-90", isMobile ? "text-[13px]" : "text-[14px]")}
                  style={{ color: currentStyle.titleColor }}
                >
                  {annualTotalLabel || "Total anual"}
                </p>
              )}
              <p className={cn("font-extrabold text-slate-800 font-roboto leading-none tracking-tight", isMobile ? "mt-0 text-[15px]" : "mt-0.5 text-[16px]")}>
                {formatCurrency(annualTotalValue)}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Legacy Port Case */}
      {bottomRightContent && !chartContent && (
        <div className={cn("absolute bottom-4 right-8", dashboardPremiumStyle ? "z-20" : "")}>
          {bottomRightContent}
        </div>
      )}
      </div>
    </Card>
  );
};
