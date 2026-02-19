# SINCRONIZAÇÃO DE E-MAIL — ESPECIFICAÇÃO FUNCIONAL (BASE PIPEDRIVE)

## OBJETIVO
Implementar no CRM um recurso de Sincronização de E-mail que permita conectar contas de e-mail dos usuários para visualizar, enviar, receber, rastrear e associar mensagens automaticamente a contatos, leads e negócios, exatamente conforme descrito na base de conhecimento oficial do Pipedrive.

==================================================
## 1) CONCEITO GERAL
==================================================

A sincronização de e-mail permite que o CRM:
• Leia e-mails enviados e recebidos da conta do usuário
• Exiba esses e-mails dentro do CRM
• Associe automaticamente e-mails a Pessoas, Organizações, Leads e Negócios
• Permita envio de e-mails sem sair do CRM

O recurso é INDIVIDUAL por usuário (cada usuário conecta suas próprias contas).

==================================================
## 2) MODOS DE SINCRONIZAÇÃO
==================================================

Existem DOIS modos suportados:

1. **Sincronização completa de e-mail**
   • Conexão direta com o provedor do usuário
   • Sincroniza e-mails enviados e recebidos
   • Permite resposta e envio direto pelo CRM

2. **Smart BCC**
   • Usuário adiciona um endereço BCC exclusivo do CRM
   • O CRM grava o e-mail enviado manualmente
   • Não há leitura da caixa de entrada

Ambos os modos associam e-mails a contatos e negócios.

==================================================
## 3) PROVEDORES DE E-MAIL COMPATÍVEIS
==================================================

O sistema DEVE aceitar qualquer provedor que suporte:

• IMAP (SSL)
• Exchange / ActiveSync
• OAuth (quando disponível)

Provedores oficialmente compatíveis incluem:
• Gmail / Google Workspace
• Outlook.com / Hotmail
• Microsoft 365 / Office 365
• Microsoft Exchange
• Yahoo Mail
• iCloud
• AOL
• Fastmail
• Zoho
• GoDaddy
• Namecheap
• Bluehost
• Zimbra
• Contas personalizadas via IMAP

==================================================
## 4) CONFIGURAÇÃO DA CONTA DE E-MAIL
==================================================

**Caminho:**
Configurações pessoais > Sincronização de e-mail

**Fluxo:**
1. Adicionar nova conta de e-mail
2. Escolher provedor ou IMAP personalizado
3. Autorizar acesso (OAuth ou credenciais)
4. Definir opções de sincronização
5. Salvar e iniciar sincronização

==================================================
## 5) OPÇÕES DE SINCRONIZAÇÃO
==================================================

Usuário pode configurar:
• Sincronizar todos os e-mails OU apenas pastas/labels específicas
• Sincronizar e-mails enviados
• Arquivar automaticamente e-mails no CRM
• Excluir e-mails no CRM quando excluídos no provedor
• Ativar rastreamento de abertura e cliques
• Escolher associação automática ou manual

==================================================
## 6) ASSOCIAÇÃO DE E-MAILS
==================================================

**Regras:**
• Associação baseada no endereço de e-mail
• Se existir uma Pessoa com o e-mail → associar
• Se existir Negócio aberto da Pessoa → associar também ao Negócio

**Configuração:**
• Associação automática (padrão)
• Associação manual (usuário escolhe)

Se houver múltiplos negócios ativos:
• O sistema pode solicitar confirmação manual

==================================================
## 7) CAMPOS VAZIOS (REGRA CRÍTICA)
==================================================

• Campo vazio NÃO gera associação
• Campo vazio NÃO gera duplicata
• Apenas campos preenchidos entram na lógica de vínculo

==================================================
## 8) BLOQUEIO DE ENDEREÇOS
==================================================

Usuário pode bloquear:
• Endereço de e-mail específico
• Domínio inteiro (ex: *@empresa.com)

**Regras:**
• Bloqueio só funciona se o remetente bloqueado for o ÚNICO remetente
• Se houver outro remetente válido em CC, o e-mail não é bloqueado

==================================================
## 9) ENDEREÇOS ALTERNATIVOS (SMART BCC)
==================================================

• Por padrão, apenas o e-mail principal do usuário é autorizado
• Usuário pode adicionar endereços alternativos
• Cada endereço alternativo deve ser confirmado via e-mail
• Apenas endereços confirmados podem usar Smart BCC

==================================================
## 10) MÚLTIPLAS CONTAS DE E-MAIL
==================================================

O sistema deve permitir múltiplas contas por usuário, conforme plano:

• Plano básico: 1 conta
• Planos avançados: múltiplas contas

**Funcionalidades:**
• Visualizar e-mails de todas as contas
• Filtrar por conta específica

==================================================
## 11) ENVIO DE E-MAIL PELO CRM
==================================================

Usuário pode:
• Enviar e-mails diretamente do CRM
• Responder e-mails sincronizados
• Escolher abrir no cliente externo ou no CRM
• Usar assinatura configurada

==================================================
## 12) PERMISSÕES E VISIBILIDADE
==================================================

• E-mails são privados por padrão
• Visibilidade depende das permissões do CRM
• Usuários só veem e-mails que têm permissão para ver

==================================================
## 13) LIMITAÇÕES IMPORTANTES
==================================================

• O CRM NÃO edita e-mails no provedor
• O CRM NÃO cria e-mails automaticamente
• O CRM NÃO associa dados se não houver correspondência clara
• O CRM apenas LÊ, EXIBE e ASSOCIA

==================================================
## RESUMO FINAL
==================================================

A sincronização de e-mail deve:
• Ser confiável
• Respeitar permissões
• Não criar dados falsos
• Não inferir associações sem base
• Seguir estritamente IMAP / Exchange / OAuth
