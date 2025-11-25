import React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import DynamicIcon from "@/components/DynamicIcon";
import { cn } from "@/lib/utils";

type SaveScope = "thisMonth" | "thisMonthForward" | "all" | "oneOff";

interface TransactionSaveDialogsProps {
  showSaveOptionsDialog: boolean;
  setShowSaveOptionsDialog: (open: boolean) => void;
  selectedSaveScope: SaveScope;
  setSelectedSaveScope: (scope: SaveScope) => void;
  handleConfirmSave: (scope: SaveScope) => void;
  loading: boolean;
  isFetchingOptions: boolean;
  isMobile: boolean;
}

export const TransactionSaveDialogs: React.FC<TransactionSaveDialogsProps> = ({
  showSaveOptionsDialog,
  setShowSaveOptionsDialog,
  selectedSaveScope,
  setSelectedSaveScope,
  handleConfirmSave,
  loading,
  isFetchingOptions,
  isMobile,
}) => {
  return (
    <AlertDialog
      open={showSaveOptionsDialog}
      onOpenChange={setShowSaveOptionsDialog}
    >
      <AlertDialogContent
        className={cn(
          "w-full",
          isMobile ? "max-w-[98vw] p-4 min-h-[180px]" : "sm:max-w-[425px]"
        )}
      >
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <DynamicIcon name="Pencil" className="h-6 w-6 text-primary" />
            Atualizar Lançamento Recorrente
          </AlertDialogTitle>
          <AlertDialogDescription>
            Este lançamento faz parte de uma série recorrente. Como você
            gostaria de aplicar as alterações?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="py-4">
          <RadioGroup
            value={selectedSaveScope}
            onValueChange={(value: SaveScope) => setSelectedSaveScope(value)}
            className="space-y-3 radio-fix-click"
          >
            <div className="flex items-center space-x-3">
              <RadioGroupItem
                value="thisMonth"
                id="save-this-month"
                className="peer data-[state=checked]:border-primary data-[state=checked]:after:bg-primary data-[state=checked]:ring-primary"
              />
              <label
                htmlFor="save-this-month"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Apenas este mês
              </label>
            </div>
            <div className="flex items-center space-x-3">
              <RadioGroupItem
                value="thisMonthForward"
                id="save-this-month-forward"
                className="peer data-[state=checked]:border-primary data-[state=checked]:after:bg-primary data-[state=checked]:ring-primary"
              />
              <label
                htmlFor="save-this-month-forward"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Deste mês em diante
              </label>
            </div>
            <div className="flex items-center space-x-3">
              <RadioGroupItem
                value="all"
                id="save-all"
                className="peer data-[state=checked]:border-primary data-[state=checked]:after:bg-primary data-[state=checked]:ring-primary"
              />
              <label
                htmlFor="save-all"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Todo o período
              </label>
            </div>
          </RadioGroup>
        </div>
        <AlertDialogFooter
          className={cn(
            "flex flex-col sm:flex-row justify-center gap-2",
            isMobile && "flex-row justify-between items-center"
          )}
        >
          <AlertDialogCancel
            disabled={loading || isFetchingOptions}
            className={cn(
              "rounded-xl",
              isMobile
                ? "mt-0 h-10 text-xs flex-1 bg-soft-blue hover:bg-soft-blue/80 text-primary"
                : "sm:mt-0"
            )}
          >
            <DynamicIcon
              name="XCircle"
              className={cn("mr-1 h-3.5 w-3.5", isMobile && "h-3 w-3 mr-0.5")}
            />
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => handleConfirmSave(selectedSaveScope)}
            disabled={loading || isFetchingOptions}
            className={cn(
              "w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl",
              isMobile && "h-10 text-xs flex-1"
            )}
          >
            {loading || isFetchingOptions ? "Salvando..." : "Salvar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};