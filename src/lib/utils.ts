import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatInTimeZone } from 'date-fns-tz';
import { ptBR } from 'date-fns/locale'; // Importar locale ptBR

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const isValidUuid = (value: string | null | undefined): boolean => {
  if (!value) return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
};

export const formatCurrency = (value: number) => {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
};

interface GetBorderClassProps {
  isValid?: boolean;
  isInvalid?: boolean;
}

export const getBorderClass = ({ isValid, isInvalid }: GetBorderClassProps): string => {
  let borderClass = "";
  if (isInvalid) {
    borderClass = "border-destructive";
  } else if (isValid) {
    borderClass = "border-success";
  }
  // Always apply focus styles to override default blue rings/outlines
  return cn(
    borderClass,
    "focus-visible:ring-0 focus-visible:outline-none focus-visible:border-success",
    "focus:ring-0 focus:outline-none focus:border-success" // For non-focus-visible elements
  );
};

export const TARGET_TIMEZONE = 'America/Sao_Paulo'; // Fuso horário UTC-3 (Brasília)
export { formatInTimeZone }; // Exportar apenas formatInTimeZone

/**
 * Formats a given Date object with the current time in the TARGET_TIMEZONE.
 * Useful for date pickers that only provide date, but a full timestamp is required.
 * @param dateObj The Date object from a date picker (e.g., 2023-10-27T00:00:00.000Z in local time).
 * @returns A string formatted as 'YYYY-MM-DD HH:mm:ss' in TARGET_TIMEZONE.
 */
export const formatDateWithCurrentTimeInTimeZone = (dateObj: Date): string => {
  const now = new Date();
  const combinedDate = new Date(
    dateObj.getFullYear(),
    dateObj.getMonth(),
    dateObj.getDate(),
    now.getHours(),
    now.getMinutes(),
    now.getSeconds(),
    now.getMilliseconds() // Incluir milissegundos para maior precisão
  );
  return formatInTimeZone(combinedDate, TARGET_TIMEZONE, 'yyyy-MM-dd HH:mm:ss', { locale: ptBR });
};