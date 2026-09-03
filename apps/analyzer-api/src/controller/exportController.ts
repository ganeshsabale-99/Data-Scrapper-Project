import { Request, Response } from "express";
import { prismaInstance } from "@repo/db";
import ExcelJS from "exceljs";
import { getQueryString } from "../utils/queryUtils";
import { sendSafeErrorResponse } from "../utils/safeErrorResponse";
import { runExportValidation, type ExportDataset } from "../utils/exportValidation";

// The PDF report is built by string-concatenating DB-sourced text into HTML that a
// headless browser then renders — any unescaped field is an HTML/script injection point.
const escapeHtml = (value: unknown): string => {
    if (value === null || value === undefined) return "";
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
};

const GENERIC_VENUE_MODELS: Record<string, { model: any; label: string; singularLabel: string }> = {
    mall: { model: prismaInstance.mall, label: 'Malls', singularLabel: 'Mall' },
    hospital: { model: prismaInstance.hospital, label: 'Hospitals', singularLabel: 'Hospital' },
    stadium: { model: prismaInstance.stadium, label: 'Stadiums', singularLabel: 'Stadium' },
    airport: { model: prismaInstance.airport, label: 'Airports', singularLabel: 'Airport' },
};

// CLOSED_PERMANENTLY / CLOSED_TEMPORARILY listings are tagged `do_not_call` at
// scrape time (see venueDataQuality.ts) and are excluded from every export by
// default so a sales rep never wastes a call on a dead listing. Pass
// includeDoNotCall=true to include them anyway (still tagged in the output).
const applyDoNotCallFilter = (where: any, includeDoNotCall: boolean) => {
    if (!includeDoNotCall) where.do_not_call = false;
};

/**
 * Pre-export validation pass (requirement #6): before any file is produced,
 * assert City is non-null on 100% of rows, Latitude/Longitude/Address are
 * non-null on 100% of real (non-test) rows, and per-category counts
 * reconcile with the grand total. Runs lightweight `select`-only queries
 * against the same filters the export itself uses, so it fails fast without
 * needing to build the whole workbook first.
 */
async function collectExportValidationDatasets(
    entityType: string,
    statusFilter: string,
    state: string | undefined,
    city: string | undefined,
    includeDoNotCall: boolean,
): Promise<ExportDataset[]> {
    const SELECT = { id: true, place_id: true, city: true, lat: true, lng: true, address: true };
    // CoworkingSpace has no place_id column (it's keyed by a hash-based id,
    // not tied to a Google Place ID like the other 5 venue models).
    const COWORKING_SELECT = { id: true, city: true, lat: true, lng: true, address: true };
    const datasets: ExportDataset[] = [];

    const wantsTechPark = entityType === 'techPark' || entityType === 'all';
    const wantsCoworking = entityType === 'coworkingSpace' || entityType === 'all';
    const genericKeys = entityType === 'all'
        ? Object.keys(GENERIC_VENUE_MODELS)
        : (entityType in GENERIC_VENUE_MODELS ? [entityType] : []);

    if (wantsTechPark) {
        const where: any = { is_active: true };
        if (statusFilter === 'verified') where.isVerified = true;
        if (statusFilter === 'unverified') where.isVerified = false;
        if (state) where.state = { equals: state, mode: 'insensitive' };
        if (city) where.city = { equals: city, mode: 'insensitive' };
        applyDoNotCallFilter(where, includeDoNotCall);
        const rows = await prismaInstance.newTechPark.findMany({
            where,
            select: { ...SELECT, address_line1: true },
        });
        datasets.push({
            label: 'Tech Parks',
            rows: rows.map((r) => ({ ...r, address: r.address_line1 })),
        });
    }

    if (wantsCoworking) {
        const where: any = {};
        if (statusFilter === 'verified') where.isVerified = true;
        if (statusFilter === 'unverified') where.isVerified = false;
        if (state) where.state = { equals: state, mode: 'insensitive' };
        if (city) where.city = { equals: city, mode: 'insensitive' };
        applyDoNotCallFilter(where, includeDoNotCall);
        const rows = await prismaInstance.coworkingSpace.findMany({ where, select: COWORKING_SELECT });
        datasets.push({ label: 'Coworking Spaces', rows });
    }

    for (const key of genericKeys) {
        const entry = GENERIC_VENUE_MODELS[key];
        if (!entry) continue;
        const where: any = { is_active: true };
        if (statusFilter === 'verified') where.isVerified = true;
        if (statusFilter === 'unverified') where.isVerified = false;
        if (state) where.state = { equals: state, mode: 'insensitive' };
        if (city) where.city = { equals: city, mode: 'insensitive' };
        applyDoNotCallFilter(where, includeDoNotCall);
        const rows = await entry.model.findMany({ where, select: SELECT });
        datasets.push({ label: entry.label, rows });
    }

    return datasets;
}

