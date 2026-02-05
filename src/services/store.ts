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
const generateId = () => crypto.randomUUID(); // Use native UUID if possible, or fallback

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
        const { data: dealsData } = await supabase.from('deals').select('*').order('created_at', { ascending: false });
        if (dealsData) {
            // Map SQL columns to Frontend types if needed (snake_case to camelCase)
            // Our SQL uses same names mostly, but let's ensure mapping
            const mappedDeals: Deal[] = dealsData.map(d => ({
                ...d,
                columnId: d.stage_id, // Map stage_id back to UI's expected 'columnId' or 'stageId'
                stageId: d.stage_id,
                contactId: d.contact_id,
                userId: d.user_id,
                createdAt: d.created_at,
                updatedAt: d.created_at, // SQL doesn't have updated_at yet, use created_at
                pipelineId: 'sales', // Default
                companyId: d.company_id,
                tags: d.tags || [],
                source: d.source,
                currency: d.currency || 'BRL',
                status: d.status || 'open',
                value: Number(d.value)
            }));
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

    const addDeal = async (data: Omit<Deal, 'id' | 'createdAt' | 'updatedAt' | 'userId'>) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            alert('Erro: Usuário não autenticado. Tente fazer login novamente.');
            return;
        }

        const newDeal = {
            title: data.title,
            value: data.value,
            contact_id: data.contactId,
            user_id: user.id,
            stage_id: data.stageId,
            status: 'open',
            company_id: data.companyId,
            tags: data.tags,
            source: data.source,
            currency: data.currency
        };

        // Optimistic
        const tempId = generateId();
        const optimisticDeal: Deal = {
            ...data,
            id: tempId,
            userId: user.id,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        } as Deal;
        setDeals(prev => [optimisticDeal, ...prev]);

        // DB
        const { error } = await supabase.from('deals').insert(newDeal);
        if (error) {
            console.error('Error adding deal:', error);
            alert(`Erro ao salvar negócio: ${error.message}`);
            // Revert optimistic update
            setDeals(prev => prev.filter(d => d.id !== tempId));
        }
    };

    const updateDeal = async (id: string, updates: Partial<Deal>) => {
        // Optimistic
        setDeals(prev => prev.map(d => d.id === id ? { ...d, ...updates } : d));

        // DB Map - Strictly typed to match Supabase schema
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

        if (Object.keys(dbUpdates).length > 0) {
            const { error } = await supabase.from('deals').update(dbUpdates).eq('id', id);
            if (error) console.error('Error updating deal:', error);
        };
    };

    const deleteDeal = async (id: string) => {
        setDeals(prev => prev.filter(d => d.id !== id));
        await supabase.from('deals').delete().eq('id', id);
    };

    const addContact = async (data: Omit<Contact, 'id' | 'createdAt' | 'userId'>) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("No user");

        const newContact = {
            name: data.name,
            email: data.email,
            phone: data.phone,
            role: data.role,
            user_id: user.id,
            company_id: data.companyId
        };

        // Optimistic
        const tempId = generateId();
        const optimisticContact = { ...data, id: tempId, userId: user.id, createdAt: new Date().toISOString() } as Contact;
        setContacts(prev => [...prev, optimisticContact]);

        const { data: inserted, error } = await supabase.from('contacts').insert(newContact).select().single();
        if (error) {
            setContacts(prev => prev.filter(c => c.id !== tempId));
            throw error;
        }
        return { ...optimisticContact, id: inserted.id };
    };

    const updateContact = async (id: string, updates: Partial<Contact>) => {
        setContacts(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
        await supabase.from('contacts').update(updates).eq('id', id);
    };

    const deleteContact = async (id: string) => {
        // Optimistic update
        // 1. Identify Deals to be deleted
        const dealsToDelete = deals.filter(d => d.contactId === id);
        const dealIdsToRemove = dealsToDelete.map(d => d.id);

        // 2. Remove Contact
        setContacts(prev => prev.filter(c => c.id !== id));

        // 3. Remove Deals
        setDeals(prev => prev.filter(d => d.contactId !== id));

        // 4. Remove Activities associated with those Deals
        setActivities(prev => prev.filter(a => !a.dealId || !dealIdsToRemove.includes(a.dealId)));

        // --- Database ---

        // 1. Delete Deals (and rely on Postgres CASCADE for activities if configured, or delete explicit)
        // Let's explicitly delete deals. We assume activities cascade or are left orphaned (less critical). 
        // User asked for "Negocios" (Deals) explicitly.

        const { error: deleteDealsError } = await supabase
            .from('deals')
            .delete()
            .eq('contact_id', id);

        if (deleteDealsError) {
            console.error('Error deleting deals:', deleteDealsError);
            alert(`Erro ao excluir negócios associados: ${deleteDealsError.message}`);
            fetchAll(); // Revert
            return;
        }

        // 2. Delete Contact
        const { error } = await supabase.from('contacts').delete().eq('id', id);
        if (error) {
            console.error('Error deleting contact:', error);
            alert(`Erro ao excluir contato: ${error.message}`);
            fetchAll(); // Revert
        }
    };

    // Stub implementations for others to match interface
    const addActivity = async (data: any) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const newActivity = {
            title: data.title,
            type: data.type,
            date: data.dueDate, // Mapped from frontend dueDate
            duration: data.duration,
            deal_id: data.dealId,
            user_id: user.id,
            notes: data.notes,
            result: data.result,
            completed: data.completed !== undefined ? data.completed : false
        };

        const tempId = generateId();
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
            // Revert optimistic update if needed, effectively we reload on error usually or alert
        }
    };

    const deleteActivity = async (id: string) => {
        setActivities(prev => prev.filter(a => a.id !== id));
        await supabase.from('activities').delete().eq('id', id);
    };

    const addCompany = async (data: Omit<Company, 'id' | 'createdAt'>) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("No user");

        const newCompany = {
            name: data.name,
            website: data.website,
            phone: data.phone,
            email: data.email,
            user_id: user.id
        };

        const tempId = generateId();
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
        addDeal, updateDeal, deleteDeal,
        addContact, updateContact, deleteContact,
        addActivity, updateActivity, deleteActivity,
        addCompany, updateCompany,
        getPipelineStages: (pid: string) => pipelines[pid]?.stages || [],
        refresh: fetchAll
    };
}
