import { Request, Response } from "express";
import { prismaInstance } from "@repo/db";
import ExcelJS from "exceljs";
import { getQueryString } from "../utils/queryUtils";
import { sendSafeErrorResponse } from "../utils/safeErrorResponse";

export const exportData = async (req: Request, res: Response) => {
    try {
        const entityType = getQueryString(req.query.entityType) || 'all'; // techPark, coworkingSpace, all
        const status = getQueryString(req.query.status) || 'all'; // verified, unverified, all
        const state = getQueryString(req.query.state);
        const city = getQueryString(req.query.city);
        const format = getQueryString(req.query.format) || 'excel'; // excel, csv, pdf

        if (format === 'pdf') {
            await generatePdf(res, entityType, status, state, city);
            return;
        }

        const workbook = new ExcelJS.Workbook();

        if (format === 'csv' && entityType === 'all') {
            await addUnifiedSheet(workbook, status, state, city);
        } else {
            if (entityType === 'techPark' || entityType === 'all') {
                await addTechParkSheet(workbook, status, state, city);
            }

            if (entityType === 'coworkingSpace' || entityType === 'all') {
                await addCoworkingSheet(workbook, status, state, city);
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

async function addTechParkSheet(workbook: ExcelJS.Workbook, statusFilter: string, state?: string, city?: string) {
    const sheet = workbook.addWorksheet('Tech Parks');

    const where: any = { is_active: true };
    if (statusFilter === 'verified') where.isVerified = true;
    if (statusFilter === 'unverified') where.isVerified = false;
    if (state) where.state = { equals: state, mode: 'insensitive' };
    if (city) where.city = { equals: city, mode: 'insensitive' };

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
        { header: 'Seating Capacity', key: 'seating_capacity', width: 15 },
        { header: 'Challenges', key: 'challenges', width: 25 },
        { header: 'First Seen At', key: 'first_seen_at', width: 20 },
        { header: 'Last Seen At', key: 'last_seen_at', width: 20 },
        { header: 'Status', key: 'status', width: 15 },
        { header: 'Review Status', key: 'reviewStatus', width: 15 },
        { header: 'Duplication Score', key: 'duplication_score', width: 15 },
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
            createdAt: park.createdAt ? park.createdAt.toISOString() : '',
            updatedAt: park.updatedAt ? park.updatedAt.toISOString() : '',
            first_seen_at: park.first_seen_at ? park.first_seen_at.toISOString() : '',
            last_seen_at: park.last_seen_at ? park.last_seen_at.toISOString() : '',
            verifiedAt: park.verifiedAt ? park.verifiedAt.toISOString() : '',
        });
    });

    sheet.getRow(1).font = { bold: true };
}

async function addCoworkingSheet(workbook: ExcelJS.Workbook, statusFilter: string, state?: string, city?: string) {
    const sheet = workbook.addWorksheet('Coworking Spaces');

    const where: any = {};
    if (statusFilter === 'verified') where.isVerified = true;
    if (statusFilter === 'unverified') where.isVerified = false;
    if (state) where.state = { equals: state, mode: 'insensitive' };
    if (city) where.city = { equals: city, mode: 'insensitive' };

    const spaces = await prismaInstance.coworkingSpace.findMany({
        where,
        orderBy: { createdAt: 'desc' },
    });

    sheet.columns = [
        { header: 'ID', key: 'id', width: 20 },
        { header: 'Name', key: 'name', width: 30 },
        { header: 'City', key: 'city', width: 15 },
        { header: 'State', key: 'state', width: 15 },
        { header: 'District', key: 'district', width: 15 },
        { header: 'Pincode', key: 'pincode', width: 10 },
        { header: 'Country', key: 'country', width: 15 },
        { header: 'Address', key: 'address', width: 25 },
        { header: 'Latitude', key: 'lat', width: 15 },
        { header: 'Longitude', key: 'lng', width: 15 },
        { header: 'Status', key: 'status', width: 15 },
        { header: 'Verified', key: 'isVerified', width: 10 },
        { header: 'Operator', key: 'operator_name', width: 20 },
        { header: 'Campus Brand', key: 'campus_brand', width: 20 },
        { header: 'Legal Entity', key: 'legal_entity', width: 20 },
        { header: 'Campus Size Hint', key: 'campus_size_hint', width: 20 },
        { header: 'Email', key: 'generic_email', width: 25 },
        { header: 'Phone', key: 'contact_phone', width: 15 },
        { header: 'International Phone', key: 'international_phone', width: 20 },
        { header: 'Verified By', key: 'verifiedByUserId', width: 20 },
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
            isVerified: space.isVerified ? 'Yes' : 'No'
        });
    });

    sheet.getRow(1).font = { bold: true };
}

