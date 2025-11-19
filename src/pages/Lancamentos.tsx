import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Navigation } from "@/components/Navigation";
import Loading from "@/components/Loading";
import { useIsMobile } from "@/hooks/use-mobile";
import { Footer } from "@/components/Footer";
import { MonthNavigator } from "@/components/MonthNavigator"; // Re-adicionado
// import { EditInstallmentModal } from "@/components/EditInstallmentModal"; // Removido
import { DeleteRecurrenceModal } from "@/components/DeleteRecurrenceModal";
import { useLancamentosLogic } from "@/hooks/useLancamentosLogic";
import { LancamentosContent } from "@/components/LancamentosContent";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query"; // Importar useQueryClient
import { Card } from "@/components/ui/card"; // Importar Card para o fallback

const Lancamentos = () => {
  const isMobile = useIsMobile();
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient(); // Obter o queryClient aqui

  const {
    selectedMonth,
    setSelectedMonth,
    handlePreviousMonth, // Re-adicionado
    handleNextMonth,     // Re-adicionado
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
    // expenseInstallments, // Removido
    isLoading,
    handleDeleteTransaction,
    handleEditTransaction,
    handleUpdateTransaction,
    editingTransaction,
    fullEditingRevenue,
    fullEditingExpense,
    queryClient: logicQueryClient, // Receber o queryClient do hook
    confirmDeleteWithOptions, // Receber a nova função de exclusão
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
          
          {/* MonthNavigator re-adicionado */}
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
            monthlyFilteredTransactions={transactions}
            cartoes={cartoes}
            user={user}
            // rawExpenseInstallments={expenseInstallments} // Removido
            // selectedMonth={selectedMonth} // Removido
            onEditTransaction={handleEditTransaction}
            // Passando o queryClient aqui
            queryClient={logicQueryClient} 
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
          onClose={() => {
            setIsDeleteRecurrenceModalOpen(false);
            handleCancelEdit(); // Fechar o formulário de edição quando o modal de exclusão fecha
          }}
          transaction={selectedRecurringTransaction}
          isMobile={isMobile}
          // fetchedCategories={fetchedCategories} // Removido
          onConfirmDeleteWithOptions={confirmDeleteWithOptions} // Passar a nova função
        />
      </div>
    </ProtectedRoute>
  );
};

export default Lancamentos;