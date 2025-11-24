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

const Lancamentos = () => {
  const isMobile = useIsMobile();
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  const {
    selectedMonth,
    setSelectedMonth, // Adicionado
    handlePreviousMonth,
    handleNextMonth,
    setEditingTransaction,
    setFullEditingRevenue,
    setFullEditingExpense,
    loadingEditData, // Mantido
    loadingPayInvoice,
    setLoadingPayInvoice,
    isEditModalOpen, // Mantido
    setIsEditModalOpen,
    monthlyFilteredTransactions,
    fetchedCategories,
    cartoes,
    isLoading, // Este é para o carregamento inicial da página
    handleDeleteTransaction,
    handleEditTransaction,
    handleUpdateTransaction,
    handleCancelEdit,
    editingTransaction, // Mantido
    fullEditingRevenue,
    fullEditingExpense,
    queryClient: logicQueryClient,
    filterPaymentOptionId,
    setFilterPaymentOptionId,
    handleOptimisticToggleStatus, // NOVO: Destruturar a nova função
    refetchCartoes, // NOVO: Obter refetchCartoes
  } = useLancamentosLogic(user, authLoading);

  console.log("Lancamentos.tsx: User from useAuth:", user?.id, "Is user null?", !user);
  
  // Apenas mostra o loading de página cheia para o carregamento inicial, não para o modal de edição
  if (authLoading || isLoading) { // Removido loadingEditData daqui
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
            selectedMonth={selectedMonth} // Adicionado
            setSelectedMonth={setSelectedMonth} // Adicionado
            onToggleTransactionStatus={handleOptimisticToggleStatus} // NOVO: Passar a função
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
              "w-full dialog-lg-close-button", // Adicionada a classe personalizada aqui
              isMobile ? "max-w-sm p-4 bg-lancamentos-mobile-bg min-h-[90vh]" : "sm:max-w-[600px] p-6", // NOVO: min-h-[90vh] para mobile
              // Animações para fade e scale
              "data-[state=open]:animate-in data-[state=open]:fade-in data-[state=open]:zoom-in-95",
              "data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=closed]:zoom-out-95"
            )}
          >
            <DialogHeader>
              <DialogTitle className={cn("text-xl", isMobile && "text-lg")}>
                ✏️ Editar Lançamento
              </DialogTitle>
            </DialogHeader>
            {/* Renderiza o formulário apenas quando editingTransaction estiver pronto e não estiver carregando dados */}
            {!loadingEditData && editingTransaction && (
              <TransactionEditForm
                editingTransaction={editingTransaction}
                onUpdateTransaction={handleUpdateTransaction}
                onCancelEdit={handleCancelEdit}
                onDeleteTransaction={handleDeleteTransaction}
                allCategories={fetchedCategories}
                isMobile={isMobile}
                cartoes={cartoes} // NOVO: Passando cartoes
                refetchCartoes={refetchCartoes} // NOVO: Passando refetchCartoes
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </ProtectedRoute>
  );
};

export default Lancamentos;