import { useState, useEffect, useCallback } from 'react';
import {
    User, Company, Contact, Deal, Activity, Pipeline, Stage, DealLog,
    Campaign, EmailTemplate, CampaignSender, CadenceTemplate
} from '../types/schema';
import { supabase } from '@/lib/supabase';


// --- Types ---
export interface CRMStore {
    users: User[]; // Kept for type compatibility, though managed by Auth now
    companies: Company[];
    contacts: Contact[];
    deals: Deal[];
    activities: Activity[];
    logs: DealLog[];
    pipelines: Record<string, Pipeline>;
    campaigns: Campaign[];
    emailTemplates: EmailTemplate[];
    campaignSenders: CampaignSender[];
    cadenceTemplates: CadenceTemplate[];
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
    completeActivityWithLog: (activityId: string, content?: string, houveResposta?: boolean) => Promise<void>;

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

    // Campaigns Actions
    addCampaign: (campaign: Omit<Campaign, 'id' | 'createdAt' | 'createdBy' | 'sentCount' | 'openedCount' | 'clickedCount'>) => Promise<void>;
    updateCampaign: (id: string, updates: Partial<Campaign>) => Promise<void>;
    deleteCampaign: (id: string) => Promise<void>;
    duplicateCampaign: (campaign: Campaign) => Promise<void>;

    addEmailTemplate: (template: Omit<EmailTemplate, 'id' | 'createdAt'>) => Promise<void>;
    updateEmailTemplate: (id: string, updates: Partial<EmailTemplate>) => Promise<void>;
    deleteEmailTemplate: (id: string) => Promise<void>;

    addCampaignSender: (sender: Omit<CampaignSender, 'id' | 'createdAt' | 'isVerified'>) => Promise<void>;
    updateCampaignSender: (id: string, updates: Partial<CampaignSender>) => Promise<void>;
    deleteCampaignSender: (id: string) => Promise<void>;
    verifySender: (id: string) => Promise<void>;

    // Cadence Templates
    updateCadenceTemplate: (id: string, updates: Partial<CadenceTemplate>) => Promise<void>;

    // Merge Helpers (Optional, or just use atomic actions)
}

// Deal statuses automatically excluded from all campaign mailing lists
const EXCLUDED_DEAL_STATUSES_FOR_CAMPAIGNS = ['lost', 'desqualificado'] as const;

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

const adjustDateForWeekend = (isoDateString: string): string => {
    if (!isoDateString) return isoDateString;
    const date = new Date(isoDateString);
    if (isNaN(date.getTime())) return isoDateString;

    const day = date.getDay(); // 0 is Sunday, 6 is Saturday
    if (day === 0) {
        date.setDate(date.getDate() + 1); // Move to Monday
    } else if (day === 6) {
        date.setDate(date.getDate() + 2); // Move to Monday
    }
    return date.toISOString();
};

