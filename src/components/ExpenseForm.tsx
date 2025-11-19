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
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { CurrencyInput } from "@/components/ui/currency-input"; // Importar CurrencyInput

// Importar os novos componentes modulares
import { CategorySelector } from "./expense-form/CategorySelector";
import { PaymentDetails } from "./expense-form/PaymentDetails";
import { DateAndInstallmentFields } from "./expense-form/DateAndInstallmentFields";
import { TransactionStatusToggle } from "./expense-form/TransactionStatusToggle";

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
  rootExpenseCategories: AppCategory[];
  filteredSubcategories: AppCategory[];
  selectedParentCategoryId: string;
  setSelectedParentCategoryId: (id: string) => void;
  queryClient: ReturnType<typeof useQueryClient>;
  isMobile: boolean;
}

const UNSELECTED_VALUE = "unselected";

export const ExpenseForm: React.FC<ExpenseFormProps> = ({
  user,
  cartoes,
  loadCartoes,
  rootExpenseCategories,
  filteredSubcategories,
  selectedParentCategoryId,
  setSelectedParentCategoryId,
  queryClient,
  isMobile,
}) => {
  // Form states
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string>(UNSELECTED_VALUE);
  const [formaPagamento, setFormaPagamento] = useState<"dinheiro" | "pix" | "cartao" | "boleto">("dinheiro");
  const [tipoPagamento, setTipoPagamento] = useState<"avista" | "parcelado">("avista"); // Movido para cá
  const [cartaoId, setCartaoId] = useState(UNSELECTED_VALUE);
  const [valor, setValor] = useState<number | undefined>(undefined); // Alterado para number | undefined
  const [descricao, setDescricao] = useState("");
  const [dataVencimento, setDataVencimento] = useState<Date | undefined>(new Date());
  const [numeroParcelas, setNumeroParcelas] = useState("1"); // Movido para cá
  const [loading, setLoading] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isPaid, setIsPaid] = useState(false);

  // Validation errors state
  const [validationErrors, setValidationErrors] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (tipoPagamento !== "parcelado") {
      setNumeroParcelas("1"); // Reset parcelas if not 'parcelado'
    }
  }, [tipoPagamento]);

  // Efeito para definir o status de pago/pendente automaticamente
  useEffect(() => {
    if (formaPagamento === "cartao") {
      setIsPaid(false); // Cartão sempre pendente inicialmente
    } else if (["dinheiro", "pix", "boleto"].includes(formaPagamento) && tipoPagamento === "avista") {
      setIsPaid(true); // Dinheiro/Pix/Boleto à vista é pago
    } else {
      setIsPaid(false); // Outras combinações (parcelado) são pendentes
    }
  }, [formaPagamento, tipoPagamento]);

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
    
    if (valor === undefined || valor <= 0) { // Verificação para number | undefined
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
    if (tipoPagamento === "parcelado" && (parseInt(numeroParcelas) < 2 || !numeroParcelas)) {
      newErrors.numeroParcelas = true;
      hasError = true;
    }

    setValidationErrors(newErrors);

    if (hasError) {
      toast.error("Preencha todos os campos obrigatórios");
      setLoading(false);
      return;
    }

    const valorTotal = valor as number; // Usar o valor como number

    // Correção: Formatar a data usando os componentes locais para evitar problemas de fuso horário
    const formattedDate = dataVencimento 
      ? `${dataVencimento.getFullYear()}-${(dataVencimento.getMonth() + 1).toString().padStart(2, '0')}-${dataVencimento.getDate().toString().padStart(2, '0')}` 
      : "";
      
    const currentTimestamp = format(new Date(), "yyyy-MM-dd HH:mm:ss"); // Data e hora atuais

    let dbTipoPagamento = tipoPagamento;

    // Insert despesa
    const { data: despesaData, error: despesaError } = await supabase
      .from("despesas")
      .insert({
        user_id: user.id,
        categoria_id: selectedSubcategoryId,
        forma_pagamento: formaPagamento,
        tipo_pagamento: dbTipoPagamento, // Usar o valor ajustado
        cartao_id: formaPagamento === "cartao" ? cartaoId : null,
        valor_total: valorTotal,
        descricao,
        is_fixed: false, // Always false for one-off expenses
        recurrence_frequency: null,
        recurrence_installments_count: null,
      })
      .select()
      .single();

    if (despesaError) {
      toast.error("Erro ao adicionar despesa", { description: despesaError.message });
      console.error("Supabase error adding expense:", despesaError);
      setLoading(false);
      return;
    }

    // Generate parcelas
    if (tipoPagamento === "avista") { // For avista
      const { error: parcelaError } = await supabase
        .from("despesas_parcelas")
        .insert({
          despesa_id: despesaData.id,
          numero_parcela: 1,
          valor_parcela: valorTotal,
          vencimento: formattedDate,
          pago: isPaid, // Usar o estado isPaid
          data_pagamento: isPaid ? currentTimestamp : null, // Definir data_pagamento com data e hora atuais se pago
        });

      if (parcelaError) {
        toast.error("Erro ao criar parcela", { description: parcelaError.message });
        console.error("Supabase error creating installment:", parcelaError);
      }
    } else if (tipoPagamento === "parcelado") {
      const parcelas = [];
      const valorParcela = valorTotal / parseInt(numeroParcelas);
      const dataBase = new Date(dataVencimento);

      for (let i = 0; i < parseInt(numeroParcelas); i++) {
        const dataParc = new Date(dataBase);
        dataParc.setMonth(dataParc.getMonth() + i);

        parcelas.push({
          despesa_id: despesaData.id,
          numero_parcela: i + 1,
          valor_parcela: valorParcela,
          vencimento: format(dataParc, "yyyy-MM-dd"),
          pago: i === 0 ? isPaid : false, // Apenas a primeira parcela usa o estado isPaid
          data_pagamento: i === 0 && isPaid ? currentTimestamp : null, // Apenas a primeira parcela define data_pagamento com data e hora atuais se pago
        });
      }

      const { error: parcelasError } = await supabase
        .from("despesas_parcelas")
        .insert(parcelas);

      if (parcelasError) {
        toast.error("Erro ao gerar parcelas", { description: parcelasError.message });
        console.error("Supabase error generating installments:", parcelasError);
      }
    }

    toast.success("Despesa adicionada com sucesso!", {
      style: { backgroundColor: 'hsl(var(--soft-green))', color: 'hsl(var(--success))' }
    });
    
    // Reset form
    setSelectedParentCategoryId(UNSELECTED_VALUE);
    setSelectedSubcategoryId(UNSELECTED_VALUE);
    setFormaPagamento("dinheiro");
    setTipoPagamento("avista");
    setCartaoId(UNSELECTED_VALUE);
    setValor(undefined); // Reset para undefined
    setDescricao("");
    setDataVencimento(new Date());
    setNumeroParcelas("1");
    setIsPaid(false); // Resetar o estado "Pago"
    setLoading(false);
    setValidationErrors({}); // Clear all validation errors
    queryClient.invalidateQueries({ queryKey: ["expenses", user?.id] });
    queryClient.invalidateQueries({ queryKey: ["expenseInstallments", user?.id] });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <CategorySelector
        rootExpenseCategories={rootExpenseCategories}
        filteredSubcategories={filteredSubcategories}
        selectedParentCategoryId={selectedParentCategoryId}
        setSelectedParentCategoryId={setSelectedParentCategoryId}
        selectedSubcategoryId={selectedSubcategoryId}
        setSelectedSubcategoryId={setSelectedSubcategoryId}
        validationErrors={validationErrors}
        setValidationErrors={setValidationErrors}
        isMobile={isMobile}
        UNSELECTED_VALUE={UNSELECTED_VALUE}
      />

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
      />

      {/* Novos campos para Tipo de Pagamento e Número de Parcelas */}
      <div className={cn("grid gap-4", isMobile && tipoPagamento === "parcelado" ? "grid-cols-2" : "grid-cols-1")}>
        <div>
          <Label className={cn(isMobile && "text-xs")}>Tipo de Pagamento</Label>
          <Select value={tipoPagamento} onValueChange={(v: any) => setTipoPagamento(v)}>
            <SelectTrigger className={cn("rounded-xl", isMobile && "h-9 text-sm")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="avista" className={cn(isMobile && "text-sm")}>À vista</SelectItem>
              <SelectItem value="parcelado" className={cn(isMobile && "text-sm")}>Parcelado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {tipoPagamento === "parcelado" && (
          <div>
            <Label htmlFor="numeroParcelas" className={cn(isMobile && "text-xs")}>Número de Parcelas</Label>
            <Input
              id="numeroParcelas"
              type="number"
              min="2"
              max="48"
              value={numeroParcelas}
              onChange={(e) => {
                setNumeroParcelas(e.target.value);
                setValidationErrors(prev => ({ ...prev, numeroParcelas: false }));
              }}
              required
              className={cn("rounded-xl", isMobile && "h-9 text-sm", validationErrors.numeroParcelas && "border-destructive")}
            />
          </div>
        )}
      </div>

      <DateAndInstallmentFields
        tipoPagamento={tipoPagamento} // Ainda necessário para a label da data
        dataVencimento={dataVencimento}
        setDataVencimento={setDataVencimento}
        isCalendarOpen={isCalendarOpen}
        setIsCalendarOpen={setIsCalendarOpen}
        validationErrors={validationErrors}
        setValidationErrors={setValidationErrors}
        isMobile={isMobile}
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

      <TransactionStatusToggle
        isPaid={isPaid}
        setIsPaid={setIsPaid}
        isMobile={isMobile}
      />

      {tipoPagamento === "parcelado" && valor !== undefined && numeroParcelas && (
        <div className={cn("p-4 bg-secondary/20 rounded-xl", isMobile && "p-3")}>
          <p className={cn("font-medium mb-2", isMobile && "text-sm")}>Pré-visualização das Parcelas:</p>
          <p className={cn("text-sm text-muted-foreground", isMobile && "text-xs")}>
            {numeroParcelas}x de R$ {(valor / parseInt(numeroParcelas)).toFixed(2)}
          </p>
        </div>
      )}

      <Button type="submit" className={cn("w-full rounded-xl", isMobile && "h-9 text-sm")} disabled={loading}>
        {loading ? "Salvando..." : "Salvar Despesa"}
      </Button>
    </form>
  );
};