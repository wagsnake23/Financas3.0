import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Navigation } from "@/components/Navigation";
import Loading from "@/components/Loading";
import { useIsMobile } from "@/hooks/use-mobile";
import { Footer } from "@/components/Footer";
import { MonthNavigator } from "@/components/MonthNavigator";
import { DeleteRecurrenceModal } from "@/components/DeleteRecurrenceModal";
import { useLancamentosLogic } from "@/hooks/useLancamentosLogic";
import { LancamentosContent } from "@/components/LancamentosContent";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";

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
    loadingPayInvoice, // NOVO: Receber loadingPayInvoice
    setLoadingPayInvoice, // NOVO: Receber setter
    isDeleteRecurrenceModalOpen,
    setIsDeleteRecurrenceModalOpen,
    selectedRecurringTransaction,
    monthlyFilteredTransactions,
    fetchedCategories,
    cartoes,
    isLoading,
    handleDeleteTransaction,
    handleEditTransaction,
    handleUpdateTransaction,
    editingTransaction,
    fullEditingRevenue,
    fullEditingExpense,
    queryClient: logicQueryClient,
    confirmDeleteWithOptions,
    markMonthPaid,
    filterPaymentOptionId,
    setFilterPaymentOptionId,
  } = useLancamentosLogic(user, authLoading);

  console.log("Lancamentos.tsx: User from useAuth:", user?.id, "Is user null?", !user);

  const handleCancelEdit = () => {
    setEditingTransaction(null);
    setFullEditingRevenue(null);
    setFullEditingExpense(null);
  };
  
  if (authLoading || isLoading || loadingEditData) {
    return <Loading />;
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background pt-16">
        <Navigation />
        <main className="container mx-auto px-4 py-8">
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
            confirmDeleteWithOptions={confirmDeleteWithOptions}
            markMonthPaid={markMonthPaid}
            filterPaymentOptionId={filterPaymentOptionId}
            setFilterPaymentOptionId={setFilterPaymentOptionId}
            loadingPayInvoice={loadingPayInvoice} // NOVO
            setLoadingPayInvoice={setLoadingPayInvoice} // NOVO
          />
        </main>
        <Footer isMobile={isMobile} />

        <DeleteRecurrenceModal
          isOpen={isDeleteRecurrenceModalOpen}
          onClose={() => {
            setIsDeleteRecurrenceModalOpen(false);
            handleCancelEdit();
          }}
          transaction={selectedRecurringTransaction}
          isMobile={isMobile}
          onConfirmDeleteWithOptions={confirmDeleteWithOptions}
        />
      </div>
    </ProtectedRoute>
  );
};

export default Lancamentos;