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
            "flex items-center justify-between transition-all duration-200 text-gray-800",
            "border-b border-slate-200 pb-2",
            isMobile ? "-mt-1 mb-3" : "-mt-2 mb-4"
        )}>
            {/* Left side: Status and Info */}
            <div className={cn("flex items-center overflow-hidden whitespace-nowrap", isMobile ? "gap-1" : "gap-2")}>
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
                    <div className={cn("flex items-center overflow-hidden opacity-95", isMobile ? "gap-1" : "gap-1.5")}>
                        <span className="text-slate-300 text-[10px] shrink-0 font-bold">•</span>
                        <span className={cn(
                            "text-slate-500 truncate leading-none pt-[1px]",
                            isMobile ? "text-[11px] font-medium whitespace-nowrap" : "text-[11.5px] font-semibold"
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
                        className="text-primary text-xs font-semibold hover:bg-primary/5 h-8 px-2 rounded-xl"
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
                                className="text-primary text-xs font-semibold hover:bg-primary/5 h-8 px-2 rounded-xl flex items-center gap-1"
                            >
                                Alterar
                                <ChevronDown className="w-3.5 h-3.5" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-40 p-2 rounded-2xl border-none shadow-xl bg-white/95 backdrop-blur-sm" align="end">
                            <RadioGroup
                                value={isPaid ? "paid" : "pending"}
                                onValueChange={(value) => handleStatusChange(value === "paid")}
                                className="space-y-1"
                            >
                                <label className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded-xl cursor-pointer transition-colors">
                                    <RadioGroupItem value="paid" className="w-4 h-4" />
                                    <span className="text-sm font-medium text-gray-700">{transactionType === "income" ? "Recebido" : "Pago"}</span>
                                </label>
                                <label className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded-xl cursor-pointer transition-colors">
                                    <RadioGroupItem value="pending" className="w-4 h-4" />
                                    <span className="text-sm font-medium text-gray-700">Pendente</span>
                                </label>
                            </RadioGroup>
                        </PopoverContent>
                    </Popover>
                )}
            </div>
        </div>
    );
};
