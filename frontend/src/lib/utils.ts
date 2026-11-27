import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatCurrency(val?: number | null): string {
  if (val == null) return "Rs. 0";
  return "Rs. " + val.toLocaleString("en-PK", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}
