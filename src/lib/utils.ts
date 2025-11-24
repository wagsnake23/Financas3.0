import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatInTimeZone } from 'date-fns-tz'; // Mantido o import de formatInTimeZone

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

// Função utilitária para obter o timestamp ISO atual no fuso horário de Brasília
export function nowInBrazilISO(): string {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })
  ).toISOString();
}

// Função utilitária para analisar uma string ISO e retornar um objeto Date
// que representa a data/hora no fuso horário de Brasília.
export function parseBrazilLocalToDate(isoString: string | null | undefined): Date | undefined {
  if (!isoString) return undefined;

  const inst = new Date(isoString); // Parse a string ISO em um objeto Date (UTC)

  // Formata este objeto Date UTC em uma string de hora local do Brasil (ex: "DD/MM/YYYY HH:mm:ss")
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const formatted = fmt.format(inst); // ex: "27/10/2023 10:00:00"

  // Analisa a string de hora local formatada de volta em um objeto Date
  const [datePart, timePart] = formatted.split(" ");
  const [day, month, year] = datePart.split("/");
  const [hour, minute, second] = timePart.split(":");

  // Constrói um novo objeto Date. Este construtor cria uma data no fuso horário local do cliente.
  // No entanto, como derivamos os componentes (ano, mês, dia, hora, minuto, segundo) de uma string formatada
  // para a hora local do Brasil, este objeto Date, quando subsequentemente formatado de volta para a hora do Brasil,
  // representará corretamente a hora local original do Brasil.
  return new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second)
  );
}

// Re-exporta formatInTimeZone e as novas funções
export { formatInTimeZone };