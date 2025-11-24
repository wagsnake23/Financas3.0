import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatInTimeZone, zonedTimeToUtc } from 'date-fns-tz'; // Importar formatInTimeZone e zonedTimeToUtc

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
export { formatInTimeZone, zonedTimeToUtc }; // Exportar formatInTimeZone e zonedTimeToUtc para uso global