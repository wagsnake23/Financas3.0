import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Navigation } from "@/components/Navigation";
import Loading from "@/components/Loading";
import { useIsMobile } from "@/hooks/use-mobile";
import { Footer } from "@/components/Footer";
import { MonthNavigator } from "@/components/MonthNavigator";
import { DeleteRecurrenceModal } from "@/components/DeleteRecurrenceModal";
import { useLancamentosState } from "@/hooks/useLancamentosLogic";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTransactionsData } from "@/hooks/useTransactionsData"; // Importar useTransactionsData
import { useTransactionMutations } from "@/hooks/useTransactionMutations"; // Importar useTransactionMutations

const Lancamentos = () => {
  const isMobile = useIsMobile();
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  const {
    selectedMonth,
    setSelectedMonth,
    handlePreviousMonth,
    handleNextMonth,
    editingTransaction,
    setEditingTransaction,
    fullEditingRevenue,
    setFullEditingRevenue,
    fullEditingExpense,
    setFullEditingExpense,
    loadingEditData,
    setLoadingEditData,
    loadingPayInvoice,
    setLoadingPayInvoice,
    isEditModalOpen,
    setIsEditModalOpen,
    isDeleteRecurrenceModalOpen,
    setIsDeleteRecurrenceModalOpen,
    selectedRecurringTransactionForDelete,
    setSelectedRecurringTransactionForDelete, // Adicionado aqui
    filterPaymentOptionId,
    setFilterPaymentOptionId,
    filterType,
    setFilterType,
    handleCancelEdit,
  } = useLancamentosState(); // Não precisa de user e authLoading aqui

  const {
    monthlyFilteredTransactions,
    fetchedCategories,
    cartoes,
    isLoading: isLoadingTransactionsData,
  } = useTransactionsData({ user, selectedMonth, enabled: !!user && !authLoading });

  const {
    confirmDeleteWithOptions,
    handleDeleteTransaction,
    handleUpdateTransaction,
  } = useTransactionMutations({
    user,
    queryClient,
    monthlyFilteredTransactions,
    setLoadingEditData,
    setIsDeleteRecurrenceModalOpen,
    setEditingTransaction,
    setIsEditModalOpen,
    setSelectedRecurringTransactionForDelete,
    selectedMonth,
    fetchedCategories, // Passar fetchedCategories
    cartoes, // Passar cartoes
  });

  // Função para abrir o modal de edição
  const handleEditTransaction = (transaction: any) => {
    setEditingTransaction(transaction);
    setIsEditModalOpen(true);
  };

  if (authLoading || isLoadingTransactionsData || loadingEditData) {
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
          
          <div className="space-y-8"> 
            {/* Top row of controls: Month Navigator and Type Filter */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-start gap-4 mb-8">
              <MonthNavigator
                selectedMonth={selectedMonth}
                onPreviousMonth={handlePreviousMonth}
                onNextMonth={handleNextMonth}
                isMobile={isMobile}
              />
              <Select value={filterType} onValueChange={setFilterType} disabled={isLoadingTransactionsData}>
                <SelectTrigger className="rounded-xl lg:w-[150px]">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  <SelectItem value="income">Receita</SelectItem>
                  <SelectItem value="expense">Despesa</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* LancamentosContent agora ocupará a largura total do contêiner principal */}
            <LancamentosContent
              editingTransaction={editingTransaction}
              fullEditingRevenue={fullEditingRevenue}
              fullEditingExpense={fullEditingExpense}
              onUpdateTransaction={handleUpdateTransaction}
              onCancelEdit={handleCancelEdit}
              onDeleteTransaction={handleDeleteTransaction}
              allCategories={fetchedCategories} // Passar fetchedCategories do useTransactionsData
              isMobile={isMobile}
              monthlyFilteredTransactions={monthlyFilteredTransactions} // Passar monthlyFilteredTransactions do useTransactionsData
              cartoes={cartoes} // Passar cartoes do useTransactionsData
              user={user}
              onEditTransaction={handleEditTransaction}
              queryClient={queryClient} // Usar o queryClient principal
              confirmDeleteWithOptions={confirmDeleteWithOptions}
              // markMonthPaid={markMonthPaid} // markMonthPaid vem do useRecurringEntries, que é usado dentro de useTransactionMutations
              filterPaymentOptionId={filterPaymentOptionId}
              setFilterPaymentOptionId={setFilterPaymentOptionId}
              loadingPayInvoice={loadingPayInvoice}
              setLoadingPayInvoice={setLoadingPayInvoice}
              filterType={filterType}
              setFilterType={setFilterType}
            />
          </div>
        </main>
        <Footer isMobile={isMobile} />

        {/* Modal de Edição de Transação */}
        <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>
                {editingTransaction?.isRecurring ? "Editar Lançamento Recorrente" : "Editar Lançamento"}
              </DialogTitle>
            </DialogHeader>
            {editingTransaction && (
              <TransactionEditForm
                editingTransaction={editingTransaction}
                onUpdateTransaction={handleUpdateTransaction}
                onCancelEdit={handleCancelEdit}
                onDeleteTransaction={handleDeleteTransaction}
                allCategories={fetchedCategories}
                isMobile={isMobile}
              />
            )}
          </DialogContent>
        </Dialog>

        <DeleteRecurrenceModal
          isOpen={isDeleteRecurrenceModalOpen}
          onClose={() => {
            setIsDeleteRecurrenceModalOpen(false);
            handleCancelEdit();
          }}
          transaction={selectedRecurringTransactionForDelete}
          isMobile={isMobile}
          onConfirmDeleteWithOptions={confirmDeleteWithOptions}
        />
      </div>
    </ProtectedRoute>
  );
};

export default Lancamentos;