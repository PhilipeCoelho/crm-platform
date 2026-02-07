import { useState, useEffect, useCallback } from 'react';
import {
    User, Company, Contact, Deal, Activity, Pipeline, Stage,
    DEFAULT_PIPELINES
} from '../types/schema';
import { supabase } from '@/lib/supabase';


// --- Types ---
export interface CRMStore {
    users: User[]; // Kept for type compatibility, though managed by Auth now
    companies: Company[];
    contacts: Contact[];
    deals: Deal[];
    activities: Activity[];
    pipelines: Record<string, Pipeline>;

    // Actions
    addDeal: (deal: Omit<Deal, 'id' | 'createdAt' | 'updatedAt' | 'userId'>) => Promise<void>;
    updateDeal: (id: string, updates: Partial<Deal>) => Promise<void>;
    moveDeal: (id: string, stageId: string, position?: number) => void;
    deleteDeal: (id: string) => Promise<void>;

    addCompany: (company: Omit<Company, 'id' | 'createdAt'>) => Promise<Company>;
    updateCompany: (id: string, updates: Partial<Company>) => Promise<void>;

    addContact: (contact: Omit<Contact, 'id' | 'createdAt' | 'userId'>) => Promise<Contact>;
    updateContact: (id: string, updates: Partial<Contact>) => Promise<void>;
    deleteContact: (id: string) => Promise<void>;

    addActivity: (activity: Omit<Activity, 'id' | 'createdAt' | 'userId'>) => Promise<void>;
    updateActivity: (id: string, updates: Partial<Activity>) => Promise<void>;
    deleteActivity: (id: string) => Promise<void>;

    // Helpers
    getPipelineStages: (pipelineId: string) => Stage[];
    refresh: () => Promise<void>;
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
    const [companies, setCompanies] = useState<Company[]>([]);
    // *Correction*: User schema didn't fully specifying Company table. 
    // We will handle Companies as local-only for now OR map to a simple jsonb if needed. 
    // For this migration, let's keep companies in memory/local storage or create a table if requested. 
    // Given the prompt, we focus on Deals/Activities/Profiles. Contacts table exists.
    // Let's create a local mock for companies to avoid breaking UI, or sync if table existed.

    const [pipelines] = useState<Record<string, Pipeline>>(() => {
        try {
            const saved = localStorage.getItem('crm_pipelines');
            if (saved) {
                const parsed = JSON.parse(saved);
                // Validate structure (basic check)
                const isValid = Object.values(parsed).every((p) => {
                    const pipe = p as Partial<Pipeline>;
                    return Array.isArray(pipe.stages);
                });
                if (isValid) return parsed as Record<string, Pipeline>;
            }
        } catch (e) {
            console.error('Failed to parse pipelines from storage', e);
        }
        return DEFAULT_PIPELINES;
    });