export const exportData = async (req: Request, res: Response) => {
    try {
        const entityType = getQueryString(req.query.entityType) || 'all'; // techPark, coworkingSpace, mall, hospital, stadium, airport, all
        const status = getQueryString(req.query.status) || 'all'; // verified, unverified, all
        const state = getQueryString(req.query.state);
        const city = getQueryString(req.query.city);
        const format = getQueryString(req.query.format) || 'excel'; // excel, csv, pdf
        const includeDoNotCall = getQueryString(req.query.includeDoNotCall) === 'true';

        const validationDatasets = await collectExportValidationDatasets(
            entityType, status, state, city, includeDoNotCall,
        );
        const validation = runExportValidation(validationDatasets);
        if (!validation.ok) {
            return res.status(422).json({
                success: false,
                message: "Export failed pre-export validation and was not generated.",
                issues: validation.issues,
                totals: validation.totals,
            });
        }

        if (format === 'pdf') {
            await generatePdf(res, entityType, status, state, city, includeDoNotCall);
            return;
        }

        const workbook = new ExcelJS.Workbook();

        if (format === 'csv' && entityType === 'all') {
            await addUnifiedSheet(workbook, status, state, city, includeDoNotCall);
        } else {
            if (entityType === 'techPark' || entityType === 'all') {
                await addTechParkSheet(workbook, status, state, city, includeDoNotCall);
            }

            if (entityType === 'coworkingSpace' || entityType === 'all') {
                await addCoworkingSheet(workbook, status, state, city, includeDoNotCall);
            }

            if (entityType in GENERIC_VENUE_MODELS) {
                await addGenericVenueSheet(workbook, entityType, status, state, city, includeDoNotCall);
            } else if (entityType === 'all') {
                for (const key of Object.keys(GENERIC_VENUE_MODELS)) {
                    await addGenericVenueSheet(workbook, key, status, state, city, includeDoNotCall);
                }
            }
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `export_${entityType}_${status}_${timestamp}`;

        if (format === 'csv') {
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
            // Note: exceljs handles CSV by returning the first sheet
            await workbook.csv.write(res);
        } else {
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
            await workbook.xlsx.write(res);
        }

        res.end();
    } catch (error) {
        return sendSafeErrorResponse(res, error, "exportData", "Failed to export data");
    }
};

async function addTechParkSheet(workbook: ExcelJS.Workbook, statusFilter: string, state?: string, city?: string, includeDoNotCall = false) {
    const sheet = workbook.addWorksheet('Tech Parks');

    const where: any = { is_active: true };
    if (statusFilter === 'verified') where.isVerified = true;
    if (statusFilter === 'unverified') where.isVerified = false;
    if (state) where.state = { equals: state, mode: 'insensitive' };
    if (city) where.city = { equals: city, mode: 'insensitive' };
    applyDoNotCallFilter(where, includeDoNotCall);

    const techParks = await prismaInstance.newTechPark.findMany({
        where,
        orderBy: { createdAt: 'desc' },
    });

    sheet.columns = [
        { header: 'ID', key: 'id', width: 25 },
        { header: 'Place ID', key: 'place_id', width: 20 },
        { header: 'Name', key: 'name', width: 30 },
        { header: 'Address Line 1', key: 'address_line1', width: 25 },
        { header: 'Address Line 2', key: 'address_line2', width: 25 },
        { header: 'Locality', key: 'locality', width: 20 },
        { header: 'City', key: 'city', width: 15 },
        { header: 'District', key: 'district', width: 15 },
        { header: 'State', key: 'state', width: 15 },
        { header: 'Pincode', key: 'pincode', width: 10 },
        { header: 'Country', key: 'country', width: 15 },
        { header: 'Latitude', key: 'lat', width: 15 },
        { header: 'Longitude', key: 'lng', width: 15 },
        { header: 'Map URL', key: 'map_url', width: 25 },
        { header: 'Website', key: 'website', width: 25 },
        { header: 'Reception Phone', key: 'reception_phone', width: 15 },
        { header: 'International Phone', key: 'international_phone', width: 20 },
        { header: 'Generic Email', key: 'generic_email', width: 25 },
        { header: 'Contact Page URL', key: 'contact_page_url', width: 25 },
        { header: 'Rating', key: 'rating', width: 10 },
        { header: 'Total Ratings', key: 'total_ratings', width: 15 },
        { header: 'Business Status', key: 'business_status', width: 15 },
        { header: 'Types', key: 'types', width: 20 },
        { header: 'Operator Name', key: 'operator_name', width: 20 },
        { header: 'Campus Brand', key: 'campus_brand', width: 20 },
        { header: 'Legal Entity', key: 'legal_entity', width: 20 },
        { header: 'Campus Size Hint', key: 'campus_size_hint', width: 20 },
        { header: 'Tenant Signal', key: 'tenant_signal', width: 20 },
        { header: 'Amenities Signal', key: 'amenities_signal', width: 20 },
        { header: 'Source Primary', key: 'source_primary', width: 15 },
        { header: 'Confidence Overall', key: 'confidence_overall', width: 15 },
        { header: 'QA Status', key: 'qa_status', width: 15 },
        { header: 'Is Active', key: 'is_active', width: 10 },
        { header: 'Internal Notes', key: 'notes_internal', width: 25 },
        { header: 'Builder Name', key: 'builder_name', width: 20 },
        { header: 'Security Agency', key: 'security_agency_name', width: 20 },
        { header: 'Property Manager', key: 'property_manager_name', width: 20 },
        { header: 'PM Phone', key: 'property_manager_phone', width: 15 },
        { header: 'PM Email', key: 'property_manager_email', width: 25 },
        { header: 'Parking Floors', key: 'parking_floors', width: 15 },
        { header: 'Total Floors', key: 'total_floors', width: 15 },
        { header: 'Basement Levels', key: 'basement_levels', width: 15 },
        { header: 'SPOC Name', key: 'spoc_name', width: 20 },
        { header: 'SPOC Phone', key: 'spoc_phone', width: 15 },
        { header: 'SPOC Email', key: 'spoc_email', width: 25 },
        { header: 'Seating Capacity', key: 'seating_capacity', width: 15 },
        { header: 'Challenges', key: 'challenges', width: 25 },
        { header: 'First Seen At', key: 'first_seen_at', width: 20 },
        { header: 'Last Seen At', key: 'last_seen_at', width: 20 },
        { header: 'Contact Status', key: 'status', width: 18 },
        { header: 'Review Status', key: 'reviewStatus', width: 15 },
        { header: 'Duplication Score', key: 'duplication_score', width: 15 },
        { header: 'Possible Duplicate', key: 'is_possible_duplicate', width: 15 },
        { header: 'Do Not Call', key: 'do_not_call', width: 12 },
        { header: 'Verified', key: 'isVerified', width: 10 },
        { header: 'Verified By', key: 'verifiedByUserId', width: 20 },
        { header: 'Verified At', key: 'verifiedAt', width: 20 },
        { header: 'Created At', key: 'createdAt', width: 20 },
        { header: 'Updated At', key: 'updatedAt', width: 20 },
    ];

    techParks.forEach(park => {
        sheet.addRow({
            ...park,
            types: park.types ? park.types.join(', ') : '',
            is_active: park.is_active ? 'Yes' : 'No',
            isVerified: park.isVerified ? 'Yes' : 'No',
            is_possible_duplicate: park.is_possible_duplicate ? 'Yes' : 'No',
            do_not_call: park.do_not_call ? 'Yes' : 'No',
            createdAt: park.createdAt ? park.createdAt.toISOString() : '',
            updatedAt: park.updatedAt ? park.updatedAt.toISOString() : '',
            first_seen_at: park.first_seen_at ? park.first_seen_at.toISOString() : '',
            last_seen_at: park.last_seen_at ? park.last_seen_at.toISOString() : '',
            verifiedAt: park.verifiedAt ? park.verifiedAt.toISOString() : '',
        });
    });

    sheet.getRow(1).font = { bold: true };
}

async function addCoworkingSheet(workbook: ExcelJS.Workbook, statusFilter: string, state?: string, city?: string, includeDoNotCall = false) {
    const sheet = workbook.addWorksheet('Coworking Spaces');

    const where: any = {};
    if (statusFilter === 'verified') where.isVerified = true;
    if (statusFilter === 'unverified') where.isVerified = false;
    if (state) where.state = { equals: state, mode: 'insensitive' };
    if (city) where.city = { equals: city, mode: 'insensitive' };
    applyDoNotCallFilter(where, includeDoNotCall);

    const spaces = await prismaInstance.coworkingSpace.findMany({
        where,
        // Worst parking problems first, so the sales team works the sheet top-down.
        orderBy: [{ parking_priority: 'desc' }, { createdAt: 'desc' }],
    });

    sheet.columns = [
        { header: 'ID', key: 'id', width: 25 },
        { header: 'Name', key: 'name', width: 30 },
        { header: 'Campus Brand', key: 'campus_brand', width: 20 },
        { header: 'City', key: 'city', width: 15 },
        { header: 'State', key: 'state', width: 15 },
        { header: 'District', key: 'district', width: 15 },
        { header: 'Pincode', key: 'pincode', width: 10 },
        { header: 'Country', key: 'country', width: 15 },
        { header: 'Address', key: 'address', width: 35 },
        { header: 'Latitude', key: 'lat', width: 15 },
        { header: 'Longitude', key: 'lng', width: 15 },
        { header: 'Map URL', key: 'map_url', width: 25 },
        { header: 'Lead Score', key: 'campus_size_hint', width: 15 },
        { header: 'Contact Status', key: 'status', width: 18 },
        { header: 'Business Status', key: 'business_status', width: 15 },
        { header: 'Phone', key: 'contact_phone', width: 15 },
        { header: 'International Phone', key: 'international_phone', width: 20 },
        { header: 'Email', key: 'generic_email', width: 25 },
        { header: 'Website', key: 'website', width: 30 },
        { header: 'Operator', key: 'operator_name', width: 20 },
        { header: 'Legal Entity', key: 'legal_entity', width: 20 },
        { header: 'Rating', key: 'rating', width: 10 },
        { header: 'Parking Score', key: 'challenges', width: 15 },
        { header: 'Parking Priority', key: 'parking_priority', width: 14 },
        { header: 'SPOC Name', key: 'spoc_name', width: 20 },
        { header: 'SPOC Phone', key: 'spoc_phone', width: 15 },
        { header: 'SPOC Email', key: 'spoc_email', width: 25 },
        { header: 'Property Manager', key: 'property_manager_name', width: 25 },
        { header: 'PM Phone', key: 'property_manager_phone', width: 15 },
        { header: 'PM Email', key: 'property_manager_email', width: 25 },
        { header: 'Total Floors', key: 'total_floors', width: 15 },
        { header: 'Parking Floors', key: 'parking_floors', width: 15 },
        { header: 'Basement Levels', key: 'basement_levels', width: 15 },
        { header: 'Seating Capacity', key: 'seating_capacity', width: 15 },
        { header: 'Possible Duplicate', key: 'is_possible_duplicate', width: 15 },
        { header: 'Do Not Call', key: 'do_not_call', width: 12 },
        { header: 'Verified', key: 'isVerified', width: 10 },
        { header: 'Verified At', key: 'verifiedAt', width: 20 },
        { header: 'Created At', key: 'createdAt', width: 20 },
        { header: 'Updated At', key: 'updatedAt', width: 20 },
    ];

    spaces.forEach(space => {
        sheet.addRow({
            ...space,
            createdAt: space.createdAt ? space.createdAt.toISOString() : '',
            updatedAt: space.updatedAt ? space.updatedAt.toISOString() : '',
            verifiedAt: space.verifiedAt ? space.verifiedAt.toISOString() : '',
            isVerified: space.isVerified ? 'Yes' : 'No',
            is_possible_duplicate: space.is_possible_duplicate ? 'Yes' : 'No',
            do_not_call: space.do_not_call ? 'Yes' : 'No',
        });
    });

    sheet.getRow(1).font = { bold: true };
}

async function addGenericVenueSheet(workbook: ExcelJS.Workbook, entityKey: string, statusFilter: string, state?: string, city?: string, includeDoNotCall = false) {
    const entry = GENERIC_VENUE_MODELS[entityKey];
    if (!entry) return;
    const { model, label } = entry;
    const sheet = workbook.addWorksheet(label);

    const where: any = { is_active: true };
    if (statusFilter === 'verified') where.isVerified = true;
    if (statusFilter === 'unverified') where.isVerified = false;
    if (state) where.state = { equals: state, mode: 'insensitive' };
    if (city) where.city = { equals: city, mode: 'insensitive' };
    applyDoNotCallFilter(where, includeDoNotCall);

    // Worst parking problems first, so the sales team works the sheet top-down.
    const rows = await model.findMany({ where, orderBy: [{ parking_priority: 'desc' }, { createdAt: 'desc' }] });

    sheet.columns = [
        { header: 'ID', key: 'id', width: 25 },
        { header: 'Place ID', key: 'place_id', width: 20 },
        { header: 'Name', key: 'name', width: 30 },
        { header: 'Address', key: 'address', width: 35 },
        { header: 'Locality', key: 'locality', width: 20 },
        { header: 'District', key: 'district', width: 15 },
        { header: 'City', key: 'city', width: 15 },
        { header: 'State', key: 'state', width: 15 },
        { header: 'Pincode', key: 'pincode', width: 10 },
        { header: 'Country', key: 'country', width: 15 },
        { header: 'Latitude', key: 'lat', width: 15 },
        { header: 'Longitude', key: 'lng', width: 15 },
        { header: 'Map URL', key: 'map_url', width: 25 },
        { header: 'Website', key: 'website', width: 25 },
        { header: 'Reception Phone', key: 'reception_phone', width: 15 },
        { header: 'International Phone', key: 'international_phone', width: 20 },
        { header: 'Email', key: 'generic_email', width: 25 },
        { header: 'Rating', key: 'rating', width: 10 },
        { header: 'Total Ratings', key: 'total_ratings', width: 15 },
        { header: 'Business Status', key: 'business_status', width: 15 },
        { header: 'Parking Score', key: 'parking_score', width: 15 },
        { header: 'Parking Priority', key: 'parking_priority', width: 14 },
        { header: 'Contact Status', key: 'status', width: 18 },
        { header: 'SPOC Name', key: 'spoc_name', width: 20 },
        { header: 'SPOC Phone', key: 'spoc_phone', width: 15 },
        { header: 'SPOC Email', key: 'spoc_email', width: 25 },
        { header: 'Challenges', key: 'challenges', width: 25 },
        { header: 'Internal Notes', key: 'notes_internal', width: 25 },
        { header: 'Possible Duplicate', key: 'is_possible_duplicate', width: 15 },
        { header: 'Do Not Call', key: 'do_not_call', width: 12 },
        { header: 'Verified', key: 'isVerified', width: 10 },
        { header: 'Verified At', key: 'verifiedAt', width: 20 },
        { header: 'First Seen At', key: 'first_seen_at', width: 20 },
        { header: 'Last Seen At', key: 'last_seen_at', width: 20 },
        { header: 'Created At', key: 'createdAt', width: 20 },
        { header: 'Updated At', key: 'updatedAt', width: 20 },
    ];

    rows.forEach((row: any) => {
        sheet.addRow({
            ...row,
            is_active: row.is_active ? 'Yes' : 'No',
            isVerified: row.isVerified ? 'Yes' : 'No',
            is_possible_duplicate: row.is_possible_duplicate ? 'Yes' : 'No',
            do_not_call: row.do_not_call ? 'Yes' : 'No',
            createdAt: row.createdAt ? row.createdAt.toISOString() : '',
            updatedAt: row.updatedAt ? row.updatedAt.toISOString() : '',
            first_seen_at: row.first_seen_at ? row.first_seen_at.toISOString() : '',
            last_seen_at: row.last_seen_at ? row.last_seen_at.toISOString() : '',
            verifiedAt: row.verifiedAt ? row.verifiedAt.toISOString() : '',
        });
    });

    sheet.getRow(1).font = { bold: true };
}

async function addUnifiedSheet(workbook: ExcelJS.Workbook, statusFilter: string, state?: string, city?: string, includeDoNotCall = false) {
    const sheet = workbook.addWorksheet('All Properties');

    sheet.columns = [
        { header: 'Type', key: 'propertyType', width: 15 },
        { header: 'ID', key: 'id', width: 20 },
        { header: 'Name', key: 'name', width: 30 },
        { header: 'City', key: 'city', width: 15 },
        { header: 'State', key: 'state', width: 15 },
        { header: 'Contact Status', key: 'status', width: 18 },
        { header: 'Verified', key: 'isVerified', width: 10 },
        { header: 'Operator/PM', key: 'operator_pm', width: 20 }, // Shared col
        { header: 'Email', key: 'email', width: 25 },
        { header: 'Phone', key: 'phone', width: 15 },
        { header: 'Address', key: 'address', width: 30 },
        { header: 'Possible Duplicate', key: 'is_possible_duplicate', width: 15 },
        { header: 'Do Not Call', key: 'do_not_call', width: 12 },
        { header: 'Created At', key: 'createdAt', width: 20 },
    ];

    // Fetch Parks
    const parkWhere: any = { is_active: true };
    if (statusFilter === 'verified') parkWhere.isVerified = true;
    if (statusFilter === 'unverified') parkWhere.isVerified = false;
    if (state) parkWhere.state = { equals: state, mode: 'insensitive' };
    if (city) parkWhere.city = { equals: city, mode: 'insensitive' };
    applyDoNotCallFilter(parkWhere, includeDoNotCall);
    const parks = await prismaInstance.newTechPark.findMany({ where: parkWhere });

    // Fetch Spaces
    const spaceWhere: any = {};
    if (statusFilter === 'verified') spaceWhere.isVerified = true;
    if (statusFilter === 'unverified') spaceWhere.isVerified = false;
    if (state) spaceWhere.state = { equals: state, mode: 'insensitive' };
    if (city) spaceWhere.city = { equals: city, mode: 'insensitive' };
    applyDoNotCallFilter(spaceWhere, includeDoNotCall);
    const spaces = await prismaInstance.coworkingSpace.findMany({ where: spaceWhere });

    parks.forEach(park => {
        sheet.addRow({
            propertyType: 'Tech Park',
            id: park.id,
            name: park.name,
            city: park.city,
            state: park.state,
            status: park.status,
            isVerified: park.isVerified ? 'Yes' : 'No',
            operator_pm: park.property_manager_name || park.operator_name,
            email: park.property_manager_email || park.generic_email,
            phone: park.spoc_phone || park.reception_phone,
            address: park.address_line1 ? `${park.address_line1}, ${park.address_line2 || ''}` : '',
            is_possible_duplicate: park.is_possible_duplicate ? 'Yes' : 'No',
            do_not_call: park.do_not_call ? 'Yes' : 'No',
            createdAt: park.createdAt ? park.createdAt.toISOString() : '',
        });
    });

    spaces.forEach(space => {
        sheet.addRow({
            propertyType: 'Coworking Space',
            id: space.id,
            name: space.name,
            city: space.city,
            state: space.state,
            status: space.status,
            isVerified: space.isVerified ? 'Yes' : 'No',
            operator_pm: space.operator_name,
            email: space.generic_email,
            phone: space.contact_phone,
            address: space.address,
            is_possible_duplicate: space.is_possible_duplicate ? 'Yes' : 'No',
            do_not_call: space.do_not_call ? 'Yes' : 'No',
            createdAt: space.createdAt ? space.createdAt.toISOString() : '',
        });
    });

    // Fetch and append the 4 generic venue types (Malls/Hospitals/Stadiums/Airports)
    for (const { model, singularLabel } of Object.values(GENERIC_VENUE_MODELS)) {
        const venueWhere: any = { is_active: true };
        if (statusFilter === 'verified') venueWhere.isVerified = true;
        if (statusFilter === 'unverified') venueWhere.isVerified = false;
        if (state) venueWhere.state = { equals: state, mode: 'insensitive' };
        if (city) venueWhere.city = { equals: city, mode: 'insensitive' };
        applyDoNotCallFilter(venueWhere, includeDoNotCall);
        const venues = await model.findMany({ where: venueWhere });

        venues.forEach((venue: any) => {
            sheet.addRow({
                propertyType: singularLabel,
                id: venue.id,
                name: venue.name,
                city: venue.city,
                state: venue.state,
                status: venue.status,
                isVerified: venue.isVerified ? 'Yes' : 'No',
                operator_pm: venue.spoc_name,
                email: venue.generic_email,
                phone: venue.spoc_phone || venue.reception_phone,
                address: venue.address,
                is_possible_duplicate: venue.is_possible_duplicate ? 'Yes' : 'No',
                do_not_call: venue.do_not_call ? 'Yes' : 'No',
                createdAt: venue.createdAt ? venue.createdAt.toISOString() : '',
            });
        });
    }

    sheet.getRow(1).font = { bold: true };
}

import puppeteer from 'puppeteer';

async function generatePdf(res: Response, entityType: string, statusFilter: string, state?: string, city?: string, includeDoNotCall = false) {
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();

    let htmlContent = `
    <html>
    <head>
        <style>
            body { font-family: Arial, sans-serif; padding: 20px; font-size: 10px; }
            h1 { text-align: center; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 5px; text-align: left; }
            th { background-color: #f2f2f2; }
            .meta { margin-bottom: 20px; }
        </style>
    </head>
    <body>
        <h1>${escapeHtml(
            entityType === 'all' ? 'All Properties' :
            entityType === 'techPark' ? 'Tech Parks' :
            entityType === 'coworkingSpace' ? 'Coworking Spaces' :
            GENERIC_VENUE_MODELS[entityType]?.label ?? entityType
        )} Report</h1>
        <p class="meta"><strong>Status:</strong> ${escapeHtml(statusFilter)} | <strong>State:</strong> ${escapeHtml(state) || 'All'} | <strong>City:</strong> ${escapeHtml(city) || 'All'}</p>
        <table>
            <thead>
                <tr>
                    <th>Type</th>
                    <th>Name</th>
                    <th>City/State</th>
                    <th>Status</th>
                    <th>Verified</th>
                    <th>PM/Operator</th>
                    <th>Contact</th>
                </tr>
            </thead>
            <tbody>
    `;

    // Fetch Data
    const parkWhere: any = { is_active: true };
    if (statusFilter === 'verified') parkWhere.isVerified = true;
    if (statusFilter === 'unverified') parkWhere.isVerified = false;
    if (state) parkWhere.state = { equals: state, mode: 'insensitive' };
    if (city) parkWhere.city = { equals: city, mode: 'insensitive' };
    applyDoNotCallFilter(parkWhere, includeDoNotCall);

    const spaceWhere: any = {};
    if (statusFilter === 'verified') spaceWhere.isVerified = true;
    if (statusFilter === 'unverified') spaceWhere.isVerified = false;
    if (state) spaceWhere.state = { equals: state, mode: 'insensitive' };
    if (city) spaceWhere.city = { equals: city, mode: 'insensitive' };
    applyDoNotCallFilter(spaceWhere, includeDoNotCall);

    let rows = '';

    if (entityType === 'techPark' || entityType === 'all') {
        const parks = await prismaInstance.newTechPark.findMany({ where: parkWhere });
        parks.forEach(park => {
            const contact = park.spoc_phone || park.property_manager_email || park.reception_phone || '-';
            const operator = park.property_manager_name || park.operator_name || '-';
            rows += `
                <tr>
                    <td>Tech Park</td>
                    <td>${escapeHtml(park.name)}</td>
                    <td>${escapeHtml(park.city || '-')}, ${escapeHtml(park.state || '-')}</td>
                    <td>${escapeHtml(park.status || '-')}</td>
                    <td>${park.isVerified ? 'Yes' : 'No'}</td>
                    <td>${escapeHtml(operator)}</td>
                    <td>${escapeHtml(contact)}</td>
                </tr>
            `;
        });
    }

    if (entityType === 'coworkingSpace' || entityType === 'all') {
        const spaces = await prismaInstance.coworkingSpace.findMany({ where: spaceWhere });
        spaces.forEach(space => {
            const contact = space.contact_phone || space.generic_email || '-';
            const operator = space.operator_name || '-';
            rows += `
                <tr>
                    <td>Coworking</td>
                    <td>${escapeHtml(space.name)}</td>
                    <td>${escapeHtml(space.city || '-')}, ${escapeHtml(space.state || '-')}</td>
                    <td>${escapeHtml(space.status || '-')}</td>
                    <td>${space.isVerified ? 'Yes' : 'No'}</td>
                    <td>${escapeHtml(operator)}</td>
                    <td>${escapeHtml(contact)}</td>
                </tr>
            `;
        });
    }

    const genericKeys = entityType === 'all' ? Object.keys(GENERIC_VENUE_MODELS) : (entityType in GENERIC_VENUE_MODELS ? [entityType] : []);
    for (const key of genericKeys) {
        const entry = GENERIC_VENUE_MODELS[key];
        if (!entry) continue;
        const { model, singularLabel } = entry;
        const venueWhere: any = { is_active: true };
        if (statusFilter === 'verified') venueWhere.isVerified = true;
        if (statusFilter === 'unverified') venueWhere.isVerified = false;
        if (state) venueWhere.state = { equals: state, mode: 'insensitive' };
        if (city) venueWhere.city = { equals: city, mode: 'insensitive' };
        applyDoNotCallFilter(venueWhere, includeDoNotCall);
        const venues = await model.findMany({ where: venueWhere });
        venues.forEach((venue: any) => {
            const contact = venue.spoc_phone || venue.reception_phone || venue.generic_email || '-';
            const operator = venue.spoc_name || '-';
            rows += `
                <tr>
                    <td>${escapeHtml(singularLabel)}</td>
                    <td>${escapeHtml(venue.name)}</td>
                    <td>${escapeHtml(venue.city || '-')}, ${escapeHtml(venue.state || '-')}</td>
                    <td>${escapeHtml(venue.status || '-')}</td>
                    <td>${venue.isVerified ? 'Yes' : 'No'}</td>
                    <td>${escapeHtml(operator)}</td>
                    <td>${escapeHtml(contact)}</td>
                </tr>
            `;
        });
    }

    htmlContent += rows + `
            </tbody>
        </table>
    </body>
    </html>
    `;

    await page.setContent(htmlContent);
    const pdfBuffer = await page.pdf({ format: 'A4', landscape: true, printBackground: true });

    await browser.close();

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `report_${entityType}_${timestamp}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
}

