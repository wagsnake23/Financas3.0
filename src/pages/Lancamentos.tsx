import { Navigation } from "@/components/Navigation";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import DynamicIcon from "@/components/DynamicIcon";
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
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const Lancamentos = () => {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
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
    searchTerm,
    setSearchTerm,
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
        "flex flex-col min-h-screen bg-background relative",
        isMobile ? "pt-14 bg-gray-50 text-black h-screen overflow-hidden" : "pt-16 bg-background"
      )}>
      <Navigation />
      <main
        className={cn(
          "container mx-auto flex-grow",
          isMobile ? "px-0 pt-0 pb-0 flex flex-col min-h-0" : "max-w-[1200px] px-6 pt-0 pb-8"
        )}
      >


        <div className={cn("relative flex items-center justify-center w-full", isMobile ? "mt-0 mb-4 h-8 px-4" : "mt-3 mb-6 h-10")}>
          <MonthNavigator
            selectedMonth={selectedMonth}
            onPreviousMonth={handlePreviousMonth}
            onNextMonth={handleNextMonth}
            isMobile={isMobile}
            onBack={() => navigate(-1)}
            backButtonColor="#E54D4D"
            hasFiltersActive={filterType !== "all" || filterCategory !== "all" || filterPaymentOptionId !== "all" || searchTerm !== ""}
            onClearFilters={() => {
              setFilterType("all");
              setFilterCategory("all");
              setFilterPaymentOptionId("all");
              setSearchTerm("");
            }}
          />
        </div>

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
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
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
             isMobile ? "dialog-mobile w-[99%] max-w-[99%] !rounded-[25px] !px-3 pb-4" : "sm:max-w-[425px] sm:max-h-[90vh] overflow-y-auto !rounded-[25px]",
             "shadow-none border-none"
          )}
          style={{
            background: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)",
            backgroundBlendMode: "soft-light",
            backdropFilter: "blur(6px)",
            border: "2px solid rgba(37, 99, 235, 0.25)",
            outline: "1px solid rgba(37, 99, 235, 0.10)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.6), inset 0 -8px 20px rgba(0,0,0,0.03), inset 0 0 18px rgba(37, 99, 235, 0.12)"
          }}
        >
          <DialogHeader
            className={cn(
              "flex flex-col items-start justify-start gap-0 space-y-0",
              isMobile && "absolute top-3.5 left-4 right-12 text-left",
              !isMobile && "-mt-4"
            )}
          >
            <div className="flex flex-row items-center gap-1.5 transition-all">
              <span className="text-2xl select-none mr-0.5">📝</span>
              <DialogTitle className="text-xl font-bold pb-[1px] m-0 leading-none text-left text-[#1e3a8a]">Editar Lançamento</DialogTitle>
            </div>
            {editingTransaction?.created_at && (
              <p className={cn("text-[13px] font-medium text-slate-500", !isMobile ? "mt-1" : "mt-0.5 ml-[42px] -mt-[14px]")}>
                Registrado em: {format(new Date(editingTransaction.created_at), "dd MMM yyyy 'as' HH:mm", { locale: ptBR })}
              </p>
            )}
          </DialogHeader>

          {!loadingEditData && editingTransaction && (
            <div className={cn("form-body pb-0", isMobile && "pt-6")}>
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
    </div >
  );
};

export default Lancamentos;