import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import DynamicIcon from "./DynamicIcon";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Card } from "@/components/ui/card"; // Importar Card

interface AddCardDialogProps {
  user: User | null;
  onCardAdded: () => void;
}

export const AddCardDialog: React.FC<AddCardDialogProps> = ({ user, onCardAdded }) => {
  const [dialogAddCartaoOpen, setDialogAddCartaoOpen] = useState(false);
  const [newCardNome, setNewCardNome] = useState("");
  const [newCardBanco, setNewCardBanco] = useState("");
  const [newCardUltimosDigitos, setNewCardUltimosDigitos] = useState("");
  const [newCardDiaFechamento, setNewCardDiaFechamento] = useState("");
  const [newCardDiaVencimento, setNewCardDiaVencimento] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAddNewCartao = async () => {
    if (!user) {
      toast.error("Usuário não autenticado.");
      return;
    }
    if (!newCardNome || !newCardBanco || !newCardUltimosDigitos || !newCardDiaFechamento || !newCardDiaVencimento) {
      toast.error("Preencha todos os campos do cartão");
      return;
    }

    setLoading(true);
    const { error } = await supabase.from("cartoes").insert({
      user_id: user.id,
      nome: newCardNome,
      banco: newCardBanco,
      ultimos_digitos: newCardUltimosDigitos,
      dia_fechamento: parseInt(newCardDiaFechamento),
      dia_vencimento: parseInt(newCardDiaVencimento),
    });

    if (error) {
      toast.error("Erro ao adicionar cartão", { description: error.message });
      console.error(error);
    } else {
      toast.success("Cartão adicionado!", {
        style: { backgroundColor: 'hsl(var(--soft-green))', color: 'hsl(var(--success-darker))' }
      });
      // Reset form fields
      setNewCardNome("");
      setNewCardBanco("");
      setNewCardUltimosDigitos("");
      setNewCardDiaFechamento("");
      setNewCardDiaVencimento("");
      setDialogAddCartaoOpen(false);
      onCardAdded(); // Notify parent to reload cards
    }
    setLoading(false);
  };

  return (
    <Dialog open={dialogAddCartaoOpen} onOpenChange={setDialogAddCartaoOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="icon">
          <DynamicIcon name="Plus" className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cadastrar Novo Cartão</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Nome do Cartão</Label>
            <Input value={newCardNome} onChange={(e) => setNewCardNome(e.target.value)} className="rounded-xl" />
          </div>
          <div>
            <Label>Banco</Label>
            <Input value={newCardBanco} onChange={(e) => setNewCardBanco(e.target.value)} className="rounded-xl" />
          </div>
          <div>
            <Label>Últimos 4 Dígitos</Label>
            <Input 
              value={newCardUltimosDigitos} 
              onChange={(e) => setNewCardUltimosDigitos(e.target.value)}
              maxLength={4}
              className="rounded-xl"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Dia Fechamento</Label>
              <Input 
                type="number" 
                min="1" 
                max="31"
                value={newCardDiaFechamento} 
                onChange={(e) => setNewCardDiaFechamento(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div>
              <Label>Dia Vencimento</Label>
              <Input 
                type="number" 
                min="1" 
                max="31"
                value={newCardDiaVencimento} 
                onChange={(e) => setNewCardDiaVencimento(e.target.value)}
                className="rounded-xl"
              />
            </div>
          </div>
          <Button onClick={handleAddNewCartao} className="w-full rounded-xl" disabled={loading}>
            {loading ? "Adicionando..." : "Adicionar Cartão"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};