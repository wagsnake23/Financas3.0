import React, { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import DynamicIcon from "@/components/DynamicIcon";
import { Transaction, AppCategory, TransactionType } from "@/types/finance";
import { cn, isValidUuid } from "@/lib/utils"; // Importar isValidUuid
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

  // Estados para os diálogos de confirmação
  const [showDeleteOptionsDialog, setShowDeleteOptionsDialog] = useState(false);
  const [showSimpleDeleteDialog, setShowSimpleDeleteOptionsDialog] = useState(false);
  const [selectedDeleteScope, setSelectedDeleteScope] = useState<DeleteScope>("thisMonth");

  const [showSaveOptionsDialog, setShowSaveOptionsDialog] = useState(false); // NOVO ESTADO
  const [selectedSaveScope, setSelectedSaveScope] = useState<SaveScope>("thisMonth"); // NOVO ESTADO

  // NOVOS ESTADOS PARA A LÓGICA DE EXCLUSÃO CONDICIONAL
  const [pendingFutureInstallments, setPendingFutureInstallments] = useState(0);
  const [isFetchingDeleteOptions, setIsFetchingDeleteOptions] = useState(false);

  const isRecurringTransaction = useMemo(() => {
    // Uma transação é recorrente SE:
    // - is_recurring_master === true
    // OU
    // - recurrence_id != null
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
    } else {
      // Reset form when not editing
      setType("expense");
      setAmount(undefined);
      setDate(new Date());
      setCategory(UNSELECTED_VALUE);
      setDescription("");
      setStatus("Pendente");
      setIsPaid(false);
    }
  }, [editingTransaction, allCategories]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTransaction) return;

    if (amount === undefined || amount <= 0 || category === UNSELECTED_VALUE) {
      toast.error(
        "Preencha todos os campos obrigatórios (Valor e Subcategoria)."
      );
      return;
    }

    if (isRecurringTransaction) {
      setShowSaveOptionsDialog(true); // Abre o diálogo de opções de salvamento
    } else {
      performUpdate("oneOff"); // Salva diretamente para transações avulsas
    }
  };

  const handleConfirmSave = (saveScope: SaveScope) => {
    performUpdate(saveScope);
    setShowSaveOptionsDialog(false);
  };

  const performUpdate = (saveScope: SaveScope) => {
    if (!editingTransaction) return;
    setLoading(true);

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

    setLoading(false);
  };

  const handleTriggerDeleteConfirmation = async () => {
    if (!editingTransaction) return;

    setIsFetchingDeleteOptions(true);
    let hasPendingFuture = 0;

    try {
      if (editingTransaction.type === "expense") {
        const parentDespesaId = editingTransaction.despesa_id;
        if (parentDespesaId && isValidUuid(parentDespesaId)) {
          const { data: futureInstallments, error } = await supabase
            .from("despesas_parcelas")
            .select("id")
            .eq("despesa_id", parentDespesaId)
            .eq("pago", false)
            .gte("vencimento", format(createSafeDate(editingTransaction.date) || new Date(), 'yyyy-MM-dd')); // Only count future/current pending
          
          if (error) throw error;
          hasPendingFuture = futureInstallments?.length || 0;
        }
      } else if (editingTransaction.type === "income") {
        const masterRecurrenceId = editingTransaction.is_recurring_master ? editingTransaction.id : editingTransaction.recurrence_id;
        if (masterRecurrenceId && isValidUuid(masterRecurrenceId)) {
          const { data: futureOccurrences, error } = await supabase
            .from("receitas")
            .select("id")
            .eq("recurrence_id", masterRecurrenceId)
            .in("status", ["Pendente", "Prevista"])
            .gte("data", format(createSafeDate(editingTransaction.date) || new Date(), 'yyyy-MM-dd')); // Only count future/current pending
          
          if (error) throw error;
          hasPendingFuture = futureOccurrences?.length || 0;
        }
      }
    } catch (error) {
      console.error("Error fetching pending future installments:", error);
      toast.error("Erro ao verificar lançamentos futuros.");
    } finally {
      setPendingFutureInstallments(hasPendingFuture);
      setIsFetchingDeleteOptions(false);

      // Now, decide which dialog to show based on the rules
      // Rule: "o lançamento for o master recorrente, e houver mais de 1 parcela no total, e existirem parcelas futuras pendentes."
      const totalItemsInSeries = editingTransaction.totalInstallments || 1; // For expenses, use totalInstallments. For income, if master, it implies >1.

      const shouldShowRecurringOptions = 
        editingTransaction.is_recurring_master && // Must be the master
        (editingTransaction.type === "expense" ? totalItemsInSeries > 1 : true) && // For expense, check total installments. For income, if master, it's implicitly >1.
        hasPendingFuture > 0;

      if (shouldShowRecurringOptions) {
        setShowDeleteOptionsDialog(true);
      } else {
        setShowSimpleDeleteDialog(true);
      }
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
    setShowSimpleDeleteDialog(false);
  };

  const formContent = (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
        <TransactionOneOffFields
          amount={amount}
          setAmount={setAmount}
          date={date}
          setDate={(date) => {
            if (!date) return;
            const fixedDate = new Date(
              date.getFullYear(),
              date.getMonth(),
              date.getDate()
            );
            setDate(fixedDate);
          }}
          category={category}
          setCategory={setCategory}
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
        />

        <TransactionEditActions
          onTriggerDeleteConfirmation={handleTriggerDeleteConfirmation}
          onSave={handleSubmit} // Agora chama handleSubmit para lidar com o diálogo
          onCancel={onCancelEdit}
          loading={loading || isFetchingDeleteOptions} // Desabilitar se estiver buscando opções de exclusão
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
            <AlertDialogCancel disabled={loading || isFetchingDeleteOptions}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleConfirmDelete("oneOff")} disabled={loading || isFetchingDeleteOptions}>
              {loading || isFetchingDeleteOptions ? "Excluindo..." : "Excluir"}
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
              className="space-y-3"
            >
              <div className="flex items-center space-x-3">
                <RadioGroupItem value="thisMonth" id="delete-this-month" />
                <label htmlFor="delete-this-month" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Apenas este mês
                </label>
              </div>
              <div className="flex items-center space-x-3">
                <RadioGroupItem value="thisMonthForward" id="delete-this-month-forward" />
                <label htmlFor="delete-this-month-forward" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Deste mês em diante
                </label>
              </div>
              <div className="flex items-center space-x-3">
                <RadioGroupItem value="all" id="delete-all" />
                <label htmlFor="delete-all" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Todo o período
                </label>
              </div>
            </RadioGroup>
          </div>
          <AlertDialogFooter className="flex flex-col sm:flex-row sm:justify-end gap-2">
            <AlertDialogCancel disabled={loading || isFetchingDeleteOptions}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleConfirmDelete(selectedDeleteScope)} disabled={loading || isFetchingDeleteOptions} className="w-full sm:w-auto">
              {loading || isFetchingDeleteOptions ? "Excluindo..." : "Excluir"}
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
              className="space-y-3"
            >
              <div className="flex items-center space-x-3">
                <RadioGroupItem value="thisMonth" id="save-this-month" />
                <label htmlFor="save-this-month" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Apenas este mês
                </label>
              </div>
              <div className="flex items-center space-x-3">
                <RadioGroupItem value="thisMonthForward" id="save-this-month-forward" />
                <label htmlFor="save-this-month-forward" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Deste mês em diante
                </label>
              </div>
              <div className="flex items-center space-x-3">
                <RadioGroupItem value="all" id="save-all" />
                <label htmlFor="save-all" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Todo o período
                </label>
              </div>
            </RadioGroup>
          </div>
          <AlertDialogFooter className="flex flex-col sm:flex-row sm:justify-end gap-2">
            <AlertDialogCancel disabled={loading || isFetchingDeleteOptions}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleConfirmSave(selectedSaveScope)} disabled={loading || isFetchingDeleteOptions}>
              {loading || isFetchingDeleteOptions ? "Salvando..." : "Salvar"}
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