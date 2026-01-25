import React, { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input }
  from "@/components/ui/input";
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
import { cn, getBorderClass } from "@/lib/utils"; // Importar cn e getBorderClass

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

const toastDuration = 1000; // 1 segundo para todos os dispositivos
const toastSuccessStyle = { backgroundColor: '#FFFFFF', color: '#006000', border: '1px solid #E5FFE5' };
const toastErrorStyle = { backgroundColor: '#FFFFFF', color: '#FF2929', border: '1px solid #FFE5E5' };

export const ManageCardsDialog: React.FC<ManageCardsDialogProps> = ({
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
  const [validationErrors, setValidationErrors] = useState<Record<string, boolean>>({}); // NOVO ESTADO

  const getBorderColor = (errorKey: string) => {
    return validationErrors[errorKey] ? "!border-destructive border" : "!border-[#E2E8F0] border";
  };

  const handleEditClick = (card: Cartao) => {
    setEditingCard(card);
    setNomeCartao(card.nome);
    setBanco(card.banco);
    setUltimosDigitos(card.ultimos_digitos);
    setDiaFechamento(card.dia_fechamento.toString());
    setDiaVencimento(card.dia_vencimento.toString());
    setIsEditCardOpen(true);
    setValidationErrors({}); // Clear errors on new edit
  };

  const handleUpdateCard = async () => {
    if (!editingCard) return;

    const newErrors: Record<string, boolean> = {};
    let hasError = false;

    if (!nomeCartao) { newErrors.nomeCartao = true; hasError = true; }
    if (!banco) { newErrors.banco = true; hasError = true; }
    if (!ultimosDigitos || ultimosDigitos.length !== 4) { newErrors.ultimosDigitos = true; hasError = true; }
    if (!diaFechamento || parseInt(diaFechamento) < 1 || parseInt(diaFechamento) > 31) { newErrors.diaFechamento = true; hasError = true; }
    if (!diaVencimento || parseInt(diaVencimento) < 1 || parseInt(diaVencimento) > 31) { newErrors.diaVencimento = true; hasError = true; }

    setValidationErrors(newErrors);
    if (hasError) {
      toast.error("Preencha todos os campos obrigatórios corretamente.", { duration: toastDuration, style: toastErrorStyle });
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
      toast.error("Erro ao atualizar cartão", { description: error.message, duration: toastDuration, style: toastErrorStyle });
      console.error(error);
    } else {
      toast.success("Cartão atualizado!", {
        style: toastSuccessStyle,
        duration: toastDuration
      });
      setIsEditCardOpen(false);
      setEditingCard(null);
      setValidationErrors({}); // Clear errors on success
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
      toast.error("Erro ao verificar despesas associadas", { description: countError.message, duration: toastDuration, style: toastErrorStyle });
      console.error(countError);
      setLoading(false);
      setIsConfirmDeleteOpen(false);
      return;
    }

    if (expenseCount && expenseCount > 0) {
      toast.error("Não é possível excluir o cartão", {
        description: "Existem despesas avulsas associadas a este cartão. Remova-as ou edite-as primeiro.",
        duration: toastDuration, style: toastErrorStyle
      });
      setLoading(false);
      setIsConfirmDeleteOpen(false);
      return;
    }

    // If no associated expenses, proceed with deletion
    const { error } = await supabase.from("cartoes").delete().eq("id", cardToDelete);

    if (error) {
      toast.error("Erro ao excluir cartão", { description: error.message, duration: toastDuration, style: toastErrorStyle });
      console.error(error);
    } else {
      toast.success("Cartão excluído!", {
        style: toastSuccessStyle,
        duration: toastDuration
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
          <Button
            type="button"
            size="icon"
            className={cn(
              "btn-3d w-9 h-9 p-0 flex items-center justify-center rounded-xl shadow-sm border border-red-200 transition-all active:scale-90",
              isMobile && "h-9 w-9"
            )}
            style={{ "--cor-topo": "#FFFFFF", "--cor-base": "#F1F5F9" } as any}
          >
            <span className="text-lg">✏️</span>
          </Button>
        </DialogTrigger>
        <DialogContent className={cn(
          isMobile ? "dialog-mobile pb-6" : "sm:max-w-[425px] sm:max-h-[80vh] overflow-y-auto"
        )}>
          <DialogHeader className={cn("mt-4", !isMobile && "mt-0")}>
            <DialogTitle className="flex items-center justify-center gap-2 w-full">
              <span>💳</span>
              <span>Gerenciar Cartões</span>
            </DialogTitle>
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
          <DialogFooter className={cn(isMobile ? "pb-5 pt-2" : "pb-3")}>
            <Button
              type="button"
              onClick={() => setIsManageCardsOpen(false)}
              className={cn(
                "w-full rounded-xl btn-3d font-bold text-white border-none transition-all active:scale-95",
                isMobile ? "h-11 text-base !shadow-none" : "h-11 text-base shadow-md"
              )}
              style={{ "--cor-topo": "#0556C3", "--cor-base": "#03459C" } as any}
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog for Editing Card */}
      <Dialog open={isEditCardOpen} onOpenChange={setIsEditCardOpen}>
        <DialogContent className={cn(
          isMobile ? "max-w-sm p-4 pt-10 dialog-mobile" : "sm:max-w-[425px] sm:pt-10"
        )}>
          <DialogHeader className={cn(isMobile ? "mt-0" : "mt-2")}>
            <DialogTitle className="flex items-center justify-center gap-2 w-full">
              <span>💳</span>
              <span>Editar Cartão</span>
            </DialogTitle>
          </DialogHeader>
          <div className={cn("space-y-4", isMobile ? "pb-5" : "pb-2")}>
            <div>
              <Label className={cn("text-gray-800 font-medium mb-1.5 inline-block", isMobile ? "text-xs" : "text-sm")}>Nome do Cartão</Label>
              <Input
                value={nomeCartao}
                onChange={(e) => {
                  setNomeCartao(e.target.value);
                  setValidationErrors(prev => ({ ...prev, nomeCartao: false }));
                }}
                className={cn(
                  "rounded-xl text-gray-800 font-medium transition-all duration-200 input-3d-premium",
                  isMobile ? "h-9 text-sm" : "h-10",
                  getBorderColor("nomeCartao"),
                  getBorderClass({ isInvalid: validationErrors.nomeCartao, isValid: validationErrors.nomeCartao === false })
                )}
              />
            </div>
            <div>
              <Label className={cn("text-gray-800 font-medium mb-1.5 inline-block", isMobile ? "text-xs" : "text-sm")}>Banco</Label>
              <Input
                value={banco}
                onChange={(e) => {
                  setBanco(e.target.value);
                  setValidationErrors(prev => ({ ...prev, banco: false }));
                }}
                className={cn(
                  "rounded-xl text-gray-800 font-medium transition-all duration-200 input-3d-premium",
                  isMobile ? "h-9 text-sm" : "h-10",
                  getBorderColor("banco"),
                  getBorderClass({ isInvalid: validationErrors.banco, isValid: validationErrors.banco === false })
                )}
              />
            </div>
            <div>
              <Label className={cn("text-gray-800 font-medium mb-1.5 inline-block", isMobile ? "text-xs" : "text-sm")}>Últimos 4 Dígitos</Label>
              <Input
                value={ultimosDigitos}
                onChange={(e) => {
                  setUltimosDigitos(e.target.value);
                  setValidationErrors(prev => ({ ...prev, ultimosDigitos: false }));
                }}
                maxLength={4}
                className={cn(
                  "rounded-xl text-gray-800 font-medium transition-all duration-200 input-3d-premium",
                  isMobile ? "h-9 text-sm" : "h-10",
                  getBorderColor("ultimosDigitos"),
                  getBorderClass({ isInvalid: validationErrors.ultimosDigitos, isValid: validationErrors.ultimosDigitos === false })
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className={cn("text-gray-800 font-medium mb-1.5 inline-block", isMobile ? "text-xs" : "text-sm")}>Dia Fechamento</Label>
                <Input
                  type="number"
                  min="1"
                  max="31"
                  value={diaFechamento}
                  onChange={(e) => {
                    setDiaFechamento(e.target.value);
                    setValidationErrors(prev => ({ ...prev, diaFechamento: false }));
                  }}
                  className={cn(
                    "rounded-xl text-gray-800 font-medium transition-all duration-200 input-3d-premium",
                    isMobile ? "h-9 text-sm" : "h-10",
                    getBorderColor("diaFechamento"),
                    getBorderClass({ isInvalid: validationErrors.diaFechamento, isValid: validationErrors.diaFechamento === false })
                  )}
                />
              </div>
              <div>
                <Label className={cn("text-gray-800 font-medium mb-1.5 inline-block", isMobile ? "text-xs" : "text-sm")}>Dia Vencimento</Label>
                <Input
                  type="number"
                  min="1"
                  max="31"
                  value={diaVencimento}
                  onChange={(e) => {
                    setDiaVencimento(e.target.value);
                    setValidationErrors(prev => ({ ...prev, diaVencimento: false }));
                  }}
                  className={cn(
                    "rounded-xl text-gray-800 font-medium transition-all duration-200 input-3d-premium",
                    isMobile ? "h-9 text-sm" : "h-10",
                    getBorderColor("diaVencimento"),
                    getBorderClass({ isInvalid: validationErrors.diaVencimento, isValid: validationErrors.diaVencimento === false })
                  )}
                />
              </div>
            </div>
            <Button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleUpdateCard();
              }}
              className={cn(
                "w-full rounded-xl btn-3d font-bold text-white border-none transition-all active:scale-95",
                isMobile ? "h-11 text-base !shadow-none mt-4" : "h-11 text-base shadow-md mt-2"
              )}
              style={{ "--cor-topo": "#0556C3", "--cor-base": "#03459C" } as any}
              disabled={loading}
            >
              {loading ? "Atualizando..." : "Atualizar Cartão"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Alert Dialog for Delete Confirmation */}
      <AlertDialog open={isConfirmDeleteOpen} onOpenChange={setIsConfirmDeleteOpen}>
        <AlertDialogContent className={cn(
          isMobile ? "dialog-mobile w-[96%] p-6 !pb-7" : "sm:max-w-[500px] p-6 !pb-7"
        )}>
          <AlertDialogHeader className="flex flex-col items-center justify-center text-center">
            <AlertDialogTitle className="text-xl font-bold flex items-center justify-center gap-2 mb-2">
              <Trash2 className="h-5 w-5 text-red-500" />
              Tem certeza?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-700">
              Deseja realmente excluir este cartão?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className={cn(
            "flex gap-3 mt-6",
            isMobile ? "flex-row justify-center" : "sm:justify-center"
          )}>
            <AlertDialogCancel
              onClick={() => setIsConfirmDeleteOpen(false)}
              className={cn(
                "flex-1 rounded-xl border border-blue-100 bg-white text-blue-600 hover:bg-blue-50 hover:text-blue-700 font-bold m-0 h-11",
                !isMobile && "max-w-[140px]"
              )}
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCard}
              disabled={loading}
              className={cn(
                "flex-1 rounded-xl bg-red-500 text-white font-semibold hover:bg-red-600 border-none m-0 h-11 transition-all active:scale-95",
                !isMobile && "max-w-[140px]"
              )}
            >
              {loading ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};