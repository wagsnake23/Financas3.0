import React, { useState, useMemo, useEffect } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import CurrencyBR from "@/components/ui/currency-br";
import DynamicIcon from "@/components/DynamicIcon";
import { useToast } from "@/contexts/ToastContext";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import {
  Investment,
  InvestmentConsolidatedMetrics,
} from "@/types/finance";
import { simularResgateFIFO, roundCurrency } from "@/lib/investmentsFifo";
import { formatCurrency, cn } from "@/lib/utils";

interface RescueInvestmentDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  investment: Investment | null;
  consolidated: InvestmentConsolidatedMetrics | null;
  categoryName?: string;
  isMobile?: boolean;
  onSuccess?: () => void;
}

export const RescueInvestmentDialog: React.FC<RescueInvestmentDialogProps> = ({
  isOpen,
  onOpenChange,
  investment,
  consolidated,
  categoryName,
  isMobile = false,
  onSuccess,
}) => {
  const { user } = useAuth();
  const { showSuccessToast, showErrorToast } = useToast();
  const queryClient = useQueryClient();

  const [tipoResgate, setTipoResgate] = useState<"parcial" | "total">("total");
  const [valorLiquidoDesejado, setValorLiquidoDesejado] = useState<number | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset states on open
  useEffect(() => {
    if (isOpen) {
      setTipoResgate("total");
      setValorLiquidoDesejado(undefined);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  // Simulação FIFO em tempo real — hook SEMPRE chamado (antes de qualquer return condicional)
  const saldoLiquidoDisponivel = consolidated?.saldoLiquidoTotal ?? 0;

  const simulacao = useMemo(() => {
    if (!investment || !consolidated) {
      return { valido: false, erro: "Investimento não disponível", alocacoes: [], valorLiquidoTotal: 0, valorLiquidoSolicitado: 0, valorBrutoTotal: 0, rendimentoBrutoTotal: 0, irTotal: 0, principalTotalConsumido: 0 };
    }
    const valor =
      tipoResgate === "total"
        ? saldoLiquidoDisponivel
        : valorLiquidoDesejado || 0;

    return simularResgateFIFO(consolidated.lotes, tipoResgate, valor);
  }, [investment, consolidated, consolidated?.lotes, tipoResgate, valorLiquidoDesejado, saldoLiquidoDisponivel]);

  const isFormValid =
    simulacao.valido &&
    simulacao.valorLiquidoTotal > 0 &&
    (tipoResgate === "total" || (valorLiquidoDesejado !== undefined && valorLiquidoDesejado > 0));

  if (!investment || !consolidated) return null;

  const displayName = categoryName || investment.nome;

  const handleConfirmRescue = async () => {
    if (!user?.id) {
      showErrorToast("Usuário não autenticado.");
      return;
    }

    if (!simulacao.valido || simulacao.alocacoes.length === 0) {
      showErrorToast(simulacao.erro || "Verifique os valores informados para resgate.");
      return;
    }

    setIsSubmitting(true);
    try {
      // Payload formatado para a RPC PostgreSQL
      const payloadAlocacoes = simulacao.alocacoes.map((aloc) => ({
        aporte_id: aloc.aporte_id,
        principal_consumido: aloc.principal_consumido,
        valor_bruto_resgatado: aloc.valor_bruto_resgatado,
        rendimento_bruto: aloc.rendimento_bruto,
        ir_retido: aloc.ir_retido,
        valor_liquido: aloc.valor_liquido,
        aliquota_ir: aloc.aliquota_ir,
      }));

      const { data, error } = await (supabase.rpc as any)(
        "confirmar_resgate_investimento",
        {
          p_investimento_id: investment.id,
          p_tipo: tipoResgate,
          p_valor_liquido_solicitado: simulacao.valorLiquidoSolicitado,
          p_valor_bruto_total: simulacao.valorBrutoTotal,
          p_rendimento_bruto_total: simulacao.rendimentoBrutoTotal,
          p_ir_total: simulacao.irTotal,
          p_valor_liquido_total: simulacao.valorLiquidoTotal,
          p_alocacoes: payloadAlocacoes,
        }
      );

      if (error) throw error;

      // Invalidação em cadeia de todas as queries relacionadas
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["investments"] }),
        queryClient.invalidateQueries({ queryKey: ["investimentos"] }),
        queryClient.invalidateQueries({ queryKey: ["investments-aportes"] }),
        queryClient.invalidateQueries({ queryKey: ["investments-resgates"] }),
        queryClient.invalidateQueries({ queryKey: ["investments-resgates-aportes"] }),
        queryClient.invalidateQueries({ queryKey: ["globalReceivedIncome"] }),
      ]);

      const msg =
        tipoResgate === "total"
          ? `Investimento resgatado totalmente! ${formatCurrency(simulacao.valorLiquidoTotal)} creditado no Caixa Atual.`
          : `Resgate parcial de ${formatCurrency(simulacao.valorLiquidoTotal)} realizado com sucesso!`;

      showSuccessToast(msg);
      onOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      console.error("Erro ao confirmar resgate:", err);
      showErrorToast("Erro ao processar resgate", err.message || "Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent
        className={cn(
          isMobile
            ? "dialog-mobile w-[98%] max-w-[98%] !rounded-[22px] !px-3.5 !pb-4 max-h-[90vh] overflow-y-auto"
            : "sm:max-w-[460px] max-h-[90vh] overflow-y-auto !rounded-[22px] !p-5",
          "shadow-2xl border-none"
        )}
        style={{
          background: "linear-gradient(180deg, #FFFFFF 0%, #F9FAFB 100%)",
          border: "1px solid rgba(0,0,0,0.06)",
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,0.8), 0 25px 35px -5px rgba(0, 0, 0, 0.15)",
        }}
      >
        <AlertDialogHeader className="border-b border-slate-100 pb-2">
          <AlertDialogTitle className="flex items-center justify-start gap-2 text-lg font-black text-[#0556C3]">
            <span>💰</span>
            <span>Resgatar Investimento</span>
          </AlertDialogTitle>
          <AlertDialogDescription className="text-left text-xs text-slate-500 font-medium">
            {displayName} • Saldo disponível:{" "}
            <strong className="text-slate-800">{formatCurrency(saldoLiquidoDisponivel)}</strong>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3.5 pt-2">
          {/* Seletor Tipo de Resgate: Total vs Parcial (Pill Segmented Control) */}
          <div className="grid grid-cols-2 p-1 rounded-full bg-slate-100/80 border border-slate-200/50 gap-1">
            <button
              type="button"
              onClick={() => setTipoResgate("total")}
              className={cn(
                "py-2 px-3 text-xs sm:text-[13px] rounded-full transition-all duration-200 ease-in-out flex items-center justify-center select-none font-bold",
                tipoResgate === "total"
                  ? "bg-[#2463D9] !text-white shadow-sm"
                  : "bg-white text-slate-500 hover:text-slate-700 border border-slate-200/60"
              )}
            >
              Resgate Total
            </button>
            <button
              type="button"
              onClick={() => setTipoResgate("parcial")}
              className={cn(
                "py-2 px-3 text-xs sm:text-[13px] rounded-full transition-all duration-200 ease-in-out flex items-center justify-center select-none font-bold",
                tipoResgate === "parcial"
                  ? "bg-[#2463D9] !text-white shadow-sm"
                  : "bg-white text-slate-500 hover:text-slate-700 border border-slate-200/60"
              )}
            >
              Resgate Parcial
            </button>
          </div>

          {/* Campo de Valor no Resgate Parcial */}
          {tipoResgate === "parcial" && (
            <div className="space-y-1.5 bg-blue-50/50 p-3 rounded-xl border border-blue-100/70">
              <Label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                <span>Valor do Resgate</span>
                <span className="text-[10px] text-blue-600 font-normal">
                  (Após desconto de IR)
                </span>
              </Label>
              <CurrencyBR
                value={valorLiquidoDesejado}
                onChange={(val) => setValorLiquidoDesejado(val)}
                placeholder="R$ 0,00"
                className="w-full h-11 px-3 text-lg font-black rounded-xl border border-blue-200 bg-white shadow-inner focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
              <div className="flex justify-between items-center text-[10px] text-slate-500 pt-0.5">
                <span>Máximo disponível:</span>
                <button
                  type="button"
                  onClick={() => setValorLiquidoDesejado(saldoLiquidoDisponivel)}
                  className="font-bold text-blue-600 hover:underline"
                >
                  {formatCurrency(saldoLiquidoDisponivel)} (Tudo)
                </button>
              </div>
            </div>
          )}

          {/* Alerta de erro de validação (oculta erro de valor zero para não poluir o layout) */}
          {!simulacao.valido &&
            simulacao.erro &&
            simulacao.erro !== "Informe um valor de resgate maior que zero." && (
              <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs font-semibold">
                ⚠️ {simulacao.erro}
              </div>
            )}

          {/* Painel de Prévia do Resgate */}
          {simulacao.valido && simulacao.valorLiquidoTotal > 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-1.5 shadow-[inset_0_1px_3px_rgba(0,0,0,0.02)]">
              <div className="text-[10px] font-bold uppercase text-slate-400 tracking-wider border-b border-slate-200/60 pb-1 flex justify-between items-center">
                <span>Prévia da Operação</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-slate-500">Principal Consumido:</span>
                <span className="font-bold text-slate-700">
                  {formatCurrency(simulacao.principalTotalConsumido)}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-slate-500">Rendimento Bruto:</span>
                <span className="font-bold text-emerald-600">
                  +{formatCurrency(simulacao.rendimentoBrutoTotal)}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-slate-500">Imposto de Renda Retido:</span>
                <span className="font-bold text-red-500">
                  -{formatCurrency(simulacao.irTotal)}
                </span>
              </div>

              <div className="flex justify-between items-center border-t border-slate-200/60 pt-1.5">
                <span className="text-slate-700 font-bold">Valor Líquido a Receber:</span>
                <span className="text-base font-black text-[#0556C3]">
                  {formatCurrency(simulacao.valorLiquidoTotal)}
                </span>
              </div>
            </div>
          )}

          {/* Mensagem de destino do valor */}
          <p className="text-[11px] text-center text-slate-500 font-medium">
            {investment.origem_investimento === "saldo_atual"
              ? "O valor líquido será devolvido diretamente ao Caixa Atual."
              : "Operação registrada no histórico do investimento."}
          </p>
        </div>

        {/* Rodapé com botões perfeitamente alinhados e simétricos em Grid 2 colunas */}
        <div className="grid grid-cols-2 gap-2.5 w-full mt-3 pt-2 border-t border-slate-100 items-stretch">
          <AlertDialogCancel asChild>
            <Button
              type="button"
              disabled={isSubmitting}
              className="w-full !m-0 !mt-0 rounded-[14px] btn-3d font-black !text-slate-700 transition-all active:scale-95 text-[16px] sm:text-[18px] h-11 flex items-center justify-center border-none shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
              style={{ "--cor-topo": "#F1F5F9", "--cor-base": "#E2E8F0" } as any}
            >
              Cancelar
            </Button>
          </AlertDialogCancel>

          <AlertDialogAction asChild>
            <Button
              type="button"
              onClick={handleConfirmRescue}
              disabled={!isFormValid || isSubmitting}
              className={cn(
                "w-full !m-0 !mt-0 rounded-[14px] btn-3d font-black text-white border-none transition-all active:scale-95 text-[16px] sm:text-[18px] h-11 flex items-center justify-center shadow-md",
                !isFormValid && "opacity-50 cursor-not-allowed pointer-events-none"
              )}
              style={{ "--cor-topo": "#2563EB", "--cor-base": "#1D4ED8" } as any}
            >
              {isSubmitting ? "Processando..." : "Resgatar"}
            </Button>
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
};

