# DOSSIER DE DECISÃO JURÍDICA E OPERACIONAL — PILOTO SDR VAMUSS (FASE B.12.7)
**Documento Oficial de Avaliação e Desbloqueio do Gate Legal**
**Data de Emissão:** 12 de Outubro de 2026  
**Ambiente:** Supabase Produção (Modo Read-Only)  
**Estado dos Sistemas de Segurança:** Circuit Breaker em `FAIL-CLOSED` | Gate Legal em `FAIL-CLOSED`  

---

## 1. Resumo Executivo do Piloto Proposto

O objetivo deste primeiro piloto é validar a reativação consultiva do Sales Development Representative (SDR) da Vamuss através de um **micro-lote restrito de até 3 clínicas dentárias** em Portugal, sem qualquer automatismo descontrolado ou disparos em massa.

### Princípios Invioláveis do Piloto:
1. **Envio Estritamente Supervisionado**: Nenhuma mensagem será expedida sem aprovação humana prévia individual (associação única entre candidato, canal aprovado e mensagem revista).
2. **Canal Restrito a E-mail Institucional B2B**: O canal exclusivo deste piloto é o e-mail corporativo de pessoa coletiva (`geral@...` / `info@...`), excluindo comunicações por telemóvel/WhatsApp nesta fase.
3. **Mecanismo de Oposição Imediata (Opt-Out)**: Toda e qualquer comunicação conterá uma declaração inequívoca de recusa fácil e imediata.
4. **Janela Horária Legal**: Disparos unicamente entre as **09h00 e as 17h00** em dias úteis de Portugal continental (`Europe/Lisbon`).
5. **Circuit Breaker**: Bloqueio imediato se ocorrer qualquer falha no sistema de supressão ou rejeição cadastral.

---

## 2. Candidatos Selecionados e Canais Pretendidos

| Candidato | Deal ID | Contacto Registado | Canal Pretendido | Justificação Técnica do Canal |
| :--- | :--- | :--- | :--- | :--- |
| **C Clinic Leiria** | `2ee3b134-a111-4624-81b8-c9eef850b5ed` | CClinic - Clínica Médica e Medicina Dentária | E-mail Institucional: `geral@cclinic.pt` | Caixa corporativa de pessoa coletiva sob domínio próprio. Menor intrusividade que mensajaria móvel. |
| **DentalCare Lisboa** | `3c3fa28c-9d7d-43e9-9ec5-664508a1bb72` | Dentalcare Lisboa | E-mail Institucional: `info@dentalcarelisboa.com` | Endereço oficial da unidade clínica em Lisboa sob domínio corporativo próprio. |
| **Clínica Dentária Diniz Salgueiro** | `5b0f44c1-57d3-4a30-8de5-7df432207b34` | Diniz Salgueiro | E-mail Institucional: `geral@dinizsalgueiro.pt` | E-mail institucional de contacto geral de entidade médico-dentária registada. |

> **Nota de Salvaguarda sobre os restantes candidatos auditados:**
> - **Clínica Cortez** (`532cc40e-0f38-43a1-ab06-f13e451a12a0`): Mantida em espera (`AGUARDAR_INTERVALO`) até após **07/11/2026** (cumprimento cabal dos 60 dias de respiro comercial pós-encerramento em 08/09/2026).
> - **Dr. Jaime Guimarães** (`cbbd6a9e-9577-44d1-905b-9c671625d98a`): Mantido bloqueado (`AGUARDA_EVIDENCIA`) até saneamento de dados e desduplicação com o registo de pessoa coletiva *Bocca Clínica* (`geral@boccaclinica.com`).

---

## 3. Mensagens Revistas na Fase B.12.6

Todas as mensagens foram revistas para eliminar presunções infundadas de carência económica, dependência de seguros ou problemas de gestão da clínica, focando em questões abertas de baixo atrito em português europeu (pt-PT).

### Mensagem 1 — C Clinic Leiria
```text
Assunto: Medicina Dentária na CClinic — consultas particulares

Boa tarde à equipa da CClinic.

O meu nome é Philipe e contacto a vossa clínica em Leiria a respeito dos serviços de medicina dentária.

A Vamuss apoia clínicas em Portugal a estruturar sistemas de comunicação focados na atração de primeiras consultas para tratamentos particulares.

Gostaria de colocar uma questão simples: a atração de novas consultas particulares é uma prioridade na vossa gestão neste momento, ou a recomendação de pacientes tem sido suficiente para a capacidade da clínica?

Com os melhores cumprimentos,
Philipe Coelho | Vamuss
[Caso não pretenda receber futuros contactos institucionais da nossa parte, basta responder a este e-mail indicando "Parar" e os vossos dados serão imediatamente removidos.]
```

