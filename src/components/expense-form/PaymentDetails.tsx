import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AddCardDialog } from "@/components/AddCardDialog";
import ManageCardsDialog from "@/components/ManageCardsDialog";
import { cn } from "@/lib/utils";
import { User } from "@supabase/supabase-js";
import { Tables } from "@/integrations/supabase/types";
import { CurrencyInput } from "@/components/ui/currency-input"; // Importar CurrencyInput

interface PaymentDetailsProps {
  valor: number | undefined; // Alterado para number | undefined
  setValor: (value: number | undefined) => void; // Alterado para number | undefined
  formaPagamento: "dinheiro" | "pix" | "cartao" | "boleto";
  setFormaPagamento: (value: "dinheiro" | "pix" | "cartao" | "boleto") => void;
  cartaoId: string;
  setCartaoId: (value: string) => void;
  cartoes: Tables<'cartoes'>[];
  loadCartoes: () => void;
  user: User | null;
  validationErrors: Record<string, boolean>;
  setValidationErrors: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  isMobile: boolean;
  UNSELECTED_VALUE: string;
  // PROPS PARA TIPO DE PAGAMENTO
  tipoPagamento: "avista" | "parcelado" | "fixo"; // Tipo atualizado
  setTipoPagamento: (value: "avista" | "parcelado" | "fixo") => void; // Tipo atualizado
  // NOVAS PROPS PARA NÚMERO DE PARCELAS
  numeroParcelas: number;
  setNumeroParcelas: (value: number) => void;
  isRecurring: boolean; // NOVA PROP
  setIsRecurring: (value: boolean) => void; // NOVA PROP
}

