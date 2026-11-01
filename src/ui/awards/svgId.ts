export function svgId(prefix: string, raw: string): string {
  return `${prefix}${raw.replace(/[^a-zA-Z0-9]/g, '')}`;
}
