# ESPECIFICAÇÃO TÉCNICA - INSIGHTS (CONFORME PDFs PIPEDRIVE)

## 1. ESTRUTURA DO MÓDULO

```
INSIGHTS (menu principal)
 ├── Painéis
 ├── Relatórios
 └── Metas
```

**NÃO EXISTE:**
- Configurações de Insights (como submenu)
- Insights de Campanhas (como submenu)
- Duplicatas (dentro de Insights)
- Exportações (como seção principal)

---

## 2. RELATÓRIOS - REGRAS ABSOLUTAS

### 2.1 FONTES DE DADOS (ÚNICAS E EXCLUSIVAS)

Cada relatório TEM UMA E APENAS UMA fonte:

1. **Negócios** (Deals)
2. **Leads**
3. **Atividades**
4. **E-mails**
5. **Produtos**
6. **Campanhas**
7. **Contatos**

### 2.2 MÉTRICAS POR FONTE

#### NEGÓCIOS
**Permitidas:**
- Quantidade de negócios
- Valor total
- Valor médio
- Taxa de conversão (ganhos/total)
- Duração média do ciclo
- Negócios ganhos
- Negócios perdidos
- Negócios abertos

**PROIBIDAS:**
- Métricas de produtos (sem combinação)
- Métricas de e-mails
- Métricas de atividades (sem combinação)

#### LEADS
**Permitidas:**
- Quantidade de leads
- Taxa de conversão (lead → negócio)
- Leads por origem
- Leads convertidos
- Leads não convertidos

**PROIBIDAS:**
- Valor (leads não têm valor)
- Produtos
- Receita

#### ATIVIDADES
**Permitidas:**
- Quantidade de atividades
- Atividades por tipo
- Atividades concluídas
- Atividades atrasadas
- Taxa de conclusão

**PROIBIDAS:**
- Valor de negócio
- Receita
- Produtos

#### E-MAILS
**Permitidas:**
- Quantidade de e-mails
- Taxa de abertura
- Taxa de clique
- E-mails por usuário

**PROIBIDAS:**
- Duração de negócio
- Valor
- Produtos

#### PRODUTOS
**Permitidas:**
- Quantidade de produtos vendidos
- Receita por produto
- Produto mais vendido

**PROIBIDAS:**
- Leads
- E-mails (sem relação)

#### CAMPANHAS
**Permitidas:**
- Leads gerados
- Taxa de conversão
- ROI de campanha

**PROIBIDAS:**
- Produtos diretos
- Atividades

#### CONTATOS
**Permitidas:**
- Quantidade de contatos
- Contatos por organização
- Contatos ativos

**PROIBIDAS:**
- Receita direta
- Valor de negócios (sem combinação)

### 2.3 DADOS COMBINADOS (RESTRITOS)

**PERMITIDO:**
- Negócios + Atividades
- Negócios + Produtos
- Leads + Campanhas
- Contatos + Organizações

**PROIBIDO:**
- Leads + Produtos
- E-mails + Forecast
- Contatos + Receita direta
- Qualquer combinação sem relacionamento no modelo de dados

### 2.4 FILTROS POR FONTE

#### NEGÓCIOS
- Período (criação, fechamento)
- Pipeline
- Etapa
- Proprietário
- Status (ganho, perdido, aberto)
- Valor (range)

#### LEADS
- Período
- Origem
- Proprietário
- Status (convertido, não convertido)

#### ATIVIDADES
- Período
- Tipo (reunião, chamada, tarefa, e-mail)
- Status (concluída, atrasada, futura)
- Proprietário

#### E-MAILS
- Período
- Remetente
- Status (enviado, aberto, clicado)

### 2.5 TIPOS DE VISUALIZAÇÃO POR FONTE

#### NEGÓCIOS
- Gráfico de barras (quantidade, valor)
- Gráfico de linha (tendência temporal)
- Funil (por etapa)
- Scorecard (total, média)
- Tabela

#### LEADS
- Gráfico de barras
- Gráfico de pizza (por origem)
- Funil (conversão)
- Scorecard

#### ATIVIDADES
- Gráfico de barras (por tipo, por usuário)
- Gráfico de linha (temporal)
- Scorecard
- Tabela

#### E-MAILS
- Gráfico de barras
- Scorecard (taxa de abertura)
- Tabela

---

## 3. PAINÉIS - REGRAS

### 3.1 DEFINIÇÃO
Painel = Container visual de relatórios existentes

### 3.2 COMPORTAMENTO
- NÃO cria métricas próprias
- NÃO filtra dados independentemente
- NÃO tem lógica de cálculo

### 3.3 FILTROS DE PAINEL
- Apenas reaplicam filtros dos relatórios
- Não criam novos filtros
- Respeitam limitações da fonte de cada relatório

### 3.4 ESTRUTURA
```
Painel
 ├── Nome
 ├── Descrição
 ├── Visibilidade (privado, equipe, todos)
 └── Relatórios (array de IDs)
```

---

## 4. METAS - REGRAS

### 4.1 TIPOS FIXOS
- Receita
- Negócios ganhos
- Atividades
- Leads convertidos

### 4.2 PERÍODOS FIXOS
- Mensal
- Trimestral
- Anual

### 4.3 RESPONSÁVEL
- Usuário individual
- Equipe

### 4.4 CÁLCULO
```
Meta
 ├── Tipo (fixo)
 ├── Período (fixo)
 ├── Valor alvo
 ├── Responsável
 └── Progresso = (Realizado / Alvo) * 100
```

### 4.5 VISUALIZAÇÃO
- Barra de progresso
- Percentual atingido
- Valor restante
- Tendência (se vai atingir ou não)

---

## 5. DUPLICATAS - ESCLARECIMENTO