export const PaymentDetails: React.FC<PaymentDetailsProps> = ({
  valor,
  setValor,
  formaPagamento,
  setFormaPagamento,
  cartaoId,
  setCartaoId,
  cartoes,
  loadCartoes,
  user,
  validationErrors,
  setValidationErrors,
  isMobile,
  UNSELECTED_VALUE,
  tipoPagamento,
  setTipoPagamento,
  numeroParcelas, // NOVA PROP
  setNumeroParcelas, // NOVA PROP
  isRecurring, // NOVA PROP
  setIsRecurring, // NOVA PROP
}) => {
  // Removido: const [showCustomInstallmentInput, setShowCustomInstallmentInput] = useState(false);
  // Removido: const [customNumeroParcelas, setCustomNumeroParcelas] = useState<string>(numeroParcelas > 5 ? String(numeroParcelas) : "");

  // Removido: Effect to reset custom input visibility
  // useEffect(() => {
  //   if (tipoPagamento !== "parcelado" || isRecurring) {
  //     setShowCustomInstallmentInput(false);
  //     setCustomNumeroParcelas("");
  //   } else if (numeroParcelas > 5) {
  //     setShowCustomInstallmentInput(true);
  //     setCustomNumeroParcelas(String(numeroParcelas));
  //   } else {
  //     setShowCustomInstallmentInput(false);
  //     setCustomNumeroParcelas("");
  //   }
  // }, [numeroParcelas, tipoPagamento, isRecurring]);


  const handleNumeroParcelasChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;

    // Permitir que o campo fique vazio temporariamente (necessário para mobile)
    if (value === "") {
      setNumeroParcelas(value as any);
      return;
    }

    const numValue = Number(value);

    // Só aceitar números positivos
    if (!isNaN(numValue) && numValue >= 1) {
      setNumeroParcelas(numValue);
    }

    setValidationErrors(prev => ({ ...prev, numeroParcelas: false }));
  };

  // Removido: handleCustomNumeroParcelasChange
  // Removido: const handleCustomNumeroParcelasChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  // Removido:   const value = e.target.value;
  // Removido:   setCustomNumeroParcelas(value);
  // Removido:   const numValue = parseInt(value);
  // Removido:   setNumeroParcelas(isNaN(numValue) ? 1 : numValue);
  // Removido:   setValidationErrors(prev => ({ ...prev, numeroParcelas: false }));
  // Removido: };

  // Removido: selectValue
  // Removido: const selectValue = showCustomInstallmentInput
  // Removido:   ? "custom"
  // Removido:   : (numeroParcelas >= 1 && numeroParcelas <= 5 ? String(numeroParcelas) : "custom");

  return (
    <div className="space-y-4"> {/* Usar space-y-4 para espaçamento vertical entre os blocos */}
      <div className={cn("grid gap-4", isMobile ? "grid-cols-2 gap-2" : "grid-cols-2")}>
        {/* Valor */}
        <div>
          <Label htmlFor="valor" className={cn(isMobile && "text-xs")}>Valor (R$)</Label>
          <CurrencyInput
            id="valor"
            value={valor}
            decimalsLimit={2}
            decimalSeparator=","
            groupSeparator="."
            allowNegativeValue={false}
            onValueChange={(value, name, values) => {
              setValor(values.floatValue ?? 0); 
              setValidationErrors(prev => ({ ...prev, valor: false }));
            }}
            placeholder="0,00"
            required
            className={cn("rounded-xl", isMobile && "h-9 text-sm", validationErrors.valor && "border-destructive")}
          />
        </div>

        {/* Tipo de Pagamento (À vista / Parcelado / Fixo) */}
        <div>
          <Label className={cn(isMobile && "text-xs")}>Tipo de Pagamento</Label>
          <Select 
            value={tipoPagamento} 
            onValueChange={(v: "avista" | "parcelado" | "fixo") => {
              setTipoPagamento(v);
              // REMOVIDO: A lógica de setIsRecurring foi movida para o ExpenseForm.tsx
            }}
          >
            <SelectTrigger className={cn("rounded-xl", isMobile && "h-9 text-sm")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="avista" className={cn(isMobile && "text-sm")}>À Vista</SelectItem>
              <SelectItem value="parcelado" className={cn(isMobile && "text-sm")}>Parcelado</SelectItem>
              <SelectItem value="fixo" className={cn(isMobile && "text-sm")}>Fixo</SelectItem> {/* NOVA OPÇÃO */}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Forma de Pagamento e Número de Parcelas (condicional) */}
      <div className={cn("grid gap-4", tipoPagamento === "parcelado" && !isRecurring ? (isMobile ? "grid-cols-2 gap-2" : "grid-cols-2") : "grid-cols-1")}>
        {/* Forma de Pagamento */}
        <div>
          <Label className={cn(isMobile && "text-xs")}>Forma de Pagamento</Label>
          <Select value={formaPagamento} onValueChange={(v: any) => setCartaoId(UNSELECTED_VALUE) || setFormaPagamento(v)}>
            <SelectTrigger className={cn("rounded-xl", isMobile && "h-9 text-sm")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="dinheiro" className={cn(isMobile && "text-sm")}>Dinheiro</SelectItem>
              <SelectItem value="pix" className={cn(isMobile && "text-sm")}>Pix</SelectItem>
              <SelectItem value="cartao" className={cn(isMobile && "text-sm")}>Cartão</SelectItem>
              <SelectItem value="boleto" className={cn(isMobile && "text-sm")}>Boleto</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Número de Parcelas (aparece apenas se tipoPagamento for "parcelado" E NÃO for recorrente) */}
        {tipoPagamento === "parcelado" && !isRecurring && ( // Condição atualizada
          <div>
            <Label htmlFor="numeroParcelas" className={cn(isMobile && "text-xs")}>
              Número de Parcelas
            </Label>
            <Input
              id="numeroParcelas"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={numeroParcelas}
              onChange={handleNumeroParcelasChange}
              placeholder="Número de parcelas"
              className={cn("rounded-xl", isMobile && "h-9 text-sm", validationErrors.numeroParcelas && "border-destructive")}
            />
          </div>
        )}
      </div>

      {formaPagamento === "cartao" && (
        <div className="col-span-full">
          <Label className={cn(isMobile && "text-xs")}>Cartão de Crédito</Label>
          <div className="flex gap-2">
            <Select value={cartaoId} onValueChange={(v: any) => {
              setCartaoId(v);
              setValidationErrors(prev => ({ ...prev, cartaoId: false }));
            }}>
              <SelectTrigger className={cn("rounded-xl", isMobile && "h-9 text-sm", validationErrors.cartaoId && "border-destructive")}>
                <SelectValue placeholder="Selecione o cartão" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNSELECTED_VALUE} disabled className={cn(isMobile && "text-sm")}>Selecione o cartão</SelectItem>
                {cartoes
                  .map((cartao) => (
                    <SelectItem key={cartao.id} value={cartao.id} className={cn(isMobile && "text-sm")}>
                      {cartao.nome} - {cartao.banco}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <AddCardDialog user={user} onCardAdded={loadCartoes} />
            <ManageCardsDialog 
              cards={cartoes} 
              onCardUpdated={loadCartoes} 
              onCardDeleted={loadCartoes} 
            />
          </div>
        </div>
      )}
    </div>
  );
};