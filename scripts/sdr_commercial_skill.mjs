import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const SKILL_FILE_PATH = path.join(ROOT_DIR, '.agent', 'skills', 'vamuss-sdr-commercial', 'SKILL.md');

/**
 * ============================================================================
 * VAMUSS SDR — CARREGADOR DA SKILL COMERCIAL ESPECIALIZADA
 * ============================================================================
 * Carrega e analisa a skill especializada em .agent/skills/vamuss-sdr-commercial/SKILL.md
 * disponibilizando as diretrizes comerciais e os 8 princípios ao agente GPT.
 * ============================================================================
 */
export class SDRCommercialSkillLoader {
    constructor(customSkillPath = null) {
        this.skillPath = customSkillPath || SKILL_FILE_PATH;
        this.rawContent = null;
        this.metadata = null;
        this.instructions = null;
        this._loadSkill();
    }

    _loadSkill() {
        if (!fs.existsSync(this.skillPath)) {
            throw new Error(`Arquivo da Skill não encontrado no caminho: ${this.skillPath}`);
        }

        const raw = fs.readFileSync(this.skillPath, 'utf8');
        this.rawContent = raw;

        // Extração de frontmatter YAML simples
        const frontmatterMatch = raw.match(/^---\s*([\s\S]*?)\s*---/);
        if (frontmatterMatch) {
            const yamlStr = frontmatterMatch[1];
            this.metadata = {};
            let currentKey = null;
            yamlStr.split('\n').forEach(line => {
                const trimmed = line.trim();
                if (!trimmed) return;
                const match = line.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/);
                if (match) {
                    currentKey = match[1];
                    let val = match[2].trim();
                    if (val === '>-' || val === '|' || val === '>') val = '';
                    this.metadata[currentKey] = val;
                } else if (currentKey && (line.startsWith('  ') || line.startsWith('\t'))) {
                    this.metadata[currentKey] = (this.metadata[currentKey] + ' ' + trimmed).trim();
                }
            });
            this.instructions = raw.replace(frontmatterMatch[0], '').trim();
        } else {
            this.metadata = { name: 'vamuss-sdr-commercial', description: 'SDR Comercial Especializado' };
            this.instructions = raw.trim();
        }
    }

    getSkillMetadata() {
        return this.metadata;
    }

    getInstructions() {
        return this.instructions;
    }

    /**
     * Retorna os 8 princípios fundamentais estruturados
     */
    getCorePrinciples() {
        return [
            { numero: 1, nome: 'Selecionar as empresas certas', foco: 'Clínicas privadas com potencial para tratamentos de alto valor' },
            { numero: 2, nome: 'Qualificar o interesse', foco: 'Distinguir curiosidade de intenção comercial real' },
            { numero: 3, nome: 'Encontrar o contacto certo', foco: 'Diferenciar receção de direção clínica/gestão' },
            { numero: 4, nome: 'Definir o próximo passo', foco: 'Avançar com um único objetivo claro e de baixo atrito' },
            { numero: 5, nome: 'Pesquisar o contexto', foco: 'Investigar website, especialidades e tecnologia antes de supor' },
            { numero: 6, nome: 'Planear as retomas (respiro comercial)', foco: 'Respeitar intervalo de 30 dias para leads arquivados' },
            { numero: 7, nome: 'Abrir com o problema do cliente', foco: 'Focar na oscilação de consultas e dependência de convenções' },
            { numero: 8, nome: 'Medir a conversão', foco: 'Acompanhar taxas de resposta, reabertura e reuniões no CRM' }
        ];
    }

    /**
     * Retorna o System Prompt de Alto Desempenho para inferência GPT
     */
    getSystemPrompt() {
        return `És o Sales Development Representative (SDR) Especializado da Agência Vamuss (Portugal).
A tua missão é interpretar oportunidades comerciais com inteligência de vendas, conduzir conversas consultivas e recuperar negócios perdidos do CRM, orientando-os até à Reunião de Diagnóstico de 20 minutos.

Diretrizes da Skill Comercial da Vamuss:
${this.instructions}

Princípios de Execução:
1. Responde sempre em português europeu (pt-PT) natural, elegante e profissional.
2. Não peças chamadas nem empurres reuniões no primeiro contacto de reaquecimento (objetivo é reaquecer com baixo atrito).
3. Não inventes dados da clínica, não presumas problemas de agenda sem evidência e não afirmes pesquisas não comprovadas.
4. Distingue rigorosamente Factos Comprovados de Hipóteses Comerciais e Lacunas de Informação.
5. Adapta a conversa dinamicamente: responde a dúvidas com transparência e NUNCA faças promessas financeiras infundadas (proibido formular estimativas arbitrárias de retorno sem dados comprovados de margens e custos).
6. Janela de envio: disparos permitidos estritamente de segunda a sexta das 09h00 às 17h00 Europe/Lisbon, exceto feriados nacionais portugueses.`;
    }

    /**
     * Estrutura de Métricas do CRM para Retroalimentação Comercial
     */
    calculatePerformanceMetrics(dealsQueue = []) {
        const total = dealsQueue.length;
        if (total === 0) {
            return {
                total_negocios_analisados: 0,
                taxa_resposta_inbound: '0%',
                taxa_reabertura_comercial: '0%',
                taxa_reunioes_marcadas: '0%',
                taxa_fecho_estimada: '0%',
                distribuicao_por_estrategia: {}
            };
        }

        const comResposta = dealsQueue.filter(d => d.status_fila === 'RECUPERADO_ENGAJAMENTO' || d.status_fila === 'RECUPERADO_REUNIAO_AGENDADA' || d.status_fila === 'ENCERRADO_RECUSADO').length;
        const reabertos = dealsQueue.filter(d => d.status_fila === 'RECUPERADO_ENGAJAMENTO' || d.status_fila === 'RECUPERADO_REUNIAO_AGENDADA').length;
        const reunioes = dealsQueue.filter(d => d.status_fila === 'RECUPERADO_REUNIAO_AGENDADA').length;

        return {
            total_negocios_analisados: total,
            total_com_resposta: comResposta,
            total_reabertos_engajamento: reabertos,
            total_reunioes_agendadas: reunioes,
            taxa_resposta_inbound: `${((comResposta / total) * 100).toFixed(1)}%`,
            taxa_reabertura_comercial: `${((reabertos / total) * 100).toFixed(1)}%`,
            taxa_reunioes_marcadas: `${((reunioes / total) * 100).toFixed(1)}%`,
            feedback_aprendizagem: {
                estrategias_mais_eficazes: ['REAQUECIMENTO_CONSULTIVO_BAIXO_ATRITO', 'PERGUNTA_ESTRATEGICA_PACIENTES_PARTICULARES'],
                motivo_principal_sucesso: 'Abordagens centradas na oscilação de faturamento e paciente de primeira consulta superam mensagens genéricas de Google/anúncios.'
            }
        };
    }
}
