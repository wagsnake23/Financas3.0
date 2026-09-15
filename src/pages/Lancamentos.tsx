import { useEffect, useState } from "react";
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
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { NfceDetailsModal } from "@/components/NfceDetailsModal";
import { useTransactionEdit } from "@/contexts/TransactionEditContext";

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
  const { openEditModal } = useTransactionEdit();

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

  const [viewNfceId, setViewNfceId] = useState<string | null>(null);

  // Check if current edited transaction is from an NFC-e
  const { data: linkedNfceId } = useQuery({
    queryKey: ["linkedNfce", editingTransaction?.id],
    queryFn: async () => {
      if (!editingTransaction?.id) return null;
      
      const mestreId = editingTransaction.despesa_id || editingTransaction.id;
      
      console.log('[NFCE] editingTransaction.id', editingTransaction.id);
      console.log('[NFCE] editingTransaction.despesa_id', editingTransaction.despesa_id);
      console.log('[NFCE] query despesa_id (mestre)', mestreId);
      
      try {
        const { data: nfceCompra, error } = await (supabase as any)
          .from("nfce_compras")
          .select("id, status_importacao, despesa_id")
          .eq("despesa_id", mestreId)
          .eq("status_importacao", "processada")
          .limit(1)
          .maybeSingle();
        
        if (error) {
          console.error('[NFCE] error full', error);
        }
        
        return error ? null : (nfceCompra?.id || null);
      } catch (err) {
        console.error('[NFCE] error full', err);
        return null;
      }
    },
    enabled: !!editingTransaction?.id,
  });

  console.log(
    "Lancamentos.tsx: User from useAuth:",
    user?.id,
    "Is user null?",
    !user
  );



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
          isMobile ? "pt-0 pb-0 flex flex-col flex-1 min-h-0" : "-mt-[86px] pb-8 space-y-6"
        )}
        style={isMobile ? {
          background: "linear-gradient(180deg, #FAFAFA 0%, #FAFAFA 48px, #FFFFFF 110px, #FFFFFF 100%)"
        } : undefined}
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
          onEditTransaction={openEditModal}
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
          isLoading={isLoading}
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
      
      <NfceDetailsModal
        open={!!viewNfceId}
        onOpenChange={(open) => !open && setViewNfceId(null)}
        compraId={viewNfceId}
      />
    </div >
  );
};

export default Lancamentos;
