export interface TechParkClient {
    id: string;
    companyName: string;
    contactPerson: string;
    email: string;
    phone: string;
    techParkName: string;
    location: string;
    industry: string;
    employeeCount: number;
    revenue: string;
    status: ClientStatus;
    priority: Priority;
    lastContact: string;
    nextFollowUp?: string;
    rating?: number;
    notes?: string;
    createdAt: string;
    updatedAt: string;
    originalData?: unknown; // Store original API data
  }
  
  export type ClientStatus = 
    | 'in-progress'
    | 'contacted' 
    | 'meeting-scheduled' 
    | 'demo-given' 
    | 'proposal-sent' 
    | 'closed-won' 
    | 'closed-lost';
  
  export type Priority = 'low' | 'medium' | 'high';
  
  export interface ContactLog {
    id: string;
    companyId: string;
    type: 'CALL' | 'EMAIL' | 'MEETING' | 'DEMO' | 'PROPOSAL';
    status: 'NOT_CONTACTED' | 'CONTACTED' | 'INTERESTED' | 'MEETING_SCHEDULED' | 'PROPOSAL_SENT' | 'CLOSED';
    subject?: string; // Quick notes
    notes: string; // Detailed notes
    timestamp?: string; // When it happened
    attachments?: unknown; // files/images as JSON
    createdAt: string;
    createdBy: string; // who logged it
    updatedAt?: string;
    updatedBy?: string;
  }
  
  export interface ChartData {
    labels: string[];
    datasets: {
      label: string;
      data: number[];
      backgroundColor?: string[];
      borderColor?: string[];
      borderWidth?: number;
    }[];
  }
  
  export type ChartType = 'bar' | 'pie' | 'line' | 'radar' | 'wave';
  
  export interface User {
    id: string;
    name: string;
    role: 'admin' | 'team-member';
  }
  
  export interface DashboardFilters {
    status?: ClientStatus[];
    priority?: Priority[];
    industry?: string[];
    search?: string;
  }

  // ContactLog interface defined above
