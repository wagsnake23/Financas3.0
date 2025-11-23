import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";
import DynamicIcon from "@/components/DynamicIcon";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { User } from "@supabase/supabase-js";
import { AppCategory } from "@/types/finance";
import { format, addMonths, getDate } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { cn, getBorderClass } from "@/lib/utils"; // Importar getBorderClass
import CurrencyBR from "@/components/ui/currency-br"; // Importar CurrencyBR

import { PaymentDetails } from "./expense-form/PaymentDetails";
import { DateAndInstallmentFields } from "./expense-form/DateAndInstallmentFields";
import { TransactionStatusToggle } from "./expense-form/TransactionStatusToggle";
import { InstallmentPreview } from "./expense-form/InstallmentPreview";
import { TransactionTypeToggle } from "./expense-form/TransactionTypeToggle"; // Importar o novo componente

interface Cartao {
  id: string;
  nome: string;
  banco: string;
  ultimos_digitos: string;
  dia_fechamento: number;
  dia_vencimento: number;
}

interface ExpenseFormProps {
  user: User | null;
  cartoes: Cartao[];
  loadCartoes: () => void;
  allSubcategories: AppCategory[];
  queryClient: ReturnType<typeof useQueryClient>;
  isMobile: boolean;
  isRecurring: boolean;
  setIsRecurring: (value: boolean) => void; // NOVA PROP
}

const UNSELECTED_VALUE = "unselected";
const RECURRING_INSTALLMENTS_COUNT = 120;
const toastDuration = 1000; // 1 segundo para todos os dispositivos
const toastSuccessStyle = { backgroundColor: '#F3FFF3', color: '#006000' };
const toastErrorStyle = { backgroundColor: '#F3FFF3', color: '#FF2929' };

