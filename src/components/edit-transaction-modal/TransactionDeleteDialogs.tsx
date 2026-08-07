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
import { Transaction } from "@/types/finance";

type DeleteScope = "thisMonth" | "thisMonthForward" | "all" | "oneOff";

interface TransactionDeleteDialogsProps {
  showDeleteOptionsDialog: boolean;
  setShowDeleteOptionsDialog: (open: boolean) => void;
  showSimpleDeleteDialog: boolean;
  setShowSimpleDeleteDialog: (open: boolean) => void;
  selectedDeleteScope: DeleteScope;
  setSelectedDeleteScope: (scope: DeleteScope) => void;
  handleConfirmDelete: (scope: DeleteScope) => void;
  loading: boolean;
  isFetchingOptions: boolean;
  isMobile: boolean;
  editingTransaction: Transaction | null;
}

export const TransactionDeleteDialogs: React.FC<TransactionDeleteDialogsProps> = ({
  showDeleteOptionsDialog,
  setShowDeleteOptionsDialog,
  showSimpleDeleteDialog,
  setShowSimpleDeleteDialog,
  selectedDeleteScope,
  setSelectedDeleteScope,
  handleConfirmDelete,
  loading,
  isFetchingOptions,
  isMobile,
  editingTransaction,
}) => {
  return (
    <>
      {/* Diálogo de Confirmação para Exclusão de Despesa Avulsa */}
      <AlertDialog
        open={showSimpleDeleteDialog}
        onOpenChange={setShowSimpleDeleteDialog}
      >
        <AlertDialogContent
          className={cn(
            isMobile ? "dialog-mobile w-[99%] max-w-[99%] !px-4 p-4 !pb-4 min-h-[180px] !rounded-[22px] shadow-none border-none" : "sm:max-w-[425px] !pb-4 !rounded-[22px] shadow-none border-none"
          )}
          style={{
            background: "linear-gradient(135deg, #ffffff 0%, #f9fafb 100%)",
            backgroundBlendMode: "soft-light",
            backdropFilter: "blur(6px)",
            border: "1px solid rgba(0,0,0,0.06)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.6), inset 0 -8px 20px rgba(0,0,0,0.02), 0 20px 25px -5px rgba(0, 0, 0, 0.1)"
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle className="flex justify-center items-center gap-2 text-center font-black text-[#1E40AF]">
              <DynamicIcon name="Trash2" className="h-6 w-6 text-destructive" />
              Confirmar Exclusão
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              Tem certeza que deseja excluir este lançamento? Esta ação não pode
              ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter
            className={cn(
              "flex flex-col sm:flex-row justify-center gap-2",
              isMobile && "flex-row items-center justify-between"
            )}
          >
            <AlertDialogCancel
              disabled={loading || isFetchingOptions}
              className={cn(
                "flex-1 rounded-xl btn-3d font-black !text-[#1E40AF] border-none transition-all active:scale-95 shadow-[0_2px_4px_rgba(0,0,0,0.05)] text-lg mt-0 h-11",
                isMobile && "h-11 text-lg"
              )}
              style={{ "--cor-topo": "#E0E7FF", "--cor-base": "#C7D2FE" } as any}
              onClick={() => setShowSimpleDeleteDialog(false)}
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleConfirmDelete("oneOff")}
              disabled={loading || isFetchingOptions}
              className={cn(
                "flex-1 rounded-2xl btn-3d font-black text-white border-none transition-all active:scale-95 shadow-[0_2px_4px_rgba(0,0,0,0.05)] text-lg h-11",
                isMobile && "h-12 text-lg"
              )}
              style={{ "--cor-topo": "#FF6B6B", "--cor-base": "#E54D4D" } as any}
            >
              {loading || isFetchingOptions ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Diálogo de Confirmação para Exclusão de Despesa Parcelada/Recorrente */}
      <AlertDialog
        open={showDeleteOptionsDialog}
        onOpenChange={setShowDeleteOptionsDialog}
      >
        <AlertDialogContent
          className={cn(
            isMobile ? "dialog-mobile w-[99%] max-w-[99%] !px-4 p-4 !pb-4 min-h-[180px] !rounded-[22px] shadow-none border-none" : "sm:max-w-[425px] !pb-4 !rounded-[22px] shadow-none border-none"
          )}
          style={{
            background: "linear-gradient(135deg, #ffffff 0%, #f9fafb 100%)",
            backgroundBlendMode: "soft-light",
            backdropFilter: "blur(6px)",
            border: "1px solid rgba(0,0,0,0.06)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.6), inset 0 -8px 20px rgba(0,0,0,0.02), 0 20px 25px -5px rgba(0, 0, 0, 0.1)"
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center justify-center gap-2 text-center font-black text-[#1E40AF]">
              <DynamicIcon name="Trash2" className="h-6 w-6 text-destructive" />
              Excluir Lançamento
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              Este lançamento faz parte de uma série recorrente. Como você
              gostaria de excluí-lo?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <RadioGroup
              value={selectedDeleteScope}
              onValueChange={(value: DeleteScope) =>
                setSelectedDeleteScope(value)
              }
              className="space-y-3 radio-fix-click"
            >
              <div className="flex items-center space-x-3">
                <RadioGroupItem
                  value="thisMonth"
                  id="delete-this-month"
                  className="peer bg-white border-[#1A56AD] data-[state=checked]:border-primary data-[state=checked]:after:bg-primary data-[state=checked]:ring-primary"
                />
                <label
                  htmlFor="delete-this-month"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Apenas este mês
                </label>
              </div>
              <div className="flex items-center space-x-3">
                <RadioGroupItem
                  value="thisMonthForward"
                  id="delete-this-month-forward"
                  className="peer bg-white border-[#1A56AD] data-[state=checked]:border-primary data-[state=checked]:after:bg-primary data-[state=checked]:ring-primary"
                />
                <label
                  htmlFor="delete-this-month-forward"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Deste mês em diante
                </label>
              </div>
              <div className="flex items-center space-x-3">
                <RadioGroupItem
                  value="all"
                  id="delete-all"
                  className="peer bg-white border-[#1A56AD] data-[state=checked]:border-primary data-[state=checked]:after:bg-primary data-[state=checked]:ring-primary"
                />
                <label
                  htmlFor="delete-all"
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
                "flex-1 rounded-xl btn-3d font-black !text-[#1E40AF] border-none transition-all active:scale-95 shadow-[0_2px_4px_rgba(0,0,0,0.05)] text-lg mt-0 h-11",
                isMobile && "h-11 text-lg"
              )}
              style={{ "--cor-topo": "#E0E7FF", "--cor-base": "#C7D2FE" } as any}
              onClick={() => setShowDeleteOptionsDialog(false)}
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleConfirmDelete(selectedDeleteScope)}
              disabled={loading || isFetchingOptions}
              className={cn(
                "flex-1 rounded-2xl btn-3d font-black text-white border-none transition-all active:scale-95 shadow-[0_2px_4px_rgba(0,0,0,0.05)] text-lg h-11",
                isMobile && "h-12 text-lg"
              )}
              style={{ "--cor-topo": "#FF6B6B", "--cor-base": "#E54D4D" } as any}
            >
              {loading || isFetchingOptions ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};