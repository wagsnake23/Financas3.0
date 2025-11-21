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
import { format, addMonths, getDate } from "date-fns"; // Importar getDate
import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { CurrencyInput } from "@/components/ui/currency-input";

// Importar os novos componentes modulares
import { PaymentDetails } from "./expense-form/PaymentDetails";
import { DateAndInstallmentFields } from "./expense-form/DateAndInstallmentFields";
import { TransactionStatusToggle } from "./expense-form/TransactionStatusToggle";
import { InstallmentPreview } from "./expense-form/InstallmentPreview"; // NOVO: Importar InstallmentPreview

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
  isRecurring: boolean; // NOVA PROP
}

const UNSELECTED_VALUE = "unselected";
const RECURRING_INSTALLMENTS_COUNT = 120; // 120 meses

export const ExpenseForm: React.FC<ExpenseFormProps> = ({
  user,
  cartoes,
  loadCartoes,
  allSubcategories,
  queryClient,
  isMobile,
  isRecurring, // NOVA PROP
}) => {
  // Form states
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string>(UNSELECTED_VALUE);
  const [formaPagamento, setFormaPagamento] = useState<"dinheiro" | "pix" | "cartao" | "boleto">("dinheiro");
  const [tipoPagamento, setTipoPagamento] = useState<"avista" | "parcelado">("avista"); // Novo estado
  const [cartaoId, setCartaoId] = useState(UNSELECTED_VALUE);
  const [valor, setValor] = useState<number | undefined>(undefined);
  const [descricao, setDescricao] = useState("");
  const [dataVencimento, setDataVencimento] = useState<Date | undefined>(new Date());
  const [numeroParcelas, setNumeroParcelas] = useState(1); // Novo estado
  const [loading, setLoading] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isPaid, setIsPaid] = useState(false);

  // Validation errors state
  const [validationErrors, setValidationErrors] = useState<Record<string, boolean>>({});

  // Filtrar as subcategorias para exibir apenas as de despesa
  const expenseSubcategories = React.useMemo(() => {
    return allSubcategories.filter(cat => cat.parent_id !== 'receitas_e_investimentos');
  }, [allSubcategories]); // Depende de allSubcategories

  // Efeito para definir o status de pago/pendente automaticamente
  useEffect(() => {
    if (tipoPagamento === "parcelado") {
      setIsPaid(false); // Parcelado é sempre pendente inicialmente
    } else if (formaPagamento === "cartao") {
      setIsPaid(false); // Cartão à vista também é pendente
    } else {
      setIsPaid(true); // Dinheiro/Pix/Boleto à vista é pago
    }
  }, [formaPagamento, tipoPagamento]);

  // NOVO EFEITO: Definir forma de pagamento como "cartao" se tipoPagamento for "parcelado"
  useEffect(() => {
    if (tipoPagamento === "parcelado") {
      setFormaPagamento("cartao");
    }
  }, [tipoPagamento]);

  // Reset numeroParcelas if tipoPagamento changes to "avista"
  useEffect(() => {
    if (tipoPagamento === "avista") {
      setNumeroParcelas(1);
    }
  }, [tipoPagamento]);

  // Efeito para ajustar tipoPagamento e numeroParcelas se for recorrente (agora usando a prop isRecurring)
  useEffect(() => {
    if (isRecurring) {
      setTipoPagamento("parcelado");
      setNumeroParcelas(RECURRING_INSTALLMENTS_COUNT);
      setIsPaid(false); // Recorrente é sempre pendente inicialmente
    } else {
      setTipoPagamento("avista"); // Volta para avista se não for recorrente
      setNumeroParcelas(1); // Volta para 1 parcela
    }
  }, [isRecurring]); // Depende da prop isRecurring

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const newErrors: Record<string, boolean> = {};
    let hasError = false;

    if (!user) {
      toast.error("Usuário não autenticado.");
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
    if (tipoPagamento === "parcelado" && (numeroParcelas <= 1 || !Number.isInteger(numeroParcelas))) {
      newErrors.numeroParcelas = true;
      hasError = true;
    }

    setValidationErrors(newErrors);

    if (hasError) {
      toast.error("Preencha todos os campos obrigatórios");
      setLoading(false);
      return;
    }

    const valorTotal = valor as number;
    const currentTimestamp = format(new Date(), "yyyy-MM-dd HH:mm:ss");
    const recurrenceDay = getDate(dataVencimento as Date); // Get day of month from selected date

    try {
      // Insert despesa principal
      const { data: despesaData, error: despesaError } = await supabase
        .from("despesas")
        .insert({
          user_id: user.id,
          categoria_id: selectedSubcategoryId === UNSELECTED_VALUE ? null : selectedSubcategoryId,
          forma_pagamento: formaPagamento,
          tipo_pagamento: tipoPagamento,
          cartao_id: formaPagamento === "cartao" ? cartaoId : null,
          valor_total: isRecurring ? valorTotal * RECURRING_INSTALLMENTS_COUNT : valorTotal, // Total value for recurring
          descricao,
          numero_parcelas: isRecurring ? RECURRING_INSTALLMENTS_COUNT : numeroParcelas, // Set 120 for recurring
          is_recurring_master: isRecurring, // Mark as recurring master
        })
        .select()
        .single();

      if (despesaError) throw despesaError;

      // Generate parcelas
      const installmentsToInsert = [];
      const valorParcela = isRecurring ? valorTotal : (tipoPagamento === "parcelado" ? valorTotal / numeroParcelas : valorTotal);

      // Always insert the first installment
      const firstInstallmentDate = dataVencimento as Date;
      const formattedFirstInstallmentDate = `${firstInstallmentDate.getFullYear()}-${(firstInstallmentDate.getMonth() + 1).toString().padStart(2, '0')}-${firstInstallmentDate.getDate().toString().padStart(2, '0')}`;

      installmentsToInsert.push({
        despesa_id: despesaData.id,
        numero_parcela: 1,
        valor_parcela: valorParcela,
        vencimento: formattedFirstInstallmentDate,
        pago: !isRecurring && tipoPagamento === "avista" ? isPaid : false, // Only avista and not recurring can be paid initially
        data_pagamento: !isRecurring && tipoPagamento === "avista" && isPaid ? currentTimestamp : null,
      });

      // If recurring, call RPC to generate remaining 119 occurrences
      if (isRecurring) {
        const { error: rpcError } = await supabase.rpc('generate_recurring_entries', {
          p_user_id: user.id,
          p_transaction_type: 'expense',
          p_master_id: despesaData.id,
          p_first_occurrence_date: formattedFirstInstallmentDate,
          p_monthly_amount: valorParcela, // Monthly amount for expense installments
          p_category_id: selectedSubcategoryId === UNSELECTED_VALUE ? null : selectedSubcategoryId,
          p_description: descricao,
          p_forma_pagamento: formaPagamento,
          p_cartao_id: formaPagamento === "cartao" ? cartaoId : null,
          p_tipo_pagamento: tipoPagamento,
          p_recurrence_day: recurrenceDay,
          p_total_installments: RECURRING_INSTALLMENTS_COUNT,
        });

        if (rpcError) throw rpcError;

      } else {
        // If not recurring, generate remaining installments if tipoPagamento is "parcelado"
        for (let i = 1; i < numeroParcelas; i++) {
          const installmentDate = addMonths(dataVencimento as Date, i);
          const formattedInstallmentDate = `${installmentDate.getFullYear()}-${(installmentDate.getMonth() + 1).toString().padStart(2, '0')}-${installmentDate.getDate().toString().padStart(2, '0')}`;
          
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
        style: { backgroundColor: 'hsl(var(--soft-green))', color: 'hsl(var(--success-darker))' }
      });
      
      // Reset form
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
      toast.error("Erro ao adicionar despesa", { description: error.message });
      console.error("Supabase error adding expense:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Campo de Subcategoria */}
      <div>
        <Label htmlFor="subcategoria" className={cn(isMobile && "text-xs")}>Subcategoria</Label>
        <Select 
          value={selectedSubcategoryId} 
          onValueChange={(value) => {
            setSelectedSubcategoryId(value);
            setValidationErrors(prev => ({ ...prev, selectedSubcategoryId: false }));
          }}
        >
          <SelectTrigger className={cn("rounded-xl", isMobile && "h-9 text-sm", validationErrors.selectedSubcategoryId && "border-destructive")}>
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
        tipoPagamento={tipoPagamento} // Passar o tipo de pagamento
        setTipoPagamento={setTipoPagamento} // Passar a função para atualizar o tipo de pagamento
        numeroParcelas={numeroParcelas} // Passar o número de parcelas
        setNumeroParcelas={setNumeroParcelas} // Passar a função para atualizar o número de parcelas
      />

      {/* NOVO: Pré-visualização das Parcelas - MOVIDO PARA CIMA */}
      {tipoPagamento === "parcelado" && numeroParcelas > 1 && (
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
        tipoPagamento={tipoPagamento} // Passar o tipo de pagamento
      />

      <div>
        <Label htmlFor="descricao" className={cn(isMobile && "text-xs")}>Descrição</Label>
        <Textarea
          id="descricao"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="Detalhes sobre a despesa..."
          rows={3}
          className={cn("rounded-xl", isMobile && "text-sm")}
        />
      </div>

      {!isRecurring && tipoPagamento === "avista" && ( // Ocultar o toggle para parcelado e recorrente, pois é sempre pendente
        <TransactionStatusToggle
          isPaid={isPaid}
          setIsPaid={setIsPaid}
          isMobile={isMobile}
        />
      )}

      <Button type="submit" className={cn("w-full rounded-xl", isMobile && "h-9 text-sm")} disabled={loading}>
        {loading ? "Salvando..." : "Salvar Despesa"}
      </Button>
    </form>
  );
};