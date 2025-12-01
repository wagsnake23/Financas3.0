import React, { useState, useMemo, useEffect } from "react";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import DynamicIcon from "./DynamicIcon";
import { cn, isValidUuid, formatCurrency } from "@/lib/utils"; // Importar formatCurrency
import { Tables } from "@/integrations/supabase/types";
import { format, isWithinInterval, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface MobileCreditCardExpensesProps {
  cartoes: Tables<"cartoes">[];
  expenseInstallments: (Tables<"despesas_parcelas"> & {
    despesas: Pick<
      Tables<"despesas">,
      | "id"
      | "categoria_id"
      | "user_id"
      | "descricao"
      | "forma_pagamento"
      | "tipo_pagamento"
      | "cartao_id"
    > | null;
  })[];
  allCategories: AppCategory[];
  isMobile: boolean;
  selectedMonth: Date;
}

const UNSELECTED_VALUE = "unselected";

export const MobileCreditCardExpenses: React.FC<
  MobileCreditCardExpensesProps
> = ({
  cartoes,
  expenseInstallments,
  allCategories,
  isMobile,
  selectedMonth,
}) => {
  const navigate = useNavigate();
  const [selectedCardId, setSelectedCardId] =
    useState<string>(UNSELECTED_VALUE);

  useEffect(() => {
    if (cartoes.length > 0 && selectedCardId === UNSELECTED_VALUE) {
      setSelectedCardId(cartoes[0].id);
    } else if (cartoes.length === 0 && selectedCardId !== UNSELECTED_VALUE) {
      setSelectedCardId(UNSELECTED_VALUE);
    }
  }, [cartoes, selectedCardId]);

  const filteredExpenses = useMemo(() => {
    if (selectedCardId === UNSELECTED_VALUE) return [];

    const monthStart = startOfMonth(selectedMonth);
    const monthEnd = endOfMonth(selectedMonth);

    return expenseInstallments
      .filter(
        (p) =>
          p.despesas?.forma_pagamento === "cartao" &&
          p.despesas.cartao_id === selectedCardId
      )
      .filter((p) =>
        isWithinInterval(new Date(p.vencimento), {
          start: monthStart,
          end: monthEnd,
        })
      )
      .sort(
        (a, b) =>
          new Date(a.vencimento).getTime() - new Date(b.vencimento).getTime()
      );
  }, [expenseInstallments, selectedCardId, selectedMonth]);

  const { totalPaid, totalPending, totalCardExpenses } = useMemo(() => {
    let paid = 0;
    let pending = 0;
    filteredExpenses.forEach((installment) => {
      if (installment.pago) {
        paid += installment.valor_parcela;
      } else {
        pending += installment.valor_parcela;
      }
    });
    return {
      totalPaid: paid,
      totalPending: pending,
      totalCardExpenses: paid + pending,
    };
  }, [filteredExpenses]);

  const handlePayMonthlyBill = () => {
    if (!selectedCardId || selectedCardId === UNSELECTED_VALUE) return;
    const formattedMonth = format(selectedMonth, "yyyy-MM-dd");
    navigate(`/lancamentos?cardId=${selectedCardId}&month=${formattedMonth}`);
  };

  if (!isMobile) return null;

  return (
    <Card
      className={cn(
        "p-4 animate-fade-in rounded-3xl card-3d",
        isMobile && "p-3"
      )}
      style={{ backgroundColor: "#F7F2FF" }} // 💜 lilás suave aplicado
    >
      <h2
        className={cn(
          "text-lg font-bold mb-2",
          isMobile &&
            "text-xs font-semibold text-muted-foreground font-roboto mt-0"
        )}
      >
        Cartões de Crédito
      </h2>

      <div className={cn("space-y-2", isMobile && "space-y-2")}>
        {cartoes.length === 0 ? (
          <p className="text-muted-foreground text-center py-2 text-sm">
            Nenhum cartão de crédito cadastrado.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            <Select
              value={selectedCardId}
              onValueChange={setSelectedCardId}
              className={cn("rounded-xl w-full", isMobile && "h-9 text-sm")}
            >
              <SelectTrigger
                className={cn("rounded-xl w-full", isMobile && "h-9 text-sm")}
              >
                <SelectValue placeholder="Selecione um cartão" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  value={UNSELECTED_VALUE}
                  disabled
                  className={cn(isMobile && "text-sm")}
                >
                  Selecione um cartão
                </SelectItem>
                {cartoes.map((card) => (
                  <SelectItem
                    key={card.id}
                    value={card.id}
                    className={cn(isMobile && "text-sm")}
                  >
                    {card.nome} (****{card.ultimos_digitos})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              className={cn(
                "btn-3d",
                "rounded-xl w-full",
                isMobile ? "h-9 text-sm" : "w-auto px-4 h-9 text-xs"
              )}
              style={
                {
                  "--cor-topo": "#B27CFF",
                  "--cor-base": "#7B4ED6",
                } as React.CSSProperties
              }
              onClick={handlePayMonthlyBill}
              disabled={!selectedCardId || selectedCardId === UNSELECTED_VALUE}
            >
              <>
                <DynamicIcon
                  name="CreditCard"
                  className={cn("h-4 w-4", isMobile && "h-3.5 w-3.5")}
                />
                <span className="ml-2">Ver Fatura</span>
              </>
            </Button>
          </div>
        )}

        {selectedCardId !== UNSELECTED_VALUE && (
          <div
            className={cn(
              "grid grid-cols-3 gap-2 text-center mt-2",
              isMobile && "gap-1 mt-1"
            )}
          >
            <div
              className={cn(
                "flex flex-col items-center justify-center p-1",
                isMobile && "p-0.5"
              )}
            >
              <DynamicIcon
                name="CheckCircle"
                className={cn(
                  "h-5 w-5 text-success mb-1",
                  isMobile && "h-4 w-4 mb-0.5"
                )}
              />
              <p
                className={cn(
                  "text-xs text-muted-foreground",
                  isMobile && "text-[0.6rem]"
                )}
              >
                Pago
              </p>
              <p
                className={cn(
                  "text-sm font-bold text-success",
                  isMobile && "text-xs"
                )}
              >
                {formatCurrency(totalPaid)}
              </p>
            </div>
            <div
              className={cn(
                "flex flex-col items-center justify-center p-1",
                isMobile && "p-0.5"
              )}
            >
              <DynamicIcon
                name="Circle"
                className={cn(
                  "h-5 w-5 text-destructive mb-1",
                  isMobile && "h-4 w-4 mb-0.5"
                )}
              />
              <p
                className={cn(
                  "text-xs text-muted-foreground",
                  isMobile && "text-[0.6rem]"
                )}
              >
                Pendente
              </p>
              <p
                className={cn(
                  "text-sm font-bold text-destructive",
                  isMobile && "text-xs"
                )}
              >
                {formatCurrency(totalPending)}
              </p>
            </div>
            <div
              className={cn(
                "flex flex-col items-center justify-center p-1",
                isMobile && "p-0.5"
              )}
            >
              <DynamicIcon
                name="CreditCard"
                className={cn(
                  "h-5 w-5 text-foreground mb-1",
                  isMobile && "h-4 w-4 mb-0.5"
                )}
              />
              <p
                className={cn(
                  "text-xs text-muted-foreground",
                  isMobile && "text-[0.6rem]"
                )}
              >
                Total Mês
              </p>
              <p
                className={cn(
                  "text-sm font-bold text-foreground",
                  isMobile && "text-xs"
                )}
              >
                {formatCurrency(totalCardExpenses)}
              </p>
            </div>
          </div>
        )}
        {selectedCardId !== UNSELECTED_VALUE &&
          filteredExpenses.length === 0 && (
            <p className="text-muted-foreground text-center py-2 text-sm">
              Nenhuma despesa encontrada para este cartão no mês selecionado.
            </p>
          )}
      </div>
    </Card>
  );
};
