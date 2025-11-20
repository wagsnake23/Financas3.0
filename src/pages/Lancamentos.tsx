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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"; // Importar componentes do Dialog
import { TransactionEditForm } from "@/components/TransactionEditForm"; // Importar TransactionEditForm
import { cn } from "@/lib/utils"; // Importar cn para classes condicionais

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
    isEditModalOpen, // NOVO: Receber isEditModalOpen
    setIsEditModalOpen, // NOVO: Receber setIsEditModalOpen
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
    handleCancelEdit, // NOVO: Receber handleCancelEdit
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
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8"> {/* Layout de grade */}
            <div className="lg:col-span-1"> {/* Coluna da esquerda para o MonthNavigator */}
              <div className="max-w-xs mx-auto lg:mx-0"> {/* Limita a largura e centraliza em mobile, alinha à esquerda em desktop */}
                <MonthNavigator
                  selectedMonth={selectedMonth}
                  onPreviousMonth={handlePreviousMonth}
                  onNextMonth={handleNextMonth}
                  isMobile={isMobile}
                />
              </div>
            </div>
            <div className="lg:col-span-1"> {/* Coluna da direita para o conteúdo principal */}
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
                loadingPayInvoice={loadingPayInvoice}
                setLoadingPayInvoice={setLoadingPayInvoice}
              />
            </div>
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
          transaction={selectedRecurringTransaction}
          isMobile={isMobile}
          onConfirmDeleteWithOptions={confirmDeleteWithOptions}
        />
      </div>
    </ProtectedRoute>
  );
};

export default Lancamentos;