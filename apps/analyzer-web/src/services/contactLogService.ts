import { axiosInstance } from '../config/axios';
import type { VenueSegment } from './genericVenueService';

// Backend contact-log routes use singular venue-type segments (mall/hospital/...)
// while the rest of the app uses the plural VenueSegment ("malls"/"hospitals"/...).
const VENUE_SEGMENT_TO_ROUTE: Record<VenueSegment, string> = {
    malls: 'mall',
    hospitals: 'hospital',
    stadiums: 'stadium',
    airports: 'airport',
};

export interface ContactLogData {
    type: 'CALL' | 'EMAIL' | 'MEETING' | 'DEMO' | 'PROPOSAL';
    status: 'NOT_CONTACTED' | 'CONTACTED' | 'INTERESTED' | 'MEETING_SCHEDULED' | 'PROPOSAL_SENT' | 'IN_PROGRESS' | 'CLOSED';
    subject?: string;
    notes: string;
    timestamp?: string;
    attachments?: unknown;
    createdBy: string;
}

export interface ContactLog extends ContactLogData {
    id: string;
    companyId: string;
    createdAt: string;
    updatedAt?: string;
    updatedBy?: string;
}

export interface ContactLogStats {
    totalLogs: number;
    lastContact?: {
        createdAt: string;
        type: string;
        status: string;
    };
    breakdown: Array<{
        type: string;
        status: string;
        _count: {
            id: number;
        };
    }>;
}

class ContactLogService {
    private baseUrl = '/contact-logs';

    // Get all contact logs for a company
    async getContactLogsByCompany(companyId: string): Promise<ContactLog[]> {
        try {
            const response = await axiosInstance.get(`${this.baseUrl}/company/${companyId}`);
            return response.data.data;
        } catch (error) {
            console.error('Error fetching contact logs:', error);
            throw error;
        }
    }

    // Get contact log statistics for a company
    async getContactLogStats(companyId: string): Promise<ContactLogStats> {
        try {
            const response = await axiosInstance.get(`${this.baseUrl}/company/${companyId}/stats`);
            return response.data.data;
        } catch (error) {
            console.error('Error fetching contact log stats:', error);
            throw error;
        }
    }

    // Get a specific contact log by ID
    async getContactLogById(logId: string): Promise<ContactLog> {
        try {
            const response = await axiosInstance.get(`${this.baseUrl}/${logId}`);
            return response.data.data;
        } catch (error) {
            console.error('Error fetching contact log:', error);
            throw error;
        }
    }

    // Create a new contact log
    async createContactLog(companyId: string, logData: ContactLogData): Promise<ContactLog> {
        try {
            const response = await axiosInstance.post(`${this.baseUrl}/company/${companyId}`, logData);
            return response.data.data;
        } catch (error) {
            console.error('Error creating contact log:', error);
            throw error;
        }
    }

    async getCoworkingContactLogsByCompany(companyId: string): Promise<ContactLog[]> {
        try {
            const response = await axiosInstance.get(`${this.baseUrl}/coworking-company/${companyId}`);
            return response.data.data;
        } catch (error) {
            console.error('Error fetching coworking contact logs:', error);
            throw error;
        }
    }

    async getCoworkingContactLogStats(companyId: string): Promise<ContactLogStats> {
        try {
            const response = await axiosInstance.get(`${this.baseUrl}/coworking-company/${companyId}/stats`);
            return response.data.data;
        } catch (error) {
            console.error('Error fetching coworking contact log stats:', error);
            throw error;
        }
    }

    async createCoworkingContactLog(companyId: string, logData: ContactLogData): Promise<ContactLog> {
        try {
            const response = await axiosInstance.post(`${this.baseUrl}/coworking-company/${companyId}`, logData);
            return response.data.data;
        } catch (error) {
            console.error('Error creating coworking contact log:', error);
            throw error;
        }
    }

    // Get all contact logs for a generic venue (mall/hospital/stadium/airport)
    async getContactLogsByVenue(venueType: VenueSegment, venueId: string): Promise<ContactLog[]> {
        try {
            const response = await axiosInstance.get(`${this.baseUrl}/${VENUE_SEGMENT_TO_ROUTE[venueType]}/${venueId}`);
            return response.data.data;
        } catch (error) {
            console.error('Error fetching venue contact logs:', error);
            throw error;
        }
    }

    async getVenueContactLogStats(venueType: VenueSegment, venueId: string): Promise<ContactLogStats> {
        try {
            const response = await axiosInstance.get(`${this.baseUrl}/${VENUE_SEGMENT_TO_ROUTE[venueType]}/${venueId}/stats`);
            return response.data.data;
        } catch (error) {
            console.error('Error fetching venue contact log stats:', error);
            throw error;
        }
    }

    async createVenueContactLog(venueType: VenueSegment, venueId: string, logData: ContactLogData): Promise<ContactLog> {
        try {
            const response = await axiosInstance.post(`${this.baseUrl}/${VENUE_SEGMENT_TO_ROUTE[venueType]}/${venueId}`, logData);
            return response.data.data;
        } catch (error) {
            console.error('Error creating venue contact log:', error);
            throw error;
        }
    }

    // Update a contact log
    async updateContactLog(logId: string, updates: Partial<ContactLogData> & { updatedBy: string }): Promise<ContactLog> {
        try {
            const response = await axiosInstance.patch(`${this.baseUrl}/${logId}`, updates);
            return response.data.data;
        } catch (error) {
            console.error('Error updating contact log:', error);
            throw error;
        }
    }

    // Delete a contact log
    async deleteContactLog(logId: string): Promise<void> {
        try {
            await axiosInstance.delete(`${this.baseUrl}/${logId}`);
        } catch (error) {
            console.error('Error deleting contact log:', error);
            throw error;
        }
    }
}

export const contactLogService = new ContactLogService();
export default contactLogService; 
