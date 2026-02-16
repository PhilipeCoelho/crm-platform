# CHECKLIST DE IMPLEMENTAÇÃO - INSIGHTS CORRIGIDO

## ✅ CONCLUÍDO

### 1. Estrutura do Menu
- [x] Remover "Insights de Campanhas"
- [x] Remover "Configurações de Insights"
- [x] Manter apenas: Painéis, Relatórios, Metas
- [x] Alterar subtítulo para "Visualizador de dados do CRM"

## 🔄 EM ANDAMENTO

### 2. ReportBuilder (PRIORIDADE MÁXIMA)

#### 2.1 Fluxo Rígido
- [ ] Passo 1: Escolher FONTE (obrigatório)
  - Negócios, Leads, Atividades, E-mails, Produtos, Campanhas, Contatos
  
- [ ] Passo 2: Sistema LIMITA automaticamente
  - Métricas disponíveis (baseado na fonte)
  - Filtros disponíveis (baseado na fonte)
  - Gráficos disponíveis (baseado na fonte)

- [ ] Passo 3: Usuário configura dentro dos limites
  - Seleciona métricas (apenas as permitidas)
  - Aplica filtros (apenas os permitidos)
  - Escolhe visualização (apenas as permitidas)

#### 2.2 Validações Obrigatórias
- [ ] Validar métricas por fonte
- [ ] Validar filtros por fonte
- [ ] Validar visualizações por fonte
- [ ] Validar combinações de dados (apenas as permitidas)

#### 2.3 UI - Habilitar/Desabilitar
- [ ] Métricas desabilitadas mostram tooltip explicativo
- [ ] Filtros desabilitados mostram tooltip explicativo
- [ ] Visualizações desabilitadas mostram tooltip explicativo

### 3. Mapeamento de Métricas por Fonte

#### Negócios
- [ ] Quantidade de negócios
- [ ] Valor total
- [ ] Valor médio
- [ ] Taxa de conversão
- [ ] Duração média do ciclo
- [ ] Negócios ganhos
- [ ] Negócios perdidos
- [ ] Negócios abertos

#### Leads
- [ ] Quantidade de leads
- [ ] Taxa de conversão (lead → negócio)
- [ ] Leads por origem
- [ ] Leads convertidos
- [ ] Leads não convertidos

#### Atividades
- [ ] Quantidade de atividades
- [ ] Atividades por tipo
- [ ] Atividades concluídas
- [ ] Atividades atrasadas
- [ ] Taxa de conclusão

#### E-mails
- [ ] Quantidade de e-mails
- [ ] Taxa de abertura
- [ ] Taxa de clique
- [ ] E-mails por usuário

#### Produtos
- [ ] Quantidade de produtos vendidos
- [ ] Receita por produto
- [ ] Produto mais vendido

#### Campanhas
- [ ] Leads gerados
- [ ] Taxa de conversão
- [ ] ROI de campanha

#### Contatos
- [ ] Quantidade de contatos
- [ ] Contatos por organização
- [ ] Contatos ativos

### 4. Mapeamento de Filtros por Fonte

#### Negócios
- [ ] Período (criação, fechamento)
- [ ] Pipeline
- [ ] Etapa
- [ ] Proprietário
- [ ] Status (ganho, perdido, aberto)
- [ ] Valor (range)

#### Leads
- [ ] Período
- [ ] Origem
- [ ] Proprietário
- [ ] Status (convertido, não convertido)

#### Atividades
- [ ] Período
- [ ] Tipo (reunião, chamada, tarefa, e-mail)
- [ ] Status (concluída, atrasada, futura)
- [ ] Proprietário

#### E-mails
- [ ] Período
- [ ] Remetente
- [ ] Status (enviado, aberto, clicado)

#### Produtos
- [ ] Período
- [ ] Categoria
- [ ] Preço (range)

#### Campanhas
- [ ] Período
- [ ] Tipo
- [ ] Status

#### Contatos
- [ ] Período
- [ ] Organização
- [ ] Proprietário

### 5. Mapeamento de Visualizações por Fonte

#### Negócios
- [ ] Gráfico de barras
- [ ] Gráfico de linha
- [ ] Funil
- [ ] Scorecard
- [ ] Tabela

#### Leads
- [ ] Gráfico de barras
- [ ] Gráfico de pizza
- [ ] Funil
- [ ] Scorecard

#### Atividades
- [ ] Gráfico de barras
- [ ] Gráfico de linha
- [ ] Scorecard
- [ ] Tabela

#### E-mails
- [ ] Gráfico de barras
- [ ] Scorecard
- [ ] Tabela

#### Produtos
- [ ] Gráfico de barras
- [ ] Gráfico de pizza
- [ ] Scorecard
- [ ] Tabela

#### Campanhas
- [ ] Gráfico de barras
- [ ] Scorecard
- [ ] Tabela

#### Contatos
- [ ] Gráfico de barras
- [ ] Scorecard
- [ ] Tabela

### 6. Dados Combinados (Restritos)

#### Permitido
- [ ] Negócios + Atividades
- [ ] Negócios + Produtos
- [ ] Leads + Campanhas
- [ ] Contatos + Organizações

#### Proibido (validar e bloquear)
- [ ] Leads + Produtos
- [ ] E-mails + Forecast
- [ ] Contatos + Receita direta
- [ ] Qualquer outra combinação

### 7. Painéis (Dashboards)

- [ ] Painel = Container de relatórios
- [ ] Não cria métricas próprias
- [ ] Não filtra dados independentemente
- [ ] Filtros apenas reaplicam filtros dos relatórios

### 8. Metas

- [ ] Tipos fixos: Receita, Negócios ganhos, Atividades, Leads convertidos
- [ ] Períodos fixos: Mensal, Trimestral, Anual
- [ ] Responsável: Usuário ou Equipe
- [ ] Cálculo: (Realizado / Alvo) * 100

### 9. Exportação

- [ ] Ação contextual dentro de relatórios
- [ ] Respeita filtros ativos
- [ ] Respeita permissões do usuário
- [ ] Formatos: CSV, XLS

## 📝 PRÓXIMOS PASSOS

1. **Implementar ReportBuilder corrigido**
   - Criar mapeamentos de métricas/filtros/visualizações por fonte
   - Implementar validações
   - Implementar UI com habilitação/desabilitação

2. **Testar fluxo completo**
   - Criar relatório de cada fonte
   - Validar que métricas/filtros/visualizações estão corretos
   - Validar que combinações proibidas são bloqueadas

3. **Ajustar ReportCard**
   - Garantir que apenas exibe dados
   - Não permite edição de dados do CRM

4. **Ajustar DashboardsView**
   - Garantir que é apenas container
   - Não cria métricas próprias

5. **Ajustar GoalsView**
   - Garantir tipos fixos
   - Garantir períodos fixos
   - Garantir cálculo correto

---

**REGRA DE OURO:**
Insights é um VISUALIZADOR RESTRITO, não um BI genérico.
Apenas leitura, agregação e comparação.
Sem criação, edição ou exclusão de dados do CRM.
