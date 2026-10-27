import { supabase } from '@/lib/supabase';
import {
    ContentHook,
    ContentIdea,
    ContentReference,
    ContentProposal,
    ProposalApprovalStatus,
    GridApproach,
    FormatOption,
    DevelopedProposal,
    ImprovedIdeaSession
} from '@/types/contentIntelligence';
import { contentKanbanService, DEFAULT_USER_ID } from './contentKanbanService';

// Storage keys de salvaguarda local resiliente (v2 sem seeds antigas)
const STORAGE_HOOKS = 'vamuss_ci_hooks_v2';
const STORAGE_IDEAS = 'vamuss_ci_ideas_v1';
const STORAGE_REFS = 'vamuss_ci_references_v1';
const STORAGE_PROPOSALS = 'vamuss_ci_proposals_v1';
const STORAGE_IMPROVED_SESSIONS = 'vamuss_ci_improved_sessions_v1';

// Seed inicial vazio por pedido do utilizador (a biblioteca começa limpa)
export const DEFAULT_SEED_HOOKS: Omit<ContentHook, 'id' | 'createdAt' | 'updatedAt'>[] = [];

class ContentIntelligenceService {
    private getUserId(userId?: string): string {
        return userId && userId.trim() ? userId.trim() : DEFAULT_USER_ID;
    }

    // =========================================================================
    // 1. GESTÃO DA BIBLIOTECA DE GANCHOS
    // =========================================================================

    async loadHooks(userId?: string): Promise<ContentHook[]> {
        const uid = this.getUserId(userId);
        let hooks: ContentHook[] = [];

        // 1. Tentar ler do Supabase
        try {
            const { data, error } = await supabase
                .from('content_hooks')
                .select('*')
                .order('created_at', { ascending: false });

            if (!error && data && data.length > 0) {
                hooks = data.map(row => ({
                    id: row.id,
                    userId: row.user_id,
                    text: row.text,
                    category: row.category,
                    mechanism: row.mechanism,
                    context: row.context || '',
                    example: row.example || '',
                    notes: row.notes || '',
                    usageCount: row.usage_count || 0,
                    isArchived: !!row.is_archived,
                    createdAt: row.created_at,
                    updatedAt: row.updated_at
                }));
                this.saveHooksLocally(uid, hooks);
                return hooks;
            }
        } catch {
            // Ignorar erro de rede e usar fallback
        }

        // 2. Ler do localStorage (sem preencher com seeds automaticamente)
        try {
            const local = localStorage.getItem(`${STORAGE_HOOKS}_${uid}`) || localStorage.getItem(STORAGE_HOOKS);
            if (local !== null) {
                const parsed = JSON.parse(local);
                if (Array.isArray(parsed)) {
                    return parsed;
                }
            }
        } catch {
            // Fallback silencioso
        }

        // Se vazio, salva array vazio limpo
        this.saveHooksLocally(uid, []);
        return [];
    }

    async clearAllHooks(userId?: string): Promise<void> {
        const uid = this.getUserId(userId);
        this.saveHooksLocally(uid, []);
        try {
            localStorage.removeItem(`${STORAGE_HOOKS}_${uid}`);
            localStorage.removeItem(STORAGE_HOOKS);
            localStorage.removeItem('vamuss_ci_hooks_v1');
            localStorage.removeItem(`vamuss_ci_hooks_v1_${uid}`);
            localStorage.setItem(`${STORAGE_HOOKS}_${uid}`, JSON.stringify([]));
            localStorage.setItem(STORAGE_HOOKS, JSON.stringify([]));
        } catch {}

        try {
            await supabase.from('content_hooks').delete().neq('id', 'placeholder');
        } catch {}
    }

