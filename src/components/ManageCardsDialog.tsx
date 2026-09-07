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
import { useQueryClient } from "@tanstack/react-query";
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
  is_principal?: boolean;
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
  const queryClient = useQueryClient();
  const [optimisticPrincipalId, setOptimisticPrincipalId] = useState<string | null>(null);

  const handleTogglePrincipal = async (cardId: string, currentIsPrincipal: boolean) => {
    if (cards.length === 1) {
      toast.info("O seu único cartão já é o principal.", { duration: toastDuration, style: toastSuccessStyle });
      return;
    }
    if (currentIsPrincipal) return;

    // Snapshot
    const previousCards = queryClient.getQueryData<Cartao[]>(["cartoes", user?.id]);
    
    // Instant local UI update
    setOptimisticPrincipalId(cardId);
    
    // Optimistic UI update for global cache
    if (previousCards) {
      const updatedCards = previousCards.map(c => ({
        ...c,
        is_principal: c.id === cardId
      }));
      queryClient.setQueryData(["cartoes", user?.id], updatedCards);
    }
    
    // Immediately call onCardUpdated to trigger any parent refreshes if needed, though query cache handles most
    onCardUpdated();

    try {
      await supabase.from("cartoes").update({ is_principal: false }).eq("user_id", user?.id);
      await supabase.from("cartoes").update({ is_principal: true }).eq("id", cardId);
      
      queryClient.invalidateQueries({ queryKey: ["cartoes", user?.id] });
    } catch (e) {
      // Revert Optimistic UI
      setOptimisticPrincipalId(null);
      if (previousCards) {
        queryClient.setQueryData(["cartoes", user?.id], previousCards);
      }
      toast.error("Erro ao definir cartão principal", { duration: toastDuration, style: toastErrorStyle });
    }
  };

  // Edit form states
  const [nomeCartao, setNomeCartao] = useState("");
  const [banco, setBanco] = useState("");
  const [ultimosDigitos, setUltimosDigitos] = useState("");
  const [diaFechamento, setDiaFechamento] = useState("");
  const [diaVencimento, setDiaVencimento] = useState("");
  const [loading, setLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, boolean>>({}); // NOVO ESTADO

  const getBorderColor = (errorKey: string) => {
    return validationErrors[errorKey] ? "!border-destructive border" : "!border-slate-400/60 border";
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
    
    // Check if the card to delete is principal
    const cardToDeleteObj = cards.find(c => c.id === cardToDelete);
    if (cardToDeleteObj && cardToDeleteObj.is_principal) {
      const index = cards.findIndex(c => c.id === cardToDelete);
      let newPrincipalCard = null;
      if (cards.length > 1) {
        if (index < cards.length - 1) {
          newPrincipalCard = cards[index + 1];
        } else {
          newPrincipalCard = cards[index - 1];
        }
      }
      if (newPrincipalCard) {
        await supabase.from("cartoes").update({ is_principal: false }).eq("id", cardToDelete);
        await supabase.from("cartoes").update({ is_principal: true }).eq("id", newPrincipalCard.id);
      }
    }

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
            variant="ghost"
            className={cn(
              "btn-3d p-0 flex items-center justify-center rounded-xl shadow-[0_2px_4px_rgba(0,0,0,0.05)] border-none transition-all active:scale-90 flex-shrink-0 !opacity-100 bg-transparent",
              isMobile ? "!h-[39px] w-[34px] text-sm" : "h-10 w-9 text-base"
            )}
            style={{ "--cor-topo": "#FFFFFF", "--cor-base": "#F8FAFC", opacity: 1 } as any}
          >
            <span className="text-base">✏️</span>
          </Button>
        </DialogTrigger>
        <DialogContent 
          onOpenAutoFocus={(e) => e.preventDefault()}
          className={cn(
            isMobile ? "dialog-mobile w-[calc(100%-4px)] max-w-[calc(100%-4px)] !rounded-[19px] !px-3 !pb-[11px]" : "sm:max-w-[425px] sm:max-h-[90vh] !rounded-[19px] sm:!pb-[14px]",
            "shadow-none border-none bg-[#FAFAFA] !gap-2 flex flex-col max-h-[90vh] overflow-hidden [&>button]:hidden"
          )}
          style={{
            border: isMobile ? "2px solid #FFFFFF" : "none",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.6), inset 0 -8px 20px rgba(0,0,0,0.02), 0 20px 25px -5px rgba(0, 0, 0, 0.1)"
          }}
        >
          <DialogHeader
            className={cn(
              "flex flex-col items-center justify-center shrink-0 relative z-10",
              isMobile ? "mb-2 mt-[2px]" : "mb-[2px] -mt-2"
            )}
          >
            <div className="flex flex-col w-full transition-all gap-[3px] md:gap-0">
              <div className="flex flex-row items-center justify-center gap-3 w-full">
                <DialogTitle className="flex items-center justify-center text-[19px] md:text-[21px] font-extrabold text-[#0556C3] tracking-[0.2px] pb-[1px] m-0 leading-none text-center shrink truncate gap-[8px]" style={{ fontFamily: "'Inter', sans-serif" }}>
                  <DynamicIcon name="CreditCard" className="w-[18px] h-[18px] md:w-[20px] md:h-[20px] text-[#0556C3] mt-[-2px]" />
                  <span>Gerenciar Cartões</span>
                </DialogTitle>
              </div>
            </div>
          </DialogHeader>
          <div className={cn("pb-2 flex-1 overflow-y-auto no-scrollbar relative", isMobile && "max-h-[330px]")} data-dialog-card-form>
            <div className="space-y-4">
              {cards.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">Nenhum cartão cadastrado.</p>
              ) : (
                cards.map((card) => (
                  <Card
                    key={card.id}
                    className="flex flex-col p-3 border rounded-xl bg-card shadow-sm relative pr-12 min-h-[96px] justify-center shrink-0"
                  >
                    <div>
                      <p className="font-medium">{card.nome}</p>
                      <p className="text-sm text-muted-foreground">
                        {card.banco} (**** {card.ultimos_digitos})
                      </p>
                      <p 
                        className={cn(
                          "mt-1.5 select-none transition-colors w-fit", 
                          (optimisticPrincipalId ? card.id === optimisticPrincipalId : card.is_principal)
                            ? "text-[#0556C3] font-semibold text-xs cursor-default" 
                            : "text-slate-500 font-medium text-xs cursor-pointer hover:text-slate-700"
                        )}
                        onClick={(e) => { e.stopPropagation(); handleTogglePrincipal(card.id, !!card.is_principal); }}
                      >
                        {(optimisticPrincipalId ? card.id === optimisticPrincipalId : card.is_principal) ? "⭐ Cartão Principal" : "☆ Tornar Principal"}
                      </p>
                    </div>

                    <div className={cn(
                      "absolute right-2 flex flex-col",
                      isMobile ? "top-1/2 -translate-y-1/2 gap-1.5 justify-center" : "top-2 bottom-2 justify-between"
                    )}>
                      <Button
                        type="button"
                        size="icon"
                        onClick={() => handleEditClick(card)}
                        className={cn(
                          "p-0 flex items-center justify-center rounded-xl transition-all active:scale-90 flex-shrink-0 !opacity-100 bg-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] input-3d-premium !border-slate-400/60 border hover:bg-slate-50 h-8 w-8 text-sm"
                        )}
                      >
                        <span className={cn("text-base")}>✏️</span>
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        onClick={() => handleDeleteConfirm(card.id)}
                        className={cn(
                          "p-0 flex items-center justify-center rounded-xl transition-all active:scale-90 flex-shrink-0 !opacity-100 bg-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] input-3d-premium !border-slate-400/60 border hover:bg-slate-50 h-8 w-8 text-sm"
                        )}
                      >
                        <DynamicIcon name="Trash2" className={cn("text-red-500 h-[18px] w-[18px]")} />
                      </Button>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </div>
          <DialogFooter className={cn(isMobile ? "pb-0 pt-0" : "pb-0")}>
            <Button
              type="button"
              onClick={() => setIsManageCardsOpen(false)}
              className={cn(
                "w-full rounded-[14px] font-extrabold tracking-[0.2px] text-white border-none transition-all active:scale-95 text-[18px] h-[44px] flex items-center justify-center btn-3d-modal translate-x-[2px]",
                isMobile ? "mt-[10px]" : "mt-[2px]"
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
        <DialogContent 
          onOpenAutoFocus={(e) => e.preventDefault()} 
          className={cn(
            isMobile ? "dialog-mobile w-[calc(100%-4px)] max-w-[calc(100%-4px)] !rounded-[19px] !px-3 !pb-[8px]" : "sm:max-w-[425px] sm:max-h-[90vh] overflow-y-auto !rounded-[19px] sm:!pb-[11px]",
            "shadow-none border-none bg-[#FAFAFA]"
          )}
          style={{
            border: isMobile ? "2px solid #FFFFFF" : "none",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.6), inset 0 -8px 20px rgba(0,0,0,0.02), 0 20px 25px -5px rgba(0, 0, 0, 0.1)"
          }}
        >
          <DialogHeader
            className={cn(
              "flex flex-col items-start justify-start",
              isMobile ? "mb-[-6px]" : "mb-[2px]",
              isMobile && "absolute top-3.5 left-4 right-12 text-left",
              !isMobile && "-mt-2"
            )}
          >
            <div className="flex flex-col w-full transition-all gap-[3px] md:gap-0 pr-6">
              <div className="flex flex-row items-center justify-start gap-3 w-full">
                <DialogTitle className="flex items-center text-[19px] md:text-[21px] font-extrabold text-[#0556C3] tracking-[0.2px] pb-[1px] m-0 leading-none text-left shrink truncate gap-[8px]" style={{ fontFamily: "'Inter', sans-serif" }}>
                  <DynamicIcon name="Pencil" className="w-[18px] h-[18px] md:w-[20px] md:h-[20px] text-[#0556C3] mt-[-2px]" />
                  <span>Editar Cartão</span>
                </DialogTitle>
              </div>
            </div>
          </DialogHeader>
          <div className={cn("space-y-4 pt-[25px] pb-2")} data-dialog-card-form>
            <div>
              <Label className={cn("text-gray-800 font-medium mb-1.5 inline-block", isMobile ? "text-xs" : "text-sm")}>Nome do Cartão</Label>
              <Input
                value={nomeCartao}
                onChange={(e) => {
                  setNomeCartao(e.target.value);
                  setValidationErrors(prev => ({ ...prev, nomeCartao: false }));
                }}
                className={cn(
                  "rounded-xl text-gray-800 font-medium transition-all duration-200 input-3d-premium input-white",
                  isMobile ? "h-9 text-sm" : "h-10",
                  getBorderColor("nomeCartao"),
                  getBorderClass({ isInvalid: validationErrors.nomeCartao, isValid: validationErrors.nomeCartao === false, variant: "green" })
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
                  "rounded-xl text-gray-800 font-medium transition-all duration-200 input-3d-premium input-white",
                  isMobile ? "h-9 text-sm" : "h-10",
                  getBorderColor("banco"),
                  getBorderClass({ isInvalid: validationErrors.banco, isValid: validationErrors.banco === false, variant: "green" })
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
                  "rounded-xl text-gray-800 font-medium transition-all duration-200 input-3d-premium input-white",
                  isMobile ? "h-9 text-sm" : "h-10",
                  getBorderColor("ultimosDigitos"),
                  getBorderClass({ isInvalid: validationErrors.ultimosDigitos, isValid: validationErrors.ultimosDigitos === false, variant: "green" })
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
                    "rounded-xl text-gray-800 font-medium transition-all duration-200 input-3d-premium input-white",
                    isMobile ? "h-9 text-sm" : "h-10",
                    getBorderColor("diaFechamento"),
                    getBorderClass({ isInvalid: validationErrors.diaFechamento, isValid: validationErrors.diaFechamento === false, variant: "green" })
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
                    "rounded-xl text-gray-800 font-medium transition-all duration-200 input-3d-premium input-white",
                    isMobile ? "h-9 text-sm" : "h-10",
                    getBorderColor("diaVencimento"),
                    getBorderClass({ isInvalid: validationErrors.diaVencimento, isValid: validationErrors.diaVencimento === false, variant: "green" })
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
                "w-full rounded-[14px] font-extrabold tracking-[0.2px] text-white border-none transition-all active:scale-95 text-[18px] h-[44px] flex items-center justify-center btn-3d-modal",
                isMobile ? "mt-4" : "mt-2"
              )}
              style={{ "--cor-topo": "#0556C3", "--cor-base": "#03459C" } as any}
              disabled={loading}
            >
              {loading ? "Atualizando..." : "Atualizar Cartão"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isConfirmDeleteOpen} onOpenChange={setIsConfirmDeleteOpen}>
        <AlertDialogContent
          className={cn(
            isMobile ? "dialog-mobile w-[99%] max-w-[99%] !px-4 p-4 !pb-4 min-h-[180px] !rounded-[22px] shadow-none border-none" : "sm:max-w-[400px] !pb-4 !rounded-[22px] shadow-none border-none"
          )}
          style={{
            background: "linear-gradient(135deg, #ffffff 0%, #f9fafb 100%)",
            backgroundBlendMode: "soft-light",
            backdropFilter: "blur(6px)",
            border: "1px solid rgba(0,0,0,0.06)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.6), inset 0 -8px 20px rgba(0,0,0,0.02), 0 20px 25px -5px rgba(0, 0, 0, 0.1)"
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center justify-center gap-2 text-xl font-black">
              <DynamicIcon name="Trash2" className="h-6 w-6 text-destructive" />
              Confirmar Exclusão
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              Deseja realmente excluir este cartão? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter
            className={cn(
              "flex flex-col sm:flex-row justify-center gap-2",
              isMobile && "flex-row items-center justify-between"
            )}
          >
            <AlertDialogCancel
              disabled={loading}
              className={cn(
                "flex-1 rounded-xl btn-3d font-black !text-[#1E40AF] border-none transition-all active:scale-95 shadow-[0_2px_4px_rgba(0,0,0,0.05)] text-lg mt-0 h-11",
                isMobile && "h-11 text-lg"
              )}
              style={{ "--cor-topo": "#E0E7FF", "--cor-base": "#C7D2FE" } as any}
              onClick={() => setIsConfirmDeleteOpen(false)}
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCard}
              disabled={loading}
              className={cn(
                "flex-1 rounded-2xl btn-3d font-black text-white border-none transition-all active:scale-95 shadow-[0_2px_4px_rgba(0,0,0,0.05)] text-lg h-11",
                isMobile && "h-12 text-lg"
              )}
              style={{ "--cor-topo": "#FF6B6B", "--cor-base": "#E54D4D" } as any}
            >
              {loading ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
