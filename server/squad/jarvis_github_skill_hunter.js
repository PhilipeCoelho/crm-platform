/**
 * server/squad/jarvis_github_skill_hunter.js
 * ============================================================================
 * JARVIS — SKILL HUNTER DO GITHUB (AUTO-EVOLUÇÃO CONTÍNUA)
 * ============================================================================
 * Capacita o Jarvis a pesquisar repositórios no GitHub, extrair frameworks
 * de ponta em RevOps, B2B Outbound e Agentic Sales, sintetizá-los e adaptá-los
 * para a realidade da Agência Vamuss (Clínicas Dentárias e Estética em Portugal).
 * ============================================================================
 */

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

function getSupabaseClient() {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
    if (!supabaseUrl || !supabaseKey) return null;
    return createClient(supabaseUrl, supabaseKey);
}

/**
 * Pesquisa repositórios no GitHub focados em metodologias comerciais e skills de IA.
 * @param {string} query Termo de pesquisa (ex: 'b2b sales outbound', 'cold outreach prompts')
 * @param {number} limit Máximo de repositórios
 */
export async function searchGitHubSalesSkills(query = 'b2b sales outbound skills', limit = 5) {
    try {
        const encoded = encodeURIComponent(query);
        const url = `https://api.github.com/search/repositories?q=${encoded}&sort=stars&order=desc&per_page=${limit}`;
        
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Vamuss-Jarvis-HeadOfSales',
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (!response.ok) {
            throw new Error(`GitHub API HTTP ${response.status}: ${await response.text()}`);
        }

        const data = await response.json();
        return (data.items || []).map(repo => ({
            id: repo.id,
            fullName: repo.full_name,
            name: repo.name,
            stars: repo.stargazers_count,
            description: repo.description || 'Sem descrição',
            url: repo.html_url,
            defaultBranch: repo.default_branch || 'main'
        }));
    } catch (err) {
        console.error('❌ [Jarvis Skill Hunter] Erro ao pesquisar no GitHub:', err.message);
        return [];
    }
}

/**
 * Lê o conteúdo do README de um repositório do GitHub.
 * @param {string} repoFullName Ex: 'matteotitta/genesys-skills'
 * @param {string} branch Ex: 'main'
 */
export async function fetchRepositoryReadme(repoFullName, branch = 'main') {
    try {
        const url = `https://raw.githubusercontent.com/${repoFullName}/${branch}/README.md`;
        const res = await fetch(url, {
            headers: { 'User-Agent': 'Vamuss-Jarvis-HeadOfSales' }
        });

        if (res.ok) {
            return await res.text();
        }

        // Tentar branch master como fallback
        if (branch === 'main') {
            const fallbackRes = await fetch(`https://raw.githubusercontent.com/${repoFullName}/master/README.md`, {
                headers: { 'User-Agent': 'Vamuss-Jarvis-HeadOfSales' }
            });
            if (fallbackRes.ok) return await fallbackRes.text();
        }

        return null;
    } catch (err) {
        console.error(`❌ [Jarvis Skill Hunter] Erro ao obter README de ${repoFullName}:`, err.message);
        return null;
    }
}

/**
 * Jarvis sintetiza o conteúdo bruto do GitHub e adapta-o à Vamuss (Portugal, Dentistas + Estética).
 */
export async function synthesizeSkillForVamuss({ repoFullName, title, rawContent }) {
    if (!process.env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY necessária para sintetizar a skill.');
    }

    const systemPrompt = `
És o JARVIS, o Head of Sales IA Supremo da Agência Vamuss em Portugal.
A tua missão é analisar metodologias de vendas e RevOps encontradas no GitHub e transformá-las numa SKILL OFICIAL DA VAMUSS.

Regras de Adaptação à Vamuss:
1. Contexto: Clínicas Dentárias (Implantes, Invisalign, Reabilitação Oral) e Clínicas de Estética (Harmonização, Botox, Bioestimuladores) em Portugal.
2. Idioma: Português de Portugal estrito (ex: "contacto", "equipa", "registo", "diretor clínico").
3. Canal: Prospecção consultiva via WhatsApp (+351) e E-mail executivo.
4. Regras do Funil: Mensagens curtas (3 linhas), 1 pergunta desarmante, sem telemarketing robótico ("retiro o seu número"), e condução para o Cal.com de 20 min com o Philipe Coelho.
5. Formato: O output DEVE ser um arquivo Markdown (.md) válido com Frontmatter (name, description) e secções operacionais claras.
`.trim();

    const userPrompt = `
Analisa este conteúdo extraído do GitHub (${repoFullName}):
---
${rawContent.slice(0, 7000)}
---

Gera uma SKILL COMPLETA no formato:
---
name: [identificador-kebab-case]
description: [resumo em 1-2 linhas]
---

# [Nome da Skill] — [Subtítulo de Impacto]

## 1. Fundamento & Metodologia (Inspirado no repositório ${repoFullName})
...

## 2. Aplicação Prática para Clínicas em Portugal
...

## 3. Roteiros & Exemplos Práticos (Dentárias & Estética)
...

## 4. Instruções para o Jonh (Gerente de Operações) & SDRs
...
`;

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            temperature: 0.2
        })
    });

    if (!res.ok) {
        throw new Error(`OpenAI API Erro: ${res.statusText}`);
    }

    const json = await res.json();
    return json.choices?.[0]?.message?.content?.trim();
}

