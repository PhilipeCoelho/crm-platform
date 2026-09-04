/**
 * Meta Lead Ads Service
 * Camada de serviço frontend para comunicação com a API de integração Meta Lead Ads.
 */

const API_BASE = '/api/meta';

async function getAuthHeaders(): Promise<Record<string, string>> {
    const { supabase } = await import('@/lib/supabase');
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    return {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
}

async function apiRequest<T>(url: string, options: RequestInit = {}): Promise<T> {
    const headers = await getAuthHeaders();
    const res = await fetch(url, {
        ...options,
        headers: { ...headers, ...(options.headers || {}) }
    });
    if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${res.status}: ${res.statusText}`);
    }
    return res.json();
}

// ===== OAuth =====

export async function getMetaAuthUrl(redirectUri?: string): Promise<{ url: string }> {
    const rUri = redirectUri || (typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : '');
    return apiRequest(`${API_BASE}/auth-url?redirect_uri=${encodeURIComponent(rUri)}`);
}

export async function handleMetaCallback(code: string, redirectUri?: string): Promise<{ success: boolean; userName: string }> {
    const rUri = redirectUri || (typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : '');
    return apiRequest(`${API_BASE}/callback`, {
        method: 'POST',
        body: JSON.stringify({ code, redirectUri: rUri })
    });
}

export async function getMetaStatus(): Promise<{
    connected: boolean;
    userName: string | null;
    status: string | null;
    expiresAt: string | null;
}> {
    return apiRequest(`${API_BASE}/status`);
}

export async function disconnectMeta(): Promise<{ success: boolean }> {
    return apiRequest(`${API_BASE}/disconnect`, { method: 'DELETE' });
}

// ===== Pages =====

export interface MetaPage {
    id: string;
    pageId: string;
    pageName: string;
    isSubscribed: boolean;
}

export async function getMetaPages(): Promise<{ pages: MetaPage[] }> {
    return apiRequest(`${API_BASE}/pages`);
}

export async function subscribePage(pageId: string): Promise<{ success: boolean }> {
    return apiRequest(`${API_BASE}/pages/${pageId}/subscribe`, { method: 'POST' });
}

export async function unsubscribePage(pageId: string): Promise<{ success: boolean }> {
    return apiRequest(`${API_BASE}/pages/${pageId}/subscribe`, { method: 'DELETE' });
}

// ===== Forms =====

export interface MetaForm {
    id: string;
    formId: string;
    formName: string;
    pageId: string;
    syncEnabled: boolean;
    leadsCount: number;
    lastLeadAt: string | null;
}

export async function getPageForms(pageId: string): Promise<{ forms: MetaForm[] }> {
    return apiRequest(`${API_BASE}/pages/${pageId}/forms`);
}

export async function toggleFormSync(formId: string, enabled: boolean): Promise<{ success: boolean }> {
    return apiRequest(`${API_BASE}/forms/${formId}/toggle`, {
        method: 'PATCH',
        body: JSON.stringify({ sync_enabled: enabled })
    });
}

// ===== Settings =====

export interface MetaLeadAdsSettings {
    defaultPipelineId: string;
    defaultStageId: string;
    autoCreateContact: boolean;
    autoCreateCompany: boolean;
    autoCreateDeal: boolean;
    autoRegisterHistory: boolean;
    autoCreateActivity: boolean;
    autoStartCadence: boolean;
    capiEnabled?: boolean;
    capiPixelId?: string;
    capiAccessToken?: string;
}

export async function getMetaSettings(): Promise<MetaLeadAdsSettings> {
    return apiRequest(`${API_BASE}/settings`);
}

export async function saveMetaSettings(settings: Partial<MetaLeadAdsSettings>): Promise<{ success: boolean }> {
    return apiRequest(`${API_BASE}/settings`, {
        method: 'PUT',
        body: JSON.stringify(settings)
    });
}

// ===== Logs =====

export interface MetaIntegrationLog {
    id: string;
    eventType: string;
    status: string;
    message: string;
    payload: Record<string, unknown> | null;
    pageId: string | null;
    createdAt: string;
}

export async function getMetaLogs(params?: {
    eventType?: string;
    limit?: number;
    offset?: number;
}): Promise<{ logs: MetaIntegrationLog[]; total: number }> {
    const searchParams = new URLSearchParams();
    if (params?.eventType) searchParams.set('event_type', params.eventType);
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.offset) searchParams.set('offset', String(params.offset));
    const qs = searchParams.toString();
    return apiRequest(`${API_BASE}/logs${qs ? `?${qs}` : ''}`);
}

// ===== Test Integration =====

export interface TestResult {
    success: boolean;
    steps: {
        name: string;
        status: 'success' | 'error' | 'skipped';
        message: string;
        details?: string;
    }[];
    processingResult?: {
        contactId: string | null;
        contactCreated: boolean;
        companyId: string | null;
        companyCreated: boolean;
        dealId: string | null;
        dealCreated: boolean;
        isDuplicate: boolean;
        historyRegistered: boolean;
        activityCreated: boolean;
        cadenceStarted: boolean;
        processingTimeMs: number;
        pipelineId: string;
        stageId: string;
        source: string;
    };
    totalTimeMs: number;
}

export async function testMetaIntegration(testEventCode?: string): Promise<TestResult> {
    return apiRequest(`${API_BASE}/test`, { 
        method: 'POST',
        body: JSON.stringify({ testEventCode })
    });
}

export async function sendCapiEvent(dealId: string, stageId?: string, status?: string): Promise<{ success: boolean }> {
    return apiRequest(`${API_BASE}/capi-event`, {
        method: 'POST',
        body: JSON.stringify({ dealId, stageId, status })
    });
}
