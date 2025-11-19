import React, { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";
import DynamicIcon from "@/components/DynamicIcon";
import { Transaction, AppCategory, TransactionType } from "@/types/finance";
import { cn } from "@/lib/utils";
import { format, parseISO, startOfMonth, getDate, setDate } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, X } from "lucide-react";
import { Database, Enums } from "@/integrations/supabase/types";
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
import { MaterializedRecurringTransaction } from "@/hooks/useRecurringEntries";

// Importar os novos componentes modulares
import { EditOptionSelector } from "./edit-installment-modal/EditOptionSelector";
import { CommonFields } from "./edit-installment-modal/CommonFields";
import { ThisMonthFields } from "./edit-installment-modal/ThisMonthFields";
import { RecurringMasterFields } from "./edit-installment-modal/RecurringMasterFields";

type ReceitaStatus = Database['public']['Enums']['receita_status'];
type EditOption = "thisMonth" | "thisMonthForward" | "all";

interface TransactionEditFormProps {
  editingTransaction: Transaction | null; // Pode ser Transaction ou MaterializedRecurringTransaction
  onUpdateTransaction: (
    id: string,
    type: TransactionType,
    updatedTransaction: Omit<Transaction, "id">,
    editOption?: EditOption, // Adicionado para recorrência
    preserveExceptions?: boolean, // Adicionado para recorrência global
    recurringData?: {
      title: string;
      value: number;
      categoryId: string | null;
      dueDay: number;
      frequency: Enums<'recurring_frequency'>;
      startDate: string | null;
      endDate: string | null;
      recurringStatus: Enums<'recurring_status'>;
      note: string | null;
      overrideDueDate: string | null;
      isPaid: boolean;
    }
  ) => void;
  onCancelEdit: () => void;
  onDeleteTransaction: (id: string, type: TransactionType, isFixed?: boolean) => void;
  allCategories: AppCategory[];
  isMobile: boolean;
}

const UNSELECTED_VALUE = "unselected";

