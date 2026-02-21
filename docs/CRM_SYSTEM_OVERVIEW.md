# Documentação Completa do CRM Platform

## 1. Visão Geral do Projeto
O **CRM Platform** é um sistema de gestão de relacionamento com clientes inspirado no Pipedrive, focado em simplicidade visual e eficiência para times de vendas. O sistema é construído com uma arquitetura moderna, utilizando **React** no frontend e **Supabase** como Backend-as-a-Service (BaaS), complementado por um servidor **Node.js** para operações específicas de e-mail (IMAP/SMTP).

## 2. Tecnologias Utilizadas (Tech Stack)

### Frontend
- **Framework**: React 18 + Vite (Performance e DX)
- **Linguagem**: TypeScript (Segurança de tipos)
- **Estilização**: Tailwind CSS (Utilitários, Dark Mode nativo)
- **Ícones**: Lucide React
- **Gerenciamento de Estado**: React Context API (`CRMContext`, `AuthContext`)
- **Drag & Drop**: `@dnd-kit` (Kanban e Dashboard)
- **Gráficos**: Recharts

### Backend & Banco de Dados
- **Database**: Supabase (PostgreSQL)
- **Autenticação**: Supabase Auth (E-mail/Senha, Providers)
- **Armazenamento**: Supabase Storage (para anexos/avatares - planejado)
- **Middleware Server**: Node.js + Express
    - Responsável por conectar via IMAP a servidores de e-mail (Gmail, Outlook, Titan).
    - Biblioteca `imap` e `mailparser` para processamento de mensagens.
    - Biblioteca `nodemailer` para envio (SMTP).

## 3. Módulos e Funcionalidades

### 📊 Dashboard
Painel principal personalizável com widgets arrastáveis.
- **Métricas**: Valor total em funil, taxas de conversão, atividades pendentes.
- **Gráficos**: Visão de vendas por período.
- **Atividades**: Lista rápida de tarefas do dia.

### 💰 Pipeline de Vendas (Kanban)
O coração do sistema.
- **Visualização Kanban**: Cartões arrastáveis entre etapas.
- **Múltiplos Funis**: Suporte a diferentes processos de vendas.
- **Filtros**: Por proprietário, status (aberto, ganho, perdido) e data.
- **Criação Rápida**: Modal otimizado para adicionar Negócios + Contato + Empresa simultaneamente.

### 👥 Contatos e Empresas
Gestão de relacionamento.
- **Contatos**: Pessoas físicas. Vínculos com Múltiplos Negócios.
- **Empresas**: Organizações. Vínculo automático de contatos por domínio (planejado).
- **Enriquecimento**: Campos para redes sociais (LinkedIn, Instagram) e origem do lead.

### 📅 Atividades
Gestão de tarefas e agenda.
- **Tipos**: Ligação, E-mail, Reunião, Almoço, Tarefa.
- **Vínculos**: Associadas diretamente a Negócios ou Contatos.
- **Status**: Pendente, Concluído (com check visual).

### 📧 Email Inbox (Sales Inbox) - *Novo!*
Módulo de e-mail integrado para vendas (estilo Pipedrive).
- **Conexão IMAP/SMTP**: Suporte a qualquer provedor via configuração oAuth ou Senha de App.
- **Sincronização Bidirecional**: 
    - O servidor monitora a caixa de entrada real.
    - E-mails são salvos no banco de dados do CRM para histórico.
- **Threads**: Agrupamento de mensagens por conversa.
- **Status de Sync**: Feedback visual de "Sincronizando" e tratamento de erros de conexão.
- **Privacidade**: Controle de visibilidade de e-mails para o time.

### 📢 Campanhas de Marketing (WIP)
Módulo para disparo de e-mails em massa e automação.
- **Wizard**: Criação passo-a-passo de campanhas.
- **Templates**: Editor visual de e-mails.
- **Audiência**: Segmentação de contatos baseada em tags ou status.

## 4. Arquitetura de Dados (Database Schema)

O sistema roda sobre o PostgreSQL (Supabase). As principais tabelas são:

1.  **`profiles`**: Dados estendidos dos usuários (preferências, cargo).
2.  **`deals`**: Negócios. Campos: `value`, `stage_id`, `pipeline_id`, `status` (won/lost/open).
3.  **`contacts`**: Pessoas. Campos: `email`, `phone`, `marketing_status`.
4.  **`companies`**: Empresas. Campos: `domain`, `industry`.
5.  **`activities`**: Tarefas. Campos: `due_date`, `type`, `done`.
6.  **`pipelines`** & **`stages`**: Configuração dos funis de vendas.
7.  **`email_accounts`**: Credenciais (criptografadas ou tokens) e status de conexão IMAP.
8.  **`emails`**: Cópia local das mensagens sincronizadas. Campos: `subject`, `body_preview`, `is_read`, `folder`.

## 5. Instalação e Execução

Para rodar o projeto localmente (Ambiente de Desenvolvimento):

### Pré-requisitos
- Node.js 18+
- Conta no Supabase (com URL e Key configuradas)
- Arquivo `.env` na raiz com:
    ```
    VITE_SUPABASE_URL=...
    VITE_SUPABASE_ANON_KEY=...
    SMTP_HOST=... (Opcional, para envio sistêmico)
    ```

### Comandos
O projeto utiliza `concurrently` para rodar Frontend e Backend em um único terminal:

```bash
# Instalar dependências
npm install

# Iniciar Desenvolvimento (Vite + Server)
npm run dev
```

- **Frontend**: `http://localhost:5173`
- **Server API**: `http://localhost:3001`

### Scripts Disponíveis
- `npm run dev`: Inicia todo o ambiente.
- `npm run build`: Compila o frontend para produção.
- `npm run lint`: Verifica erros de código.

## 6. Status Atual e Próximos Passos
- **✅ Concluído**: Pipeline, Kanban, Gestão de Contatos/Empresas, Atividades, Autenticação, Setup de E-mail, Sync Inicial de E-mail.
- **🚧 Em Progresso**: Leitura detalhada de e-mail (View do corpo da mensagem), Envio de e-mails (Compose), Módulo de Campanhas.
- **📅 Planejado**: Automações de Workflow (Se Deal mover -> Criar Atividade), Relatórios Avançados (Insights).
