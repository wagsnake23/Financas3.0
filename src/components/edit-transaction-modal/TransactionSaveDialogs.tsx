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
          isMobile ? "dialog-mobile w-[99%] max-w-[99%] !px-4 p-4 min-h-[180px] !pb-5 !rounded-[22px] shadow-none border-none" : "sm:max-w-[425px] !pb-5 !rounded-[22px] shadow-none border-none"
        )}
        style={{
          background: "linear-gradient(135deg, #f0fdf4 0%, #ffffff 100%)",
          backgroundBlendMode: "soft-light",
          backdropFilter: "blur(6px)",
          border: "1px solid rgba(0,0,0,0.06)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.6), inset 0 -8px 20px rgba(0,0,0,0.02), 0 20px 25px -5px rgba(0, 0, 0, 0.1)"
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center justify-center gap-2 text-center font-bold">
            <span className="text-2xl select-none">📝</span>
            Atualizar Lançamento
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center">
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
            "flex flex-row justify-center gap-2 items-center w-full pt-2"
          )}
        >
          <AlertDialogCancel
            disabled={loading || isFetchingOptions}
            className={cn(
              "flex-1 rounded-[14px] btn-3d font-black !text-slate-700 border border-slate-300 transition-all active:scale-95 text-lg h-11 mt-0",
              isMobile && "h-11"
            )}
            style={{ 
              "--cor-topo": "#E2E8F0", 
              "--cor-base": "#CBD5E1",
              boxShadow: "inset 0px 1px 1px rgba(255, 255, 255, 0.4), inset 0px -1px 0px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0,0,0,0.05)"
            } as any}
            onClick={() => setShowSaveOptionsDialog(false)}
          >
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => handleConfirmSave(selectedSaveScope)}
            disabled={loading || isFetchingOptions}
            className={cn(
              "flex-1 rounded-[14px] btn-3d font-black text-white border-none transition-all active:scale-95 shadow-[0_2px_4px_rgba(0,0,0,0.05)] text-lg h-11",
              isMobile && "h-11"
            )}
            style={{ "--cor-topo": "#25AF6A", "--cor-base": "#1AA361" } as any}
          >
            {loading || isFetchingOptions ? "Salvando..." : "Salvar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};