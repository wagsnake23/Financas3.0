import React from "react";
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
  tipoPagamento: "avista" | "parcelado";
  setTipoPagamento: (value: "avista" | "parcelado") => void;
  // NOVAS PROPS PARA NÚMERO DE PARCELAS
  numeroParcelas: number;
  setNumeroParcelas: (value: number) => void;
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
}) => {
  return (
    <div className="space-y-4"> {/* Usar space-y-4 para espaçamento vertical entre os blocos */}
      <div className={cn("grid gap-4", isMobile ? "grid-cols-2 gap-2" : "grid-cols-2")}>
        {/* Valor */}
        <div>
          <Label htmlFor="valor" className={cn(isMobile && "text-xs")}>Valor (R$)</Label>
          <CurrencyInput
            id="valor"
            value={valor}
            onValueChange={(values) => {
              setValor(values.floatValue);
              setValidationErrors(prev => ({ ...prev, valor: false }));
            }}
            placeholder="0,00"
            required
            className={cn("rounded-xl", isMobile && "h-9 text-sm", validationErrors.valor && "border-destructive")}
          />
        </div>

        {/* Tipo de Pagamento (À vista / Parcelado) */}
        <div>
          <Label className={cn(isMobile && "text-xs")}>Tipo de Pagamento</Label>
          <Select value={tipoPagamento} onValueChange={(v: "avista" | "parcelado") => setTipoPagamento(v)}>
            <SelectTrigger className={cn("rounded-xl", isMobile && "h-9 text-sm")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="avista" className={cn(isMobile && "text-sm")}>À Vista</SelectItem>
              <SelectItem value="parcelado" className={cn(isMobile && "text-sm")}>Parcelado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Forma de Pagamento e Número de Parcelas (condicional) */}
      <div className={cn("grid gap-4", tipoPagamento === "parcelado" ? (isMobile ? "grid-cols-2 gap-2" : "grid-cols-2") : "grid-cols-1")}>
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

        {/* Número de Parcelas (aparece apenas se tipoPagamento for "parcelado") */}
        {tipoPagamento === "parcelado" && (
          <div>
            <Label htmlFor="numeroParcelas" className={cn(isMobile && "text-xs")}>
              Número de Parcelas
            </Label>
            <Input
              id="numeroParcelas"
              type="number"
              min="2"
              value={numeroParcelas}
              onChange={(e) => {
                const value = parseInt(e.target.value);
                setNumeroParcelas(isNaN(value) ? 1 : value);
                setValidationErrors(prev => ({ ...prev, numeroParcelas: false }));
              }}
              placeholder="Ex: 3"
              required
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