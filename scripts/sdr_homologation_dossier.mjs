/**
 * ============================================================================
 * VAMUSS SDR — DOSSIÊ DE HOMOLOGAÇÃO EXTERNA (FASE B.8.1)
 * ============================================================================
 * Estrutura documental de apoio à análise e decisão de conformidade jurídica
 * e regulamentar (RGPD, ePrivacy / DL 7/2004 e Diretrizes CNPD / Meta).
 *
 * REGRA INEGOCIÁVEL (FASE B.8.1):
 * - Este documento é uma MINUTA DE SUBMISSÃO PARA REVISÃO JURÍDICA.
 * - Não constitui parecer vinculativo, decisão homologada nem autorização de envio.
 * - A homologação legal só produz efeitos após validação formal por DPO ou
 *   Assessor Jurídico competente com cédula profissional e data identificadas.
 * - Uma LIA B2B favorável NUNCA autoriza automaticamente WhatsApp ou Email.
 * ============================================================================
 */

export const ESTRUTURA_DOSSIE_HOMOLOGACAO = Object.freeze({
    TITULO: 'DOSSIÊ DE AVALIAÇÃO DE CONFORMIDADE E HOMOLOGAÇÃO JURÍDICA B2B',
    VERSAO: '1.0.0-phase-b8-1-draft',
    ESTADO_DOCUMENTAL: 'SUBMETIDO_PARA_REVISAO_EXTERNA_PENDENTE',

    // 1. Entidade e Tipos de Destinatários
    TIPOS_DESTINATARIOS: {
        ENTIDADE_COLECTIVA_CLINICA: {
            descricao: 'Pessoas coletivas (sociedades comerciais ou entidades equiparadas) que exploram clínicas médicas e dentárias.',
            enquadramento: 'B2B institucional (NIF iniciado por 5).',
            regime_legal: 'Art. 6.º, n.º 1, al. f) RGPD conjugado com Art. 13.º-A do DL n.º 7/2004 (na redação da Lei n.º 46/2012).',
            requisito_primario: 'Avaliação de Legítimo Interesse (LIA B2B) formalmente homologada por jurista com teste tripartido.'
        },
        PESSOA_SINGULAR_MEDICO: {
            descricao: 'Profissionais liberais, médicos dentistas ou médicos em nome individual.',
            enquadramento: 'Pessoa singular / profissional liberal (NIF iniciado por 1 ou 2).',
            regime_legal: 'Art. 6.º, n.º 1, al. a) RGPD conjugado com Art. 13.º do DL n.º 7/2004.',
            requisito_primario: 'Consentimento prévio, expresso, informado e documentado (Opt-in explícito). Proibida abordagem com base exclusiva em LIA.'
        }
    },

    // 2. Finalidade Concreta do Contacto
    FINALIDADE_CONCRETA: {
        objeto: 'Comunicação comercial informativa B2B dirigida a órgãos de gestão e direção clínica.',
        conteudo: 'Apresentação de estudo de caso setorial sobre otimização da triagem de pacientes particulares e proposta de reunião exploratória de assessoria.',
        proibicoes: [
            'Proibida qualquer comunicação promocional de teor massivo ou genérico sem enquadramento específico na atividade da clínica.',
            'Proibida a recolha ou tratamento de dados de saúde de pacientes.',
            'Proibida a reutilização dos contactos para fins distintos do pipeline comercial VAMUSS.'
        ]
    },

    // 3. Avaliação de Legítimo Interesse (LIA B2B - Teste Tripartido)
    TESTE_TRIPARTIDO_LIA: {
        etapa_1_finalidade_purpose_test: {
            titulo: 'Teste da Finalidade (Purpose Test)',
            criterio: 'Existe um interesse comercial legítimo da VAMUSS na prossecução do contacto?',
            fundamentacao_proposta: 'A VAMUSS possui interesse legítimo na prossecução da sua atividade económica de assessoria a clínicas privadas de saúde, promovendo soluções de eficiência comercial junto de contrapartes que já manifestaram interesse anterior ou interagiram no CRM.',
            avaliacao_necessaria: 'O responsável jurídico deve confirmar a legitimidade económica e ausência de ilicitude do propósito comercial.'
        },
        etapa_2_necessidade_necessity_test: {
            titulo: 'Teste da Necessidade (Necessity Test)',
            criterio: 'O contacto direto via canal eletrónico é necessário e proporcional ao fim pretendido?',
            fundamentacao_proposta: 'O contacto eletrónico direto (WhatsApp Business / Email corporativo) constitui o meio padrão de comunicação B2B com gestores clínicos, sendo mais proporcional e menos invasivo do que visitas presenciais não solicitadas ou chamadas telefónicas intempestivas.',
            avaliacao_necessaria: 'O responsável jurídico deve validar se existem meios alternativos menos intrusivos com eficácia comparável.'
        },
        etapa_3_equilibrio_balancing_test: {
            titulo: 'Teste de Equilíbrio / Ponderação dos Direitos (Balancing Test)',
            criterio: 'Os interesses da VAMUSS prevalecem sobre os direitos, liberdades e expectativas razoáveis do titular?',
            fundamentacao_proposta: 'O destinatário é uma clínica e o contacto é estabelecido com base em interação histórica do CRM. As salvaguardas incluem: (i) mecanismo imediato e incondicional de STOP/Opt-out no primeiro contacto, (ii) limite de cadência estrito a 2 tentativas, (iii) firewall de supressão central e (iv) quarentena de 90 dias.',
            avaliacao_necessaria: 'O responsável jurídico deve ponderar se as expectativas razoáveis do titular são respeitadas e se as salvaguardas neutralizam o impacto nos seus direitos.'
        }
    },

    // 4. Requisitos Específicos por Canal
    REQUISITOS_CANAIS: {
        WHATSAPP_BUSINESS: {
            canal: 'WHATSAPP',
            alerta_estrito: 'Um parecer LIA B2B favorável NÃO autoriza automaticamente o canal WhatsApp. Exige autorização documental específica.',
            politica_aplicavel: 'Política Comercial e Política de Mensagens do WhatsApp Business (Meta).',
            requisitos_obrigatorios: [
                'Identificação clara e inequívoca da entidade remetente ("VAMUSS") na primeira linha da mensagem.',
                'Menção expressa de que se trata de uma comunicação B2B informativa.',
                'Instrução explícita e obrigatória de cancelamento: "Responda STOP ou SAIR para não voltar a ser contactado".',
                'Utilização exclusiva de número comercial verificado associado à conta VAMUSS Business.',
                'Processamento imediato e em tempo real (< 1 segundo) de qualquer pedido de oposição.'
            ]
        },
        EMAIL_B2B: {
            canal: 'EMAIL',
            alerta_estrito: 'Envio restrito a emails corporativos institucionais de clínicas coletivas.',
            requisitos_obrigatorios: [
                'Endereço de destino restrito a caixas institucionais de pessoas coletivas (ex.: geral@, clinica@, direcao@).',
                'Cabeçalho e rodapé com identificação fiscal completa da VAMUSS (Firma, NIF, Sede e Contactos).',
                'Ligação direta de desinscrição funcional e gratuita em rodapé (one-click opt-out).',
                'Menção à base legal e aos direitos de oposição, acesso e apagamento nos termos do RGPD.'
            ]
        }
    },

    // 5. Evidência de Opt-in para Pessoas Singulares (Médicos)
    REQUISITOS_OPTIN_MEDICOS: {
        exigencia: 'Prova documental rigorosa do consentimento prévio nos termos do Art. 13.º do DL 7/2004 e Art. 7.º do RGPD.',
        campos_obrigatorios_evidencia: [
            'referencia_opt_in: Identificador único do formulário ou submissão.',
            'data_opt_in: Carimbo de data/hora ISO 8601 da prestação do consentimento.',
            'origem_opt_in: URL do formulário, evento presencial ou registo documental.',
            'texto_clausula_consentimento: Texto exato que foi apresentado ao médico no momento da recolha.',
            'validador_opt_in_juridico: Responsável jurídico que verificou a validade material do consentimento.'
        ]
    },

    // 6. Restrições Operacionais e Cadência
    RESTRICOES_CADENCIA: {
        janela_horaria: 'Dias úteis das 10:00 às 18:00 (Fuso horário de Lisboa).',
        dias_autorizados: ['SEGUNDA', 'TERCA', 'QUARTA', 'QUINTA', 'SEXTA'],
        tentativas_maximas_por_ciclo: 2,
        intervalo_minimo_entre_tentativas_dias: 5,
        quarentena_pos_ciclo_sem_resposta_dias: 90,
        quarentena_agencia_concorrente_dias: 180,
        quarentena_contingencia_obras_dias: 90
    },

    // 7. Supressão e Proteção de Endpoints Partilhados
    SUPRESSAO_E_ENDPOINTS: {
        lista_supressao_estrita: '24 registos ativos abrangendo 26 negócios protegidos de forma permanente.',
        regra_endpoint_partilhado: 'Bloqueio preventivo de qualquer negócio cujo telefone ou email seja partilhado com registo em supressão.',
        tempo_resposta_supressao: 'Processamento imediato e bloqueio de novos envios no mesmo ciclo de execução.'
    },

    // 8. Governança e Campos de Homologação Formal
    CAMPOS_HOMOLOGACAO_RESPONSAVEL: {
        responsavel_homologacao_juridica: 'Nome do DPO ou Advogado responsável pela decisão.',
        cedula_profissional_ou_registo: 'Número de cédula na Ordem dos Advogados ou acreditação de DPO.',
        entidade_sociedade_juridica: 'Sociedade de Advogados ou departamento jurídico emitente.',
        referencia_processo: 'Código único do parecer (ex.: PROC-LIA-2026-VAMUSS-001).',
        data_decisao: 'Data formal de homologação.',
        validade_parecer_meses: 12,
        ambito_decisao: 'Lote delimitado de negócios e canais expressamente aprovados.',
        declaracao_responsabilidade: 'Confirmação expressa de que o responsável analisou as evidências e assume a validação da base legal.'
    }
});

