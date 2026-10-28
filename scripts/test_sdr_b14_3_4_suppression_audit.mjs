import assert from 'node:assert';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { SDREligibilityGate } from './sdr_eligibility_gate.mjs';
import { enqueueTask, TASK_TYPES } from '../api/sdr_task_queue.js';
import { defaultSDRWorker } from '../api/sdr_worker.js';
import { executeRecoveryAction, getRecoveryPipelineData } from '../api/sdr_recovery_pipeline.js';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

console.log('='.repeat(80));
console.log('🧪 B.14.3.4: AUDITORIA DE SUPRESSÃO E REGRAS DE PRECEDÊNCIA DO PILOTO');
console.log('='.repeat(80));

let passes = 0;
let fails = 0;

function check(condition, message) {
    if (condition) {
        console.log(`  ✅ [PASS] ${message}`);
        passes++;
    } else {
        console.error(`  ❌ [FAIL] ${message}`);
        fails++;
    }
}

async function runAudit() {
    // -------------------------------------------------------------------------
    // 1. ORIGEM FACTUAL DO ESTADO 'UNSUBSCRIBED' NA BASE DE DADOS
    // -------------------------------------------------------------------------
    console.log('\n▶️ [Secção 1] Investigação da Origem Técnica de marketing_status');
    
    // Consulta a contagem geral
    const { data: contacts, error: cErr } = await supabase
        .from('contacts')
        .select('marketing_status');

    check(!cErr && contacts && contacts.length > 0, `Total de ${contacts?.length} contactos consultados no CRM`);
    
    const unsubscribedCount = contacts?.filter(c => c.marketing_status === 'unsubscribed').length || 0;
    const isDefaultMigration = unsubscribedCount === contacts?.length;
    check(isDefaultMigration, `100% dos contactos (${unsubscribedCount}/${contacts?.length}) possuem 'unsubscribed' por default de migração da BD`);

    // -------------------------------------------------------------------------
    // 2. REGRAS DE PRECEDÊNCIA: A SUPRESSÃO PREVALECE SOBRE TODAS AS ROTAS
    // -------------------------------------------------------------------------
    console.log('\n▶️ [Secção 2] Comprovação das Regras de Precedência da Supressão');
    
    const mockUnsubscribedPayload = {
        deal_id: 'deal_test_suppression_precedence',
        nome_clinica: 'Clínica Odontológica Perfeita Lda',
        categoria_canonica: 'SILENCIO_CONFIRMADO', // comercialmente seria elegível
        motivo_perda: 'Não respondeu',
        telefone: '912345678',
        email: 'contacto@clinica.pt',
        tipo_destinatario: 'ENTIDADE_COLECTIVA_CLINICA',
        avaliacao_lia_b2b_aprovada: true,
        marketing_status: 'unsubscribed' // Supressão ativa
    };

    // Precedência 1: SDREligibilityGate bloqueia antes de considerar categoria comercial
    const gate = new SDREligibilityGate();
    const gateRes = gate.evaluate(mockUnsubscribedPayload);
    check(gateRes.elegivel === false, 'Supressão prevalece sobre elegibilidade comercial');
    check(gateRes.motivo_bloqueio === 'SUPRESSAO_MARKETING_UNSUBSCRIBED', 'Gate Central identifica SUPRESSAO_MARKETING_UNSUBSCRIBED no Check 2');

    // Precedência 2: Enfileiramento na fila de tarefas (enqueueTask)
    const enqRes = enqueueTask({
        dealId: mockUnsubscribedPayload.deal_id,
        taskType: TASK_TYPES.DISPATCH_MESSAGE,
        channel: 'WHATSAPP',
        payload: {
            marketing_status: 'unsubscribed'
        }
    });
    check(enqRes.success === false && enqRes.error === 'BLOQUEADO_SUPRESSAO_UNSUBSCRIBED', 'Fila de tarefas rejeita agendamento de disparo para contacto unsubscribed');

    // Precedência 3: Processamento do Worker em ANALYZE_DEAL com bloqueio estrito
    const mockTask = {
        id: `task_supp_test_${Date.now()}`,
        deal_id: mockUnsubscribedPayload.deal_id,
        task_type: TASK_TYPES.ANALYZE_DEAL,
        channel: 'WHATSAPP',
        payload: {
            deal: {
                id: mockUnsubscribedPayload.deal_id,
                title: mockUnsubscribedPayload.nome_clinica,
                lost_reason: 'Não respondeu',
                contact_id: 'contact_unsub_test'
            },
            contactPerson: 'Dr. Teste',
            marketing_status: 'unsubscribed',
            blockAnalysisOnUnsubscribed: true
        }
    };
    const workerRes = await defaultSDRWorker.processTask(mockTask);
    check(workerRes.success === false && workerRes.error === 'BLOQUEADO_SUPRESSAO_UNSUBSCRIBED', 'Worker interrompe ANALYZE_DEAL e não admite retries');

    // Precedência 4: Respostas recebidas (EVALUATE_INBOUND) de contacto unsubscribed
    const mockInboundTask = {
        id: `task_inbound_supp_${Date.now()}`,
        deal_id: mockUnsubscribedPayload.deal_id,
        task_type: TASK_TYPES.EVALUATE_INBOUND,
        channel: 'WHATSAPP',
        payload: {
            fromPhone: '351912345678',
            textContent: 'Olá, tenho muito interesse!',
            receivedAt: new Date().toISOString(),
            marketing_status: 'unsubscribed'
        }
    };
    const inboundRes = await defaultSDRWorker.processTask(mockInboundTask);
    check(inboundRes.blocked === true && inboundRes.reason === 'SUPRESSAO_MARKETING_UNSUBSCRIBED', 'IA não reativa cadência autónoma perante resposta de contacto unsubscribed');

    // Precedência 5: Ações do Closer Humano (executeRecoveryAction)
    const actionRes = await executeRecoveryAction({
        dealId: mockUnsubscribedPayload.deal_id,
        action: 'close_won',
        payload: {
            value: 1500,
            optInDocumentado: false // Sem prova documental de opt-in
        }
    });
    check(actionRes.success === false, 'Closer bloqueado de declarar ganho em contacto unsubscribed sem opt-in documentado');

    // -------------------------------------------------------------------------
    // 3. AUDITORIA INDIVIDUAL DOS TRÊS CANDIDATOS DO PILOTO
    // -------------------------------------------------------------------------
    console.log('\n▶️ [Secção 3] Auditoria Individual dos 3 Candidatos do Piloto');
    
    const candidateIds = [
        '2ee3b134-a111-4624-81b8-c9eef850b5ed', // C Clinic Leiria
        '9277e1cc-c1bd-49a9-88df-2e6a812f27f9', // LT Smile
        'fe3cc983-d52b-4c70-bb27-e848d3a83c58'  // Oral Project
    ];

    const { data: candidateDeals } = await supabase
        .from('deals')
        .select('*, contacts(*)')
        .in('id', candidateIds);

    const pipelineData = await getRecoveryPipelineData({ dealIds: candidateIds });

    for (const d of candidateDeals || []) {
        console.log(`\n  🔎 Analisando: ${d.title} (Deal ID: ${d.id})`);
        console.log(`     - Motivo de Perda: "${d.lost_reason}"`);
        console.log(`     - Contacto: ${d.contacts?.name} | Email: ${d.contacts?.email || 'N/A'} | Tel: ${d.contacts?.phone}`);
        console.log(`     - marketing_status no CRM: "${d.contacts?.marketing_status}"`);
        console.log(`     - Sincronização Brevo: brevo_status=${d.contacts?.brevo_status}, sync_status=${d.contacts?.brevo_sync_status}`);

        // Verificar atividades históricas por STOP / PARAR / RECUSA
        const { data: acts } = await supabase
            .from('activities')
            .select('*')
            .eq('deal_id', d.id);

        const hasExplicitOptOut = acts?.some(a => 
            /STOP|PARAR|CANCELAR|NÃO CONTACTAR|RECLAMAÇÃO/i.test(a.notes || '') ||
            /STOP|PARAR|CANCELAR|NÃO CONTACTAR|RECLAMAÇÃO/i.test(a.title || '')
        );

        check(!hasExplicitOptOut, `Ausência factual de registo de oposição (STOP/PARAR) na timeline de ${d.title}`);

        const item = pipelineData.items.find(i => i.dealId === d.id);

        check(item !== undefined, `Candidato ${d.title} integrado no pipeline de recuperação`);
        check(item?.eligibilityStatus === 'Pendente Revisão', `Status de elegibilidade classificado como 'Pendente Revisão' por supressão preventiva`);
        check(item?.isHumanInterventionPending === true, `Revisão humana obrigatória pendente ativada`);
        check(item?.aiAutonomySuspended === true, `Autonomia da IA suspensa preventivamente`);
    }

    console.log('\n' + '='.repeat(80));
    console.log(`🏁 RESULTADO AUDITORIA B.14.3.4: ${passes} PASSOU | ${fails} FALHOU`);
    console.log('='.repeat(80));
    process.exit(fails > 0 ? 1 : 0);
}

runAudit();
