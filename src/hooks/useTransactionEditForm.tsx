import { useState, useMemo, useEffect, useCallback } from "react";
import { Transaction, TransactionType, AppCategory } from "@/types/finance";
import { Database, Tables } from "@/integrations/supabase/types";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { isValidUuid } from "@/lib/utils";

type ReceitaStatus = Database["public"]["Enums"]["receita_status"];
type DeleteScope = "thisMonth" | "thisMonthForward" | "all" | "oneOff";
type SaveScope = "thisMonth" | "thisMonthForward" | "all" | "oneOff";

interface UseTransactionEditFormProps {
  editingTransaction: Transaction | null;
  onUpdateTransaction: (
    id: string,
    type: TransactionType,
    updatedTransaction: Omit<Transaction, "id">,
    saveScope: SaveScope
  ) => void;
  onCancelEdit: () => void;
  onDeleteTransaction: (
    id: string,
    type: TransactionType,
    deleteScope: DeleteScope
  ) => void;
  allCategories: AppCategory[];
  cartoes: Tables<"cartoes">[];
  refetchCartoes: () => void;
}

const UNSELECTED_VALUE = "unselected";

const createSafeDate = (
  dateString: string | null | undefined
): Date | undefined => {
  if (!dateString) return undefined;
  const [y, m, d] = dateString.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export const useTransactionEditForm = ({
  editingTransaction,
  onUpdateTransaction,
  onCancelEdit,
  onDeleteTransaction,
  allCategories,
  cartoes,
  refetchCartoes,
}: UseTransactionEditFormProps) => {
  const [type, setType] = useState<TransactionType>("expense");
  const [amount, setAmount] = useState<number | undefined>(undefined);
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [category, setCategory] = useState(UNSELECTED_VALUE);
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<ReceitaStatus>("Pendente");
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isPaid, setIsPaid] = useState(false);
  const [validationErrors, setValidationErrors] = useState<
    Record<string, boolean>
  >({});
  const [paidAtTimestamp, setPaidAtTimestamp] = useState<string | null>(null);

  const [formaPagamento, setFormaPagamento] = useState<
    "dinheiro" | "pix" | "cartao"
  >("dinheiro");
  const [cartaoId, setCartaoId] = useState(UNSELECTED_VALUE);

  const [showDeleteOptionsDialog, setShowDeleteOptionsDialog] = useState(false);
  const [showSimpleDeleteDialog, setShowSimpleDeleteOptionsDialog] =
    useState(false);
  const [selectedDeleteScope, setSelectedDeleteScope] =
    useState<DeleteScope>("thisMonth");

  const [showSaveOptionsDialog, setShowSaveOptionsDialog] = useState(false);
  const [selectedSaveScope, setSelectedSaveScope] =
    useState<SaveScope>("thisMonth");

  const [pendingFutureItemsCount, setPendingFutureItemsCount] = useState(0);
  const [isFetchingOptions, setIsFetchingOptions] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isRecurringTransaction = useMemo(() => {
    return (
      editingTransaction?.is_recurring_master === true ||
      !!editingTransaction?.recurrence_id
    );
  }, [editingTransaction]);

  const filteredCategories = useMemo(() => {
    let baseCategories: AppCategory[] = [];

    if (type === "income") {
      baseCategories = allCategories.filter(
        (cat) => cat.parent_id === "receitas_e_investimentos"
      );
    } else {
      baseCategories = allCategories.filter(
        (cat) =>
          cat.parent_id !== null && cat.parent_id !== "receitas_e_investimentos"
      );
    }

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
  }, [type, allCategories, editingTransaction]);

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

      setFormaPagamento(
        (editingTransaction.forma_pagamento as
          | "dinheiro"
          | "pix"
          | "cartao") || "dinheiro"
      );
      setCartaoId(editingTransaction.cartao_id || UNSELECTED_VALUE);

      setValidationErrors({});
    } else {
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

  const fetchPendingFutureItems = useCallback(
    async (transaction: Transaction): Promise<number> => {
      let count = 0;
      try {
        const formattedTransactionDate = format(
          createSafeDate(transaction.date) || new Date(),
          "yyyy-MM-dd"
        );

        if (transaction.type === "expense") {
          const parentDespesaId = transaction.despesa_id;
          if (parentDespesaId && isValidUuid(parentDespesaId)) {
            const { count: futureInstallmentsCount, error } = await supabase
              .from("despesas_parcelas")
              .select("id", { count: "exact" })
              .eq("despesa_id", parentDespesaId)
              .eq("pago", false)
              .gte("vencimento", formattedTransactionDate);

            if (error) throw error;
            count = futureInstallmentsCount || 0;
          }
        } else if (transaction.type === "income") {
          const masterRecurrenceId = transaction.is_recurring_master
            ? transaction.id
            : transaction.recurrence_id;
          if (masterRecurrenceId && isValidUuid(masterRecurrenceId)) {
            const { count: futureOccurrencesCount, error } = await supabase
              .from("receitas")
              .select("id", { count: "exact" })
              .eq("recurrence_id", masterRecurrenceId)
              .in("status", ["Pendente", "Prevista"])
              .gte("data", formattedTransactionDate);

            if (error) throw error;
            count = futureOccurrencesCount || 0;
          }
        }
      } catch (error) {
        console.error("Error fetching pending future items:", error);
        toast.error("Erro ao verificar lançamentos futuros.");
      }
      return count;
    },
    []
  );

  const performUpdate = useCallback(
    (saveScope: SaveScope) => {
      if (!editingTransaction) return;
      setLoading(true);

      const formattedDate = date ? format(date, "yyyy-MM-dd") : "";

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

        // 🔴 ÚNICA CORREÇÃO AQUI
        totalInstallments:
          editingTransaction.totalInstallments ??
          (editingTransaction as any).numero_parcelas ??
          1,

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
    },
    [
      editingTransaction,
      date,
      isPaid,
      type,
      amount,
      category,
      description,
      formaPagamento,
      cartaoId,
      paidAtTimestamp,
      onUpdateTransaction,
    ]
  );

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

    setLoading(true);
    setIsFetchingOptions(true);
    const futureItems = await fetchPendingFutureItems(editingTransaction);
    setPendingFutureItemsCount(futureItems);
    setIsFetchingOptions(false);
    setLoading(false);

    const totalItemsInSeries =
      editingTransaction.totalInstallments ??
      (editingTransaction as any).numero_parcelas ??
      1;

    const isFixedRecurringSeries =
      editingTransaction.tipo_pagamento === "fixo" &&
      (editingTransaction.is_recurring_master ||
        !!editingTransaction.recurrence_id);

    const isInstallmentSeries =
      editingTransaction.tipo_pagamento === "parcelado" &&
      totalItemsInSeries > 1 &&
      futureItems > 0;

    const shouldShowSeriesOptions =
      isFixedRecurringSeries || isInstallmentSeries;

    if (shouldShowSeriesOptions) {
      setShowSaveOptionsDialog(true);
    } else {
      performUpdate("oneOff");
    }
  };

  const handleConfirmSave = (saveScope: SaveScope) => {
    performUpdate(saveScope);
    setShowSaveOptionsDialog(false);
  };

  const handleTriggerDeleteConfirmation = useCallback(async () => {
    if (!editingTransaction) return;

    setIsDeleting(true);
    setIsFetchingOptions(true);
    const futureItems = await fetchPendingFutureItems(editingTransaction);
    setPendingFutureItemsCount(futureItems);
    setIsFetchingOptions(false);
    setIsDeleting(false);

    const totalItemsInSeries =
      editingTransaction.totalInstallments ??
      (editingTransaction as any).numero_parcelas ??
      1;

    const isFixedRecurringSeries =
      editingTransaction.tipo_pagamento === "fixo" &&
      (editingTransaction.is_recurring_master ||
        !!editingTransaction.recurrence_id);

    const isInstallmentSeries =
      editingTransaction.tipo_pagamento === "parcelado" &&
      totalItemsInSeries > 1 &&
      futureItems > 0;

    const shouldShowSeriesOptions =
      isFixedRecurringSeries || isInstallmentSeries;

    if (shouldShowSeriesOptions) {
      setShowDeleteOptionsDialog(true);
    } else {
      setShowSimpleDeleteOptionsDialog(true);
    }
  }, [editingTransaction, fetchPendingFutureItems]);

  const handleConfirmDelete = useCallback(
    (deleteScope: DeleteScope) => {
      if (editingTransaction) {
        onDeleteTransaction(
          editingTransaction.id,
          editingTransaction.type,
          deleteScope
        );
      }
      setShowDeleteOptionsDialog(false);
      setShowSimpleDeleteOptionsDialog(false);
    },
    [editingTransaction, onDeleteTransaction]
  );

  return {
    type,
    setType,
    amount,
    setAmount,
    date,
    setDate,
    category,
    setCategory,
    description,
    setDescription,
    status,
    setStatus,
    isCalendarOpen,
    setIsCalendarOpen,
    loading,
    setLoading,
    isPaid,
    setIsPaid,
    validationErrors,
    setValidationErrors,
    paidAtTimestamp,
    setPaidAtTimestamp,
    formaPagamento,
    setFormaPagamento,
    cartaoId,
    setCartaoId,
    showDeleteOptionsDialog,
    setShowDeleteOptionsDialog,
    showSimpleDeleteDialog,
    setShowSimpleDeleteOptionsDialog,
    selectedDeleteScope,
    setSelectedDeleteScope,
    showSaveOptionsDialog,
    setShowSaveOptionsDialog,
    selectedSaveScope,
    setSelectedSaveScope,
    pendingFutureItemsCount,
    isFetchingOptions,
    isDeleting,
    isRecurringTransaction,
    filteredCategories,
    cartoes,
    refetchCartoes,
    UNSELECTED_VALUE,
    handleSubmit,
    handleConfirmSave,
    handleTriggerDeleteConfirmation,
    handleConfirmDelete,
    onCancelEdit,
    createSafeDate,
  };
};