async function addUnifiedSheet(workbook: ExcelJS.Workbook, statusFilter: string, state?: string, city?: string) {
    const sheet = workbook.addWorksheet('All Properties');

    sheet.columns = [
        { header: 'Type', key: 'propertyType', width: 15 },
        { header: 'ID', key: 'id', width: 20 },
        { header: 'Name', key: 'name', width: 30 },
        { header: 'City', key: 'city', width: 15 },
        { header: 'State', key: 'state', width: 15 },
        { header: 'Status', key: 'status', width: 15 },
        { header: 'Verified', key: 'isVerified', width: 10 },
        { header: 'Operator/PM', key: 'operator_pm', width: 20 }, // Shared col
        { header: 'Email', key: 'email', width: 25 },
        { header: 'Phone', key: 'phone', width: 15 },
        { header: 'Address', key: 'address', width: 30 },
        { header: 'Created At', key: 'createdAt', width: 20 },
    ];

    // Fetch Parks
    const parkWhere: any = { is_active: true };
    if (statusFilter === 'verified') parkWhere.isVerified = true;
    if (statusFilter === 'unverified') parkWhere.isVerified = false;
    if (state) parkWhere.state = { equals: state, mode: 'insensitive' };
    if (city) parkWhere.city = { equals: city, mode: 'insensitive' };
    const parks = await prismaInstance.newTechPark.findMany({ where: parkWhere });

    // Fetch Spaces
    const spaceWhere: any = {};
    if (statusFilter === 'verified') spaceWhere.isVerified = true;
    if (statusFilter === 'unverified') spaceWhere.isVerified = false;
    if (state) spaceWhere.state = { equals: state, mode: 'insensitive' };
    if (city) spaceWhere.city = { equals: city, mode: 'insensitive' };
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
            createdAt: space.createdAt ? space.createdAt.toISOString() : '',
        });
    });

    sheet.getRow(1).font = { bold: true };
}

import puppeteer from 'puppeteer';

async function generatePdf(res: Response, entityType: string, statusFilter: string, state?: string, city?: string) {
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
        <h1>${entityType === 'all' ? 'All Properties' : entityType === 'techPark' ? 'Tech Parks' : 'Coworking Spaces'} Report</h1>
        <p class="meta"><strong>Status:</strong> ${statusFilter} | <strong>State:</strong> ${state || 'All'} | <strong>City:</strong> ${city || 'All'}</p>
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

    const spaceWhere: any = {};
    if (statusFilter === 'verified') spaceWhere.isVerified = true;
    if (statusFilter === 'unverified') spaceWhere.isVerified = false;
    if (state) spaceWhere.state = { equals: state, mode: 'insensitive' };
    if (city) spaceWhere.city = { equals: city, mode: 'insensitive' };

    let rows = '';

    if (entityType === 'techPark' || entityType === 'all') {
        const parks = await prismaInstance.newTechPark.findMany({ where: parkWhere });
        parks.forEach(park => {
            const contact = park.spoc_phone || park.property_manager_email || park.reception_phone || '-';
            const operator = park.property_manager_name || park.operator_name || '-';
            rows += `
                <tr>
                    <td>Tech Park</td>
                    <td>${park.name}</td>
                    <td>${park.city || '-'}, ${park.state || '-'}</td>
                    <td>${park.status || '-'}</td>
                    <td>${park.isVerified ? 'Yes' : 'No'}</td>
                    <td>${operator}</td>
                    <td>${contact}</td>
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
                    <td>${space.name}</td>
                    <td>${space.city || '-'}, ${space.state || '-'}</td>
                    <td>${space.status || '-'}</td>
                    <td>${space.isVerified ? 'Yes' : 'No'}</td>
                    <td>${operator}</td>
                    <td>${contact}</td>
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

