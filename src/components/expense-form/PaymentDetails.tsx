import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AddCardDialog } from "@/components/AddCardDialog";
import { ManageCardsDialog } from "@/components/ManageCardsDialog"; // Corrigido para importação nomeada
import { cn, getBorderClass } from "@/lib/utils"; // Importar getBorderClass
import { User } from "@supabase/supabase-js";
import { Tables } from "@/integrations/supabase/types";
import CurrencyBR from "@/components/ui/currency-br";
import { TransactionStatusToggle } from "./TransactionStatusToggle";

interface Cartao {
  id: string;
  nome: string;
  banco: string;
  ultimos_digitos: string;
  dia_fechamento: number;
  dia_vencimento: number;
}

interface PaymentDetailsProps {
  valor: number | undefined; // Alterado para number | undefined
  setValor: (value: number | undefined) => void; // Alterado para number | undefined
  formaPagamento: "dinheiro" | "pix" | "cartao";
  setFormaPagamento: (value: "dinheiro" | "pix" | "cartao") => void;
  cartaoId: string;
  setCartaoId: (value: string) => void;
  cartoes: Cartao[];
  loadCartoes: () => void;
  user: User | null;
  validationErrors: Record<string, boolean>;
  setValidationErrors: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  isMobile: boolean;
  UNSELECTED_VALUE: string;
  isPaid?: boolean;
  setIsPaid?: (paid: boolean) => void;
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
  isPaid,
  setIsPaid,
}) => {
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

  // Ref for the installments input
  const parcelasInputRef = React.useRef<HTMLInputElement>(null);

  // New Effect: Auto-focus and clear installments field when "Parcelado" is selected
  useEffect(() => {
    if (tipoPagamento === "parcelado" && !isRecurring) {
      // Clear the value to ensure "empty field" state
      setNumeroParcelas("" as any);

      // Small timeout to allow render cycle to complete and input to appear
      setTimeout(() => {
        if (parcelasInputRef.current) {
          parcelasInputRef.current.focus();
        }
      }, 0);
    }
  }, [tipoPagamento, isRecurring, setNumeroParcelas]);

    // Effect to auto-select the principal card or first card
  useEffect(() => {
    if (formaPagamento === "cartao" && cartoes.length > 0 && cartaoId === UNSELECTED_VALUE) {
      const principalCard = cartoes.find(c => (c as any).is_principal);
      setCartaoId(principalCard ? principalCard.id : cartoes[0].id);
    } else if ((formaPagamento === "cartao" && cartoes.length === 0) || (formaPagamento !== "cartao" && cartaoId !== UNSELECTED_VALUE)) {
      setCartaoId(UNSELECTED_VALUE);
    }
  }, [formaPagamento, cartoes, setCartaoId, UNSELECTED_VALUE, cartaoId]);

  return (
    <div className="space-y-4"> {/* Usar space-y-4 para espaçamento vertical entre os blocos */}
      <div className={cn("grid gap-4", isMobile ? "grid-cols-2 gap-2" : "grid-cols-2")}>
        {/* Valor */}
        <div>
          <Label htmlFor="valor" className={cn("text-[#64748B] font-[600] mb-1.5 inline-block", isMobile ? "text-[13px]" : "text-[15px]")}>Valor Total (R$)</Label>
          <CurrencyBR
            value={valor}
            onChange={(v) => {
              setValor(v);
              setValidationErrors(prev => ({ ...prev, valor: false }));
            }}
            className={cn(
              isMobile ? "!h-[39px] text-sm" : "h-10",
              "text-gray-800 font-medium transition-all duration-200 input-3d-premium",
              getBorderClass({ isInvalid: validationErrors.valor, isValid: validationErrors.valor === false })
            )}
          />
        </div>

        {/* Tipo de Pagamento (À vista / Parcelado / Fixo) */}
        <div>
          <Label className={cn("text-[#64748B] font-[600] mb-1.5 inline-block", isMobile ? "text-[13px]" : "text-[15px]")}>Tipo de Pagamento</Label>
          <Select
            value={tipoPagamento}
            onValueChange={(v: "avista" | "parcelado" | "fixo") => {
              setTipoPagamento(v);
              // REMOVIDO: A lógica de setIsRecurring foi movida para o ExpenseForm.tsx
            }}
          >
            <SelectTrigger className={cn(
              "rounded-xl text-gray-800 font-medium transition-all duration-200 input-3d-premium",
              isMobile ? "!h-[39px] text-sm" : "h-10",
              getBorderClass({})
            )}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="avista" className={cn(isMobile && "text-sm")}>
                <span className="flex items-center gap-2"><span className="emoji">⚡</span> À Vista</span>
              </SelectItem>
              <SelectItem value="parcelado" className={cn(isMobile && "text-sm")}>
                <span className="flex items-center gap-2"><span className="emoji">➗</span> Parcelado</span>
              </SelectItem>
              <SelectItem value="fixo" className={cn(isMobile && "text-sm")}>
                <span className="flex items-center gap-2"><span className="emoji">🔁</span> Fixo</span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Forma de Pagamento e Número de Parcelas (condicional) */}
      <div 
        className={cn(
          "grid gap-4 items-start", 
          tipoPagamento === "parcelado" && !isRecurring ? (isMobile ? "grid-cols-2 gap-2" : "grid-cols-2") : 
          (isMobile && tipoPagamento === "avista" && !isRecurring ? "grid-cols-2 gap-2" : "grid-cols-1")
        )}
      >
        {/* Forma de Pagamento */}
        <div>
          <Label className={cn("text-[#64748B] font-[600] mb-1.5 inline-block", isMobile ? "text-[13px]" : "text-[15px]")}>Forma de Pagamento</Label>
          <Select
            value={formaPagamento}
            onValueChange={(value: "dinheiro" | "pix" | "cartao") => { // Tipo explícito para 'value'
              setFormaPagamento(value);
              if (value !== "cartao") { // Se a forma de pagamento não for cartão, resetar o cartão selecionado
                setCartaoId(UNSELECTED_VALUE);
              }
            }}
          >
            <SelectTrigger className={cn(
              "rounded-xl text-gray-800 font-medium transition-all duration-200 input-3d-premium",
              isMobile ? "!h-[39px] text-sm" : "h-10",
              getBorderClass({})
            )}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="cartao" className={cn(isMobile && "text-sm")}>
                <span className="flex items-center gap-2"><span className="emoji">💳</span> Cartão</span>
              </SelectItem>
              <SelectItem value="pix" className={cn(isMobile && "text-sm")}>
                <span className="flex items-center gap-2"><span className="emoji">🪙</span> Pix</span>
              </SelectItem>
              <SelectItem value="dinheiro" className={cn(isMobile && "text-sm")}>
                <span className="flex items-center gap-2"><span className="emoji">💰</span> Dinheiro</span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Número de Parcelas (aparece apenas se tipoPagamento for "parcelado" E NÃO for recorrente) */}
        {tipoPagamento === "parcelado" && !isRecurring && ( // Condição atualizada
          <div>
            <Label htmlFor="numeroParcelas" className={cn("text-[#64748B] font-[600] mb-1.5 inline-block", isMobile ? "text-[13px]" : "text-[15px]")}>
              Número de Parcelas
            </Label>
            <Input
              ref={parcelasInputRef}
              id="numeroParcelas"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={numeroParcelas}
              onChange={handleNumeroParcelasChange}
              placeholder=""
              className={cn(
                "rounded-xl text-gray-800 font-medium transition-all duration-200 input-3d-premium",
                isMobile ? "!h-[39px] text-sm" : "h-10",
                getBorderClass({ isInvalid: validationErrors.numeroParcelas, isValid: validationErrors.numeroParcelas === false })
              )}
            />
          </div>
        )}

        {/* Status Toggle na mesma linha apenas no mobile e se à vista */}
        {isMobile && tipoPagamento === "avista" && !isRecurring && isPaid !== undefined && setIsPaid && (
          <div className="w-full">
            <TransactionStatusToggle isPaid={isPaid} setIsPaid={setIsPaid} isMobile={isMobile} />
          </div>
        )}
      </div>

      {formaPagamento === "cartao" && (
        <div className="col-span-full">
          <Label className={cn("text-[#64748B] font-[600] mb-1.5 inline-block", isMobile ? "text-[13px]" : "text-[15px]")}>Cartão de Crédito</Label>
          <div className="flex gap-2">
            <Select
              value={cartaoId}
              onValueChange={(value: string) => { // Apenas atualiza o cartaoId
                setCartaoId(value);
                setValidationErrors(prev => ({ ...prev, cartaoId: false }));
              }}
            >
              <SelectTrigger className={cn(
                "rounded-xl text-gray-800 font-medium transition-all duration-200 input-3d-premium",
                isMobile ? "!h-[39px] text-sm" : "h-10",
                getBorderClass({ isInvalid: validationErrors.cartaoId, isValid: validationErrors.cartaoId === false })
              )}>
                <SelectValue placeholder="Selecione o cartão" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl border-none shadow-xl">
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
