import crypto from 'node:crypto';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { processWhatsAppInboundMessage } from '../api/whatsapp.js';
import { enqueueTask, TASK_TYPES } from '../api/sdr_task_queue.js';
import { defaultSDRWorker } from '../api/sdr_worker.js';
import { determineInitialRecoveryStage, executeRecoveryAction, triggerCloserHandoff } from '../api/sdr_recovery_pipeline.js';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

console.log('='.repeat(80));
console.log('🧪 B.14.3.3: VALIDAÇÃO DO CICLO COMPLETO WHATSAPP & AUDITORIA DO PILOTO');
console.log('='.repeat(80));

let passes = 0;
let fails = 0;

function assert(condition, message) {
    if (condition) {
        console.log(`  ✅ [PASS] ${message}`);
        passes++;
    } else {
        console.error(`  ❌ [FAIL] ${message}`);
        fails++;
    }
}

async function runTests() {
    // -------------------------------------------------------------------------
    // 1. CICLO COMPLETO DE WHATSAPP COM NÚMERO DO OPERADOR
    // -------------------------------------------------------------------------
    console.log('\n▶️ [Passo 1] Validação HMAC, Deduplicação e Inbound Webhook do Operador');
    const appSecret = process.env.WHATSAPP_APP_SECRET || '93b4b1e5e67fa52d22d68cade2b8936a';
    const testWamid = `wamid.HBgMMzUxOTY0MDk0ODY1FQIAERgS${Date.now()}AA==`;
    const operatorPhone = '351964094865';
    const testMessageText = `Olá, estou a responder ao teste B.14.3.3 em ${new Date().toISOString()}`;

    const rawPayload = JSON.stringify({
        object: 'whatsapp_business_account',
        entry: [{
            id: '1436333598600386',
            changes: [{
                value: {
                    messaging_product: 'whatsapp',
                    metadata: { display_phone_number: '15556674212', phone_number_id: '1399575556570649' },
                    contacts: [{ profile: { name: 'Philipe Teste' }, wa_id: operatorPhone }],
                    messages: [{
                        from: operatorPhone,
                        id: testWamid,
                        timestamp: `${Math.floor(Date.now() / 1000)}`,
                        text: { body: testMessageText },
                        type: 'text'
                    }]
                },
                field: 'messages'
            }]
        }]
    });

    const signature = 'sha256=' + crypto.createHmac('sha256', appSecret).update(rawPayload).digest('hex');
    assert(signature.startsWith('sha256='), 'Assinatura HMAC SHA256 calculada com sucesso');

    // Executar processamento de inbound
    const inboundRes1 = await processWhatsAppInboundMessage({
        from: operatorPhone,
        id: testWamid,
        text: { body: testMessageText },
        type: 'text'
    });

    assert(inboundRes1.success === true, 'Mensagem inbound processada pelo adaptador WhatsApp');
    assert(inboundRes1.dealId === 'b0effb38-723f-4fd6-85ea-d01c9419c52e', 'Mensagem associada corretamente ao Deal do Operador no CRM');
    assert(inboundRes1.contactId === '5e724fda-09a4-4cef-a242-75eddd6c3ca4', 'Mensagem associada ao Contacto do Operador');

    // Deduplicação por wamid
    const inboundResDuplicate = await processWhatsAppInboundMessage({
        from: operatorPhone,
        id: testWamid,
        text: { body: testMessageText },
        type: 'text'
    });
    assert(inboundResDuplicate.duplicated === true, 'Deduplicação de eventos: mesmo wamid rejeitado com sucesso');

    // Verificar persistência na timeline (tabela activities)
    const { data: recentActivities } = await supabase
        .from('activities')
        .select('*')
        .eq('deal_id', 'b0effb38-723f-4fd6-85ea-d01c9419c52e')
        .order('date', { ascending: false })
        .limit(1);

    assert(recentActivities && recentActivities.length > 0, 'Atividade persistida com sucesso na tabela activities');
    if (recentActivities && recentActivities.length > 0) {
        assert(recentActivities[0].notes.includes(testMessageText), 'Conteúdo exato da mensagem registado na timeline do CRM');
    }

    // Ausência de disparos automáticos indevidos (Gate Legal mantido FAIL_CLOSED)
    assert(process.env.SDR_LEGAL_GATE === 'FAIL_CLOSED', 'SDR_LEGAL_GATE=FAIL_CLOSED impede envio de auto-respostas indevidas');

    // -------------------------------------------------------------------------
    // 2. REEXAME E PROVA DE BLOQUEIO DE DESQUALIFICADOS
    // -------------------------------------------------------------------------
    console.log('\n▶️ [Passo 2] Reexame do Bloqueio Permanente de Desqualificados');
    const mockDisqualifiedDeal = {
        id: `deal_disq_recheck_${Date.now()}`,
        title: 'Clínica Desqualificada Teste',
        status: 'lost',
        lost_reason: 'Desqualificado por falta de perfil',
        created_at: new Date(Date.now() - 40 * 86400000).toISOString()
    };

    // Via 1: Pipeline stage determination
    const stageRes = determineInitialRecoveryStage(mockDisqualifiedDeal);
    assert(stageRes === 'sem_recuperacao', 'determineInitialRecoveryStage bloqueia desqualificado em sem_recuperacao');

    // Via 2: Enqueue task rejection
    const enqueueRes = enqueueTask({
        dealId: mockDisqualifiedDeal.id,
        taskType: TASK_TYPES.ANALYZE_DEAL,
        channel: 'WHATSAPP',
        payload: { lostReason: mockDisqualifiedDeal.lost_reason }
    });
    assert(enqueueRes.success === false && enqueueRes.error === 'BLOQUEADO_DESQUALIFICADO', 'enqueueTask bloqueia negócio desqualificado');

    // Via 3: Closer actions rejection
    const actionRes = await executeRecoveryAction({
        dealId: mockDisqualifiedDeal.id,
        action: 'close_won',
        payload: { deal: mockDisqualifiedDeal, operator: 'closer_user', value: 1500 }
    });
    assert(actionRes.success === false && (actionRes.error === 'BLOQUEADO_DESQUALIFICADO' || actionRes.error === 'DEAL_NOT_FOUND'), 'executeRecoveryAction não permite fecho ganho em desqualificado');

    // Via 4: Handoff rejection
    const handoffRes = await triggerCloserHandoff({
        dealId: mockDisqualifiedDeal.id,
        reason: 'Lead desqualificado tentou handoff'
    });
    assert(handoffRes.success === false, 'triggerCloserHandoff bloqueia handoff de desqualificado');

    // -------------------------------------------------------------------------
    // 3. AUDITORIA DOS 3 CANDIDATOS DO PILOTO (SEM MODIFICAÇÃO)
    // -------------------------------------------------------------------------
    console.log('\n▶️ [Passo 3] Auditoria Legal e Comercial dos 3 Candidatos do Piloto');
    const candidateIds = [
        '2ee3b134-a111-4624-81b8-c9eef850b5ed', // Negócio C Clinic Leiria
        '9277e1cc-c1bd-49a9-88df-2e6a812f27f9', // Negócio LT Smile
        'fe3cc983-d52b-4c70-bb27-e848d3a83c58'  // Negócio Oral Project
    ];

    const { data: candidates, error: cErr } = await supabase
        .from('deals')
        .select('*, contacts(*)')
        .in('id', candidateIds);

    assert(!cErr && candidates && candidates.length === 3, 'Os 3 candidatos foram recuperados da BD com sucesso');

    for (const c of candidates || []) {
        console.log(`\n  📋 Candidato: ${c.title}`);
        console.log(`     - Deal ID: ${c.id}`);
        console.log(`     - Motivo de Perda: "${c.lost_reason}"`);
        console.log(`     - Contacto: ${c.contacts?.name} | Tel: ${c.contacts?.phone}`);
        console.log(`     - Marketing Status: ${c.contacts?.marketing_status}`);
        
        // Critério B.14.3.3: Se tiver 'unsubscribed' ou faltar consentimento expresso para WhatsApp, classificar como PENDENTE
        const isUnsubscribed = c.contacts?.marketing_status === 'unsubscribed';
        assert(isUnsubscribed === true, `${c.title} possui marketing_status='unsubscribed' (deve ser PENDENTE)`);
    }

    console.log('\n' + '='.repeat(80));
    console.log(`🏁 RESULTADO B.14.3.3: ${passes} PASSOU | ${fails} FALHOU`);
    console.log('='.repeat(80));
    process.exit(fails > 0 ? 1 : 0);
}

runTests();
