# GUIA OPERACIONAL: CONFIGURAÇÃO DA META WHATSAPP BUSINESS CLOUD API (VAMUSS SDR)

**Objetivo:** Estabelecer a integração oficial entre o CRM Vamuss e a WhatsApp Business Platform (Cloud API v20.0 da Meta) sem intermediários não oficiais, mantendo a operação da agência segura e ininterrupta.

---

## 1. Contexto Importante sobre o Número Atual da Vamuss

A Vamuss utiliza atualmente a **aplicação WhatsApp Business no telemóvel**.

> [!WARNING]
> ### Alerta Crítico sobre a Migração de Números
> - A arquitetura da Meta **não permite** que o mesmo número de telefone funcione em simultâneo na aplicação móvel (telemóvel) e na WhatsApp Business Cloud API.
> - Se o número atual for registado na Cloud API, a aplicação no telemóvel **é desativada imediatamente** e o atendimento passa a depender a 100% da API/CRM.
> - **Recomendação Estratégica da Vamuss:** **NÃO migre o número do telemóvel nesta fase**. Inicie a integração utilizando o **Número de Teste Oficial da Meta** (Sandbox) para validar os fluxos, webhooks e respostas sem qualquer impacto no atendimento diário da agência. Posteriormente, para produção, poderá associar um número virtual ou secundário dedicado ao SDR.

---

## 2. Passo a Passo de Configuração no Meta Developers

### Passo 1: Aceder ao Meta for Developers
1. Aceda a [developers.facebook.com](https://developers.facebook.com/) e inicie sessão com a conta profissional da Vamuss.
2. Certifique-se de que a conta está associada ao **Meta Business Portfolio** da Vamuss (antigo Business Manager).

### Passo 2: Criar ou Configurar a Aplicação Meta
1. No menu superior, clique em **Os Meus Apps (My Apps)** > **Criar App (Create App)**.
2. Selecione o tipo de aplicação: **Outro (Other)** > Seguinte > **Empresa (Business)**.
3. Defina o nome do App (ex.: `Vamuss CRM SDR`) e associe a sua conta empresarial.
4. No painel de produtos da app, localize **WhatsApp** e clique em **Configurar (Set up)**.

### Passo 3: Obter Credenciais Iniciais com o Número de Teste
Na secção **WhatsApp > Introdução (Getting Started)**:
1. A Meta disponibiliza de imediato:
   - Um **Identificador do número de telefone (Phone Number ID)** de teste.
   - Um **Identificador da conta empresarial do WhatsApp (WhatsApp Business Account ID - WABA ID)**.
   - Um **Token de Acesso Temporário (Temporary Access Token)** válido por 24 horas.
2. Na secção *"Para (To)"*, adicione o número do seu telemóvel pessoal como destinatário de teste autorizado (a Meta enviará um código SMS/WhatsApp de confirmação de 5 dígitos).
3. Teste o envio do template modelo `hello_world` diretamente no botão do painel da Meta para confirmar que recebe a mensagem no seu telemóvel.

### Passo 4: Gerar Token Permanente de Sistema (System User Token)
*O token temporário expira em 24h. Para operação contínua, crie um Utilizador de Sistema:*
1. Aceda ao [Meta Business Suite / Configurações do Negócio](https://business.facebook.com/settings).
2. No menu lateral, aceda a **Utilizadores > Utilizadores do Sistema (System Users)** > **Adicionar**.
3. Crie um utilizador com a função **Administrador**.
4. Clique em **Adicionar Ativos (Add Assets)** e atribua a Aplicação e a Conta WhatsApp criadas, concedendo controlo total.
5. Clique em **Gerar Novo Token (Generate New Token)**, selecione a App e marque as seguintes permissões essenciais:
   - `whatsapp_business_messaging`
   - `whatsapp_business_management`
6. Copie o token gerado e guarde-o num cofre seguro (ele não volta a ser exibido).

### Passo 5: Configurar o Webhook de Receção de Mensagens
1. No painel da App em *developers.facebook.com*, aceda a **WhatsApp > Configuração (Configuration)**.
2. No campo **URL de Retorno de Chamada (Callback URL)**, insira:
   ```text
   https://seu-dominio.com/api/webhooks/whatsapp
   ```
   *(Em ambiente de teste local, pode utilizar uma URL segura gerada pelo ngrok ou túnel Cloudflare, ex.: `https://abc-123.ngrok-free.app/api/webhooks/whatsapp`)*.
3. No campo **Token de Verificação (Verify Token)**, introduza a chave definida no seu ambiente:
   ```text
   vamuss_sdr_webhook_verify_2026
   ```
4. Clique em **Verificar e Salvar**. O backend do CRM responderá com o `hub.challenge` validando a conexão instantaneamente.
5. Em **Campos do Webhook**, clique em **Gerenciar (Manage)** e subscreva o evento:
   - `messages` (ativa a receção de mensagens e confirmações de entrega).

---

## 3. Configuração das Variáveis de Ambiente no Servidor

No ficheiro `.env` da raiz do projeto (ou no painel da Vercel / ambiente de produção), configure as seguintes chaves:

```env
# ============================================================================
# META WHATSAPP BUSINESS CLOUD API (OFICIAL)
# ============================================================================
WHATSAPP_ACCESS_TOKEN="EAA..."                 # Token permanente de System User
WHATSAPP_PHONE_NUMBER_ID="106..."              # ID do número (Teste ou Produção)
WHATSAPP_BUSINESS_ACCOUNT_ID="102..."          # WABA ID da Vamuss
WHATSAPP_WEBHOOK_VERIFY_TOKEN="vamuss_sdr_webhook_verify_2026"
WHATSAPP_APP_SECRET="a1b2c3..."                # App Secret (em Painel da App > Configurações > Básico)
```

---

## 4. Teste Controlado de Envio e Receção

Após configurar as variáveis:

1. **Verificar Estado no CRM:**
   - Aceda ao painel **SDR Vamuss** no CRM.
   - O indicador superior mudará de `App Móvel (Preparação)` para `Cloud API Ativa (Operacional)`.
2. **Teste de Envio:**
   - Pode disparar um teste via endpoint `POST /api/whatsapp/send` apontando para o seu número autorizado:
   ```bash
   curl -X POST http://localhost:3001/api/whatsapp/send \
     -H "Content-Type: application/json" \
     -d '{
       "phone": "351910000000",
       "templateName": "hello_world"
     }'
   ```
3. **Teste de Receção e Opt-Out:**
   - Responda à mensagem no WhatsApp escrevendo `PARAR`.
   - O webhook capturará o evento, o CRM identificará a palavra-chave e inserirá o contacto automaticamente na tabela duradoura `public.sdr_suppression_list`.

---

## 5. Como o SDR Funciona Enquanto a Configuração Não Estiver Concluída

Enquanto a Meta Cloud API não estiver configurada com tokens de produção:
1. **O SDR Opera a 100% em Modo de Preparação**:
   - Acede em tempo real aos negócios do CRM.
   - Analisa o histórico e calcula os 30 dias de respiro.
   - Gera mensagens consultivas em português europeu (pt-PT).
   - Permite rever, editar e aprovar mensagens internamente.
2. **Cópia Manual Supervisionada**:
   - O operador utiliza o botão **"Copiar Mensagem"** ou **"Abrir no WhatsApp"** para enviar a mensagem através do WhatsApp Business no telemóvel da agência.
   - Esta ação não cria registos fictícios nem contorna as salvaguardas de conformidade.