### 5.1 ONDE ESTÁ
- NÃO está em Insights
- É um recurso de DADOS (módulo separado)

### 5.2 INSIGHTS APENAS EXIBE
- Impacto de duplicatas em relatórios
- Contagem (se houver)
- Mas NÃO resolve duplicatas

### 5.3 REGRAS
- Campo vazio NÃO conta como duplicata
- Apenas campos preenchidos
- Decisão SEMPRE manual

---

## 6. EXPORTAÇÃO

### 6.1 ONDE ESTÁ
- Dentro de relatórios (ação contextual)
- NÃO é submenu
- NÃO é seção principal

### 6.2 COMPORTAMENTO
- Respeita filtros ativos
- Respeita permissões do usuário
- Formatos: CSV, XLS

---

## 7. FLUXO DE CRIAÇÃO DE RELATÓRIO (IMPLEMENTAÇÃO)

```
1. Usuário clica "Criar Relatório"
2. Sistema exibe: "Escolha a fonte de dados"
   - Negócios
   - Leads
   - Atividades
   - E-mails
   - Produtos
   - Campanhas
   - Contatos

3. Usuário seleciona fonte (ex: Negócios)

4. Sistema LIMITA automaticamente:
   - Métricas: apenas as permitidas para Negócios
   - Filtros: apenas os permitidos para Negócios
   - Gráficos: apenas os permitidos para Negócios

5. Usuário configura:
   - Seleciona métricas (dentro do permitido)
   - Aplica filtros (dentro do permitido)
   - Escolhe visualização (dentro do permitido)

6. Sistema salva relatório

7. Relatório pode ser:
   - Visualizado individualmente
   - Adicionado a um painel
   - Exportado
```

---

## 8. VALIDAÇÕES OBRIGATÓRIAS

### 8.1 AO CRIAR RELATÓRIO
```typescript
if (fonte === 'atividades' && metrica.includes('valor')) {
  throw new Error('Atividades não podem ter métrica de valor');
}

if (fonte === 'leads' && metrica.includes('produto')) {
  throw new Error('Leads não podem ter métrica de produto');
}

if (fonte === 'emails' && metrica.includes('duracao')) {
  throw new Error('E-mails não podem ter métrica de duração');
}
```

### 8.2 AO COMBINAR DADOS
```typescript
const combinacoesPermitidas = [
  ['negocios', 'atividades'],
  ['negocios', 'produtos'],
  ['leads', 'campanhas'],
  ['contatos', 'organizacoes']
];

if (!combinacoesPermitidas.includes([fonte1, fonte2])) {
  throw new Error('Combinação de dados não permitida');
}
```

---

## 9. UI - REGRAS DE HABILITAÇÃO/DESABILITAÇÃO

### 9.1 SELEÇÃO DE MÉTRICAS
```typescript
// Exemplo: Fonte = Atividades
const metricasDisponiveis = [
  { id: 'count', label: 'Quantidade', enabled: true },
  { id: 'type', label: 'Por tipo', enabled: true },
  { id: 'value', label: 'Valor', enabled: false, reason: 'Atividades não têm valor' },
  { id: 'product', label: 'Produto', enabled: false, reason: 'Atividades não têm produto' }
];
```

### 9.2 SELEÇÃO DE FILTROS
```typescript
// Exemplo: Fonte = E-mails
const filtrosDisponiveis = [
  { id: 'period', label: 'Período', enabled: true },
  { id: 'sender', label: 'Remetente', enabled: true },
  { id: 'pipeline', label: 'Pipeline', enabled: false, reason: 'E-mails não têm pipeline' }
];
```

---

## 10. SCHEMA DE VALIDAÇÃO

```typescript
interface ReportConfig {
  id: string;
  name: string;
  dataSource: 'deals' | 'leads' | 'activities' | 'emails' | 'products' | 'campaigns' | 'contacts';
  metrics: Metric[];
  filters: Filter[];
  visualization: 'bar' | 'line' | 'pie' | 'funnel' | 'scorecard' | 'table';
  combinedWith?: 'deals' | 'leads' | 'activities' | 'products' | 'campaigns'; // Apenas se permitido
}

// Validação
function validateReport(config: ReportConfig): boolean {
  const allowedMetrics = getMetricsForSource(config.dataSource);
  const allowedFilters = getFiltersForSource(config.dataSource);
  const allowedVisualizations = getVisualizationsForSource(config.dataSource);

  // Validar métricas
  for (const metric of config.metrics) {
    if (!allowedMetrics.includes(metric.id)) {
      throw new Error(`Métrica ${metric.id} não permitida para ${config.dataSource}`);
    }
  }

  // Validar filtros
  for (const filter of config.filters) {
    if (!allowedFilters.includes(filter.id)) {
      throw new Error(`Filtro ${filter.id} não permitido para ${config.dataSource}`);
    }
  }

  // Validar visualização
  if (!allowedVisualizations.includes(config.visualization)) {
    throw new Error(`Visualização ${config.visualization} não permitida para ${config.dataSource}`);
  }

  // Validar combinação
  if (config.combinedWith) {
    if (!isAllowedCombination(config.dataSource, config.combinedWith)) {
      throw new Error(`Combinação ${config.dataSource} + ${config.combinedWith} não permitida`);
    }
  }

  return true;
}
```

---

## 11. CONCLUSÃO

**Insights é:**
- ✅ Visualizador restrito
- ✅ Somente leitura
- ✅ Limitado por fonte de dados
- ✅ Sem criação de dados novos

**Insights NÃO é:**
- ❌ BI genérico
- ❌ CRUD
- ❌ Ferramenta de correção de dados
- ❌ Sistema de decisão automática

**Próximo passo:**
Implementar exatamente conforme esta especificação, sem criatividade, sem "melhorias", apenas execução fiel aos PDFs.
