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
import { CurrencyInput } from "@/components/ui/currency-input";

// Importar os novos componentes modulares
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
  allSubcategories: AppCategory[];
  queryClient: ReturnType<typeof useQueryClient>;
  isMobile: boolean;
}

const UNSELECTED_VALUE = "unselected";

export const ExpenseForm: React.FC<ExpenseFormProps> = ({
  user,
  cartoes,
  loadCartoes,
  allSubcategories,
  queryClient,
  isMobile,
}) => {
  // Form states
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string>(UNSELECTED_VALUE);
  const [formaPagamento, setFormaPagamento] = useState<"dinheiro" | "pix" | "cartao" | "boleto">("dinheiro");
  const [cartaoId, setCartaoId] = useState(UNSELECTED_VALUE);
  const [valor, setValor] = useState<number | undefined>(undefined);
  const [descricao, setDescricao] = useState("");
  const [dataVencimento, setDataVencimento] = useState<Date | undefined>(new Date());
  const [loading, setLoading] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isPaid, setIsPaid] = useState(false);

  // Validation errors state
  const [validationErrors, setValidationErrors] = useState<Record<string, boolean>>({});

  // Efeito para definir o status de pago/pendente automaticamente
  useEffect(() => {
    if (formaPagamento === "cartao") {
      setIsPaid(false); // Cartão sempre pendente inicialmente
    } else {
      setIsPaid(true); // Dinheiro/Pix/Boleto à vista é pago
    }
  }, [formaPagamento]);

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

    setValidationErrors(newErrors);

    if (hasError) {
      toast.error("Preencha todos os campos obrigatórios");
      setLoading(false);
      return;
    }

    const valorTotal = valor as number;

    const formattedDate = dataVencimento 
      ? `${dataVencimento.getFullYear()}-${(dataVencimento.getMonth() + 1).toString().padStart(2, '0')}-${dataVencimento.getDate().toString().padStart(2, '0')}` 
      : "";
      
    const currentTimestamp = format(new Date(), "yyyy-MM-dd HH:mm:ss");

    // Insert despesa
    const { data: despesaData, error: despesaError } = await supabase
      .from("despesas")
      .insert({
        user_id: user.id,
        categoria_id: selectedSubcategoryId === UNSELECTED_VALUE ? null : selectedSubcategoryId,
        forma_pagamento: formaPagamento,
        tipo_pagamento: "avista", // Always "avista" now
        cartao_id: formaPagamento === "cartao" ? cartaoId : null,
        valor_total: valorTotal,
        descricao,
      })
      .select()
      .single();

    if (despesaError) {
      toast.error("Erro ao adicionar despesa", { description: despesaError.message });
      console.error("Supabase error adding expense:", despesaError);
      setLoading(false);
      return;
    }

    // Generate single parcela for "avista"
    const { error: parcelaError } = await supabase
      .from("despesas_parcelas")
      .insert({
        despesa_id: despesaData.id,
        numero_parcela: 1,
        valor_parcela: valorTotal,
        vencimento: formattedDate,
        pago: isPaid,
        data_pagamento: isPaid ? currentTimestamp : null,
      });

    if (parcelaError) {
      toast.error("Erro ao criar parcela", { description: parcelaError.message });
      console.error("Supabase error creating installment:", parcelaError);
    }

    toast.success("Despesa adicionada com sucesso!", {
      style: { backgroundColor: 'hsl(var(--soft-green))', color: 'hsl(var(--success-darker))' }
    });
    
    // Reset form
    setSelectedSubcategoryId(UNSELECTED_VALUE);
    setFormaPagamento("dinheiro");
    setCartaoId(UNSELECTED_VALUE);
    setValor(undefined);
    setDescricao("");
    setDataVencimento(new Date());
    setIsPaid(false);
    setLoading(false);
    setValidationErrors({});
    queryClient.invalidateQueries({ queryKey: ["expenses", user?.id] });
    queryClient.invalidateQueries({ queryKey: ["expenseInstallments", user?.id] });
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
            {allSubcategories.length === 0 ? (
              <SelectItem value={UNSELECTED_VALUE} disabled className={cn(isMobile && "text-sm")}>Nenhuma subcategoria disponível</SelectItem>
            ) : (
              allSubcategories
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
      />

      {/* Tipo de Pagamento e Número de Parcelas removidos */}
      {/* Apenas o campo de data de vencimento permanece */}
      <DateAndInstallmentFields
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

      <Button type="submit" className={cn("w-full rounded-xl", isMobile && "h-9 text-sm")} disabled={loading}>
        {loading ? "Salvando..." : "Salvar Despesa"}
      </Button>
    </form>
  );
};