import { randomUUID } from 'node:crypto';
import { sendMetaCAPIEvent } from './capiSender.js';

/**
 * LeadProcessor - Camada de processamento de leads agnóstica à origem.
 * Reutilizável para Meta Lead Ads, Google Ads, TikTok, LinkedIn, Landing Pages.
 * 
 * Utiliza exclusivamente os serviços existentes do CRM (contacts, deals, activities, deal_logs).
 * Não cria fluxos paralelos nem duplica lógica.
 */
export class LeadProcessor {
    constructor(supabase, userId) {
        this.supabase = supabase;
        this.userId = userId;
        this.settings = null;
        this.startTime = null;
    }

    /**
     * Carrega as configurações do usuário de meta_lead_ads_settings.
     * Se não existir, retorna defaults.
     */
    async loadSettings() {
        const { data } = await this.supabase
            .from('meta_lead_ads_settings')
            .select('*')
            .eq('user_id', this.userId)
            .single();
        
        this.settings = data || {
            default_pipeline_id: 'sales',
            default_stage_id: 'new',
            auto_create_contact: true,
            auto_create_company: true,
            auto_create_deal: true,
            auto_register_history: true,
            auto_create_activity: true,
            auto_start_cadence: true
        };
        return this.settings;
    }

    /**
     * Processa um lead normalizado de qualquer origem.
     * @param {Object} leadData - Dados normalizados do lead
     * @returns {Object} ProcessingResult
     */
    async processLead(leadData) {
        this.startTime = Date.now();
        const result = {
            success: false,
            contactId: null,
            contactCreated: false,
            companyId: null,
            companyCreated: false,
            dealId: null,
            dealCreated: false,
            isDuplicate: false,
            hasActiveDeal: false,
            historyRegistered: false,
            activityCreated: false,
            cadenceStarted: false,
            processingTimeMs: 0,
            pipelineId: null,
            stageId: null,
            source: leadData.source || 'Unknown',
            error: null
        };

        try {
            // 1. Load settings
            await this.loadSettings();
            result.pipelineId = this.settings.default_pipeline_id;
            result.stageId = this.settings.default_stage_id;

            // 2. Check idempotency
            if (leadData.leadgenId) {
                const alreadyProcessed = await this.checkIdempotency(leadData.leadgenId);
                if (alreadyProcessed) {
                    result.isDuplicate = true;
                    result.processingTimeMs = Date.now() - this.startTime;
                    await this.logIntegration('lead_received', 'warning', 
                        `Lead ${leadData.leadgenId} já foi processado anteriormente. Ignorando.`,
                        { leadgenId: leadData.leadgenId }, leadData.pageId);
                    return result;
                }
            }

            // 3. Find existing contact by email
            let contact = null;
            if (leadData.email) {
                contact = await this.findContactByEmail(leadData.email);
            }

            // 4. If not found, find by phone
            if (!contact && leadData.phone) {
                contact = await this.findContactByPhone(leadData.phone);
            }

            // 5. Determine if duplicate contact
            result.isDuplicate = !!contact;

            // 6. Create or update contact
            if (!contact && this.settings.auto_create_contact) {
                // 6a. Create company first if available
                let companyId = null;
                const shouldCreateCompany = leadData.createCompany !== undefined 
                    ? Boolean(leadData.createCompany) 
                    : this.settings.auto_create_company;

                if (leadData.companyName && shouldCreateCompany) {
                    const company = await this.createCompany({ name: leadData.companyName });
                    companyId = company.id;
                    result.companyId = companyId;
                    result.companyCreated = !company._existed; // Flag if it was newly created
                }

                // Build clean notes with tracking info and message
                const notesParts = [
                    `📥 Lead recebido via ${leadData.source || 'Landing Page'} (${new Date().toLocaleString('pt-PT')})`,
                    leadData.formName ? `Formulário: ${leadData.formName}` : null,
                    leadData.companyName ? `Clínica / Empresa: ${leadData.companyName}` : null,
                    leadData.message ? `Mensagem: ${leadData.message}` : null,
                    (leadData.utmSource || leadData.utmCampaign || leadData.utmMedium) 
                        ? `UTMs: source=${leadData.utmSource || '-'} | medium=${leadData.utmMedium || '-'} | campaign=${leadData.utmCampaign || '-'}${leadData.utmContent ? ` | content=${leadData.utmContent}` : ''}${leadData.utmTerm ? ` | term=${leadData.utmTerm}` : ''}`
                        : null
                ].filter(Boolean);

                // 6b. Create contact
                contact = await this.createContact({
                    name: leadData.name || 'Lead sem nome',
                    email: leadData.email,
                    phone: leadData.phone,
                    companyId: companyId,
                    notes: notesParts.join('\n')
                });
                result.contactCreated = true;
            } else if (contact) {
                // Update contact if missing fields
                const updates = {};
                if (!contact.phone && leadData.phone) updates.phone = leadData.phone;
                if (!contact.email && leadData.email) updates.email = leadData.email;
                if ((!contact.name || contact.name === 'Lead sem nome') && leadData.name) updates.name = leadData.name;
                
                // Append lead conversion event to notes
                const conversionNote = `\n---\n📥 Nova conversão via ${leadData.source || 'Landing Page'} (${new Date().toLocaleString('pt-PT')}):${leadData.message ? `\n"${leadData.message}"` : ''}${leadData.formName ? ` (Formulário: ${leadData.formName})` : ''}`;
                updates.notes = contact.notes ? `${contact.notes}${conversionNote}` : conversionNote.trim();

                if (Object.keys(updates).length > 0) {
                    await this.supabase.from('contacts').update(updates).eq('id', contact.id);
                }

                // Handle company
                const shouldCreateCompany = leadData.createCompany !== undefined 
                    ? Boolean(leadData.createCompany) 
                    : this.settings.auto_create_company;

                if (leadData.companyName && !contact.company_id && shouldCreateCompany) {
                    const company = await this.createCompany({ name: leadData.companyName });
                    result.companyId = company.id;
                    result.companyCreated = !company._existed;
                    await this.supabase.from('contacts').update({ company_id: company.id }).eq('id', contact.id);
                } else if (contact.company_id) {
                    result.companyId = contact.company_id;
                }
            }

            result.contactId = contact?.id || null;

            // 7. Find active deal
            let deal = null;
            if (result.contactId) {
                deal = await this.findActiveDeal(result.contactId);
            }

            const shouldCreateDeal = leadData.createDeal !== undefined 
                ? Boolean(leadData.createDeal) 
                : this.settings.auto_create_deal;

            if (deal) {
                result.hasActiveDeal = true;
                result.dealId = deal.id;
                result.dealCreated = false;

                // 8. Register history on existing deal
                if (this.settings.auto_register_history) {
                    await this.registerDealLog(deal.id, leadData);
                    result.historyRegistered = true;
                }
            } else if (shouldCreateDeal && result.contactId) {
                // 9. Create new deal
                const targetPipelineId = leadData.pipelineId || this.settings.default_pipeline_id;
                const targetStageId = leadData.stageId || this.settings.default_stage_id;
                const dealTitle = leadData.name ? `${leadData.name} - ${leadData.source}` : `Lead - ${leadData.source}`;
                const newDeal = await this.createDeal({
                    title: dealTitle,
                    contactId: result.contactId,
                    companyId: result.companyId,
                    source: leadData.source,
                    pipelineId: targetPipelineId,
                    stageId: targetStageId,
                    utms: {
                        utm_source: leadData.utmSource,
                        utm_medium: leadData.utmMedium,
                        utm_campaign: leadData.utmCampaign,
                        utm_content: leadData.utmContent,
                        utm_term: leadData.utmTerm
                    }
                });
                result.dealId = newDeal.id;
                result.dealCreated = true;
                result.cadenceStarted = true; // DB trigger handles this

                // 10. Register history
                if (this.settings.auto_register_history) {
                    await this.registerDealLog(newDeal.id, leadData);
                    result.historyRegistered = true;
                }

                // 11. Create first activity
                if (this.settings.auto_create_activity) {
                    await this.createFirstActivity(newDeal.id, result.contactId, leadData);
                    result.activityCreated = true;
                }
            }

            // 12. Track form submission
            if (result.contactId && leadData.formId) {
                await this.trackFormSubmission({
                    contactId: result.contactId,
                    formId: leadData.formId,
                    dealId: result.dealId,
                    leadgenId: leadData.leadgenId
                });
            }

            // 13. Update form stats
            if (leadData.formId) {
                await this.updateFormStats(leadData.formId);
            }

            // 14. Record webhook event
            if (leadData.leadgenId) {
                await this.recordWebhookEvent(leadData.leadgenId, leadData, result);
            }

            // 15. Log success
            await this.logIntegration('lead_processed', 'success',
                `Lead processado com sucesso via ${leadData.source}. Contato: ${result.contactId}, Negócio: ${result.dealId}`,
                { result }, leadData.pageId);

            // 16. Trigger CAPI event for new lead
            if (result.dealId) {
                const capiStageName = result.dealCreated ? 'Lead Novo' : 'Lead Existente';
                try {
                    const capiRes = await sendMetaCAPIEvent(this.supabase, this.userId, result.dealId, capiStageName, undefined, leadData.testEventCode);
                    result.capiResult = capiRes;
                } catch (err) {
                    console.error('⚠️ [CAPI] Error sending event for processed lead:', err);
                    result.capiResult = { success: false, error: err.message };
                }
            }

            result.success = true;
        } catch (error) {
            result.error = error.message;
            
            // Record failed event
            if (leadData.leadgenId) {
                await this.recordWebhookEvent(leadData.leadgenId, leadData, result).catch(() => {});
            }
            
            await this.logIntegration('error', 'error',
                `Erro ao processar lead: ${error.message}`,
                { error: error.message, stack: error.stack, leadData }, leadData.pageId).catch(() => {});
        }

        result.processingTimeMs = Date.now() - this.startTime;
        return result;
    }