### Mensagem 2 — DentalCare Lisboa
```text
Assunto: Comunicação clínica da DentalCare Lisboa

Boa tarde à equipa da DentalCare Lisboa.

Contacto o vosso consultório a partir de Lisboa a respeito da área de medicina dentária.

Na Vamuss, ajudamos clínicas dentárias a melhorar a sua presença de pesquisa no Google para que pacientes que procuram tratamentos dentários encontrem diretamente a clínica.

Nesta fase, faz sentido para a DentalCare avaliar formas de aumentar o volume de contactos particulares através da internet, ou não é uma área que estejam a priorizar?

Com os melhores cumprimentos,
Philipe Coelho | Vamuss
[Caso não pretenda receber futuros contactos institucionais da nossa parte, basta responder a este e-mail indicando "Parar" e os vossos dados serão imediatamente removidos.]
```

### Mensagem 3 — Clínica Dentária Diniz Salgueiro
```text
Assunto: Captação de pacientes particulares — Clínica Diniz Salgueiro

Exma. equipa da Clínica Dentária Diniz Salgueiro,

Contacto-vos a respeito da área de medicina dentária da vossa clínica.

A Vamuss colabora com clínicas em Portugal na implementação de métodos para atrair pacientes particulares através de canais digitais, sem recurso a campanhas genéricas.

Na perspetiva da gestão da vossa clínica, o reforço da captação de pacientes particulares é um tema que pretendem explorar este ano, ou a vossa agenda já se encontra estabilizada?

Com os melhores cumprimentos,
Philipe Coelho | Vamuss
[Caso não pretenda receber futuros contactos institucionais da nossa parte, basta responder a este e-mail indicando "Parar" e os vossos dados serão imediatamente removidos.]
```

---

## 4. Fundamento Jurídico Proposto e Enquadramento Legal em Portugal

A avaliação jurídica das comunicações não solicitadas para fins de prospeção comercial B2B em Portugal rege-se pelos seguintes diplomas:
- **Lei n.º 41/2004, de 18 de agosto** (na sua redação atual conferida pela Lei n.º 46/2012 — Proteção de Dados nas Comunicações Eletrónicas);
- **Regulamento Geral sobre a Proteção de Dados (RGPD — Regulamento UE 2016/679)**;
- **Lei n.º 58/2019, de 8 de agosto** (Lei de Execução do RGPD em Portugal).

### 4.1. Enquadramento por Artigo Legal

1. **Artigo 13.º-A da Lei n.º 41/2004 (Comunicações para Pessoas Coletivas)**:
   - Em Portugal, o regime de comunicações não solicitadas por correio eletrónico dirigido a **pessoas coletivas** admite o envio sem consentimento prévio (*opt-in*), **desde que**:
     a) Seja concedida de forma clara e explícita a faculdade de recusa futura (*opt-out* fácil, gratuito e imediato em cada mensagem);
     b) A identidade do remetente e a natureza comercial da comunicação sejam transparentes e verídicas;
     c) O endereço do destinatário não conste da lista nacional de oposição (lista de restrição pública da DGC/CNPD) nem da lista interna de supressão da entidade.

2. **Artigo 6.º, n.º 1, alínea f) do RGPD (Interesse Legítimo)**:
   - O tratamento de eventuais dados profissionais de contacto associados à pessoa coletiva (ex.: domínio institucional de clínica) fundamenta-se no interesse legítimo da Vamuss em promover serviços B2B especializados de consultoria para o setor da saúde.
   - **Teste de Balanceamento (*Legitimate Interest Assessment - LIA*)**:
     - *Propósito*: Apresentação comercial de soluções de marketing médico-dentário dirigidas a empresas do setor.
     - *Necessidade*: Não existe meio menos intrusivo de apresentar o serviço institucional à direção clínica.
     - *Ponderação de Direitos*: O impacto na esfera de direitos dos visados é mínimo, tratando-se de caixa de correio geral corporativa de clínica médica (`geral@...` / `info@...`), com garantia expressa de interrupção imediata a pedido.

---

## 5. Análise de Riscos e Questões em Aberto

| Risco Identificado | Nível de Risco | Medida de Mitigação Implementada |
| :--- | :---: | :--- |
| **Confusão com Pessoa Singular** | Médio | Exclusão de números móveis pessoais neste lote piloto. Uso exclusivo de e-mails corporativos sob domínio institucional de pessoa coletiva. |
| **Classificação como Spam / Reputação de Domínio** | Baixo-Médio | Limitação estrita do lote a 3 envios manuais supervisionados. Sem uso de ferramentas massivas de cold mailing. |
| **Oposição de Contacto Não Processada** | Alto | Criação da tabela duradoura `sdr_suppression_list` e verificação fail-closed prévia a qualquer processamento. |
| **Envio Fora de Horário Laboral** | Baixo | Travão rígido operacional: envios unicamente entre as 09h00 e as 17h00 (fuso de Lisboa). |

---

## 6. Critérios de Decisão para Autorizar, Manter Bloqueado ou Rejeitar

