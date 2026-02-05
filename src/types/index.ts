export type Id = string | number;

export interface Column {
    id: Id;
    title: string;
}

export interface Task {
    id: Id;
    columnId: Id;
    content: string;
    companyName?: string;
    value?: number;
    priority?: 'low' | 'medium' | 'high';
}

export interface Contact {
    id: Id;
    name: string;
    email: string;
    phone?: string;
    role?: string;
    companyId?: Id;
    companyName?: string;
    lastActivity?: string; // Date string
    status: 'active' | 'inactive' | 'lead';
}
