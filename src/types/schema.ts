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
    marketingStatus?: 'subscribed' | 'unsubscribed' | 'cleaned' | 'archived';
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
    userId?: Id;

    status: 'open' | 'won' | 'lost' | 'desqualificado';
    priority: 'low' | 'medium' | 'high';
    probability?: number;
    expectedCloseDate?: string;
    wonAt?: string; // ISO Date string
    lostAt?: string; // ISO Date string
    lostReason?: string;
    disqualifiedAt?: string; // ISO Date string
    disqualifiedReason?: string;
    createdAt: string;
    updatedAt: string;

    // Cadence Automation
    leadSequenceStarted?: boolean;

    // External Links
    instagramUrl?: string;
    adLibraryUrl?: string;
}

// Tipos de atividades REAIS (aparecem no módulo Atividades)
export type ActivityType = 'call' | 'meeting' | 'task' | 'email' | 'message' | 'instagram' | 'analysis' | 'audit';

// Tipos de eventos internos (não são atividades)
export type InternalEventType = 'note' | 'fileUpload' | 'status_change' | 'followup';

export interface Activity {
    id: Id;
    type: ActivityType | InternalEventType;
    title: string;
    description?: string;
    result?: string; // Outcome of the activity
    notes?: string;  // Detailed notes
    priority?: 'low' | 'medium' | 'high';

    // Relations (Polymorphic-ish)
    dealId?: Id;
    contactId?: Id;
    companyId?: Id;
    ownerId?: Id;

    dueDate?: string; // ISO Date string
    duration?: number;
    completed: boolean;
    status: 'pending' | 'completed' | 'canceled'; // Added for Cadence
    originStage?: string; // ex: "LEAD"
    sequenceId?: string;
    isAutomatic?: boolean;
    tooltipScript?: string;
    sequenceStep?: number;
    createdAt: string;
    updatedAt?: string;
    completedAt?: string;
    houveResposta?: boolean;
}

export interface DealAnalytics {
    dealId: string;
    createdAt: string;
    closedAt?: string;
    statusFinal: 'open' | 'won' | 'lost' | 'desqualificado';
    stageAtual: string;
    etapaOndePerdeu?: string;
    diasTotaisNoFunil: number;
    diasAteReuniao?: number;
    diasAteFechamento?: number;
    totalAtividades: number;
    totalMensagens: number;
    totalEmails: number;
    totalLigacoes: number;
    totalAnalises: number;
    totalAuditorias: number;
    totalContatosRealizados: number;
    contatosAteReuniao?: number;
    contatosAteFechamento?: number;
    totalRespostas: number;
    respondeuPrimeiroContato: boolean;
    ultimoContatoEm?: string;
    tempoMedioEntreContatos?: number;
    canalMaisUsado?: string;
    updatedAt: string;
}

export interface StageSequence {
    id: Id;
    stageName: string;
    dayOffset: number;
    activityType: ActivityType;
    defaultTitle: string;
    defaultDescription?: string;
    orderIndex: number;
    isActive: boolean;
    tooltipScript?: string;
}

export interface CadenceTemplate {
    id: Id;
    tag: string;
    step: number;
    type: ActivityType | InternalEventType;
    title: string;
    description: string;
    script: string;
    days: number;
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

// Log do Negócio (Execução/Timeline)
export type LogType = 'activity_note' | 'system' | 'manual_note';

export interface DealLog {
    id: Id;
    dealId: Id;
    activityId?: Id;
    content: string;
    logType: LogType;
    createdBy: Id;
    createdAt: string;
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

export interface EmailTemplate {
    id: Id;
    name: string;
    htmlContent: string;
    jsonContent?: string;
    thumbnail?: string;
    category?: string;
    isPublic: boolean;
    createdAt: string;
}

export interface Campaign {
    id: Id;
    name: string;
    subject: string;
    fromName: string;
    fromEmail: string;
    replyTo?: string;
    templateId?: Id;
    listId?: string;
    content?: string;
    recipients?: { email: string; personId?: string; dealId?: string }[];
    status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'paused' | 'failed';
    scheduledAt?: string;
    sentAt?: string;
    sentCount: number;
    deliveredCount: number;
    openedCount: number;
    clickedCount: number;
    createdBy: Id;
    createdAt: string;
}

export interface CampaignSender {
    id: Id;
    name: string;
    email: string;
    isVerified: boolean;
    verificationToken?: string;
    createdAt: string;
}
