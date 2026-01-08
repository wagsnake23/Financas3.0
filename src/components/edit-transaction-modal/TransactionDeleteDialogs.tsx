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
            "w-full rounded-xl",
            isMobile ? "max-w-[98vw] p-4 min-h-[180px]" : "sm:max-w-[425px]"
          )}
        >
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <DynamicIcon name="Trash2" className="h-6 w-6 text-destructive" />
              Confirmar Exclusão
            </AlertDialogTitle>
            <AlertDialogDescription>
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
                "rounded-xl",
                isMobile
                  ? "mt-0 h-10 text-sm flex-1 bg-soft-blue hover:bg-soft-blue/80 text-primary"
                  : "sm:mt-0"
              )}
              onClick={() => setShowSimpleDeleteDialog(false)}
            >
              {isMobile && <DynamicIcon name="❌" className="mr-1 h-4 w-4" />}{" "}
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleConfirmDelete("oneOff")}
              disabled={loading || isFetchingOptions}
              className={cn(
                "bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-xl",
                isMobile && "h-10 text-sm flex-1"
              )}
            >
              {isMobile && <DynamicIcon name="🗑️" className="mr-1 h-4 w-4" />}{" "}
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
            "w-full rounded-xl",
            isMobile ? "max-w-[98vw] p-4 min-h-[180px]" : "sm:max-w-[425px]"
          )}
        >
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <DynamicIcon name="Trash2" className="h-6 w-6 text-destructive" />
              Excluir Lançamento Recorrente
            </AlertDialogTitle>
            <AlertDialogDescription>
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
                  className="peer data-[state=checked]:border-primary data-[state=checked]:after:bg-primary data-[state=checked]:ring-primary"
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
                  className="peer data-[state=checked]:border-primary data-[state=checked]:after:bg-primary data-[state=checked]:ring-primary"
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
                  className="peer data-[state=checked]:border-primary data-[state=checked]:after:bg-primary data-[state=checked]:ring-primary"
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
                "rounded-xl border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors",
                isMobile
                  ? "mt-0 h-10 text-sm flex-1"
                  : "sm:mt-0"
              )}
              onClick={() => setShowDeleteOptionsDialog(false)}
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleConfirmDelete(selectedDeleteScope)}
              disabled={loading || isFetchingOptions}
              className={cn(
                "w-full sm:w-auto rounded-xl bg-[#D32F2F] text-white hover:bg-[#B71C1C] transition-colors border-transparent shadow-sm",
                isMobile && "h-10 text-sm flex-1"
              )}
            >
              {loading || isFetchingOptions ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};