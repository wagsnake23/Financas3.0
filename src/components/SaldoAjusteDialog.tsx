import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn, formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface SaldoAjusteDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  saldoCalculadoSistema: number;
  userId: string;
  onAjusteSalvo: () => void;
  isMobile: boolean;
}

export const SaldoAjusteDialog: React.FC<SaldoAjusteDialogProps> = ({
  isOpen,
  onOpenChange,
  saldoCalculadoSistema,
  userId,
  onAjusteSalvo,
  isMobile,
}) => {
  const [saldoInformadoStr, setSaldoInformadoStr] = useState("");
  const [descricao, setDescricao] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  // Clear state when opened
  useEffect(() => {
    if (isOpen) {
      setSaldoInformadoStr("");
      setDescricao("");
      setError(false);
    }
  }, [isOpen]);

  const saldoInformado = parseFloat(saldoInformadoStr.replace(/\./g, "").replace(",", ".")) || 0;
  const isPristine = saldoInformadoStr.trim() === "";
  const diferenca = saldoInformado - saldoCalculadoSistema;
  
  const handleMoneyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, "");
    if (value === "") {
      setSaldoInformadoStr("");
      setError(true);
      return;
    }
    setError(false);
    
    // Parse as integer cents, then format
    const numericValue = parseInt(value, 10);
    const decimalValue = numericValue / 100;
    
    // format to pt-BR string like "1.234,56"
    const formatted = new Intl.NumberFormat("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(decimalValue);
    
    setSaldoInformadoStr(formatted);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isPristine) {
      setError(true);
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          saldo_ajuste: diferenca,
          saldo_ajuste_updated_at: new Date().toISOString()
        })
        .eq("id", userId);

      if (error) throw error;
      
      toast.success("Saldo ajustado com sucesso.");
      onAjusteSalvo();
      onOpenChange(false);
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao salvar o ajuste.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent 
        className={cn(
          "flex flex-col overflow-hidden max-h-[90dvh] w-full bg-[#FAFAFA]", 
          isMobile ? "max-w-full rounded-t-[16px] rounded-b-none h-[95dvh] !p-0 mt-[5dvh]" : "sm:max-w-[425px] rounded-[16px] !p-0"
        )}
      >
        <DialogHeader className={cn("shrink-0 bg-white border-b px-5 py-4", isMobile ? "border-b-[#E5E7EB]" : "")}>
          <DialogTitle className="text-[20px] font-extrabold text-slate-800 tracking-tight leading-none text-left flex items-center gap-2">
            💰 Ajustar Saldo Atual
          </DialogTitle>
          <DialogDescription className="text-left text-[14px] text-slate-500 font-medium leading-snug mt-1.5">
            Informe o saldo real disponível atualmente. O sistema calculará automaticamente a diferença necessária.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSave} className="flex flex-col flex-1 overflow-hidden">
          <div className={cn("flex-1 overflow-y-auto px-5 py-5 space-y-5", isMobile ? "bg-[#FAFAFA]" : "")}>
            
            <div className="flex items-center justify-between py-3 border-b border-slate-200">
              <span className="text-[14px] font-bold text-slate-700">Saldo Atual Calculado</span>
              <span className="text-[16px] font-extrabold text-slate-900 tracking-tight">{formatCurrency(saldoCalculadoSistema)}</span>
            </div>

            <div className="space-y-2.5">
              <Label htmlFor="saldoInformado" className="text-[13px] font-bold text-slate-700 uppercase tracking-wide">
                Saldo Real Atual <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[15px] font-bold text-slate-400">R$</span>
                <Input
                  id="saldoInformado"
                  value={saldoInformadoStr}
                  onChange={handleMoneyChange}
                  placeholder="0,00"
                  className={cn(
                    "pl-10 h-[48px] text-[16px] font-bold shadow-sm transition-all focus-visible:ring-2 rounded-[12px] bg-white",
                    error ? "border-red-500 focus-visible:ring-red-200" : "border-slate-200 focus-visible:ring-slate-100 focus-visible:border-slate-300"
                  )}
                  inputMode="numeric"
                />
              </div>
              {error && <span className="text-[11px] font-bold text-red-500 leading-none">Campo obrigatório.</span>}
            </div>

            {!isPristine && (
              <div className="flex items-center justify-between bg-slate-100/70 p-3 rounded-[12px] border border-slate-200/50">
                <span className="text-[13px] font-bold text-slate-600">Diferença do Ajuste</span>
                <span className={cn(
                  "text-[15px] font-extrabold tracking-tight",
                  diferenca > 0 ? "text-emerald-600" : diferenca < 0 ? "text-rose-600" : "text-slate-600"
                )}>
                  {diferenca > 0 ? "+ " : ""}{formatCurrency(diferenca)}
                </span>
              </div>
            )}

            <div className="space-y-2.5">
              <Label htmlFor="descricao" className="text-[13px] font-bold text-slate-700 uppercase tracking-wide">
                Descrição <span className="text-slate-400 font-medium normal-case text-[11px] tracking-normal ml-1">(Opcional)</span>
              </Label>
              <Textarea
                id="descricao"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Ex.: Correção de saldo, dinheiro em espécie, ajuste manual..."
                className="resize-none min-h-[70px] max-h-[70px] text-[14px] bg-white border-slate-200 rounded-[12px] shadow-sm focus-visible:ring-slate-100 focus-visible:border-slate-300"
                maxLength={200}
              />
            </div>
          </div>

          <div className={cn("shrink-0 p-5 bg-white border-t border-slate-200", isMobile ? "pb-8" : "")}>
            <div className="grid grid-cols-2 gap-2 w-full">
              <Button
                type="button"
                onClick={() => onOpenChange(false)}
                className="w-full rounded-[14px] font-extrabold tracking-[0.5px] border transition-all active:scale-95 text-[15px] h-[44px] flex items-center justify-center bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="w-full rounded-[14px] font-extrabold tracking-[0.5px] text-white border-none transition-all active:scale-95 shadow-[0_2px_4px_rgba(0,0,0,0.05)] text-[15px] h-[44px] flex items-center justify-center btn-3d"
                style={{ "--cor-topo": "#25AF6A", "--cor-base": "#1AA361" } as any}
                disabled={loading}
              >
                {loading ? "Salvando..." : "Aplicar Ajuste"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
