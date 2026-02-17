import { useState, useEffect, useCallback } from 'react';
import {
    User, Company, Contact, Deal, Activity, Pipeline, Stage, DealLog
} from '../types/schema';
import { supabase } from '@/lib/supabase';
import { LEAD_SEQUENCE_TEMPLATES } from './cadence';


// --- Types ---
export interface CRMStore {
    users: User[]; // Kept for type compatibility, though managed by Auth now
    companies: Company[];
    contacts: Contact[];
    deals: Deal[];
    activities: Activity[];
    logs: DealLog[];
    pipelines: Record<string, Pipeline>;
    isLoading: boolean;
    isPipelineSettingsOpen: boolean;
    setPipelineSettingsOpen: (open: boolean) => void;

    // Actions
    addDeal: (deal: Omit<Deal, 'id' | 'createdAt' | 'updatedAt' | 'userId'>) => Promise<void>;
    updateDeal: (id: string, updates: Partial<Deal>) => Promise<void>;
    moveDeal: (id: string, stageId: string, position?: number, pipelineId?: string) => Promise<void>;
    deleteDeal: (id: string) => Promise<void>;

    addCompany: (company: Omit<Company, 'id' | 'createdAt'>) => Promise<Company>;
    updateCompany: (id: string, updates: Partial<Company>) => Promise<void>;
    deleteCompany: (id: string) => Promise<void>;

    addContact: (contact: Omit<Contact, 'id' | 'createdAt' | 'userId'>) => Promise<Contact>;
    updateContact: (id: string, updates: Partial<Contact>) => Promise<void>;
    deleteContact: (id: string) => Promise<void>;

    addActivity: (activity: Omit<Activity, 'id' | 'createdAt' | 'userId'>) => Promise<void>;
    updateActivity: (id: string, updates: Partial<Activity>) => Promise<void>;
    deleteActivity: (id: string) => Promise<void>;
    completeActivityWithLog: (activityId: string, content?: string) => Promise<void>;

    addLog: (log: Omit<DealLog, 'id' | 'createdAt' | 'createdBy'>) => Promise<void>;
    deleteLog: (id: string) => Promise<void>;

    // Helpers
    getPipelineStages: (pipelineId: string) => Stage[];
    // Generic Status
    refresh: () => Promise<void>;

    // Global Modal States
    isNewDealModalOpen: boolean;
    openNewDealModal: (stageId?: string, dealToEdit?: Deal) => void;
    closeNewDealModal: () => void;
    newDealStageId: string | null;
    dealToEdit: Deal | null;


    // Stage Actions

    addStage: (pipelineId: string, title: string) => Promise<void>;
    updateStage: (stageId: string, updates: Partial<Stage>) => Promise<void>;
    deleteStage: (stageId: string) => Promise<void>;
    reorderStages: (pipelineId: string, newOrder: string[]) => Promise<void>;

    // Focus Mode (Deal Detail)
    activeFocusDealId: string | null;
    openFocusDeal: (id: string) => void;
    closeFocusDeal: () => void;

    // Privacy Mode (Global)
    isPrivacyMode: boolean;
    togglePrivacyMode: () => void;

    // Merge Helpers (Optional, or just use atomic actions)
}

// --- Helpers ---
const generateId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    // Fallback for older envs
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

