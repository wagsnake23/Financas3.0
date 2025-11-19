import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Navigation } from "@/components/Navigation";
import Loading from "@/components/Loading";
import { useIsMobile } from "@/hooks/use-mobile";
import { Footer } from "@/components/Footer";
import { MonthNavigator } from "@/components/MonthNavigator";
// import { EditInstallmentModal } from "@/components/EditInstallmentModal"; // Removido
import { DeleteRecurrenceModal } from "@/components/DeleteRecurrenceModal";
import { useLancamentosLogic } from "@/hooks/useLancamentosLogic";
import { LancamentosContent } from "@/components/LancamentosContent";
import { useAuth } from "@/hooks/useAuth";

const Lancamentos = () => {
  const isMobile = useIsMobile();
  const { user, loading: authLoading } = useAuth();

  const {
    selectedMonth,
    setEditingTransaction,
    setFullEditingRevenue,
    setFullEditingExpense,
    loadingEditData,
    // isEditInstallmentModalOpen, // Removido
    // setIsEditInstallmentModalOpen, // Removido
    isDeleteRecurrenceModalOpen,
    setIsDeleteRecurrenceModalOpen,
    selectedRecurringTransaction, // Agora é para exclusão
    monthlyFilteredTransactions: transactions,
    fetchedCategories,
    cartoes,
    expenseInstallments,
    isLoading,
    handlePreviousMonth,
    handleNextMonth,
    handleDeleteTransaction,
    handleEditTransaction,
    handleUpdateTransaction,
    editingTransaction,
    fullEditingRevenue,
    fullEditingExpense,
  } = useLancamentosLogic(user);

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
          
          {!editingTransaction && (
            <div className="mb-4">
              <MonthNavigator
                selectedMonth={selectedMonth}
                onPreviousMonth={handlePreviousMonth}
                onNextMonth={handleNextMonth}
                isMobile={isMobile}
              />
            </div>
          )}

          <LancamentosContent
            editingTransaction={editingTransaction}
            fullEditingRevenue={fullEditingRevenue}
            fullEditingExpense={fullEditingExpense}
            onUpdateTransaction={handleUpdateTransaction}
            onCancelEdit={handleCancelEdit}
            onDeleteTransaction={handleDeleteTransaction}
            allCategories={fetchedCategories}
            isMobile={isMobile}
            monthlyFilteredTransactions={transactions}
            cartoes={cartoes}
            user={user}
            rawExpenseInstallments={expenseInstallments}
            selectedMonth={selectedMonth}
            onEditTransaction={handleEditTransaction}
          />
        </main>
        <Footer isMobile={isMobile} />

        {/* O modal de edição foi removido, a lógica está agora no TransactionEditForm */}
        {/* <EditInstallmentModal
          isOpen={isEditInstallmentModalOpen}
          onClose={() => setIsEditInstallmentModalOpen(false)}
          transaction={selectedRecurringTransaction}
          isMobile={isMobile}
          fetchedCategories={fetchedCategories}
        /> */}
        <DeleteRecurrenceModal
          isOpen={isDeleteRecurrenceModalOpen}
          onClose={() => setIsDeleteRecurrenceModalOpen(false)}
          transaction={selectedRecurringTransaction}
          isMobile={isMobile}
          fetchedCategories={fetchedCategories}
        />
      </div>
    </ProtectedRoute>
  );
};

export default Lancamentos;