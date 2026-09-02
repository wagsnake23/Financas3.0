import { useEffect } from "react";
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

  useEffect(() => {
    if (isMobile) {
      window.scrollTo(0, 0);
    }
  }, [isMobile]);
  const { user } = useAuth();
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
    filterStatus,
    setFilterStatus,
    filterCategory,
    setFilterCategory,
    searchTerm,
    setSearchTerm,
    handleOptimisticToggleStatus,
    refetchCartoes,
    allRevenues,
    allExpenseInstallments,
  } = useLancamentosLogic(user);

  console.log(
    "Lancamentos.tsx: User from useAuth:",
    user?.id,
    "Is user null?",
    !user
  );

  if (isLoading) {
    return <Loading />;
  }

  return (
    <div
      className={cn(
        "flex flex-col relative",
        isMobile ? "pt-[calc(3.5rem+env(safe-area-inset-top))] bg-transparent text-black h-[100dvh] overflow-hidden" : "pt-[72px] global-bg min-h-screen"
      )}>

      {/* HEADER PREMIUM — FINTECH STYLE (LANCAMENTOS THEME) */}
      {!isMobile && (
        <div className="relative h-[220px] w-full overflow-hidden bg-transparent">
          <div className="container-app relative z-10 pt-[28px] md:pt-[42px] flex justify-between items-start">
            <div>
              <div className="flex items-start gap-3">
                <div
                  className="btn-3d btn-3d-icon p-2 rounded-xl flex items-center justify-center border-none cursor-default h-auto w-auto mt-1"
                  style={{ "--cor-topo": "#FFFFFF", "--cor-base": "#F1F5F9" } as any}
                >
                  <span className="text-xl select-none">🧾</span>
                </div>
                <div className="flex flex-col">
                  <h1 className="text-2xl font-extrabold text-[#1e3a8a] tracking-[0.5px] -mt-0.5" style={{ fontFamily: "'Inter', sans-serif" }}>
                    Lançamentos
                  </h1>
                  <p className="text-sm font-bold text-slate-500 -mt-0.5 tracking-wider opacity-80">
                    Registro de Despesas e Receitas
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-1 font-bold text-sm text-slate-500 hover:text-slate-800 transition-colors bg-transparent border-none outline-none focus:outline-none shadow-none mt-2 pr-4"
            >
              <DynamicIcon name="ArrowLeft" className="h-[18px] w-[18px]" strokeWidth={2.5} />
              Voltar
            </button>
          </div>
        </div>
      )}

      <main
        className={cn(
          "container-app relative z-20 flex-grow",
          isMobile ? "pt-0 pb-0 bg-[#FFFFFF] flex flex-col flex-1 min-h-0" : "-mt-[86px] pb-8 space-y-6"
        )}
      >
        <div className={cn("relative flex items-center justify-center w-full shrink-0", isMobile ? "mt-0 mb-4 h-8" : "-mt-[63px] mb-4 h-10")}>
          <MonthNavigator
            selectedMonth={selectedMonth}
            onPreviousMonth={handlePreviousMonth}
            onNextMonth={handleNextMonth}
            isMobile={isMobile}
            onBack={isMobile ? () => navigate(-1) : undefined}
            backButtonColor="#E54D4D"
            hasFiltersActive={filterType !== "all" || filterCategory !== "all" || filterPaymentOptionId !== "all" || filterStatus !== "all" || searchTerm !== ""}
            onClearFilters={() => {
              setFilterType("all");
              setFilterStatus("all");
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
          filterStatus={filterStatus}
          setFilterStatus={setFilterStatus}
          filterCategory={filterCategory}
          setFilterCategory={setFilterCategory}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
        />
      </main>
      {!isMobile && (
        <Footer
          isMobile={isMobile}
          className="mt-auto pt-8"
          user={user}
        />
      )}
      {isEditModalOpen && loadingEditData && (
        <div className="absolute inset-0 z-[70] flex items-center justify-center bg-background/80 backdrop-blur-sm animate-fade-in">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      )}
      <Dialog 
        open={isEditModalOpen} 
        onOpenChange={(open) => {
          if (!open) {
            handleCancelEdit();
          } else {
            setIsEditModalOpen(true);
          }
        }}
      >
        <style>{`
          .edit-lancamento-modal > button {
            transform: translate(3px, -3px) !important;
          }
        `}</style>
        <DialogContent
          className={cn(
            isMobile ? "dialog-mobile w-[calc(100%-4px)] max-w-[calc(100%-4px)] !rounded-[19px] !px-3 pb-4" : "sm:max-w-[425px] sm:max-h-[90vh] overflow-y-auto !rounded-[19px] sm:!pb-[19px]",
            "shadow-none border-none bg-[#FAFAFA] edit-lancamento-modal"
          )}
          style={{
            border: isMobile ? "2px solid #FFFFFF" : "none",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.6), inset 0 -8px 20px rgba(0,0,0,0.02), 0 20px 25px -5px rgba(0, 0, 0, 0.1)"
          }}
        >
          <DialogHeader
            className={cn(
              "flex flex-col items-start justify-start",
              isMobile ? "mb-[-6px]" : "mb-[2px]",
              isMobile && "absolute top-3.5 left-4 right-12 text-left",
              !isMobile && "-mt-2"
            )}
          >
            <div className="flex flex-row items-start gap-[11px] transition-all">
              <span className="text-[26px] select-none leading-none mt-0 md:mt-1">📝</span>
              <div className="flex flex-col gap-[5px] md:gap-[1px]">
                <DialogTitle className="text-xl md:text-2xl font-bold tracking-[-0.01em] pb-[1px] m-0 leading-none text-left" style={{ fontFamily: "'Inter', sans-serif" }}>Editar Lançamento</DialogTitle>
                {editingTransaction?.created_at && (
                  <p className="text-[11px] font-normal text-slate-500 leading-none">
                    Registrado em {format(new Date(editingTransaction.created_at), "dd MMM yyyy '•' HH:mm", { locale: ptBR })}
                  </p>
                )}
              </div>
            </div>
          </DialogHeader>

          {editingTransaction && (
            <div className={cn("form-body pb-0", isMobile && "pt-[18px]")}>
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