| Estado de Decisão | Critérios Objetivos Necessários | Ação Operacional |
| :--- | :--- | :--- |
| **APROVADO PARA REVISÃO HUMANA FINAL** | 1. Natureza de pessoa coletiva comprovada documentalmente.<br>2. E-mail com domínio corporativo próprio testado.<br>3. Zero registos de oposição na lista de supressão.<br>4. Mensagem revista em pt-PT com cláusula de opt-out.<br>5. Parecer jurídico favorável ao fundamento sob a Lei 41/2004 Art. 13-A. | Habilita o candidato para duplo-clique de aprovação pelo Gestor Comercial. |
| **AGUARDA APROVAÇÃO LEGAL** | Candidato cumpre critérios técnicos e comerciais, mas carece da validação formal da base legal pela assessoria jurídica/DPO. | Envio estritamente travado pelo Gate Legal. |
| **AGUARDA EVIDÊNCIA** | Dados cadastrais ambíguos, duplicação de contacto ou incerteza quanto à natureza do titular (ex.: Dr. Jaime Guimarães). | Bloqueado até saneamento e prova documental no CRM. |
| **AGUARDAR INTERVALO** | Negócio com respiro comercial inferior a 60 dias desde a última alteração formal (ex.: Clínica Cortez). | Bloqueado cronologicamente até à data estipulada. |
| **SUPRIMIDO / NÃO ELEGÍVEL** | Pedido explícito de opt-out, desqualificação estrutural ou oposição expressa. | Bloqueio permanente em `public.sdr_suppression_list`. |

---

## 7. Procedimento Operacional de Execução Supervisionada (Checklist de Envio)

Se e quando o Gate Legal for formalmente desbloqueado para este lote, **cada disparo unitário** terá de obedecer à seguinte sequência sequencial:

```text
[CHECKPOINT 1] Validação Legal Específica
               └── Confirmação de parecer formal para o par (Candidato, Canal E-mail).
[CHECKPOINT 2] Consulta em Tempo Real à Lista de Supressão
               └── SELECT id FROM public.sdr_suppression_list WHERE contact_id = ? AND estado = 'ativo';
               └── Se encontrado ou erro de base de dados: ABORTA IMEDIATAMENTE (Fail-Closed).
[CHECKPOINT 3] Verificação da Janela Horária Legal
               └── Confirmação de dia útil e hora local (09:00:00 <= hora <= 16:59:59 em Europe/Lisbon).
[CHECKPOINT 4] Dupla Aprovação Humana Individual
               └── O Gestor Comercial revê a caixa do destinatário e o texto integral final.
[CHECKPOINT 5] Disparo Unitário Manual / Supervisionado
               └── Envio via cliente institucional configurado, com registo simultâneo no CRM.
[CHECKPOINT 6] Auditoria e Registo de Timeline
               └── INSERT INTO public.activities com tipo 'email' e cópia da mensagem enviada.
```

---

## 8. Métricas e Monitorização Factual do Piloto

Para o lote restrito de até 3 contactos autorizados, o acompanhamento far-se-á com rigor factual absoluto, sem sobreposições conceituais:

1. **Mensagens Efetivamente Enviadas**: Contagem exata de disparos concluídos com sucesso via SMTP (máximo 3).
2. **Entregabilidade / Bounces**: Verificação de entrega na caixa do destinatário vs. devoluções (bounces rígidos ou suaves).
3. **Respostas Inbound Recebidas**: Contagem de respostas que chegam à caixa institucional da Vamuss.
4. **Classificação das Respostas**:
   - *Positiva com Interesse*: Interlocutor expressa interesse em entender o modelo (`Lead de Engajamento`).
   - *Negativa / Oposição*: Interlocutor pede paragem ou recusa abordagem (`Supressão Permanente`).
   - *Ambígua*: Resposta neutra sem interesse comprovado (`Mantém Lost`).
5. **Conversas Qualificadas**: Trocas de mensagens onde o interlocutor confirma a especialidade prioritária da clínica.
6. **Reuniões Efetivamente Confirmadas**: Apenas reuniões com link Google Meet emitido e convite de calendário formalmente aceite (status `open`, etapa `stage_reuniao`, **nunca `won`**).

---

## 9. Responsáveis pela Aprovação Formal

| Papel | Responsável Designado | Âmbito de Aprovação Exigido |
| :--- | :--- | :--- |
| **Responsável Jurídico / DPO** | *A designar pela Direção Vamuss* | Aprovação formal da base legal B2B sob a Lei 41/2004 e texto da cláusula de opt-out. |
| **Gestor Comercial / Diretor de Operações** | Philipe Coelho | Aprovação individual de envio para cada um dos 3 e-mails revistos. |

---

## 10. Decisões Pendentes para Abertura do Piloto

Para que o primeiro piloto controlado possa iniciar a sua operação física, são necessárias exatamente duas decisões:

1. **Decisão Jurídica**: Validar formalmente a utilização do fundamento de legítimo interesse B2B (Lei 41/2004, Art. 13.º-A) para envio às caixas institucionais de `geral@cclinic.pt`, `info@dentalcarelisboa.com` e `geral@dinizsalgueiro.pt`.
2. **Decisão Comercial**: O Gestor Comercial emitir o despacho de autorização unitária para o disparo manual supervisionado das 3 mensagens revistas.
