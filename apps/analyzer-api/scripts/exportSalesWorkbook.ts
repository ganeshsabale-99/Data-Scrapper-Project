import dotenv from "dotenv";
import path from "path";
import fs from "fs/promises";
import ExcelJS from "exceljs";

dotenv.config();
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });
}

type VenueSpec = {
  label: string;
  sheet: string;
  model: any;
  addressField: string;
  phoneField: string;
};

const safeCell = (value: unknown): string | number | boolean | Date => {
  if (value instanceof Date || typeof value === "number" || typeof value === "boolean") return value;
  if (value === null || value === undefined) return "";
  const text = Array.isArray(value) ? value.join(", ") : String(value);
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
};

async function main() {
  const { prismaInstance } = await import("@repo/db");
  const specs: VenueSpec[] = [
    { label: "Tech Park", sheet: "Tech Parks", model: prismaInstance.newTechPark, addressField: "address_line1", phoneField: "reception_phone" },
    { label: "Coworking Space", sheet: "Coworking", model: prismaInstance.coworkingSpace, addressField: "address", phoneField: "contact_phone" },
    { label: "Mall", sheet: "Malls", model: prismaInstance.mall, addressField: "address", phoneField: "reception_phone" },
    { label: "Hospital", sheet: "Hospitals", model: prismaInstance.hospital, addressField: "address", phoneField: "reception_phone" },
    { label: "Stadium", sheet: "Stadiums", model: prismaInstance.stadium, addressField: "address", phoneField: "reception_phone" },
    { label: "Airport", sheet: "Airports", model: prismaInstance.airport, addressField: "address", phoneField: "reception_phone" },
  ];

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Gupio Data Scrapper";
  workbook.created = new Date();
  const summary = workbook.addWorksheet("Summary");
  summary.columns = [
    { header: "Venue Type", key: "type", width: 24 },
    { header: "Total", key: "total", width: 12 },
    { header: "With Phone", key: "phone", width: 14 },
    { header: "With Website", key: "website", width: 16 },
    { header: "Complete Address + Geo", key: "geo", width: 24 },
    { header: "Missing Phone", key: "missingPhone", width: 16 },
    { header: "Missing Website", key: "missingWebsite", width: 18 },
  ];

  const missingSheet = workbook.addWorksheet("Missing Contacts");
  missingSheet.columns = [
    { header: "Venue Type", key: "type", width: 20 },
    { header: "Name", key: "name", width: 38 },
    { header: "City", key: "city", width: 20 },
    { header: "State", key: "state", width: 22 },
    { header: "Address", key: "address", width: 55 },
    { header: "Missing", key: "missing", width: 22 },
    { header: "Map URL", key: "mapUrl", width: 45 },
  ];

  for (const spec of specs) {
    const rows = await spec.model.findMany({
      where: { is_active: true, do_not_call: false },
      orderBy: [{ review_issue_score: "desc" }, { updatedAt: "desc" }],
    });
    const sheet = workbook.addWorksheet(spec.sheet);
    sheet.columns = [
      { header: "ID", key: "id", width: 27 },
      { header: "Name", key: "name", width: 38 },
      { header: "City", key: "city", width: 20 },
      { header: "State", key: "state", width: 22 },
      { header: "District", key: "district", width: 22 },
      { header: "Pincode", key: "pincode", width: 12 },
      { header: "Address", key: "address", width: 55 },
      { header: "Latitude", key: "lat", width: 14 },
      { header: "Longitude", key: "lng", width: 14 },
      { header: "Phone", key: "phone", width: 20 },
      { header: "International Phone", key: "intlPhone", width: 22 },
      { header: "Website", key: "website", width: 45 },
      { header: "Map URL", key: "mapUrl", width: 45 },
      { header: "Rating", key: "rating", width: 10 },
      { header: "Total Ratings", key: "totalRatings", width: 14 },
      { header: "Business Status", key: "businessStatus", width: 20 },
      { header: "Review Priority", key: "reviewPriority", width: 18 },
      { header: "Review Issue Score", key: "reviewIssueScore", width: 18 },
      { header: "Issue Categories", key: "reviewCategories", width: 38 },
      { header: "Priority Reason", key: "reviewSummary", width: 55 },
      { header: "Reviews Analyzed", key: "reviewsAnalyzed", width: 18 },
      { header: "Parking Priority", key: "parkingPriority", width: 16 },
      { header: "Contact Status", key: "status", width: 18 },
      { header: "SPOC Name", key: "spocName", width: 22 },
      { header: "SPOC Phone", key: "spocPhone", width: 20 },
      { header: "SPOC Email", key: "spocEmail", width: 30 },
      { header: "Possible Duplicate", key: "duplicate", width: 18 },
      { header: "Verified", key: "verified", width: 12 },
      { header: "Updated At", key: "updatedAt", width: 22 },
    ];

    let withPhone = 0;
    let withWebsite = 0;
    let completeGeo = 0;
    for (const row of rows) {
      const address = row[spec.addressField] ?? row.address;
      const phone = row[spec.phoneField];
      if (phone) withPhone++;
      if (row.website) withWebsite++;
      if (address && row.city && row.lat != null && row.lng != null) completeGeo++;
      sheet.addRow({
        id: safeCell(row.id), name: safeCell(row.name), city: safeCell(row.city), state: safeCell(row.state),
        district: safeCell(row.district), pincode: safeCell(row.pincode), address: safeCell(address),
        lat: safeCell(row.lat), lng: safeCell(row.lng), phone: safeCell(phone),
        intlPhone: safeCell(row.international_phone), website: safeCell(row.website), mapUrl: safeCell(row.map_url),
        rating: safeCell(row.rating), totalRatings: safeCell(row.total_ratings), businessStatus: safeCell(row.business_status),
        reviewPriority: safeCell(row.review_priority), reviewIssueScore: safeCell(row.review_issue_score),
        reviewCategories: safeCell(row.review_issue_categories), reviewSummary: safeCell(row.review_issue_summary),
        reviewsAnalyzed: safeCell(row.reviews_analyzed),
        parkingPriority: safeCell(row.parking_priority), status: safeCell(row.status), spocName: safeCell(row.spoc_name),
        spocPhone: safeCell(row.spoc_phone), spocEmail: safeCell(row.spoc_email),
        duplicate: row.is_possible_duplicate ? "Yes" : "No", verified: row.isVerified ? "Yes" : "No",
        updatedAt: row.updatedAt,
      });
      if (!phone || !row.website) {
        missingSheet.addRow({
          type: spec.label, name: safeCell(row.name), city: safeCell(row.city), state: safeCell(row.state),
          address: safeCell(address), missing: !phone && !row.website ? "Phone + Website" : !phone ? "Phone" : "Website",
          mapUrl: safeCell(row.map_url),
        });
      }
    }
    summary.addRow({
      type: spec.sheet, total: rows.length, phone: withPhone, website: withWebsite, geo: completeGeo,
      missingPhone: rows.length - withPhone, missingWebsite: rows.length - withWebsite,
    });
    sheet.autoFilter = { from: "A1", to: "AC1" };
    sheet.views = [{ state: "frozen", ySplit: 1 }];
  }

  for (const sheet of workbook.worksheets) {
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E78" } };
    sheet.getRow(1).alignment = { vertical: "middle" };
    sheet.views = [{ state: "frozen", ySplit: 1 }];
  }

  const outputDir = path.resolve(process.cwd(), "../../exports");
  await fs.mkdir(outputDir, { recursive: true });
  const timestamp = new Date().toISOString().slice(0, 10);
  const outputPath = path.join(outputDir, `gupio-sales-venues-${timestamp}.xlsx`);
  await workbook.xlsx.writeFile(outputPath);
  console.log(outputPath);
  await prismaInstance.$disconnect();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
