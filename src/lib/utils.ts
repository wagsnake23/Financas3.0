import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatInTimeZone } from "date-fns-tz"; // Removido zonedTimeToUtc

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const isValidUuid = (value: string | null | undefined): boolean => {
  if (!value) return false;
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
};

// 🔥 Correção aplicada aqui
export const formatCurrency = (value?: number | null, showSymbol: boolean = true) => {
  if (typeof value !== "number" || isNaN(value)) {
    return showSymbol ? "R$ 0,00" : "0,00";
  }

  if (!showSymbol) {
    return value.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
};

interface GetBorderClassProps {
  isValid?: boolean;
  isInvalid?: boolean;
}

export const getBorderClass = ({
  isValid,
  isInvalid,
}: GetBorderClassProps): string => {
  let borderClass = "";
  if (isInvalid) {
    borderClass = "border-destructive focus:border-destructive focus:ring-destructive/10";
  } else if (isValid) {
    borderClass = "border-[#A8C5FF] focus:border-[#A8C5FF] focus:ring-[#A8C5FF]/10";
  } else {
    // Default focus state for fields without validation status
    borderClass = "focus:border-[#A8C5FF] focus:ring-[#A8C5FF]/10";
  }

  return cn(
    borderClass,
    "focus-visible:ring-4 focus-visible:outline-none transition-all duration-200",
    "focus:ring-4 focus:outline-none"
  );
};

export const TARGET_TIMEZONE = "America/Sao_Paulo"; // Fuso horário UTC-3 (Brasília)
export { formatInTimeZone }; // Exportar apenas formatInTimeZone

// Função de fallback para zonedTimeToUtc
export function zonedTimeToUtcFallback(
  dateString: string,
  timeZone: string
): Date {
  return new Date(new Date(dateString).toLocaleString("en-US", { timeZone }));
}
