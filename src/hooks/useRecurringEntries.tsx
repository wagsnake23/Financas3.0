import { useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Tables, TablesInsert, TablesUpdate, Enums } from "@/integrations/supabase/types";
import { format, addMonths, addQuarters, addYears, startOfMonth, endOfMonth, isWithinInterval, getDate, setDate, isPast, subMonths, isSameMonth, isBefore, isValid } from "date-fns";
import { toast } from "sonner";
import { ptBR } from "date-fns/locale";
import { AppCategory, Transaction } from "@/types/finance";
import { createSafeDate } from "@/lib/utils"; // Importar createSafeDate

type RecurringEntry = Tables<'recurring_entries'>;
type RecurringException = Tables<'recurring_entry_exceptions'>;
type RecurringType = Enums<'recurring_type'>;
type RecurringFrequency = Enums<'recurring_frequency'>;

export interface MaterializedRecurringTransaction extends Transaction {
  recurringEntryId: string;
  isRecurring: true;
  isException: boolean;
  exceptionId?: string;
  originalValue: number;
  originalCategory: string | null;
  originalDueDate: number; // due_day from master
  frequency: RecurringFrequency;
  recurringStatus: Enums<'recurring_status'>;
  // Adicionado para facilitar a edição
  recurringMasterTitle: string;
  recurringMasterStartDate: string;
  recurringMasterEndDate: string | null;
  recurringMasterFrequency: RecurringFrequency;
  recurringMasterDueDay: number;
  recurringMasterStatus: Enums<'recurring_status'>;
  // Novos campos de pagamento
  forma_pagamento: string | null;
  cartao_id: string | null;
}

// Helper to generate a unique ID for materialized occurrences
const generateOccurrenceId = (recurringId: string, year: number, month: number) => {
  return `${recurringId}-${year}-${month}`;
};

