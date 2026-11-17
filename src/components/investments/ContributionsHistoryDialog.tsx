import React, { useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import DynamicIcon from "@/components/DynamicIcon";
import { Investment, InvestmentConsolidatedMetrics } from "@/types/finance";
import { formatCurrency, cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ContributionsHistoryDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  investment: Investment | null;
  consolidated: InvestmentConsolidatedMetrics | null;
  categoryName?: string;
  categoryIcon?: string;
  isMobile?: boolean;
}

export const ContributionsHistoryDialog: React.FC<ContributionsHistoryDialogProps> = ({
  isOpen,
  onOpenChange,
  investment,
  consolidated,
  categoryName,
  categoryIcon,
  isMobile = false,
}) => {
  if (!investment || !consolidated) return null;

  const lotes = consolidated.lotes;
  const displayName = categoryName || investment.nome;

  // Ordenação decrescente: aportes mais recentes no topo
  const lotesOrdenados = useMemo(() => {
    return [...lotes].sort((a, b) => {
      const dataA = a.aporte.data_aporte;
      const dataB = b.aporte.data_aporte;
      if (dataA !== dataB) {
        return dataB.localeCompare(dataA);
      }
      const createdA = a.aporte.created_at || "";
      const createdB = b.aporte.created_at || "";
      return createdB.localeCompare(createdA);
    });
  }, [lotes]);

  const formatarDataAporte = (dateStr: string) => {
    try {
      const [year, month, day] = dateStr.split("T")[0].split("-").map(Number);
      const dateObj = new Date(year, month - 1, day);
      const raw = format(dateObj, "dd MMM yyyy", { locale: ptBR });
      return raw
        .replace(/\./g, "")
        .split(" ")
        .map((p, idx) => (idx === 1 ? p.charAt(0).toUpperCase() + p.slice(1) + "." : p))
        .join(" ");
    } catch {
      return dateStr;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          isMobile
            ? "dialog-mobile w-[98%] max-w-[98%] !rounded-[22px] !px-3.5 !pb-4 max-h-[85vh] overflow-y-auto history-modal-scroll"
            : "sm:max-w-[500px] max-h-[85vh] overflow-y-auto !rounded-[22px] !p-5",
          "shadow-xl border-none"
        )}
        style={{
          background: "linear-gradient(180deg, #FBFCFE 0%, #F6F8FB 100%)",
          border: "1px solid rgba(0,0,0,0.06)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.8), 0 20px 25px -5px rgba(0, 0, 0, 0.1)",
        }}
      >
        <style>{`
          .history-modal-scroll::-webkit-scrollbar {
            display: none !important;
            width: 0px !important;
            height: 0px !important;
          }
          .history-modal-scroll {
            -ms-overflow-style: none !important;
            scrollbar-width: none !important;
          }
        `}</style>

        {/* Cabeçalho Padronizado: Ícone original + Nome em destaque + Quantidade de aportes */}
        <DialogHeader className="flex flex-row items-center justify-start gap-2.5 pb-2 border-b border-slate-100">
          <div
            className="flex items-center justify-center shrink-0 rounded-[12px] h-[38px] w-[38px]"
            style={{ backgroundColor: "#F6F8FA" }}
          >
            <DynamicIcon
              name={categoryIcon || "TrendingUp"}
              className="text-primary/80 leading-none h-8 w-8 text-[28px]"
              style={{ filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.15))" }}
            />
          </div>
          <div className="flex flex-col text-left min-w-0">
            <DialogTitle
              className="text-lg font-bold text-slate-800 leading-tight truncate"
              style={{ fontFamily: "'Inter', sans-serif" }}
            >
              {displayName}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 font-medium leading-normal mt-0.5">
              {lotes.length} {lotes.length === 1 ? "aporte" : "aportes"}
            </DialogDescription>
          </div>
        </DialogHeader>

        {/* Lista de Aportes (Lotes) em ordem decrescente com Scroll Invisível no Mobile */}
        <div className="space-y-2 mt-0.5 max-h-[58vh] overflow-y-auto history-modal-scroll pr-0.5">
          {lotesOrdenados.length === 0 ? (
            <p className="text-center text-slate-400 py-6 text-sm">
              Nenhum aporte encontrado.
            </p>
          ) : (
            lotesOrdenados.map((lote) => {
              const dataFormatada = formatarDataAporte(lote.aporte.data_aporte);
              const aliquotaStr = String(lote.aliquotaAplicada).replace(".", ",");

              // Definição de texto e cor do Status (sem badges, apenas texto semibold)
              let statusText = "Integral";
              let statusColor = "text-emerald-600";

              if (lote.isEsgotado) {
                statusText = "Esgotado";
                statusColor = "text-red-500";
              } else if (lote.principalJaResgatado > 0) {
                statusText = "Parcial";
                statusColor = "text-amber-500";
              }

              return (
                <div
                  key={lote.aporte.id}
                  className={cn(
                    "px-3 py-2.5 rounded-xl border transition-all text-xs bg-white shadow-sm flex flex-col gap-1",
                    lote.isEsgotado
                      ? "opacity-60 border-slate-200 bg-slate-50/50"
                      : "border-slate-200/80 hover:border-blue-200"
                  )}
                >
                  {/* Linha 1: [Ícone Calendário] Data e Valor Original à direita */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-semibold text-[#0556C3] text-[13px] sm:text-sm">
                      <DynamicIcon name="Calendar" className="h-3.5 w-3.5 text-[#0556C3] shrink-0" />
                      <span>{dataFormatada}</span>
                    </div>
                    <div className="font-semibold text-slate-700 text-[13px] sm:text-sm text-right">
                      {formatCurrency(lote.principalOriginal)}
                    </div>
                  </div>

                  {/* Linha 2: 3 Colunas (Resgatado, Remanescente, Status) */}
                  <div className="grid grid-cols-3 gap-2 pt-0.5 text-[11px] items-center">
                    <div className="flex flex-col text-left">
                      <span className="text-[11px] text-slate-400 font-medium">
                        Resgatado
                      </span>
                      <span className="font-bold text-slate-700 text-xs">
                        {formatCurrency(lote.principalJaResgatado)}
                      </span>
                    </div>
                    <div className="flex flex-col text-center">
                      <span className="text-[11px] text-slate-400 font-medium">
                        Remanescente
                      </span>
                      <span className="font-bold text-slate-700 text-xs">
                        {formatCurrency(lote.principalRemanescente)}
                      </span>
                    </div>
                    <div className="flex flex-col text-right">
                      <span className="text-[11px] text-slate-400 font-medium">
                        Status
                      </span>
                      <span className={cn("font-semibold text-xs text-right block", statusColor)}>
                        {statusText}
                      </span>
                    </div>
                  </div>

                  {/* Linha 3: Demais Informações Financeiras (Rend. Líquido, IR, Saldo líquido) */}
                  {!lote.isEsgotado && (
                    <div className="grid grid-cols-3 gap-2 pt-0.5 text-[11px] items-center">
                      <div className="flex flex-col text-left">
                        <span className="text-[11px] text-slate-400 font-medium">
                          Rend. Líquido
                        </span>
                        <span className="font-bold text-emerald-600 text-xs">
                          +{formatCurrency(lote.rendimentoLiquido)}
                        </span>
                      </div>
                      <div className="flex flex-col text-center">
                        <span className="text-[11px] text-slate-400 font-medium">
                          IR ({aliquotaStr}%)
                        </span>
                        <span className="font-bold text-red-500 text-xs">
                          -{formatCurrency(lote.irProvisionado)}
                        </span>
                      </div>
                      <div className="flex flex-col text-right">
                        <span className="text-[11px] text-slate-400 font-medium">
                          Saldo líquido
                        </span>
                        <span className="font-black text-[#0556C3] text-xs">
                          {formatCurrency(lote.saldoLiquido)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Rodapé Padronizado com o botão Fechar do Modal de Detalhes */}
        <div className="pt-3 border-t border-slate-100 flex justify-end">
          <Button
            type="button"
            onClick={() => onOpenChange(false)}
            className="w-full rounded-[14px] btn-3d font-black !text-[#1E40AF] transition-all active:scale-95 text-[17px] sm:text-[19px] h-11 flex items-center justify-center !border-[1px] !border-[#A5B4FC]/40 shadow-[inset_0_2px_2px_rgba(255,255,255,0.8),inset_1.5px_0_1.5px_rgba(255,255,255,0.4),inset_-1.5px_0_1.5px_rgba(255,255,255,0.4),0_1px_2px_rgba(0,0,0,0.03)]"
            style={{ "--cor-topo": "#C7D2FE", "--cor-base": "#A5B4FC" } as any}
          >
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
