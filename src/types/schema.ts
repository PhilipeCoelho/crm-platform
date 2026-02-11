export type Id = string;

export interface User {
    id: Id;
    name: string;
    email: string;
    role: 'owner' | 'admin' | 'user';
    avatar?: string;
}

export interface Company {
    id: Id;
    name: string;
    website?: string;
    phone?: string;
    email?: string;
    createdAt: string;
}

export interface Contact {
    id: Id;
    name: string;
    email: string;
    phone?: string;
    role?: string; // Job title
    companyId?: Id; // Relation to Company
    ownerId?: Id;   // Relation to User
    lastActivity?: string;
    status: 'active' | 'inactive' | 'lead';
    createdAt: string;
}

export interface Deal {
    id: Id;
    title: string;
    value: number;
    currency: string;
    pipelineId: string;
    stageId: string; // Replaces columnId

    tags?: string[];
    source?: string;
    sourceId?: string;
    position?: number;

    // Relations
    contactId?: Id;
    companyId?: Id;
    ownerId?: Id;

    status: 'open' | 'won' | 'lost';
    priority: 'low' | 'medium' | 'high';
    probability?: number;
    expectedCloseDate?: string;
    wonAt?: string; // ISO Date string
    lostAt?: string; // ISO Date string
    lostReason?: string;
    createdAt: string;
    updatedAt: string;
}

export interface Activity {
    id: Id;
    type: 'call' | 'meeting' | 'task' | 'email' | 'followup' | 'note' | 'fileUpload' | 'message';
    title: string;
    description?: string;
    result?: string; // Outcome of the activity
    notes?: string;  // Detailed notes

    // Relations (Polymorphic-ish)
    dealId?: Id;
    contactId?: Id;
    companyId?: Id;
    ownerId?: Id;

    dueDate?: string; // ISO Date string
    duration?: number;
    completed: boolean;
    createdAt: string;
}

export interface Stage {
    id: Id;
    pipelineId: Id;
    title: string;
    probability?: number;
    color?: string;
}

export interface Pipeline {
    id: Id;
    name: string;
    stages: Stage[];
}

// Initial Pipelines Configuration
export const DEFAULT_PIPELINES: Record<string, Pipeline> = {
    'sales': {
        id: 'sales',
        name: 'Funil de Prospeção',
        stages: [
            { id: "new", pipelineId: 'sales', title: "Lead Novo", probability: 10 },
            { id: "contacted", pipelineId: 'sales', title: "Contactado", probability: 30 },
            { id: "proposal", pipelineId: 'sales', title: "Proposta Enviada", probability: 60 },
            { id: "negotiation", pipelineId: 'sales', title: "Negociação", probability: 80 },
        ]
    },
    'cold_leads': {
        id: 'cold_leads',
        name: 'Leads Frios',
        stages: [
            { id: "new", pipelineId: 'cold_leads', title: "Lead Novo", probability: 10 },
            { id: "contacted", pipelineId: 'cold_leads', title: "Contactado", probability: 30 },
            { id: "proposal", pipelineId: 'cold_leads', title: "Proposta Enviada", probability: 60 },
            { id: "negotiation", pipelineId: 'cold_leads', title: "Negociação", probability: 80 },
        ]
    }
};
