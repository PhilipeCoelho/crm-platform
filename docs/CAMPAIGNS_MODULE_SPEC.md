# SISTEMA CAMPAIGNS OPERACIONAL - ESPECIFICAÇÃO TÉCNICA

Este documento detalha a implementação do sistema de campanhas de e-mail marketing integrado ao CRM.

## ARQUITETURA GERAL
- **Frontend**: React (Vite)
- **Backend API**: Node.js (Express)
- **Banco de Dados**: PostgreSQL (Supabase)
- **Fila de Processamento**: Redis + Bull
- **Provedor de E-mail**: SendGrid / AWS SES (via SMTP ou API)
- **Armazenamento**: Supabase Storage / AWS S3

---

## MÓDULO 1: AUTENTICAÇÃO E PERMISSÕES
**Objetivo**: Garantir segurança no envio de campanhas.

### Backend
- **Middleware JWT**: Verificar token em todas as rotas protegidas.
- **Roles**:
  - `admin`: Acesso total.
  - `manager`: Criar/editar campanhas, ver estatísticas próprias.
  - `viewer`: Apenas visualizar.
- **2FA (Autenticação de Dois Fatores)**:
  - Obrigatório para acessar rotas de criação/envio de campanhas (`POST /campaigns`).
  - Endpoints:
    - `POST /auth/2fa/setup`: Gera segredo e QR Code (Google Authenticator).
    - `POST /auth/2fa/verify`: Valida código e ativa `two_factor_enabled`.

### Banco de Dados
- Tabela `users` (extensão da tabela auth do Supabase ou nova tabela de perfil):
    - `two_factor_enabled`: boolean
    - `two_factor_secret`: text (criptografado)
    - `role`: text ('admin', 'manager', 'viewer')

---

## MÓDULO 2: GERENCIAMENTO DE REMETENTES
**Objetivo**: Cadastrar e verificar identidades de envio.

### Backend
- **Endpoints**:
    - `POST /senders`: Cria remetente (não verificado). Gera token e envia e-mail.
    - `GET /senders/verify/:token`: Valida o token e marca `is_verified=true`.
    - `GET /senders`: Lista remetentes do usuário/organização.
- **Validação**: SPF/DKIM (instruções visuais), blacklist de domínios.

### Banco de Dados
- Tabela `senders`:
    - `id`: uuid
    - `name`: text
    - `email`: text
    - `user_id`: uuid
    - `is_verified`: boolean
    - `verification_token`: text
    - `created_at`: timestamp

---

## MÓDULO 3: LISTAS DE CONTATOS
**Objetivo**: Segmentar audiência para campanhas.

### Backend
- **Endpoints**:
    - `POST /lists`: Cria lista.
    - `POST /lists/:id/import`: Importação via CSV (processamento em streaming/lote).
    - `GET /lists/:id/contacts`: Listagem paginada.
    - `POST /lists/:id/segment`: Aplica filtros dinâmicos na base de contatos.

### Banco de Dados
- Tabela `contact_lists`:
    - `id`: uuid
    - `name`: text
    - `filters_json`: jsonb (para segmentos dinâmicos)
- Tabela `list_contacts` (link contatos-lista):
    - `list_id`: uuid
    - `contact_id`: uuid
    - `status`: text ('subscribed', 'unsubscribed', 'bounced')

---

## MÓDULO 4: TEMPLATES DE E-MAIL
**Objetivo**: Criação visual de e-mails.

### Backend
- **Editor**: Integração com bibliotecas como React Email ou Unlayer.
- **Endpoints**:
    - `POST /templates`: Salva JSON do editor e HTML renderizado.
    - `POST /upload/image`: Upload para S3/Supabase Storage.
    - `POST /templates/render`: Endpoint para preview.

### Banco de Dados
- Tabela `email_templates`:
    - `id`: uuid
    - `name`: text
    - `html_content`: text
    - `json_content`: jsonb
    - `thumbnail_url`: text
    - `is_public`: boolean

---

## MÓDULO 5: CRIAÇÃO E ENVIO DE CAMPANHAS
**Objetivo**: Orquestrar o envio em massa.

### Backend
- **Status da Campanha**: `draft` -> `scheduled` -> `sending` -> `sent` / `paused`.
- **Fila (Redis + Bull)**:
    - Job `send-campaign-email`: Processa um lote ou único e-mail.
    - Renderização do template via Handlebars (`{{name}}`, `{{company}}`).
    - Inserção de Pixel de Rastreamento e Links Trackeados.
- **Rate Limiting**: Controle de vazão (ex: 1000 emails/hora).
- **Endpoints**:
    - `POST /campaigns/:id/send`: Enfileira jobs.
    - `POST /campaigns/:id/schedule`: Configura job agendado (Cron).

### Banco de Dados
- Tabela `campaigns`:
    - `status`: text
    - `scheduled_at`: timestamp
    - `sent_count`: int
    - `opened_count`: int
    - `clicked_count`: int

---

## MÓDULO 6: TRACKING E ESTATÍSTICAS
**Objetivo**: Monitorar engajamento em tempo real.

### Backend
- **Tracking Pixel**: Rota `GET /track/open/:eventId` retorna GIF 1x1 transparente e registra abertura.
- **Tracking Links**: Rota `GET /track/click/:eventId?url=...` registra clique e redireciona.
- **Webhooks**: Receber eventos do SendGrid (Bounce, Spam Report).
- **Analytics**: Agregação de dados para dashboard.

### Banco de Dados
- Tabela `email_events`:
    - `campaign_id`: uuid
    - `contact_id`: uuid
    - `event_type`: text ('open', 'click', 'bounce', 'spam')
    - `user_agent`: text
    - `ip`: text
    - `link_url`: text
    - `created_at`: timestamp

---

## MÓDULO 7: ALERTAS E NOTIFICAÇÕES
**Objetivo**: Avisar usuário sobre problemas ou conclusões.

### Funcionalidades
- Alertas para **Bounce Rate** alto (>5%).
- Notificação de conclusão de envio.
- Alertas de verificação pendente.

---

## MÓDULO 8: COMPLIANCE (LGPD/GDPR)
**Objetivo**: Respeitar normas de privacidade.

### Funcionalidades
- **Unsubscribe**: Link obrigatório no footer.
- **Fluxo**:
    - `GET /unsubscribe/:token`: Marca status na lista como `unsubscribed`.
    - Página de feedback ("Por que você está saindo?").
- **Double Opt-in** (Opcional): E-mail de confirmação para novos inscritos.

---

## MÓDULO 9: AUTOMAÇÃO (Cadência)
**Objetivo**: Sequências automáticas baseadas em gatilhos.

### Backend
- **Triggers**:
    - `contact_added_to_list`
    - `deal_stage_changed`
- **Engine**: Listener de eventos do CRM que dispara jobs na fila.

---

## PLANO DE IMPLEMENTAÇÃO IMEDIATA

1.  **Backend Setup**: Inicializar projeto Node.js robusto em `/server` com TypeScript.
2.  **Database**: Criar migrações SQL para as novas tabelas (`contact_lists`, `list_contacts`, `email_events`, etc).
3.  **Queue**: Configurar Redis e Bull para processamento assíncrono.
4.  **SendGrid Integration**: Configurar envio real via API.

