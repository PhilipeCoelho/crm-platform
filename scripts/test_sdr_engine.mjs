import assert from 'assert';
import { evaluateCommercialDecision, normalizeText } from './sdr_reactivation_engine.mjs';

console.log('🧪 Iniciando testes unitários expandidos do Motor Comercial SDR Vamuss (Fase A.2)...\n');

// 1. RECUSA EXPLÍCITA (ex: "Não teve interesse" / "Não estamos interessados")
{
    const dossier = {
        deal: { id: 'd-1', title: 'Clínica Alpha', lost_reason: 'Não teve interesse', lost_at: '2026-05-01T10:00:00Z', created_at: '2026-04-01T10:00:00Z' },
        activities: [{ id: 'a-1', completed: true, notes: 'Apresentada proposta' }],
        logs: [{ id: 'l-1', content: 'Dra. disse que não tem interesse.' }]
    };
    const res = evaluateCommercialDecision(dossier);
    assert.strictEqual(res.decisao, 'nao_reativar');
    assert.strictEqual(res.potencial_reativacao, 'nulo');
    assert.strictEqual(res.proxima_acao.canal_sugerido, 'nenhum');
    console.log('✅ Cenário 1 (Recusa explícita -> nao_reativar): Aprovado');
}

// 2. RECUSA POLIDA / MOMENTO INOPORTUNO TEMPORÁRIO (ex: Caso Clínica Mediminho)
{
    const dossier = {
        deal: {
            id: 'd-2',
            title: 'Clínica Mediminho',
            lost_reason: '[Sem interesse no momento]\nBom dia Sr. Philipe\nAgradecemos o seu contato e o seu interesse, contudo neste momento não estamos interessados na sua proposta.\nGuardamos o seu contato caso no futuro seja necessário.\nMuito obrigado',
            lost_at: '2026-05-15T10:00:00Z',
            created_at: '2026-04-10T10:00:00Z'
        },
        activities: [{ id: 'a-1', completed: true }],
        logs: []
    };
    const res = evaluateCommercialDecision(dossier);
    assert.strictEqual(res.decisao, 'aguardar');
    assert.strictEqual(res.potencial_reativacao, 'baixo');
    assert.ok(res.proxima_acao.mensagem_proposta_pt_pt.includes('AGUARDAR PRAZO'));
    console.log('✅ Cenário 2 (Recusa polida "sem interesse no momento" -> aguardar): Aprovado');
}

// 3. ADIAMENTO POR MIGRAÇÃO (ex: Caso CMD Viseu)
{
    const dossier = {
        deal: {
            id: 'd-3',
            title: 'CMD Viseu',
            lost_reason: 'Secretaria sem educação e sem interesse em repassar a informação. Margarete, disse que clinica passa por uma migração e este não seria o melhor momento',
            lost_at: '2026-05-10T10:00:00Z',
            created_at: '2026-04-01T10:00:00Z'
        },
        activities: [{ id: 'a-1', completed: true }],
        logs: []
    };
    const res = evaluateCommercialDecision(dossier);
    assert.strictEqual(res.decisao, 'aguardar');
    assert.strictEqual(res.potencial_reativacao, 'medio');
    assert.ok(res.fundamentacao_potencial.includes('migração') || res.fundamentacao_potencial.includes('adiamento'));
    console.log('✅ Cenário 3 (Adiamento por migração / momento inoportuno -> aguardar): Aprovado');
}

// 4. ANÚNCIOS ATIVOS COM DIFERENTES FORMULAÇÕES (ex: "Já estão anunciando", "Já tem anúncios ativos")
{
    const form1 = {
        deal: { id: 'd-4a', title: 'CliniCosta', lost_reason: 'Já estão anunciando ', lost_at: '2026-05-10T10:00:00Z', created_at: '2026-04-01T10:00:00Z' },
        activities: [{ id: 'a-1', completed: true }],
        logs: []
    };
    const res1 = evaluateCommercialDecision(form1);
    assert.strictEqual(res1.decisao, 'aguardar');

    const form2 = {
        deal: { id: 'd-4b', title: 'Clínica Catarina Fontes', lost_reason: 'Já tem anúncios ativos', lost_at: '2026-05-10T10:00:00Z', created_at: '2026-04-01T10:00:00Z' },
        activities: [{ id: 'a-1', completed: true }],
        logs: []
    };
    const res2 = evaluateCommercialDecision(form2);
    assert.strictEqual(res2.decisao, 'aguardar');
    console.log('✅ Cenário 4 (Anúncios ativos com variações linguísticas -> aguardar): Aprovado');
}

// 5. DESQUALIFICAÇÃO COMBINADA COM AUSÊNCIA DE RESPOSTA (ex: "fora de perfil, não responde")
{
    const dossier = {
        deal: { id: 'd-5', title: 'Clinica Dentária Dental One', lost_reason: 'fora de perfil, não responde', lost_at: '2026-06-01T10:00:00Z', created_at: '2026-04-01T10:00:00Z' },
        activities: [{ id: 'a-1', completed: true, notes: 'Tentativa WhatsApp' }],
        logs: [{ id: 'l-1', content: 'Sem presença digital estruturada.' }]
    };
    const res = evaluateCommercialDecision(dossier);
    assert.notStrictEqual(res.decisao, 'reativar_agora', 'Desqualificação deve sobrepor silêncio');
    assert.ok(res.decisao === 'nao_reativar' || res.decisao === 'revisao_humana');
    console.log('✅ Cenário 5 (Desqualificação prevalece sobre "não responde" -> nao_reativar/revisão): Aprovado');
}

