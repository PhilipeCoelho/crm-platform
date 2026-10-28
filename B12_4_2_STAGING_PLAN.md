# PLANO DE PREPARAÇÃO E HOMOLOGAÇÃO EM STAGING — FASE B.12.4.2
## Arquitetura de Isolamento, Esquema de Banco e Instruções de Execução

---

### 1. Diagnóstico do Ambiente e Necessidade de Staging

A auditoria à configuração revelou que **não existe atualmente um projeto Supabase de staging independente** configurado no ambiente local (apenas a instância de produção `ueildehrskvsonnlegtx.supabase.co` está presente em `.env.local`).

Em estrito cumprimento do princípio de proteção de dados:
- **É estritamente proibido realizar testes de escrita em produção.**
- **É estritamente proibido copiar dados pessoais reais para ambientes de teste.**
- Os testes de staging devem ser executados em infraestrutura dedicada com **dados sintéticos artificiais**.

---

### 2. Opções de Staging Real para Homologação

#### Opção A: Criar um Projeto Supabase Staging Dedicado (Recomendado na Nuvem)
1. Aceder ao painel Supabase e criar um projeto gratuito: `vamuss-crm-staging`.
2. Obter o URL do projeto e a chave anónima.
3. Adicionar ao `.env.local`:
   ```bash
   STAGING_SUPABASE_URL="https://seu-staging-id.supabase.co"
   STAGING_SUPABASE_ANON_KEY="sua-chave-anon-staging"
   ```
4. Executar no SQL Editor do projeto de staging:
   - Esquema base: [`supabase_schema.sql`](file:///Users/philipecoelho/Documents/Projects/crm-platform/supabase_schema.sql)
   - Tabela de supressão: [`supabase_sdr_suppression_migration.sql`](file:///Users/philipecoelho/Documents/Projects/crm-platform/supabase_sdr_suppression_migration.sql)
   - Função e triggers de segurança: [`supabase_sdr_permissions_hardening.sql`](file:///Users/philipecoelho/Documents/Projects/crm-platform/supabase_sdr_permissions_hardening.sql)
   - Migração corrigida da RPC: [`supabase_sdr_staging_migration_b12_4_2.sql`](file:///Users/philipecoelho/Documents/Projects/crm-platform/supabase_sdr_staging_migration_b12_4_2.sql)

#### Opção B: PostgreSQL Local Descartável via Docker
1. Iniciar container Docker PostgreSQL 16:
   ```bash
   docker run --name pg-staging-vamuss -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres:16
   ```
2. Adicionar ao `.env.local`:
   ```bash
   STAGING_POSTGRES_URL="postgresql://postgres:postgres@localhost:5432/postgres"
   ```
3. Aplicar as migrações SQL sintéticas e rodar a suíte de testes de integração.

---

### 3. Esquema Factual Validado (Sem a Coluna `updated_at` em Deals)

A auditoria comprovou que na tabela `deals` do CRM:
- As colunas existentes são: `id`, `user_id`, `contact_id`, `title`, `value`, `priority`, `stage_id`, `status`, `expected_date`, `created_at`, `won_at`, `lost_at`, `lost_reason`, `pipeline_id`, `position`.
- **A coluna `updated_at` NÃO EXISTE em `deals`.**
- O arquivo [`supabase_sdr_staging_migration_b12_4_2.sql`](file:///Users/philipecoelho/Documents/Projects/crm-platform/supabase_sdr_staging_migration_b12_4_2.sql) corrige este defeito, atualizando exclusivamente `stage_id`, `status` e `lost_at`.

---

### 4. Bateria de Testes de Integração Pronta para Execução no Staging

O script [`scripts/test_sdr_b12_4_2_staging_integration.mjs`](file:///Users/philipecoelho/Documents/Projects/crm-platform/scripts/test_sdr_b12_4_2_staging_integration.mjs) está configurado para executar 15 cenários de integração assim que o endpoint de staging estiver configurado:

1. Transição legítima com inbound real e preservação de colunas.
2. Atividade inbound inexistente (Rollback total).
3. Atividade de outro negócio (Rollback total).
4. Atividade outbound apresentada como inbound (Rollback total).
5. Atividade sem notas ou evidência suficiente (Rollback total).
6. Silêncio e respostas ambíguas (Rejeição sem reativação).
7. Recusa com registo de supressão atómico.
8. Falha na escrita de supressão provoca Rollback da transação.
9. Rejeição absoluta de status `won`.
10. Proposta de reunião bloqueada por ausência de conector Google Calendar.
11. Chamador sem claim `sdr_worker` bloqueado com erro 42501.
12. Tentativa de alteração direta de colunas financeiras bloqueada pelo trigger.
13. Erros provocam rollback integral antes/depois.
14. Idempotência perante repetições.
15. Bloqueio pré-envio no dispatcher para contactos suprimidos.
