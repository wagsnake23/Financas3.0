import React from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

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
  return (
    <div className="flex justify-center pt-1">
      <RadioGroup
        value={status}
        onValueChange={(value) => setStatus(value)}
        className="flex items-center justify-center gap-6"
      >
        {/* RECEBIDA */}
        <div className="flex items-center gap-2">
          <RadioGroupItem
            value="Recebida"
            id="status-received"
            className={cn(
              isMobile && "h-3.5 w-3.5",
              "peer appearance-none rounded-full border border-success/40",
              "ring-offset-background focus-visible:ring-2 focus-visible:ring-success focus-visible:ring-offset-2",
              "data-[state=checked]:bg-[#4EF58D]",
              "data-[state=checked]:border-[#4EF58D]",
              "data-[state=checked]:after:content-['✓'] data-[state=checked]:after:text-white",
              "data-[state=checked]:after:text-[11px]",
              "data-[state=checked]:after:font-extrabold",
              "data-[state=checked]:after:flex data-[state=checked]:after:items-center data-[state=checked]:after:justify-center"
            )}
          />
          <Label
            htmlFor="status-received"
            className={cn(
              "text-sm font-normal text-muted-foreground",
              isMobile && "text-xs",
              "peer-data-[state=checked]:text-[#006600] peer-data-[state=checked]:font-extrabold"
            )}
          >
            Recebida
          </Label>
        </div>

        {/* PENDENTE */}
        <div className="flex items-center gap-2">
          <RadioGroupItem
            value="Pendente"
            id="status-pending"
            className={cn(
              isMobile && "h-3.5 w-3.5",
              "peer appearance-none rounded-full border border-destructive/40",
              "ring-offset-background focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-2",
              "data-[state=checked]:bg-[#FF8A8A]",
              "data-[state=checked]:border-[#FF8A8A]",
              "data-[state=checked]:after:content-['✓'] data-[state=checked]:after:text-white",
              "data-[state=checked]:after:text-[11px]",
              "data-[state=checked]:after:font-extrabold",
              "data-[state=checked]:after:flex data-[state=checked]:after:items-center data-[state=checked]:after:justify-center"
            )}
          />
          <Label
            htmlFor="status-pending"
            className={cn(
              "text-sm font-normal text-muted-foreground",
              isMobile && "text-xs",
              "peer-data-[state=checked]:text-destructive peer-data-[state=checked]:font-extrabold"
            )}
          >
            Pendente
          </Label>
        </div>
      </RadioGroup>
    </div>
  );
};
