import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Navigation } from "@/components/Navigation";
import Loading from "@/components/Loading";
import { useIsMobile } from "@/hooks/use-mobile";
import { Footer } from "@/components/Footer";
import { MonthNavigator } from "@/components/MonthNavigator";
import { useLancamentosLogic } from "@/hooks/useLancamentosLogic";
import { LancamentosContent } from "@/components/LancamentosContent";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TransactionEditForm } from "@/components/TransactionEditForm";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import DynamicIcon from "@/components/DynamicIcon";
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

const Lancamentos = () => {
  const isMobile = useIsMobile();
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  const {
    selectedMonth,
    setSelectedMonth,
    handlePreviousMonth,
    handleNextMonth,
    setEditingTransaction,
    setFullEditingRevenue,
    setFullEditingExpense,
    loadingEditData,
    loadingPayInvoice,
    setLoadingPayInvoice,
    isEditModalOpen,
    setIsEditModalOpen,
    monthlyFilteredTransactions,
    fetchedCategories,
    cartoes,
    isLoading,
    handleDeleteTransaction,
    handleEditTransaction,
    handleUpdateTransaction,
    handleCancelEdit,
    editingTransaction,
    fullEditingRevenue,
    fullEditingExpense,
    queryClient: logicQueryClient,
    filterPaymentOptionId,
    setFilterPaymentOptionId,
    handleOptimisticToggleStatus,
    refetchCartoes,
    // Estados e funções para o fluxo de exclusão
    showDeleteOptionsDialog,
    setShowDeleteOptionsDialog,
    showSimpleDeleteDialog,
    setShowSimpleDeleteDialog,
    selectedDeleteScope,
    setSelectedDeleteScope,
    pendingFutureItemsCount,
    isFetchingDeleteOptions,
    handleTriggerDeleteConfirmation,
    handleConfirmDeleteAction,
    // Estados e funções para o fluxo de salvamento (passados para TransactionEditForm)
    showSaveOptionsDialog,
    setShowSaveOptionsDialog,
    selectedSaveScope,
    setSelectedSaveScope,
  } = useLancamentosLogic(user, authLoading);

  console.log("Lancamentos.tsx: User from useAuth:", user?.id, "Is user null?", !user);
  
  if (authLoading || isLoading) {
    return <Loading />;
  }

  return (
    <ProtectedRoute>
      <div className={cn("min-h-screen bg-background pt-16 relative", isMobile && "bg-lancamentos-mobile-bg")}>
        <Navigation />
        <main className={cn("container mx-auto", isMobile ? "px-0 py-4" : "px-4 py-8")}>
          {!isMobile && (
            <h1 className="text-3xl font-bold mb-6">Histórico de Lançamentos</h1>
          )}
          
          <MonthNavigator
            selectedMonth={selectedMonth}
            onPreviousMonth={handlePreviousMonth}
            onNextMonth={handleNextMonth}
            isMobile={isMobile}
          />

          <LancamentosContent
            editingTransaction={editingTransaction}
            fullEditingRevenue={fullEditingRevenue}
            fullEditingExpense={fullEditingExpense}
            onUpdateTransaction={handleUpdateTransaction}
            onCancelEdit={handleCancelEdit}
            onDeleteTransaction={handleDeleteTransaction}
            allCategories={fetchedCategories}
            isMobile={isMobile}
            monthlyFilteredTransactions={monthlyFilteredTransactions}
            cartoes={cartoes}
            user={user}
            onEditTransaction={handleEditTransaction}
            queryClient={logicQueryClient} 
            filterPaymentOptionId={filterPaymentOptionId}
            setFilterPaymentOptionId={setFilterPaymentOptionId}
            loadingPayInvoice={loadingPayInvoice}
            setLoadingPayInvoice={setLoadingPayInvoice}
            selectedMonth={selectedMonth}
            setSelectedMonth={setSelectedMonth}
            onToggleTransactionStatus={handleOptimisticToggleStatus}
          />
        </main>
        <Footer isMobile={isMobile} />

        {/* Loading Overlay - aparece sobre a tela atual enquanto o modal de edição carrega */}
        {isEditModalOpen && loadingEditData && (
          <div className="absolute inset-0 z-[70] flex items-center justify-center bg-background/80 backdrop-blur-sm animate-fade-in">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        )}

        {/* Modal de Edição de Transação */}
        <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
          <DialogContent 
            className={cn(
              "w-full dialog-lg-close-button",
              isMobile ? "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm p-4 bg-lancamentos-mobile-bg max-h-[90vh] flex flex-col" : "sm:max-w-[600px] p-6",
              "data-[state=open]:animate-in data-[state=open]:fade-in data-[state=open]:zoom-in-95",
              "data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=closed]:zoom-out-95"
            )}
          >
            <DialogHeader className={cn("flex flex-row items-center justify-between", isMobile && "pt-6")}>
              <DialogTitle className={cn("text-xl", isMobile && "text-lg")}>
                ✏️ Editar Lançamento
              </DialogTitle>
              {/* REMOVIDO: Botão de exclusão ao lado do título em mobile */}
            </DialogHeader>
            {!loadingEditData && editingTransaction && (
              <TransactionEditForm
                editingTransaction={editingTransaction}
                onUpdateTransaction={handleUpdateTransaction}
                onCancelEdit={handleCancelEdit}
                onDeleteTransaction={handleDeleteTransaction}
                allCategories={fetchedCategories}
                isMobile={isMobile}
                cartoes={cartoes}
                refetchCartoes={refetchCartoes}
                // NOVO: Props para o fluxo de exclusão
                isFetchingDeleteOptions={isFetchingDeleteOptions}
                handleTriggerDeleteConfirmation={handleTriggerDeleteConfirmation}
                // NOVO: Props para o fluxo de salvamento
                showSaveOptionsDialog={showSaveOptionsDialog}
                setShowSaveOptionsDialog={setShowSaveOptionsDialog}
                selectedSaveScope={selectedSaveScope}
                setSelectedSaveScope={setSelectedSaveScope}
                handleConfirmSaveAction={handleUpdateTransaction} // Passa a função de atualização para o form
              />
            )}
          </DialogContent>
        </Dialog>

        {/* Diálogo de Confirmação para Exclusão de Despesa Avulsa */}
        <AlertDialog open={showSimpleDeleteDialog} onOpenChange={setShowSimpleDeleteDialog}>
          <AlertDialogContent className={cn("w-full", isMobile ? "max-w-[98vw] p-4 min-h-[180px]" : "sm:max-w-[425px]")}>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <DynamicIcon name="Trash2" className="h-6 w-6 text-destructive" />
                Confirmar Exclusão
              </AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir este lançamento? Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className={cn(
              "flex flex-col sm:flex-row justify-center gap-2",
              isMobile && "flex-row items-center justify-between"
            )}>
              <AlertDialogCancel
                disabled={isFetchingDeleteOptions}
                className={cn(
                  "rounded-xl",
                  isMobile && "h-10 text-sm flex-1 bg-soft-blue hover:bg-soft-blue/80 text-primary mt-0"
                )}
              >
                {isMobile && <DynamicIcon name="❌" className="mr-1 h-4 w-4" />}
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmDeleteAction} // Chama a nova função de confirmação
                disabled={isFetchingDeleteOptions}
                className={cn(
                  "bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-xl",
                  isMobile && "h-10 text-sm flex-1" 
                )}
              >
                {isMobile && <DynamicIcon name="🗑️" className="mr-1 h-4 w-4" />}
                {isFetchingDeleteOptions ? (
                  "Excluindo..."
                ) : (
                  "Excluir"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Diálogo de Confirmação para Exclusão de Despesa Parcelada/Recorrente */}
        <AlertDialog open={showDeleteOptionsDialog} onOpenChange={setShowDeleteOptionsDialog}>
          <AlertDialogContent className={cn("w-full", isMobile ? "max-w-[98vw] p-4 min-h-[180px]" : "sm:max-w-[425px]")}>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <DynamicIcon name="Trash2" className="h-6 w-6 text-destructive" />
                Excluir Lançamento Recorrente
              </AlertDialogTitle>
              <AlertDialogDescription>
                Este lançamento faz parte de uma série recorrente. Como você gostaria de excluí-lo?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-4">
              <RadioGroup
                value={selectedDeleteScope}
                onValueChange={(value: "thisMonth" | "thisMonthForward" | "all" | "oneOff") => setSelectedDeleteScope(value)}
                className="space-y-3 radio-fix-click"
              >
                <div className="flex items-center space-x-3">
                  <RadioGroupItem 
                    value="thisMonth" 
                    id="delete-this-month" 
                    className="peer data-[state=checked]:border-primary data-[state=checked]:after:bg-primary data-[state=checked]:ring-primary" 
                  />
                  <label htmlFor="delete-this-month" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Apenas este mês
                  </label>
                </div>
                <div className="flex items-center space-x-3">
                  <RadioGroupItem 
                    value="thisMonthForward" 
                    id="delete-this-month-forward" 
                    className="peer data-[state=checked]:border-primary data-[state=checked]:after:bg-primary data-[state=checked]:ring-primary" 
                  />
                  <label htmlFor="delete-this-month-forward" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Deste mês em diante
                  </label>
                </div>
                <div className="flex items-center space-x-3">
                  <RadioGroupItem 
                    value="all" 
                    id="delete-all" 
                    className="peer data-[state=checked]:border-primary data-[state=checked]:after:bg-primary data-[state=checked]:ring-primary" 
                  />
                  <label htmlFor="delete-all" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Todo o período
                  </label>
                </div>
              </RadioGroup>
            </div>
            <AlertDialogFooter className={cn("flex flex-col sm:flex-row justify-center gap-2", isMobile && "flex-row justify-between items-center")}>
              <AlertDialogCancel disabled={isFetchingDeleteOptions} className={cn("rounded-xl", isMobile && "h-10 text-xs flex-1 bg-soft-blue hover:bg-soft-blue/80 text-primary")}>
                <DynamicIcon name="XCircle" className={cn("mr-1 h-3.5 w-3.5", isMobile && "h-3 w-3 mr-0.5")} />
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmDeleteAction} disabled={isFetchingDeleteOptions} className={cn("w-full sm:w-auto bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-xl", isMobile && "h-10 text-xs flex-1")}>
                {isFetchingDeleteOptions ? "Excluindo..." : "Excluir"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </ProtectedRoute>
  );
};

export default Lancamentos;