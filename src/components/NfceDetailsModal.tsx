import React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn, formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useIsMobile } from "@/hooks/use-mobile";

export interface NfceCompra {
  id: string;
  estabelecimento: string;
  cnpj: string;
  data_compra: string;
  valor_total: number;
  forma_pagamento: string;
  numero_parcelas: number;
  created_at: string;
}

export interface NfceItem {
  id: string;
  descricao: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
}

interface NfceDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  compraId?: string | null;
  compraData?: NfceCompra | null;
}

const formatDateTime = (isoDate: string) => {
  if (!isoDate) return "—";
  try {
    return format(new Date(isoDate), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  } catch {
    return isoDate;
  }
};

export const NfceDetailsModal: React.FC<NfceDetailsModalProps> = ({
  open,
  onOpenChange,
  compraId,
  compraData,
}) => {
  const isMobile = useIsMobile();

  // Query: Fetch compra by ID if data is not provided
  const { data: fetchedCompra, isLoading: isLoadingCompra } = useQuery<NfceCompra | null>({
    queryKey: ["nfceCompra", compraId],
    queryFn: async () => {
      if (!compraId) return null;
      const { data, error } = await (supabase as any)
        .from("nfce_compras")
        .select("id, estabelecimento, cnpj, data_compra, valor_total, forma_pagamento, numero_parcelas, created_at")
        .eq("id", compraId)
        .single();

      if (error) {
        console.error("[NFCE_MODAL] Erro ao buscar capa da nota:", error);
        return null;
      }
      return data;
    },
    enabled: !!compraId && !compraData && open,
  });

  const activeCompra = compraData || fetchedCompra;

  // Query: items for the viewed compra (lazy)
  const { data: viewItens = [], isLoading: isLoadingItens } = useQuery<NfceItem[]>({
    queryKey: ["nfceItens", activeCompra?.id],
    queryFn: async () => {
      if (!activeCompra?.id) return [];
      const { data, error } = await (supabase as any)
        .from("nfce_itens")
        .select("id, descricao, quantidade, valor_unitario, valor_total")
        .eq("compra_id", activeCompra.id);

      if (error) {
        console.error("[NFCE_MODAL] Erro ao buscar itens:", error);
        return [];
      }
      return data || [];
    },
    enabled: !!activeCompra?.id && open,
  });

  // Check if all necessary data is fully loaded before rendering the dialog
  const isFullyLoaded = (!isLoadingCompra || !!compraData) && (!activeCompra?.id || !isLoadingItens);
  const shouldOpen = open && isFullyLoaded;

  return (
    <Dialog open={shouldOpen} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "modal-detalhes-nota flex flex-col overflow-hidden",
          isMobile
            ? "dialog-mobile w-[99%] max-w-[99%] !px-4 p-4 !pb-4 !rounded-[20px] shadow-none border-none max-h-[85vh]"
            : "sm:max-w-[520px] !pb-4 !rounded-[20px] shadow-none border-none max-h-[85vh]"
        )}
        style={{
          background: "#FFFFFF",
          backdropFilter: "blur(6px)",
          border: "1px solid rgba(0,0,0,0.06)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.6), inset 0 -8px 20px rgba(0,0,0,0.02), 0 20px 25px -5px rgba(0, 0, 0, 0.1)",
          scrollbarWidth: 'none',
          msOverflowStyle: 'none'
        }}
      >
        <style>{`
          .overflow-y-auto::-webkit-scrollbar { display: none; }
          .modal-detalhes-nota > button.absolute { 
            top: 12px !important; 
            right: 14px !important;
            height: 26px !important;
            width: 26px !important;
          }
          .modal-detalhes-nota > button.absolute svg {
            height: 16px !important;
            width: 16px !important;
          }
        `}</style>
        <DialogHeader className="flex flex-row items-start gap-2 space-y-0 text-left shrink-0 pb-3 border-b border-[rgba(15,23,42,.08)]">
          <span className="text-xl leading-none" style={{ marginTop: '3px' }}>📄</span>
          <div className="flex flex-col gap-0.5">
            <DialogTitle className="text-lg font-extrabold text-[#04469E] leading-none">
              Detalhes da Nota
            </DialogTitle>
            <DialogDescription className="text-slate-500 text-xs">
              Nota fiscal importada via scanner
            </DialogDescription>
          </div>
        </DialogHeader>

        {isLoadingCompra && !compraData ? (
          <div className="space-y-4 mt-2">
            <div className="h-20 bg-slate-100 rounded-lg animate-pulse" />
            <div className="space-y-1.5">
              {[1, 2, 3].map(i => <div key={i} className="h-7 bg-slate-100 rounded-lg animate-pulse" />)}
            </div>
          </div>
        ) : activeCompra ? (
          <>
            <div className="space-y-3 shrink-0 -mt-2">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Estabelecimento</p>
                  <p className="text-[11px] font-semibold text-slate-700 truncate uppercase">
                    {activeCompra.estabelecimento || "Não Identificado"}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">CNPJ</p>
                  <p className="text-[11px] font-semibold text-slate-600">{activeCompra.cnpj || "—"}</p>
                </div>
              </div>

              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Data</p>
                  <p className="text-[11px] font-semibold text-slate-600">{formatDateTime(activeCompra.data_compra)}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Valor Total</p>
                  <p className="text-[11px] font-bold text-[#04469E]">{formatCurrency(activeCompra.valor_total)}</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col flex-1 min-h-0 mt-2">
              {isLoadingItens ? (
                <div className="space-y-1.5 mt-2 overflow-y-auto">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-7 bg-slate-100 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : viewItens.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-3 overflow-y-auto">
                  Nenhum produto encontrado.
                </p>
              ) : (
                <>
                  <div className="flex-1 overflow-y-auto mt-1 pr-1 pb-2">
                    <table className="w-full border-collapse" style={{ borderSpacing: 0 }}>
                      <thead className="sticky top-0 bg-[#F2F6FA] z-10 before:absolute before:inset-0 before:border-y before:border-[rgba(15,23,42,.12)] before:pointer-events-none">
                        <tr>
                          <th className="px-2 py-1.5 text-[10px] font-bold text-[#04469E] uppercase text-left font-sans">Descrição</th>
                          <th className="px-2 py-1.5 text-[10px] font-bold text-[#04469E] uppercase text-right w-[32px] font-sans">Qtd</th>
                          <th className="px-2 py-1.5 text-[10px] font-bold text-[#04469E] uppercase text-right w-[52px] font-sans">V.Unit</th>
                          <th className="px-2 py-1.5 text-[10px] font-bold text-[#04469E] uppercase text-right w-[56px] font-sans">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {viewItens.map((item, idx) => {
                          let cleanDesc = item.descricao.replace(/Vl\.?\s*Total.*/i, '').replace(/Valor\s*Total.*/i, '').trim();
                          cleanDesc = cleanDesc.replace(/\s+(?:R\$)?\s*\d+[,.]\d{2}\s*$/i, '').trim();
                          const strUnit = formatCurrency(item.valor_unitario).replace('R$', '').trim();
                          const strTotal = formatCurrency(item.valor_total).replace('R$', '').trim();
                          if (cleanDesc.endsWith(strTotal)) cleanDesc = cleanDesc.slice(0, -strTotal.length).trim();
                          if (cleanDesc.endsWith(strUnit)) cleanDesc = cleanDesc.slice(0, -strUnit.length).trim();
                          cleanDesc = cleanDesc.replace(/\s+(?:UN|KG|L|ML|CX|PC)$/i, '').trim();
                          
                          return (
                            <tr
                              key={item.id || idx}
                              className="even:bg-[#EDF4FF] odd:bg-white"
                            >
                              <td className="px-2 py-1.5 text-[11px] font-medium text-[#334155]">
                                <div className="truncate max-w-[130px] sm:max-w-[200px]" title={cleanDesc}>
                                  {cleanDesc}
                                </div>
                              </td>
                              <td className="px-2 py-1.5 text-[11px] font-semibold text-[#334155] text-right">
                                {String(item.quantidade).replace(/^0[.,]/, '')}
                              </td>
                              <td className="px-2 py-1.5 text-[11px] font-semibold text-[#1E293B] text-right">
                                {formatCurrency(item.valor_unitario).replace('R$', '').trim()}
                              </td>
                              <td className="px-2 py-1.5 text-[11px] font-semibold text-[#1E293B] text-right">
                                {formatCurrency(item.valor_total).replace('R$', '').trim()}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};