    // --- Data Fetching ---
    const fetchAll = useCallback(async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Fetch Deals
        const { data: dealsData } = await supabase.from('deals').select('*');
        if (dealsData) {
            // Map SQL columns to Frontend types if needed (snake_case to camelCase)
            const mappedDeals: Deal[] = dealsData.map(d => ({
                ...d,
                columnId: d.stage_id,
                stageId: d.stage_id,
                contactId: d.contact_id,
                userId: d.user_id,
                createdAt: d.created_at,
                updatedAt: d.created_at,
                pipelineId: 'sales',
                companyId: d.company_id,
                tags: d.tags || [],
                source: d.source,
                currency: d.currency || 'BRL',
                status: d.status || 'open',
                value: Number(d.value),
                position: d.position || 0
            }));

            // Sort: Position ASC, then CreatedAt DESC (Newest on top for same position)
            // But User wants Newest at Bottom? No, "New Deal" gets High Position -> Bottom.
            // Existing deals (Pos 0) -> Sorted by Date.
            mappedDeals.sort((a, b) => {
                const posA = a.position || 0;
                const posB = b.position || 0;
                if (posA !== posB) return posA - posB;
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            });

            setDeals(mappedDeals);
        }

        // Fetch Contacts
        const { data: contactsData } = await supabase.from('contacts').select('*');
        if (contactsData) {
            setContacts(contactsData.map(c => ({
                ...c,
                userId: c.user_id,
                companyId: '1', // Placeholder
                createdAt: c.created_at
            })));
        }

        // Fetch Activities
        const { data: activitiesData } = await supabase.from('activities').select('*');
        if (activitiesData) {
            setActivities(activitiesData.map(a => ({
                ...a,
                dealId: a.deal_id,
                userId: a.user_id,
                createdAt: a.created_at,
                dueDate: a.date,
                completed: a.completed
            })));
        }

        // Fetch Companies
        const { data: companiesData } = await supabase.from('companies').select('*');
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

        // Listen for DB Changes
        const channel = supabase.channel('crm_realtime')
            .on('postgres_changes', { event: '*', schema: 'public' }, () => {
                console.log('⚡ Realtime update detected. Refetching...');
                fetchAll();
            })
            .subscribe();

        return () => {
            authListener.unsubscribe();
            supabase.removeChannel(channel);
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
            position: newPos
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
        // Optimistic
        const nextDeals = deals.map(d => d.id === id ? { ...d, ...updates } : d);
        setDeals(nextDeals);

        // DB Map
        const dbUpdates: Record<string, unknown> = {};
        if (updates.title !== undefined) dbUpdates.title = updates.title;
        if (updates.value !== undefined) dbUpdates.value = updates.value;
        if (updates.stageId !== undefined) dbUpdates.stage_id = updates.stageId;
        if (updates.status !== undefined) dbUpdates.status = updates.status;
        if (updates.companyId !== undefined) dbUpdates.company_id = updates.companyId;
        if (updates.contactId !== undefined) dbUpdates.contact_id = updates.contactId;
        if (updates.tags !== undefined) dbUpdates.tags = updates.tags;
        if (updates.source !== undefined) dbUpdates.source = updates.source;
        if (updates.currency !== undefined) dbUpdates.currency = updates.currency;
        if (updates.wonAt !== undefined) dbUpdates.won_at = updates.wonAt;
        if (updates.lostAt !== undefined) dbUpdates.lost_at = updates.lostAt;
        if (updates.lostReason !== undefined) dbUpdates.lost_reason = updates.lostReason;
        if (updates.position !== undefined) dbUpdates.position = updates.position;

        if (Object.keys(dbUpdates).length > 0) {
            console.log('📝 Sending Update to DB:', { id, ...dbUpdates });
            const { error } = await supabase.from('deals').update(dbUpdates).eq('id', id);
            if (error) {
                console.error('❌ Error updating deal:', error);
            } else {
                console.log('✅ Update successful for:', id);
            }
        };
    };

    const moveDeal = (id: string, stageId: string, position?: number) => {
        setDeals(prev => prev.map(d => {
            if (d.id === id) {
                return { ...d, stageId, columnId: stageId, position: position !== undefined ? position : d.position };
            }
            return d;
        }));
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

        const newActivity = {
            id: tempId,
            title: data.title,
            type: data.type,
            date: data.dueDate,
            duration: data.duration,
            deal_id: data.dealId,
            user_id: user.id,
            notes: data.notes,
            result: data.result,
            completed: data.completed !== undefined ? data.completed : false
        };

        const optimisticActivity = {
            ...data,
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
        setActivities(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));

        const dbUpdates: Record<string, unknown> = {};
        if (updates.title !== undefined) dbUpdates.title = updates.title;
        if (updates.result !== undefined) dbUpdates.result = updates.result;
        if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
        if (updates.completed !== undefined) dbUpdates.completed = updates.completed;

        const { error } = await supabase.from('activities').update(dbUpdates).eq('id', id);
        if (error) {
            console.error('Update activity error', error);
        }
    };

    const deleteActivity = async (id: string) => {
        setActivities(prev => prev.filter(a => a.id !== id));
        await supabase.from('activities').delete().eq('id', id);
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

    return {
        users: [],
        companies,
        contacts,
        deals,
        activities,
        pipelines,
        addDeal, updateDeal, moveDeal, deleteDeal,
        addContact, updateContact, deleteContact,
        addActivity, updateActivity, deleteActivity,
        addCompany, updateCompany,
        getPipelineStages: (pid: string) => pipelines[pid]?.stages || [],
        refresh: fetchAll
    };
}
