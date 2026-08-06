import { cn } from "@/lib/utils";

export type SubscriptionType = "trial" | "premium" | "lifetime" | "expired";

interface SubscriptionBadgeProps {
  subscriptionType?: SubscriptionType | string;
  isExpired?: boolean;
  className?: string;
  showIconOnly?: boolean;
}

export function SubscriptionBadge({ subscriptionType, isExpired, className, showIconOnly }: SubscriptionBadgeProps) {
  const getSubscriptionDisplay = () => {
    if (isExpired || subscriptionType === "expired") {
      return { icon: "🔴", title: "Expirada", color: "text-red-700", bg: "bg-red-100/60" };
    }

    switch (subscriptionType) {
      case "lifetime":
        return { icon: "👑", title: "Vitalício", color: "text-amber-700", bg: "bg-amber-100/60" };
      case "premium":
        return { icon: "💎", title: "Premium", color: "text-blue-700", bg: "bg-blue-100/60" };
      case "trial":
      default:
        return { icon: "🧪", title: "Trial", color: "text-emerald-700", bg: "bg-emerald-100/60" };
    }
  };

  const display = getSubscriptionDisplay();

  if (showIconOnly) {
    return <span className={className}>{display.icon}</span>;
  }

  return (
    <span className={cn("inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[13px] font-bold", display.bg, display.color, className)}>
      <span className="text-base leading-none">{display.icon}</span>
      {display.title}
    </span>
  );
}
