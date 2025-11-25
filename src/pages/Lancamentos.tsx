import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Navigation } from "@/components/Navigation";
import Loading from "@/components/Loading";
import { useIsMobile } from "@/hooks/use-mobile";
import { Footer } from "@/components/Footer";
import { MonthNavigator } from "@/components/MonthNavigator";
import { useLancamentosLogic } from "@/hooks/useLancamentosLogic";
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
import { LancamentosContent } from "@/components/LancamentosContent";

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
  } = useLancamentosLogic(user, authLoading);

  console.log(
    "Lancamentos.tsx: User from useAuth:",
    user?.id,
    "Is user null?",
    !user
  );

  if (authLoading || isLoading) {
    return <Loading />;
  }

  return (
    <ProtectedRoute>
      <div
        className={cn(
          "min-h-screen bg-background pt-16 relative",
          isMobile && "bg-lancamentos-mobile-bg"
        )}
      >
        <Navigation />

        <main
          className={cn(
            "container mx-auto",
            isMobile ? "px-0 py-4" : "px-4 py-8"
          )}
        >
          {!isMobile && (
            <h1 className="text-3xl font-bold mb-6">
              Histórico de Lançamentos
            </h1>
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

        {isEditModalOpen && loadingEditData && (
          <div className="absolute inset-0 z-[70] flex items-center justify-center bg-background/80 backdrop-blur-sm animate-fade-in">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        )}

        <Dialog
          open={isEditModalOpen}
          onOpenChange={setIsEditModalOpen}
        >
          <DialogContent className={cn(
            isMobile
              ? "max-w-[100vw] p-3 pt-4 pb-2 max-h-[92vh] overflow-hidden"
              : "sm:max-w-lg p-6"
          )}>
            <DialogHeader className={cn(isMobile && "sticky top-0 z-20 bg-background pb-2")}>
              <DialogTitle>
                ✏️ Editar Lançamento
              </DialogTitle>
            </DialogHeader>

            {!loadingEditData && editingTransaction && (
              <div className={cn(isMobile ? "mt-[-8px]" : "mt-2")}>
                <TransactionEditForm
                  editingTransaction={editingTransaction}
                  onUpdateTransaction={handleUpdateTransaction}
                  onCancelEdit={handleCancelEdit}
                  onDeleteTransaction={handleDeleteTransaction}
                  allCategories={fetchedCategories}
                  isMobile={isMobile}
                  cartoes={cartoes}
                  refetchCartoes={refetchCartoes}
                />
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </ProtectedRoute>
  );
};

export default Lancamentos;