import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AddCardDialog } from "@/components/AddCardDialog";
import ManageCardsDialog from "@/components/ManageCardsDialog";
import { cn } from "@/lib/utils";
import { User } from "@supabase/supabase-js";
import { Tables } from "@/integrations/supabase/types";

interface PaymentDetailsProps {
  valor: string;
  setValor: (value: string) => void;
  formaPagamento: "dinheiro" | "pix" | "cartao" | "boleto";
  setFormaPagamento: (value: "dinheiro" | "pix" | "cartao" | "boleto") => void;
  // tipoPagamento e setTipoPagamento removidos daqui
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
  // tipoPagamento e setTipoPagamento removidos daqui
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
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4"> {/* Ajustado para 2 colunas em desktop */}
      <div>
        <Label htmlFor="valor" className={cn(isMobile && "text-xs")}>Valor (R$)</Label>
        <Input
          id="valor"
          type="number"
          step="0.01"
          value={valor}
          onChange={(e) => {
            setValor(e.target.value);
            setValidationErrors(prev => ({ ...prev, valor: false }));
          }}
          required
          placeholder="0,00"
          className={cn(isMobile && "h-9 text-sm", validationErrors.valor && "border-destructive")}
        />
      </div>

      <div>
        <Label className={cn(isMobile && "text-xs")}>Forma de Pagamento</Label>
        <Select value={formaPagamento} onValueChange={(v: any) => setCartaoId(UNSELECTED_VALUE) || setFormaPagamento(v)}>
          <SelectTrigger className={cn(isMobile && "h-9 text-sm")}>
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
        <div className="col-span-full"> {/* Mantido col-span-full para cartões */}
          <Label className={cn(isMobile && "text-xs")}>Cartão de Crédito</Label>
          <div className="flex gap-2">
            <Select value={cartaoId} onValueChange={(v: any) => {
              setCartaoId(v);
              setValidationErrors(prev => ({ ...prev, cartaoId: false }));
            }}>
              <SelectTrigger className={cn(isMobile && "h-9 text-sm", validationErrors.cartaoId && "border-destructive")}>
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