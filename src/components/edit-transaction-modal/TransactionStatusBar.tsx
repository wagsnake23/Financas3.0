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
            "flex items-center justify-between px-3 rounded-2xl backdrop-blur-md shadow-sm border transition-all duration-300",
            isPaid
                ? "bg-gradient-to-br from-[#F1FBF9] to-[#E8F8EE] border-[#D1FAE5]"
                : "bg-gradient-to-br from-[#FFFDF2] to-[#FFF9E5] border-[#FEF3C7]",
            isMobile ? "mx-2 mb-1 py-1.5" : "mb-2 py-2"
        )}>
            {/* Left side: Status and Info */}
            <div className="flex flex-col items-start gap-0">
                <div className="flex items-center gap-2">
                    <div className={cn(
                        "relative flex items-center justify-center transition-all",
                        "w-[18px] h-[18px] rounded-full border",
                        isPaid
                            ? "bg-[#25D366] border-[#25D366]"
                            : "bg-[#FEF3C7] border-[#FEF3C7]"
                    )}>
                        {isPaid ? (
                            <Check
                                className="absolute text-white w-[14px] h-[14px]"
                                strokeWidth={4}
                            />
                        ) : (
                            <Clock
                                className="absolute text-[#D97706] w-[14px] h-[14px]"
                                strokeWidth={4}
                            />
                        )}
                    </div>
                    <span className={cn(
                        "text-sm font-extrabold",
                        isPaid ? "text-[#1DA554]" : "text-[#D97706]"
                    )}>
                        {statusLabel}
                    </span>
                </div>

                {isPaid && paidAtTimestamp && (
                    <span className="text-[12.5px] text-slate-600 font-bold ml-0.5 mt-1">
                        {formattedDate}
                    </span>
                )}
            </div>

            {/* Right side: Action (Button or Popover) */}
            <div className="flex items-center">
                {!isPaid ? (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleStatusChange(true)}
                        className="text-primary text-xs font-bold hover:bg-primary/5 h-8 px-3 rounded-xl"
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
                                className="text-primary text-xs font-bold hover:bg-primary/5 h-8 px-3 rounded-xl flex items-center gap-1"
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
