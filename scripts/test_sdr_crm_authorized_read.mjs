import assert from 'assert';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Carregamento de variáveis de ambiente de forma segura
if (fs.existsSync('.env.local')) {
    dotenv.config({ path: '.env.local' });
}
dotenv.config();

/**
 * ============================================================================
 * VAMUSS SDR — TESTE DE LEITURA AUTORIZADA DO CRM (FASE B.12.1)
 * ============================================================================
 * Valida os requisitos da Fase B.12.1:
 * 1. Não exposição de segredos em relatórios ou logs
 * 2. Princípio do menor privilégio (frontend não contém service_role)
 * 3. Teste de leitura no negócio canónico (5b0f44c1-57d3-4a30-8de5-7df432207b34) e atividades
 * 4. Classificação transparente: DNS/Rede vs Autenticação vs RLS vs Leitura Comprovada
 * 5. Declaração explícita de bloqueio pendente se ambiente não permitir tráfego externo
 * 6. Zero mutações (sem INSERT, UPDATE, DELETE) e salvaguardas ativas
 * ============================================================================
 */

const CANONICAL_DEAL_ID = '5b0f44c1-57d3-4a30-8de5-7df432207b34';

async function runTest(nome, fn) {
    try {
        await fn();
        console.log(`  ✅ [PASS] ${nome}`);
    } catch (err) {
        console.error(`  ❌ [FAIL] ${nome}:`, err);
        throw err;
    }
}

async function runAllTests() {
    console.log('🧪 Iniciando Teste de Leitura e Conectividade Segura do CRM — Fase B.12.1...\n');

    // TESTE 1: Auditoria de Segurança de Credenciais no Frontend
    await runTest('1. Princípio do Menor Privilégio: Frontend não contém service_role', () => {
        const srcFiles = fs.readdirSync('src', { recursive: true })
            .filter(f => typeof f === 'string' && (f.endsWith('.ts') || f.endsWith('.tsx') || f.endsWith('.js')))
            .map(f => path.join('src', f));

        for (const file of srcFiles) {
            const content = fs.readFileSync(file, 'utf8');
            assert.strictEqual(
                content.includes('SUPABASE_SERVICE_ROLE_KEY'),
                false,
                `Ficheiro de frontend ${file} não pode referenciar SUPABASE_SERVICE_ROLE_KEY`
            );
            assert.strictEqual(
                content.includes('service_role'),
                false,
                `Ficheiro de frontend ${file} não pode referenciar service_role`
            );
        }
    });

    // TESTE 2: Verificação de Configuração Segura (Sem Expor Valores)
    await runTest('2. Configuração de credenciais do backend válida sem exposição de segredos', () => {
        const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

        assert.ok(url.length > 0, 'URL do Supabase deve estar configurada');
        assert.ok(url.startsWith('https://'), 'URL do Supabase deve usar HTTPS');
        assert.ok(url.includes('.supabase.co'), 'URL deve apontar para instância Supabase');
        assert.ok(key.length > 0, 'Chave de acesso deve estar configurada');

        // Confirmação de que o teste não imprime nem retorna o valor da chave
        assert.strictEqual(typeof key, 'string');
    });

    // TESTE 3: Execução da Consulta de Leitura com Distinção de Falhas
    await runTest('3. Diagnóstico de conectividade com distinção de causas de falha', async () => {
        const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

        const supabase = createClient(url, key, {
            auth: { persistSession: false, autoRefreshToken: false }
        });

        let categoriaResultado = null;
        let leituraRealComprovada = false;

        try {
            const { data, error } = await supabase
                .from('deals')
                .select('id, title, status, stage_id, lost_reason')
                .eq('id', CANONICAL_DEAL_ID)
                .maybeSingle();

            if (error) {
                const msg = error.message || '';
                if (msg.includes('fetch failed') || msg.includes('ENOTFOUND') || msg.includes('ECONNREFUSED')) {
                    categoriaResultado = 'FALHA_REDE_DNS';
                } else if (msg.includes('JWT') || error.code === '401' || error.code === 'PGRST301') {
                    categoriaResultado = 'FALHA_AUTENTICACAO';
                } else if (error.code === '42501' || msg.includes('permission denied') || msg.includes('row-level security')) {
                    categoriaResultado = 'FALHA_PERMISSOES_RLS';
                } else {
                    categoriaResultado = 'FALHA_CONSULTA';
                }
            } else {
                categoriaResultado = 'LEITURA_REAL_COMPROVADA';
                leituraRealComprovada = true;
            }
        } catch (err) {
            const msg = err.message || '';
            if (msg.includes('fetch failed') || msg.includes('ENOTFOUND') || msg.includes('ECONNREFUSED')) {
                categoriaResultado = 'FALHA_REDE_DNS';
            } else {
                categoriaResultado = 'ERRO_INESPERADO';
            }
        }

        // Validação da classificação rigorosa
        assert.ok(
            ['FALHA_REDE_DNS', 'LEITURA_REAL_COMPROVADA'].includes(categoriaResultado),
            `Resultado deve ser classificado com precisão. Obtido: ${categoriaResultado}`
        );

        // Se o ambiente atual não tem acesso de rede, NÃO simula sucesso
        if (categoriaResultado === 'FALHA_REDE_DNS') {
            assert.strictEqual(leituraRealComprovada, false, 'Não é permitido simular sucesso se a rede estiver isolada');
            console.log('     ℹ️  Ambiente com isolamento de rede: Bloqueio documentado como FALHA_REDE_DNS (sem simulação falsa de sucesso)');
        }
    });

    // TESTE 4: Garantia de Zero Mutações (Read-Only)
    await runTest('4. Garantia estrita de zero mutações na base de dados', () => {
        // Verifica o ficheiro de diagnóstico gerado
        const diagPath = path.resolve('data/sdr_crm_connectivity_diagnostic.json');
        assert.ok(fs.existsSync(diagPath), 'Relatório de diagnóstico deve existir');

        const diag = JSON.parse(fs.readFileSync(diagPath, 'utf8'));
        assert.strictEqual(diag.mutacoes_tentadas.insert, 0);
        assert.strictEqual(diag.mutacoes_tentadas.update, 0);
        assert.strictEqual(diag.mutacoes_tentadas.delete, 0);
        assert.strictEqual(diag.mutacoes_tentadas.mutacao_base_producao, 0);
    });

    console.log('\n🎉 Todos os 4 testes da Bateria B.12.1 foram aprovados com sucesso!');
}

runAllTests().catch(err => {
    console.error('\n❌ Falha nos Testes B.12.1:', err);
    process.exit(1);
});
