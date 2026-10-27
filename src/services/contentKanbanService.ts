import { supabase } from '@/lib/supabase';
import { ContentColumn, ContentCard } from '@/types/contentKanban';

// Constantes de Identificação e Armazenamento
export const DEFAULT_USER_ID = '9469fb08-7de5-405e-a4e7-d83cf818ea1e';

const STORAGE_KEYS_CARDS = [
    'vamuss_content_kanban_cards_v3',
    'vamuss_content_kanban_cards_v2',
    'vamuss_content_cards_v2',
    'vamuss_content_cards'
];

const STORAGE_KEYS_COLUMNS = [
    'vamuss_content_kanban_columns_v3',
    'vamuss_content_kanban_columns_v2',
    'vamuss_content_columns_v2',
    'vamuss_content_columns'
];

const STABLE_DEFAULT_COLUMNS: ContentColumn[] = [
    { id: 'col-ideias', name: 'Ideias', orderIndex: 0 },
    { id: 'col-em-desenvolvimento', name: 'Em desenvolvimento', orderIndex: 1 },
    { id: 'col-pronto-para-gravar', name: 'Pronto para gravar', orderIndex: 2 }
];

export interface ContentKanbanData {
    columns: ContentColumn[];
    cards: ContentCard[];
    dbConnected: boolean;
    dbError?: string | null;
}

function getEffectiveUserId(userId?: string): string {
    if (userId && userId.trim() && userId.trim() !== 'undefined' && userId.trim() !== 'null') {
        return userId.trim();
    }
    return DEFAULT_USER_ID;
}

/**
 * Lê os dados do armazenamento local varrendo chaves de fallback para garantir
 * que nenhum dado anterior seja perdido.
 */
function getLocalData(userId?: string): { columns: ContentColumn[]; cards: ContentCard[] } {
    const effectiveUid = getEffectiveUserId(userId);
    let columns: ContentColumn[] = [];
    let cards: ContentCard[] = [];

    // 1. Procurar cartões em qualquer chave existente
    for (const key of STORAGE_KEYS_CARDS) {
        try {
            const raw = localStorage.getItem(`${key}_${effectiveUid}`) || localStorage.getItem(key);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    cards = parsed;
                    break;
                }
            }
        } catch {
            // continua para o próximo fallback
        }
    }

    // 2. Procurar colunas em qualquer chave existente
    for (const key of STORAGE_KEYS_COLUMNS) {
        try {
            const raw = localStorage.getItem(`${key}_${effectiveUid}`) || localStorage.getItem(key);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    columns = parsed;
                    break;
                }
            }
        } catch {
            // continua para o próximo fallback
        }
    }

    return { columns, cards };
}

/**
 * Salva imediatamente em múltiplas chaves do localStorage de forma síncrona,
 * garantindo resiliência total contra perdas acidentais.
 */
function saveLocalData(columns: ContentColumn[], cards: ContentCard[], userId?: string) {
    try {
        const effectiveUid = getEffectiveUserId(userId);
        const colsStr = JSON.stringify(columns);
        const cardsStr = JSON.stringify(cards);

        for (const key of STORAGE_KEYS_COLUMNS) {
            localStorage.setItem(`${key}_${effectiveUid}`, colsStr);
            localStorage.setItem(key, colsStr);
        }

        for (const key of STORAGE_KEYS_CARDS) {
            localStorage.setItem(`${key}_${effectiveUid}`, cardsStr);
            localStorage.setItem(key, cardsStr);
        }
    } catch (e) {
        console.warn('[ContentKanban] Falha ao gravar cache local:', e);
    }
}

/**
 * Sincroniza em segundo plano com o servidor backend local e com o Supabase.
 */