/**
 * Gera um template de dossiê individual para uma clínica ou médico candidato
 */
export function buildDealHomologationTemplate(dealParams = {}) {
    const {
        deal_id,
        nome_clinica,
        categoria_canonica,
        tipo_destinatario = 'ENTIDADE_COLECTIVA_CLINICA',
        canal_pretendido = 'WHATSAPP',
        telefone = null,
        email = null
    } = dealParams;

    const isCollective = tipo_destinatario === 'ENTIDADE_COLECTIVA_CLINICA';

    return {
        deal_id,
        nome_clinica,
        categoria_canonica,
        tipo_destinatario,
        canal_pretendido,
        contacto: {
            telefone,
            email
        },
        estado_dossie: 'PENDENTE_ANALISE_JURIDICA',
        base_legal_proposta: isCollective
            ? 'Artigo 6.º, n.º 1, al. f) RGPD (LIA B2B) + Artigo 13.º-A DL 7/2004'
            : 'Artigo 6.º, n.º 1, al. a) RGPD (Opt-in Prévio) + Artigo 13.º DL 7/2004',
        requisitos_pendentes: isCollective
            ? [
                'Parecer formal de Avaliação de Legítimo Interesse (LIA B2B) emitido por jurista.',
                'Homologação de condições específicas para o canal pretendido.',
                'Confirmação de titularidade da entidade coletiva (NIF 5xx xxx xxx).'
            ]
            : [
                'Documentação comprovativa de consentimento explícito prévio.',
                'Verificação do registo e formulário de recolha do opt-in.',
                'Validação jurídica da cláusula de consentimento subscrita.'
            ],
        avaliacao_homologacao: {
            homologado: false,
            responsavel_homologacao: null,
            cedula_profissional: null,
            referencia_processo: null,
            data_homologacao: null,
            parecer_fundamentado: null
        },
        autorizado_para_disparo: false // Inegociável
    };
}
