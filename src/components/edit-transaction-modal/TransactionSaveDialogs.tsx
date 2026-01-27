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
          isMobile ? "dialog-mobile w-[99vw] max-w-[99vw] p-4 min-h-[180px] !pb-5 !rounded-[32px]" : "sm:max-w-[425px] !pb-5 !rounded-[32px]"
        )}
      >
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center justify-center gap-2">
            <span className="text-2xl select-none">📝</span>
            Atualizar Lançamento
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
                className="peer bg-white border-[#25D366] data-[state=checked]:border-[#25D366] data-[state=checked]:after:bg-[#25D366] data-[state=checked]:ring-[#25D366]"
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
                className="peer bg-white border-[#25D366] data-[state=checked]:border-[#25D366] data-[state=checked]:after:bg-[#25D366] data-[state=checked]:ring-[#25D366]"
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
                className="peer bg-white border-[#25D366] data-[state=checked]:border-[#25D366] data-[state=checked]:after:bg-[#25D366] data-[state=checked]:ring-[#25D366]"
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
              "rounded-2xl border border-blue-300 bg-blue-100 text-[#1A56AD] hover:bg-blue-200 hover:text-[#1A56AD] font-black",
              isMobile
                ? "mt-0 h-12 text-base flex-1"
                : "sm:mt-0"
            )}
          >
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => handleConfirmSave(selectedSaveScope)}
            disabled={loading || isFetchingOptions}
            className={cn(
              "w-full sm:w-auto bg-[#25D366] hover:bg-[#25D366]/90 text-white rounded-2xl font-black",
              isMobile && "h-12 text-base flex-1"
            )}
          >
            {loading || isFetchingOptions ? "Salvando..." : "Salvar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};