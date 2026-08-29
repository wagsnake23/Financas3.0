import React from "react";
import { cn } from "@/lib/utils";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Check, Clock } from "lucide-react";

interface TransactionStatusToggleProps {
  isPaid: boolean;
  setIsPaid: (paid: boolean) => void;
  isMobile: boolean;
}

export const TransactionStatusToggle: React.FC<
  TransactionStatusToggleProps
> = ({ isPaid, setIsPaid, isMobile }) => {
  if (isMobile) {
    return (
      <div className="w-full h-full text-center">
        <span className={cn(
          "font-bold mb-1.5 inline-block text-[13px]", 
          isPaid ? "text-[#22C55E]" : "text-[#EF4444]"
        )}>
          {isPaid ? "Pago" : "Pendente"}
        </span>
        <div className="h-9 flex items-center justify-center">
          <div
            onClick={() => setIsPaid(!isPaid)}
            className={cn(
              "w-[38px] h-[20px] rounded-full p-[2px] transition-all duration-300 border cursor-pointer flex items-center",
              isPaid
                ? "bg-[#22C55E] border-transparent shadow-[inset_0_1px_3px_rgba(0,0,0,0.2),_0_1px_2px_rgba(34,197,94,0.4)]"
                : "bg-[#E85454] border-transparent shadow-[inset_0_1px_3px_rgba(0,0,0,0.2),_0_1px_2px_rgba(232,84,84,0.35)]"
            )}
          >
            <div
              className={cn(
                "w-[16px] h-[16px] rounded-full transition-transform duration-300 bg-gradient-to-b from-white to-[#F9FAFB] shadow-[0_2px_3px_rgba(0,0,0,0.16),_0_1px_1px_rgba(0,0,0,0.08),_inset_0_1px_0_rgba(255,255,255,0.9)]",
                isPaid
                  ? "translate-x-[16px]"
                  : "translate-x-0"
              )}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex justify-center">
      <RadioGroup
        value={isPaid ? "paid" : "pending"}
        onValueChange={(value) => setIsPaid(value === "paid")}
        className="flex items-center gap-8"
      >
        {/* === PAGO === */}
        <label
          htmlFor="status-paid"
          className="flex items-center gap-2 cursor-pointer select-none"
        >
          <RadioGroupItem
            value="paid"
            id="status-paid"
            className={cn(
              "relative flex items-center justify-center transition-all",
              "w-[18px] h-[18px] rounded-full border",
              isPaid
                ? "bg-[#25D366] border-[#25D366]"
                : "border-gray-400 bg-white"
            )}
          >
            {isPaid && (
              <Check
                className="absolute text-white w-[14px] h-[14px]"
                strokeWidth={4}
              />
            )}
          </RadioGroupItem>

          <span
            className={cn(
              "text-sm font-extrabold",
              isPaid ? "text-[#1DA554]" : "text-gray-500",
              isMobile && "text-xs"
            )}
          >
            Pago
          </span>
        </label>

        {/* === PENDENTE === */}
        <label
          htmlFor="status-pending"
          className={cn("flex items-center cursor-pointer select-none", isMobile ? "gap-1.5" : "gap-2")}
        >
          <RadioGroupItem
            value="pending"
            id="status-pending"
            className={cn(
              "relative flex items-center justify-center transition-all !shadow-none !outline-none !ring-0 !ring-offset-0 focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0",
              "after:content-none data-[state=checked]:after:content-none",
              "w-[18px] h-[18px] rounded-full border",
              !isPaid
                ? "bg-transparent border-none"
                : "border-gray-400 bg-white"
            )}
          >
            {!isPaid && (
              <Clock
                className="absolute text-[#FF8888] w-[17px] h-[17px]"
                strokeWidth={4}
              />
            )}
          </RadioGroupItem>

          <span
            className={cn(
              "text-sm font-medium",
              !isPaid ? "text-[#FF8888]" : "text-gray-500",
              isMobile && "text-xs"
            )}
          >
            Pendente
          </span>
        </label>
      </RadioGroup>
    </div >
  );
};
