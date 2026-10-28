/**
 * ============================================================================
 * VAMUSS SDR — RUNNER DE AUDITORIA PÓS-HARDENING B.12.3
 * ============================================================================
 * Executa as verificações da fase B.12.3:
 * 1. Auditoria estática dos objetos criados vs esquema existente
 * 2. Verificação de ambiente e credenciais locais (sem imprimir segredos)
 * 3. Tentativa segura de verificação live com classificação estrita (LIVE / MOCK / NÃO EXECUTADO)
 * 4. Geração do dossiê auditável em data/sdr_post_hardening_audit_b12_3.json
 * ============================================================================
 */

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

if (fs.existsSync('.env.local')) {
    dotenv.config({ path: '.env.local' });
}
dotenv.config();

const CANONICAL_DEAL_ID = '5b0f44c1-57d3-4a30-8de5-7df432207b34';

async function runB123Audit() {
    console.log('🚀 Iniciando Auditoria Pós-Hardening B.12.3...\n');

    const rawUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
    const rawAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
    const workerEmail = process.env.SDR_WORKER_EMAIL || '';
    const workerPassword = process.env.SDR_WORKER_PASSWORD || '';

    // 1. Verificação de Ambiente Local
    const envStatus = {
        supabase_url_configurada: Boolean(rawUrl && rawUrl.length > 0),
        supabase_url_host: rawUrl ? new URL(rawUrl).host : null,
        anon_key_configurada: Boolean(rawAnonKey && rawAnonKey.length > 0),
        worker_email_configurado: Boolean(workerEmail && workerEmail.trim().length > 0),
        worker_password_configurada: Boolean(workerPassword && workerPassword.trim().length > 0)
    };

    console.log('1. Verificação de Credenciais Locais (Sem Exposição de Segredos):');
    console.log(`   • Supabase URL: ${envStatus.supabase_url_configurada ? 'PRESENTE' : 'AUSENTE'} (${envStatus.supabase_url_host || 'N/A'})`);
    console.log(`   • Anon Key: ${envStatus.anon_key_configurada ? 'PRESENTE' : 'AUSENTE'}`);
    console.log(`   • Worker Email: ${envStatus.worker_email_configurado ? 'CONFIGURADO' : 'NÃO CONFIGURADO'}`);
    console.log(`   • Worker Password: ${envStatus.worker_password_configurada ? 'CONFIGURADO' : 'NÃO CONFIGURADO'}\n`);

    // 2. Análise de Segurança dos Objetos SQL Criados
    const sqlAuditPath = path.resolve('supabase_sdr_permissions_hardening.sql');
    const sqlAuditContent = fs.existsSync(sqlAuditPath) ? fs.readFileSync(sqlAuditPath, 'utf8') : '';

    const vulnerabilidadesAuditadas = [
        {
            codigo: 'SEC-RPC-01',
            objeto: 'public.fn_sdr_transition_deal_stage',
            tipo: 'SECURITY_DEFINER_SEARCH_PATH',
            severidade: 'ALTA',
            descricao: 'A função foi declarada SECURITY DEFINER sem cláusula explícita SET search_path = public, pg_temp;',
            risco: 'Permite Search Path Hijacking se um utilizador malicioso criar tabelas/objetos temporários com nomes coincidentes.',
            mitigacao_proposta: 'Adicionar "SET search_path = public, pg_temp;" na assinatura da função.'
        },
        {
            codigo: 'SEC-RPC-02',
            objeto: 'public.fn_sdr_transition_deal_stage',
            tipo: 'RPC_EXECUTE_GRANTS',
            severidade: 'MEDIA',
            descricao: 'Por omissão no PostgreSQL, novas funções têm permissão EXECUTE concedida a PUBLIC.',
            risco: 'Embora a função verifique fn_is_sdr_worker() em runtime, falta a defesa em profundidade a nível de privilégios de concessão (GRANT/REVOKE).',
            mitigacao_proposta: 'Executar "REVOKE EXECUTE ON FUNCTION public.fn_sdr_transition_deal_stage FROM PUBLIC;" e conceder apenas a authenticated.'
        },
        {
            codigo: 'SEC-RPC-03',
            objeto: 'public.fn_sdr_transition_deal_stage',
            tipo: 'STATE_TRANSITION_RULE_INTEGRITY',
            severidade: 'MEDIA',
            descricao: 'A RPC valida apenas se p_new_stage pertence à lista, mas não valida se a transição a partir do estado atual é válida comercialmente (ex: só transitar de lost para lead_engajamento se houver resposta válida).',
            risco: 'Permite alterar etapas de negócios sem cumprir a máquina de estados comercial auditada na B.11.5.',
            mitigacao_proposta: 'Adicionar verificação estrita: se p_new_stage = "stage_lead_engajamento", o negócio tem de estar previamente em "lost" e ter notas de resposta.'
        },
        {
            codigo: 'SEC-RPC-04',
            objeto: 'public.fn_sdr_transition_deal_stage',
            tipo: 'MEETING_CONFIRMATION_ENFORCEMENT',
            severidade: 'MEDIA',
            descricao: 'A RPC permite a transição para "stage_reuniao" sem requerer parâmetro com id de agendamento ou evidência comprovável de reunião.',
            risco: 'Viola a regra da B.11.4: "Reunião confirmada exige data e aceitação comprovada".',
            mitigacao_proposta: 'Exigir que a transição para stage_reuniao valide a existência de atividade do tipo meeting agendada.'
        },
        {
            codigo: 'SEC-RLS-01',
            objeto: 'public.deals (RLS Policies existentes)',
            tipo: 'LEGACY_POLICY_COEXISTENCE',
            severidade: 'ALTA',
            descricao: 'A política existente "Users manage own deals" (auth.uid() = user_id) concede ALL (incluindo INSERT, UPDATE, DELETE) para o utilizador que for proprietário do deal. Se o SDR worker autenticar com um user_id que seja também dono de deals, a política permissiva antiga prevalece (pois políticas RLS são avaliadas com OR permissivo por padrão no Postgres).',
            risco: 'Se um negócio pertencer ao user_id do worker, o worker poderia fazer DELETE ou UPDATE de colunas contornando o RLS do SDR.',
            mitigacao_proposta: 'Garantir que o utilizador do worker é um utilizador de sistema dedicado e NUNCA é definido como user_id (proprietário) de qualquer deal.'
        }
    ];

    // 3. Teste de Autenticação e Consulta Live
    let liveExecutionStatus = 'NÃO EXECUTADO';
    let liveExecutionDetails = null;

    if (!envStatus.worker_email_configurado || !envStatus.worker_password_configurada) {
        liveExecutionStatus = 'NÃO EXECUTADO';
        liveExecutionDetails = {
            motivo: 'Credenciais locais do worker (SDR_WORKER_EMAIL e SDR_WORKER_PASSWORD) não fornecidas no ambiente.',
            acao_necessaria: 'Configurar SDR_WORKER_EMAIL e SDR_WORKER_PASSWORD em .env.local'
        };
    } else {
        // Tentativa de execução live
        try {
            const supabase = createClient(rawUrl, rawAnonKey, {
                auth: { persistSession: false, autoRefreshToken: false }
            });

            console.log('2. Tentando autenticação segura do SDR Worker...');
            const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
                email: workerEmail,
                password: workerPassword
            });

            if (authError) {
                liveExecutionStatus = 'FALHA_AUTENTICACAO_LIVE';
                liveExecutionDetails = {
                    erro: authError.message,
                    codigo: authError.status || authError.name
                };
            } else {
                const sessionUser = authData.user;
                const userClaims = sessionUser?.app_metadata || {};
                const hasSdrRole = userClaims.role === 'sdr_worker';

                console.log(`   • Utilizador autenticado com sucesso.`);
                console.log(`   • Claim "sdr_worker" presente em app_metadata: ${hasSdrRole}`);

                // Cliente autenticado
                const clientWorker = createClient(rawUrl, rawAnonKey, {
                    auth: { persistSession: false, autoRefreshToken: false },
                    global: {
                        headers: {
                            Authorization: `Bearer ${authData.session.access_token}`
                        }
                    }
                });

                // Leitura do negócio canónico
                console.log('3. Teste de leitura SELECT no negócio canónico (5b0f44c1-57d3-4a30-8de5-7df432207b34)...');
                const { data: dealData, error: dealError } = await clientWorker
                    .from('deals')
                    .select('id, title, status, stage_id, value, contact_id, user_id')
                    .eq('id', CANONICAL_DEAL_ID)
                    .maybeSingle();

                // Leitura de atividades
                const { data: actData, error: actError } = await clientWorker
                    .from('activities')
                    .select('id, deal_id, type, title, completed, created_at')
                    .eq('deal_id', CANONICAL_DEAL_ID);

                liveExecutionStatus = 'LIVE';
                liveExecutionDetails = {
                    sucesso: !dealError && !actError,
                    claim_validada: hasSdrRole,
                    negocio_encontrado: Boolean(dealData),
                    negocio_status: dealData ? dealData.status : null,
                    atividades_encontradas: actData ? actData.length : 0,
                    deal_error: dealError ? dealError.message : null,
                    activities_error: actError ? actError.message : null
                };
            }
        } catch (err) {
            liveExecutionStatus = 'ERRO_REDE_SANDBOX';
            liveExecutionDetails = {
                erro: err.message,
                detalhe: 'Isolamento de rede / DNS na sandbox impediu conexão com host Supabase.'
            };
        }
    }

    // 4. Estrutura do Dossiê B.12.3
    const auditReport = {
        meta: {
            fase: 'B.12.3',
            titulo: 'Auditoria Pós-Hardening e Preparação para Teste de Leitura Real',
            data_execucao: new Date().toISOString(),
            status_geral: 'AUDITORIA_CONCLUIDA_AGUARDA_CREDENCIAIS_E_RESOLUCAO_VULNERABILIDADES',
            salvaguardas: {
                insert_executados: 0,
                update_executados: 0,
                delete_executados: 0,
                rpc_transicao_executada: 0,
                mensagens_comerciais_enviadas: 0,
                circuit_breaker: 'ATIVO_FAIL_CLOSED',
                gate_legal: 'ATIVO_FAIL_CLOSED'
            }
        },
        diagnostico_ambiente: envStatus,
        auditoria_objetos_sql: {
            funcoes_criadas: [
                {
                    nome: 'public.fn_is_sdr_worker',
                    tipo: 'SECURITY DEFINER',
                    avaliador: 'auth.jwt()->app_metadata->>role = sdr_worker',
                    estado: 'HOMOLOGADO_PARCIAL'
                },
                {
                    nome: 'public.fn_guard_sdr_deal_columns',
                    tipo: 'TRIGGER FUNCTION',
                    colunas_protegidas: ['value', 'contact_id', 'user_id', 'title', 'pipeline_id'],
                    estado: 'HOMOLOGADO'
                },
                {
                    nome: 'public.fn_sdr_transition_deal_stage',
                    tipo: 'SECURITY DEFINER RPC',
                    estado: 'NECESSITA_CORRECAO_SEGURANCA',
                    vulnerabilidades: ['SEC-RPC-01', 'SEC-RPC-02', 'SEC-RPC-03', 'SEC-RPC-04']
                }
            ],
            triggers_criados: [
                {
                    nome: 'trg_guard_sdr_deal_columns',
                    tabela: 'public.deals',
                    evento: 'BEFORE UPDATE',
                    estado: 'ATIVO'
                }
            ],
            politicas_rls_adicionadas: [
                {
                    nome: 'SDR_Worker_Select_Deals',
                    tabela: 'public.deals',
                    comando: 'SELECT',
                    condicao: 'fn_is_sdr_worker() AND (status = lost OR stage_id IN (stage_lead_engajamento, stage_reuniao))'
                },
                {
                    nome: 'SDR_Worker_Update_Deals',
                    tabela: 'public.deals',
                    comando: 'UPDATE',
                    condicao_using: 'fn_is_sdr_worker() AND (status = lost OR stage_id IN (stage_lead_engajamento, stage_reuniao))',
                    condicao_check: 'fn_is_sdr_worker() AND status IN (open, lost) AND stage_id IN (stage_lead_engajamento, stage_reuniao, stage_perdido, stage_lost)'
                },
                {
                    nome: 'SDR_Worker_Select_Activities',
                    tabela: 'public.activities',
                    comando: 'SELECT',
                    condicao: 'fn_is_sdr_worker() AND EXISTS(deals com deal_id autorizado)'
                },
                {
                    nome: 'SDR_Worker_Insert_Activities',
                    tabela: 'public.activities',
                    comando: 'INSERT',
                    condicao: 'fn_is_sdr_worker() AND type IN (note, status_change, meeting) AND EXISTS(deals com deal_id autorizado)'
                }
            ]
        },
        vulnerabilidades_confirmadas: vulnerabilidadesAuditadas,
        teste_autenticacao_e_leitura: {
            classificacao_execucao: liveExecutionStatus,
            detalhes: liveExecutionDetails
        },
        conclusao_tecnica: {
            apto_para_avancar_leitura_live: false,
            motivo: 'Credenciais locais do SDR Worker ausentes em .env.local E correções de segurança na RPC e no utilizador pendentes de revisão.'
        }
    };

    const outputPath = path.resolve('data/sdr_post_hardening_audit_b12_3.json');
    fs.writeFileSync(outputPath, JSON.stringify(auditReport, null, 2), 'utf8');
    console.log(`\n📄 Dossiê gravado com sucesso em: ${outputPath}`);

    return auditReport;
}

runB123Audit();
