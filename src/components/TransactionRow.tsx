import React, { memo, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { Transaction, AppCategory } from "@/types/finance";
import DynamicIcon from "./DynamicIcon";
import { cn } from "@/lib/utils";
import { Tables } from "@/integrations/supabase/types";
import { format } from "date-fns";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface Cartao {
  id: string;
  nome: string;
  banco: string;
  ultimos_digitos: string;
  dia_fechamento: number;
  dia_vencimento: number;
}

interface TransactionRowProps {
  transaction: Transaction;
  onDeleteTransaction: (
    id: string,
    type: "income" | "expense",
    isFixed?: boolean
  ) => void;
  onEditTransaction: (transaction: Transaction) => void;
  allCategories: AppCategory[];
  cartoes: Tables<"cartoes">[];
  isMobile?: boolean;
  queryClient: ReturnType<typeof useQueryClient>;
  user: User | null;
  markMonthPaid: any;
}

const isValidUuid = (uuid: string) => {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

const TransactionRow: React.FC<TransactionRowProps> = ({
  transaction,
  onEditTransaction,
  allCategories,
  cartoes,
  isMobile,
  queryClient,
  user,
  markMonthPaid,
}) => {
  // ⭐⭐⭐ ESTADO LOCAL COMPLETO + STATUS CONTROLADO ⭐⭐⭐
  const [localTransaction, setLocalTransaction] = useState(transaction);

  // ⛔ NÃO sobrescrevemos o status ao receber refetch
  useEffect(() => {
    setLocalTransaction((prev) => ({
      ...prev,
      ...transaction,
      status: prev.status, // preserva o status local
    }));
  }, [transaction.id]); // só sincroniza quando muda a linha

  const getCategoryDisplay = (categoryId: string) => {
    const category = allCategories.find((cat) => cat.id === categoryId);
    return {
      name: category?.nome || categoryId,
      icon: category?.icone || null,
    };
  };

  const { name: categoryName, icon: categoryIcon } = getCategoryDisplay(
    localTransaction.category
  );

  const getPaymentMethodDisplay = (
    formaPagamento: string | null,
    cartaoId: string | null
  ) => {
    if (!formaPagamento) return null;

    switch (formaPagamento) {
      case "dinheiro":
        return "Dinheiro";
      case "pix":
        return "PIX";
      case "boleto":
        return "Boleto";
      case "cartao":
        const card = cartoes.find((c) => c.id === cartaoId);
        return card
          ? `Cartão: ${card.nome} (****${card.ultimos_digitos})`
          : "Cartão";
      default:
        return formaPagamento;
    }
  };

  const paymentMethodDisplay = getPaymentMethodDisplay(
    localTransaction.forma_pagamento,
    localTransaction.cartao_id
  );

  // 🔄 TOGGLE STATUS – FUNCIONA SEM "VOLTAR ATRÁS"
  const handleToggleStatus = async () => {
    if (!user) {
      toast.error("Usuário não autenticado.");
      return;
    }

    const newStatus =
      localTransaction.status === "Recebida" ? "Pendente" : "Recebida";

    // ---------------------------------------------
    // 🔁 RECORRENTE
    // ---------------------------------------------
    if (localTransaction.isRecurring && localTransaction.recurringEntryId) {
      try {
        const d = new Date(localTransaction.date);
        const year = d.getFullYear();
        const month = d.getMonth() + 1;

        await markMonthPaid({
          recurring_id: localTransaction.recurringEntryId,
          year,
          month,
          is_paid: newStatus === "Recebida",
        });

        // ⭐ Atualização instantânea sem esperar refetch
        setLocalTransaction((prev) => ({
          ...prev,
          status: newStatus,
        }));

        toast.success("Status atualizado!");
        return;
      } catch (error) {
        console.error(error);
        toast.error("Erro ao atualizar recorrente.");
        return;
      }
    }

    // ---------------------------------------------
    // 💸 AVULSA / PARCELADA
    // ---------------------------------------------
    let updateError: any = null;

    if (localTransaction.type === "income") {
      const { error } = await supabase
        .from("receitas")
        .update({ status: newStatus })
        .eq("id", localTransaction.id)
        .eq("user_id", user.id);

      updateError = error;
    } else {
      const pago = newStatus === "Recebida";
      const dataPagamento = pago
        ? format(new Date(), "yyyy-MM-dd HH:mm:ss")
        : null;

      const { error } = await supabase
        .from("despesas_parcelas")
        .update({
          pago,
          data_pagamento: dataPagamento,
        })
        .eq("id", localTransaction.id);

      updateError = error;
    }

    if (updateError) {
      console.error(updateError);
      toast.error("Erro ao atualizar status.");
      return;
    }

    // ⭐⭐⭐ Status local atualizado permanentemente
    setLocalTransaction((prev) => ({
      ...prev,
      status: newStatus,
    }));

    toast.success("Status atualizado!");
  };

  return (
    <TableRow
      key={localTransaction.id}
      className={cn(
        localTransaction.status === "Recebida" &&
          "bg-soft-green/30 hover:bg-soft-green/50",
        (localTransaction.status === "Pendente" ||
          localTransaction.status === "Prevista") &&
          "bg-soft-red/30 hover:bg-soft-red/50",
        localTransaction.status === "Cancelada" &&
          "bg-muted/20 hover:bg-muted/40 text-muted-foreground"
      )}
    >
      {/* DATA */}
      <TableCell className="py-2 px-2 text-xs min-w-[70px]">
        {(() => {
          const [y, m, d] = localTransaction.date.split("-").map(Number);
          return new Date(y, m - 1, d).toLocaleDateString("pt-BR");
        })()}
      </TableCell>

      {/* TIPO */}
      {!isMobile && (
        <TableCell className="py-2 px-2 text-xs min-w-[60px]">
          <span
            className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
              localTransaction.type === "income"
                ? "bg-success/10 text-success"
                : "bg-destructive/10 text-destructive"
            }`}
          >
            {localTransaction.type === "income" ? "Receita" : "Despesa"}
          </span>
        </TableCell>
      )}

      {/* SUBCATEGORIA */}
      <TableCell className="py-2 px-2 text-xs min-w-[80px] flex items-center gap-1">
        {categoryIcon && (
          <DynamicIcon name={categoryIcon} className="h-4 w-4" />
        )}
        <span>{categoryName}</span>
      </TableCell>

      {/* DESCRIÇÃO */}
      {!isMobile && (
        <TableCell className="py-2 px-2 text-xs min-w-[100px]">
          {localTransaction.installmentNumber &&
          localTransaction.totalInstallments &&
          localTransaction.totalInstallments > 1
            ? `Parcela ${localTransaction.installmentNumber} de ${localTransaction.totalInstallments}`
            : localTransaction.description || "-"}

          {paymentMethodDisplay && (
            <span className="block text-xs text-muted-foreground mt-0.5">
              {paymentMethodDisplay}
            </span>
          )}
        </TableCell>
      )}

      {/* VALOR */}
      <TableCell
        className={`py-2 px-2 text-right font-semibold text-xs min-w-[80px] ${
          localTransaction.type === "income"
            ? "text-success"
            : "text-destructive"
        }`}
      >
        {localTransaction.type === "income" ? "+" : "-"}
        R$ {localTransaction.amount.toFixed(2)}
      </TableCell>

      {/* TOGGLE */}
      <TableCell className="py-2 px-2 text-center min-w-[50px]">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={handleToggleStatus}
          disabled={localTransaction.status === "Cancelada"}
        >
          {localTransaction.status === "Recebida" && (
            <DynamicIcon name="CheckCircle" className="h-4 w-4 text-success" />
          )}
          {(localTransaction.status === "Pendente" ||
            localTransaction.status === "Prevista") && (
            <DynamicIcon name="Circle" className="h-4 w-4 text-destructive" />
          )}
          {localTransaction.status === "Cancelada" && (
            <DynamicIcon
              name="XCircle"
              className="h-4 w-4 text-muted-foreground"
            />
          )}
        </Button>
      </TableCell>

      {/* AÇÕES */}
      <TableCell className="py-2 px-2 text-right min-w-[50px]">
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onEditTransaction(localTransaction)}
          >
            <DynamicIcon name="Pencil" className="h-3.5 w-3.5 text-primary" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
};

export default memo(TransactionRow);
