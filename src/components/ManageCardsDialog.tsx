import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import DynamicIcon from "./DynamicIcon";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Tables } from "@/integrations/supabase/types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card } from "@/components/ui/card";
import { useIsMobile } from "@/hooks/use-mobile"; // Importar useIsMobile
import { cn } from "@/lib/utils"; // Importar cn

interface Cartao {
  id: string;
  nome: string;
  banco: string;
  ultimos_digitos: string;
  dia_fechamento: number;
  dia_vencimento: number;
}

interface ManageCardsDialogProps {
  cards: Cartao[];
  onCardUpdated: () => void;
  onCardDeleted: () => void;
}

const ManageCardsDialog: React.FC<ManageCardsDialogProps> = ({
  cards,
  onCardUpdated,
  onCardDeleted,
}) => {
  const { user } = useAuth();
  const [isManageCardsOpen, setIsManageCardsOpen] = useState(false);
  const [isEditCardOpen, setIsEditCardOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<Cartao | null>(null);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [cardToDelete, setCardToDelete] = useState<string | null>(null);
  const isMobile = useIsMobile(); // Usar o hook

  // Edit form states
  const [nomeCartao, setNomeCartao] = useState("");
  const [banco, setBanco] = useState("");
  const [ultimosDigitos, setUltimosDigitos] = useState("");
  const [diaFechamento, setDiaFechamento] = useState("");
  const [diaVencimento, setDiaVencimento] = useState("");
  const [loading, setLoading] = useState(false);

  const handleEditClick = (card: Cartao) => {
    setEditingCard(card);
    setNomeCartao(card.nome);
    setBanco(card.banco);
    setUltimosDigitos(card.ultimos_digitos);
    setDiaFechamento(card.dia_fechamento.toString());
    setDiaVencimento(card.dia_vencimento.toString());
    setIsEditCardOpen(true);
  };

  const handleUpdateCard = async () => {
    if (!editingCard || !nomeCartao || !banco || !ultimosDigitos || !diaFechamento || !diaVencimento) {
      toast.error("Preencha todos os campos do cartão");
      return;
    }

    setLoading(true);
    const { error } = await supabase
      .from("cartoes")
      .update({
        nome: nomeCartao,
        banco,
        ultimos_digitos: ultimosDigitos,
        dia_fechamento: parseInt(diaFechamento),
        dia_vencimento: parseInt(diaVencimento),
      })
      .eq("id", editingCard.id);

    if (error) {
      toast.error("Erro ao atualizar cartão", { description: error.message });
      console.error(error);
    } else {
      toast.success("Cartão atualizado!", {
        style: { backgroundColor: 'hsl(var(--soft-green))', color: 'hsl(var(--success-darker))' }
      });
      setIsEditCardOpen(false);
      setEditingCard(null);
      onCardUpdated();
    }
    setLoading(false);
  };

  const handleDeleteConfirm = (cardId: string) => {
    setCardToDelete(cardId);
    setIsConfirmDeleteOpen(true);
  };

  const handleDeleteCard = async () => {
    if (!cardToDelete) return;

    setLoading(true);

    // 1. Check for associated one-off expenses
    const { count: expenseCount, error: countError } = await supabase
      .from("despesas")
      .select("id", { count: 'exact' })
      .eq("cartao_id", cardToDelete);

    console.log(`[DEBUG] Card ${cardToDelete}: Found ${expenseCount} associated 'despesas' records.`);

    if (countError) {
      toast.error("Erro ao verificar despesas associadas", { description: countError.message });
      console.error(countError);
      setLoading(false);
      setIsConfirmDeleteOpen(false);
      return;
    }

    if (expenseCount && expenseCount > 0) {
      toast.error("Não é possível excluir o cartão", {
        description: "Existem despesas avulsas associadas a este cartão. Remova-as ou edite-as primeiro.",
      });
      setLoading(false);
      setIsConfirmDeleteOpen(false);
      return;
    }
    
    // If no associated expenses, proceed with deletion
    const { error } = await supabase.from("cartoes").delete().eq("id", cardToDelete);

    if (error) {
      toast.error("Erro ao excluir cartão", { description: error.message });
      console.error(error);
    } else {
      toast.success("Cartão excluído!", {
        style: { backgroundColor: 'hsl(var(--soft-green))', color: 'hsl(var(--success-darker))' }
      });
      onCardDeleted();
    }
    setLoading(false);
    setIsConfirmDeleteOpen(false);
    setCardToDelete(null);
  };

  return (
    <>
      <Dialog open={isManageCardsOpen} onOpenChange={setIsManageCardsOpen}>
        <DialogTrigger asChild>
          <Button type="button" variant="outline" size="icon">
            <DynamicIcon name="Pencil" className="w-4 h-4" />
          </Button>
        </DialogTrigger>
        <DialogContent className={cn("w-full sm:max-w-[425px]")}> {/* Revertido para o estado anterior */}
          <DialogHeader>
            <DialogTitle>Gerenciar Cartões</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[300px] pr-4">
            <div className="space-y-4">
              {cards.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">Nenhum cartão cadastrado.</p>
              ) : (
                cards.map((card) => (
                  <Card
                    key={card.id}
                    className="flex items-center justify-between p-3 border rounded-xl bg-card shadow-sm"
                  >
                    <div>
                      <p className="font-medium">{card.nome}</p>
                      <p className="text-sm text-muted-foreground">
                        {card.banco} (**** {card.ultimos_digitos})
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEditClick(card)}
                        className="text-primary hover:bg-primary/10"
                      >
                        <DynamicIcon name="Pencil" className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteConfirm(card.id)}
                        className="text-destructive hover:bg-destructive/10"
                      >
                        <DynamicIcon name="Trash2" className="h-4 w-4" />
                      </Button>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button onClick={() => setIsManageCardsOpen(false)} className="rounded-xl">Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog for Editing Card */}
      <Dialog open={isEditCardOpen} onOpenChange={setIsEditCardOpen}>
        <DialogContent className={cn("w-full sm:max-w-[425px]")}> {/* Revertido para o estado anterior */}
          <DialogHeader>
            <DialogTitle>Editar Cartão</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome do Cartão</Label>
              <Input value={nomeCartao} onChange={(e) => setNomeCartao(e.target.value)} className="rounded-xl" />
            </div>
            <div>
              <Label>Banco</Label>
              <Input value={banco} onChange={(e) => setBanco(e.target.value)} className="rounded-xl" />
            </div>
            <div>
              <Label>Últimos 4 Dígitos</Label>
              <Input
                value={ultimosDigitos}
                onChange={(e) => setUltimosDigitos(e.target.value)}
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
                  value={diaFechamento}
                  onChange={(e) => setDiaFechamento(e.target.value)}
                  className="rounded-xl"
                />
              </div>
              <div>
                <Label>Dia Vencimento</Label>
                <Input
                  type="number"
                  min="1"
                  max="31"
                  value={diaVencimento}
                  onChange={(e) => setDiaVencimento(e.target.value)}
                  className="rounded-xl"
                />
              </div>
            </div>
            <Button onClick={handleUpdateCard} className="w-full rounded-xl" disabled={loading}>
              {loading ? "Atualizando..." : "Atualizar Cartão"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Alert Dialog for Delete Confirmation */}
      <AlertDialog open={isConfirmDeleteOpen} onOpenChange={setIsConfirmDeleteOpen}>
        <AlertDialogContent className={cn("w-full sm:max-w-[425px]")}> {/* Revertido para o estado anterior */}
          <AlertDialogHeader>
            <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Isso excluirá permanentemente o cartão selecionado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCard} disabled={loading}>
              {loading ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ManageCardsDialog;