export const ExpenseForm: React.FC<ExpenseFormProps> = ({
  user,
  cartoes,
  loadCartoes,
  allSubcategories,
  queryClient,
  isMobile,
  isRecurring,
  setIsRecurring, // NOVA PROP
}) => {
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string>(UNSELECTED_VALUE);
  const [formaPagamento, setFormaPagamento] = useState<"dinheiro" | "pix" | "cartao" | "boleto">("dinheiro");
  const [tipoPagamento, setTipoPagamento] = useState<"avista" | "parcelado" | "fixo">("avista");
  const [cartaoId, setCartaoId] = useState(UNSELECTED_VALUE);
  const [valor, setValor] = useState<number | undefined>(undefined);
  const [descricao, setDescricao] = useState("");
  const [dataVencimento, setDataVencimento] = useState<Date | undefined>(new Date());
  const [numeroParcelas, setNumeroParcelas] = useState(1);
  const [loading, setLoading] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isPaid, setIsPaid] = useState(false);

  const [validationErrors, setValidationErrors] = useState<Record<string, boolean>>({});

  const expenseSubcategories = React.useMemo(() => {
    return allSubcategories.filter(cat => cat.parent_id !== 'receitas_e_investimentos');
  }, [allSubcategories]);

  useEffect(() => {
    if (isRecurring) {
      setIsPaid(false);
    } else if (tipoPagamento === "parcelado") {
      setIsPaid(false);
    } else if (formaPagamento === "cartao") {
      setIsPaid(false);
    } else {
      setIsPaid(true);
    }
  }, [formaPagamento, tipoPagamento, isRecurring]);

  // NOVO useEffect isolado para sincronizar isRecurring com tipoPagamento
  useEffect(() => {
    if (typeof setIsRecurring === 'function') {
      if (tipoPagamento === "fixo") {
        setIsRecurring(true);
      } else {
        setIsRecurring(false);
      }
    } else {
      console.error("ExpenseForm: setIsRecurring não é uma função no novo useEffect de tipoPagamento.", setIsRecurring);
    }
  }, [tipoPagamento, setIsRecurring]);

  // Effect for handling recurrence logic and setting numeroParcelas
  useEffect(() => {
    if (isRecurring) { // If "Recorrente" is selected (tipoPagamento === "fixo")
      setNumeroParcelas(RECURRING_INSTALLMENTS_COUNT);
      setIsPaid(false); // Recurring expenses are initially pending
    } else { // If "Avulsa" is selected (tipoPagamento === "avista" or "parcelado")
      if (tipoPagamento === "avista") {
        setNumeroParcelas(1); // Avista always has 1 installment
        setIsPaid(true); // Avista is usually paid immediately
      } else if (tipoPagamento === "parcelado") {
        // When switching to "parcelado" from "fixo", reset to 1.
        // Otherwise, if it was "avista" (numeroParcelas was 1) or user input, keep it.
        if (numeroParcelas === RECURRING_INSTALLMENTS_COUNT) {
          setNumeroParcelas(1);
        }
        setIsPaid(false); // Parcelado is initially pending
      }
    }
  }, [isRecurring, tipoPagamento, setNumeroParcelas, setIsPaid, numeroParcelas]); // Removido numeroParcelas das dependências para evitar loop

  // Effect for handling tipoPagamento changes (and its impact on formaPagamento and numeroParcelas)
  useEffect(() => {
    // A lógica para definir setIsRecurring com base em tipoPagamento está agora em seu useEffect dedicado.
    // Este useEffect deve apenas lidar com efeitos colaterais de tipoPagamento em outros campos,
    // mas apenas se isRecurring NÃO estiver controlando tipoPagamento (o que não deve mais acontecer).
    if (isRecurring) return; // Se for recorrente, este efeito não deve sobrescrever

    if (tipoPagamento === "parcelado") {
      setFormaPagamento("cartao");
      // setNumeroParcelas(1); // Removido para permitir que o usuário defina o número de parcelas
    } else if (tipoPagamento === "avista") {
      // setNumeroParcelas(1); // Removido para permitir que o usuário defina o número de parcelas
    }
    // Não há necessidade de um caso 'fixo' aqui, pois ele é tratado pelo efeito isRecurring
  }, [tipoPagamento, isRecurring, setFormaPagamento]); // Removido setNumeroParcelas das dependências

  // Funções para sincronização inversa (botão -> tipoPagamento)
  const handleSelectAvulsa = () => {
    setIsRecurring(false);
    setTipoPagamento("avista");
  };

  const handleSelectRecorrente = () => {
    setIsRecurring(true);
    setTipoPagamento("fixo");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const newErrors: Record<string, boolean> = {};
    let hasError = false;

    if (!user) {
      toast.error("Usuário não autenticado.", { duration: toastDuration, style: toastErrorStyle });
      setLoading(false);
      return;
    }
    
    if (valor === undefined || valor <= 0) {
      newErrors.valor = true;
      hasError = true;
    }
    if (!dataVencimento) {
      newErrors.dataVencimento = true;
      hasError = true;
    }
    if (selectedSubcategoryId === UNSELECTED_VALUE) {
      newErrors.selectedSubcategoryId = true;
      hasError = true;
    }
    if (formaPagamento === "cartao" && cartaoId === UNSELECTED_VALUE) {
      newErrors.cartaoId = true;
      hasError = true;
    }
    if (!isRecurring && tipoPagamento === "parcelado" && (numeroParcelas <= 0 || !Number.isInteger(numeroParcelas))) { // Alterado para numeroParcelas <= 0
      newErrors.numeroParcelas = true;
      hasError = true;
    }

    setValidationErrors(newErrors);

    if (hasError) {
      toast.error("Preencha todos os campos obrigatórios", { duration: toastDuration, style: toastErrorStyle });
      setLoading(false);
      return;
    }

    const valorTotal = valor as number;
    const currentTimestamp = format(new Date(), "yyyy-MM-dd HH:mm:ss");
    const recurrenceDay = getDate(dataVencimento as Date);

    try {
      const { data: despesaData, error: despesaError } = await supabase
        .from("despesas")
        .insert({
          user_id: user.id,
          categoria_id: selectedSubcategoryId === UNSELECTED_VALUE ? null : selectedSubcategoryId,
          forma_pagamento: formaPagamento,
          tipo_pagamento: isRecurring ? "fixo" : tipoPagamento,
          cartao_id: formaPagamento === "cartao" ? cartaoId : null,
          // Para despesas recorrentes, o valor_total e numero_parcelas serão atualizados pela RPC
          valor_total: isRecurring ? 0 : valorTotal, // Inicializa com 0, RPC irá somar
          numero_parcelas: isRecurring ? 0 : numeroParcelas, // Inicializa com 0, RPC irá contar
          descricao,
          is_recurring_master: isRecurring,
        })
        .select()
        .single();

      if (despesaError) throw despesaError;

      const valorParcela = isRecurring ? valorTotal : (tipoPagamento === "parcelado" ? valorTotal / numeroParcelas : valorTotal);

      const formattedFirstInstallmentDate = format(dataVencimento as Date, 'yyyy-MM-dd');

      if (isRecurring) {
        // A RPC agora gera TODAS as parcelas, incluindo a primeira
        const { error: rpcError } = await supabase.rpc('generate_recurring_entries', {
          p_user_id: user.id,
          p_transaction_type: 'expense',
          p_master_id: despesaData.id,
          p_first_occurrence_date: formattedFirstInstallmentDate,
          p_monthly_amount: valorParcela,
          p_category_id: selectedSubcategoryId === UNSELECTED_VALUE ? null : selectedSubcategoryId,
          p_description: descricao,
          p_status: 'Pendente', // Default status for expenses, as it's a required enum
          p_recurrence_day: recurrenceDay,
          p_total_installments: RECURRING_INSTALLMENTS_COUNT, // Gerar todas as 120 parcelas
          p_forma_pagamento: formaPagamento,
          p_cartao_id: formaPagamento === "cartao" ? cartaoId : null,
          p_tipo_pagamento: tipoPagamento,
        });

        if (rpcError) throw rpcError;

      } else {
        // Lógica para despesas avulsas e parceladas (não recorrentes) permanece a mesma
        const installmentsToInsert = [];
        installmentsToInsert.push({
          despesa_id: despesaData.id,
          numero_parcela: 1,
          valor_parcela: valorParcela,
          vencimento: formattedFirstInstallmentDate,
          pago: tipoPagamento === "avista" ? isPaid : false,
          data_pagamento: tipoPagamento === "avista" && isPaid ? currentTimestamp : null,
        });

        for (let i = 1; i < numeroParcelas; i++) {
          const installmentDate = addMonths(dataVencimento as Date, i);
          const formattedInstallmentDate = format(installmentDate, 'yyyy-MM-dd');
          
          installmentsToInsert.push({
            despesa_id: despesaData.id,
            numero_parcela: i + 1,
            valor_parcela: valorParcela,
            vencimento: formattedInstallmentDate,
            pago: false,
            data_pagamento: null,
          });
        }
        const { error: parcelaError } = await supabase
          .from("despesas_parcelas")
          .insert(installmentsToInsert);

        if (parcelaError) throw parcelaError;
      }

      toast.success("Despesa adicionada com sucesso!", {
        style: toastSuccessStyle,
        duration: toastDuration
      });
      
      setSelectedSubcategoryId(UNSELECTED_VALUE);
      setFormaPagamento("dinheiro");
      setTipoPagamento("avista");
      setCartaoId(UNSELECTED_VALUE);
      setValor(undefined);
      setDescricao("");
      setDataVencimento(new Date());
      setNumeroParcelas(1);
      setIsPaid(false);
      setValidationErrors({});
      queryClient.invalidateQueries({ queryKey: ["expenses", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["expenseInstallments", user?.id] });

    } catch (error: any) {
      toast.error("Erro ao adicionar despesa", { description: error.message, duration: toastDuration, style: toastErrorStyle });
      console.error("Supabase error adding expense:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={cn("space-y-4", isMobile && "px-4")}>
      {/* Toggle Avulsa / Recorrente */}
      <div className={cn(isMobile && "mt-0")}> {/* Adicionado mt-0 para mobile */}
        <TransactionTypeToggle
          isRecurring={isRecurring}
          onSelectAvulsa={handleSelectAvulsa}
          onSelectRecorrente={handleSelectRecorrente}
          isMobile={isMobile}
        />
      </div>

      <div>
        <Label htmlFor="subcategoria" className={cn(isMobile && "text-xs")}>Subcategoria</Label>
        <Select 
          value={selectedSubcategoryId} 
          onValueChange={(value) => {
            setSelectedSubcategoryId(value);
            setValidationErrors(prev => ({ ...prev, selectedSubcategoryId: false }));
          }}
        >
          <SelectTrigger className={cn("rounded-xl", isMobile && "h-9 text-sm", getBorderClass({ isInvalid: validationErrors.selectedSubcategoryId, isValid: validationErrors.selectedSubcategoryId === false }))}>
            <SelectValue placeholder="Selecione a subcategoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={UNSELECTED_VALUE} disabled className={cn(isMobile && "text-sm")}>Selecione a subcategoria</SelectItem>
            {expenseSubcategories.length === 0 ? (
              <SelectItem value={UNSELECTED_VALUE} disabled className={cn(isMobile && "text-sm")}>Nenhuma subcategoria disponível</SelectItem>
            ) : (
              expenseSubcategories
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

      <PaymentDetails
        valor={valor}
        setValor={setValor}
        formaPagamento={formaPagamento}
        setFormaPagamento={setFormaPagamento}
        cartaoId={cartaoId}
        setCartaoId={setCartaoId}
        cartoes={cartoes}
        loadCartoes={loadCartoes}
        user={user}
        validationErrors={validationErrors}
        setValidationErrors={setValidationErrors}
        isMobile={isMobile}
        UNSELECTED_VALUE={UNSELECTED_VALUE}
        tipoPagamento={tipoPagamento}
        setTipoPagamento={setTipoPagamento}
        numeroParcelas={numeroParcelas}
        setNumeroParcelas={setNumeroParcelas}
        isRecurring={isRecurring}
        setIsRecurring={setIsRecurring} // NOVA PROP
      />

      {tipoPagamento === "parcelado" && numeroParcelas > 1 && !isRecurring && (
        <InstallmentPreview
          valor={valor}
          numeroParcelas={numeroParcelas}
          dataVencimento={dataVencimento}
          isMobile={isMobile}
        />
      )}

      <DateAndInstallmentFields
        dataVencimento={dataVencimento}
        setDataVencimento={setDataVencimento}
        isCalendarOpen={isCalendarOpen}
        setIsCalendarOpen={setIsCalendarOpen}
        validationErrors={validationErrors}
        setValidationErrors={setValidationErrors}
        isMobile={isMobile}
        tipoPagamento={tipoPagamento}
      />

      <div>
        <Label htmlFor="descricao" className={cn(isMobile && "text-xs")}>Descrição</Label>
        <Textarea
          id="descricao"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="Detalhes sobre a despesa..."
          rows={isMobile ? 2 : 3} // Ajuste condicional do número de linhas
          className={cn("rounded-xl", isMobile && "text-sm")}
        />
      </div>

      {!isRecurring && tipoPagamento === "avista" && (
        <div className={cn(isMobile && "mt-2")}> {/* Adicionado mt-2 para mobile */}
          <TransactionStatusToggle
            isPaid={isPaid}
            setIsPaid={setIsPaid}
            isMobile={isMobile}
          />
        </div>
      )}

      <Button type="submit" className={cn("w-full rounded-xl", isMobile && "h-9 text-sm")} disabled={loading}>
        {loading ? "Salvando..." : "Salvar Despesa"}
      </Button>
    </form>
  );
};