import React from "react";
import { cn } from "@/lib/utils";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Check, Clock } from "lucide-react";

interface RevenueStatusToggleProps {
  status: string;
  setStatus: (status: string) => void;
  isMobile: boolean;
}

export const RevenueStatusToggle: React.FC<RevenueStatusToggleProps> = ({
  status,
  setStatus,
  isMobile,
}) => {
  const isReceived = status === "Recebida";

  return (
    <div className="w-full flex justify-center">
      <RadioGroup
        value={status}
        onValueChange={(value) => setStatus(value)}
        className="flex items-center gap-8"
      >
        {/* === RECEBIDA === */}
        <label
          htmlFor="status-received"
          className="flex items-center gap-2 cursor-pointer select-none"
        >
          <RadioGroupItem
            value="Recebida"
            id="status-received"
            className={cn(
              "relative flex items-center justify-center transition-all",
              "w-[18px] h-[18px] rounded-full border",
              isReceived
                ? "bg-[#25D366] border-[#25D366]"
                : "border-gray-400 bg-white"
            )}
          >
            {isReceived && (
              <Check
                className="absolute text-white w-[14px] h-[14px]"
                strokeWidth={4}
              />
            )}
          </RadioGroupItem>

          <span
            className={cn(
              "text-sm font-extrabold",
              isReceived ? "text-[#1DA554]" : "text-gray-500",
              isMobile && "text-xs"
            )}
          >
            Recebida
          </span>
        </label>

        {/* === PENDENTE === */}
        <label
          htmlFor="status-pending"
          className="flex items-center gap-2 cursor-pointer select-none"
        >
          <RadioGroupItem
            value="Pendente"
            id="status-pending"
            className={cn(
              "relative flex items-center justify-center transition-all !shadow-none !outline-none !ring-0 !ring-offset-0 focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0",
              "after:content-none data-[state=checked]:after:content-none",
              "w-[18px] h-[18px] rounded-full border",
              !isReceived
                ? "bg-transparent border-none"
                : "border-gray-400 bg-white"
            )}
          >
            {!isReceived && (
              <Clock
                className="absolute text-[#FF8888] w-[17px] h-[17px]"
                strokeWidth={4}
              />
            )}
          </RadioGroupItem>

          <span
            className={cn(
              "text-sm font-medium",
              !isReceived ? "text-[#FF8888]" : "text-gray-500",
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