async function syncRemote(columns: ContentColumn[], cards: ContentCard[], userId?: string) {
    const effectiveUid = getEffectiveUserId(userId);

    // 1. Backup no servidor backend de desenvolvimento (arquivo local data/content_kanban.json)
    try {
        await fetch('/api/content-kanban', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ columns, cards })
        });
    } catch {
        // silencioso
    }

    // 2. Sincronização em nuvem com Supabase
    try {
        // Sincronizar colunas
        for (const col of columns) {
            await supabase.from('content_columns').upsert({
                id: col.id.startsWith('col-') ? undefined : col.id,
                user_id: effectiveUid,
                name: col.name,
                order_index: col.orderIndex,
                updated_at: new Date().toISOString()
            });
        }

        // Sincronizar cartões
        for (const card of cards) {
            await supabase.from('content_cards').upsert({
                id: card.id.startsWith('card-') ? undefined : card.id,
                user_id: effectiveUid,
                column_id: card.columnId.startsWith('col-') ? undefined : card.columnId,
                title: card.title,
                description: card.description || '',
                completed: !!card.completed,
                due_date: card.dueDate || null,
                order_index: card.orderIndex,
                updated_at: new Date().toISOString()
            });
        }
    } catch (e) {
        console.warn('[ContentKanban] Sincronização em nuvem em segundo plano:', e);
    }
}

