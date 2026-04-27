export function normalizeEnumSearch(input: string): string {
  return input.trim().toUpperCase().replace(/[\s-]+/g, "_");
}

export function matchEnumValue(
  input: string | undefined,
  allowed: readonly string[],
): string | undefined {
  if (!input) return undefined;
  const normalized = normalizeEnumSearch(input);
  return allowed.includes(normalized) ? normalized : undefined;
}

