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
import { Plus } from "lucide-react";
import { Card } from "@/components/ui/card"; // Importar Card
import { useIsMobile } from "@/hooks/use-mobile"; // Importar useIsMobile
import { cn, getBorderClass } from "@/lib/utils"; // Importar cn e getBorderClass

interface AddCardDialogProps {
  user: User | null;
  onCardAdded: () => void;
  customTrigger?: React.ReactNode;
}

const toastDuration = 1000; // 1 segundo para todos os dispositivos
const toastSuccessStyle = { backgroundColor: '#FFFFFF', color: '#006000', border: '1px solid #E5FFE5' };
const toastErrorStyle = { backgroundColor: '#FFFFFF', color: '#FF2929', border: '1px solid #FFE5E5' };

export const AddCardDialog: React.FC<AddCardDialogProps> = ({ user, onCardAdded, customTrigger }) => {
  const [dialogAddCartaoOpen, setDialogAddCartaoOpen] = useState(false);
  const [newCardNome, setNewCardNome] = useState("");
  const [newCardBanco, setNewCardBanco] = useState("");
  const [newCardUltimosDigitos, setNewCardUltimosDigitos] = useState("");
  const [newCardDiaFechamento, setNewCardDiaFechamento] = useState("");
  const [newCardDiaVencimento, setNewCardDiaVencimento] = useState("");
  const [loading, setLoading] = useState(false);
  const isMobile = useIsMobile(); // Usar o hook
  const [validationErrors, setValidationErrors] = useState<Record<string, boolean>>({}); // NOVO ESTADO

  const getBorderColor = (errorKey: string) => {
    return validationErrors[errorKey] ? "!border-destructive border" : "!border-slate-400/60 border";
  };

  const handleAddNewCartao = async () => {
    if (!user) {
      toast.error("Usuário não autenticado.", { duration: toastDuration, style: toastErrorStyle });
      return;
    }

    const newErrors: Record<string, boolean> = {};
    let hasError = false;

    if (!newCardNome) { newErrors.newCardNome = true; hasError = true; }
    if (!newCardBanco) { newErrors.newCardBanco = true; hasError = true; }
    if (!newCardUltimosDigitos || newCardUltimosDigitos.length !== 4) { newErrors.newCardUltimosDigitos = true; hasError = true; }
    if (!newCardDiaFechamento || parseInt(newCardDiaFechamento) < 1 || parseInt(newCardDiaFechamento) > 31) { newErrors.newCardDiaFechamento = true; hasError = true; }
    if (!newCardDiaVencimento || parseInt(newCardDiaVencimento) < 1 || parseInt(newCardDiaVencimento) > 31) { newErrors.newCardDiaVencimento = true; hasError = true; }

    setValidationErrors(newErrors);
    if (hasError) {
      toast.error("Preencha todos os campos obrigatórios corretamente.", { duration: toastDuration, style: toastErrorStyle });
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
      toast.error("Erro ao adicionar cartão", { description: error.message, duration: toastDuration, style: toastErrorStyle });
      console.error(error);
    } else {
      toast.success("Cartão adicionado!", {
        style: toastSuccessStyle,
        duration: toastDuration
      });
      // Reset form fields
      setNewCardNome("");
      setNewCardBanco("");
      setNewCardUltimosDigitos("");
      setNewCardDiaFechamento("");
      setNewCardDiaVencimento("");
      setDialogAddCartaoOpen(false);
      setValidationErrors({}); // Clear errors on success
      onCardAdded(); // Notify parent to reload cards
    }
    setLoading(false);
  };

  return (
    <>
      {customTrigger ? (
        <div onClick={() => setDialogAddCartaoOpen(true)} className="inline-block">
          {customTrigger}
        </div>
      ) : (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={() => setDialogAddCartaoOpen(true)}
          className={cn(
            "btn-3d p-0 flex items-center justify-center rounded-xl shadow-[0_2px_4px_rgba(0,0,0,0.05)] border-none transition-all active:scale-90 flex-shrink-0 !opacity-100 bg-transparent",
            isMobile ? "h-9 w-8 text-sm" : "h-10 w-9 text-base"
          )}
          style={{ "--cor-topo": "#F87171", "--cor-base": "#EF4444", opacity: 1 } as any}
        >
          <Plus className="h-[18px] w-[18px] !text-white" strokeWidth={3.5} style={{ color: "#ffffff" }} />
        </Button>
      )}

      <Dialog open={dialogAddCartaoOpen} onOpenChange={setDialogAddCartaoOpen}>
      <DialogContent className={cn(
        isMobile ? "w-[98vw] max-w-[98vw] p-4 pt-10 pb-2 dialog-mobile !rounded-[22px] shadow-none" : "sm:max-w-[425px] sm:max-h-[85vh] sm:pt-10 !rounded-[22px] overflow-y-auto shadow-none",
        "border-none"
      )}
      style={{
        background: "linear-gradient(180deg, #f7fafc 0%, #f1f5fa 40%, #eaf0f7 100%)",
        backgroundBlendMode: "soft-light",
        backdropFilter: "blur(6px)",
        border: "2px solid rgba(37, 99, 235, 0.15)",
        outline: "1px solid rgba(37, 99, 235, 0.06)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.75), inset 0 -8px 20px rgba(0,0,0,0.015), inset 0 0 18px rgba(37, 99, 235, 0.06)"
      }}>
        <DialogHeader className={cn(isMobile ? "mt-0" : "mt-2")}>
          <DialogTitle className="flex items-center justify-center gap-2 w-full font-black">
            <span>💳</span>
            <span>Novo Cartão</span>
          </DialogTitle>
        </DialogHeader>
        <div className={cn("space-y-4", isMobile ? "pt-0 pb-2" : "pb-2")} data-dialog-card-form>
          <div>
            <Label className={cn("text-gray-800 font-medium mb-1.5 inline-block", isMobile ? "text-xs" : "text-sm")}>Nome do Cartão</Label>
            <Input
              value={newCardNome}
              onChange={(e) => {
                setNewCardNome(e.target.value);
                setValidationErrors(prev => ({ ...prev, newCardNome: false }));
              }}
              className={cn(
                "rounded-xl text-gray-800 font-medium transition-all duration-200 input-3d-premium input-white",
                isMobile ? "h-9 text-sm" : "h-10",
                getBorderColor("newCardNome"),
                getBorderClass({ isInvalid: validationErrors.newCardNome, isValid: validationErrors.newCardNome === false, variant: "green" })
              )}
              
            />
          </div>
          <div>
            <Label className={cn("text-gray-800 font-medium mb-1.5 inline-block", isMobile ? "text-xs" : "text-sm")}>Banco</Label>
            <Input
              value={newCardBanco}
              onChange={(e) => {
                setNewCardBanco(e.target.value);
                setValidationErrors(prev => ({ ...prev, newCardBanco: false }));
              }}
              className={cn(
                "rounded-xl text-gray-800 font-medium transition-all duration-200 input-3d-premium input-white",
                isMobile ? "h-9 text-sm" : "h-10",
                getBorderColor("newCardBanco"),
                getBorderClass({ isInvalid: validationErrors.newCardBanco, isValid: validationErrors.newCardBanco === false, variant: "green" })
              )}
              
            />
          </div>
          <div>
            <Label className={cn("text-gray-800 font-medium mb-1.5 inline-block", isMobile ? "text-xs" : "text-sm")}>Últimos 4 Dígitos</Label>
            <Input
              value={newCardUltimosDigitos}
              onChange={(e) => {
                setNewCardUltimosDigitos(e.target.value);
                setValidationErrors(prev => ({ ...prev, newCardUltimosDigitos: false }));
              }}
              maxLength={4}
              className={cn(
                "rounded-xl text-gray-800 font-medium transition-all duration-200 input-3d-premium input-white",
                isMobile ? "h-9 text-sm" : "h-10",
                getBorderColor("newCardUltimosDigitos"),
                getBorderClass({ isInvalid: validationErrors.newCardUltimosDigitos, isValid: validationErrors.newCardUltimosDigitos === false, variant: "green" })
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
                value={newCardDiaFechamento}
                onChange={(e) => {
                  setNewCardDiaFechamento(e.target.value);
                  setValidationErrors(prev => ({ ...prev, newCardDiaFechamento: false }));
                }}
                className={cn(
                  "rounded-xl text-gray-800 font-medium transition-all duration-200 input-3d-premium input-white",
                  isMobile ? "h-9 text-sm" : "h-10",
                  getBorderColor("newCardDiaFechamento"),
                  getBorderClass({ isInvalid: validationErrors.newCardDiaFechamento, isValid: validationErrors.newCardDiaFechamento === false, variant: "green" })
                )}
                
              />
            </div>
            <div>
              <Label className={cn("text-gray-800 font-medium mb-1.5 inline-block", isMobile ? "text-xs" : "text-sm")}>Dia Vencimento</Label>
              <Input
                type="number"
                min="1"
                max="31"
                value={newCardDiaVencimento}
                onChange={(e) => {
                  setNewCardDiaVencimento(e.target.value);
                  setValidationErrors(prev => ({ ...prev, newCardDiaVencimento: false }));
                }}
                className={cn(
                  "rounded-xl text-gray-800 font-medium transition-all duration-200 input-3d-premium input-white",
                  isMobile ? "h-9 text-sm" : "h-10",
                  getBorderColor("newCardDiaVencimento"),
                  getBorderClass({ isInvalid: validationErrors.newCardDiaVencimento, isValid: validationErrors.newCardDiaVencimento === false, variant: "green" })
                )}
                
              />
            </div>
          </div>
          <Button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleAddNewCartao();
            }}
            className={cn(
              "w-full rounded-xl btn-3d font-bold text-white border-none transition-all active:scale-95",
              isMobile ? "h-11 text-base !shadow-none mt-2" : "h-11 text-base shadow-md mt-2"
            )}
            style={{ "--cor-topo": "#0556C3", "--cor-base": "#03459C" } as any}
            disabled={loading}
          >
            {loading ? "Adicionando..." : "Adicionar Cartão"}
          </Button>
        </div>
      </DialogContent>
      </Dialog>
    </>
  );
};