export function useCRMStore(): CRMStore {
    const [deals, setDeals] = useState<Deal[]>([]);
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [activities, setActivities] = useState<Activity[]>([]);
    const [logs, setLogs] = useState<DealLog[]>([]);
    const [companies, setCompanies] = useState<Company[]>([]);
    // *Correction*: User schema didn't fully specifying Company table. 
    // We will handle Companies as local-only for now OR map to a simple jsonb if needed. 
    // For this migration, let's keep companies in memory/local storage or create a table if requested. 
    // Given the prompt, we focus on Deals/Activities/Profiles. Contacts table exists.
    // Let's create a local mock for companies to avoid breaking UI, or sync if table existed.

    const [pipelines, setPipelines] = useState<Record<string, Pipeline>>({
        'sales': { id: 'sales', name: 'Funil de Prospeção', stages: [] },
        'cold_leads': { id: 'cold_leads', name: 'Leads Frios', stages: [] }
    });
    const [isLoading, setIsLoading] = useState(true);
    const [isPipelineSettingsOpen, setPipelineSettingsOpen] = useState(false);

    // Global Modal States
    const [isNewDealModalOpen, setIsNewDealModalOpen] = useState(false);
    const [newDealStageId, setNewDealStageId] = useState<string | null>(null);
    const [dealToEdit, setDealToEdit] = useState<Deal | null>(null);
    const [activeFocusDealId, setActiveFocusDealId] = useState<string | null>(null);

    // Privacy Mode State
    const [isPrivacyMode, setIsPrivacyMode] = useState(() => {
        const saved = localStorage.getItem('privacy_mode');
        return saved === 'true';
    });

    const togglePrivacyMode = () => {
        setIsPrivacyMode(prev => {
            const next = !prev;
            localStorage.setItem('privacy_mode', String(next));
            return next;
        });
    };

    const openFocusDeal = (id: string) => setActiveFocusDealId(id);
    const closeFocusDeal = () => setActiveFocusDealId(null);

    const openNewDealModal = (stageId?: string, editDeal?: Deal) => {
        setNewDealStageId(stageId || null);
        setDealToEdit(editDeal || null);
        setIsNewDealModalOpen(true);
    };

    const closeNewDealModal = () => {
        setIsNewDealModalOpen(false);
        setNewDealStageId(null);
        setDealToEdit(null);
    };


    // --- Data Fetching ---
    const fetchAll = useCallback(async () => {
        setIsLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                console.warn('fetchAll: No user found');
                setIsLoading(false);
                return;
            }

            console.debug('fetchAll: Starting parallel fetch for all data...');

            const [
                { data: dealsData, error: dealsError },
                { data: contactsData, error: contactsError },
                { data: activitiesData, error: activitiesError },
                { data: logsData, error: logsError },
                { data: companiesData, error: companiesError },
                { data: stagesData, error: stagesError }
            ] = await Promise.all([
                supabase.from('deals').select('*'),
                supabase.from('contacts').select('*'),
                supabase.from('activities').select('*'),
                supabase.from('deal_logs').select('*'),
                supabase.from('companies').select('*'),
                supabase.from('stages').select('*').order('order_index', { ascending: true })
            ]);

            // Check for critical errors
            if (dealsError || activitiesError || logsError) {
                console.error('Critical Fetch Error:', { dealsError, activitiesError, logsError });
            }

            // 1. Map & Set Deals
            if (dealsData) {
                const mappedDeals: Deal[] = dealsData.map(d => ({
                    ...d,
                    columnId: d.stage_id,
                    stageId: d.stage_id,
                    contactId: d.contact_id,
                    userId: d.user_id,
                    createdAt: d.created_at,
                    updatedAt: d.created_at,
                    pipelineId: d.pipeline_id || 'sales',
                    companyId: d.company_id,
                    tags: d.tags || [],
                    source: d.source,
                    currency: d.currency || 'BRL',
                    position: d.position || 0,
                    leadSequenceStarted: d.lead_sequence_started || false
                }));

                mappedDeals.sort((a, b) => {
                    const posA = a.position || 0;
                    const posB = b.position || 0;
                    if (posA !== posB) return posA - posB;
                    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                });
                setDeals(mappedDeals);
            }

            // 2. Map & Set Contacts
            if (contactsData) {
                setContacts(contactsData.map(c => ({
                    ...c,
                    userId: c.user_id,
                    companyId: c.company_id,
                    createdAt: c.created_at
                })));
            }

            // 3. Map & Set Activities
            if (activitiesData) {
                setActivities(activitiesData.map(a => ({
                    ...a,
                    dealId: a.deal_id,
                    userId: a.user_id,
                    createdAt: a.created_at,
                    dueDate: a.date,
                    completed: a.completed,
                    status: a.status || (a.completed ? 'completed' : 'pending'),
                    completedAt: a.completed_at,
                    originStage: a.origin_stage,
                    sequenceId: a.sequence_id
                })));
            }

            // 4. Map & Set Logs
            if (logsData) {
                setLogs(logsData.map(l => ({
                    id: l.id,
                    dealId: l.deal_id,
                    activityId: l.activity_id,
                    content: l.content,
                    logType: l.log_type,
                    createdBy: l.created_by,
                    createdAt: l.created_at
                })));
            }

            // 5. Map & Set Companies
            if (companiesData) {
                setCompanies(companiesData.map(c => ({
                    id: c.id,
                    name: c.name,
                    website: c.website,
                    phone: c.phone,
                    email: c.email,
                    createdAt: c.created_at
                })));
            }

            // 6. Map & Set Pipelines/Stages
            if (stagesData) {
                const stagesByPipeline: Record<string, Stage[]> = {};
                stagesData.forEach(s => {
                    const pid = s.pipeline_id || 'sales';
                    if (!stagesByPipeline[pid]) stagesByPipeline[pid] = [];
                    stagesByPipeline[pid].push({
                        id: s.id,
                        pipelineId: pid,
                        title: s.name,
                        color: s.color,
                        probability: s.probability
                    });
                });

                setPipelines(prev => {
                    const nextPipelines = { ...prev };
                    Object.keys(stagesByPipeline).forEach(pid => {
                        if (nextPipelines[pid]) {
                            nextPipelines[pid].stages = stagesByPipeline[pid];
                        } else {
                            nextPipelines[pid] = {
                                id: pid,
                                name: pid === 'sales' ? 'Funil de Prospeção' :
                                    pid === 'cold_leads' ? 'Leads Frios' : pid,
                                stages: stagesByPipeline[pid]
                            };
                        }
                    });
                    return nextPipelines;
                });
            }

        } catch (err) {
            console.error('fetchAll unhandled error:', err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // --- Initial Load & Realtime ---
    useEffect(() => {
        // Initial fetch
        fetchAll();

        // Listen for Auth Changes (Sign In, etc.) to trigger fetch
        const { data: { subscription: authListener } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' && session) {
                console.log('🔐 Auth changed: SIGNED_IN. Refetching data...');
                fetchAll();
            }
        });

        // Listen for DB Changes (Disabled temporarily to debug Drag & Drop race conditions)
        /* const channel = supabase.channel('crm_realtime')
            .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
                 // Optimization: Ignore if it's our own update? 
                 // Supabase Realtime doesn't easily distinguish 'who' made the change without extra columns
                console.log('⚡ Realtime update detected. Refetching...');
                fetchAll();
            })
            .subscribe(); */

        return () => {
            authListener.unsubscribe();
            // supabase.removeChannel(channel);
        };
    }, [fetchAll]);


    // --- Actions (Optimistic + Async) ---

    // --- Helpers for Status Logic (Disabled) ---
    /* const recalculateContactStatus = async (contactId: string, currentDeals: Deal[]) => {
        // Filter deals for this contact
        const contactDeals = currentDeals.filter(d => d.contactId === contactId);
    
        // 1. If at least 1 WON deal -> ACTIVE
        if (contactDeals.some(d => d.status === 'won')) return 'active';
    
        // 2. If ALL deals are LOST (and has > 0 deals) -> INACTIVE
        if (contactDeals.some(d => d.status === 'open')) return 'lead';
    
        if (contactDeals.length > 0 && contactDeals.every(d => d.status === 'lost')) return 'inactive';
    
        // 3. If no deals? Keep current or default to Lead? 
        return 'lead';
    }; */



    // --- Actions ---

    const addDeal = async (data: Omit<Deal, 'id' | 'createdAt' | 'updatedAt' | 'userId'>) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            alert('Erro: Usuário não autenticado. Tente fazer login novamente.');
            return;
        }

        const tempId = generateId();

        // Calculate Position (End of Column)
        const stageDeals = deals.filter(d => d.stageId === data.stageId);
        const maxPos = stageDeals.length > 0 ? Math.max(...stageDeals.map(d => d.position || 0)) : 0;
        const newPos = maxPos + 1;

        const newDeal = {
            id: tempId,
            title: data.title,
            value: data.value,
            contact_id: data.contactId,
            user_id: user.id,
            stage_id: data.stageId,
            status: 'open',
            company_id: data.companyId,
            tags: data.tags,
            source: data.source,
            currency: data.currency,
            position: newPos,
            pipeline_id: data.pipelineId
        };

        // Optimistic Deal
        const optimisticDeal: Deal = {
            ...data,
            id: tempId,
            userId: user.id,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            position: newPos
        } as Deal;

        const nextDeals = [optimisticDeal, ...deals];
        setDeals(nextDeals); // Update Deals State

        // DB Insert Deal
        const { error } = await supabase.from('deals').insert(newDeal);
        if (error) {
            console.error('Error adding deal:', error);
            alert(`Erro ao salvar negócio: ${error.message}`);
            // Revert
            setDeals(prev => prev.filter(d => d.id !== tempId));
        }
    };

    const updateDeal = async (id: string, updates: Partial<Deal>) => {
        // Capture Original for Rollback
        const originalDeal = deals.find(d => d.id === id);
        if (!originalDeal) return;

        // Auto-handle timestamps for status change if not provided
        const finalUpdates = { ...updates };
        const now = new Date().toISOString();

        if (updates.status && updates.status !== originalDeal.status) {
            if (updates.status === 'won' && !updates.wonAt) finalUpdates.wonAt = now;
            if (updates.status === 'lost' && !updates.lostAt) finalUpdates.lostAt = now;

            // Log History Activity
            const statusLabels: Record<string, string> = { open: 'Aberto', won: 'Ganho', lost: 'Perdido' };
            const historyTitle = `Status alterado de ${statusLabels[originalDeal.status]} para ${statusLabels[updates.status]}`;

            addActivity({
                type: 'status_change',
                title: historyTitle,
                notes: updates.lostReason ? `Motivo: ${updates.lostReason}` : undefined,
                dealId: id,
                completed: true,
                dueDate: now
            });
        }

        // Optimistic
        const nextDeals = deals.map(d => d.id === id ? { ...d, ...finalUpdates } : d);
        setDeals(nextDeals);

        // DB Map
        const dbUpdates: Record<string, unknown> = {};
        if (finalUpdates.title !== undefined) dbUpdates.title = finalUpdates.title;
        if (finalUpdates.value !== undefined) dbUpdates.value = finalUpdates.value;
        if (finalUpdates.stageId !== undefined) dbUpdates.stage_id = finalUpdates.stageId;
        if (finalUpdates.status !== undefined) dbUpdates.status = finalUpdates.status;
        if (finalUpdates.companyId !== undefined) dbUpdates.company_id = finalUpdates.companyId;
        if (finalUpdates.contactId !== undefined) dbUpdates.contact_id = finalUpdates.contactId;
        if (finalUpdates.tags !== undefined) dbUpdates.tags = finalUpdates.tags;
        if (finalUpdates.source !== undefined) dbUpdates.source = finalUpdates.source;
        if (finalUpdates.currency !== undefined) dbUpdates.currency = finalUpdates.currency;
        if (finalUpdates.wonAt !== undefined) dbUpdates.won_at = finalUpdates.wonAt;
        if (finalUpdates.lostAt !== undefined) dbUpdates.lost_at = finalUpdates.lostAt;
        if (finalUpdates.lostReason !== undefined) dbUpdates.lost_reason = finalUpdates.lostReason;
        if (finalUpdates.position !== undefined) dbUpdates.position = finalUpdates.position;
        if (finalUpdates.pipelineId !== undefined) dbUpdates.pipeline_id = finalUpdates.pipelineId;
        if (finalUpdates.leadSequenceStarted !== undefined) dbUpdates.lead_sequence_started = finalUpdates.leadSequenceStarted;

        // --- Cadence Logic Triggers ---
        if (updates.stageId && updates.stageId !== originalDeal.stageId) {
            const enteringLead = isLeadStage(updates.stageId);
            const leavingLead = isLeadStage(originalDeal.stageId);

            // Check if entering LEAD stage
            if (enteringLead && !updates.leadSequenceStarted && !originalDeal.leadSequenceStarted) {
                await startLeadSequence(id);
                dbUpdates.lead_sequence_started = true;
                finalUpdates.leadSequenceStarted = true;
            }

            // Check if leaving LEAD stage
            if (leavingLead && !enteringLead) {
                await cancelLeadSequence(id);
                dbUpdates.lead_sequence_started = false;
                finalUpdates.leadSequenceStarted = false;
            }
        }

        if (Object.keys(dbUpdates).length > 0) {
            console.log('📝 Sending Update to DB:', { id, ...dbUpdates });
            const { data: updatedData, error } = await supabase.from('deals').update(dbUpdates).eq('id', id).select('id');

            if (error || (updatedData && updatedData.length === 0)) {
                console.error('❌ Error updating deal:', error || 'No rows affected (RLS/Permission)');
                if (error) alert(`Erro ao salvar alteração: ${error.message}`);
                // Revert Optimistic Update
                setDeals(prev => prev.map(d => d.id === id ? originalDeal : d));
            } else {
                console.log('✅ Update successful for:', id);
            }
        }
    };

    const moveDeal = async (id: string, stageId: string, position?: number, pipelineId?: string) => {
        // Optimistic
        setDeals(prev => prev.map(d => {
            if (d.id === id) {
                return {
                    ...d,
                    stageId,
                    columnId: stageId,
                    position: position !== undefined ? position : d.position,
                    pipelineId: pipelineId || d.pipelineId
                };
            }
            return d;
        }));

        // DB Update
        const updates: any = { stage_id: stageId };
        if (position !== undefined) updates.position = position;
        if (pipelineId) updates.pipeline_id = pipelineId;

        // --- Cadence Logic Triggers ---
        const originalDeal = deals.find(d => d.id === id);
        if (originalDeal) {
            const enteringLead = isLeadStage(stageId);
            const leavingLead = isLeadStage(originalDeal.stageId);

            // Entering LEAD stage
            if (enteringLead && !originalDeal.leadSequenceStarted) {
                await startLeadSequence(id);
                updates.lead_sequence_started = true;
                // Optimistic update for frontend state
                setDeals(prev => prev.map(d => d.id === id ? { ...d, leadSequenceStarted: true } : d));
            }

            // Leaving LEAD stage
            if (leavingLead && !enteringLead) {
                await cancelLeadSequence(id);
                updates.lead_sequence_started = false;
                // Optimistic update for frontend state
                setDeals(prev => prev.map(d => d.id === id ? { ...d, leadSequenceStarted: false } : d));
            }
        }

        console.log('📦 Persistence: Moving deal', { id, ...updates });
        const { error } = await supabase.from('deals').update(updates).eq('id', id);

        if (error) {
            console.error('❌ Error moving deal:', error);
            alert(`Erro ao salvar movimento: ${error.message}`);
            fetchAll(); // Revert from DB
        }
    };

    const deleteDeal = async (id: string) => {
        // const dealToDelete = deals.find(d => d.id === id);

        // Optimistic Update
        const nextDeals = deals.filter(d => d.id !== id);
        setDeals(nextDeals);
        setActivities(prev => prev.filter(a => a.dealId !== id));

        // Recalculate Contact Status (Disabled)
        /* if (dealToDelete && dealToDelete.contactId) {
            const newStatus = await recalculateContactStatus(dealToDelete.contactId, nextDeals);
            setContacts(prev => prev.map(c => c.id === dealToDelete.contactId ? { ...c, status: newStatus } : c));
            supabase.from('contacts').update({ status: newStatus }).eq('id', dealToDelete.contactId);
        } */

        // DB
        const { error: actError } = await supabase.from('activities').delete().eq('deal_id', id);
        if (actError) console.warn('Warning deleting activities for deal:', actError);

        const { error } = await supabase.from('deals').delete().eq('id', id);

        if (error) {
            console.error('Error deleting deal:', error);
            alert(`Erro ao excluir negócio: ${error.message}`);
            fetchAll();
        }
    };

    const addContact = async (data: Omit<Contact, 'id' | 'createdAt' | 'userId'>) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("No user");

        const tempId = generateId();

        const newContact = {
            id: tempId,
            name: data.name,
            email: data.email,
            phone: data.phone,
            role: data.role,
            user_id: user.id,
            company_id: data.companyId
            // Status removed as column missing in DB
        };

        // Optimistic
        console.log('👤 addContact: Generated ID:', tempId);
        const optimisticContact = { ...data, id: tempId, userId: user.id, createdAt: new Date().toISOString() } as Contact;
        setContacts(prev => [...prev, optimisticContact]);

        const { data: inserted, error } = await supabase.from('contacts').insert(newContact).select().single();
        if (error) {
            console.error('❌ addContact DB Error:', error);
            setContacts(prev => prev.filter(c => c.id !== tempId));
            throw error;
        }
        console.log('✅ addContact Success. DB ID matches:', inserted.id === tempId);
        return { ...optimisticContact, id: inserted.id };
    };

    const updateContact = async (id: string, updates: Partial<Contact>) => {
        setContacts(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));

        const dbUpdates: any = {};
        if (updates.name !== undefined) dbUpdates.name = updates.name;
        if (updates.email !== undefined) dbUpdates.email = updates.email;
        if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
        if (updates.role !== undefined) dbUpdates.role = updates.role;
        if (updates.companyId !== undefined) dbUpdates.company_id = updates.companyId;

        if (Object.keys(dbUpdates).length > 0) {
            const { error } = await supabase.from('contacts').update(dbUpdates).eq('id', id);
            if (error) console.error('Error updating contact:', error);
        }
    };

    const deleteContact = async (id: string) => {
        // Optimistic update
        // 1. Delete Contact locally
        setContacts(prev => prev.filter(c => c.id !== id));

        // 2. Delete Deals locally
        setDeals(prev => prev.filter(d => d.contactId !== id));

        // 3. Delete Activities linked to Contact OR deleted Deals
        const dealIdsToDelete = deals.filter(d => d.contactId === id).map(d => d.id);

        setActivities(prev => prev.filter(a => {
            if (a.contactId === id) return false;
            if (a.dealId && dealIdsToDelete.includes(a.dealId)) return false;
            return true;
        }));

        // --- Database ---
        await supabase.from('activities').delete().eq('contact_id', id);

        const { error: deleteDealsError } = await supabase
            .from('deals')
            .delete()
            .eq('contact_id', id);

        if (deleteDealsError) {
            console.error('Error deleting deals:', deleteDealsError);
            fetchAll();
            return;
        }

        const { error } = await supabase.from('contacts').delete().eq('id', id);
        if (error) {
            console.error('Error deleting contact:', error);
            fetchAll();
        }
    };


    // Stub implementations for others to match interface
    const addActivity = async (data: any) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const tempId = generateId();

        // Normalize date to avoid timezone shifts (ensure it has a time, default to noon UTC if just date)
        let normalizedDate = data.dueDate;
        if (normalizedDate && normalizedDate.length === 10) {
            normalizedDate = `${normalizedDate}T12:00:00.000Z`;
        }

        const newActivity = {
            id: tempId,
            title: data.title,
            type: data.type,
            date: normalizedDate || data.dueDate,
            duration: data.duration,
            deal_id: data.dealId,
            user_id: user.id,
            notes: data.notes,
            completed: data.completed !== undefined ? data.completed : false,
            status: data.status || (data.completed ? 'completed' : 'pending'),
            origin_stage: data.originStage,
            sequence_id: data.sequenceId
        };

        const optimisticActivity = {
            ...data,
            dueDate: normalizedDate || data.dueDate,
            id: tempId,
            userId: user.id,
            createdAt: new Date().toISOString()
        };

        setActivities(prev => [...prev, optimisticActivity]);

        const { error } = await supabase.from('activities').insert(newActivity);
        if (error) {
            console.error('Error creating activity:', error);
            alert(`Erro ao criar atividade: ${error.message} (Detalhe: ${error.details || ''})`);
            setActivities(prev => prev.filter(a => a.id !== tempId));
        }
    };

    const updateActivity = async (id: string, updates: Partial<Activity>) => {
        // Sync status with completed if completed is provided
        const synchronizedUpdates = { ...updates };
        if (updates.completed !== undefined) {
            if (updates.status === undefined) {
                synchronizedUpdates.status = updates.completed ? 'completed' : 'pending';
            }
            if (updates.completedAt === undefined) {
                synchronizedUpdates.completedAt = updates.completed ? new Date().toISOString() : undefined;
            }
        }

        setActivities(prev => prev.map(a => a.id === id ? { ...a, ...synchronizedUpdates } : a));

        const dbUpdates: Record<string, unknown> = {};
        if (synchronizedUpdates.title !== undefined) dbUpdates.title = synchronizedUpdates.title;
        if (synchronizedUpdates.notes !== undefined) dbUpdates.notes = synchronizedUpdates.notes;
        if (synchronizedUpdates.completed !== undefined) dbUpdates.completed = synchronizedUpdates.completed;
        if (synchronizedUpdates.status !== undefined) dbUpdates.status = synchronizedUpdates.status;
        if (synchronizedUpdates.completedAt !== undefined) dbUpdates.completed_at = synchronizedUpdates.completedAt;

        if (synchronizedUpdates.dueDate !== undefined) {
            let normalizedDate = synchronizedUpdates.dueDate;
            if (normalizedDate && normalizedDate.length === 10) {
                normalizedDate = `${normalizedDate}T12:00:00.000Z`;
            }
            dbUpdates.date = normalizedDate;
        }
        if (synchronizedUpdates.dealId !== undefined) dbUpdates.deal_id = synchronizedUpdates.dealId;
        if (synchronizedUpdates.contactId !== undefined) dbUpdates.contact_id = synchronizedUpdates.contactId;
        if (synchronizedUpdates.originStage !== undefined) dbUpdates.origin_stage = synchronizedUpdates.originStage;
        if (synchronizedUpdates.sequenceId !== undefined) dbUpdates.sequence_id = synchronizedUpdates.sequenceId;

        dbUpdates.updated_at = new Date().toISOString();

        const { error } = await supabase.from('activities').update(dbUpdates).eq('id', id);
        if (error) {
            console.error('Update activity error', error);
            alert(`Erro ao salvar atividade: ${error.message}. Verifique se você rodou o comando SQL no Supabase.`);
            // Optionally revert: fetchAll();
        }
    };

    const deleteActivity = async (id: string) => {
        setActivities(prev => prev.filter(a => a.id !== id));
        await supabase.from('activities').delete().eq('id', id);
    };

    const addLog = async (data: Omit<DealLog, 'id' | 'createdAt' | 'createdBy'>) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const tempId = generateId();
        const newLogDto = {
            id: tempId,
            deal_id: data.dealId,
            activity_id: data.activityId,
            content: data.content,
            log_type: data.logType,
            created_by: user.id
        };

        const optimisticLog: DealLog = {
            ...data,
            id: tempId,
            createdBy: user.id,
            createdAt: new Date().toISOString()
        };

        setLogs(prev => [...prev, optimisticLog]);

        const { error } = await supabase.from('deal_logs').insert(newLogDto);
        if (error) {
            console.error('Error creating log:', error);
            alert(`Erro ao gerar histórico (Log): ${error.message}. Verifique se a tabela deal_logs existe.`);
            setLogs(prev => prev.filter(l => l.id !== tempId));
        }
    };

    const deleteLog = async (id: string) => {
        setLogs(prev => prev.filter(l => l.id !== id));
        const { error } = await supabase.from('deal_logs').delete().eq('id', id);
        if (error) {
            console.error('Error deleting log:', error);
            alert(`Erro ao excluir nota: ${error.message}`);
            fetchAll();
        }
    };

    const completeActivityWithLog = async (activityId: string, content?: string) => {
        const activity = activities.find(a => a.id === activityId);
        if (!activity) return;

        const now = new Date().toISOString();

        // 1. Update Activity
        await updateActivity(activityId, {
            completed: true,
            status: 'completed',
            completedAt: now
        });

        // 2. Add Log
        await addLog({
            dealId: activity.dealId!,
            activityId: activity.id,
            content: content?.trim() || "Atividade concluída sem observações.",
            logType: content?.trim() ? 'activity_note' : 'system'
        });
    };

    const addCompany = async (data: Omit<Company, 'id' | 'createdAt'>) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("No user");

        const tempId = generateId();

        const newCompany = {
            id: tempId,
            name: data.name,
            website: data.website,
            phone: data.phone,
            email: data.email,
            user_id: user.id
        };

        const optimisticCompany = { ...data, id: tempId, createdAt: new Date().toISOString() } as Company;
        setCompanies(prev => [...prev, optimisticCompany]);

        const { data: inserted, error } = await supabase.from('companies').insert(newCompany).select().single();
        if (error) {
            console.error('Error adding company:', error);
            setCompanies(prev => prev.filter(c => c.id !== tempId));
            throw error;
        }
        return { ...optimisticCompany, id: inserted.id };
    };

    const updateCompany = async (id: string, updates: Partial<Company>) => {
        setCompanies(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
        await supabase.from('companies').update(updates).eq('id', id);
    };

    const deleteCompany = async (id: string) => {
        // Optimistic
        setCompanies(prev => prev.filter(c => c.id !== id));

        // Update related (Optional/Stub): 
        // In a real app we might unset companyId from contacts/deals or delete them.
        // For now, we just delete the company.
        setContacts(prev => prev.map(c => c.companyId === id ? { ...c, companyId: undefined } : c));
        setDeals(prev => prev.map(d => d.companyId === id ? { ...d, companyId: undefined } : d));

        await supabase.from('companies').delete().eq('id', id);
    };

    // --- Stage Actions ---
    const addStage = async (pipelineId: string, title: string) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            console.error("User not found for addStage");
            return;
        }

        const stages = pipelines[pipelineId]?.stages || [];
        const newOrderIndex = stages.length;

        // Optimistic Update
        const tempId = generateId();
        const newStage: Stage = {
            id: tempId,
            pipelineId,
            title
        };

        setPipelines(prev => ({
            ...prev,
            [pipelineId]: {
                ...prev[pipelineId],
                stages: [...(prev[pipelineId]?.stages || []), newStage]
            }
        }));

        try {
            const { data, error } = await supabase.from('stages').insert({
                id: tempId,
                pipeline_id: pipelineId,
                name: title,
                order_index: newOrderIndex,
                user_id: user.id
            }).select().single();

            if (data && !error) {
                // Confirm ID
                setPipelines(prev => ({
                    ...prev,
                    [pipelineId]: {
                        ...prev[pipelineId],
                        stages: prev[pipelineId].stages.map(s => s.id === tempId ? { ...s, id: data.id } : s)
                    }
                }));
            } else {
                console.error("Error adding stage:", error);
                fetchAll();
            }
        } catch (e) {
            console.error('Failed to add stage', e);
            fetchAll(); // Revert
        }
    };

    const updateStage = async (stageId: string, updates: Partial<Stage>) => {
        // Find pipeline for this stage (inefficient but safe)
        const pipelineId = Object.keys(pipelines).find(pId =>
            pipelines[pId].stages.some(s => s.id === stageId)
        );
        if (!pipelineId) return;

        setPipelines(prev => ({
            ...prev,
            [pipelineId]: {
                ...prev[pipelineId],
                stages: prev[pipelineId].stages.map(s => s.id === stageId ? { ...s, ...updates } : s)
            }
        }));

        try {
            const dbUpdates: any = {};
            if (updates.title) dbUpdates.name = updates.title;
            // Add other fields if necessary

            if (Object.keys(dbUpdates).length > 0) {
                await supabase.from('stages').update(dbUpdates).eq('id', stageId);
            }
        } catch (e) {
            console.error('Failed to update stage', e);
        }
    };

    const deleteStage = async (stageId: string) => {
        const pipelineId = Object.keys(pipelines).find(pId =>
            pipelines[pId].stages.some(s => s.id === stageId)
        );
        if (!pipelineId) return;

        setPipelines(prev => ({
            ...prev,
            [pipelineId]: {
                ...prev[pipelineId],
                stages: prev[pipelineId].stages.filter(s => s.id !== stageId)
            }
        }));

        try {
            await supabase.from('stages').delete().eq('id', stageId);
        } catch (e) {
            console.error('Failed to delete stage', e);
            fetchAll();
        }
    };

    // --- Cadence Automation Helpers ---

    const isLeadStage = (sId: string) => {
        if (sId === 'new') return true;
        // Search in all pipelines stages
        for (const pipeline of Object.values(pipelines)) {
            const stage = pipeline.stages.find(s => s.id === sId);
            if (!stage) continue;

            const title = stage.title.toUpperCase();
            // It's a lead stage if it has "LEAD" but NOT "ENGAJADO", "RESPONDIDO" or "CONVERSA"
            // (Moving to these stages should stop the cold cadence)
            if (title.includes('LEAD') &&
                !title.includes('ENGAJADO') &&
                !title.includes('RESPONDIDO') &&
                !title.includes('CONVERSA')) return true;
        }
        return false;
    };

    const startLeadSequence = async (dealId: string) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        console.log('🚀 Starting Cadence Sequence for deal:', dealId);

        const now = new Date();
        const newActivities: any[] = [];

        for (const template of LEAD_SEQUENCE_TEMPLATES) {
            const tempId = generateId();
            const dueDate = new Date();
            dueDate.setDate(now.getDate() + template.dayOffset);

            // Default to 12:00, BUT if dayOffset is 0 (Today), set to 1 hour ahead
            let timePart = "12:00:00";
            if (template.dayOffset === 0) {
                const hourAhead = new Date();
                hourAhead.setHours(now.getHours() + 1);
                timePart = `${String(hourAhead.getHours()).padStart(2, '0')}:${String(hourAhead.getMinutes()).padStart(2, '0')}:00`;
            }

            const dueDateIso = `${dueDate.toISOString().split('T')[0]}T${timePart}.000Z`;

            const activityData = {
                id: tempId,
                user_id: user.id,
                deal_id: dealId,
                type: template.activityType,
                title: template.defaultTitle,
                notes: template.defaultDescription,
                date: dueDateIso,
                status: 'pending',
                completed: false,
                origin_stage: 'LEAD',
                sequence_id: template.id // Fixed in templates as static for now
            };

            newActivities.push(activityData);
        }

        // Optimistic Update
        const optimisticActivities = newActivities.map(a => ({
            id: a.id,
            userId: a.user_id,
            dealId: a.deal_id,
            type: a.type,
            title: a.title,
            notes: a.notes,
            dueDate: a.date,
            status: a.status,
            completed: a.completed,
            originStage: a.origin_stage,
            sequenceId: a.sequence_id,
            createdAt: now.toISOString()
        }));

        setActivities(prev => [...prev, ...optimisticActivities]);

        // DB Insert
        const { error } = await supabase.from('activities').insert(newActivities);
        if (error) {
            console.error('❌ Error creating cadence sequence:', error);
            setActivities(prev => prev.filter(a => !newActivities.some(na => na.id === a.id)));
        }
    };

    const cancelLeadSequence = async (dealId: string) => {
        console.log('🗑️ Cleaning up pending Cadence Sequence for deal:', dealId);

        // Optimistic Update: Remove pending activities from state
        setActivities(prev => prev.filter(a =>
            !(a.dealId === dealId && a.originStage === 'LEAD' && a.status === 'pending')
        ));

        // DB Delete: Permanently remove pending activities
        const { error } = await supabase
            .from('activities')
            .delete()
            .eq('deal_id', dealId)
            .eq('origin_stage', 'LEAD')
            .eq('status', 'pending');

        if (error) {
            console.error('❌ Error deleting cadence sequence:', error);
            fetchAll(); // Revert from DB to restore data if delete failed
        }
    };

    const reorderStages = async (pipelineId: string, newOrder: string[]) => {
        // Optimistic Update
        setPipelines(prev => {
            const pipeline = prev[pipelineId];
            if (!pipeline) return prev;

            const currentStagesMap = new Map(pipeline.stages.map(s => [s.id, s]));
            const reorderedStages = newOrder
                .map(id => currentStagesMap.get(id))
                .filter((s): s is Stage => !!s);

            // Append any missing stages (just in case)
            const remaining = pipeline.stages.filter(s => !newOrder.includes(s.id));

            return {
                ...prev,
                [pipelineId]: {
                    ...pipeline,
                    stages: [...reorderedStages, ...remaining]
                }
            };
        });

        // DB Update
        try {
            const updates = newOrder.map((id, index) =>
                supabase.from('stages').update({ order_index: index }).eq('id', id)
            );
            await Promise.all(updates);
        } catch (e) {
            console.error('Failed to reorder stages', e);
        }
    };

    return {
        users: [],
        companies,
        contacts,
        deals,
        activities,
        pipelines,
        isLoading,
        isPipelineSettingsOpen,
        setPipelineSettingsOpen,
        addDeal, updateDeal, moveDeal, deleteDeal,
        addContact, updateContact, deleteContact,
        addActivity, updateActivity, deleteActivity,
        completeActivityWithLog, addLog,
        addCompany, updateCompany, deleteCompany,
        logs,
        deleteLog,
        addStage,
        updateStage,
        deleteStage,
        reorderStages,
        activeFocusDealId,
        openFocusDeal,
        closeFocusDeal,
        getPipelineStages: (pid: string) => pipelines[pid]?.stages || [],
        refresh: fetchAll,

        // Modal Actions
        isNewDealModalOpen,
        openNewDealModal,
        closeNewDealModal,
        newDealStageId,
        dealToEdit,

        isPrivacyMode,
        togglePrivacyMode
    };
}

