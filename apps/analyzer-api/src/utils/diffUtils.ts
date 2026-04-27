/**
 * Computes differences between an old record and a new payload.
 * Only includes fields that exist in payload and actually changed.
 * Normalizes values (trims strings, treats null/undefined consistently).
 */
export function diffObjects(
    oldRecord: Record<string, any>,
    newPayload: Record<string, any>,
    allowListFields?: string[],
    ignoreFields?: string[]
): Record<string, { from: any; to: any }> | null {
    const diffs: Record<string, { from: any; to: any }> = {};

    const keysToProcess = allowListFields || Object.keys(newPayload);

    for (const key of keysToProcess) {
        if (ignoreFields && ignoreFields.includes(key)) {
            continue;
        }

        if (!(key in newPayload)) {
            continue;
        }

        let oldVal = oldRecord[key];
        let newVal = newPayload[key];

        // Normalize strings and null/undefined
        if (typeof oldVal === 'string') oldVal = oldVal.trim();
        if (typeof newVal === 'string') newVal = newVal.trim();

        if (oldVal === undefined) oldVal = null;
        if (newVal === undefined) newVal = null;

        // Strict equality check, but also handle Date objects or arrays if needed (basic support here)
        if (oldVal !== newVal) {
            diffs[key] = { from: oldVal, to: newVal };
        }
    }

    return Object.keys(diffs).length > 0 ? diffs : null;
}