/**
 * Instala a nova skill sintetizada em .agent/skills/<skillId>/SKILL.md e regista no CRM.
 */
export async function installDiscoveredSkill({ skillSlug, skillMarkdown, sourceRepo }) {
    try {
        const targetDir = path.resolve(process.cwd(), '.agent', 'skills', skillSlug);
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }

        // Limpar possíveis blocos ```markdown envolventes
        let cleanMarkdown = (skillMarkdown || '').trim();
        cleanMarkdown = cleanMarkdown.replace(/^```[a-z]*\s*\n/i, '').replace(/\n```\s*$/i, '').trim();

        const filePath = path.join(targetDir, 'SKILL.md');
        fs.writeFileSync(filePath, cleanMarkdown, 'utf8');

        // Registar o evento de aprendizagem no Supabase
        const supabase = getSupabaseClient();
        if (supabase) {
            await supabase.from('sdr_learning').insert([{
                entry_type: 'RULE',
                title: `Nova Skill Importada do GitHub: ${skillSlug}`,
                content: {
                    skillSlug,
                    sourceRepo,
                    installedAt: new Date().toISOString(),
                    filePath: `.agent/skills/${skillSlug}/SKILL.md`
                },
                status: 'active',
                created_by: 'Jarvis (Head of Sales IA)'
            }]);
        }

        console.log(`✅ [Jarvis] Nova skill '${skillSlug}' instalada com sucesso a partir de ${sourceRepo}!`);
        return { success: true, filePath, skillSlug };
    } catch (err) {
        console.error('❌ [Jarvis] Erro ao instalar nova skill:', err.message);
        return { success: false, error: err.message };
    }
}

/**
 * Ciclo Completo do Jarvis: Pesquisa no GitHub, escolhe o melhor repositório, sintetiza e instala.
 */
export async function runJarvisSkillHuntingMission(topic = 'b2b sales outbound skills') {
    console.log(`\n🔎 [Jarvis] Iniciando Missão de Caça a Novas Skills no GitHub: "${topic}"...`);

    const repos = await searchGitHubSalesSkills(topic, 4);
    if (!repos || repos.length === 0) {
        return { success: false, reason: 'Nenhum repositório relevante encontrado.' };
    }

    // Selecionar o repositório com maior número de estrelas e conteúdo prático
    const bestRepo = repos[0];
    console.log(`⭐ [Jarvis] Repositório eleito: ${bestRepo.fullName} (${bestRepo.stars} estrelas)`);

    const readme = await fetchRepositoryReadme(bestRepo.fullName, bestRepo.defaultBranch);
    if (!readme || readme.length < 100) {
        return { success: false, reason: `README insuficiente no repositório ${bestRepo.fullName}` };
    }

    console.log(`🧠 [Jarvis] Sintetizando e adaptando framework para a Agência Vamuss...`);
    const skillMarkdown = await synthesizeSkillForVamuss({
        repoFullName: bestRepo.fullName,
        title: bestRepo.name,
        rawContent: readme
    });

    // Extrair o slug do frontmatter ou gerar a partir do nome
    const slugMatch = skillMarkdown.match(/name:\s*([a-z0-9_-]+)/i);
    const skillSlug = slugMatch ? slugMatch[1] : `github-${bestRepo.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;

    const installResult = await installDiscoveredSkill({
        skillSlug,
        skillMarkdown,
        sourceRepo: bestRepo.fullName
    });

    return {
        success: true,
        repo: bestRepo,
        skillSlug,
        installResult,
        preview: skillMarkdown.slice(0, 400) + '...'
    };
}
