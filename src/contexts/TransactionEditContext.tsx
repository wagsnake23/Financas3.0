import React, { createContext, useContext, useState, useCallback, useMemo } from "react";
import { Transaction } from "@/types/finance";
import { TransactionEditForm } from "@/components/TransactionEditForm";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppCategory } from "@/types/finance";
import { useTransactionMutations } from "@/hooks/useTransactionMutations";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import DynamicIcon from "@/components/DynamicIcon";
import { NfceDetailsModal } from "@/components/NfceDetailsModal";
import { Button } from "@/components/ui/button";
import { useCategories } from "@/hooks/useCategories";

interface TransactionEditContextType {
  openEditModal: (transaction: Transaction) => void;
  closeEditModal: () => void;
}

const TransactionEditContext = createContext<TransactionEditContextType | undefined>(undefined);

export const useTransactionEdit = () => {
  const context = useContext(TransactionEditContext);
  if (!context) {
    throw new Error("useTransactionEdit must be used within a TransactionEditProvider");
  }
  return context;
};

export const TransactionEditProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [loadingEditData, setLoadingEditData] = useState(false);
  const [viewNfceId, setViewNfceId] = useState<string | null>(null);

  // Check if current edited transaction is from an NFC-e
  const { data: linkedNfceId } = useQuery({
    queryKey: ["linkedNfce", editingTransaction?.id],
    queryFn: async () => {
      if (!editingTransaction?.id) return null;
      
      const mestreId = editingTransaction.despesa_id || editingTransaction.id;
      
      try {
        const { data: nfceCompra, error } = await (supabase as any)
          .from("nfce_compras")
          .select("id, status_importacao, despesa_id")
          .eq("despesa_id", mestreId)
          .eq("status_importacao", "processada")
          .limit(1)
          .maybeSingle();
        
        return error ? null : (nfceCompra?.id || null);
      } catch (err) {
        return null;
      }
    },
    enabled: !!editingTransaction?.id,
  });

  // Fetch Categories via SSOT
  const { data: allCategories = [] } = useCategories(user?.id);

  // Fetch Cartões
  const { data: cartoes = [], refetch: refetchCartoes } = useQuery({
    queryKey: ["cartoes", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("cartoes")
        .select("*")
        .eq("user_id", user.id)
        .order("nome");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Simulated monthlyFilteredTransactions with just the currently editing transaction
  // This is required by useTransactionMutations to find the original transaction
  const simulatedFilteredTransactions = useMemo(() => {
    return editingTransaction ? [editingTransaction] : [];
  }, [editingTransaction]);

  const {
    handleUpdateTransaction,
    handleDeleteTransaction,
  } = useTransactionMutations({
    user,
    queryClient,
    monthlyFilteredTransactions: simulatedFilteredTransactions,
    setLoadingEditData,
    setEditingTransaction,
    setIsEditModalOpen,
    selectedMonth: new Date(), // Just a fallback, mainly used for local state resets
  });

  const openEditModal = useCallback((transaction: Transaction) => {
    setEditingTransaction(transaction);
    setIsEditModalOpen(true);
  }, []);

  const closeEditModal = useCallback(() => {
    setIsEditModalOpen(false);
    setTimeout(() => {
      setEditingTransaction(null);
    }, 300);
  }, []);

  return (
    <TransactionEditContext.Provider value={{ openEditModal, closeEditModal }}>
      {children}
      
      {isEditModalOpen && editingTransaction && (
        <Dialog open={isEditModalOpen} onOpenChange={closeEditModal}>
          <style>{`
            .edit-lancamento-modal > button {
              transform: translate(3px, -3px) !important;
            }
          `}</style>
          <DialogContent
            className={
              window.innerWidth < 768 
                ? "dialog-mobile w-[calc(100%-4px)] max-w-[calc(100%-4px)] !rounded-[19px] !px-3 pb-4 shadow-sm border-none bg-[#FAFAFA] edit-lancamento-modal" 
                : "sm:max-w-[415px] sm:max-h-[90vh] overflow-y-auto !rounded-[19px] sm:!pb-[19px] sm:!px-[19px] shadow-sm border-none bg-[#FAFAFA] edit-lancamento-modal"
            }
            style={{
              border: window.innerWidth < 768 ? "2px solid #FFFFFF" : "none",
              boxShadow: "0 8px 30px rgba(0, 0, 0, 0.08)"
            }}
          >
            <div className={
                window.innerWidth < 768
                  ? "flex flex-col items-start justify-start mb-[-6px] absolute top-3.5 left-4 right-12 text-left"
                  : "flex flex-col items-start justify-start mb-[2px] -mt-2"
              }
            >
              <div className="flex flex-col w-full transition-all gap-[3px] md:gap-0 pr-6">
                <div className="flex flex-row items-center justify-start gap-2 w-full">
                  <h2 className="text-[19px] md:text-[21px] font-extrabold text-[#1765D8] tracking-[0.2px] pb-[1px] m-0 leading-none text-left shrink truncate" style={{ fontFamily: "'Inter', sans-serif" }}>Editar Lançamento</h2>
                  {linkedNfceId && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-auto py-[4px] px-2 bg-white hover:bg-[#F8FAFC] text-[#0556C3] hover:text-[#04449C] shadow-none border border-[rgba(15,23,42,0.08)] hover:border-[rgba(15,23,42,0.15)] shrink-0 flex items-center gap-[3px] transition-colors rounded-[8px] mt-[1px]"
                      onClick={() => setViewNfceId(linkedNfceId)}
                    >
                      <DynamicIcon name="Receipt" className="w-[14px] h-[14px]" />
                      <span className="text-[12px] font-bold tracking-wide leading-none pt-[1px]">Nota</span>
                    </Button>
                  )}
                </div>
                {editingTransaction.created_at && (
                  <span className="text-[11px] font-medium text-[#718096] tracking-tight leading-none mt-1">
                    Registrado em: {format(new Date(editingTransaction.created_at), "ddMMMMyyyy 'as' HH:mm", { locale: ptBR })
                      .replace('janeiro', 'jan')
                      .replace('fevereiro', 'fev')
                      .replace('março', 'mar')
                      .replace('abril', 'abr')
                      .replace('maio', 'mai')
                      .replace('junho', 'jun')
                      .replace('julho', 'jul')
                      .replace('agosto', 'ago')
                      .replace('setembro', 'set')
                      .replace('outubro', 'out')
                      .replace('novembro', 'nov')
                      .replace('dezembro', 'dez')}
                  </span>
                )}
              </div>
            </div>

            <div className={window.innerWidth < 768 ? "form-body pb-0 pt-[18px]" : "form-body pb-0"}>
              <TransactionEditForm
                editingTransaction={editingTransaction}
                onUpdateTransaction={handleUpdateTransaction}
                onCancelEdit={closeEditModal}
                onDeleteTransaction={handleDeleteTransaction}
                allCategories={allCategories}
                isMobile={window.innerWidth < 768}
                cartoes={cartoes}
                refetchCartoes={refetchCartoes}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}

      <NfceDetailsModal
        open={!!viewNfceId}
        onOpenChange={(open) => !open && setViewNfceId(null)}
        compraId={viewNfceId}
      />
    </TransactionEditContext.Provider>
  );
};