    async checkIdempotency(leadgenId) {
        const { data } = await this.supabase
            .from('meta_webhook_events')
            .select('id')
            .eq('leadgen_id', leadgenId)
            .eq('processing_status', 'success')
            .single();
            
        return !!data;
    }

    async findContactByEmail(email) {
        if (!email) return null;
        const normalizedEmail = email.toLowerCase().trim();
        const { data } = await this.supabase
            .from('contacts')
            .select('*')
            .eq('user_id', this.userId)
            .ilike('email', normalizedEmail)
            .limit(1);
            
        return data?.[0] || null;
    }

    async findContactByPhone(phone) {
        if (!phone) return null;
        const normalizedPhone = phone.replace(/\D/g, '');
        if (!normalizedPhone) return null;
        
        // Search by the last 8 digits for a flexible match, then refine in memory
        const searchSuffix = normalizedPhone.length > 8 ? normalizedPhone.slice(-8) : normalizedPhone;
        const { data: contacts } = await this.supabase
            .from('contacts')
            .select('*')
            .eq('user_id', this.userId)
            .ilike('phone', `%${searchSuffix}%`);

        if (contacts && contacts.length > 0) {
            const match = contacts.find(c => {
                const dbPhone = (c.phone || '').replace(/\D/g, '');
                return dbPhone === normalizedPhone || dbPhone.endsWith(searchSuffix);
            });
            return match || null;
        }
        return null;
    }

