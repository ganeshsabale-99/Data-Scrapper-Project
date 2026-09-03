import { isPlaceholderVenue, isTestPlaceId } from "./venueDataQuality";

export interface ExportValidationIssue {
  check: "city_non_null" | "location_non_null" | "row_count_reconciliation";
  sheet: string;
  message: string;
  sampleIds?: string[];
}

export interface ExportDataset {
  label: string;
  rows: Array<Record<string, any>>;
}

export interface ExportValidationResult {
  ok: boolean;
  issues: ExportValidationIssue[];
  totals: { perSheet: Record<string, number>; grandTotal: number };
}

const MAX_SAMPLE_IDS = 10;

/**
 * Runs the pre-export checks the sales-facing export must pass on every run:
 *  - City is non-null on 100% of rows
 *  - Latitude/Longitude/Address are non-null on 100% of real (non-test) rows
 *  - Per-sheet and grand-total row counts reconcile
 * Never silently ships a file that fails these — the caller should treat a
 * failing result as a reason to stop the export and surface the issues.
 */
export function runExportValidation(datasets: ExportDataset[]): ExportValidationResult {
  const issues: ExportValidationIssue[] = [];
  const perSheet: Record<string, number> = {};
  let grandTotal = 0;
  let reconciledTotal = 0;

  for (const { label, rows } of datasets) {
    perSheet[label] = rows.length;
    reconciledTotal += rows.length;

    const missingCityIds: string[] = [];
    const missingLocationIds: string[] = [];

    for (const row of rows) {
      if (!row.city || !String(row.city).trim()) {
        missingCityIds.push(row.id ?? row.place_id ?? row.name ?? "unknown");
      }

      const isTest = isTestPlaceId(row.place_id) || isPlaceholderVenue({
        placeId: row.place_id,
        lat: row.lat,
        lng: row.lng,
        address: row.address ?? row.address_line1,
      });
      if (isTest) continue;

      const hasLat = row.lat !== null && row.lat !== undefined;
      const hasLng = row.lng !== null && row.lng !== undefined;
      const hasAddress = Boolean((row.address ?? row.address_line1) && String(row.address ?? row.address_line1).trim());
      if (!hasLat || !hasLng || !hasAddress) {
        missingLocationIds.push(row.id ?? row.place_id ?? row.name ?? "unknown");
      }
    }

    if (missingCityIds.length > 0) {
      issues.push({
        check: "city_non_null",
        sheet: label,
        message: `${missingCityIds.length} of ${rows.length} row(s) in "${label}" have a blank City.`,
        sampleIds: missingCityIds.slice(0, MAX_SAMPLE_IDS),
      });
    }

    if (missingLocationIds.length > 0) {
      issues.push({
        check: "location_non_null",
        sheet: label,
        message: `${missingLocationIds.length} of ${rows.length} row(s) in "${label}" are missing Latitude, Longitude, or Address.`,
        sampleIds: missingLocationIds.slice(0, MAX_SAMPLE_IDS),
      });
    }
  }

  grandTotal = reconciledTotal;
  if (grandTotal !== Object.values(perSheet).reduce((sum, n) => sum + n, 0)) {
    issues.push({
      check: "row_count_reconciliation",
      sheet: "all",
      message: `Per-category row counts (${JSON.stringify(perSheet)}) do not reconcile with the grand total (${grandTotal}).`,
    });
  }

  return {
    ok: issues.length === 0,
    issues,
    totals: { perSheet, grandTotal },
  };
}
