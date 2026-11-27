/**
 * Sequential auto-code generator for ERP modules.
 * Computes the next unused code based on existing records (e.g. PO-0001 -> PO-0002),
 * while always keeping the input editable so operators can override if desired.
 */
export function generateNextCode(
  prefix: string,
  existingCodes: Array<string | null | undefined> = [],
  padLength = 4,
): string {
  const cleanPrefix = prefix.trim();
  let maxNumber = 0;

  for (const raw of existingCodes) {
    if (!raw || typeof raw !== "string") continue;
    const code = raw.trim();
    if (!code) continue;

    if (cleanPrefix) {
      const escaped = cleanPrefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const match = code.match(new RegExp(`^${escaped}-?(\\d+)$`, "i"));
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (!Number.isNaN(num) && num > maxNumber) {
          maxNumber = num;
        }
        continue;
      }
    }

    const trailingMatch = code.match(/(\d+)$/);
    if (trailingMatch && trailingMatch[1] && (!cleanPrefix || code.toUpperCase().startsWith(cleanPrefix.toUpperCase()))) {
      const num = parseInt(trailingMatch[1], 10);
      if (!Number.isNaN(num) && num > maxNumber) {
        maxNumber = num;
      }
    }
  }

  const nextNum = String(maxNumber + 1).padStart(padLength, "0");
  return cleanPrefix ? `${cleanPrefix}-${nextNum}` : nextNum;
}

export function generateNextCodeFromRows<T>(
  prefix: string,
  rows: T[] | null | undefined,
  getter: (row: T) => string | null | undefined,
  padLength = 4,
): string {
  if (!Array.isArray(rows) || rows.length === 0) {
    return generateNextCode(prefix, [], padLength);
  }
  return generateNextCode(
    prefix,
    rows.map((r) => getter(r)),
    padLength,
  );
}
