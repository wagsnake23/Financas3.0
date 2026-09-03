import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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
import DynamicIcon from "@/components/DynamicIcon";
import { CheckCircle2 } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { useToast } from "@/contexts/ToastContext";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { NfceDetailsModal } from "./NfceDetailsModal";

interface NfceCompra {
  id: string;
  estabelecimento: string;
  cnpj: string;
  data_compra: string;
  valor_total: number;
  forma_pagamento: string;
  numero_parcelas: number;
  created_at: string;
}

interface NfceItem {
  id: string;
  descricao: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
}

interface NfcePendentesProps {
  user: User | null;
  isMobile: boolean;
  onRegistrar: (compra: NfceCompra) => void;
  pendentesCount?: number;
  limite?: number;
}

export const NfcePendentes: React.FC<NfcePendentesProps> = ({
  user,
  isMobile,
  onRegistrar,
  pendentesCount: pendentesCountProp,
  limite = 10,
}) => {
  const { showSuccessToast, showErrorToast } = useToast();
  const queryClient = useQueryClient();

  // State for modals
  const [viewCompra, setViewCompra] = useState<NfceCompra | null>(null);
  const [deleteCompra, setDeleteCompra] = useState<NfceCompra | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Query: pending NFC-es
  const { data: pendentes = [], isLoading } = useQuery<NfceCompra[]>({
    queryKey: ["nfcePendentes", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await (supabase as any)
        .from("nfce_compras")
        .select("id, estabelecimento, cnpj, data_compra, valor_total, forma_pagamento, numero_parcelas, created_at")
        .eq("user_id", user.id)
        .eq("status_importacao", "pendente")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("[NFCE_PENDENTES] Erro ao buscar:", error);
        return [];
      }
      return data || [];
    },
    enabled: !!user,
  });



  // Delete handler
  const handleDelete = async () => {
    if (!deleteCompra) return;
    setIsDeleting(true);
    try {
      const { error } = await (supabase as any)
        .from("nfce_compras")
        .delete()
        .eq("id", deleteCompra.id);

      if (error) throw error;

      showSuccessToast("Sucesso", "Nota fiscal excluída com sucesso.");
      queryClient.invalidateQueries({ queryKey: ["nfcePendentes"] });
      queryClient.invalidateQueries({ queryKey: ["nfcePendentesCount"] });
      setDeleteCompra(null);
    } catch (err: any) {
      console.error("[NFCE_PENDENTES] Erro ao excluir:", err);
      showErrorToast("Erro", "Não foi possível excluir a nota fiscal.");
    } finally {
      setIsDeleting(false);
    }
  };

  // Format date helper
  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  const formatDateTime = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  // Map forma_pagamento for display
  const formatFormaPagamento = (fp: string) => {
    if (!fp) return "—";
    const lower = fp.toLowerCase();
    if (lower.includes("cart") || lower.includes("créd") || lower.includes("cred")) return "Cartão";
    if (lower.includes("pix")) return "PIX";
    if (lower.includes("dinheiro")) return "Dinheiro";
    return fp;
  };

  // Don't render if loading or no user
  if (!user) return null;

  // Loading skeleton
  if (isLoading) {
    return (
      <Card
        className={cn(
          "rounded-[18px] shadow-sm border border-[rgba(15,23,42,0.10)]",
          isMobile ? "p-4" : "p-6"
        )}
        style={{ backgroundColor: "#FFFFFF" }}
      >
        <div className="flex items-center gap-2 mb-4">
          <span className="text-lg">🧾</span>
          <div className="h-5 w-48 bg-slate-200 rounded animate-pulse" />
        </div>
        <div className="space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />
          ))}
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card
        className={cn(
          "rounded-[18px] shadow-sm border border-[rgba(15,23,42,0.10)]",
          isMobile ? "p-4" : "p-6"
        )}
        style={{ backgroundColor: "#FFFFFF" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-lg">🧾</span>
            <h2
              className={cn(
                "font-extrabold tracking-[0.2px] text-slate-800 m-0 leading-none",
                isMobile ? "text-base" : "text-lg"
              )}
              style={{ fontFamily: "'Inter', sans-serif" }}
            >
              Notas Fiscais Pendentes
              <span className={cn(
                "font-bold ml-1",
                (pendentesCountProp ?? pendentes.length) >= limite ? "text-red-500" : "text-slate-400"
              )}>
                ({pendentesCountProp ?? pendentes.length}/{limite})
              </span>
            </h2>
          </div>
          {(pendentesCountProp ?? pendentes.length) >= limite && (
            <Badge
              className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100 text-[10px] font-black uppercase tracking-wider px-2 py-0.5"
            >
              🔴 Limite atingido
            </Badge>
          )}
        </div>

        {/* Empty state */}
        {pendentes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-3 gap-1">
            <div className="flex items-center gap-1.5 text-emerald-500 font-bold">
              <CheckCircle2 className="h-4 w-4" strokeWidth={3} />
              <span className="text-sm">Tudo em dia</span>
            </div>
            <p className="text-xs text-slate-400 font-medium text-center mt-1">
              Nenhuma nota fiscal aguardando processamento.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {pendentes.map((compra) => (
              <div
                key={compra.id}
                className={cn(
                  "rounded-xl border border-slate-200/80 bg-slate-50/50 transition-all",
                  isMobile ? "p-3" : "p-4"
                )}
              >
                {/* Mini-card content */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      "font-bold text-slate-700 truncate leading-tight",
                      isMobile ? "text-[13px]" : "text-sm"
                    )}>
                      {compra.estabelecimento || "Estabelecimento Não Identificado"}
                    </p>
                    <div className={cn(
                      "flex items-center gap-2 mt-1 flex-wrap",
                      isMobile ? "gap-1.5" : "gap-2"
                    )}>
                      <span className={cn(
                        "text-slate-400 flex items-center gap-1",
                        isMobile ? "text-[11px]" : "text-xs"
                      )}>
                        <DynamicIcon name="Calendar" className="h-3 w-3" strokeWidth={2} />
                        {formatDate(compra.data_compra)}
                      </span>
                      {compra.forma_pagamento && (
                        <span className={cn(
                          "text-slate-400 flex items-center gap-1",
                          isMobile ? "text-[11px]" : "text-xs"
                        )}>
                          <DynamicIcon name="CreditCard" className="h-3 w-3" strokeWidth={2} />
                          {formatFormaPagamento(compra.forma_pagamento)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Valor */}
                  <div className="text-right shrink-0">
                    <p className={cn(
                      "font-extrabold text-slate-800",
                      isMobile ? "text-[13px]" : "text-sm"
                    )}>
                      {formatCurrency(compra.valor_total)}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className={cn(
                  "flex items-center gap-1.5 mt-2.5 pt-2.5 border-t border-slate-200/60",
                  isMobile ? "gap-1" : "gap-1.5"
                )}>
                  {/* Visualizar */}
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "flex-1 h-8 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-all font-semibold gap-1",
                      isMobile ? "text-[11px]" : "text-xs"
                    )}
                    onClick={() => setViewCompra(compra)}
                  >
                    <DynamicIcon name="Eye" className="h-3.5 w-3.5" strokeWidth={2.5} />
                    Visualizar
                  </Button>

                  {/* Registrar */}
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "flex-1 h-8 rounded-lg text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 transition-all font-bold gap-1",
                      isMobile ? "text-[11px]" : "text-xs"
                    )}
                    onClick={() => onRegistrar(compra)}
                  >
                    <DynamicIcon name="SquarePen" className="h-3.5 w-3.5" strokeWidth={2.5} />
                    Registrar
                  </Button>

                  {/* Excluir */}
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "h-8 w-8 p-0 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all",
                    )}
                    onClick={() => setDeleteCompra(compra)}
                  >
                    <DynamicIcon name="Trash2" className="h-3.5 w-3.5" strokeWidth={2.5} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ═══ MODAL: Visualizar Nota ═══ */}
      <NfceDetailsModal 
        open={!!viewCompra} 
        onOpenChange={(open) => !open && setViewCompra(null)} 
        compraData={viewCompra} 
      />

      {/* ═══ ALERT: Confirmar Exclusão ═══ */}
      <AlertDialog open={!!deleteCompra} onOpenChange={(open) => !open && setDeleteCompra(null)}>
        <AlertDialogContent
          className={cn(
            isMobile
              ? "dialog-mobile w-[99%] max-w-[99%] !px-4 p-4 !pb-4 min-h-[180px] !rounded-[20px] shadow-none border-none"
              : "sm:max-w-[425px] !pb-4 !rounded-[20px] shadow-none border-none"
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
              Excluir Nota Fiscal
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              A nota fiscal de{" "}
              <span className="font-bold text-foreground">
                "{deleteCompra?.estabelecimento || "Estabelecimento"}"
              </span>{" "}
              no valor de{" "}
              <span className="font-bold text-foreground">
                {formatCurrency(deleteCompra?.valor_total)}
              </span>{" "}
              será excluída permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter
            className={cn(
              "flex flex-col sm:flex-row justify-center gap-2",
              isMobile && "flex-row items-center justify-between"
            )}
          >
            <AlertDialogCancel
              className={cn(
                "flex-1 rounded-xl btn-3d font-black !text-[#1E40AF] border-none transition-all active:scale-95 shadow-[0_2px_4px_rgba(0,0,0,0.05)] text-lg mt-0 h-11",
                isMobile && "h-11 text-lg"
              )}
              style={{ "--cor-topo": "#E0E7FF", "--cor-base": "#C7D2FE" } as any}
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className={cn(
                "flex-1 rounded-2xl btn-3d font-black text-white border-none transition-all active:scale-95 shadow-[0_2px_4px_rgba(0,0,0,0.05)] text-lg h-11",
                isMobile && "h-12 text-lg"
              )}
              style={{ "--cor-topo": "#FF6B6B", "--cor-base": "#E54D4D" } as any}
            >
              {isDeleting ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
