import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import CurrencyBR from "@/components/ui/currency-br";
import { DatePickerModal } from "@/components/ui/DatePickerModal";
import DynamicIcon from "@/components/DynamicIcon";
import { useToast } from "@/contexts/ToastContext";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Investment } from "@/types/finance";
import { formatInTimeZone, TARGET_TIMEZONE, cn } from "@/lib/utils";

interface NewContributionDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  investment: Investment | null;
  categoryName?: string;
  categoryIcon?: string;
  isMobile?: boolean;
  onSuccess?: () => void;
}

export const NewContributionDialog: React.FC<NewContributionDialogProps> = ({
  isOpen,
  onOpenChange,
  investment,
  categoryName,
  categoryIcon,
  isMobile = false,
  onSuccess,
}) => {
  const { user } = useAuth();
  const { showSuccessToast, showErrorToast } = useToast();
  const queryClient = useQueryClient();

  const [amount, setAmount] = useState<number | undefined>(undefined);
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ amount?: boolean; date?: boolean }>({});

  // Reset form when dialog opens
  useEffect(() => {
    if (isOpen) {
      setAmount(undefined);
      setDate(new Date());
      setErrors({});
      setIsSubmitting(false);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!investment) return;
    if (!user?.id) {
      showErrorToast("Usuário não autenticado.");
      return;
    }

    if (investment.status === "resgatado") {
      showErrorToast("Não é possível realizar aportes em investimentos já resgatados.");
      return;
    }

    const newErrors: { amount?: boolean; date?: boolean } = {};
    if (!amount || amount <= 0) {
      newErrors.amount = true;
    }
    if (!date) {
      newErrors.date = true;
    }

    // Validação de datas: não anterior à data inicial do investimento
    if (date && investment.data) {
      const dateFormatted = formatInTimeZone(date, TARGET_TIMEZONE, "yyyy-MM-dd");
      const invInitialDate = investment.data.split("T")[0];
      if (dateFormatted < invInitialDate) {
        showErrorToast(
          `A data do aporte não pode ser anterior à data inicial do investimento (${invInitialDate.split("-").reverse().join("/")}).`
        );
        newErrors.date = true;
      }
    }

    // Validação de vencimento: não posterior ao vencimento
    if (date && investment.data_vencimento) {
      const dateFormatted = formatInTimeZone(date, TARGET_TIMEZONE, "yyyy-MM-dd");
      const invDueDate = investment.data_vencimento.split("T")[0];
      if (dateFormatted > invDueDate) {
        showErrorToast(
          `A data do aporte não pode ser posterior ao vencimento (${invDueDate.split("-").reverse().join("/")}).`
        );
        newErrors.date = true;
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      showErrorToast("Preencha todos os campos corretamente.");
      return;
    }

    setIsSubmitting(true);
    try {
      const formattedDate = formatInTimeZone(date!, TARGET_TIMEZONE, "yyyy-MM-dd");

      const { error } = await supabase.from("investimentos_aportes").insert({
        investimento_id: investment.id,
        user_id: user.id,
        valor_original: amount!,
        data_aporte: formattedDate,
      });

      if (error) throw error;

      // Invalidar consultas TanStack
      await queryClient.invalidateQueries({ queryKey: ["investments", user.id] });
      await queryClient.invalidateQueries({ queryKey: ["investments-aportes", user.id] });

      showSuccessToast("Novo aporte registrado com sucesso!");
      onOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      console.error("Erro ao registrar aporte:", err);
      showErrorToast("Erro ao registrar aporte", err.message || "Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayName = categoryName || investment?.nome || "";

  if (!investment) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          isMobile
            ? "dialog-mobile w-[96%] max-w-[96%] !rounded-[22px] !px-4 !pb-4"
            : "sm:max-w-[420px] !rounded-[22px] !p-6",
          "shadow-xl border-none"
        )}
        style={{
          background: "linear-gradient(180deg, #FBFCFE 0%, #F6F8FB 100%)",
          border: "1px solid rgba(0,0,0,0.06)",
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,0.8), 0 20px 25px -5px rgba(0, 0, 0, 0.1)",
        }}
      >
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
              Novo Aporte
            </DialogDescription>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Campo Valor do Aporte */}
          <div className="space-y-1.5">
            <Label
              htmlFor="aporte-amount"
              className="text-xs font-bold text-slate-700 flex items-center gap-1.5"
            >
              <DynamicIcon name="DollarSign" className="h-3.5 w-3.5 text-blue-600" />
              Valor do Aporte
            </Label>
            <div className="relative">
              <CurrencyBR
                value={amount}
                onChange={(val) => {
                  setAmount(val);
                  if (errors.amount) setErrors((prev) => ({ ...prev, amount: false }));
                }}
                placeholder="R$ 0,00"
                className={cn(
                  "w-full h-11 px-3 text-base font-bold rounded-xl border bg-white shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500",
                  errors.amount ? "border-red-400 bg-red-50/20" : "border-slate-200"
                )}
                autoFocus
              />
            </div>
            {errors.amount && (
              <span className="text-[11px] font-semibold text-red-500">
                Informe um valor maior que zero.
              </span>
            )}
          </div>

          {/* Campo Data do Aporte */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <DynamicIcon name="Calendar" className="h-3.5 w-3.5 text-blue-600" />
              Data do Aporte
            </Label>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDatePickerOpen(true)}
              className={cn(
                "w-full h-11 justify-start text-left font-bold text-sm rounded-xl border bg-white shadow-sm px-3",
                errors.date ? "border-red-400 bg-red-50/20" : "border-slate-200"
              )}
            >
              <DynamicIcon name="Calendar" className="mr-2 h-4 w-4 text-slate-400" />
              {date ? (
                formatInTimeZone(date, TARGET_TIMEZONE, "dd/MM/yyyy")
              ) : (
                <span className="text-muted-foreground font-normal">Selecione a data</span>
              )}
            </Button>
            {errors.date && (
              <span className="text-[11px] font-semibold text-red-500">
                Data do aporte é obrigatória e deve respeitar os limites do investimento.
              </span>
            )}
          </div>

          <DatePickerModal
            isOpen={isDatePickerOpen}
            setIsOpen={setIsDatePickerOpen}
            date={date}
            onSelect={(newDate) => {
              if (newDate) {
                setDate(newDate);
                if (errors.date) setErrors((prev) => ({ ...prev, date: false }));
              }
              setIsDatePickerOpen(false);
            }}
          />

          {/* Rodapé com Botões */}
          <div className="flex items-center gap-2.5 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="flex-1 rounded-xl btn-3d font-black !text-slate-700 border-none transition-all active:scale-95 h-11 text-sm"
              style={{ "--cor-topo": "#F1F5F9", "--cor-base": "#E2E8F0" } as any}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 rounded-xl btn-3d font-black text-white border-none transition-all active:scale-95 h-11 text-sm shadow-md"
              style={{ "--cor-topo": "#2563EB", "--cor-base": "#1D4ED8" } as any}
            >
              {isSubmitting ? "Salvando..." : "Salvar Aporte"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

