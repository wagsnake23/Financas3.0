import React, { useState, useEffect } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useFinancialNotifications } from "@/hooks/useFinancialNotifications";
import { Bell, BellDot } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useTransactionEdit } from "@/contexts/TransactionEditContext";
import { Transaction, AppCategory } from "@/types/finance";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCategories } from "@/hooks/useCategories";

export const FinancialNotificationsPopover = () => {
  const { allNotifications, overdueExpenses, pendingReceipts, totalNotifications } = useFinancialNotifications();
  const { openEditModal } = useTransactionEdit();
  const [isOpen, setIsOpen] = useState(false);
  const [shouldAnimate, setShouldAnimate] = useState(false);
  const [prevTotal, setPrevTotal] = useState(totalNotifications);
  const isMobile = useIsMobile();
  const { user } = useAuth();

  const { data: rawCategories = [] } = useCategories(user?.id);

  const allCategories = React.useMemo(() => {
    return rawCategories;
  }, [rawCategories]);

  useEffect(() => {
    if (totalNotifications > prevTotal) {
      setShouldAnimate(true);
      const timer = setTimeout(() => setShouldAnimate(false), 300);
      return () => clearTimeout(timer);
    }
    setPrevTotal(totalNotifications);
  }, [totalNotifications, prevTotal]);


  
  const badgeText = totalNotifications > 9 ? "9+" : totalNotifications.toString();

  const handleOpenTransaction = (transaction: Transaction) => {
    openEditModal(transaction);
    setIsOpen(false);
  };

  const mobileIconColor = "text-slate-700";

  if (totalNotifications === 0) {
    return (
      <div className={cn(
        "relative flex items-center justify-center w-[40px] h-[40px] rounded-full pointer-events-none cursor-default",
        !isMobile && "transition-colors",
        isMobile ? "text-slate-400 opacity-60 -translate-y-[2px] translate-x-[4px]" : "text-white/50"
      )}>
        <Bell className="h-[22px] w-[22px]" strokeWidth={2.5} />
      </div>
    );
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "relative flex items-center justify-center w-[40px] h-[40px] rounded-full",
            !isMobile && "transition-colors",
            isMobile ? `${mobileIconColor} hover:bg-current/10 -translate-y-[2px] translate-x-[4px]` : "text-white hover:bg-white/10"
          )}
          aria-label="Notificações Financeiras"
        >
          <BellDot className={cn("h-[22px] w-[22px] transition-transform duration-300", shouldAnimate ? "scale-110" : "scale-100")} strokeWidth={2.5} />
          <span className={cn(
            "absolute top-[3px] right-[2px] flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white border-[2px] border-white transition-transform duration-300",
            shouldAnimate ? "scale-110" : "scale-100"
          )}>
            {badgeText}
          </span>
        </button>
      </PopoverTrigger>
      
      <PopoverContent 
        align={isMobile ? "center" : "end"} 
        className={cn(
          "p-0 rounded-[14px] shadow-xl border border-slate-200 overflow-hidden z-[100] bg-white",
          isMobile ? "w-[calc(100vw-37px)]" : "w-80"
        )}
        style={{ 
          minHeight: isMobile ? 'auto' : '150px',
          maxHeight: isMobile ? '70vh' : '350px', 
          overflowY: 'auto',
          background: '#FFFFFF', 
          backdropFilter: 'none', 
          WebkitBackdropFilter: 'none'
        }}
        collisionPadding={isMobile ? 18 : 16}
        sideOffset={isMobile ? -3 : 8}
      >
        <div className="p-3.5 bg-slate-100 border-b border-[#E5E7EB] flex items-center justify-between gap-2">
          <h3 className="font-bold text-slate-800 text-[14px] flex items-center gap-2">
            <span className="text-[16px]">⚠️</span> Pendências Financeiras
          </h3>
        </div>

        <div className="flex flex-col bg-white">
          {allNotifications.map((item) => {
            const isDespesa = item.type === "expense";
            const category = allCategories.find((c) => c.id === item.category);
            const icon = category?.icone || (isDespesa ? "🔴" : "🟢");
            const categoryName = category?.nome || item.category;

            return (
              <button
                key={item.id}
                onClick={() => handleOpenTransaction(item)}
                className="flex flex-col px-4 py-3 border-b border-[#E5E7EB] last:border-0 hover:bg-slate-50 transition-colors text-left bg-white"
              >
                <div className="flex items-start justify-between w-full mb-1 gap-2">
                  <div className="flex items-center gap-1.5 font-semibold text-slate-700 text-[14px] truncate">
                    <span className="shrink-0">{icon}</span>
                    <span className="truncate">{categoryName}</span>
                  </div>
                  <span className={cn(
                    "font-bold text-[13px] shrink-0",
                    isDespesa ? "text-red-600" : "text-emerald-600"
                  )}>
                    {formatCurrency(item.amount)}
                  </span>
                </div>
                <div className="text-[12px] text-slate-500 font-medium ml-4">
                  {format(new Date(item.date), "MMM/yyyy", { locale: ptBR })}
                </div>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
};