export const useRecurringEntries = (user: User | null, currentMonth: Date, allCategories: AppCategory[], enabled: boolean) => { // Adicionado 'enabled'
  const queryClient = useQueryClient();
  console.log("useRecurringEntries: Initializing for month:", format(currentMonth, 'yyyy-MM-dd'), "Enabled:", enabled); // Log atualizado

  // Fetch all recurring entries for the user
  const { data: recurringEntries = [], isLoading: isLoadingRecurringEntries } = useQuery<RecurringEntry[]>({
    queryKey: ["recurringEntries", user?.id],
    queryFn: async () => {
      if (!user?.id) throw new Error("User not authenticated.");
      const { data, error } = await supabase
        .from("recurring_entries")
        .select("*")
        .eq("user_id", user.id)
        .order("start_date", { ascending: true });
      if (error) throw error;
      console.log("useRecurringEntries: Fetched recurringEntries (re-fetch triggered):", data);
      return data;
    },
    enabled: enabled, // Usar o parâmetro 'enabled'
  });

  // Fetch all exceptions for the user's recurring entries
  const { data: recurringExceptions = [], isLoading: isLoadingRecurringExceptions } = useQuery<RecurringException[]>({
    queryKey: ["recurringExceptions", user?.id],
    queryFn: async () => {
      if (!user?.id || recurringEntries.length === 0) return [];
      const recurringIds = recurringEntries.map(entry => entry.id);
      if (recurringIds.length === 0) return [];

      const { data, error } = await supabase
        .from("recurring_entry_exceptions")
        .select("*")
        .in("recurring_id", recurringIds);
      if (error) throw error;
      console.log("useRecurringEntries: Fetched recurringExceptions (after potential update):", data); // LOG ADICIONADO
      return data;
    },
    enabled: enabled && recurringEntries.length > 0, // Usar o parâmetro 'enabled'
  });

  // Materialize recurring transactions for the current month
  const materializedRecurringTransactions = useMemo(() => {
    console.log("useRecurringEntries: materializedRecurringTransactions useMemo re-running. Dependencies:", {
      user: user?.id,
      isLoadingRecurringEntries,
      isLoadingRecurringExceptions,
      recurringEntriesCount: recurringEntries.length,
      recurringExceptionsCount: recurringExceptions.length,
      currentMonth: format(currentMonth, 'yyyy-MM-dd'),
      enabled: enabled // Adicionado enabled para o log
    });
    if (!user || isLoadingRecurringEntries || isLoadingRecurringExceptions || !enabled) return []; // Adicionado !enabled

    const transactions: MaterializedRecurringTransaction[] = [];

    // Define currentYear and currentMonthIndex here
    const currentYear = currentMonth.getFullYear();
    const currentMonthIndex = currentMonth.getMonth() + 1; // getMonth() is 0-indexed

    recurringEntries.forEach(entry => {
      console.log(`[DEBUG] Processing recurring entry: ${entry.id} - ${entry.title}`);
      console.log(`[DEBUG]   Master due_day: ${entry.due_day}`);
      console.log(`[DEBUG]   Current Month (start): ${format(startOfMonth(currentMonth), 'yyyy-MM-dd')}`);

      // Check if the entry is active and within its date range
      const entryStartDate = createSafeDate(entry.start_date); // Usar createSafeDate
      const entryEndDate = entry.end_date ? createSafeDate(entry.end_date) : null; // Usar createSafeDate

      // Se a data de início for inválida, pula esta entrada
      if (!entryStartDate) {
        console.log(`[DEBUG]   Skipping entry ${entry.id}: Invalid start_date.`);
        return;
      }

      // Check if the recurring entry is relevant for the current month
      const isRelevantForMonth = isWithinInterval(currentMonth, { start: entryStartDate, end: entryEndDate || new Date(9999, 11, 31) });
      console.log(`[DEBUG]   isRelevantForMonth: ${isRelevantForMonth} (Current Month: ${format(currentMonth, 'yyyy-MM-dd')}, Start: ${format(entryStartDate, 'yyyy-MM-dd')}, End: ${entryEndDate ? format(entryEndDate, 'yyyy-MM-dd') : 'N/A'})`);

      if (!isRelevantForMonth || entry.status === 'canceled') {
        console.log(`[DEBUG]   Skipping entry: Not relevant for month or canceled (status: ${entry.status})`);
        return; // Skip if not relevant or canceled
      }

      // --- START: Adjusted logic for baseDueDate calculation ---
      let baseDueDate = setDate(startOfMonth(currentMonth), entry.due_day);
      
      // If the entry's start_date is in the current month, and the due_day is before the start_date's day,
      // then this occurrence should be considered from the start_date itself, not the due_day.
      // This handles cases where a recurrence starts mid-month but has a due_day earlier in the month.
      if (isSameMonth(entryStartDate, currentMonth) && isBefore(baseDueDate, entryStartDate)) {
        baseDueDate = entryStartDate;
        console.log(`[DEBUG]   Adjusted baseDueDate to entryStartDate: ${format(baseDueDate, 'yyyy-MM-dd')} because entry starts mid-month.`);
      } else if (getDate(baseDueDate) !== entry.due_day) {
        // Adjust if due_day is greater than days in current month (e.g., day 31 in February)
        baseDueDate = endOfMonth(currentMonth); // Set to last day of month if due_day is too high
        console.log(`[DEBUG]   Adjusted baseDueDate to endOfMonth: ${format(baseDueDate, 'yyyy-MM-dd')} due to month end clamp.`);
      }
      console.log(`[DEBUG]   Calculated baseDueDate: ${format(baseDueDate, 'yyyy-MM-dd')}`);
      // --- END: Adjusted logic for baseDueDate calculation ---

      // Find any exception for this specific month
      const exception = recurringExceptions.find(
        ex => ex.recurring_id === entry.id && ex.year === currentYear && ex.month === currentMonthIndex
      );
      console.log(`[DEBUG]   Exception found for ${entry.id} (Month: ${currentMonthIndex}, Year: ${currentYear}): ${!!exception ? 'Yes' : 'No'}`); // LOG ADICIONADO
      if (exception) {
        console.log(`[DEBUG]     Exception override_due_date: ${exception.override_due_date}`);
        console.log(`[DEBUG]     Exception paid status: ${exception.paid}`);
        console.log(`[DEBUG]     Exception canceled status: ${exception.canceled}`);
      }

      // Apply overrides from exception
      const finalValue = exception?.override_value ?? entry.value;
      const finalCategory = exception?.override_category_id ?? entry.category_id;
      const finalDueDate = exception?.override_due_date ? createSafeDate(exception.override_due_date) : baseDueDate; // Usar createSafeDate
      const isCanceledByException = exception?.canceled ?? false; // Renomeado para evitar conflito com entry.status
      const isPaidByException = exception?.paid ?? false; // <--- Valor de 'paid' da exceção
      
      // Se finalDueDate for null, usa a data atual como fallback para evitar erro de formatação
      const dateToFormat = finalDueDate || new Date(); 
      console.log(`[DEBUG]   Final Due Date for transaction: ${format(dateToFormat, 'yyyy-MM-dd')}`);
      console.log(`[DEBUG]   Final isPaidByException: ${isPaidByException}`); // LOG ADICIONADO

      if (isCanceledByException) {
        console.log(`[DEBUG]   Skipping entry ${entry.id}: Canceled by exception for this month`);
        return; // Skip if this month is canceled by an exception
      }

      // Determine status for display (prioridade: Cancelada > Recebida > Pendente > Prevista)
      let status: Enums<'receita_status'>;
      if (isCanceledByException) { // Se a exceção marcou como cancelado
        status = 'Cancelada';
      } else if (isPaidByException) { // Se a exceção marcou como pago
        status = 'Recebida';
      } else if (isPast(dateToFormat)) { // Se a data já passou e não foi pago
        status = 'Pendente';
      } else { // Se a data está no futuro e não foi pago
        status = 'Prevista';
      }
      console.log(`[DEBUG]   Entry ${entry.id} (Month: ${currentMonthIndex}, Year: ${currentYear}) - Final status: ${status}`); // LOG ADICIONADO
      
      const materializedTransaction: MaterializedRecurringTransaction = {
        id: generateOccurrenceId(entry.id, currentYear, currentMonthIndex),
        recurringEntryId: entry.id,
        isRecurring: true,
        isException: !!exception,
        exceptionId: exception?.id,
        type: entry.type === 'receita' ? 'income' : 'expense',
        amount: finalValue,
        date: format(dateToFormat, "yyyy-MM-dd"), // Usar dateToFormat
        category: finalCategory || "outros_diversos", // Fallback category ID
        description: entry.title + (exception?.note ? ` (${exception.note})` : ''), // Corrigido: usando exception?.note
        status: status,
        is_fixed: true, // Mark as fixed for compatibility with TransactionRow
        recurrence_frequency: entry.frequency,
        recurrence_installments_count: null, // Not applicable for single occurrence
        installmentNumber: currentMonthIndex, // Use month number as installment for display
        totalInstallments: null, // Not applicable
        // Novos campos de pagamento
        forma_pagamento: entry.forma_pagamento,
        cartao_id: entry.cartao_id,
        originalValue: entry.value,
        originalCategory: entry.category_id,
        originalDueDate: entry.due_day,
        frequency: entry.frequency,
        recurringStatus: entry.status,
        recurringMasterTitle: entry.title,
        recurringMasterStartDate: entry.start_date,
        recurringMasterEndDate: entry.end_date,
        recurringMasterFrequency: entry.frequency,
        recurringMasterDueDay: entry.due_day,
        recurringMasterStatus: entry.status,
      };

      transactions.push(materializedTransaction);
    });

    console.log("useRecurringEntries: Final materializedRecurringTransactions for month:", format(currentMonth, 'yyyy-MM'), transactions.map(t => ({ id: t.id, status: t.status, isPaid: t.status === 'Recebida', date: t.date })));
    return transactions;
  }, [currentMonth, recurringEntries, recurringExceptions, user, allCategories, isLoadingRecurringEntries, isLoadingRecurringExceptions, enabled]);

  const invalidateQueries = useCallback(() => {
    console.log("useRecurringEntries: invalidateQueries: Invalidating recurringEntries and recurringExceptions.");
    queryClient.invalidateQueries({ queryKey: ["recurringEntries", user?.id] });
    queryClient.invalidateQueries({ queryKey: ["recurringExceptions", user?.id] });
    // Invalida também as queries que useTransactionsData depende para garantir que a lista seja re-renderizada
    queryClient.invalidateQueries({ queryKey: ["revenues", user?.id] });
    queryClient.invalidateQueries({ queryKey: ["expenseInstallments", user?.id] });
  }, [queryClient, user?.id]);

  const createRecurringEntryMutation = useMutation({
    mutationFn: async (newEntry: TablesInsert<'recurring_entries'>) => {
      if (!user?.id) throw new Error("User not authenticated.");
      const { data, error } = await supabase
        .from("recurring_entries")
        .insert(newEntry)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      invalidateQueries();
      toast.success("Lançamento recorrente criado!", {
        style: { backgroundColor: 'hsl(var(--soft-green))', color: 'hsl(var(--success-darker))' }
      });
    },
    onError: (error) => {
      toast.error("Erro ao criar lançamento recorrente", { description: error.message });
      console.error("Supabase error creating recurring entry:", error);
    },
  });

  // RPC para "Somente esta parcela" (Criar ou Atualizar Exceção)
  const createOrUpdateExceptionMutation = useMutation({
    mutationFn: async ({ recurring_id, year, month, payload }: { recurring_id: string; year: number; month: number; payload: TablesUpdate<'recurring_entry_exceptions'> }) => {
      if (!user?.id) throw new Error("User not authenticated.");
      const { data, error } = await supabase.rpc('rpc_create_or_update_recurring_exception', {
        p_recurring_id: recurring_id,
        p_year: year,
        p_month: month,
        p_payload: payload,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      invalidateQueries();
      toast.success("Exceção de recorrência salva!", {
        style: { backgroundColor: 'hsl(var(--soft-green))', color: 'hsl(var(--success-darker))' }
      });
    },
    onError: (error) => {
      toast.error("Erro ao salvar exceção de recorrência", { description: error.message });
      console.error("Supabase error saving recurring exception:", error);
    },
  });

  // RPC para "A partir desta parcela" (Atualizar Registro Mestre Recorrente a partir de um mês específico)
  const updateRecurringMasterFutureMutation = useMutation({
    mutationFn: async ({ recurring_id, start_date, payload, preserve_exceptions = true }: { recurring_id: string; start_date: Date; payload: TablesUpdate<'recurring_entries'>; preserve_exceptions?: boolean }) => {
      if (!user?.id) throw new Error("User not authenticated.");
      const { data, error } = await supabase.rpc('rpc_update_recurring_master_future', {
        p_recurring_id: recurring_id,
        p_start_date: format(start_date, "yyyy-MM-dd"),
        p_payload: payload,
        p_preserve_exceptions: preserve_exceptions, // Pass the new parameter
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      invalidateQueries();
      toast.success("Recorrência atualizada a partir deste mês!", {
        style: { backgroundColor: 'hsl(var(--soft-green))', color: 'hsl(var(--success-darker))' }
      });
    },
    onError: (error) => {
      toast.error("Erro ao atualizar recorrência futura", { description: error.message });
      console.error("Supabase error updating recurring entry future:", error);
    },
  });

  // RPC para "Toda a recorrência" (Atualizar Registro Mestre Globalmente)
  const updateRecurringMasterGlobalMutation = useMutation({
    mutationFn: async ({ recurring_id, payload, preserve_exceptions = true }: { recurring_id: string; payload: TablesUpdate<'recurring_entries'>; preserve_exceptions?: boolean }) => {
      if (!user?.id) throw new Error("User not authenticated.");
      const { data, error } = await supabase.rpc('rpc_update_recurring_master_global', {
        p_recurring_id: recurring_id,
        p_payload: payload,
        p_preserve_exceptions: preserve_exceptions,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      invalidateQueries();
      toast.success("Recorrência atualizada globalmente!", {
        style: { backgroundColor: 'hsl(var(--soft-green))', color: 'hsl(var(--success-darker))' }
      });
    },
    onError: (error) => {
      toast.error("Erro ao atualizar recorrência global", { description: error.message });
      console.error("Supabase error updating recurring entry global:", error);
    },
  });

  const deleteRecurringEntryMutation = useMutation({
    mutationFn: async (recurring_id: string) => {
      if (!user?.id) throw new Error("User not authenticated.");
      const { error } = await supabase
        .from("recurring_entries")
        .delete()
        .eq("id", recurring_id)
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateQueries();
      toast.success("Recorrência excluída!", {
        style: { backgroundColor: 'hsl(var(--soft-green))', color: 'hsl(var(--success-darker))' }
      });
    },
    onError: (error) => {
      toast.error("Erro ao excluir recorrência", { description: error.message });
      console.error("Supabase error deleting recurring entry:", error);
    },
  });

  const cancelMonthMutation = useMutation({
    mutationFn: async ({ recurring_id, year, month }: { recurring_id: string; year: number; month: number }) => {
      if (!user?.id) throw new Error("User not authenticated.");

      const payload: TablesInsert<'recurring_entry_exceptions'> = {
        recurring_id,
        year,
        month,
        canceled: true,
        paid: false, // A canceled entry is not paid
        note: "Cancelado por exceção",
        override_value: 0, // Set value to 0 for canceled
        override_category_id: null, // Explicitly set to null
      };

      const { data, error } = await supabase.rpc('rpc_create_or_update_recurring_exception', {
        p_recurring_id: recurring_id,
        p_year: year,
        p_month: month,
        p_payload: payload,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      invalidateQueries();
      toast.success("Mês cancelado com sucesso!", {
        style: { backgroundColor: 'hsl(var(--soft-green))', color: 'hsl(var(--success-darker))' }
      });
    },
    onError: (error) => {
      toast.error("Erro ao cancelar mês", { description: error.message });
      console.error("Supabase error canceling month:", error);
    },
  });

  const endRecurringAtMutation = useMutation({
    mutationFn: async ({ recurring_id, end_year, end_month }: { recurring_id: string; end_year: number; end_month: number }) => {
      if (!user?.id) throw new Error("User not authenticated.");

      const dateForEndDate = new Date(end_year, end_month - 1);
      if (!isValid(dateForEndDate)) { // Defensive check
        console.error("Invalid date created for end_date in endRecurringAtMutation:", { end_year, end_month });
        throw new Error("Invalid end date provided for recurring entry.");
      }
      const endDate = format(endOfMonth(dateForEndDate), "yyyy-MM-dd");

      const { data, error } = await supabase
        .from("recurring_entries")
        .update({ end_date: endDate, status: 'active' }) // Ensure status is active if setting an end date
        .eq("id", recurring_id)
        .eq("user_id", user.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      invalidateQueries();
      toast.success("Recorrência finalizada a partir do mês selecionado!", {
        style: { backgroundColor: 'hsl(var(--soft-green))', color: 'hsl(var(--success-darker))' }
      });
    },
    onError: (error) => {
      toast.error("Erro ao finalizar recorrência", { description: error.message });
      console.error("Supabase error ending recurring entry:", error);
    },
  });

  const markMonthPaidMutation = useMutation({
    mutationFn: async ({ recurring_id, year, month, is_paid }: { recurring_id: string; year: number; month: number; is_paid: boolean }) => {
      if (!user?.id) throw new Error("User not authenticated.");

      // Fetch existing exception to preserve other override fields if they exist
      const { data: existingException, error: fetchError } = await supabase
        .from("recurring_entry_exceptions")
        .select("override_due_date, override_value, override_category_id, note")
        .eq("recurring_id", recurring_id)
        .eq("year", year)
        .eq("month", month)
        .maybeSingle(); // Use maybeSingle to get null if no record

      if (fetchError) {
        console.error("Error fetching existing exception:", fetchError);
        // Decide whether to throw or proceed with default payload
        // For now, let's proceed with default, but log the error
      }

      const payload: TablesInsert<'recurring_entry_exceptions'> = {
        recurring_id,
        year,
        month,
        paid: is_paid,
        canceled: false, // Ensure it's not marked as canceled when toggling paid status
        note: existingException?.note || null, // Preserve existing note
        override_value: existingException?.override_value || null, // Preserve existing override_value
        override_category_id: existingException?.override_category_id || null, // Preserve existing override_category_id
        override_due_date: existingException?.override_due_date || null, // Preserve existing override_due_date
      };

      const { data, error } = await supabase.rpc('rpc_create_or_update_recurring_exception', {
        p_recurring_id: recurring_id,
        p_year: year,
        p_month: month,
        p_payload: payload,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      invalidateQueries();
      toast.success("Status de pagamento atualizado!", {
        style: { backgroundColor: 'hsl(var(--soft-green))', color: 'hsl(var(--success-darker))' }
      });
    },
    onError: (error) => {
      toast.error("Erro ao atualizar status de pagamento", { description: error.message });
      console.error("Supabase error marking month paid:", error);
    },
  });

  return {
    materializedRecurringTransactions,
    isLoading: isLoadingRecurringEntries || isLoadingRecurringExceptions, // Corrigido: isLoading é uma combinação dos loadings das queries
    createRecurringEntry: createRecurringEntryMutation.mutateAsync,
    createOrUpdateException: createOrUpdateExceptionMutation.mutateAsync,
    updateRecurringMasterFuture: updateRecurringMasterFutureMutation.mutateAsync,
    updateRecurringMasterGlobal: updateRecurringMasterGlobalMutation.mutateAsync,
    deleteRecurringEntry: deleteRecurringEntryMutation.mutateAsync,
    cancelMonth: cancelMonthMutation.mutateAsync,
    endRecurringAt: endRecurringAtMutation.mutateAsync,
    markMonthPaid: markMonthPaidMutation.mutateAsync,
  };
};