    async createCompany({ name }) {
        if (!name) return null;
        
        const { data: existing } = await this.supabase
            .from('companies')
            .select('*')
            .eq('user_id', this.userId)
            .ilike('name', name.trim())
            .limit(1);

        if (existing && existing.length > 0) {
            existing[0]._existed = true;
            return existing[0];
        }

        const companyData = {
            id: randomUUID(),
            user_id: this.userId,
            name: name.trim(),
            created_at: new Date().toISOString()
        };

        const { data, error } = await this.supabase
            .from('companies')
            .insert(companyData)
            .select();

        const created = data?.[0] || companyData;
        return { ...created, _existed: false };
    }

    async createContact({ name, email, phone, companyId, notes }) {
        const contactData = {
            id: randomUUID(),
            user_id: this.userId,
            name: name || 'Lead sem nome',
            email: email ? email.toLowerCase().trim() : null,
            phone: phone || null,
            company_id: companyId || null,
            notes: notes || null,
            role: 'Lead',
            marketing_status: 'lead',
            created_at: new Date().toISOString()
        };

        const { data, error } = await this.supabase
            .from('contacts')
            .insert(contactData)
            .select();

        if (error) {
            console.error('⚠️ [LeadProcessor] Error inserting contact:', error);
            throw new Error(`Erro ao criar contato: ${error.message}`);
        }

        return data?.[0] || contactData;
    }

    async findActiveDeal(contactId) {
        const { data } = await this.supabase
            .from('deals')
            .select('*')
            .eq('user_id', this.userId)
            .eq('contact_id', contactId)
            .neq('status', 'lost')
            .neq('status', 'won')
            .order('created_at', { ascending: false })
            .limit(1);
            
        return data?.[0] || null;
    }

    async registerDealLog(dealId, leadData) {
        const now = new Date().toISOString();
        const content = `📥 Lead recebido via ${leadData.source || 'N/A'}

Origem: ${leadData.source || 'N/A'}
Página: ${leadData.pageId || 'N/A'}
Campanha: ${leadData.campaignName || 'N/A'}
Conjunto: ${leadData.adsetName || 'N/A'}
Anúncio: ${leadData.adName || 'N/A'}
Formulário: ${leadData.formName || 'N/A'}
Lead ID: ${leadData.leadgenId || 'N/A'}
Data: ${leadData.createdTime || now}`;

        const logData = {
            id: randomUUID(),
            deal_id: dealId,
            content: content,
            log_type: 'system',
            created_by: this.userId,
            created_at: now
        };

        await this.supabase.from('deal_logs').insert(logData);
    }