export const TransactionEditForm: React.FC<TransactionEditFormProps> = ({
  editingTransaction,
  onUpdateTransaction,
  onCancelEdit,
  onDeleteTransaction,
  allCategories,
  isMobile,
}) => {
  const isRecurringTransaction = (editingTransaction as MaterializedRecurringTransaction)?.isRecurring;
  const recurringTransaction = editingTransaction as MaterializedRecurringTransaction;

  // Form states
  const [type, setType] = useState<TransactionType>("expense");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [category, setCategory] = useState(UNSELECTED_VALUE);
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<ReceitaStatus>('Pendente'); // Only for income
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  // REMOVIDO: [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [loading, setLoading] = useState(false); // Adicionado estado de loading

  // Recurring specific states
  const [editOption, setEditOption] = useState<EditOption>("thisMonth");
  const [title, setTitle] = useState("");
  const [dueDay, setDueDay] = useState("1");
  const [frequency, setFrequency] = useState<Enums<'recurring_frequency'>>("monthly");
  const [startDate, setStartDate] = useState<Date | undefined>(new Date());
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [recurringStatus, setRecurringStatus] = useState<Enums<'recurring_status'>>("active");
  const [note, setNote] = useState("");
  const [overrideDueDate, setOverrideDueDate] = useState<Date | undefined>(undefined);
  const [isOverrideDueDateCalendarOpen, setIsOverrideDueDateCalendarOpen] = useState(false);
  const [isStartDateCalendarOpen, setIsStartDateCalendarOpen] = useState(false);
  const [isEndDateCalendarOpen, setIsEndDateCalendarOpen] = useState(false);
  const [isPaid, setIsPaid] = useState(false);
  const [showGlobalConfirmDialog, setShowGlobalConfirmDialog] = useState(false);
  const [preserveExceptions, setPreserveExceptions] = useState(true);

  // Filter categories based on transaction type
  const filteredCategories = useMemo(() => {
    const currentType = isRecurringTransaction ? (recurringTransaction.type === 'income' ? 'receita' : 'despesa') : type;
    if (currentType === "receita" || currentType === "income") {
      return allCategories.filter(cat => cat.parent_id === 'receitas_e_investimentos');
    } else {
      return allCategories.filter(cat => cat.id !== 'receitas_e_investimentos' && cat.parent_id !== 'receitas_e_investimentos');
    }
  }, [type, allCategories, isRecurringTransaction, recurringTransaction]);

  const getCategoryDisplayName = (catId: string) => {
    const category = allCategories.find(cat => cat.id === catId);
    if (!category) return catId;
    if (category.parent_id) {
      const parent = allCategories.find(p => p.id === category.parent_id);
      return `${parent?.nome || 'Categoria Principal'} > ${category.nome}`;
    }
    return category.nome;
  };

  useEffect(() => {
    if (editingTransaction) {
      setType(editingTransaction.type);
      setAmount(editingTransaction.amount.toFixed(2));
      
      // CORREÇÃO: Parsear a data explicitamente como local para evitar problemas de fuso horário
      const [year, month, day] = editingTransaction.date.split('-').map(Number);
      setDate(new Date(year, month - 1, day)); // month - 1 porque os meses são baseados em 0

      setCategory(editingTransaction.category);
      setDescription(editingTransaction.description || "");

      // Ensure status is a valid ReceitaStatus
      let initialStatus: ReceitaStatus = 'Pendente';
      const validStatuses: ReceitaStatus[] = ['Prevista', 'Pendente', 'Recebida', 'Cancelada'];
      if (editingTransaction.type === "income" && editingTransaction.status) {
        const transactionStatus = editingTransaction.status as ReceitaStatus; // Cast here
        if (validStatuses.includes(transactionStatus)) {
          initialStatus = transactionStatus;
        }
      }
      setStatus(initialStatus);
      
      // Initialize recurring specific states if it's a recurring transaction
      if (isRecurringTransaction) {
        setTitle(recurringTransaction.recurringMasterTitle);
        setAmount(recurringTransaction.originalValue.toFixed(2)); // Correção: setValue -> setAmount
        setCategory(recurringTransaction.originalCategory || UNSELECTED_VALUE); // Correção: setCategoryId -> setCategory
        setDueDay(recurringTransaction.originalDueDate?.toString() || "1");
        setFrequency(recurringTransaction.recurringMasterFrequency || "monthly");
        setStartDate(parseISO(recurringTransaction.recurringMasterStartDate));
        setEndDate(recurringTransaction.recurringMasterEndDate ? parseISO(recurringTransaction.recurringMasterEndDate) : undefined);
        setRecurringStatus(recurringTransaction.recurringMasterStatus || "active");
        
        if (recurringTransaction.isException) {
          const match = recurringTransaction.description.match(/\(([^)]+)\)$/);
          setNote(match ? match[1] : "");
          setOverrideDueDate(parseISO(recurringTransaction.date));
          setIsPaid(recurringTransaction.status === 'Recebida');
          setAmount(recurringTransaction.amount.toFixed(2)); // This line already uses setAmount
          setCategory(recurringTransaction.category || UNSELECTED_VALUE); // This line already uses setCategory
        } else {
          setNote("");
          setOverrideDueDate(parseISO(editingTransaction.date)); // Default to current occurrence date
          setIsPaid(editingTransaction.status === 'Recebida');
        }
        setEditOption("thisMonth");
        setPreserveExceptions(true);
      } else {
        // Reset recurring states for non-recurring transactions
        setTitle("");
        setDueDay("1");
        setFrequency("monthly");
        setStartDate(new Date());
        setEndDate(undefined);
        setRecurringStatus("active");
        setNote("");
        setOverrideDueDate(undefined);
        setIsPaid(false);
        setEditOption("thisMonth"); // Default, but won't be shown
        setPreserveExceptions(true);
      }
    } else {
      // Reset all form states when no transaction is being edited
      setType("expense");
      setAmount("");
      setDate(new Date());
      setCategory(UNSELECTED_VALUE);
      setDescription("");
      setStatus('Pendente'); // Reset to default
      setTitle("");
      setDueDay("1");
      setFrequency("monthly");
      setStartDate(new Date());
      setEndDate(undefined);
      setRecurringStatus("active");
      setNote("");
      setOverrideDueDate(undefined);
      setIsPaid(false);
      setEditOption("thisMonth");
      setPreserveExceptions(true);
    }
  }, [editingTransaction, isRecurringTransaction, recurringTransaction]);

  // REMOVIDO: useEffect para fechar o AlertDialog de confirmação de exclusão

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingTransaction) return;

    // Basic validation for all types
    if (!amount || parseFloat(amount) <= 0 || category === UNSELECTED_VALUE) {
      toast.error("Preencha todos os campos obrigatórios (Valor e Subcategoria).");
      return;
    }

    if (isRecurringTransaction) {
      // Recurring specific validations
      if (!title.trim()) {
        toast.error("O título do lançamento recorrente é obrigatório.");
        return;
      }
      if (parseInt(dueDay) < 1 || parseInt(dueDay) > 31) {
        toast.error("O dia de vencimento deve ser entre 1 e 31.");
        return;
      }
      if (endDate && startDate && endDate < startDate) {
        toast.error("A data final não pode ser anterior à data inicial.");
        return;
      }

      if (editOption === "all") {
        setShowGlobalConfirmDialog(true); // Show confirmation for global changes
        return;
      }
    }

    // Proceed with update
    performUpdate();
  };

  const performUpdate = () => {
    if (!editingTransaction) return;
    setLoading(true);

    // Correção: Formatar a data usando os componentes locais para evitar problemas de fuso horário
    const formattedDate = date 
      ? `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}` 
      : "";

    const updatedTransaction: Omit<Transaction, "id"> = {
      type,
      amount: parseFloat(amount),
      date: formattedDate, // Usar a data formatada corretamente
      category,
      description,
      // Include status and recurrence fields if it's an income or legacy fixed
      ...(type === "income" && { status }),
      is_fixed: editingTransaction.is_fixed, // Keep original is_fixed status for legacy
      recurrence_frequency: editingTransaction.recurrence_frequency, // Keep original for legacy
      recurrence_installments_count: editingTransaction.recurrence_installments_count, // Keep original for legacy
    };

    // Pass recurring specific data if applicable
    onUpdateTransaction(
      editingTransaction.id,
      type,
      updatedTransaction,
      isRecurringTransaction ? editOption : undefined,
      isRecurringTransaction && editOption === "all" ? preserveExceptions : undefined,
      {
        // Additional recurring data for the handler
        title: title.trim(),
        value: parseFloat(amount), // Usar o estado 'amount'
        categoryId: category === UNSELECTED_VALUE ? null : category, // Usar o estado 'category'
        dueDay: parseInt(dueDay),
        frequency,
        startDate: startDate ? format(startDate, "yyyy-MM-dd") : null,
        endDate: endDate ? format(endDate, "yyyy-MM-dd") : null,
        recurringStatus,
        note: note.trim() || null,
        overrideDueDate: overrideDueDate ? format(overrideDueDate, "yyyy-MM-dd") : null,
        isPaid,
      }
    );
    setLoading(false);
    setShowGlobalConfirmDialog(false);
  };

  // MODIFICADO: handleDeleteClick agora chama diretamente onDeleteTransaction
  const handleDeleteClick = () => {
    if (editingTransaction) {
      onDeleteTransaction(editingTransaction.id, editingTransaction.type, editingTransaction.is_fixed);
    }
  };

  // REMOVIDO: confirmDelete function
  // REMOVIDO: deleteDialogTitle e deleteDialogDescription

  const formContent = (
    <>
      <div className="flex items-center justify-between mb-6">
        <h2 className={cn("text-2xl font-bold", isMobile && "text-xl")}>
          {isRecurringTransaction ? "Editar Lançamento Recorrente" : "Editar Lançamento"}
        </h2>
        <Button variant="ghost" size="icon" onClick={onCancelEdit} className={cn(isMobile && "h-8 w-8")}>
          <X className={cn("h-4 w-4", isMobile && "h-3.5 w-3.5")} />
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {isRecurringTransaction && (
          <div className="space-y-4 py-4">
            <EditOptionSelector
              editOption={editOption}
              setEditOption={setEditOption}
              isMobile={isMobile}
              loading={loading}
            />
            <div className="space-y-4 mt-4">
              <CommonFields
                title={title}
                setTitle={setTitle}
                value={amount} // Use amount for common fields value
                setValue={setAmount} // Update amount state
                categoryId={category} // Use category for common fields category
                setCategoryId={setCategory} // Update category state
                filteredCategories={filteredCategories}
                getCategoryDisplayName={getCategoryDisplayName}
                loading={loading}
                isMobile={isMobile}
                hideTitle={editOption === "thisMonth"}
                categoryLabel="Subcategoria" // Passar a label personalizada
              />

              {editOption === "thisMonth" && (
                <ThisMonthFields
                  overrideDueDate={overrideDueDate}
                  setOverrideDueDate={setOverrideDueDate}
                  isOverrideDueDateCalendarOpen={isOverrideDueDateCalendarOpen}
                  setIsOverrideDueDateCalendarOpen={setIsOverrideDueDateCalendarOpen}
                  note={note}
                  setNote={setNote}
                  isPaid={isPaid}
                  setIsPaid={setIsPaid}
                  loading={loading}
                  isMobile={isMobile}
                />
              )}

              {editOption !== "thisMonth" && (
                <RecurringMasterFields
                  dueDay={dueDay}
                  setDueDay={setDueDay}
                  frequency={frequency}
                  setFrequency={setFrequency}
                  startDate={startDate}
                  setStartDate={setStartDate}
                  isStartDateCalendarOpen={isStartDateCalendarOpen}
                  setIsStartDateCalendarOpen={setIsStartDateCalendarOpen}
                  endDate={endDate}
                  setEndDate={setEndDate}
                  isEndDateCalendarOpen={isEndDateCalendarOpen}
                  setIsEndDateCalendarOpen={setIsEndDateCalendarOpen}
                  status={recurringStatus}
                  setStatus={setRecurringStatus}
                  loading={loading}
                  isMobile={isMobile}
                  showStartDate={editOption === "all"}
                  showPreserveExceptions={editOption === "all"}
                  preserveExceptions={preserveExceptions}
                  setPreserveExceptions={setPreserveExceptions}
                />
              )}
            </div>
          </div>
        )}

        {!isRecurringTransaction && (
          <>
            {/* Categoria (agora Subcategoria e primeiro campo) */}
            <div className="space-y-2">
              <Label htmlFor="category" className={cn(isMobile && "text-xs")}>Subcategoria</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className={cn(isMobile && "h-9 text-sm")}>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNSELECTED_VALUE} disabled className={cn(isMobile && "text-sm")}>Selecione...</SelectItem>
                  {filteredCategories.length === 0 ? (
                    <SelectItem value={UNSELECTED_VALUE} disabled className={cn(isMobile && "text-sm")}>Nenhuma subcategoria disponível</SelectItem>
                  ) : (
                    filteredCategories
                      .map((cat) => (
                        <SelectItem key={cat.id} value={cat.id} className={cn(isMobile && "text-sm")}>
                          <span className="flex items-center gap-2">
                            <span>{cat.icone}</span>
                            <span>{cat.nome}</span>
                          </span>
                        </SelectItem>
                      ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Tipo - REMOVIDO */}
              {/* Valor */}
              <div className="space-y-2">
                <Label htmlFor="amount" className={cn(isMobile && "text-xs")}>Valor (R$)</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0,00"
                  required
                  className={cn(isMobile && "h-9 text-sm")}
                />
              </div>

              {/* Data */}
              <div className="space-y-2">
                <Label htmlFor="date" className={cn(isMobile && "text-xs")}>Data</Label>
                <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full justify-start text-left font-normal h-10",
                        !date && "text-muted-foreground",
                        isMobile && "h-9 text-sm"
                      )}
                      disabled={editingTransaction?.is_fixed} // Disable date for legacy fixed transactions
                    >
                      <CalendarIcon className={cn("mr-2 h-4 w-4", isMobile && "h-3.5 w-3.5")} />
                      {date ? format(date, "PPP", { locale: ptBR }) : <span>Selecione uma data</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className={cn("w-auto p-0", isMobile && "p-1")}>
                    <Calendar
                      mode="single"
                      selected={date}
                      onSelect={(selectedDate) => {
                        setDate(selectedDate);
                        setIsCalendarOpen(false);
                      }}
                      initialFocus
                      locale={ptBR}
                      showOutsideDays={false}
                      className={cn(isMobile && "text-sm")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className={cn(isMobile && "text-xs")}>Descrição</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Adicione uma descrição..."
                rows={3}
                className={cn(isMobile && "text-sm")}
              />
            </div>

            {type === "income" && ( // Status dropdown only for income
              <div>
                <Label htmlFor="status" className={cn(isMobile && "text-xs")}>Status da Receita</Label>
                <Select value={status} onValueChange={(value: ReceitaStatus) => setStatus(value)}>
                  <SelectTrigger className={cn(isMobile && "h-9 text-sm")}>
                    <SelectValue placeholder="Selecione o status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Prevista" className={cn(isMobile && "text-sm")}>Prevista</SelectItem>
                    <SelectItem value="Pendente" className={cn(isMobile && "text-sm")}>Pendente</SelectItem>
                    <SelectItem value="Recebida" className={cn(isMobile && "text-sm")}>Recebida</SelectItem>
                    <SelectItem value="Cancelada" className={cn(isMobile && "text-sm")}>Cancelada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </>
        )}

        <div className={cn("flex flex-col gap-4", !isMobile && "md:flex-row")}>
          {editingTransaction && (
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteClick} // Agora chama diretamente handleDeleteClick
              className={cn("w-full", !isMobile && "md:flex-1", isMobile && "h-9 text-sm")}
              disabled={loading}
            >
              <DynamicIcon name="Trash2" className={cn("mr-2 h-4 w-4", isMobile && "h-3.5 w-3.5")} />
              Excluir Lançamento
            </Button>
          )}
          <Button type="submit" className={cn("w-full", !isMobile && "md:flex-1", isMobile && "h-9 text-sm")} disabled={loading}>
            <DynamicIcon name="CheckCircle" className={cn("mr-2 h-4 w-4", isMobile && "h-3.5 w-3.5")} />
            {loading ? "Salvando..." : "Salvar Alterações"}
          </Button>
          <Button type="button" variant="outline" onClick={onCancelEdit} className={cn("w-full", !isMobile && "md:flex-1", isMobile && "h-9 text-sm")} disabled={loading}>
            <DynamicIcon name="XCircle" className={cn("mr-2 h-4 w-4", isMobile && "h-3.5 w-3.5")} />
            Cancelar
          </Button>
        </div>
      </form>

      {/* REMOVIDO: AlertDialog for Delete Confirmation */}

      {/* AlertDialog for Global Recurring Update Confirmation */}
      <AlertDialog open={showGlobalConfirmDialog} onOpenChange={setShowGlobalConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Alteração Global?</AlertDialogTitle>
            <AlertDialogDescription>
              Você está prestes a alterar **toda a recorrência** deste lançamento.
              {preserveExceptions ? (
                " As exceções existentes serão mantidas."
              ) : (
                " Todas as exceções existentes serão **removidas**."
              )}
              Esta ação não pode ser desfeita facilmente. Tem certeza que deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading} onClick={() => setShowGlobalConfirmDialog(false)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={performUpdate} disabled={loading}>
              {loading ? "Confirmando..." : "Confirmar e Salvar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );

  return isMobile ? (
    <div className={cn("p-4", isMobile && "p-0")}>
      {formContent}
    </div>
  ) : (
    <Card className={cn("p-6 animate-fade-in rounded-xl shadow-sm")}>
      {formContent}
    </Card>
  );
};