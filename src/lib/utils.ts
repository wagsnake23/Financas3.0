import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { isValid } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Helper function to create a local Date object from a YYYY-MM-DD string
export const createSafeDate = (dateString: string | null | undefined): Date | undefined => {
  if (!dateString) return undefined;
  const [y, m, d] = dateString.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return isValid(date) ? date : undefined;
};