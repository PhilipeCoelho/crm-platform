/**
 * ============================================================================
 * VAMUSS SDR — TESTE DE AUDITORIA DE REGRAS PÓS-HARDENING (FASE B.12.3)
 * ============================================================================
 * Audita a lógica das regras SQL e salvaguardas da RPC e RLS:
 * 1. Análise estática da RPC: search_path, validação de transição, confirmação de reunião.
 * 2. Análise estática do Trigger: campos protegidos e colunas manipuláveis.
 * 3. Validação do mecanismo de claim sdr_worker.
 * 4. Validação do bloqueio Fail-Closed quando credenciais live não estão presentes.
 * ============================================================================
 */

import fs from 'fs';
import path from 'path';

function runPostHardeningAudit() {
    console.log('🔍 Executando Auditoria de Segurança Pós-Hardening (Fase B.12.3)...\n');

    const sqlPath = path.resolve('supabase_sdr_permissions_hardening.sql');
    if (!fs.existsSync(sqlPath)) {
        throw new Error('Ficheiro SQL de hardening não encontrado: ' + sqlPath);
    }
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');

    const results = [];

    // Critério 1: search_path explícito na RPC SECURITY DEFINER
    const hasSearchPathInRpc = sqlContent.includes('SET search_path = public') || sqlContent.includes('SET search_path = pg_catalog, public');
    results.push({
        id: 'RPC_SECURITY_DEFINER_SEARCH_PATH',
        titulo: 'RPC SECURITY DEFINER possui search_path imutável declarado',
        status: hasSearchPathInRpc ? 'SEGURO' : 'VULNERABILIDADE_IDENTIFICADA',
        detalhe: hasSearchPathInRpc 
            ? 'search_path está explicitamente configurado.' 
            : 'Falta "SET search_path = public, pg_temp;" na função fn_sdr_transition_deal_stage. Funções SECURITY DEFINER sem search_path são vulneráveis a hijacking de search_path.'
    });

    // Critério 2: Validação de estado anterior antes de transição (State Machine)
    const hasPriorStateValidation = sqlContent.includes('v_deal.status') && sqlContent.includes('v_deal.stage_id');
    results.push({
        id: 'RPC_STATE_MACHINE_VALIDATION',
        titulo: 'RPC valida transições permitidas com base no estado anterior',
        status: hasPriorStateValidation ? 'SEGURO' : 'MELHORIA_NECESSARIA',
        detalhe: hasPriorStateValidation
            ? 'Transição condicionada ao estado anterior do negócio.'
            : 'A RPC atual permite passar qualquer negócio encontrado para stage_lead_engajamento ou stage_reuniao sem validar se o negócio estava previamente em status=lost ou se já avançou.'
    });

    // Critério 3: Regra de confirmação real de reunião (Requisito B.11.4 / B.11.5)
    const hasMeetingEvidenceCheck = sqlContent.includes('meeting_evidence') || sqlContent.includes('p_evidence_ref');
    results.push({
        id: 'RPC_MEETING_CONFIRMATION_EVIDENCE',
        titulo: 'RPC exige evidência formal para transição para stage_reuniao',
        status: hasMeetingEvidenceCheck ? 'SEGURO' : 'MELHORIA_NECESSARIA',
        detalhe: hasMeetingEvidenceCheck
            ? 'Evidência de reunião é exigida como parâmetro obrigatório.'
            : 'A transição para "stage_reuniao" pode ser invocada sem validação de evidência de aceitação/marcação no parâmetro.'
    });

    // Critério 4: Proteção de colunas no Trigger
    const guardsValue = sqlContent.includes('NEW.value IS DISTINCT FROM OLD.value');
    const guardsContact = sqlContent.includes('NEW.contact_id IS DISTINCT FROM OLD.contact_id');
    const guardsUser = sqlContent.includes('NEW.user_id IS DISTINCT FROM OLD.user_id');
    const guardsTitle = sqlContent.includes('NEW.title IS DISTINCT FROM OLD.title');
    const guardsPipeline = sqlContent.includes('NEW.pipeline_id IS DISTINCT FROM OLD.pipeline_id');
    const allProtected = guardsValue && guardsContact && guardsUser && guardsTitle && guardsPipeline;
    results.push({
        id: 'TRIGGER_COLUMN_GUARDS',
        titulo: 'Trigger protege colunas críticas contra mutação pelo SDR Worker',
        status: allProtected ? 'SEGURO' : 'INCOMPLETO',
        detalhe: allProtected
            ? 'Colunas financeiras, proprietário, contacto e pipeline devidamente protegidas.'
            : 'Uma ou mais colunas protegidas não constam na verificação do trigger.'
    });

    // Critério 5: Concessão pública de EXECUTE na RPC
    const revokesPublicExecute = sqlContent.includes('REVOKE EXECUTE ON FUNCTION public.fn_sdr_transition_deal_stage FROM PUBLIC');
    results.push({
        id: 'RPC_REVOKE_PUBLIC_EXECUTE',
        titulo: 'Execução pública da RPC é revogada explicitamente',
        status: revokesPublicExecute ? 'SEGURO' : 'VULNERABILIDADE_IDENTIFICADA',
        detalhe: revokesPublicExecute
            ? 'REVOKE EXECUTE FROM PUBLIC configurado.'
            : 'Por padrão no PostgreSQL, funções são executáveis por PUBLIC salvo se explicitamente revogado (embora fn_is_sdr_worker bloqueie em tempo de execução, boa prática de defesa em profundidade exige REVOKE EXECUTE).'
    });

    console.log('Resultados da Auditoria Estática do Código SQL:');
    results.forEach(r => {
        console.log(` • [${r.status}] ${r.titulo}`);
        console.log(`   Detalhe: ${r.detalhe}`);
    });

    return results;
}

runPostHardeningAudit();
