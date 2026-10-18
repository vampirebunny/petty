export const nameLimit = 16;

export function cleanName(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > nameLimit) {
    return null;
  }
  return trimmed;
}
