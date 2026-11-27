export function computeNextCode(
  prefix: string,
  existingCodes: Array<string | null | undefined>,
  padLength = 4,
): string {
  const cleanPrefix = prefix.trim();
  let maxNumber = 0;

  for (const raw of existingCodes) {
    if (!raw || typeof raw !== 'string') continue;
    const code = raw.trim();
    if (!code) continue;

    if (cleanPrefix) {
      const escaped = cleanPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const match = code.match(new RegExp(`^${escaped}-?(\\d+)$`, 'i'));
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (!Number.isNaN(num) && num > maxNumber) {
          maxNumber = num;
        }
        continue;
      }
    }

    const trailingMatch = code.match(/(\d+)$/);
    if (
      trailingMatch &&
      trailingMatch[1] &&
      (!cleanPrefix || code.toUpperCase().startsWith(cleanPrefix.toUpperCase()))
    ) {
      const num = parseInt(trailingMatch[1], 10);
      if (!Number.isNaN(num) && num > maxNumber) {
        maxNumber = num;
      }
    }
  }

  const nextNum = String(maxNumber + 1).padStart(padLength, '0');
  return cleanPrefix ? `${cleanPrefix}-${nextNum}` : nextNum;
}

export async function resolveAutoCode(
  delegate: { findMany: (args: any) => Promise<any[]> },
  companyId: string | undefined,
  field: string,
  prefix: string,
  provided?: string | null,
  padLength = 4,
): Promise<string> {
  if (typeof provided === 'string' && provided.trim().length > 0) {
    return provided.trim();
  }
  const rows = await delegate.findMany({
    ...(companyId ? { where: { companyId } } : {}),
    select: { [field]: true },
  });
  return computeNextCode(
    prefix,
    rows.map((r) => r?.[field]),
    padLength,
  );
}
