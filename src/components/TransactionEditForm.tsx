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
import { Database } from "@/integrations/supabase/types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  onDeleteTransaction: (
    id: string,
    type: TransactionType,
    deleteScope: DeleteScope
  ) => void;
  allCategories: AppCategory[];
  isMobile: boolean;
  loadingEditData: boolean; // NOVA PROP: Recebendo loadingEditData
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
  onDeleteTransaction,
  allCategories,
  isMobile,
  loadingEditData, // Usar esta prop
}) => {
  const [type, setType] = useState<TransactionType>("expense");
  const [amount, setAmount] = useState<number | undefined>(undefined);
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [category, setCategory] = useState(UNSELECTED_VALUE);
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<ReceitaStatus>("Pendente");
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  // Removido: const [loading, setLoading] = useState(false); // Usar loadingEditData da prop
  const [isPaid, setIsPaid] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, boolean>>({});

  // Estados para os diálogos de confirmação
  const [showDeleteOptionsDialog, setShowDeleteOptionsDialog] = useState(false);
  const [showSimpleDeleteDialog, setShowSimpleDeleteOptionsDialog] = useState(false);
  const [selectedDeleteScope, setSelectedDeleteScope] = useState<DeleteScope>("thisMonth");

  const [showSaveOptionsDialog, setShowSaveOptionsDialog] = useState(false);
  const [selectedSaveScope, setSelectedSaveScope] = useState<SaveScope>("thisMonth");

  // NOVOS ESTADOS PARA A LÓGICA DE EXCLUSÃO CONDICIONAL
  const [pendingFutureItemsCount, setPendingFutureItemsCount] = useState(0);
  const [isFetchingOptions, setIsFetchingOptions] = useState(false);

  const isRecurringTransaction = useMemo(() => {
    if (!editingTransaction) return false;
    // Para despesas, é recorrente se tipo_pagamento for 'fixo' ou 'parcelado' com mais de 1 parcela
    if (editingTransaction.type === "expense") {
      return editingTransaction.tipo_pagamento === "fixo" || (editingTransaction.tipo_pagamento === "parcelado" && (editingTransaction.totalInstallments || 0) > 1);
    }
    // Para receitas, é recorrente se is_recurring_master ou recurrence_id estiverem presentes
    return editingTransaction.is_recurring_master || !!editingTransaction.recurrence_id;
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
      setValidationErrors({});
    }
  }, [editingTransaction, allCategories]);

  // Helper function to fetch pending future items (installments or occurrences)
  const fetchPendingFutureItems = async (transaction: Transaction): Promise<number> => {
    let count = 0;
    try {
      const formattedTransactionDate = format(createSafeDate(transaction.date) || new Date(), 'yyyy-MM-dd');
      // console.log("[DEBUG] fetchPendingFutureItems: formattedTransactionDate:", formattedTransactionDate); // NEW LOG

      if (transaction.type === "expense") {
        const parentDespesaId = transaction.despesa_id;
        // console.log("[DEBUG] fetchPendingFutureItems: Expense parentDespesaId:", parentDespesaId); // NEW LOG
        if (parentDespesaId && isValidUuid(parentDespesaId)) {
          const { count: futureInstallmentsCount, error } = await supabase
            .from("despesas_parcelas")
            .select("id", { count: 'exact' })
            .eq("despesa_id", parentDespesaId)
            .eq("pago", false) // Apenas parcelas não pagas
            .gte("vencimento", formattedTransactionDate);
          
          if (error) throw error;
          count = futureInstallmentsCount || 0;
          // console.log("[DEBUG] fetchPendingFutureItems: Found future installments (pending):", count); // NEW LOG
        } else {
          // console.log("[DEBUG] fetchPendingFutureItems: Invalid parentDespesaId for expense:", parentDespesaId); // NEW LOG
        }
      } else if (transaction.type === "income") {
        const masterRecurrenceId = transaction.is_recurring_master ? transaction.id : transaction.recurrence_id;
        // console.log("[DEBUG] fetchPendingFutureItems: Income masterRecurrenceId:", masterRecurrenceId); // NEW LOG
        if (masterRecurrenceId && isValidUuid(masterRecurrenceId)) {
          const { count: futureOccurrencesCount, error } = await supabase
            .from("receitas")
            .select("id", { count: 'exact' })
            .eq("recurrence_id", masterRecurrenceId)
            .in("status", ["Pendente", "Prevista"]) // Apenas ocorrências pendentes ou previstas
            .gte("data", formattedTransactionDate);
          
          if (error) throw error;
          count = futureOccurrencesCount || 0;
          // console.log("[DEBUG] fetchPendingFutureItems: Found future income occurrences (pending/prevista):", count); // NEW LOG
        } else {
          // console.log("[DEBUG] fetchPendingFutureItems: Invalid masterRecurrenceId for income:", masterRecurrenceId); // NEW LOG
        }
      }
    } catch (error) {
      console.error("Error fetching pending future items:", error);
      toast.error("Erro ao verificar lançamentos futuros.");
    }
    return count;
  };

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

    setValidationErrors(newErrors);

    if (hasError) {
      toast.error(
        "Preencha todos os campos obrigatórios (Valor, Data e Subcategoria)."
      );
      return;
    }

    setIsFetchingOptions(true);
    const futureItems = await fetchPendingFutureItems(editingTransaction);
    setPendingFutureItemsCount(futureItems);
    setIsFetchingOptions(false);

    // CORREÇÃO AQUI: Usar editingTransaction.totalInstallments de forma mais robusta
    const totalItemsInSeries = editingTransaction.totalInstallments && editingTransaction.totalInstallments > 1 ? editingTransaction.totalInstallments : 1;

    // Lógica unificada para determinar se deve mostrar as opções de série
    const isFixedRecurringSeries =
      editingTransaction.tipo_pagamento === "fixo" &&
      (editingTransaction.is_recurring_master || !!editingTransaction.recurrence_id); // Covers both master and occurrences of fixed/recurring income/expense

    const isInstallmentSeries =
      editingTransaction.tipo_pagamento === "parcelado" &&
      totalItemsInSeries > 1 &&
      futureItems > 0; // futureItems already fetched

    const shouldShowSeriesOptions = isFixedRecurringSeries || isInstallmentSeries;

    console.log("[DEBUG - handleSubmit] editingTransaction.type:", editingTransaction.type);
    console.log("[DEBUG - handleSubmit] editingTransaction.tipo_pagamento:", editingTransaction.tipo_pagamento);
    console.log("[DEBUG - handleSubmit] editingTransaction.is_recurring_master:", editingTransaction.is_recurring_master);
    console.log("[DEBUG - handleSubmit] editingTransaction.recurrence_id:", editingTransaction.recurrence_id);
    console.log("[DEBUG - handleSubmit] totalItemsInSeries:", totalItemsInSeries);
    console.log("[DEBUG - handleSubmit] futureItems (pending future items):", futureItems);
    console.log("[DEBUG - handleSubmit] isFixedRecurringSeries:", isFixedRecurringSeries);
    console.log("[DEBUG - handleSubmit] isInstallmentSeries:", isInstallmentSeries);
    console.log("[DEBUG - handleSubmit] shouldShowSeriesOptions:", shouldShowSeriesOptions);


    if (shouldShowSeriesOptions) {
      setShowSaveOptionsDialog(true); // Abre o diálogo de opções de salvamento
    } else {
      performUpdate("oneOff"); // Salva diretamente para transações avulsas ou séries sem futuras pendências
    }
  };

  const handleConfirmSave = (saveScope: SaveScope) => {
    performUpdate(saveScope);
    setShowSaveOptionsDialog(false);
  };

  const performUpdate = (saveScope: SaveScope) => {
    if (!editingTransaction) return;
    // setLoading(true); // Moved to useLancamentosLogic

    // Formatar a data como string YYYY-MM-DD (local)
    const formattedDate = date
      ? format(date, 'yyyy-MM-dd') // Usar format do date-fns
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
      // Keep installment-related fields for one-off installment expenses
      installmentNumber: editingTransaction.installmentNumber,
      totalInstallments: editingTransaction.totalInstallments,
      forma_pagamento: editingTransaction.forma_pagamento,
      cartao_id: editingTransaction.cartao_id,
      despesa_id: editingTransaction.despesa_id,
      // Include recurrence fields
      is_recurring_master: editingTransaction.is_recurring_master,
      recurrence_id: editingTransaction.recurrence_id,
      recurrence_day: editingTransaction.recurrence_day,
      tipo_pagamento: editingTransaction.tipo_pagamento, // NOVO: Incluído tipo_pagamento
    };

    onUpdateTransaction(
      editingTransaction.id,
      type,
      updatedTransaction,
      saveScope // Passa o saveScope
    );

    // setLoading(false); // Moved to useLancamentosLogic
  };

  const handleTriggerDeleteConfirmation = async () => {
    if (!editingTransaction) return;

    setIsFetchingOptions(true); // Use isFetchingOptions
    const futureItems = await fetchPendingFutureItems(editingTransaction);
    setPendingFutureItemsCount(futureItems);
    setIsFetchingOptions(false);

    // CORREÇÃO AQUI: Usar editingTransaction.totalInstallments de forma mais robusta
    const totalItemsInSeries = editingTransaction.totalInstallments && editingTransaction.totalInstallments > 1 ? editingTransaction.totalInstallments : 1;

    // Lógica unificada para determinar se deve mostrar as opções de série
    const isFixedRecurringSeries =
      editingTransaction.tipo_pagamento === "fixo" &&
      (editingTransaction.is_recurring_master || !!editingTransaction.recurrence_id); // Covers both master and occurrences of fixed/recurring income/expense

    const isInstallmentSeries =
      editingTransaction.tipo_pagamento === "parcelado" &&
      totalItemsInSeries > 1 &&
      futureItems > 0; // futureItems already fetched

    const shouldShowSeriesOptions = isFixedRecurringSeries || isInstallmentSeries;

    if (shouldShowSeriesOptions) {
      setShowDeleteOptionsDialog(true);
    } else {
      setShowSimpleDeleteOptionsDialog(true);
    }
  };

  const handleConfirmDelete = (deleteScope: DeleteScope) => {
    if (editingTransaction) {
      onDeleteTransaction(
        editingTransaction.id,
        editingTransaction.type,
        deleteScope
      );
    }
    setShowDeleteOptionsDialog(false);
    setShowSimpleDeleteOptionsDialog(false); // Corrigido o nome da função setter aqui
  };

  const formContent = (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
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
          validationErrors={validationErrors} // Pass validation errors
        />

        <TransactionEditActions
          onTriggerDeleteConfirmation={handleTriggerDeleteConfirmation}
          onSave={handleSubmit} // Agora chama handleSubmit para lidar com o diálogo
          onCancel={onCancelEdit}
          loading={loadingEditData || isFetchingOptions} // Usar loadingEditData
          isMobile={isMobile}
          isRecurringTransaction={isRecurringTransaction}
        />
      </form>

      {/* Diálogo de Confirmação para Exclusão de Despesa Avulsa */}
      <AlertDialog open={showSimpleDeleteDialog} onOpenChange={setShowSimpleDeleteOptionsDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <DynamicIcon name="Trash2" className="h-6 w-6 text-destructive" />
              Confirmar Exclusão
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este lançamento? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loadingEditData || isFetchingOptions}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleConfirmDelete("oneOff")} disabled={loadingEditData || isFetchingOptions}>
              {loadingEditData || isFetchingOptions ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Diálogo de Confirmação para Exclusão de Despesa Parcelada/Recorrente */}
      <AlertDialog open={showDeleteOptionsDialog} onOpenChange={setShowDeleteOptionsDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <DynamicIcon name="Trash2" className="h-6 w-6 text-destructive" />
              Excluir Lançamento Recorrente
            </AlertDialogTitle>
            <AlertDialogDescription>
              Este lançamento faz parte de uma série recorrente. Como você gostaria de excluí-lo?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <RadioGroup
              value={selectedDeleteScope}
              onValueChange={(value: DeleteScope) => setSelectedDeleteScope(value)}
              className="space-y-3 radio-fix-click"
            >
              <div className="flex items-center space-x-3">
                <RadioGroupItem 
                  value="thisMonth" 
                  id="delete-this-month" 
                  className="peer data-[state=checked]:border-primary data-[state=checked]:after:bg-primary data-[state=checked]:ring-primary" 
                />
                <label htmlFor="delete-this-month" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Apenas este mês
                </label>
              </div>
              <div className="flex items-center space-x-3">
                <RadioGroupItem 
                  value="thisMonthForward" 
                  id="delete-this-month-forward" 
                  className="peer data-[state=checked]:border-primary data-[state=checked]:after:bg-primary data-[state=checked]:ring-primary" 
                />
                <label htmlFor="delete-this-month-forward" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Deste mês em diante
                </label>
              </div>
              <div className="flex items-center space-x-3">
                <RadioGroupItem 
                  value="all" 
                  id="delete-all" 
                  className="peer data-[state=checked]:border-primary data-[state=checked]:after:bg-primary data-[state=checked]:ring-primary" 
                />
                <label htmlFor="delete-all" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Todo o período
                </label>
              </div>
            </RadioGroup>
          </div>
          <AlertDialogFooter className="flex flex-col sm:flex-row sm:justify-end gap-2">
            <AlertDialogCancel disabled={loadingEditData || isFetchingOptions}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleConfirmDelete(selectedDeleteScope)} disabled={loadingEditData || isFetchingOptions} className="w-full sm:w-auto">
              {loadingEditData || isFetchingOptions ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* NOVO: Diálogo de Confirmação para Salvar Despesa Parcelada/Recorrente */}
      <AlertDialog open={showSaveOptionsDialog} onOpenChange={setShowSaveOptionsDialog}>
        <AlertDialogContent>
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
          <AlertDialogFooter className="flex flex-col sm:flex-row sm:justify-end gap-2">
            <AlertDialogCancel disabled={loadingEditData || isFetchingOptions}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleConfirmSave(selectedSaveScope)} disabled={loadingEditData || isFetchingOptions} className="w-full sm:w-auto">
              {loadingEditData || isFetchingOptions ? "Salvando..." : "Salvar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );

  return isMobile ? (
    <div className={cn("p-4", isMobile && "p-0")}>{formContent}</div>
  ) : (
    <Card className={cn("p-6 animate-fade-in rounded-xl shadow-sm")}>
      {formContent}
    </Card>
  );
};