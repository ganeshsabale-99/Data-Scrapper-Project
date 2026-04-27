const enumValuesCache = new Map<string, string[]>();

export async function getPostgresEnumValues(
  prisma: any,
  enumTypeName: string,
): Promise<string[] | null> {
  if (enumValuesCache.has(enumTypeName)) {
    return enumValuesCache.get(enumTypeName)!;
  }

  try {
    const rows = (await prisma.$queryRawUnsafe(
      `SELECT unnest(enum_range(NULL::"${enumTypeName}"))::text AS value`,
    )) as Array<{ value: string }>;

    const values = rows.map((r) => r.value).filter(Boolean);
    enumValuesCache.set(enumTypeName, values);
    return values;
  } catch {
    return null;
  }
}