    async createDeal({ title, contactId, companyId, source, pipelineId, stageId, utms }) {
        const { data: maxPositionData } = await this.supabase
            .from('deals')
            .select('position')
            .eq('user_id', this.userId)
            .eq('pipeline_id', pipelineId)
            .eq('stage_id', stageId)
            .order('position', { ascending: false })
            .limit(1);
            
        let position = 1;
        if (maxPositionData && maxPositionData.length > 0 && maxPositionData[0].position !== null) {
            position = maxPositionData[0].position + 1;
        }

        const dealData = {
            id: randomUUID(),
            user_id: this.userId,
            title: title,
            value: 0,
            currency: 'EUR',
            pipeline_id: pipelineId,
            stage_id: stageId,
            status: 'open',
            priority: 'medium',
            contact_id: contactId,
            company_id: companyId,
            source: source,
            position: position,
            utm_source: utms?.utm_source || null,
            utm_medium: utms?.utm_medium || null,
            utm_campaign: utms?.utm_campaign || null,
            utm_content: utms?.utm_content || null,
            utm_term: utms?.utm_term || null,
            created_at: new Date().toISOString()
        };

        const { data, error } = await this.supabase
            .from('deals')
            .insert(dealData)
            .select();

        if (error) {
            console.error('⚠️ [LeadProcessor] Error inserting deal:', error);
            throw new Error(`Erro ao criar negócio no banco de dados: ${error.message}`);
        }

        return data?.[0] || dealData;
    }

    async createFirstActivity(dealId, contactId, leadData) {
        const activityData = {
            id: randomUUID(),
            user_id: this.userId,
            deal_id: dealId,
            contact_id: contactId,
            type: 'task',
            title: `Contactar lead - ${leadData.name || 'Sem nome'} (${leadData.source || 'N/A'})`,
            description: null,
            notes: `Lead recebido automaticamente via ${leadData.source || 'N/A'}. Formulário: ${leadData.formName || 'N/A'}. Entrar em contacto o mais breve possível.`,
            date: new Date().toISOString(),
            completed: false,
            status: 'pending',
            is_automatic: true,
            created_at: new Date().toISOString()
        };

        await this.supabase.from('activities').insert(activityData);
    }

    async trackFormSubmission({ contactId, formId, dealId, leadgenId }) {
        const now = new Date().toISOString();
        
        const { data: existing } = await this.supabase
            .from('meta_form_submissions')
            .select('*')
            .eq('user_id', this.userId)
            .eq('contact_id', contactId)
            .eq('form_id', formId)
            .single();
            
        if (existing) {
            await this.supabase
                .from('meta_form_submissions')
                .update({
                    submission_count: (existing.submission_count || 1) + 1,
                    last_submitted_at: now,
                    deal_id: dealId,
                    last_leadgen_id: leadgenId
                })
                .eq('id', existing.id);
        } else {
            await this.supabase
                .from('meta_form_submissions')
                .insert({
                    id: randomUUID(),
                    user_id: this.userId,
                    contact_id: contactId,
                    form_id: formId,
                    deal_id: dealId,
                    submission_count: 1,
                    first_submitted_at: now,
                    last_submitted_at: now,
                    last_leadgen_id: leadgenId
                });
        }
    }

    async updateFormStats(formId) {
        const { data: form } = await this.supabase
            .from('meta_forms')
            .select('*')
            .eq('user_id', this.userId)
            .eq('form_id', formId)
            .single();
            
        if (form) {
            await this.supabase
                .from('meta_forms')
                .update({
                    leads_count: (form.leads_count || 0) + 1,
                    last_lead_at: new Date().toISOString()
                })
                .eq('id', form.id);
        } else {
            await this.supabase
                .from('meta_forms')
                .insert({
                    id: randomUUID(),
                    user_id: this.userId,
                    form_id: formId,
                    form_name: formId,
                    leads_count: 1,
                    last_lead_at: new Date().toISOString()
                });
        }
    }

    async recordWebhookEvent(leadgenId, leadData, result) {
        const eventData = {
            id: randomUUID(),
            user_id: this.userId,
            page_id: leadData.pageId || null,
            form_id: leadData.formId || null,
            leadgen_id: leadgenId,
            raw_payload: leadData._rawPayload || null,
            lead_data: leadData,
            processing_status: result.success ? 'success' : 'error',
            processing_error: result.error || null,
            contact_id: result.contactId || null,
            deal_id: result.dealId || null,
            is_duplicate: result.isDuplicate || false,
            created_at: leadData.createdTime || new Date().toISOString(),
            processed_at: new Date().toISOString()
        };

        // If the leadgenId is unique, upsert can match on it. Assuming there is a unique constraint on leadgen_id.
        await this.supabase
            .from('meta_webhook_events')
            .upsert(eventData, { onConflict: 'leadgen_id' });
    }

    async logIntegration(eventType, status, message, payload, pageId) {
        const logData = {
            id: randomUUID(),
            user_id: this.userId,
            event_type: eventType,
            status: status,
            message: message,
            payload: payload || null,
            page_id: pageId || null,
            created_at: new Date().toISOString()
        };

        await this.supabase.from('meta_integration_logs').insert(logData);
    }
}
