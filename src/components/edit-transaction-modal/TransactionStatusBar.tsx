import React from "react";
import { cn, formatInTimeZone, TARGET_TIMEZONE } from "@/lib/utils";
import { ptBR } from "date-fns/locale";
import { Check, Clock, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface TransactionStatusBarProps {
    isPaid: boolean;
    setIsPaid: (paid: boolean) => void;
    paidAtTimestamp: string | null;
    setPaidAtTimestamp: (timestamp: string | null) => void;
    transactionType: "income" | "expense";
    isMobile: boolean;
}

export const TransactionStatusBar: React.FC<TransactionStatusBarProps> = ({
    isPaid,
    setIsPaid,
    paidAtTimestamp,
    setPaidAtTimestamp,
    transactionType,
    isMobile,
}) => {
    const statusLabel = isPaid
        ? (transactionType === "income" ? "Recebido" : "Pago")
        : "Pendente";

    const handleStatusChange = (newIsPaid: boolean) => {
        setIsPaid(newIsPaid);
        if (newIsPaid) {
            if (!paidAtTimestamp) {
                setPaidAtTimestamp(new Date().toISOString());
            }
        } else {
            setPaidAtTimestamp(null);
        }
    };

    const formattedDate = paidAtTimestamp
        ? formatInTimeZone(paidAtTimestamp, TARGET_TIMEZONE, "dd MMM yyyy 'às' HH:mm", {
            locale: ptBR,
        })
        : "";

    return (
        <div className={cn(
            "flex items-center justify-between transition-all duration-200 text-gray-800 border-b border-slate-200",
            "h-[35px]",
            isMobile ? "-mt-[4px] mb-[10px]" : "-mt-[8px] mb-[14px]"
        )}>
            {/* Left side: Status and Info */}
            <div className={cn("flex items-center whitespace-nowrap", isMobile ? "gap-1" : "gap-2")}>
                <div className="flex items-center gap-1.5 shrink-0">
                    <div className={cn(
                        "relative flex items-center justify-center transition-all shrink-0",
                        "w-[16px] h-[16px] rounded-full border",
                        isPaid
                            ? "bg-[#25D366] border-[#25D366]"
                            : "bg-[#FEF3C7] border-[#FEF3C7]"
                    )}>
                        {isPaid ? (
                            <Check
                                className="absolute text-white w-[12px] h-[12px]"
                                strokeWidth={4}
                            />
                        ) : (
                            <Clock
                                className="absolute text-[#D97706] w-[12px] h-[12px]"
                                strokeWidth={4}
                            />
                        )}
                    </div>
                    <span className={cn(
                        "text-[13.5px] font-semibold leading-none",
                        isPaid ? "text-[#1DA554]" : "text-[#D97706]"
                    )}>
                        {statusLabel}
                    </span>
                </div>

                {isPaid && paidAtTimestamp && (
                    <div className={cn("flex items-center opacity-95", isMobile ? "gap-1" : "gap-1.5")}>
                        <span className="text-slate-300 text-[10px] shrink-0 font-bold">•</span>
                        <span className={cn(
                            "text-slate-500 truncate leading-none pt-[1px]",
                            isMobile ? "text-[10px] font-medium whitespace-nowrap" : "text-[11.5px] font-semibold"
                        )}>
                            {formattedDate}
                        </span>
                    </div>
                )}
            </div>

            {/* Right side: Action (Button or Popover) */}
            <div className="flex items-center shrink-0">
                {!isPaid ? (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleStatusChange(true)}
                        className={cn(
                            "text-primary font-semibold hover:bg-primary/5 h-7 px-2 rounded-xl",
                            isMobile ? "text-xs" : "text-[13px]"
                        )}
                    >
                        Marcar como pago
                    </Button>
                ) : (
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className={cn(
                                    "text-primary font-semibold hover:bg-primary/5 h-7 px-2 rounded-xl flex items-center gap-1",
                                    isMobile ? "text-xs" : "text-[13px]"
                                )}
                            >
                                Alterar
                                <ChevronDown className="w-3.5 h-3.5" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className={cn(
                            "p-2 rounded-2xl border-none shadow-xl bg-white/95 backdrop-blur-sm",
                            isMobile ? "w-40" : "w-[185px]"
                        )} align="end">
                            <div className="space-y-1">
                                <div 
                                    onClick={() => !isPaid && handleStatusChange(true)}
                                    className={cn(
                                        "flex items-center justify-between p-2 rounded-xl transition-colors",
                                        isPaid ? "cursor-default bg-slate-100/80" : "cursor-pointer hover:bg-gray-50"
                                    )}
                                >
                                    <span className={cn(
                                        "text-sm font-medium",
                                        isPaid ? "text-slate-500" : "text-gray-900"
                                    )}>{transactionType === "income" ? "Recebido" : "Pago"}</span>
                                    {isPaid && <Check className="w-[15px] h-[15px] text-[#1DA554] shrink-0" strokeWidth={3} />}
                                </div>
                                <div 
                                    onClick={() => isPaid && handleStatusChange(false)}
                                    className={cn(
                                        "flex items-center justify-between p-2 rounded-xl transition-colors",
                                        !isPaid ? "cursor-default bg-slate-100/80" : "cursor-pointer hover:bg-gray-50"
                                    )}
                                >
                                    <span className={cn(
                                        "text-sm font-medium",
                                        !isPaid ? "text-slate-500" : "text-gray-900"
                                    )}>Pendente</span>
                                    {!isPaid && <Check className="w-[15px] h-[15px] text-[#1DA554] shrink-0" strokeWidth={3} />}
                                </div>
                            </div>
                        </PopoverContent>
                    </Popover>
                )}
            </div>
        </div>
    );
};
