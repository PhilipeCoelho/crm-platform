export interface ContentColumn {
    id: string;
    userId?: string;
    name: string;
    orderIndex: number;
    createdAt?: string;
    updatedAt?: string;
}

export interface ContentCard {
    id: string;
    userId?: string;
    columnId: string;
    title: string;
    description: string;
    completed?: boolean;
    dueDate?: string;
    orderIndex: number;
    createdAt: string;
    updatedAt?: string;
}

export const DEFAULT_CONTENT_COLUMNS = [
    { name: 'Ideias', orderIndex: 0 },
    { name: 'Em desenvolvimento', orderIndex: 1 },
    { name: 'Pronto para gravar', orderIndex: 2 },
];