    async batchSaveHooks(rawInput: string, defaultCategory = 'Auto', userId?: string): Promise<{ added: number; hooks: ContentHook[] }> {
        const uid = this.getUserId(userId);
        if (!rawInput || !rawInput.trim()) return { added: 0, hooks: [] };

        // Divide por quebras de linha
        const lines = rawInput.split('\n').map(l => l.trim()).filter(Boolean);
        const existingHooks = await this.loadHooks(uid);
        const existingSet = new Set(existingHooks.map(h => h.text.toLowerCase().trim()));

        const now = new Date().toISOString();
        const newHooks: ContentHook[] = [];

        for (const line of lines) {
            // Remove numeração (1., 2)), marcadores (-, *, •, >) e aspas no início/fim
            const cleanText = line
                .replace(/^(\d+[\.\)\-:]|\*|\-|•|\>|–|—)\s*/, '')
                .replace(/^["'«“]|["'»”]$/g, '')
                .trim();

            if (!cleanText || cleanText.length < 3) continue;
            // Ignora cabeçalhos comuns como "Gancho", "Ganchos", "Hooks", etc.
            if (/^(gancho|ganchos|hook|hooks|lista de ganchos|título|titulo)$/i.test(cleanText)) continue;

            const normalized = cleanText.toLowerCase();
            if (existingSet.has(normalized)) continue;
            existingSet.add(normalized);

            // Deteção inteligente de categoria se for 'Auto' ou 'Geral'
            let category = defaultCategory && defaultCategory !== 'Auto' ? defaultCategory : 'Geral';
            let mechanism = 'Curiosidade';

            if (category === 'Geral' || category === 'Auto') {
                if (cleanText.endsWith('?')) {
                    category = 'Pergunta';
                    mechanism = 'Tensão e Curiosidade';
                } else if (/^(o erro|o maior erro|o pior erro|erro)/i.test(cleanText)) {
                    category = 'Erro Comum';
                    mechanism = 'Alerta de Perda';
                } else if (/^(se |quando )/i.test(cleanText)) {
                    category = 'Se... Então';
                    mechanism = 'Confronto de Causa/Efeito';
                } else if (/^(a maioria|mito|a verdade|o segredo|pare de)/i.test(cleanText)) {
                    category = 'Contradição';
                    mechanism = 'Quebra de Padrão';
                } else if (/\b\d+\s+(passos|erros|formas|dicas|coisas|motivos)\b/i.test(cleanText)) {
                    category = 'Lista / Número';
                    mechanism = 'Especificidade e Retenção';
                } else {
                    category = 'Contradição';
                    mechanism = 'Quebra de Padrão';
                }
            }

            const hook: ContentHook = {
                id: `hook-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                userId: uid,
                text: cleanText,
                category,
                mechanism,
                context: 'Vamuss Content Library',
                example: '',
                notes: 'Adicionado via entrada em lote',
                usageCount: 0,
                isArchived: false,
                createdAt: now,
                updatedAt: now
            };

            newHooks.push(hook);
        }

        if (newHooks.length > 0) {
            const updated = [...newHooks, ...existingHooks];
            this.saveHooksLocally(uid, updated);

            try {
                const rows = newHooks.map(h => ({
                    id: h.id,
                    user_id: uid,
                    text: h.text,
                    category: h.category,
                    mechanism: h.mechanism,
                    context: h.context,
                    example: h.example,
                    notes: h.notes,
                    usage_count: 0,
                    is_archived: false,
                    created_at: h.createdAt,
                    updated_at: h.updatedAt
                }));
                await supabase.from('content_hooks').upsert(rows);
            } catch {}
        }

        return { added: newHooks.length, hooks: newHooks };
    }

    async saveHook(hookData: Partial<ContentHook>, userId?: string): Promise<ContentHook> {
        const uid = this.getUserId(userId);
        const now = new Date().toISOString();
        const id = hookData.id || `hook-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

        const hook: ContentHook = {
            id,
            userId: uid,
            text: hookData.text?.trim() || '',
            category: hookData.category?.trim() || 'Geral',
            mechanism: hookData.mechanism?.trim() || 'Curiosidade',
            context: hookData.context?.trim() || '',
            example: hookData.example?.trim() || '',
            notes: hookData.notes?.trim() || '',
            usageCount: hookData.usageCount || 0,
            isArchived: !!hookData.isArchived,
            createdAt: hookData.createdAt || now,
            updatedAt: now
        };

        // Salvar localmente primeiro
        const allHooks = await this.loadHooks(uid);
        const existingIdx = allHooks.findIndex(h => h.id === hook.id);
        if (existingIdx >= 0) {
            allHooks[existingIdx] = hook;
        } else {
            allHooks.unshift(hook);
        }
        this.saveHooksLocally(uid, allHooks);

        // Tentar gravar no Supabase
        try {
            await supabase.from('content_hooks').upsert({
                id: hook.id,
                user_id: uid,
                text: hook.text,
                category: hook.category,
                mechanism: hook.mechanism,
                context: hook.context,
                example: hook.example,
                notes: hook.notes,
                usage_count: hook.usageCount,
                is_archived: hook.isArchived,
                created_at: hook.createdAt,
                updated_at: hook.updatedAt
            });
        } catch {
            // Salvo localmente com segurança
        }

        return hook;
    }

    async deleteHook(hookId: string, userId?: string): Promise<void> {
        const uid = this.getUserId(userId);
        const allHooks = await this.loadHooks(uid);
        const filtered = allHooks.filter(h => h.id !== hookId);
        this.saveHooksLocally(uid, filtered);

        try {
            await supabase.from('content_hooks').delete().eq('id', hookId);
        } catch {
            // Localmente removido
        }
    }

    async importHooksFromCSV(csvText: string, userId?: string): Promise<{ imported: number; skippedDuplicates: number }> {
        const uid = this.getUserId(userId);
        const existingHooks = await this.loadHooks(uid);
        const existingTexts = new Set(existingHooks.map(h => h.text.toLowerCase().trim()));

        const lines = csvText.split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length === 0) return { imported: 0, skippedDuplicates: 0 };

        let imported = 0;
        let skippedDuplicates = 0;
        const newHooks: ContentHook[] = [];
        const now = new Date().toISOString();

        // Detectar se a primeira linha é cabeçalho estrutural (ex: "gancho";"categoria")
        const firstLineLower = lines[0].toLowerCase();
        const isHeader = 
            firstLineLower.startsWith('texto;') || 
            firstLineLower.startsWith('gancho;') || 
            firstLineLower.startsWith('hook;') ||
            firstLineLower.startsWith('"texto"') || 
            (firstLineLower.startsWith('"gancho"') && (firstLineLower.includes('categoria') || firstLineLower.includes('mecanismo')));
        const startIndex = isHeader ? 1 : 0;

        for (let i = startIndex; i < lines.length; i++) {
            const rawLine = lines[i];
            // Suporte para CSV delimitado por vírgula ou ponto e vírgula
            const parts = rawLine.includes(';') ? rawLine.split(';') : rawLine.split(',');
            const text = parts[0]?.replace(/^"|"$/g, '').trim();

            if (!text || text.length < 5) continue;

            const normalized = text.toLowerCase();
            if (existingTexts.has(normalized)) {
                skippedDuplicates++;
                continue;
            }

            existingTexts.add(normalized);
            const category = parts[1]?.replace(/^"|"$/g, '').trim() || 'Geral';
            const mechanism = parts[2]?.replace(/^"|"$/g, '').trim() || 'Atenção';
            const context = parts[3]?.replace(/^"|"$/g, '').trim() || '';

            const hook: ContentHook = {
                id: `hook-csv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                userId: uid,
                text,
                category,
                mechanism,
                context,
                example: '',
                notes: 'Importado via CSV',
                usageCount: 0,
                isArchived: false,
                createdAt: now,
                updatedAt: now
            };

            newHooks.push(hook);
            imported++;
        }

        if (newHooks.length > 0) {
            const updated = [...newHooks, ...existingHooks];
            this.saveHooksLocally(uid, updated);

            // Tentar gravar no Supabase
            try {
                const rows = newHooks.map(h => ({
                    id: h.id,
                    user_id: uid,
                    text: h.text,
                    category: h.category,
                    mechanism: h.mechanism,
                    context: h.context,
                    example: h.example,
                    notes: h.notes,
                    usage_count: 0,
                    is_archived: false,
                    created_at: h.createdAt,
                    updated_at: h.updatedAt
                }));
                await supabase.from('content_hooks').upsert(rows);
            } catch {
                // Preservado localmente
            }
        }

        return { imported, skippedDuplicates };
    }

    async seedDefaultHooks(uid: string): Promise<ContentHook[]> {
        const now = new Date().toISOString();
        const hooks: ContentHook[] = DEFAULT_SEED_HOOKS.map((base, idx) => ({
            ...base,
            id: `hook-seed-${idx + 1}`,
            userId: uid,
            usageCount: 0,
            isArchived: false,
            createdAt: now,
            updatedAt: now
        }));

        this.saveHooksLocally(uid, hooks);

        try {
            const rows = hooks.map(h => ({
                id: h.id,
                user_id: uid,
                text: h.text,
                category: h.category,
                mechanism: h.mechanism,
                context: h.context,
                example: h.example,
                usage_count: 0,
                is_archived: false,
                created_at: h.createdAt,
                updated_at: h.updatedAt
            }));
            await supabase.from('content_hooks').upsert(rows);
        } catch {
            // Ignorar falha de banco no seed
        }

        return hooks;
    }

    private saveHooksLocally(uid: string, hooks: ContentHook[]) {
        try {
            localStorage.setItem(`${STORAGE_HOOKS}_${uid}`, JSON.stringify(hooks));
            localStorage.setItem(STORAGE_HOOKS, JSON.stringify(hooks));
        } catch {
            // Falha silenciosa
        }
    }

    // =========================================================================
    // 2. GESTÃO DE IDEIAS PRÓPRIAS (ÁREA A)
    // =========================================================================

    async loadIdeas(userId?: string): Promise<ContentIdea[]> {
        const uid = this.getUserId(userId);
        let ideas: ContentIdea[] = [];

        try {
            const { data, error } = await supabase
                .from('content_ideas')
                .select('*')
                .order('created_at', { ascending: false });

            if (!error && data && data.length > 0) {
                ideas = data.map(row => ({
                    id: row.id,
                    userId: row.user_id,
                    rawIdea: row.raw_idea,
                    targetAudience: row.target_audience || '',
                    personalContext: row.personal_context || '',
                    goal: row.goal || '',
                    preferredFormat: row.preferred_format || 'aberto',
                    status: row.status,
                    errorMessage: row.error_message || '',
                    createdAt: row.created_at,
                    updatedAt: row.updated_at
                }));
            }
        } catch {
            // Fallback
        }

        if (ideas.length === 0) {
            try {
                const local = localStorage.getItem(`${STORAGE_IDEAS}_${uid}`) || localStorage.getItem(STORAGE_IDEAS);
                if (local) {
                    const parsed = JSON.parse(local);
                    if (Array.isArray(parsed)) ideas = parsed;
                }
            } catch {
                // Silencioso
            }
        }

        // Carregar propostas associadas a cada ideia
        const proposals = await this.loadProposals(uid);
        ideas = ideas.map(idea => ({
            ...idea,
            proposals: proposals.filter(p => p.ideaId === idea.id)
        }));

        this.saveIdeasLocally(uid, ideas);
        return ideas;
    }

    async saveIdea(ideaData: Partial<ContentIdea>, userId?: string): Promise<ContentIdea> {
        const uid = this.getUserId(userId);
        const now = new Date().toISOString();
        const id = ideaData.id || `idea-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

        const idea: ContentIdea = {
            id,
            userId: uid,
            rawIdea: ideaData.rawIdea?.trim() || '',
            targetAudience: ideaData.targetAudience?.trim() || '',
            personalContext: ideaData.personalContext?.trim() || '',
            goal: ideaData.goal?.trim() || '',
            preferredFormat: ideaData.preferredFormat || 'aberto',
            status: ideaData.status || 'pendente',
            errorMessage: ideaData.errorMessage || '',
            createdAt: ideaData.createdAt || now,
            updatedAt: now,
            proposals: ideaData.proposals || []
        };

        const all = await this.loadIdeas(uid);
        const idx = all.findIndex(i => i.id === idea.id);
        if (idx >= 0) all[idx] = idea;
        else all.unshift(idea);

        this.saveIdeasLocally(uid, all);

        try {
            await supabase.from('content_ideas').upsert({
                id: idea.id,
                user_id: uid,
                raw_idea: idea.rawIdea,
                target_audience: idea.targetAudience,
                personal_context: idea.personalContext,
                goal: idea.goal,
                preferred_format: idea.preferredFormat,
                status: idea.status,
                error_message: idea.errorMessage,
                created_at: idea.createdAt,
                updated_at: idea.updatedAt
            });
        } catch {
            // Localmente persistido
        }

        return idea;
    }

    async deleteIdea(ideaId: string, userId?: string): Promise<void> {
        const uid = this.getUserId(userId);
        const all = await this.loadIdeas(uid);
        this.saveIdeasLocally(uid, all.filter(i => i.id !== ideaId));

        try {
            await supabase.from('content_ideas').delete().eq('id', ideaId);
        } catch {
            // Silencioso
        }
    }

    private saveIdeasLocally(uid: string, ideas: ContentIdea[]) {
        try {
            localStorage.setItem(`${STORAGE_IDEAS}_${uid}`, JSON.stringify(ideas));
            localStorage.setItem(STORAGE_IDEAS, JSON.stringify(ideas));
        } catch {
            // Silencioso
        }
    }

    // =========================================================================
    // 3. GESTÃO DE REFERÊNCIAS EXTERNAS (ÁREA B)
    // =========================================================================

    async loadReferences(userId?: string): Promise<ContentReference[]> {
        const uid = this.getUserId(userId);
        let refs: ContentReference[] = [];

        try {
            const { data, error } = await supabase
                .from('content_references')
                .select('*')
                .order('created_at', { ascending: false });

            if (!error && data && data.length > 0) {
                refs = data.map(row => ({
                    id: row.id,
                    userId: row.user_id,
                    url: row.url || '',
                    platform: row.platform || 'instagram',
                    notes: row.notes || '',
                    videoFileUrl: row.video_file_url || '',
                    mediaUrls: row.media_urls || [],
                    transcript: row.transcript || '',
                    hasAccessibleMedia: !!row.has_accessible_media,
                    status: row.status,
                    errorMessage: row.error_message || '',
                    analysis: row.analysis || undefined,
                    createdAt: row.created_at,
                    updatedAt: row.updated_at
                }));
            }
        } catch {
            // Fallback
        }

        if (refs.length === 0) {
            try {
                const local = localStorage.getItem(`${STORAGE_REFS}_${uid}`) || localStorage.getItem(STORAGE_REFS);
                if (local) {
                    const parsed = JSON.parse(local);
                    if (Array.isArray(parsed)) refs = parsed;
                }
            } catch {
                // Silencioso
            }
        }

        const proposals = await this.loadProposals(uid);
        refs = refs.map(ref => ({
            ...ref,
            proposals: proposals.filter(p => p.referenceId === ref.id)
        }));

        this.saveReferencesLocally(uid, refs);
        return refs;
    }

    async saveReference(refData: Partial<ContentReference>, userId?: string): Promise<ContentReference> {
        const uid = this.getUserId(userId);
        const now = new Date().toISOString();
        const id = refData.id || `ref-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

        const ref: ContentReference = {
            id,
            userId: uid,
            url: refData.url?.trim() || '',
            platform: refData.platform || 'instagram',
            notes: refData.notes?.trim() || '',
            videoFileUrl: refData.videoFileUrl || '',
            fileName: refData.fileName || '',
            fileSize: refData.fileSize || 0,
            fileFormat: refData.fileFormat || '',
            mediaUrls: refData.mediaUrls || [],
            transcript: refData.transcript?.trim() || '',
            hasAccessibleMedia: refData.hasAccessibleMedia !== undefined 
                ? refData.hasAccessibleMedia 
                : Boolean(refData.videoFileUrl || (refData.mediaUrls && refData.mediaUrls.length > 0) || refData.transcript),
            status: refData.status || 'pendente',
            errorMessage: refData.errorMessage || '',
            analysis: refData.analysis,
            createdAt: refData.createdAt || now,
            updatedAt: now,
            proposals: refData.proposals || []
        };

        const all = await this.loadReferences(uid);
        const idx = all.findIndex(r => r.id === ref.id);
        if (idx >= 0) all[idx] = ref;
        else all.unshift(ref);

        this.saveReferencesLocally(uid, all);

        try {
            await supabase.from('content_references').upsert({
                id: ref.id,
                user_id: uid,
                url: ref.url,
                platform: ref.platform,
                notes: ref.notes,
                video_file_url: ref.videoFileUrl,
                media_urls: ref.mediaUrls,
                transcript: ref.transcript,
                has_accessible_media: ref.hasAccessibleMedia,
                status: ref.status,
                error_message: ref.errorMessage,
                analysis: ref.analysis,
                created_at: ref.createdAt,
                updated_at: ref.updatedAt
            });
        } catch {
            // Gravado localmente com segurança
        }

        return ref;
    }

    /**
     * Faz upload de arquivo de vídeo real por streaming HTTP direto para o backend
     */
    async uploadVideoFile(file: File): Promise<{ videoFileUrl: string; fileName: string; fileSize: number; fileFormat: string }> {
        const encodedName = encodeURIComponent(file.name);
        const resp = await fetch(`/api/content-intelligence/upload-video?filename=${encodedName}`, {
            method: 'POST',
            headers: {
                'Content-Type': file.type || 'video/mp4'
            },
            body: file
        });

        if (!resp.ok) {
            const err = await resp.text();
            throw new Error(`Falha no upload do vídeo: ${err}`);
        }

        const data = await resp.json();
        return data;
    }

    async deleteReference(refId: string, userId?: string): Promise<void> {
        const uid = this.getUserId(userId);
        const all = await this.loadReferences(uid);
        this.saveReferencesLocally(uid, all.filter(r => r.id !== refId));

        try {
            await supabase.from('content_references').delete().eq('id', refId);
        } catch {
            // Silencioso
        }
    }

    private saveReferencesLocally(uid: string, refs: ContentReference[]) {
        try {
            localStorage.setItem(`${STORAGE_REFS}_${uid}`, JSON.stringify(refs));
            localStorage.setItem(STORAGE_REFS, JSON.stringify(refs));
        } catch {
            // Silencioso
        }
    }

    // =========================================================================
    // 4. GESTÃO DE PROPOSTAS EDITORIAIS E GRELHA OFICIAL DE 4 COLUNAS
    // =========================================================================

    async loadProposals(userId?: string): Promise<ContentProposal[]> {
        const uid = this.getUserId(userId);
        let proposals: ContentProposal[] = [];

        try {
            const { data, error } = await supabase
                .from('content_proposals')
                .select('*')
                .order('created_at', { ascending: false });

            if (!error && data && data.length > 0) {
                proposals = data.map(row => ({
                    id: row.id,
                    userId: row.user_id,
                    ideaId: row.idea_id || undefined,
                    referenceId: row.reference_id || undefined,
                    cardId: row.card_id || undefined,
                    angulo: row.angulo,
                    ideiaMelhorada: row.ideia_melhorada,
                    ganchoBase: row.gancho_base,
                    retencaoHook: row.retencao_hook,
                    titulo: row.titulo,
                    formato: row.formato,
                    objetivo: row.objetivo || '',
                    publicoAlvo: row.publico_alvo || '',
                    ganchoVerbal: row.gancho_verbal || '',
                    ganchoVisual: row.gancho_visual || '',
                    roteiroSlides: row.roteiro_slides || '',
                    sugestoesCenas: row.sugestoes_cenas || '',
                    sugestoesEnquadramento: row.sugestoes_enquadramento || '',
                    sugestoesEdicao: row.sugestoes_edicao || '',
                    textoTela: row.texto_tela || '',
                    cta: row.cta || '',
                    justificativaEstrategica: row.justificativa_estrategica || '',
                    limitacoesHipoteses: row.limitacoes_hipoteses || '',
                    ganchosUtilizados: row.ganchos_utilizados || [],
                    statusAprovacao: row.status_aprovacao || 'rascunho',
                    createdAt: row.created_at,
                    updatedAt: row.updated_at
                }));
            }
        } catch {
            // Fallback
        }

        if (proposals.length === 0) {
            try {
                const local = localStorage.getItem(`${STORAGE_PROPOSALS}_${uid}`) || localStorage.getItem(STORAGE_PROPOSALS);
                if (local) {
                    const parsed = JSON.parse(local);
                    if (Array.isArray(parsed)) proposals = parsed;
                }
            } catch {
                // Silencioso
            }
        }

        this.saveProposalsLocally(uid, proposals);
        return proposals;
    }

    async saveProposal(propData: Partial<ContentProposal>, userId?: string): Promise<ContentProposal> {
        const uid = this.getUserId(userId);
        const now = new Date().toISOString();
        const id = propData.id || `prop-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

        const proposal: ContentProposal = {
            id,
            userId: uid,
            ideaId: propData.ideaId,
            referenceId: propData.referenceId,
            cardId: propData.cardId,
            angulo: propData.angulo || 'Ângulo Estratégico',
            ideiaMelhorada: propData.ideiaMelhorada || '',
            ganchoBase: propData.ganchoBase || '',
            retencaoHook: propData.retencaoHook || '',
            titulo: propData.titulo || 'Novo Conteúdo',
            formato: propData.formato || 'Reel',
            objetivo: propData.objetivo || '',
            publicoAlvo: propData.publicoAlvo || '',
            ganchoVerbal: propData.ganchoVerbal || '',
            ganchoVisual: propData.ganchoVisual || '',
            roteiroSlides: propData.roteiroSlides || '',
            sugestoesCenas: propData.sugestoesCenas || '',
            sugestoesEnquadramento: propData.sugestoesEnquadramento || '',
            sugestoesEdicao: propData.sugestoesEdicao || '',
            textoTela: propData.textoTela || '',
            cta: propData.cta || '',
            justificativaEstrategica: propData.justificativaEstrategica || '',
            limitacoesHipoteses: propData.limitacoesHipoteses || '',
            ganchosUtilizados: propData.ganchosUtilizados || [],
            statusAprovacao: propData.statusAprovacao || 'rascunho',
            createdAt: propData.createdAt || now,
            updatedAt: now
        };

        const all = await this.loadProposals(uid);
        const idx = all.findIndex(p => p.id === proposal.id);
        if (idx >= 0) all[idx] = proposal;
        else all.unshift(proposal);

        this.saveProposalsLocally(uid, all);

        try {
            await supabase.from('content_proposals').upsert({
                id: proposal.id,
                user_id: uid,
                idea_id: proposal.ideaId || null,
                reference_id: proposal.referenceId || null,
                card_id: proposal.cardId || null,
                angulo: proposal.angulo,
                ideia_melhorada: proposal.ideiaMelhorada,
                gancho_base: proposal.ganchoBase,
                retencao_hook: proposal.retencaoHook,
                titulo: proposal.titulo,
                formato: proposal.formato,
                objetivo: proposal.objetivo,
                publico_alvo: proposal.publicoAlvo,
                gancho_verbal: proposal.ganchoVerbal,
                gancho_visual: proposal.ganchoVisual,
                roteiro_slides: proposal.roteiroSlides,
                sugestoes_cenas: proposal.sugestoesCenas,
                sugestoes_enquadramento: proposal.sugestoesEnquadramento,
                sugestoes_edicao: proposal.sugestoesEdicao,
                texto_tela: proposal.textoTela,
                cta: proposal.cta,
                justificativa_estrategica: proposal.justificativaEstrategica,
                limitacoes_hipoteses: proposal.limitacoesHipoteses,
                ganchos_utilizados: proposal.ganchosUtilizados,
                status_aprovacao: proposal.statusAprovacao,
                created_at: proposal.createdAt,
                updated_at: proposal.updatedAt
            });
        } catch {
            // Localmente seguro
        }

        return proposal;
    }

    async updateProposalStatus(
        proposalId: string, 
        status: ProposalApprovalStatus, 
        userId?: string
    ): Promise<ContentProposal | null> {
        const uid = this.getUserId(userId);
        const all = await this.loadProposals(uid);
        const target = all.find(p => p.id === proposalId);
        if (!target) return null;

        target.statusAprovacao = status;
        target.updatedAt = new Date().toISOString();

        return this.saveProposal(target, uid);
    }

    // =========================================================================
    // 5. INTEGRAÇÃO IDEMPOTENTE COM O KANBAN EXISTENTE (ÁREA D)
    // =========================================================================

    async sendProposalToKanban(
        proposalId: string, 
        userId?: string
    ): Promise<{ success: boolean; cardId: string; alreadyExisted: boolean }> {
        const uid = this.getUserId(userId);
        const allProposals = await this.loadProposals(uid);
        const proposal = allProposals.find(p => p.id === proposalId);

        if (!proposal) {
            throw new Error('Proposta não encontrada');
        }

        // 1. Idempotência: verificar se a proposta já possui um cartão criado
        if (proposal.cardId) {
            const currentKanban = await contentKanbanService.loadData(uid);
            const existingCard = currentKanban.cards.find(c => c.id === proposal.cardId);
            if (existingCard) {
                return {
                    success: true,
                    cardId: proposal.cardId,
                    alreadyExisted: true
                };
            }
        }

        // 2. Carregar colunas do Kanban atual
        const currentKanban = await contentKanbanService.loadData(uid);
        if (currentKanban.columns.length === 0) {
            throw new Error('Nenhuma coluna disponível no Kanban de Conteúdo.');
        }

        // Coluna de destino: "Ideias" ou a primeira coluna ativa
        const targetCol = currentKanban.columns.find(c => 
            c.name.toLowerCase().includes('ideia') || c.name.toLowerCase().includes('início')
        ) || currentKanban.columns[0];

        // Montar descrição estruturada e limpa para o cartão
        const cardDescriptionParts = [
            `🎯 [${proposal.formato}] ${proposal.ideiaMelhorada}`,
            proposal.ganchoBase ? `\n🪝 Gancho: "${proposal.ganchoBase}"` : '',
            proposal.cta ? `\n📢 CTA: ${proposal.cta}` : '',
            proposal.roteiroSlides ? `\n\n📝 Roteiro / Desenvolvimento:\n${proposal.roteiroSlides}` : ''
        ].filter(Boolean).join('');

        // 3. Criar cartão através do contentKanbanService já homologado
        const targetCardsCount = currentKanban.cards.filter(c => c.columnId === targetCol.id).length;
        const newCard = await contentKanbanService.createCard(
            uid,
            {
                columnId: targetCol.id,
                title: proposal.titulo || proposal.ganchoBase || 'Novo Conteúdo',
                description: cardDescriptionParts,
                orderIndex: targetCardsCount
            },
            currentKanban.columns,
            currentKanban.cards
        );

        // 4. Vincular o ID do cartão de volta à proposta e marcar como aprovada
        proposal.cardId = newCard.id;
        proposal.statusAprovacao = 'aprovado_desenvolver';
        await this.saveProposal(proposal, uid);

        return {
            success: true,
            cardId: newCard.id,
            alreadyExisted: false
        };
    }

    private saveProposalsLocally(uid: string, proposals: ContentProposal[]) {
        try {
            localStorage.setItem(`${STORAGE_PROPOSALS}_${uid}`, JSON.stringify(proposals));
            localStorage.setItem(STORAGE_PROPOSALS, JSON.stringify(proposals));
        } catch {
            // Silencioso
        }
    }

    // =========================================================================
    // 5. SISTEMA MELHORADOR DE IDEIAS (3 ETAPAS FUNCIONAIS)
    // =========================================================================

    /**
     * Etapa 1 — Melhorar a Ideia (Gerar Ângulos e Ganchos na Grelha Oficial das 4 Colunas)
     */
    async improveIdea(params: {
        idea: string;
        targetAudience?: string;
        goal?: string;
        context?: string;
        existingAngles?: string[];
        userId?: string;
    }): Promise<{ analiseEstrategica?: any; grid: GridApproach[] }> {
        const uid = this.getUserId(params.userId);
        const hooks = await this.loadHooks(uid);

        const res = await fetch('/api/content-intelligence/improve-idea', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                idea: params.idea,
                targetAudience: params.targetAudience,
                goal: params.goal,
                context: params.context,
                hookLibrary: hooks.map(h => ({
                    text: h.text,
                    category: h.category,
                    mechanism: h.mechanism
                })),
                existingAngles: params.existingAngles || []
            })
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || `Erro ao melhorar ideia (${res.status})`);
        }

        const data = await res.json();
        const rawGrid = data.data?.grid || [];

        const grid: GridApproach[] = rawGrid.map((item: any, idx: number) => ({
            id: item.id || `ang-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
            angulo: item.angulo || 'Contradição',
            ideiaMelhorada: item.ideia_melhorada || item.ideiaMelhorada || params.idea,
            ganchoBase: item.gancho_base || item.ganchoBase || '',
            retencaoHook: item.retencao_hook || item.retencaoHook || '',
            fonteGancho: item.fonte_gancho || item.fonteGancho || 'Original Estratégico',
            isSelected: false,
            isEdited: false
        }));

        return {
            analiseEstrategica: data.data?.analise_estrategica,
            grid
        };
    }

    /**
     * Etapa 2 — Explorar Formatos para a abordagem selecionada
     */
    async exploreFormats(params: {
        idea: string;
        selectedApproach: GridApproach;
        targetAudience?: string;
        goal?: string;
        context?: string;
        existingFormats?: string[];
        userId?: string;
    }): Promise<FormatOption[]> {
        const res = await fetch('/api/content-intelligence/explore-formats', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                idea: params.idea,
                selectedApproach: {
                    angulo: params.selectedApproach.angulo,
                    ideia_melhorada: params.selectedApproach.ideiaMelhorada,
                    gancho_base: params.selectedApproach.ganchoBase,
                    retencao_hook: params.selectedApproach.retencaoHook
                },
                targetAudience: params.targetAudience,
                goal: params.goal,
                context: params.context,
                existingFormats: params.existingFormats || []
            })
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || `Erro ao explorar formatos (${res.status})`);
        }

        const data = await res.json();
        const rawFormats = data.data?.formats || [];

        return rawFormats.map((f: any, idx: number) => ({
            id: f.id || `fmt-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
            nome: f.nome || 'Talking head',
            conceito: f.conceito || '',
            porQueFunciona: f.por_que_funciona || f.porQueFunciona || '',
            ganchoVerbal: f.gancho_verbal || f.ganchoVerbal || '',
            ganchoVisual: f.gancho_visual || f.ganchoVisual || '',
            recursosDificuldade: f.recursos_dificuldade || f.recursosDificuldade || 'Baixa',
            isRecomendado: Boolean(f.is_recomendado || f.isRecomendado),
            motivoRecomendacao: f.motivo_recomendacao || f.motivoRecomendacao || '',
            isSelected: false
        }));
    }

    /**
     * Etapa 3 — Desenvolver Proposta Completa (Guião e Estrutura)
     */
    async developProposal(params: {
        idea: string;
        selectedApproach: GridApproach;
        selectedFormat: FormatOption;
        targetAudience?: string;
        goal?: string;
        context?: string;
        userId?: string;
    }): Promise<DevelopedProposal> {
        const res = await fetch('/api/content-intelligence/develop-proposal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                idea: params.idea,
                selectedApproach: {
                    angulo: params.selectedApproach.angulo,
                    ideia_melhorada: params.selectedApproach.ideiaMelhorada,
                    gancho_base: params.selectedApproach.ganchoBase,
                    retencao_hook: params.selectedApproach.retencaoHook
                },
                selectedFormat: {
                    nome: params.selectedFormat.nome,
                    conceito: params.selectedFormat.conceito,
                    gancho_verbal: params.selectedFormat.ganchoVerbal,
                    gancho_visual: params.selectedFormat.ganchoVisual,
                    recursos_dificuldade: params.selectedFormat.recursosDificuldade
                },
                targetAudience: params.targetAudience,
                goal: params.goal,
                context: params.context
            })
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || `Erro ao desenvolver proposta (${res.status})`);
        }

        const data = await res.json();
        const p = data.data?.proposal || {};

        return {
            titulo: p.titulo || `${params.selectedApproach.angulo}: ${params.selectedApproach.ideiaMelhorada.slice(0, 40)}`,
            formato: p.formato || params.selectedFormat.nome,
            conceitoEObjetivo: p.conceito_objetivo || p.conceitoEObjetivo || '',
            publicoEMensagemCentral: p.publico_mensagem || p.publicoEMensagemCentral || '',
            ganchoVerbal: p.gancho_verbal || p.ganchoVerbal || params.selectedApproach.ganchoBase,
            ganchoVisual: p.gancho_visual || p.ganchoVisual || params.selectedApproach.retencaoHook,
            estruturaNarrativa: p.estrutura_narrativa || p.estruturaNarrativa || '',
            sequenciaCenas: p.sequencia_cenas || p.sequenciaCenas || '',
            enquadramentosEAcoes: p.enquadramentos_acoes || p.enquadramentosEAcoes || '',
            textoFaladoOuTela: p.texto_falado_tela || p.textoFaladoOuTela || '',
            mecanismosRetencao: p.mecanismos_retencao || p.mecanismosRetencao || '',
            sugestoesEdicao: p.sugestoes_edicao || p.sugestoesEdicao || '',
            cta: p.cta || ''
        };
    }

    /**
     * Gestão de Sessões Persistidas do Melhorador de Ideias
     */
    async loadImprovedSessions(userId?: string): Promise<ImprovedIdeaSession[]> {
        const uid = this.getUserId(userId);

        // 1. Tentar ler do Supabase se tabela existir
        try {
            const { data, error } = await supabase
                .from('content_improved_ideas')
                .select('*')
                .order('updated_at', { ascending: false });

            if (!error && data && data.length > 0) {
                const sessions: ImprovedIdeaSession[] = data.map(row => ({
                    id: row.id,
                    userId: row.user_id,
                    currentStep: (row.current_step || 1) as 1 | 2 | 3,
                    rawIdea: row.raw_idea || '',
                    targetAudience: row.target_audience || '',
                    goal: row.goal || '',
                    context: row.context || '',
                    gridProposals: row.grid_proposals || [],
                    selectedApproachId: row.selected_approach_id,
                    formatProposals: row.format_proposals || [],
                    selectedFormatId: row.selected_format_id,
                    developedProposal: row.developed_proposal,
                    status: row.status || 'rascunho',
                    createdAt: row.created_at,
                    updatedAt: row.updated_at
                }));
                this.saveImprovedSessionsLocally(uid, sessions);
                return sessions;
            }
        } catch {
            // Continua para localStorage
        }

        // 2. Fallback resiliente no localStorage
        try {
            const raw = localStorage.getItem(`${STORAGE_IMPROVED_SESSIONS}_${uid}`) ||
                localStorage.getItem(STORAGE_IMPROVED_SESSIONS);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) return parsed;
            }
        } catch {}

        return [];
    }

    async saveImprovedSession(session: ImprovedIdeaSession, userId?: string): Promise<void> {
        const uid = this.getUserId(userId);
        const sessions = await this.loadImprovedSessions(uid);
        const idx = sessions.findIndex(s => s.id === session.id);

        session.updatedAt = new Date().toISOString();
        if (idx >= 0) {
            sessions[idx] = session;
        } else {
            sessions.unshift(session);
        }

        this.saveImprovedSessionsLocally(uid, sessions);

        // Tentar salvar no Supabase
        try {
            await supabase.from('content_improved_ideas').upsert({
                id: session.id,
                user_id: uid,
                current_step: session.currentStep,
                raw_idea: session.rawIdea,
                target_audience: session.targetAudience,
                goal: session.goal,
                context: session.context,
                grid_proposals: session.gridProposals,
                selected_approach_id: session.selectedApproachId,
                format_proposals: session.formatProposals,
                selected_format_id: session.selectedFormatId,
                developed_proposal: session.developedProposal,
                status: session.status,
                updated_at: session.updatedAt
            });
        } catch {}
    }

    async deleteImprovedSession(sessionId: string, userId?: string): Promise<void> {
        const uid = this.getUserId(userId);
        const sessions = await this.loadImprovedSessions(uid);
        const filtered = sessions.filter(s => s.id !== sessionId);
        this.saveImprovedSessionsLocally(uid, filtered);

        try {
            await supabase.from('content_improved_ideas').delete().eq('id', sessionId);
        } catch {}
    }

    private saveImprovedSessionsLocally(uid: string, sessions: ImprovedIdeaSession[]) {
        try {
            localStorage.setItem(`${STORAGE_IMPROVED_SESSIONS}_${uid}`, JSON.stringify(sessions));
            localStorage.setItem(STORAGE_IMPROVED_SESSIONS, JSON.stringify(sessions));
        } catch {}
    }

    /**
     * Enviar Proposta Desenvolvida ou Abordagem da Grelha para o Kanban de Produção
     */
    async sendImprovedProposalToKanban(params: {
        proposal: {
            titulo: string;
            formato: string;
            angulo?: string;
            ganchoVerbal?: string;
            ganchoVisual?: string;
            roteiro?: string;
            cta?: string;
            publicoAlvo?: string;
            objetivo?: string;
        };
        userId?: string;
        targetColumnId?: string;
    }): Promise<{ success: boolean; cardId: string }> {
        const uid = this.getUserId(params.userId);
        const currentKanban = await contentKanbanService.loadData(uid);

        let targetCol = currentKanban.columns.find((c: any) => c.id === params.targetColumnId);
        if (!targetCol) {
            targetCol = currentKanban.columns.find((c: any) =>
                (c.name || '').toLowerCase().includes('ideia') || (c.name || '').toLowerCase().includes('início')
            ) || currentKanban.columns[0];
        }

        if (!targetCol) {
            throw new Error('Nenhuma coluna do Kanban disponível.');
        }

        const targetCardsCount = currentKanban.cards.filter((c: any) => c.columnId === targetCol.id).length;

        const description = [
            `**Formato**: ${params.proposal.formato}`,
            params.proposal.angulo ? `**Ângulo**: ${params.proposal.angulo}` : null,
            params.proposal.publicoAlvo ? `**Público**: ${params.proposal.publicoAlvo}` : null,
            params.proposal.objetivo ? `**Objetivo**: ${params.proposal.objetivo}` : null,
            params.proposal.ganchoVerbal ? `\n### Gancho Verbal (0-3s)\n"${params.proposal.ganchoVerbal}"` : null,
            params.proposal.ganchoVisual ? `\n### Gancho Visual / Cena Inicial\n${params.proposal.ganchoVisual}` : null,
            params.proposal.roteiro ? `\n### Roteiro e Cenas\n${params.proposal.roteiro}` : null,
            params.proposal.cta ? `\n### Chamada para Ação (CTA)\n${params.proposal.cta}` : null
        ].filter(Boolean).join('\n');

        const newCard = await contentKanbanService.createCard(
            uid,
            {
                columnId: targetCol.id,
                title: params.proposal.titulo || 'Novo Conteúdo da Ideia Melhorada',
                description,
                orderIndex: targetCardsCount
            },
            currentKanban.columns,
            currentKanban.cards
        );

        return { success: true, cardId: newCard.id };
    }
}

export const contentIntelligenceService = new ContentIntelligenceService();
