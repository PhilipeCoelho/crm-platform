---
name: revops-follow-up-system
description: Sistema estruturado de Cadência e Follow-up Multicanal (WhatsApp, E-mail e Tarefas) para gestão de funil no CRM. Manual operacional de execução para o Jonh (Gerente de Operações).
license: MIT
metadata:
  version: 1.0.0
  source: kursku/skills (kit-510-ptbr/03-funis-vendas/follow-up-system)
  adapted_for: Jonh (RevOps Controller 24h - Vamuss)
---

# RevOps Follow-Up System — Cadência de Aceleração de Pipeline

Este manual estabelece as regras de cadência e transição de etapas para o **Jonh (Gerente Geral de Operações)**, garantindo que nenhum negócio estagne no CRM e que todos os leads recebam o acompanhamento no tempo correto.

---

## 1. As Janelas Temporais de Follow-Up (Regra dos Prazos)

O Jonh fiscaliza a passagem do tempo em cada etapa aberta do pipeline:

| Etapa no CRM | Prazo Máximo sem Resposta | Ação Imediata do Jonh |
| :--- | :--- | :--- |
| **Prospect** (`03f4795a-...`) | 24 horas após inserção | Libera Touch 1 consultivo (se estiver dentro do teto diário de 5-10 e horário de Lisboa). |
| **Lead (1 Msg Enviada)** | 48 a 72 horas | Se o lead não respondeu, aciona o **Ghosting Buster** (pergunta de Chris Voss + micro-áudio de quebra de padrão). |
| **Lead Engajado (Contacted)** | 24 horas | Se respondeu positivamente, aciona o **Closer** para agendamento direto no Cal.com do Philipe. |
| **Reunião Agendada** | 24h e 2h antes | Aciona o **Anti No-Show** para envio de lembrete de confirmação com link do Google Meet / Cal.com. |

---

## 2. A Cadência Multicanal em 3 Níveis

```mermaid
flowchart TD
    Lead["🎯 Prospect Elegível (9x)"] --> T1["📱 Touch 1 (Dia 1)\nWhatsApp Consultivo Curto (3 Linhas sem Jargão)"]
    
    T1 --> R1{"Respondeu em 48h?"}
    R1 -->|"SIM"| Engajado["🟢 Lead Engajado\nConduzir para Reunião de 20 min no Cal.com"]
    R1 -->|"NÃO"| T2["👻 Touch 2 (Dia 3 - Ghosting Buster)\nPergunta Negativa: 'Desistiram de estruturar a captação...?'"]
    
    T2 --> R2{"Respondeu em 72h?"}
    R2 -->|"SIM"| Engajado
    R2 -->|"NÃO"| T3["🎙️ Touch 3 (Dia 6)\nMicro-Áudio de Quebra de Padrão (6 a 12 seg)"]
    
    T3 --> R3{"Respondeu?"}
    R3 -->|"SIM"| Engajado
    R3 -->|"NÃO"| T4["🚪 Touch 4 (Dia 10 - Encerramento Elegante)\n'Entendo que o timing não é o ideal agora. Votos de sucesso!'"]
    
    T4 --> Lost["📁 Mover para Perdido (Reaquecimento em 90 dias)"]
```

---

## 3. As 3 Regras Invioláveis do Jonh no CRM

1. **Idempotência e Histórico Obrigatório**:
   * Toda e qualquer ação de follow-up (seja mensagem de WhatsApp, e-mail ou mudança de status) DEVE registrar um registro em `activities` (com status `completed`) e uma linha em `deal_logs`.
2. **Próximo Passo Ininterrupto**:
   * Um lead em aberto NUNCA pode ter zero atividades pendentes. Se uma atividade é concluída, a próxima deve ser agendada imediatamente com data e hora.
3. **Respeito aos Limites Anti-Bloqueio**:
   * O Jonh nunca força mais de 10 envios frios por dia e bloqueia qualquer disparo automático após as 18h00 ou em fins de semana em Portugal.
