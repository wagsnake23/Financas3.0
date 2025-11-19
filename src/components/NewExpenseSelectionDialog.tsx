import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import DynamicIcon from "./DynamicIcon";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

type FormMode = 'one-off' | 'recurring';

interface NewExpenseSelectionDialogProps {
  isMobile: boolean;
}

export const NewExpenseSelectionDialog: React.FC<NewExpenseSelectionDialogProps> = ({ isMobile }) => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedMode, setSelectedMode] = useState<FormMode>('one-off');

  const handleSelectModeAndNavigate = (mode: FormMode) => {
    navigate(`/despesas?mode=${mode}`);
    setIsOpen(false); // Close the dialog after navigation
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="destructive"
          className={cn("h-8 px-3 text-xs rounded-xl", isMobile ? "w-full" : "w-auto px-4")}
        >
          <DynamicIcon name="Plus" className="mr-2 h-4 w-4" />
          Nova Despesa
        </Button>
      </DialogTrigger>
      <DialogContent className={cn("sm:max-w-[425px]", isMobile && "max-w-[90vw] rounded-lg")}>
        <DialogHeader>
          <DialogTitle className={cn(isMobile && "text-lg")}>Nova Despesa</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <p className={cn("text-sm text-muted-foreground", isMobile && "text-xs")}>
            Selecione o tipo de despesa que deseja registrar:
          </p>
          <RadioGroup
            value={selectedMode}
            onValueChange={(value: FormMode) => setSelectedMode(value)}
            className="grid grid-cols-2 gap-4"
          >
            <Label
              htmlFor="one-off-expense-dialog"
              className={cn(
                "flex flex-col items-center justify-between rounded-xl border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground [&:has([data-state=checked])]:border-destructive shadow-sm",
                isMobile && "p-3 text-sm"
              )}
            >
              <RadioGroupItem value="one-off" id="one-off-expense-dialog" className="sr-only" />
              <DynamicIcon name="CreditCard" className={cn("mb-3 h-6 w-6 text-destructive", isMobile && "mb-1 h-5 w-5")} />
              <span className={cn("block w-full text-center font-normal", isMobile && "text-xs")}>Avulsa</span>
            </Label>
            <Label
              htmlFor="recurring-expense-dialog"
              className={cn(
                "flex flex-col items-center justify-between rounded-xl border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground [&:has([data-state=checked])]:border-primary shadow-sm",
                isMobile && "p-3 text-sm"
              )}
            >
              <RadioGroupItem value="recurring" id="recurring-expense-dialog" className="sr-only" />
              <DynamicIcon name="Repeat" className={cn("mb-3 h-6 w-6 text-primary", isMobile && "mb-1 h-5 w-5")} />
              <span className={cn("block w-full text-center font-normal", isMobile && "text-xs")}>Recorrente</span>
            </Label>
          </RadioGroup>
        </div>
        <div className="flex justify-end">
          <Button
            onClick={() => handleSelectModeAndNavigate(selectedMode)}
            className={cn("rounded-xl", isMobile && "h-9 text-sm")}
            disabled={!selectedMode}
          >
            Continuar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};