import React from "react";
import { cn } from "@/lib/utils";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Check } from "lucide-react";

interface TransactionStatusToggleProps {
  isPaid: boolean;
  setIsPaid: (paid: boolean) => void;
  isMobile: boolean;
}

export const TransactionStatusToggle: React.FC<
  TransactionStatusToggleProps
> = ({ isPaid, setIsPaid, isMobile }) => {
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
                className="absolute text-white w-[13px] h-[13px]"
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
          className="flex items-center gap-2 cursor-pointer select-none"
        >
          <RadioGroupItem
            value="pending"
            id="status-pending"
            className={cn(
              "relative flex items-center justify-center transition-all",
              "w-[18px] h-[18px] rounded-full border",
              !isPaid
                ? "bg-[#FF6D6D] border-[#FF6D6D]"
                : "border-gray-400 bg-white"
            )}
          >
            {!isPaid && (
              <Check
                className="absolute text-white w-[13px] h-[13px]"
                strokeWidth={4}
              />
            )}
          </RadioGroupItem>

          <span
            className={cn(
              "text-sm font-extrabold",
              !isPaid ? "text-[#E84F4F]" : "text-gray-500",
              isMobile && "text-xs"
            )}
          >
            Pendente
          </span>
        </label>
      </RadioGroup>
    </div>
  );
};