// 6. DESQUALIFICAÇÃO GENÉRICA COM HISTÓRICO INSUFICIENTE (ex: "Desqualificado" sem notas)
{
    const dossier = {
        deal: { id: 'd-6', title: 'MOC Porto', lost_reason: 'Desqualificado', lost_at: '2026-05-11T08:48:11Z', created_at: '2026-05-11T08:47:00Z' },
        activities: [{ id: 'a-1', completed: false }],
        logs: []
    };
    const res = evaluateCommercialDecision(dossier);
    assert.strictEqual(res.decisao, 'revisao_humana');
    assert.strictEqual(res.potencial_reativacao, 'indeterminado');
    console.log('✅ Cenário 6 (Desqualificação genérica sem histórico -> revisao_humana): Aprovado');
}

// 7. OPT-OUT EXPLÍCITO (Pedido de não contacto)
{
    const dossier = {
        deal: { id: 'd-7', title: 'Clínica Beta', lost_reason: 'Não respondeu', lost_at: '2026-05-01T10:00:00Z', created_at: '2026-04-01T10:00:00Z' },
        activities: [{ id: 'a-1', completed: true }],
        logs: [{ id: 'l-1', content: 'Dr. solicitou para não ligar mais e remover da lista da agência.' }]
    };
    const res = evaluateCommercialDecision(dossier);
    assert.strictEqual(res.decisao, 'nao_reativar');
    assert.strictEqual(res.potencial_reativacao, 'nulo');
    assert.strictEqual(res.proxima_acao.canal_sugerido, 'nenhum');
    console.log('✅ Cenário 7 (Opt-out explícito -> nao_reativar): Aprovado');
}

// 8. NEGÓCIO PERDIDO HÁ MENOS DE 30 DIAS (Respiro comercial)
{
    const dossier = {
        deal: { id: 'd-8', title: 'Clínica Construímos Sorrisos', lost_reason: 'Não respondeu ao email', lost_at: '2026-09-20T10:00:00Z', created_at: '2026-08-01T10:00:00Z' },
        activities: [{ id: 'a-1', completed: true }],
        logs: [{ id: 'l-1', content: 'Enviada apresentação.' }]
    };
    // now = 2026-10-09, delta = 19 dias (< 30)
    const res = evaluateCommercialDecision(dossier);
    assert.strictEqual(res.decisao, 'aguardar');
    assert.strictEqual(res.potencial_reativacao, 'medio');
    assert.ok(res.fundamentacao_potencial.includes('respiro comercial') || res.fundamentacao_potencial.includes('apenas'));
    console.log('✅ Cenário 8 (Perdido há menos de 30 dias -> aguardar): Aprovado');
}

// 9. SILÊNCIO PROLONGADO SEM RECUSA (Reativar agora)
{
    const dossier = {
        deal: { id: 'd-9', title: 'Dra. Pamella Pessoa', lost_reason: 'Não responde ', lost_at: '2026-04-27T15:08:41Z', created_at: '2026-03-01T10:00:00Z' },
        activities: [{ id: 'a-1', completed: true, notes: 'Mensagem inicial enviada' }, { id: 'a-2', completed: true, notes: 'Follow-up' }],
        logs: [{ id: 'l-1', content: 'Mensagem entregue.' }]
    };
    const res = evaluateCommercialDecision(dossier);
    assert.strictEqual(res.decisao, 'reativar_agora');
    assert.strictEqual(res.potencial_reativacao, 'alto');
    assert.strictEqual(res.proxima_acao.canal_sugerido, 'whatsapp');
    console.log('✅ Cenário 9 (Silêncio prolongado sem recusa -> reativar_agora): Aprovado');
}

// 10. SEGURANÇA E FACTUALIDADE DAS MENSAGENS (Sem alucinações de especialidades ou conteúdos)
{
    const dossier = {
        deal: { id: 'd-10', title: 'Clínica DentalCare', lost_reason: 'Não respondeu', lost_at: '2026-04-01T10:00:00Z', created_at: '2026-03-01T10:00:00Z' },
        activities: [{ id: 'a-1', completed: true }, { id: 'a-2', completed: true }],
        logs: [{ id: 'l-1', content: 'Sem retorno.' }]
    };
    const res = evaluateCommercialDecision(dossier);
    const msg = res.proxima_acao.mensagem_proposta_pt_pt;
    
    // Proibir falsas declarações de acompanhamento e presunções de especialidades
    assert.strictEqual(msg.includes('Acompanhei os vossos conteúdos'), false, 'Não deve inventar que acompanhou conteúdos');
    assert.strictEqual(msg.includes('reabilitação e implantes'), false, 'Não deve presumir tratamentos específicos não comprovados');
    assert.strictEqual(msg.includes('horários vagos'), false, 'Não deve presumir agenda vazia');
    assert.strictEqual(msg.includes('lembrei-me do vosso projeto'), false, 'Não deve fingir intimidade');
    
    // Deve conter retoma educada e neutra
    assert.ok(msg.includes('pacientes particulares'), 'Deve focar no benefício comercial neutro');
    assert.ok(msg.includes('Clínica DentalCare'), 'Deve citar o nome da clínica');
    console.log('✅ Cenário 10 (Mensagem estritamente factual e neutra sem alucinações): Aprovado');
}

console.log('\n🎉 TODOS OS 10 TESTES EXPANDIDOS FORAM APROVADOS COM SUCESSO!\n');
