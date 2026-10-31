/**
 * server/squad/boss_agent.js
 * ============================================================================
 * O CHEFÃO (HEAD OF SALES IA / MASTER CONTROLLER)
 * ============================================================================
 * Audita os contactos abordados no dia, todos os dias.
 * Comunica-se EXCLUSIVAMENTE com o Philipe Coelho via relatório executivo diário.
 * Supervisiona o funil completo, avalia o que converte vs o que é ignorado,
 * e delega diretrizes para o Gerente de Operações (RevOps).
 * ============================================================================
 */

import { createClient } from '@supabase/supabase-js';
import { isClinicAutoReply } from '../sdr_auto_reply_filter.js';

function getSupabaseClient() {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
    if (!supabaseUrl || !supabaseKey) return null;
    return createClient(supabaseUrl, supabaseKey);
}

/**
 * Audita os contactos abordados no dia especificado (padrão: hoje).
 * @param {string|Date} dateFilter 
 */
export async function auditDailyPerformance(dateFilter = new Date()) {
    const targetDateStr = (dateFilter instanceof Date ? dateFilter : new Date(dateFilter)).toISOString().slice(0, 10);
    const startOfDay = `${targetDateStr}T00:00:00.000Z`;
    const endOfDay = `${targetDateStr}T23:59:59.999Z`;

    const supabase = getSupabaseClient();
    if (!supabase) {
        return { success: false, error: 'SUPABASE_UNAVAILABLE' };
    }

    try {
        // 1. Buscar todas as atividades do dia
        const { data: activities, error: actErr } = await supabase
            .from('activities')
            .select('*')
            .gte('created_at', startOfDay)
            .lte('created_at', endOfDay);

        if (actErr) throw actErr;

        // 2. Buscar logs de negócio do dia
        const { data: logs, error: logErr } = await supabase
            .from('deal_logs')
            .select('*')
            .gte('created_at', startOfDay)
            .lte('created_at', endOfDay);

        if (logErr) throw logErr;

        // 3. Contabilizar estado atual dos 234 negócios abertos
        const { data: openDeals, error: dealErr } = await supabase
            .from('deals')
            .select('id, title, stage_id, status, created_at')
            .eq('status', 'open');

        if (dealErr) throw dealErr;

        const stageBreakdown = {
            leadEngajado: openDeals.filter(d => d.stage_id === 'contacted').length,
            lead: openDeals.filter(d => d.stage_id === 'new').length,
            prospect: openDeals.filter(d => d.stage_id !== 'contacted' && d.stage_id !== 'new').length,
            totalOpen: openDeals.length
        };

        // 4. Analisar as mensagens disparadas hoje
        const outboundActivities = (activities || []).filter(a => 
            a.type === 'message' || a.type === 'email' || /whatsapp|mensagem|email/i.test(a.title || '')
        );

        // 5. Analisar respostas inbound e separar humanos de bots
        const inboundLogs = (logs || []).filter(l => 
            l.logType === 'manual_note' || l.logType === 'activity_note'
        );

        let autoRepliesFiltered = 0;
        let humanRepliesCount = 0;
        const humanReplies = [];

        inboundLogs.forEach(l => {
            const txt = l.content || '';
            if (isClinicAutoReply(txt)) {
                autoRepliesFiltered++;
            } else if (txt.length > 5 && !/Atividade concluída/i.test(txt)) {
                humanRepliesCount++;
                humanReplies.push({
                    dealId: l.deal_id,
                    snippet: txt.slice(0, 120),
                    createdAt: l.created_at
                });
            }
        });

        // 6. Contabilizar reuniões marcadas (Cal.com / ganho)
        const meetingsScheduled = (activities || []).filter(a => 
            /reuni[ãa]o|diagn[óo]stico|cal\.com/i.test(a.title || '') || /agendad/i.test(a.notes || '')
        );

        return {
            success: true,
            date: targetDateStr,
            metrics: {
                totalApproachedToday: outboundActivities.length,
                responsesReceivedToday: humanRepliesCount,
                autoRepliesFiltered,
                meetingsScheduled: meetingsScheduled.length,
                openDealsFunnel: stageBreakdown
            },
            details: {
                outboundActivities,
                humanReplies,
                meetingsScheduled
            }
        };
    } catch (err) {
        console.error('❌ [Chefão] Erro ao auditar performance diária:', err.message);
        return { success: false, error: err.message };
    }
}

/**
 * Gera o Relatório Executivo Diário que o Chefão apresenta ao Philipe.
 */
export async function generateDailyExecutiveReport(targetDate = new Date()) {
    const audit = await auditDailyPerformance(targetDate);
    if (!audit.success) {
        return `⚠️ [Chefão] Não foi possível auditar o dia ${targetDate}: ${audit.error}`;
    }

    const m = audit.metrics;
    const f = m.openDealsFunnel;

    return `
👑 **RELATÓRIO EXECUTIVO DIÁRIO DO CHEFÃO (HEAD OF SALES IA)**
📅 **Data de Auditoria:** ${audit.date}
👤 **Destinatário Exclusivo:** Philipe Coelho (CEO)

---

### 1. 📊 Indicadores Operacionais de Hoje
- **Contactos Abordados Hoje:** ${m.totalApproachedToday}
- **Respostas Humanas Reais:** ${m.responsesReceivedToday}
- **Auto-Respostas Filtradas (< 0.01ms):** ${m.autoRepliesFiltered}
- **Reuniões Agendadas (Cal.com):** ${m.meetingsScheduled}

---

### 2. 🎯 Estado Atual dos Negócios em Aberto no Funil
- 🟢 **Lead Engajado (Já Responderam / Em Conversa):** ${f.leadEngajado}
- 🟡 **Lead (Mensagem Enviada / Aguardando Follow-up):** ${f.lead}
- 🔵 **Prospect (Fila de Frios / Prontos para Touch 1):** ${f.prospect}
- **TOTAL DE NEGÓCIOS ABERTOS:** ${f.totalOpen}

---

### 3. 💬 Destaques de Conversas & Próximos Passos
${audit.details.humanReplies.length > 0 
    ? audit.details.humanReplies.map(r => `• Deal [${r.dealId}]: "${r.snippet}..."`).join('\n')
    : '• Nenhuma nova resposta humana pendente no dia de hoje.'}

---

### 4. 🧭 Diretrizes Delegadas ao Gerente de Operações para Amanhã
1. **Onda 1 Prioritária**: Assumir conversas ativas de Lead Engajado (${f.leadEngajado} negócios).
2. **Onda 2**: Aplicar tática Ghosting Buster (Chris Voss / áudio curto) aos Leads sem retorno há mais de 3 dias.
3. **Onda 3**: Manter teto seguro de 5 a 10 novos Prospects do nicho Dentárias & Estética com verificação prévia no CRM.
`.trim();
}