export const contentKanbanService = {
    /**
     * Carrega os dados com tripla redundância:
     * 1. Supabase Cloud
     * 2. Backend Local (/api/content-kanban)
     * 3. LocalStorage
     * 
     * Regra de ouro: se uma fonte retornar vazia, NUNCA apaga dados das fontes com conteúdo!
     */
    async loadData(userId?: string): Promise<ContentKanbanData> {
        const effectiveUid = getEffectiveUserId(userId);
        const local = getLocalData(effectiveUid);

        let finalColumns: ContentColumn[] = local.columns;
        let finalCards: ContentCard[] = local.cards;
        let dbConnected = false;
        let dbError: string | null = null;

        // 1. Tentar ler do backend local em disco
        try {
            const serverRes = await fetch('/api/content-kanban');
            if (serverRes.ok) {
                const serverData = await serverRes.json();
                if (serverData && Array.isArray(serverData.columns) && serverData.columns.length > 0) {
                    if (finalColumns.length === 0) finalColumns = serverData.columns;
                }
                if (serverData && Array.isArray(serverData.cards) && serverData.cards.length > 0) {
                    if (finalCards.length === 0) finalCards = serverData.cards;
                }
            }
        } catch {
            // fallback transparente
        }

        // 2. Tentar ler do Supabase na nuvem
        try {
            const { data: colsData, error: colsErr } = await supabase
                .from('content_columns')
                .select('*')
                .order('order_index', { ascending: true });

            if (!colsErr && colsData && colsData.length > 0) {
                finalColumns = colsData.map(c => ({
                    id: c.id,
                    userId: c.user_id,
                    name: c.name,
                    orderIndex: c.order_index,
                    createdAt: c.created_at,
                    updatedAt: c.updated_at
                }));
                dbConnected = true;
            } else if (colsErr) {
                dbError = colsErr.message;
            }

            const { data: cardsData, error: cardsErr } = await supabase
                .from('content_cards')
                .select('*')
                .order('order_index', { ascending: true });

            // CRÍTICO: só substitui os cartões se o Supabase efetivamente tiver cartões salvos!
            // Se o Supabase estiver vazio (ex: novo setup ou erro RLS), preserva os cartões locais!
            if (!cardsErr && cardsData && cardsData.length > 0) {
                finalCards = cardsData.map(c => ({
                    id: c.id,
                    userId: c.user_id,
                    columnId: c.column_id,
                    title: c.title,
                    description: c.description || '',
                    completed: !!c.completed,
                    dueDate: c.due_date || undefined,
                    orderIndex: c.order_index,
                    createdAt: c.created_at,
                    updatedAt: c.updated_at
                }));
                dbConnected = true;
            } else if (cardsErr) {
                dbError = dbError || cardsErr.message;
            }
        } catch (err: any) {
            console.warn('[ContentKanban] Erro ao carregar do Supabase:', err);
            dbError = err?.message;
        }

        // 3. Se ainda não há colunas configuradas em nenhum lugar, usa as estáveis predefinidas
        if (!finalColumns || finalColumns.length === 0) {
            finalColumns = STABLE_DEFAULT_COLUMNS.map(col => ({
                ...col,
                userId: effectiveUid,
                createdAt: new Date().toISOString()
            }));
        }

        // 4. Salva o melhor estado conhecido em cache local permanente e no backend
        saveLocalData(finalColumns, finalCards, effectiveUid);
        syncRemote(finalColumns, finalCards, effectiveUid);

        return {
            columns: finalColumns,
            cards: finalCards,
            dbConnected,
            dbError
        };
    },

    async createColumn(userId: string, name: string, orderIndex: number, currentCards: ContentCard[] = [], allCols: ContentColumn[] = []): Promise<ContentColumn> {
        const effectiveUid = getEffectiveUserId(userId);
        const colId = crypto.randomUUID ? crypto.randomUUID() : `col-${Date.now()}`;
        const newCol: ContentColumn = {
            id: colId,
            userId: effectiveUid,
            name: name.trim(),
            orderIndex,
            createdAt: new Date().toISOString()
        };

        const updatedCols = [...allCols, newCol];
        saveLocalData(updatedCols, currentCards, effectiveUid);
        syncRemote(updatedCols, currentCards, effectiveUid);

        try {
            const { data, error } = await supabase
                .from('content_columns')
                .insert({
                    id: colId.startsWith('col-') ? undefined : colId,
                    user_id: effectiveUid,
                    name: name.trim(),
                    order_index: orderIndex
                })
                .select()
                .single();

            if (!error && data) {
                newCol.id = data.id;
            }
        } catch (e) {
            console.warn('[ContentKanban] createColumn nuvem:', e);
        }

        return newCol;
    },

    async updateColumnName(columnId: string, name: string, currentCols: ContentColumn[] = [], currentCards: ContentCard[] = [], userId?: string): Promise<void> {
        const effectiveUid = getEffectiveUserId(userId);
        const updatedCols = currentCols.map(c => c.id === columnId ? { ...c, name: name.trim(), updatedAt: new Date().toISOString() } : c);
        
        saveLocalData(updatedCols, currentCards, effectiveUid);
        syncRemote(updatedCols, currentCards, effectiveUid);

        try {
            await supabase
                .from('content_columns')
                .update({
                    name: name.trim(),
                    updated_at: new Date().toISOString()
                })
                .eq('id', columnId);
        } catch (e) {
            console.warn('[ContentKanban] updateColumnName nuvem:', e);
        }
    },

    async reorderColumns(columnOrders: { id: string; orderIndex: number }[], allCols: ContentColumn[], allCards: ContentCard[], userId?: string): Promise<void> {
        const effectiveUid = getEffectiveUserId(userId);
        const orderMap = new Map(columnOrders.map(item => [item.id, item.orderIndex]));
        const updatedCols = allCols
            .map(c => ({ ...c, orderIndex: orderMap.has(c.id) ? orderMap.get(c.id)! : c.orderIndex }))
            .sort((a, b) => a.orderIndex - b.orderIndex);

        saveLocalData(updatedCols, allCards, effectiveUid);
        syncRemote(updatedCols, allCards, effectiveUid);

        try {
            const promises = columnOrders.map(item =>
                supabase
                    .from('content_columns')
                    .update({
                        order_index: item.orderIndex,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', item.id)
            );
            await Promise.all(promises);
        } catch (e) {
            console.warn('[ContentKanban] reorderColumns nuvem:', e);
        }
    },

    async deleteColumn(columnId: string, targetColumnIdForCards?: string, allCols: ContentColumn[] = [], allCards: ContentCard[] = [], userId?: string): Promise<void> {
        const effectiveUid = getEffectiveUserId(userId);
        let updatedCards = allCards;
        if (targetColumnIdForCards) {
            updatedCards = allCards.map(c => c.columnId === columnId ? { ...c, columnId: targetColumnIdForCards } : c);
        }
        const updatedCols = allCols.filter(c => c.id !== columnId).map((c, i) => ({ ...c, orderIndex: i }));

        saveLocalData(updatedCols, updatedCards, effectiveUid);
        syncRemote(updatedCols, updatedCards, effectiveUid);

        try {
            if (targetColumnIdForCards) {
                await supabase
                    .from('content_cards')
                    .update({
                        column_id: targetColumnIdForCards,
                        updated_at: new Date().toISOString()
                    })
                    .eq('column_id', columnId);
            }

            await supabase
                .from('content_columns')
                .delete()
                .eq('id', columnId);
        } catch (e) {
            console.warn('[ContentKanban] deleteColumn nuvem:', e);
        }
    },

    async createCard(userId: string, data: { columnId: string; title: string; description?: string; completed?: boolean; dueDate?: string; orderIndex: number }, allCols: ContentColumn[] = [], allCards: ContentCard[] = []): Promise<ContentCard> {
        const effectiveUid = getEffectiveUserId(userId);
        const cardId = crypto.randomUUID ? crypto.randomUUID() : `card-${Date.now()}`;
        
        const newCard: ContentCard = {
            id: cardId,
            userId: effectiveUid,
            columnId: data.columnId,
            title: data.title.trim(),
            description: (data.description || '').trim(),
            completed: data.completed ?? false,
            dueDate: data.dueDate || undefined,
            orderIndex: data.orderIndex,
            createdAt: new Date().toISOString()
        };

        const updatedCards = [...allCards, newCard];
        saveLocalData(allCols, updatedCards, effectiveUid);
        syncRemote(allCols, updatedCards, effectiveUid);

        try {
            const { data: inserted, error } = await supabase
                .from('content_cards')
                .insert({
                    id: cardId.startsWith('card-') ? undefined : cardId,
                    user_id: effectiveUid,
                    column_id: data.columnId.startsWith('col-') ? undefined : data.columnId,
                    title: data.title.trim(),
                    description: (data.description || '').trim(),
                    completed: data.completed ?? false,
                    due_date: data.dueDate || null,
                    order_index: data.orderIndex
                })
                .select()
                .single();

            if (!error && inserted) {
                newCard.id = inserted.id;
            }
        } catch (e) {
            console.warn('[ContentKanban] createCard nuvem:', e);
        }

        return newCard;
    },

    async updateCard(cardId: string, updates: { title?: string; description?: string; columnId?: string; completed?: boolean; dueDate?: string | null; orderIndex?: number }, allCols: ContentColumn[], allCards: ContentCard[], userId?: string): Promise<void> {
        const effectiveUid = getEffectiveUserId(userId);
        const updatedCards = allCards.map(c => {
            if (c.id === cardId) {
                return {
                    ...c,
                    title: updates.title !== undefined ? updates.title.trim() : c.title,
                    description: updates.description !== undefined ? updates.description.trim() : c.description,
                    columnId: updates.columnId !== undefined ? updates.columnId : c.columnId,
                    completed: updates.completed !== undefined ? updates.completed : c.completed,
                    dueDate: updates.dueDate !== undefined ? (updates.dueDate || undefined) : c.dueDate,
                    orderIndex: updates.orderIndex !== undefined ? updates.orderIndex : c.orderIndex,
                    updatedAt: new Date().toISOString()
                };
            }
            return c;
        });

        saveLocalData(allCols, updatedCards, effectiveUid);
        syncRemote(allCols, updatedCards, effectiveUid);

        try {
            const payload: any = { updated_at: new Date().toISOString() };
            if (updates.title !== undefined) payload.title = updates.title.trim();
            if (updates.description !== undefined) payload.description = updates.description.trim();
            if (updates.columnId !== undefined && !updates.columnId.startsWith('col-')) payload.column_id = updates.columnId;
            if (updates.completed !== undefined) payload.completed = updates.completed;
            if (updates.dueDate !== undefined) payload.due_date = updates.dueDate || null;
            if (updates.orderIndex !== undefined) payload.order_index = updates.orderIndex;

            await supabase
                .from('content_cards')
                .update(payload)
                .eq('id', cardId);
        } catch (e) {
            console.warn('[ContentKanban] updateCard nuvem:', e);
        }
    },

    async toggleCardCompleted(cardId: string, allCols: ContentColumn[], allCards: ContentCard[], userId?: string): Promise<ContentCard[]> {
        const effectiveUid = getEffectiveUserId(userId);
        let newCompletedState = false;
        const updatedCards = allCards.map(c => {
            if (c.id === cardId) {
                newCompletedState = !c.completed;
                return {
                    ...c,
                    completed: newCompletedState,
                    updatedAt: new Date().toISOString()
                };
            }
            return c;
        });

        saveLocalData(allCols, updatedCards, effectiveUid);
        syncRemote(allCols, updatedCards, effectiveUid);

        try {
            await supabase
                .from('content_cards')
                .update({
                    completed: newCompletedState,
                    updated_at: new Date().toISOString()
                })
                .eq('id', cardId);
        } catch (e) {
            console.warn('[ContentKanban] toggleCardCompleted nuvem:', e);
        }

        return updatedCards;
    },

    async reorderCardsInColumn(columnId: string, orderedCardIds: string[], allCols: ContentColumn[], allCards: ContentCard[], userId?: string): Promise<ContentCard[]> {
        const effectiveUid = getEffectiveUserId(userId);
        const orderMap = new Map(orderedCardIds.map((id, index) => [id, index]));

        const updatedCards = allCards.map(card => {
            if (card.columnId === columnId && orderMap.has(card.id)) {
                return {
                    ...card,
                    orderIndex: orderMap.get(card.id)!,
                    updatedAt: new Date().toISOString()
                };
            }
            return card;
        });

        saveLocalData(allCols, updatedCards, effectiveUid);
        syncRemote(allCols, updatedCards, effectiveUid);

        try {
            const promises = orderedCardIds.map((cardId, index) =>
                supabase
                    .from('content_cards')
                    .update({
                        order_index: index,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', cardId)
            );
            await Promise.all(promises);
        } catch (e) {
            console.warn('[ContentKanban] reorderCards nuvem:', e);
        }

        return updatedCards;
    },

    async reorderCards(cardOrders: { id: string; columnId: string; orderIndex: number }[], allCols: ContentColumn[], allCards: ContentCard[], userId?: string): Promise<ContentCard[]> {
        const effectiveUid = getEffectiveUserId(userId);
        const orderMap = new Map(cardOrders.map(item => [item.id, { columnId: item.columnId, orderIndex: item.orderIndex }]));

        const updatedCards = allCards.map(card => {
            if (orderMap.has(card.id)) {
                const info = orderMap.get(card.id)!;
                return {
                    ...card,
                    columnId: info.columnId,
                    orderIndex: info.orderIndex,
                    updatedAt: new Date().toISOString()
                };
            }
            return card;
        });

        saveLocalData(allCols, updatedCards, effectiveUid);
        syncRemote(allCols, updatedCards, effectiveUid);

        try {
            const promises = cardOrders.map(item => {
                const updatePayload: any = {
                    order_index: item.orderIndex,
                    updated_at: new Date().toISOString()
                };
                if (!item.columnId.startsWith('col-')) {
                    updatePayload.column_id = item.columnId;
                }
                return supabase
                    .from('content_cards')
                    .update(updatePayload)
                    .eq('id', item.id);
            });
            await Promise.all(promises);
        } catch (e) {
            console.warn('[ContentKanban] reorderCards nuvem:', e);
        }

        return updatedCards;
    },

    async moveCard(cardId: string, targetColumnId: string, newOrderIndex: number, allCols: ContentColumn[], allCards: ContentCard[], userId?: string): Promise<ContentCard[]> {
        const effectiveUid = getEffectiveUserId(userId);
        const updatedCards = allCards.map(card => {
            if (card.id === cardId) {
                return {
                    ...card,
                    columnId: targetColumnId,
                    orderIndex: newOrderIndex,
                    updatedAt: new Date().toISOString()
                };
            }
            return card;
        });

        saveLocalData(allCols, updatedCards, effectiveUid);
        syncRemote(allCols, updatedCards, effectiveUid);

        try {
            const updatePayload: any = {
                order_index: newOrderIndex,
                updated_at: new Date().toISOString()
            };
            if (!targetColumnId.startsWith('col-')) {
                updatePayload.column_id = targetColumnId;
            }

            await supabase
                .from('content_cards')
                .update(updatePayload)
                .eq('id', cardId);
        } catch (e) {
            console.warn('[ContentKanban] moveCard nuvem:', e);
        }

        return updatedCards;
    },

    async deleteCard(cardId: string, allCols: ContentColumn[], allCards: ContentCard[], userId?: string): Promise<void> {
        const effectiveUid = getEffectiveUserId(userId);
        const updatedCards = allCards.filter(c => c.id !== cardId);
        
        saveLocalData(allCols, updatedCards, effectiveUid);
        syncRemote(allCols, updatedCards, effectiveUid);

        try {
            await supabase
                .from('content_cards')
                .delete()
                .eq('id', cardId);
        } catch (e) {
            console.warn('[ContentKanban] deleteCard nuvem:', e);
        }
    }
};
