import React, { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import DynamicIcon from "@/components/DynamicIcon";
import { Transaction, AppCategory, TransactionType } from "@/types/finance";
import { cn, isValidUuid, getBorderClass } from "@/lib/utils"; // Importar isValidUuid e getBorderClass
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { X } from "lucide-react";
import { Database, Tables } from "@/integrations/supabase/types"; // Importar Tables
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client"; // Importar supabase

import { TransactionOneOffFields } from "./edit-transaction-modal/TransactionOneOffFields";
import { TransactionEditActions } from "./edit-transaction-modal/TransactionEditActions";

type ReceitaStatus = Database["public"]["Enums"]["receita_status"];
type DeleteScope = "thisMonth" | "thisMonthForward" | "all" | "oneOff"; // 'oneOff' para transações avulsas
type SaveScope = "thisMonth" | "thisMonthForward" | "all" | "oneOff"; // 'oneOff' para transações avulsas

interface TransactionEditFormProps {
  editingTransaction: Transaction | null;
  onUpdateTransaction: (
    id: string,
    type: TransactionType,
    updatedTransaction: Omit<Transaction, "id">,
    saveScope: SaveScope // Adicionado saveScope
  ) => void;
  onCancelEdit: () => void;
  // REMOVIDO: onDeleteTransaction: (id: string, type: TransactionType, deleteScope: DeleteScope) => void;
  allCategories: AppCategory[];
  cartoes: Tables<'cartoes'>[]; // NOVO: Adicionado cartoes
  refetchCartoes: () => void; // NOVO: Adicionado refetchCartoes
  isMobile: boolean;
  // NOVO: Props para o fluxo de exclusão (agora vêm do pai)
  isFetchingDeleteOptions: boolean;
  handleTriggerDeleteConfirmation: () => void;
  // NOVO: Props para o fluxo de salvamento
  showSaveOptionsDialog: boolean;
  setShowSaveOptionsDialog: (show: boolean) => void;
  selectedSaveScope: SaveScope;
  setSelectedSaveScope: (scope: SaveScope) => void;
  handleConfirmSaveAction: (scope: SaveScope) => void; // Nova prop para confirmar o salvamento
}

const UNSELECTED_VALUE = "unselected";

// Helper function to create a local Date object from a YYYY-MM-DD string
const createSafeDate = (dateString: string | null | undefined): Date | undefined => {
  if (!dateString) return undefined;
  const [y, m, d] = dateString.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export const TransactionEditForm: React.FC<TransactionEditFormProps> = ({
  editingTransaction,
  onUpdateTransaction,
  onCancelEdit,
  // REMOVIDO: onDeleteTransaction,
  allCategories,
  cartoes, // NOVO
  refetchCartoes, // NOVO
  isMobile,
  // NOVO: Props para o fluxo de exclusão
  isFetchingDeleteOptions,
  handleTriggerDeleteConfirmation,
  // NOVO: Props para o fluxo de salvamento
  showSaveOptionsDialog,
  setShowSaveOptionsDialog,
  selectedSaveScope,
  setSelectedSaveScope,
  handleConfirmSaveAction, // Nova prop
}) => {
  const [type, setType] = useState<TransactionType>("expense");
  const [amount, setAmount] = useState<number | undefined>(undefined);
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [category, setCategory] = useState(UNSELECTED_VALUE);
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<ReceitaStatus>("Pendente");
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isPaid, setIsPaid] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, boolean>>({});
  const [paidAtTimestamp, setPaidAtTimestamp] = useState<string | null>(null);

  // NOVO: Estados para forma de pagamento e cartão
  const [formaPagamento, setFormaPagamento] = useState<"dinheiro" | "pix" | "cartao" | "boleto">("dinheiro");
  const [cartaoId, setCartaoId] = useState(UNSELECTED_VALUE);

  // REMOVIDO: Estados para os diálogos de confirmação de exclusão
  // REMOVIDO: const [showDeleteOptionsDialog, setShowDeleteOptionsDialog] = useState(false);
  // REMOVIDO: const [showSimpleDeleteDialog, setShowSimpleDeleteOptionsDialog] = useState(false);
  // REMOVIDO: const [selectedDeleteScope, setSelectedDeleteScope] = useState<DeleteScope>("thisMonth");

  // NOVOS ESTADOS PARA A LÓGICA DE EXCLUSÃO CONDICIONAL
  // REMOVIDO: const [pendingFutureItemsCount, setPendingFutureItemsCount] = useState(0);
  // REMOVIDO: const [isFetchingOptions, setIsFetchingOptions] = useState(false);

  const isRecurringTransaction = useMemo(() => {
    return (editingTransaction?.is_recurring_master === true || !!editingTransaction?.recurrence_id);
  }, [editingTransaction]);

  const filteredCategories = useMemo(() => {
    let baseCategories: AppCategory[] = [];

    if (type === "income") {
      baseCategories = allCategories.filter(
        (cat) => cat.parent_id === "receitas_e_investimentos"
      );
    } else {
      baseCategories = allCategories.filter(
        (cat) => cat.parent_id !== "receitas_e_investimentos"
      );
    }

    // Ensure the current category is always available in the dropdown if it's not in the filtered list
    if (
      editingTransaction &&
      editingTransaction.category &&
      !baseCategories.some((cat) => cat.id === editingTransaction.category)
    ) {
      const currentCategory = allCategories.find(
        (cat) => cat.id === editingTransaction.category
      );
      if (currentCategory)
        baseCategories = [currentCategory, ...baseCategories];
    }

    return baseCategories;
  }, [
    type,
    allCategories,
    editingTransaction,
  ]);

  // Effect to initialize form fields when editingTransaction changes
  useEffect(() => {
    if (editingTransaction) {
      setType(editingTransaction.type);
      setDescription(editingTransaction.description || "");

      const validStatuses: ReceitaStatus[] = [
        "Prevista",
        "Pendente",
        "Recebida",
        "Cancelada",
      ];
      const initialStatus =
        editingTransaction.status &&
        validStatuses.includes(editingTransaction.status)
          ? editingTransaction.status
          : "Pendente";
      setStatus(initialStatus);
      
      setAmount(editingTransaction.amount);
      setDate(createSafeDate(editingTransaction.date));
      setCategory(editingTransaction.category || UNSELECTED_VALUE);
      setIsPaid(editingTransaction.status === "Recebida");
      setPaidAtTimestamp(editingTransaction.paymentTimestamp || null);

      setFormaPagamento(editingTransaction.forma_pagamento as "dinheiro" | "pix" | "cartao" | "boleto" || "dinheiro");
      setCartaoId(editingTransaction.cartao_id || UNSELECTED_VALUE);

      setValidationErrors({}); // Clear errors when editing a new transaction
    } else {
      // Reset form when not editing
      setType("expense");
      setAmount(undefined);
      setDate(new Date());
      setCategory(UNSELECTED_VALUE);
      setDescription("");
      setStatus("Pendente");
      setIsPaid(false);
      setPaidAtTimestamp(null);
      setFormaPagamento("dinheiro");
      setCartaoId(UNSELECTED_VALUE);
      setValidationErrors({});
    }
  }, [editingTransaction, allCategories]);

  // REMOVIDO: Helper function to fetch pending future items (agora no useLancamentosLogic)
  // REMOVIDO: const fetchPendingFutureItems = async (transaction: Transaction): Promise<number> => { ... };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTransaction) return;

    const newErrors: Record<string, boolean> = {};
    let hasError = false;

    if (amount === undefined || amount <= 0) {
      newErrors.amount = true;
      hasError = true;
    }
    if (!date) {
      newErrors.date = true;
      hasError = true;
    }
    if (category === UNSELECTED_VALUE) {
      newErrors.category = true;
      hasError = true;
    }
    if (formaPagamento === UNSELECTED_VALUE) {
      newErrors.formaPagamento = true;
      hasError = true;
    }
    if (formaPagamento === "cartao" && cartaoId === UNSELECTED_VALUE) {
      newErrors.cartaoId = true;
      hasError = true;
    }

    setValidationErrors(newErrors);

    if (hasError) {
      toast.error(
        "Preencha todos os campos obrigatórios (Valor, Data, Subcategoria, Forma de Pagamento e Cartão, se aplicável)."
      );
      return;
    }

    setLoading(true); // Start loading for the pre-check
    // REMOVIDO: setIsFetchingOptions(true);
    // REMOVIDO: const futureItems = await fetchPendingFutureItems(editingTransaction);
    // REMOVIDO: setPendingFutureItemsCount(futureItems);
    // REMOVIDO: setIsFetchingOptions(false);
    // REMOVIDO: setLoading(false); // Stop loading after pre-check

    const totalItemsInSeries = editingTransaction.totalInstallments || 1;

    // Lógica unificada para determinar se deve mostrar as opções de série
    const isFixedRecurringSeries =
      editingTransaction.tipo_pagamento === "fixo" &&
      (editingTransaction.is_recurring_master || !!editingTransaction.recurrence_id); // Covers both master and occurrences of fixed/recurring income/expense

    const isInstallmentSeries =
      editingTransaction.tipo_pagamento === "parcelado" &&
      totalItemsInSeries > 1; // futureItems check is now done in parent logic

    const shouldShowSeriesOptions = isFixedRecurringSeries || isInstallmentSeries;

    if (shouldShowSeriesOptions) {
      setShowSaveOptionsDialog(true); // Abre o diálogo de opções de salvamento
    } else {
      handleConfirmSaveAction("oneOff"); // Salva diretamente para transações avulsas ou séries sem futuras pendências
    }
  };

  // REMOVIDO: const handleConfirmSave = (saveScope: SaveScope) => { ... }; // Lógica movida para handleConfirmSaveAction no pai

  const performUpdate = (saveScope: SaveScope) => {
    if (!editingTransaction) return;
    setLoading(true);

    const formattedDate = date
      ? format(date, 'yyyy-MM-dd')
      : "";

    let finalStatus: ReceitaStatus = isPaid
      ? "Recebida"
      : editingTransaction.status === "Cancelada"
      ? "Cancelada"
      : editingTransaction.status === "Prevista"
      ? "Prevista"
      : "Pendente";

    const updatedTransaction: Omit<Transaction, "id"> = {
      type,
      amount: amount as number,
      date: formattedDate,
      category: category === UNSELECTED_VALUE ? null : category,
      description,
      status: finalStatus,
      installmentNumber: editingTransaction.installmentNumber,
      totalInstallments: editingTransaction.totalInstallments,
      forma_pagamento: formaPagamento,
      cartao_id: formaPagamento === "cartao" ? cartaoId : null,
      despesa_id: editingTransaction.despesa_id,
      is_recurring_master: editingTransaction.is_recurring_master,
      recurrence_id: editingTransaction.recurrence_id,
      recurrence_day: editingTransaction.recurrence_day,
      tipo_pagamento: editingTransaction.tipo_pagamento,
      paymentTimestamp: paidAtTimestamp,
    };

    onUpdateTransaction(
      editingTransaction.id,
      type,
      updatedTransaction,
      saveScope
    );

    setLoading(false);
  };

  // REMOVIDO: handleTriggerDeleteConfirmation (agora no useLancamentosLogic)
  // REMOVIDO: handleConfirmDelete (agora no useLancamentosLogic)

  return (
    <>
      <form onSubmit={handleSubmit} className={cn("space-y-4 flex flex-col h-full", isMobile && "space-y-3 px-0")}>
        <div className={cn("flex-grow overflow-y-auto", isMobile && "-mr-4 pr-4")}>
          <TransactionOneOffFields
            amount={amount}
            setAmount={(v) => {
              setAmount(v);
              setValidationErrors(prev => ({ ...prev, amount: false }));
            }}
            date={date}
            setDate={(date) => {
              if (!date) return;
              const fixedDate = new Date(
                date.getFullYear(),
                date.getMonth(),
                date.getDate()
              );
              setDate(fixedDate);
              setValidationErrors(prev => ({ ...prev, date: false }));
            }}
            category={category}
            setCategory={(v) => {
              setCategory(v);
              setValidationErrors(prev => ({ ...prev, category: false }));
            }}
            description={description}
            setDescription={setDescription}
            status={status}
            setStatus={setStatus}
            isCalendarOpen={isCalendarOpen}
            setIsCalendarOpen={setIsCalendarOpen}
            filteredCategories={filteredCategories}
            isMobile={isMobile}
            transactionType={type}
            UNSELECTED_VALUE={UNSELECTED_VALUE}
            isPaid={isPaid}
            setIsPaid={setIsPaid}
            installmentNumber={editingTransaction?.installmentNumber}
            totalInstallments={editingTransaction?.totalInstallments}
            validationErrors={validationErrors}
            setValidationErrors={setValidationErrors}
            paidAtTimestamp={paidAtTimestamp}
            formaPagamento={formaPagamento}
            setFormaPagamento={setFormaPagamento}
            cartaoId={cartaoId}
            setCartaoId={setCartaoId}
            cartoes={cartoes}
            refetchCartoes={refetchCartoes}
          />
        </div>

        <TransactionEditActions
          // REMOVIDO: onTriggerDeleteConfirmation={handleTriggerDeleteConfirmation}
          onSave={handleSubmit}
          onCancel={isMobile ? undefined : onCancelEdit}
          loading={loading || isFetchingDeleteOptions} // Usar isFetchingDeleteOptions do pai
          isMobile={isMobile}
          isRecurringTransaction={isRecurringTransaction}
        />
      </form>

      {/* NOVO: Diálogo de Confirmação para Salvar Despesa Parcelada/Recorrente (agora no TransactionEditForm) */}
      <AlertDialog open={showSaveOptionsDialog} onOpenChange={setShowSaveOptionsDialog}>
        <AlertDialogContent className={cn("w-full", isMobile ? "max-w-[98vw] p-4 min-h-[180px]" : "sm:max-w-[425px]")}>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <DynamicIcon name="Pencil" className="h-6 w-6 text-primary" />
              Atualizar Lançamento Recorrente
            </AlertDialogTitle>
            <AlertDialogDescription>
              Este lançamento faz parte de uma série recorrente. Como você gostaria de aplicar as alterações?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <RadioGroup
              value={selectedSaveScope}
              onValueChange={(value: SaveScope) => setSelectedSaveScope(value)}
              className="space-y-3 radio-fix-click"
            >
              <div className="flex items-center space-x-3">
                <RadioGroupItem 
                  value="thisMonth" 
                  id="save-this-month" 
                  className="peer data-[state=checked]:border-primary data-[state=checked]:after:bg-primary data-[state=checked]:ring-primary" 
                />
                <label htmlFor="save-this-month" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Apenas este mês
                </label>
              </div>
              <div className="flex items-center space-x-3">
                <RadioGroupItem 
                  value="thisMonthForward" 
                  id="save-this-month-forward" 
                  className="peer data-[state=checked]:border-primary data-[state=checked]:after:bg-primary data-[state=checked]:ring-primary" 
                />
                <label htmlFor="save-this-month-forward" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Deste mês em diante
                </label>
              </div>
              <div className="flex items-center space-x-3">
                <RadioGroupItem 
                  value="all" 
                  id="save-all" 
                  className="peer data-[state=checked]:border-primary data-[state=checked]:after:bg-primary data-[state=checked]:ring-primary" 
                />
                <label htmlFor="save-all" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Todo o período
                </label>
              </div>
            </RadioGroup>
          </div>
          <AlertDialogFooter className={cn("flex flex-col sm:flex-row justify-center gap-2", isMobile && "flex-row justify-between items-center")}>
            <AlertDialogCancel disabled={loading || isFetchingDeleteOptions} className={cn("rounded-xl", isMobile && "h-10 text-xs flex-1 bg-soft-blue hover:bg-soft-blue/80 text-primary")}>
              <DynamicIcon name="XCircle" className={cn("mr-1 h-3.5 w-3.5", isMobile && "h-3 w-3 mr-0.5")} />
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => performUpdate(selectedSaveScope)} disabled={loading || isFetchingDeleteOptions} className={cn("w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl", isMobile && "h-10 text-xs flex-1")}>
              {loading || isFetchingDeleteOptions ? "Salvando..." : "Salvar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};