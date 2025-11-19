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
}) => {
  return (
    <div className={cn("grid gap-4", isMobile ? "grid-cols-2 gap-2" : "grid-cols-2")}> {/* Alterado para grid-cols-2 em mobile, com gap menor */}
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

      {formaPagamento === "cartao" && (
        <div className="col-span-full"> {/* Este ainda ocupará a largura total */}
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