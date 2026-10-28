import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { SDRActivationGate, MOTIVOS_BLOQUEIO_ATIVACAO } from './sdr_activation_gate.mjs';
import { SDREligibilityGate } from './sdr_eligibility_gate.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const INPUT_B2_FILE = path.join(ROOT_DIR, 'data', 'sdr_reactivation_phase_b2_audit.json');
const INPUT_B6_6_FILE = path.join(ROOT_DIR, 'data', 'sdr_reactivation_phase_b6_6_audit.json');

function pass(name) {
    console.log(`  ✅ [PASS] ${name}`);
}

export async function runPhaseB71TestSuite() {
    console.log('🧪 Iniciando Bateria de Testes de Reconciliação da Fase B.7.1...');

    const b2Data = JSON.parse(fs.readFileSync(INPUT_B2_FILE, 'utf8'));
    const b6_6Data = JSON.parse(fs.readFileSync(INPUT_B6_6_FILE, 'utf8'));
    const allDeals = b2Data.auditoria_completa_405_negocios || [];
    const suppressionList = b2Data.lista_supressao_estrita_proposta.registos || [];

    const activationGate = new SDRActivationGate({ suppressionList });

    // -------------------------------------------------------------------------
    // TESTE 1: Inelegibilidade comercial NÃO deve ser convertida em pendência jurídica (LIA)
    // -------------------------------------------------------------------------
    {
        const decision = activationGate.evaluateActivation({
            deal_id: 'test_inelegivel_comercial',
            nome_clinica: 'Clínica Pequena Fora de Perfil',
            categoria_canonica: 'DESQUALIFICADO_INCOMPATIVEL',
            tipo_destinatario: 'ENTIDADE_COLECTIVA_CLINICA',
            canal_pretendido: 'WHATSAPP',
            telefone: '911111111',
            avaliacao_lia_b2b_aprovada: false
        });

        assert.strictEqual(decision.autorizado_para_ativacao, false);
        assert.strictEqual(decision.motivo_bloqueio, MOTIVOS_BLOQUEIO_ATIVACAO.COMERCIALMENTE_INELEGIVEL);
        assert.notStrictEqual(decision.motivo_bloqueio, MOTIVOS_BLOQUEIO_ATIVACAO.LIA_B2B_PENDENTE);
        pass('1. Inelegibilidade comercial preservada: NÃO convertida em pendência de LIA');
    }

    // -------------------------------------------------------------------------
    // TESTE 2: Quarentena de agência ativa NÃO deve ser convertida em pendência jurídica (LIA)
    // -------------------------------------------------------------------------
    {
        const decision = activationGate.evaluateActivation({
            deal_id: 'test_quarentena_agencia',
            nome_clinica: 'Clínica com Agência de Marketing',
            categoria_canonica: 'JA_TEM_AGENCIA_OU_ANUNCIA',
            tipo_destinatario: 'ENTIDADE_COLECTIVA_CLINICA',
            canal_pretendido: 'WHATSAPP',
            telefone: '912222222',
            avaliacao_lia_b2b_aprovada: false
        });

        assert.strictEqual(decision.autorizado_para_ativacao, false);
        assert.strictEqual(decision.motivo_bloqueio, MOTIVOS_BLOQUEIO_ATIVACAO.QUARENTENA_AGENCIA_ATIVA);
        assert.notStrictEqual(decision.motivo_bloqueio, MOTIVOS_BLOQUEIO_ATIVACAO.LIA_B2B_PENDENTE);
        pass('2. Quarentena de agência ativa preservada: NÃO convertida em pendência de LIA');
    }

    // -------------------------------------------------------------------------
    // TESTE 3: Falta de contacto (Sem Endpoint) NÃO deve ser convertida em pendência jurídica
    // -------------------------------------------------------------------------
    {
        const decision = activationGate.evaluateActivation({
            deal_id: 'test_sem_contacto',
            nome_clinica: 'Clínica Sem Contactos Cadastrados',
            categoria_canonica: 'SILENCIO_CONFIRMADO',
            tipo_destinatario: 'ENTIDADE_COLECTIVA_CLINICA',
            canal_pretendido: 'WHATSAPP',
            telefone: null,
            email: null,
            avaliacao_lia_b2b_aprovada: false
        });

        assert.strictEqual(decision.autorizado_para_ativacao, false);
        assert.strictEqual(decision.motivo_bloqueio, MOTIVOS_BLOQUEIO_ATIVACAO.SEM_ENDPOINT_VALIDO);
        assert.notStrictEqual(decision.motivo_bloqueio, MOTIVOS_BLOQUEIO_ATIVACAO.LIA_B2B_PENDENTE);
        pass('3. Falta de contacto preservada como SEM_ENDPOINT_VALIDO: NÃO convertida em pendência de LIA');
    }

    // -------------------------------------------------------------------------
    // TESTE 4: Revisão humana obrigatória NÃO deve ser convertida em pendência jurídica
    // -------------------------------------------------------------------------
    {
        const decision = activationGate.evaluateActivation({
            deal_id: 'test_revisao_humana',
            nome_clinica: 'Clínica com Notas Ambíguas',
            categoria_canonica: 'AMBIGUO_OU_GATEKEEPER',
            tipo_destinatario: 'ENTIDADE_COLECTIVA_CLINICA',
            canal_pretendido: 'WHATSAPP',
            telefone: '913333333',
            avaliacao_lia_b2b_aprovada: false
        });

        assert.strictEqual(decision.autorizado_para_ativacao, false);
        assert.strictEqual(decision.motivo_bloqueio, MOTIVOS_BLOQUEIO_ATIVACAO.REVISAO_HUMANA_OBRIGATORIA);
        assert.notStrictEqual(decision.motivo_bloqueio, MOTIVOS_BLOQUEIO_ATIVACAO.LIA_B2B_PENDENTE);
        pass('4. Revisão humana preservada: NÃO convertida em pendência de LIA');
    }

    // -------------------------------------------------------------------------
    // TESTE 5: Apenas SILENCIO_CONFIRMADO com contacto avança para LIA ou Opt-in
    // -------------------------------------------------------------------------
    {
        // Clínica coletiva
        const decisionClinica = activationGate.evaluateActivation({
            deal_id: 'test_silencio_clinica',
            nome_clinica: 'Clínica Dentária Centro Lda',
            categoria_canonica: 'SILENCIO_CONFIRMADO',
            tipo_destinatario: 'ENTIDADE_COLECTIVA_CLINICA',
            canal_pretendido: 'WHATSAPP',
            telefone: '914444444',
            avaliacao_lia_b2b_aprovada: false
        });
        assert.strictEqual(decisionClinica.motivo_bloqueio, MOTIVOS_BLOQUEIO_ATIVACAO.LIA_B2B_PENDENTE);

        // Médico individual
        const decisionMedico = activationGate.evaluateActivation({
            deal_id: 'test_silencio_dr',
            nome_clinica: 'Consultório Dr. Antunes',
            categoria_canonica: 'SILENCIO_CONFIRMADO',
            tipo_destinatario: 'PESSOA_SINGULAR_MEDICO',
            canal_pretendido: 'WHATSAPP',
            telefone: '915555555',
            consentimento_documentado: false
        });
        assert.strictEqual(decisionMedico.motivo_bloqueio, MOTIVOS_BLOQUEIO_ATIVACAO.OPTIN_MEDICO_PENDENTE);
        pass('5. Apenas candidatos comercialmente elegíveis avançam para pendência de LIA (102) ou Opt-in (13)');
    }

    // -------------------------------------------------------------------------
    // TESTE 6: Supressão estrita prevalece sobre qualquer outra regra
    // -------------------------------------------------------------------------
    {
        const supRecord = suppressionList[0];
        const decision = activationGate.evaluateActivation({
            deal_id: supRecord.deal_id,
            nome_clinica: 'Clínica em Supressão Estrita',
            categoria_canonica: 'RECUSA_COMERCIAL_DIRETA',
            tipo_destinatario: 'ENTIDADE_COLECTIVA_CLINICA',
            canal_pretendido: 'WHATSAPP',
            telefone: supRecord.telefone_normalizado,
            email: supRecord.email_normalizado,
            avaliacao_lia_b2b_aprovada: true,
            referencia_homologacao_lia: 'LIA-VALIDO',
            autorizacao_canal_documentada: true,
            aprovacao_operacional_registada: true,
            aprovado_por_operador: 'ADMIN',
            data_aprovacao_operacional: new Date().toISOString()
        });

        assert.strictEqual(decision.autorizado_para_ativacao, false);
        assert.strictEqual(decision.motivo_bloqueio, MOTIVOS_BLOQUEIO_ATIVACAO.SUPRESSAO_ATIVA);
        pass('6. Supressão estrita bloqueia prioritariamente mesmo com LIA, canal e aprovação operacional');
    }

    // -------------------------------------------------------------------------
    // TESTE 7: Reconciliação Integral dos 405 Negócios (B.6.6 vs B.7.1)
    // -------------------------------------------------------------------------
    {
        const counts = {
            COMERCIALMENTE_INELEGIVEL: 0,
            AUTORIZACAO_PENDENTE: 0,
            BLOQUEADO: 0,
            REVISAO_HUMANA_OBRIGATORIA: 0,
            ELEGIVEL_PARA_ATIVACAO: 0
        };

        const subcounts = {
            clinicas_lia_b2b: 0,
            medicos_optin: 0,
            supressao_ativa: 0,
            quarentena_agencia: 0,
            sem_endpoint: 0,
            quarentena_contingencia: 0,
            revisao_humana: 0,
            resposta_automatica: 0,
            closer_humano: 0
        };

        allDeals.forEach(d => {
            const cat = d.auditoria_classificacao.fase_b2_revisada;
            const phone = d.contacto?.telefone_normalizado;
            const email = d.contacto?.email_normalizado;
            const titleLower = (d.nome_clinica || '').toLowerCase();
            const contactNameLower = (d.contacto?.nome || '').toLowerCase();
            const isDoc = titleLower.includes('dr.') || titleLower.includes('dra.') || 
                          titleLower.includes('doutor') || titleLower.includes('doutora') ||
                          contactNameLower.includes('dr.') || contactNameLower.includes('dra.');
            const tipo = isDoc ? 'PESSOA_SINGULAR_MEDICO' : 'ENTIDADE_COLECTIVA_CLINICA';

            const decision = activationGate.evaluateActivation({
                deal_id: d.deal_id,
                nome_clinica: d.nome_clinica,
                categoria_canonica: cat,
                canal_pretendido: 'WHATSAPP',
                telefone: phone,
                email: email,
                tipo_destinatario: tipo,
                avaliacao_lia_b2b_aprovada: false,
                consentimento_documentado: false,
                autorizacao_canal_documentada: false
            });

            if (decision.autorizado_para_ativacao) {
                counts.ELEGIVEL_PARA_ATIVACAO++;
            } else if (decision.motivo_bloqueio === MOTIVOS_BLOQUEIO_ATIVACAO.COMERCIALMENTE_INELEGIVEL) {
                counts.COMERCIALMENTE_INELEGIVEL++;
            } else if (decision.motivo_bloqueio === MOTIVOS_BLOQUEIO_ATIVACAO.LIA_B2B_PENDENTE) {
                counts.AUTORIZACAO_PENDENTE++;
                subcounts.clinicas_lia_b2b++;
            } else if (decision.motivo_bloqueio === MOTIVOS_BLOQUEIO_ATIVACAO.OPTIN_MEDICO_PENDENTE) {
                counts.AUTORIZACAO_PENDENTE++;
                subcounts.medicos_optin++;
            } else if (decision.motivo_bloqueio === MOTIVOS_BLOQUEIO_ATIVACAO.SUPRESSAO_ATIVA) {
                counts.BLOQUEADO++;
                subcounts.supressao_ativa++;
            } else if (decision.motivo_bloqueio === MOTIVOS_BLOQUEIO_ATIVACAO.QUARENTENA_AGENCIA_ATIVA) {
                counts.BLOQUEADO++;
                subcounts.quarentena_agencia++;
            } else if (decision.motivo_bloqueio === MOTIVOS_BLOQUEIO_ATIVACAO.SEM_ENDPOINT_VALIDO) {
                counts.BLOQUEADO++;
                subcounts.sem_endpoint++;
            } else if (decision.motivo_bloqueio === MOTIVOS_BLOQUEIO_ATIVACAO.QUARENTENA_CONTINGENCIA_ATIVA) {
                counts.BLOQUEADO++;
                subcounts.quarentena_contingencia++;
            } else if (decision.motivo_bloqueio === MOTIVOS_BLOQUEIO_ATIVACAO.REVISAO_HUMANA_OBRIGATORIA) {
                counts.REVISAO_HUMANA_OBRIGATORIA++;
                subcounts.revisao_humana++;
            } else if (decision.motivo_bloqueio === MOTIVOS_BLOQUEIO_ATIVACAO.RESPOSTA_AUTOMATICA_PENDENTE_MANUAL) {
                counts.REVISAO_HUMANA_OBRIGATORIA++;
                subcounts.resposta_automatica++;
            } else if (decision.motivo_bloqueio === MOTIVOS_BLOQUEIO_ATIVACAO.ENCAMINHAMENTO_CLOSER_HUMANO) {
                counts.REVISAO_HUMANA_OBRIGATORIA++;
                subcounts.closer_humano++;
            } else {
                throw new Error(`Motivo não mapeado: ${decision.motivo_bloqueio}`);
            }
        });

        // Verificações rigorosas da B.6.6
        assert.strictEqual(counts.COMERCIALMENTE_INELEGIVEL, 192, 'Deve ter exatamente 192 comercialmente inelegíveis');
        assert.strictEqual(counts.AUTORIZACAO_PENDENTE, 115, 'Deve ter exatamente 115 pendentes de autorização');
        assert.strictEqual(subcounts.clinicas_lia_b2b, 102, 'Deve ter exatamente 102 clínicas pendentes de LIA');
        assert.strictEqual(subcounts.medicos_optin, 13, 'Deve ter exatamente 13 médicos pendentes de opt-in');
        assert.strictEqual(counts.BLOQUEADO, 74, 'Deve ter exatamente 74 bloqueados');
        assert.strictEqual(subcounts.supressao_ativa, 26, 'Deve ter exatamente 26 sob supressão ativa');
        assert.strictEqual(subcounts.quarentena_agencia, 39, 'Deve ter exatamente 39 em quarentena de agência');
        assert.strictEqual(subcounts.sem_endpoint, 6, 'Deve ter exatamente 6 sem endpoint válido');
        assert.strictEqual(subcounts.quarentena_contingencia, 3, 'Deve ter exatamente 3 em quarentena de contingência');
        assert.strictEqual(counts.REVISAO_HUMANA_OBRIGATORIA, 24, 'Deve ter exatamente 24 em revisão humana');
        assert.strictEqual(subcounts.revisao_humana, 19, 'Deve ter exatamente 19 em revisão humana estrita');
        assert.strictEqual(subcounts.resposta_automatica, 4, 'Deve ter exatamente 4 respostas automáticas pendentes');
        assert.strictEqual(subcounts.closer_humano, 1, 'Deve ter exatamente 1 encaminhamento closer humano');
        assert.strictEqual(counts.ELEGIVEL_PARA_ATIVACAO, 0, 'Zero negócios autorizados para ativação real');

        const totalReconciliado = counts.COMERCIALMENTE_INELEGIVEL +
            counts.AUTORIZACAO_PENDENTE +
            counts.BLOQUEADO +
            counts.REVISAO_HUMANA_OBRIGATORIA +
            counts.ELEGIVEL_PARA_ATIVACAO;

        assert.strictEqual(totalReconciliado, 405, 'Total deve somar exatamente 405');
        pass('7. Reconciliação dos 405 negócios validada: 100% de correspondência com B.6.6');
    }

    console.log('\n==============================================================================');
    console.log('🎉 TODOS OS 7 TESTES DE RECONCILIAÇÃO DA FASE B.7.1 FORAM APROVADOS!');
    console.log('==============================================================================\n');
}

// Executar se chamado diretamente
if (process.argv[1]?.endsWith('test_sdr_phase_b7_1.mjs')) {
    runPhaseB71TestSuite().catch(err => {
        console.error('❌ ERRO NA SUITE DE TESTES B.7.1:', err);
        process.exit(1);
    });
}
