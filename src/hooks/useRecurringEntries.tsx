import { useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Tables, TablesInsert, TablesUpdate, Enums } from "@/integrations/supabase/types";
import { format, addMonths, addQuarters, addYears, startOfMonth, endOfMonth, isWithinInterval, getDate, setDate, isPast, subMonths } from "date-fns";
import { toast } from "sonner";
import { ptBR } from "date-fns/locale";
import { AppCategory, Transaction } from "@/types/finance";

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
}

// Helper to generate a unique ID for materialized occurrences
const generateOccurrenceId = (recurringId: string, year: number, month: number) => {
  return `${recurringId}-${year}-${month}`;
};

export const useRecurringEntries = (user: User | null, currentMonth: Date, allCategories: AppCategory[]) => {
  const queryClient = useQueryClient();

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
      console.log("Fetched recurringEntries (re-fetch triggered):", data);
      return data;
    },
    enabled: !!user?.id,
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
      console.log("Fetched recurringExceptions:", data);
      return data;
    },
    enabled: !!user?.id && recurringEntries.length > 0,
  });

  // Materialize recurring transactions for the current month
  const materializedRecurringTransactions = useMemo(() => {
    console.log("materializedRecurringTransactions useMemo re-running...");
    if (!user || isLoadingRecurringEntries || isLoadingRecurringExceptions) return [];

    const startOfCurrentMonth = startOfMonth(currentMonth);
    const endOfCurrentMonth = endOfMonth(currentMonth);
    const currentYear = currentMonth.getFullYear();
    const currentMonthIndex = currentMonth.getMonth() + 1; // 1-indexed month

    const transactions: MaterializedRecurringTransaction[] = [];

    recurringEntries.forEach(entry => {
      console.log(`Processing recurring entry: ${entry.id} - ${entry.title} (Type: ${entry.type})`);
      // Check if the entry is active and within its date range
      const entryStartDate = new Date(entry.start_date);
      const entryEndDate = entry.end_date ? new Date(entry.end_date) : null;

      // Check if the recurring entry is relevant for the current month
      const isRelevantForMonth = isWithinInterval(currentMonth, { start: entryStartDate, end: entryEndDate || new Date(9999, 11, 31) });
      console.log(`  isRelevantForMonth: ${isRelevantForMonth} (Current Month: ${format(currentMonth, 'yyyy-MM-dd')}, Start: ${format(entryStartDate, 'yyyy-MM-dd')}, End: ${entryEndDate ? format(entryEndDate, 'yyyy-MM-dd') : 'N/A'})`);

      if (!isRelevantForMonth || entry.status === 'canceled') {
        console.log(`  Skipping entry: Not relevant for month or canceled (status: ${entry.status})`);
        return; // Skip if not relevant or canceled
      }

      // Calculate the base due date for the current month
      let baseDueDate = setDate(startOfCurrentMonth, entry.due_day);
      // Adjust if due_day is greater than days in current month
      if (getDate(baseDueDate) !== entry.due_day) {
        baseDueDate = endOfCurrentMonth; // Set to last day of month if due_day is too high
      }

      // Find any exception for this specific month
      const exception = recurringExceptions.find(
        ex => ex.recurring_id === entry.id && ex.year === currentYear && ex.month === currentMonthIndex
      );
      console.log(`  Found exception for this month: ${!!exception}`);

      // Apply overrides from exception
      const finalValue = exception?.override_value ?? entry.value;
      const finalCategory = exception?.override_category_id ?? entry.category_id;
      const finalDueDate = exception?.override_due_date ? new Date(exception.override_due_date) : baseDueDate;
      const isCanceled = exception?.canceled ?? false;
      const isPaid = exception?.paid ?? false;
      const note = exception?.note ?? null;

      if (isCanceled) {
        console.log(`  Skipping entry: Canceled by exception for this month`);
        return; // Skip if this month is canceled by an exception
      }

      // Determine status for display
      let status: Enums<'receita_status'> = 'Pendente';
      if (isPaid) {
        status = 'Recebida'; // For both income/expense, 'paid' means 'Recebida'
      } else if (isPast(finalDueDate) && !isPaid) {
        status = 'Pendente';
      } else {
        status = 'Prevista';
      }
      
      const materializedTransaction: MaterializedRecurringTransaction = {
        id: generateOccurrenceId(entry.id, currentYear, currentMonthIndex),
        recurringEntryId: entry.id,
        isRecurring: true,
        isException: !!exception,
        exceptionId: exception?.id,
        type: entry.type === 'receita' ? 'income' : 'expense',
        amount: finalValue,
        date: format(finalDueDate, "yyyy-MM-dd"),
        category: finalCategory || "outros_diversos", // Fallback category ID
        description: entry.title + (note ? ` (${note})` : ''),
        status: status,
        is_fixed: true, // Mark as fixed for compatibility with TransactionRow
        recurrence_frequency: entry.frequency,
        recurrence_installments_count: null, // Not applicable for single occurrence
        installmentNumber: currentMonthIndex, // Use month number as installment for display
        totalInstallments: null, // Not applicable
        forma_pagamento: null, // Recurring entries don't have this directly
        cartao_id: null, // Recurring entries don't have this directly
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
      console.log("  Materialized transaction:", materializedTransaction);
    });

    console.log("Final materializedRecurringTransactions for month:", format(currentMonth, 'yyyy-MM'), transactions);
    return transactions;
  }, [currentMonth, recurringEntries, recurringExceptions, user, allCategories, isLoadingRecurringEntries, isLoadingRecurringExceptions]);

  const invalidateQueries = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["recurringEntries", user?.id] });
    queryClient.invalidateQueries({ queryKey: ["recurringExceptions", user?.id] });
    // Removido: queryClient.invalidateQueries({ queryKey: ["transactions"] }); // Esta linha não é mais necessária
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
        style: { backgroundColor: 'hsl(var(--soft-green))', color: 'hsl(var(--success))' }
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
        style: { backgroundColor: 'hsl(var(--soft-green))', color: 'hsl(var(--success))' }
      });
    },
    onError: (error) => {
      toast.error("Erro ao salvar exceção de recorrência", { description: error.message });
      console.error("Supabase error saving recurring exception:", error);
    },
  });

  // RPC para "A partir desta parcela" (Atualizar Registro Mestre Recorrente a partir de um mês específico)
  const updateRecurringMasterFutureMutation = useMutation({
    mutationFn: async ({ recurring_id, start_date, payload }: { recurring_id: string; start_date: Date; payload: TablesUpdate<'recurring_entries'> }) => {
      if (!user?.id) throw new Error("User not authenticated.");
      const { data, error } = await supabase.rpc('rpc_update_recurring_master_future', {
        p_recurring_id: recurring_id,
        p_start_date: format(start_date, "yyyy-MM-dd"),
        p_payload: payload,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      invalidateQueries();
      toast.success("Recorrência atualizada a partir deste mês!", {
        style: { backgroundColor: 'hsl(var(--soft-green))', color: 'hsl(var(--success))' }
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
        style: { backgroundColor: 'hsl(var(--soft-green))', color: 'hsl(var(--success))' }
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
        style: { backgroundColor: 'hsl(var(--soft-green))', color: 'hsl(var(--success))' }
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
        style: { backgroundColor: 'hsl(var(--soft-green))', color: 'hsl(var(--success))' }
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

      const endDate = format(endOfMonth(new Date(end_year, end_month - 1)), "yyyy-MM-dd");

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
        style: { backgroundColor: 'hsl(var(--soft-green))', color: 'hsl(var(--success))' }
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

      const payload: TablesUpdate<'recurring_entry_exceptions'> = {
        recurring_id,
        year,
        month,
        paid: is_paid,
        canceled: false, // Ensure it's not marked as canceled if we are marking it paid
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
        style: { backgroundColor: 'hsl(var(--soft-green))', color: 'hsl(var(--success))' }
      });
    },
    onError: (error) => {
      toast.error("Erro ao atualizar status de pagamento", { description: error.message });
      console.error("Supabase error updating paid status:", error);
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