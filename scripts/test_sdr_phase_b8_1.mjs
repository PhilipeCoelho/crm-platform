import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { SDRActivationGate, MOTIVOS_BLOQUEIO_ATIVACAO, ESTADOS_DOCUMENTAIS_ATIVACAO } from './sdr_activation_gate.mjs';
import { ESTRUTURA_DOSSIE_HOMOLOGACAO, buildDealHomologationTemplate } from './sdr_homologation_dossier.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const INPUT_B2_FILE = path.join(ROOT_DIR, 'data', 'sdr_reactivation_phase_b2_audit.json');

function pass(name) {
    console.log(`  ✅ [PASS] ${name}`);
}

export async function runPhaseB81TestSuite() {
    console.log('🧪 Iniciando Bateria de Testes da Fase B.8.1 (Dossiê de Homologação e Preparação para Ativação)...');

    const b2Data = JSON.parse(fs.readFileSync(INPUT_B2_FILE, 'utf8'));
    const allDeals = b2Data.auditoria_completa_405_negocios || [];
    const suppressionList = b2Data.lista_supressao_estrita_proposta.registos || [];

    const gate = new SDRActivationGate({ suppressionList });

    // -------------------------------------------------------------------------
    // TESTE 1: Distinção de DOCUMENTACAO_EM_FALTA
    // -------------------------------------------------------------------------
    {
        const decision = gate.evaluateActivation({
            deal_id: 'test_sem_dossie',
            nome_clinica: 'Clínica Sem Dossiê',
            categoria_canonica: 'SILENCIO_CONFIRMADO',
            tipo_destinatario: 'ENTIDADE_COLECTIVA_CLINICA',
            canal_pretendido: 'WHATSAPP',
            telefone: '911111111',
            avaliacao_lia_b2b_aprovada: false,
            dossie_submetido: false,
            referencia_homologacao_lia: null
        });

        assert.strictEqual(decision.autorizado_para_ativacao, false);
        assert.strictEqual(decision.motivo_bloqueio, MOTIVOS_BLOQUEIO_ATIVACAO.LIA_B2B_PENDENTE);
        assert.strictEqual(decision.estado_documental, ESTADOS_DOCUMENTAIS_ATIVACAO.DOCUMENTACAO_EM_FALTA);
        pass('1. Gate distingue claramente DOCUMENTACAO_EM_FALTA para candidato sem submissão');
    }

    // -------------------------------------------------------------------------
    // TESTE 2: Distinção de DOCUMENTACAO_SUBMETIDA_NAO_VALIDADA
    // -------------------------------------------------------------------------
    {
        const decision = gate.evaluateActivation({
            deal_id: 'test_dossie_submetido_pendente',
            nome_clinica: 'Clínica com Minuta Submetida',
            categoria_canonica: 'SILENCIO_CONFIRMADO',
            tipo_destinatario: 'ENTIDADE_COLECTIVA_CLINICA',
            canal_pretendido: 'WHATSAPP',
            telefone: '912222222',
            avaliacao_lia_b2b_aprovada: false, // Jurista ainda não validou!
            dossie_submetido: true,
            referencia_homologacao_lia: 'MINUTA-LIA-DRAFT-2026-001'
        });

        assert.strictEqual(decision.autorizado_para_ativacao, false);
        assert.strictEqual(decision.motivo_bloqueio, MOTIVOS_BLOQUEIO_ATIVACAO.LIA_B2B_PENDENTE);
        assert.strictEqual(decision.estado_documental, ESTADOS_DOCUMENTAIS_ATIVACAO.DOCUMENTACAO_SUBMETIDA_NAO_VALIDADA);
        pass('2. Gate distingue claramente DOCUMENTACAO_SUBMETIDA_NAO_VALIDADA');
    }

    // -------------------------------------------------------------------------
    // TESTE 3: Distinção de VALIDACAO_JURIDICA_CONCLUIDA (mas sem canal)
    // -------------------------------------------------------------------------
    {
        const decision = gate.evaluateActivation({
            deal_id: 'test_juridico_ok_canal_nao',
            nome_clinica: 'Clínica com LIA Validado',
            categoria_canonica: 'SILENCIO_CONFIRMADO',
            tipo_destinatario: 'ENTIDADE_COLECTIVA_CLINICA',
            canal_pretendido: 'WHATSAPP',
            telefone: '913333333',
            avaliacao_lia_b2b_aprovada: true,
            referencia_homologacao_lia: 'PROC-LIA-HOMOLOG-2026-002',
            responsavel_homologacao_juridica: 'Dr. Alberto DPO (Cédula OA 11223)',
            autorizacao_canal_documentada: false // Canal WhatsApp NÃO autorizado!
        });

        assert.strictEqual(decision.autorizado_para_ativacao, false);
        assert.strictEqual(decision.motivo_bloqueio, MOTIVOS_BLOQUEIO_ATIVACAO.FALTA_AUTORIZACAO_CANAL);
        assert.strictEqual(decision.estado_documental, ESTADOS_DOCUMENTAIS_ATIVACAO.VALIDACAO_JURIDICA_CONCLUIDA);
        pass('3. Gate distingue VALIDACAO_JURIDICA_CONCLUIDA perante ausência de autorização de canal');
    }

    // -------------------------------------------------------------------------
    // TESTE 4: Distinção de APROVACAO_OPERACIONAL_PENDENTE
    // -------------------------------------------------------------------------
    {
        const decision = gate.evaluateActivation({
            deal_id: 'test_falta_operador',
            nome_clinica: 'Clínica Aprovada Legal e Canal',
            categoria_canonica: 'SILENCIO_CONFIRMADO',
            tipo_destinatario: 'ENTIDADE_COLECTIVA_CLINICA',
            canal_pretendido: 'WHATSAPP',
            telefone: '914444444',
            avaliacao_lia_b2b_aprovada: true,
            referencia_homologacao_lia: 'PROC-LIA-HOMOLOG-2026-003',
            responsavel_homologacao_juridica: 'Dra. Sofia Jurídico (Cédula OA 44556)',
            autorizacao_canal_documentada: true,
            canais_autorizados: ['WHATSAPP'],
            aprovacao_operacional_registada: false // Operador humano ainda não assinou!
        });

        assert.strictEqual(decision.autorizado_para_ativacao, false);
        assert.strictEqual(decision.motivo_bloqueio, MOTIVOS_BLOQUEIO_ATIVACAO.FALTA_APROVACAO_OPERACIONAL);
        assert.strictEqual(decision.estado_documental, ESTADOS_DOCUMENTAIS_ATIVACAO.APROVACAO_OPERACIONAL_PENDENTE);
        pass('4. Gate distingue claramente APROVACAO_OPERACIONAL_PENDENTE');
    }

    // -------------------------------------------------------------------------
    // TESTE 5: Distinção de ATIVACAO_AUTORIZADA quando todos os fatores existem
    // -------------------------------------------------------------------------
    {
        const decision = gate.evaluateActivation({
            deal_id: 'test_totalmente_conforme',
            nome_clinica: 'Clínica Totalmente Homologada',
            categoria_canonica: 'SILENCIO_CONFIRMADO',
            tipo_destinatario: 'ENTIDADE_COLECTIVA_CLINICA',
            canal_pretendido: 'WHATSAPP',
            telefone: '915555555',
            avaliacao_lia_b2b_aprovada: true,
            referencia_homologacao_lia: 'PROC-LIA-HOMOLOG-2026-004',
            responsavel_homologacao_juridica: 'Dr. Alberto DPO (Cédula OA 11223)',
            data_homologacao_lia: '2026-10-10',
            autorizacao_canal_documentada: true,
            canais_autorizados: ['WHATSAPP'],
            aprovacao_operacional_registada: true,
            aprovado_por_operador: 'SUPERVISOR_CLINICO',
            data_aprovacao_operacional: new Date().toISOString()
        });

        assert.strictEqual(decision.autorizado_para_ativacao, true);
        assert.strictEqual(decision.motivo_decisao, 'AUTORIZADO_PARA_ATIVACAO_PILOTO');
        assert.strictEqual(decision.estado_documental, ESTADOS_DOCUMENTAIS_ATIVACAO.ATIVACAO_AUTORIZADA);
        pass('5. Gate atinge ATIVACAO_AUTORIZADA quando todas as camadas são comprovadas');
    }

    // -------------------------------------------------------------------------
    // TESTE 6: Rejeição de referência documental sem validador jurídico identificado
    // -------------------------------------------------------------------------
    {
        const strictGate = new SDRActivationGate({
            suppressionList,
            strictLegalVerification: true,
            requireExplicitLegalSigner: true // Exige validador jurídico identificado
        });

        const decision = strictGate.evaluateActivation({
            deal_id: 'test_sem_signatario',
            nome_clinica: 'Clínica com Ref Falsa',
            categoria_canonica: 'SILENCIO_CONFIRMADO',
            tipo_destinatario: 'ENTIDADE_COLECTIVA_CLINICA',
            canal_pretendido: 'WHATSAPP',
            telefone: '916666666',
            avaliacao_lia_b2b_aprovada: true,
            referencia_homologacao_lia: 'NUMERO-INVENTADO-123',
            responsavel_homologacao_juridica: null // Sem jurista identificado!
        });

        assert.strictEqual(decision.autorizado_para_ativacao, false);
        assert.strictEqual(decision.motivo_bloqueio, MOTIVOS_BLOQUEIO_ATIVACAO.FALTA_BASE_LEGAL);
        pass('6. Número de referência sem jurista/DPO identificado é rejeitado em modo estrito');
    }

    // -------------------------------------------------------------------------
    // TESTE 7: Médicos singulares exigem prova de Opt-in documentada e não usam LIA
    // -------------------------------------------------------------------------
    {
        const decision = gate.evaluateActivation({
            deal_id: 'test_dr_tentando_lia',
            nome_clinica: 'Consultório Dr. Carlos Medeiros',
            categoria_canonica: 'SILENCIO_CONFIRMADO',
            tipo_destinatario: 'PESSOA_SINGULAR_MEDICO',
            canal_pretendido: 'WHATSAPP',
            telefone: '917777777',
            avaliacao_lia_b2b_aprovada: true, // LIA não se aplica a médicos singulares!
            referencia_homologacao_lia: 'LIA-PARA-MEDICO',
            consentimento_documentado: false // Sem consentimento
        });

        assert.strictEqual(decision.autorizado_para_ativacao, false);
        assert.strictEqual(decision.motivo_bloqueio, MOTIVOS_BLOQUEIO_ATIVACAO.OPTIN_MEDICO_PENDENTE);
        pass('7. Pessoas singulares (médicos) exigem Opt-in e não podem ser ativadas com base em LIA');
    }

    // -------------------------------------------------------------------------
    // TESTE 8: Validação dos 405 negócios na Fase B.8.1 (Zero autorizados)
    // -------------------------------------------------------------------------
    {
        let autorizadosCount = 0;
        let liaPendenteCount = 0;
        let optinPendenteCount = 0;
        let inelegiveisCount = 0;
        let bloqueadosCount = 0;
        let revisaoCount = 0;

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

            const decision = gate.evaluateActivation({
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

            if (decision.autorizado_para_ativacao) autorizadosCount++;
            if (decision.motivo_bloqueio === 'BLOQUEIO_LIA_B2B_PENDENTE') liaPendenteCount++;
            if (decision.motivo_bloqueio === 'BLOQUEIO_OPTIN_MEDICO_PENDENTE') optinPendenteCount++;
            if (decision.motivo_bloqueio === 'COMERCIALMENTE_INELEGIVEL') inelegiveisCount++;
            if (decision.motivo_bloqueio === 'SUPRESSAO_ATIVA' ||
                decision.motivo_bloqueio === 'QUARENTENA_AGENCIA_ATIVA' ||
                decision.motivo_bloqueio === 'SEM_ENDPOINT_VALIDO' ||
                decision.motivo_bloqueio === 'QUARENTENA_CONTINGENCIA_ATIVA') bloqueadosCount++;
            if (decision.motivo_bloqueio === 'REVISAO_HUMANA_OBRIGATORIA' ||
                decision.motivo_bloqueio === 'RESPOSTA_AUTOMATICA_PENDENTE_MANUAL' ||
                decision.motivo_bloqueio === 'ENCAMINHAMENTO_CLOSER_HUMANO') revisaoCount++;
        });

        assert.strictEqual(autorizadosCount, 0, 'Zero negócios autorizados');
        assert.strictEqual(inelegiveisCount, 192, 'Exatamente 192 comercialmente inelegíveis');
        assert.strictEqual(liaPendenteCount, 102, 'Exatamente 102 clínicas pendentes de LIA');
        assert.strictEqual(optinPendenteCount, 13, 'Exatamente 13 médicos pendentes de opt-in');
        assert.strictEqual(bloqueadosCount, 74, 'Exatamente 74 bloqueados');
        assert.strictEqual(revisaoCount, 24, 'Exatamente 24 em revisão humana');
        assert.strictEqual(inelegiveisCount + liaPendenteCount + optinPendenteCount + bloqueadosCount + revisaoCount, 405);
        pass('8. Classificação canónica dos 405 negócios 100% preservada na Fase B.8.1');
    }

    // -------------------------------------------------------------------------
    // TESTE 9: Dossiê de Homologação Externa gera estrutura de submissão completa
    // -------------------------------------------------------------------------
    {
        const templateClinica = buildDealHomologationTemplate({
            deal_id: 'deal_clinica_sample',
            nome_clinica: 'Clínica Odontológica Exemplo Lda',
            categoria_canonica: 'SILENCIO_CONFIRMADO',
            tipo_destinatario: 'ENTIDADE_COLECTIVA_CLINICA',
            canal_pretendido: 'WHATSAPP',
            telefone: '912345678'
        });

        assert.strictEqual(templateClinica.autorizado_para_disparo, false);
        assert.strictEqual(templateClinica.estado_dossie, 'PENDENTE_ANALISE_JURIDICA');
        assert.strictEqual(templateClinica.avaliacao_homologacao.homologado, false);
        assert.strictEqual(templateClinica.requisitos_pendentes.length > 0, true);
        assert.strictEqual(ESTRUTURA_DOSSIE_HOMOLOGACAO.RESTRICOES_CADENCIA.tentativas_maximas_por_ciclo, 2);
        pass('9. Módulo sdr_homologation_dossier gera templates estruturados e salvaguarda fail-closed');
    }

    console.log('\n==============================================================================');
    console.log('🎉 TODOS OS 9 TESTES DA FASE B.8.1 FORAM APROVADOS COM SUCESSO!');
    console.log('==============================================================================\n');
}

// Executar se chamado diretamente
if (process.argv[1]?.endsWith('test_sdr_phase_b8_1.mjs')) {
    runPhaseB81TestSuite().catch(err => {
        console.error('❌ ERRO NA SUITE DE TESTES B.8.1:', err);
        process.exit(1);
    });
}