export function useCRMStore(): CRMStore {
    const [deals, setDeals] = useState<Deal[]>([]);
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [activities, setActivities] = useState<Activity[]>([]);
    const [logs, setLogs] = useState<DealLog[]>([]);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([]);
    const [campaignSenders, setCampaignSenders] = useState<CampaignSender[]>([]);
    const [cadenceTemplates, setCadenceTemplates] = useState<CadenceTemplate[]>([]);
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
                { data: contactsData },
                { data: activitiesData, error: activitiesError },
                { data: logsData, error: logsError },
                { data: companiesData },
                { data: stagesData },
                { data: campaignsData },
                { data: templatesData },
                { data: sendersData },
                { data: cadenceData }
            ] = await Promise.all([
                supabase.from('deals').select('*'),
                supabase.from('contacts').select('*'),
                supabase.from('activities').select('*'),
                supabase.from('deal_logs').select('*'),
                supabase.from('companies').select('*'),
                supabase.from('stages').select('*').order('order_index', { ascending: true }),
                supabase.from('campaigns').select('*'),
                supabase.from('email_templates').select('*'),
                supabase.from('senders').select('*'),
                supabase.from('cadence_templates').select('*').order('tag', { ascending: true }).order('step', { ascending: true })
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
                    leadSequenceStarted: d.lead_sequence_started || false,
                    instagramUrl: d.instagram_url,
                    adLibraryUrl: d.ad_library_url
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
                    marketingStatus: c.marketing_status || 'unsubscribed',
                    createdAt: c.created_at
                })));
            }

            // 3. Map & Set Activities (Merging Optimistic)
            if (activitiesData) {
                const fetched: Activity[] = activitiesData.map(a => ({
                    ...a,
                    dealId: a.deal_id,
                    userId: a.user_id,
                    createdAt: a.created_at,
                    dueDate: a.date,
                    completed: a.completed,
                    status: a.status || (a.completed ? 'completed' : 'pending'),
                    completedAt: a.completed_at,
                    houveResposta: a.houve_resposta,
                    originStage: a.origin_stage,
                    sequenceId: a.sequence_id,
                    isAutomatic: a.is_automatic,
                    sequenceStep: a.sequence_step
                }));

                setActivities(prev => {
                    // Keep optimistic ones that aren't in the fetched list yet
                    const optimisticOnes = prev.filter(a => (a as any).isOptimistic);
                    const filteredOptimistic = optimisticOnes.filter(opt =>
                        !fetched.some(real =>
                            real.dealId === opt.dealId &&
                            real.title === opt.title &&
                            real.status === opt.status
                        )
                    );
                    return [...fetched, ...filteredOptimistic];
                });
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

            // 7. Set Campaigns
            if (campaignsData) {
                setCampaigns(campaignsData.map((c: any) => ({
                    ...c,
                    fromName: c.from_name,
                    fromEmail: c.from_email,
                    replyTo: c.reply_to,
                    templateId: c.template_id,
                    listId: c.list_id,
                    scheduledAt: c.scheduled_at,
                    sentAt: c.sent_at,
                    sentCount: c.sent_count || 0,
                    openedCount: c.opened_count || 0,
                    clickedCount: c.clicked_count || 0,
                    createdBy: c.created_by,
                    createdAt: c.created_at
                })));
            }

            // 8. Set Templates
            if (templatesData) {
                setEmailTemplates(templatesData.map((t: any) => ({
                    ...t,
                    htmlContent: t.html_content,
                    jsonContent: t.json_content,
                    isPublic: t.is_public,
                    createdAt: t.created_at,
                    subject: t.subject,
                    category: t.category
                })));
            }

            // 9. Set Senders
            if (sendersData) {
                setCampaignSenders(sendersData.map((s: any) => ({
                    ...s,
                    isVerified: s.is_verified,
                    verificationToken: s.verification_token,
                    createdAt: s.created_at
                })));
            }

            // 10. Set Cadence Templates
            if (cadenceData) {
                setCadenceTemplates(cadenceData.map((t: any) => ({
                    ...t,
                    script: t.script,
                    days: t.days,
                    description: t.description || ''
                })));
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

        // Listen for DB Changes (Realtime Sync)
        const channel = supabase.channel('schema-db-changes')
            .on('postgres_changes', { event: '*', schema: 'public' }, (payload: any) => {
                console.log('🔔 Realtime change detected:', payload.table, payload.eventType);

                if (payload.table === 'activities' && payload.eventType === 'INSERT') {
                    const newAct = payload.new;
                    const mapped: Activity = {
                        ...newAct,
                        dealId: newAct.deal_id,
                        userId: newAct.user_id,
                        createdAt: newAct.created_at,
                        dueDate: newAct.date,
                        completed: newAct.completed,
                        status: newAct.status || 'pending',
                        originStage: newAct.origin_stage,
                        isAutomatic: newAct.is_automatic,
                        sequenceStep: newAct.sequence_step
                    };
                    setActivities(prev => {
                        if (prev.some(a => a.id === mapped.id)) return prev;
                        // Remove matching optimistic placeholder
                        const filtered = prev.filter(a => !((a as any).isOptimistic && a.dealId === mapped.dealId && a.title === mapped.title));
                        return [...filtered, mapped];
                    });
                } else if (payload.table === 'activities' && payload.eventType === 'DELETE') {
                    setActivities(prev => prev.filter(a => a.id !== payload.old.id));
                } else {
                    fetchAll();
                }
            })
            .subscribe((status) => {
                console.log('📡 Realtime status:', status);
                if (status === 'SUBSCRIBED') {
                    console.log('✅ Realtime connected and listening for changes');
                }
            });

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

    // --- Atomic Helper Actions ---

    async function addLog(data: Omit<DealLog, 'id' | 'createdAt' | 'createdBy'>) {
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
    }

    async function deleteLog(id: string) {
        setLogs(prev => prev.filter(l => l.id !== id));
        const { error } = await supabase.from('deal_logs').delete().eq('id', id);
        if (error) {
            console.error('Error deleting log:', error);
            alert(`Erro ao excluir nota: ${error.message}`);
            fetchAll();
        }
    }

    async function addActivity(data: any) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const tempId = generateId();

        let normalizedDate = data.dueDate;
        if (normalizedDate && normalizedDate.length === 10) {
            normalizedDate = `${normalizedDate}T12:00:00.000Z`;
        }
        normalizedDate = adjustDateForWeekend(normalizedDate || data.dueDate);

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
            houve_resposta: data.houveResposta !== undefined ? data.houveResposta : false,
            origin_stage: data.originStage,
            sequence_id: data.sequenceId,
            sequence_step: data.sequenceStep,
            tooltip_script: data.tooltipScript
        };

        let optimisticDate = normalizedDate || data.dueDate;
        const optimisticActivity = {
            ...data,
            dueDate: optimisticDate,
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
    }

    async function updateActivity(id: string, updates: Partial<Activity>) {
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
        if (synchronizedUpdates.houveResposta !== undefined) dbUpdates.houve_resposta = synchronizedUpdates.houveResposta;

        if (synchronizedUpdates.dueDate !== undefined) {
            let normalizedDate = synchronizedUpdates.dueDate;
            if (normalizedDate && normalizedDate.length === 10) {
                normalizedDate = `${normalizedDate}T12:00:00.000Z`;
            }
            dbUpdates.date = adjustDateForWeekend(normalizedDate);
        }
        if (synchronizedUpdates.dealId !== undefined) dbUpdates.deal_id = synchronizedUpdates.dealId;
        if (synchronizedUpdates.contactId !== undefined) dbUpdates.contact_id = synchronizedUpdates.contactId;
        if (synchronizedUpdates.originStage !== undefined) dbUpdates.origin_stage = synchronizedUpdates.originStage;
        if (synchronizedUpdates.sequenceId !== undefined) dbUpdates.sequence_id = synchronizedUpdates.sequenceId;
        if (synchronizedUpdates.sequenceStep !== undefined) dbUpdates.sequence_step = synchronizedUpdates.sequenceStep;
        if (synchronizedUpdates.tooltipScript !== undefined) dbUpdates.tooltip_script = synchronizedUpdates.tooltipScript;

        dbUpdates.updated_at = new Date().toISOString();

        const { error } = await supabase.from('activities').update(dbUpdates).eq('id', id);
        if (error) {
            console.error('Update activity error', error);
            alert(`Erro ao salvar atividade: ${error.message}.`);
        } else if (synchronizedUpdates.completed === true) {
            setTimeout(fetchAll, 300);
        }
    }

    async function deleteActivity(id: string) {
        setActivities(prev => prev.filter(a => a.id !== id));
        await supabase.from('activities').delete().eq('id', id);
    }

    async function completeActivityWithLog(activityId: string, content?: string, houveResposta?: boolean) {
        let activity = activities.find(a => a.id === activityId);
        if (!activity) return;

        if (activityId.startsWith('opt-')) {
            const realActivity = activities.find(a =>
                !a.id.startsWith('opt-') &&
                a.dealId === activity?.dealId &&
                a.title === activity?.title &&
                a.status === 'pending'
            );
            if (realActivity) {
                activity = realActivity;
                activityId = realActivity.id;
            }
        }

        const now = new Date().toISOString();

        await updateActivity(activityId, {
            completed: true,
            status: 'completed',
            completedAt: now,
            houveResposta: houveResposta
        });

        await addLog({
            dealId: activity.dealId!,
            activityId: activityId.startsWith('opt-') ? undefined : activityId,
            content: content?.trim() || "Atividade concluída sem observações.",
            logType: content?.trim() ? 'activity_note' : 'system'
        });
    }

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
            pipeline_id: data.pipelineId,
            instagram_url: data.instagramUrl,
            ad_library_url: data.adLibraryUrl
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
            if (updates.status === 'desqualificado' && !updates.disqualifiedAt) finalUpdates.disqualifiedAt = now;

            // Log History Activity
            const statusLabels: Record<string, string> = { open: 'Aberto', won: 'Ganho', lost: 'Perdido', desqualificado: 'Desqualificado' };
            const historyTitle = `Status alterado de ${statusLabels[originalDeal.status]} para ${statusLabels[updates.status]}`;

            addActivity({
                type: 'status_change',
                title: historyTitle,
                notes: updates.lostReason ? `Motivo: ${updates.lostReason}` :
                    updates.disqualifiedReason ? `Motivo: ${updates.disqualifiedReason}` : undefined,
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
        if (finalUpdates.disqualifiedAt !== undefined) dbUpdates.disqualified_at = finalUpdates.disqualifiedAt;
        if (finalUpdates.disqualifiedReason !== undefined) dbUpdates.disqualified_reason = finalUpdates.disqualifiedReason;
        if (finalUpdates.position !== undefined) dbUpdates.position = finalUpdates.position;
        if (finalUpdates.pipelineId !== undefined) dbUpdates.pipeline_id = finalUpdates.pipelineId;
        if (finalUpdates.leadSequenceStarted !== undefined) dbUpdates.lead_sequence_started = finalUpdates.leadSequenceStarted;
        if (finalUpdates.instagramUrl !== undefined) dbUpdates.instagram_url = finalUpdates.instagramUrl;
        if (finalUpdates.adLibraryUrl !== undefined) dbUpdates.ad_library_url = finalUpdates.adLibraryUrl;

        if (updates.stageId && updates.stageId !== originalDeal.stageId) {
            // Stage Automations now handled by Backend Trigger (backend_cadence_automation.sql)
            console.log('📡 Stage change detected. Backend trigger will handle cadences.');
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

                // Extra safety: Sync deal_analytics status if status was changed
                if (dbUpdates.status) {
                    supabase.from('deal_analytics').update({
                        status_final: dbUpdates.status,
                        closed_at: dbUpdates.status !== 'open' ? new Date().toISOString() : null,
                        updated_at: new Date().toISOString()
                    }).eq('deal_id', id).then(({ error: syncErr }) => {
                        if (syncErr) console.warn('Sync deal_analytics warning:', syncErr);
                    });
                }

                // --- LIMPEZA AUTOMÁTICA DE ATIVIDADES PENDENTES ---
                // Ao encerrar negócio (perdido ou desqualificado), remove todas as
                // atividades pendentes. Atividades concluídas são preservadas no histórico.
                const isClosingDeal =
                    updates.status &&
                    updates.status !== originalDeal.status &&
                    (updates.status === 'lost' || updates.status === 'desqualificado');

                if (isClosingDeal) {
                    const PENDING_STATUSES = ['pending', 'aberta', 'agendada', 'canceled'];

                    // 1. Identificar atividades pendentes deste negócio no estado local
                    const pendingActivityIds = activities
                        .filter(a =>
                            a.dealId === id &&
                            !a.completed &&
                            (PENDING_STATUSES.includes(a.status) || !a.status || a.status === 'pending')
                        )
                        .map(a => a.id);

                    console.log(`🧹 [Deal Closed] Removing ${pendingActivityIds.length} pending activity(ies) for deal ${id}`);

                    if (pendingActivityIds.length > 0) {
                        // 2. Remoção otimista do estado local
                        setActivities(prev => prev.filter(a => !pendingActivityIds.includes(a.id)));

                        // 3. Deleção no Supabase — remove todas as atividades não concluídas
                        const { error: delErr } = await supabase
                            .from('activities')
                            .delete()
                            .eq('deal_id', id)
                            .eq('completed', false);

                        if (delErr) {
                            console.error('⚠️ [Deal Closed] Error deleting pending activities:', delErr);
                        } else {
                            console.log(`✅ [Deal Closed] ${pendingActivityIds.length} pending activity(ies) removed.`);

                            // 4. Registrar evento no histórico do negócio
                            addActivity({
                                type: 'system',
                                title: '🧹 Atividades pendentes removidas automaticamente após encerramento do negócio.',
                                dealId: id,
                                completed: true,
                                dueDate: now
                            });
                        }
                    }
                }
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

        console.log('📦 Persistence: Moving deal', { id, ...updates });
        const { error } = await supabase.from('deals').update(updates).eq('id', id);

        if (error) {
            console.error('❌ Error moving deal:', error);
            alert(`Erro ao salvar movimento: ${error.message}`);
            fetchAll(); // Revert from DB
        } else {
            // 1. OPTIMISTIC CLEANUP (Remove ALL pending automatic activities to prevent duplicates/ghosts)
            console.log('🧹 Optimistic Cleanup: Removing old automatic activities for deal', id);
            setActivities(prev => prev.filter(a => {
                const isDealActivity = a.dealId === id;
                const isAutomatic = a.isAutomatic === true || (a as any).is_automatic === true;
                const isPending = a.status === 'pending' || !a.status || !a.completed;
                // Only keep manual tasks or completed tasks
                return !(isDealActivity && isAutomatic && isPending);
            }));

            // 2. OPTIMISTIC ACTIVITY CREATION (Instant visual feedback)
            // This MUST match the backend templates in public.cadence_templates
            const stages = Object.values(pipelines).flatMap(p => p.stages || []);
            const targetStage = stages.find(s => s.id === stageId);
            const stageName = targetStage?.title?.toUpperCase() || '';

            let optimisticActivity: any = null;
            let targetDate = new Date().toISOString();
            const deal = deals.find(d => d.id === id);

            console.log('🔍 Cadence Detection:', { stageName, id });

            if (stageName.includes('LEAD') && !stageName.includes('ENGAJADO')) {
                // First step for LEAD typically is at offset 0, but we must run weekend check
                targetDate = adjustDateForWeekend(targetDate);
                optimisticActivity = { id: 'opt-' + generateId(), dealId: id, type: 'message', title: 'WhatsApp: Mensagem inicial', dueDate: targetDate, status: 'pending', isAutomatic: true, originStage: 'LEAD', sequenceStep: 1, userId: deal?.userId, createdAt: targetDate, isOptimistic: true };
            } else if (stageName.includes('ENGAJADO')) {
                targetDate = adjustDateForWeekend(targetDate);
                // FIXED: Match title with Master Cadence Fix
                optimisticActivity = { id: 'opt-' + generateId(), dealId: id, type: 'message', title: 'Resposta + Pergunta Estratégica', dueDate: targetDate, status: 'pending', isAutomatic: true, originStage: 'ENGAJADO', sequenceStep: 1, userId: deal?.userId, createdAt: targetDate, isOptimistic: true };
            } else if (stageName.includes('DIAGN') || stageName.includes('REUNI') || stageName.includes('AGENDA')) {
                targetDate = adjustDateForWeekend(targetDate);
                optimisticActivity = { id: 'opt-' + generateId(), dealId: id, type: 'message', title: 'RD – Confirmação oficial', dueDate: targetDate, status: 'pending', isAutomatic: true, originStage: 'DIAGNOSTICO', sequenceStep: 1, userId: deal?.userId, createdAt: targetDate, isOptimistic: true };
            } else if (stageName.includes('FECHAMENTO') || stageName.includes('PROPOSTA')) {
                targetDate = adjustDateForWeekend(targetDate);
                optimisticActivity = { id: 'opt-' + generateId(), dealId: id, type: 'message', title: 'FE – Resumo pós-reunião', dueDate: targetDate, status: 'pending', isAutomatic: true, originStage: 'FECHAMENTO', sequenceStep: 1, userId: deal?.userId, createdAt: targetDate, isOptimistic: true };
            }

            if (optimisticActivity) {
                setActivities(prev => {
                    // Avoid duplicating if real activity arrived quickly via refresh/realtime
                    const exists = prev.some(a => a.dealId === id && a.title === optimisticActivity.title && (a.status === 'pending' || !a.completed));
                    if (exists) return prev;
                    return [...prev, optimisticActivity];
                });
            }

            // 3. BACKGROUND REFRESH
            setTimeout(fetchAll, 1000);
            setTimeout(fetchAll, 4000);
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
            company_id: data.companyId,
            marketing_status: data.marketingStatus
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
        if (updates.marketingStatus !== undefined) dbUpdates.marketing_status = updates.marketingStatus;

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


    // --- Activities ---


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

    // --- Backend Note ---
    // Cadence automations are managed by the PostgreSQL trigger 'tr_deal_stage_cadence'.
    // See backend_cadence_automation.sql for details.


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

    // --- Campaign Actions ---

    const addCampaign = async (data: Omit<Campaign, 'id' | 'createdAt' | 'createdBy' | 'sentCount' | 'openedCount' | 'clickedCount'>) => {
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user;
        if (!user || !session) return;

        const tempId = generateId();
        const optimisticCampaign: Campaign = {
            ...data,
            id: tempId,
            createdBy: user.id,
            createdAt: new Date().toISOString(),
            sentCount: data.recipients?.length || 0,
            deliveredCount: 0,
            openedCount: 0,
            clickedCount: 0
        };

        const newCampaign = {
            id: tempId,
            name: data.name,
            subject: data.subject,
            from_name: data.fromName,
            from_email: data.fromEmail,
            reply_to: data.replyTo,
            template_id: data.templateId,
            list_id: data.listId,
            content: data.content,
            status: data.status === 'sent' ? 'sending' : data.status,
            sent_count: data.recipients?.length || 0,
            delivered_count: 0,
            scheduled_at: data.scheduledAt,
            sent_at: data.sentAt,
            created_by: user.id
        };

        setCampaigns(prev => [...prev, optimisticCampaign]);

        // 1. Insert Campaign
        const { error } = await supabase.from('campaigns').insert(newCampaign);
        if (error) {
            console.error('Error adding campaign:', error);
            setCampaigns(prev => prev.filter(c => c.id !== tempId));
            return;
        }

        // 2. Insert Recipients
        if (data.recipients && data.recipients.length > 0) {
            // --- Store-level safety filter ---
            // Exclude recipients with invalid email or whose deal is lost/disqualified
            const eligibleRecipients = data.recipients.filter(r => {
                // Email must exist and be non-empty
                if (!r.email || r.email.trim() === '' || !r.email.includes('@')) return false;
                // If linked to a deal, that deal must not be excluded
                if (r.dealId) {
                    const linkedDeal = deals.find(d => d.id === r.dealId);
                    if (linkedDeal && (EXCLUDED_DEAL_STATUSES_FOR_CAMPAIGNS as readonly string[]).includes(linkedDeal.status)) {
                        console.warn(`🚫 [Campaign] Skipping recipient ${r.email} — deal ${r.dealId} is ${linkedDeal.status}`);
                        return false;
                    }
                }
                return true;
            });

            const skippedCount = data.recipients.length - eligibleRecipients.length;
            if (skippedCount > 0) {
                console.log(`🛡️ [Campaign] Filtered out ${skippedCount} ineligible recipient(s) (lost/disqualified deals or invalid emails).`);
            }

            const recipientsToInsert = eligibleRecipients.map(r => ({
                campaign_id: tempId,
                email: r.email,
                person_id: r.personId,
                deal_id: r.dealId,
                status: data.status === 'sent' ? 'sent' : 'pending'
            }));

            const { error: recipientsError } = await supabase.from('campaign_recipients').insert(recipientsToInsert);
            if (recipientsError) {
                console.error('Error adding recipients:', recipientsError);
            }

            // 3. Dispatch Emails (if 'sent')
            if (data.status === 'sent') {
                try {
                    console.log('🚀 [Store] Calling backend send-campaign for ID:', tempId);
                    const response = await fetch('/api/send-campaign', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${session.access_token}`
                        },
                        body: JSON.stringify({
                            campaignId: tempId
                        })
                    });

                    if (response.ok) {
                        const result = await response.json();
                        console.log('✅ [Store] Campaign API Success:', result);
                        // Refresh to get latest statuses from DB
                        fetchAll();
                    } else {
                        const errorMsg = await response.text();
                        console.error('🔥 [Store] Campaign API Error:', errorMsg);
                        setCampaigns(prev => prev.map(c => c.id === tempId ? { ...c, status: 'failed' } : c));
                        await supabase.from('campaigns').update({ status: 'failed' }).eq('id', tempId);
                    }
                } catch (e) {
                    console.error('🔥 [Store] Critical Fetch Error:', e);
                    setCampaigns(prev => prev.map(c => c.id === tempId ? { ...c, status: 'failed' } : c));
                    await supabase.from('campaigns').update({ status: 'failed' }).eq('id', tempId);
                    alert('Erro ao enviar campanha. O servidor (backend) pode estar desligado. Inicie o "npm run dev".');
                }
            }
        }
    };

    const updateCampaign = async (id: string, updates: Partial<Campaign>) => {
        setCampaigns(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));

        const dbUpdates: any = {};
        if (updates.name !== undefined) dbUpdates.name = updates.name;
        if (updates.subject !== undefined) dbUpdates.subject = updates.subject;
        if (updates.fromName !== undefined) dbUpdates.from_name = updates.fromName;
        if (updates.fromEmail !== undefined) dbUpdates.from_email = updates.fromEmail;
        if (updates.status !== undefined) dbUpdates.status = updates.status;
        if (updates.scheduledAt !== undefined) dbUpdates.scheduled_at = updates.scheduledAt;
        if (updates.sentAt !== undefined) dbUpdates.sent_at = updates.sentAt;
        if (updates.deliveredCount !== undefined) dbUpdates.delivered_count = updates.deliveredCount;

        await supabase.from('campaigns').update(dbUpdates).eq('id', id);
    };

    const deleteCampaign = async (id: string) => {
        setCampaigns(prev => prev.filter(c => c.id !== id));
        await supabase.from('campaigns').delete().eq('id', id);
    };

    const duplicateCampaign = async (campaign: Campaign) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { id, createdAt, sentAt, sentCount, openedCount, clickedCount, status, deliveredCount, ...baseData } = campaign;

        await addCampaign({
            ...baseData,
            name: `${baseData.name} (Cópia)`,
            status: 'draft',
            sentCount: 0,
            deliveredCount: 0,
            openedCount: 0,
            clickedCount: 0
        } as any);
    };

    const addEmailTemplate = async (data: Omit<EmailTemplate, 'id' | 'createdAt'>) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const tempId = generateId();
        const newTemplate = {
            id: tempId,
            name: data.name,
            subject: data.subject,
            html_content: data.htmlContent,
            json_content: data.jsonContent,
            thumbnail: data.thumbnail,
            category: data.category,
            is_public: data.isPublic,
            user_id: user.id
        };

        const optimisticTemplate: EmailTemplate = {
            ...data,
            id: tempId,
            createdAt: new Date().toISOString()
        };

        setEmailTemplates(prev => [...prev, optimisticTemplate]);

        const { error } = await supabase.from('email_templates').insert(newTemplate);
        if (error) {
            console.error('Error adding template:', error);
            setEmailTemplates(prev => prev.filter(t => t.id !== tempId));
        }
    };

    const updateEmailTemplate = async (id: string, updates: Partial<EmailTemplate>) => {
        setEmailTemplates(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));

        const dbUpdates: any = {};
        if (updates.name !== undefined) dbUpdates.name = updates.name;
        if (updates.subject !== undefined) dbUpdates.subject = updates.subject;
        if (updates.htmlContent !== undefined) dbUpdates.html_content = updates.htmlContent;
        if (updates.jsonContent !== undefined) dbUpdates.json_content = updates.jsonContent;
        if (updates.category !== undefined) dbUpdates.category = updates.category;
        if (updates.thumbnail !== undefined) dbUpdates.thumbnail = updates.thumbnail;

        await supabase.from('email_templates').update(dbUpdates).eq('id', id);
    };

    const deleteEmailTemplate = async (id: string) => {
        setEmailTemplates(prev => prev.filter(t => t.id !== id));
        await supabase.from('email_templates').delete().eq('id', id);
    };

    const addCampaignSender = async (data: Omit<CampaignSender, 'id' | 'createdAt' | 'isVerified'>) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const tempId = generateId();
        const newSender = {
            id: tempId,
            name: data.name,
            email: data.email,
            is_verified: false,
            user_id: user.id
        };

        const optimisticSender: CampaignSender = {
            ...data,
            id: tempId,
            isVerified: false,
            createdAt: new Date().toISOString()
        };

        setCampaignSenders(prev => [...prev, optimisticSender]);

        const { error } = await supabase.from('senders').insert(newSender);
        if (error) {
            console.error('Error adding sender:', error);
            setCampaignSenders(prev => prev.filter(s => s.id !== tempId));
        }
    };

    const updateCampaignSender = async (id: string, updates: Partial<CampaignSender>) => {
        setCampaignSenders(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));

        const dbUpdates: any = {};
        if (updates.name !== undefined) dbUpdates.name = updates.name;
        if (updates.email !== undefined) dbUpdates.email = updates.email;

        await supabase.from('senders').update(dbUpdates).eq('id', id);
    };

    const deleteCampaignSender = async (id: string) => {
        setCampaignSenders(prev => prev.filter(s => s.id !== id));
        await supabase.from('senders').delete().eq('id', id);
    };

    const verifySender = async (id: string) => {
        setCampaignSenders(prev => prev.map(s => s.id === id ? { ...s, isVerified: true } : s));
        await supabase.from('senders').update({ is_verified: true }).eq('id', id);
    };

    const updateCadenceTemplate = async (id: string, updates: Partial<CadenceTemplate>) => {
        setCadenceTemplates(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));

        const dbUpdates: any = { ...updates };
        delete dbUpdates.id;
        dbUpdates.updated_at = new Date().toISOString();

        const { error } = await supabase.from('cadence_templates').update(dbUpdates).eq('id', id);
        if (error) {
            console.error('Error updating cadence template:', error);
            alert(`Erro ao salvar template: ${error.message}`);
            fetchAll();
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
        togglePrivacyMode,

        campaigns,
        emailTemplates,
        campaignSenders,
        addCampaign,
        updateCampaign,
        deleteCampaign,
        duplicateCampaign,
        addEmailTemplate,
        updateEmailTemplate,
        deleteEmailTemplate,
        addCampaignSender,
        updateCampaignSender,
        deleteCampaignSender,
        verifySender,
        cadenceTemplates,
        updateCadenceTemplate
    };
}

