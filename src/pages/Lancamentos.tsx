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
import { TotalRevenueCard } from "@/components/TotalRevenueCard";
import { TotalExpensesCard } from "@/components/TotalExpensesCard";
import { MonthlyRevenueBarChart } from "@/components/MonthlyRevenueBarChart";
import { MonthlyExpenseBarChart } from "@/components/MonthlyExpenseBarChart";

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
    filterType,
    setFilterType,
    filterCategory,
    setFilterCategory,
    handleOptimisticToggleStatus,
    refetchCartoes,
    allRevenues,
    allExpenseInstallments,
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
    <div
      className={cn(
        "flex flex-col min-h-screen bg-background pt-16 relative",
        isMobile ? "bg-gray-50 text-black h-screen overflow-hidden" : "bg-background"
      )}>
      <Navigation />
      <main
        className={cn(
          "container mx-auto flex-grow",
          isMobile ? "px-0 pt-2 pb-0 flex flex-col min-h-0" : "max-w-[1200px] px-6 py-8"
        )}
      >
        {!isMobile && (
          <h1 className="text-3xl font-bold mb-6">Histórico de Lançamentos</h1>
        )}

        <MonthNavigator
          selectedMonth={selectedMonth}
          onPreviousMonth={handlePreviousMonth}
          onNextMonth={handleNextMonth}
          isMobile={isMobile}
          hasFiltersActive={filterType !== "all" || filterCategory !== "all" || filterPaymentOptionId !== "all"}
          onClearFilters={() => {
            setFilterType("all");
            setFilterCategory("all");
            setFilterPaymentOptionId("all");
          }}
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
          filterType={filterType}
          setFilterType={setFilterType}
          filterCategory={filterCategory}
          setFilterCategory={setFilterCategory}
        />
      </main>
      <Footer
        isMobile={isMobile}
        className={cn(isMobile ? "fixed bottom-0 left-0 right-0 py-2 bg-transparent backdrop-blur-sm z-50 m-0" : "mt-8")}
        user={user}
      />{" "}
      {/* Passando a prop user */}
      {isEditModalOpen && loadingEditData && (
        <div className="absolute inset-0 z-[70] flex items-center justify-center bg-background/80 backdrop-blur-sm animate-fade-in">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      )}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent
          className={cn(
            "rounded-xl", // Adicionado rounded-xl aqui
            isMobile
              ? "w-full dialog-mobile"
              : "sm:max-w-[400px] sm:max-h-[90vh] overflow-y-auto",
            editingTransaction?.type === "expense" && "bg-gradient-to-b from-[#FEF9C3] to-[#FFFFFF]", // Aplica a cor de fundo para despesas
            editingTransaction?.type === "income" && "bg-gradient-to-b from-[#E0F2FE] to-[#FFFFFF]" // Aplica a cor de fundo para receitas
          )}
        >
          <DialogHeader
            className={cn(
              isMobile && "absolute top-4 left-4 right-12 text-left"
            )}
          >
            <DialogTitle className="text-center w-full">✏️ Editar Lançamento</DialogTitle>
          </DialogHeader>

          {!loadingEditData && editingTransaction && (
            <div className="form-body">
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
  );
};

export default Lancamentos;