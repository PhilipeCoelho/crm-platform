// Activities V2 — Mock data, types & helpers

export type ActivityType = 'call' | 'email' | 'whats' | 'meeting' | 'task';

export const TYPES: Record<ActivityType, { label: string; icon: string; color: string; bg: string }> = {
  call:    { label: 'Ligação',  icon: 'phone',    color: 'var(--vp-blue-500)', bg: 'var(--vp-blue-50)' },
  email:   { label: 'E-mail',   icon: 'mail',     color: 'var(--vp-purple)',   bg: 'var(--vp-purple-bg)' },
  whats:   { label: 'WhatsApp', icon: 'whatsapp', color: 'var(--vp-success)',  bg: 'var(--vp-success-bg)' },
  meeting: { label: 'Reunião',  icon: 'video',    color: 'var(--vp-pink)',     bg: 'var(--vp-pink-bg)' },
  task:    { label: 'Tarefa',   icon: 'check',    color: 'var(--vp-ink-600)',  bg: 'var(--vp-ink-50)' },
};

export const STAGES = [
  { id: 'lead',     label: 'Lead',                 pct: 10,  color: 'var(--vp-ink-400)' },
  { id: 'engaged',  label: 'Lead Engajado',        pct: 25,  color: 'var(--vp-blue-400)' },
  { id: 'meeting',  label: 'Reunião agendada',     pct: 45,  color: 'var(--vp-blue-500)' },
  { id: 'proposal', label: 'Proposta enviada',     pct: 65,  color: 'var(--vp-blue-600)' },
  { id: 'nego',     label: 'Em negociação',        pct: 80,  color: 'var(--vp-purple)' },
  { id: 'won',      label: 'Fechado',              pct: 100, color: 'var(--vp-success)' },
];

export type ActivityV2 = {
  id: number;
  type: ActivityType;
  title: string;
  deal: string;
  contact: string;
  stage: string;
  value: number;
  due: number;
  time?: string;
  attempt: number;
  suggestion?: string;
};

export const BUCKETS = [
  { id: 'critical', label: 'Críticas',     sub: 'mais de 14 dias atrasadas', tone: 'critical' },
  { id: 'overdue',  label: 'Atrasadas',    sub: 'precisam de atenção',       tone: 'warn' },
  { id: 'today',    label: 'Hoje',         sub: '',                          tone: 'today' },
  { id: 'week',     label: 'Esta semana',  sub: '',                          tone: 'normal' },
  { id: 'later',    label: 'Mais tarde',   sub: '',                          tone: 'soft' },
] as const;

export function bucketOf(due: number) {
  if (due <= -14) return 'critical';
  if (due < 0)    return 'overdue';
  if (due === 0)  return 'today';
  if (due <= 7)   return 'week';
  return 'later';
}

export function fmtMoney(v: number): string {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `R$ ${Math.round(v / 1_000)}k`;
  return `R$ ${v}`;
}

export function fmtDue(due: number, time?: string): string {
  if (due === 0)  return time ? `hoje · ${time}` : 'hoje';
  if (due < 0)    return `${Math.abs(due)} dias atrás`;
  if (due === 1)  return 'amanhã';
  return `em ${due} dias`;
}

export function fmtCompletedTime(ts: number): string {
  const diff = Math.round((Date.now() - ts) / 1000);
  if (diff < 60)    return 'agora mesmo';
  if (diff < 3600)  return `há ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)} h`;
  return new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

// --- Mock Dataset ---
export const MOCK_ACTIVITIES: ActivityV2[] = [
  { id: 1,  type: 'call',    title: 'Ligação de qualificação',     deal: 'Dr. Lucas Ortodontia',       contact: 'Lucas Pereira',      stage: 'lead',     value: 24000,  due: -59, attempt: 2, suggestion: 'Dr. Lucas demonstrou interesse em aparelho estético. Mencione casos de sucesso com Invisalign e agende reunião presencial.' },
  { id: 2,  type: 'whats',   title: 'Follow-up proposta',          deal: 'CliniCosta',                 contact: 'Mariana Costa',      stage: 'proposal', value: 68000,  due: -32, attempt: 4, suggestion: 'Proposta enviada há 32 dias sem resposta. Tente abordagem mais direta — pergunte se há dúvidas sobre o investimento.' },
  { id: 3,  type: 'email',   title: 'Enviar apresentação',         deal: 'Sorriso Premium',            contact: 'Fernanda Alves',     stage: 'engaged',  value: 15000,  due: -21, attempt: 1 },
  { id: 4,  type: 'call',    title: 'Ligação de reativação',       deal: 'OdontoMed',                  contact: 'Carlos Mendes',      stage: 'lead',     value: 8500,   due: -18, attempt: 3 },
  { id: 5,  type: 'whats',   title: 'Confirmar disponibilidade',   deal: 'Clínica Colombo',            contact: 'Ricardo Colombo',    stage: 'meeting',  value: 45000,  due: -10, attempt: 1, suggestion: 'Ricardo pediu para retornar na segunda. Confirme horário e envie link da videoconferência.' },
  { id: 6,  type: 'call',    title: 'Ligação de qualificação',     deal: 'DentVida Estética',          contact: 'Ana Beatriz',        stage: 'lead',     value: 12000,  due: -7,  attempt: 0 },
  { id: 7,  type: 'email',   title: 'Enviar comparativo',          deal: 'Instituto Oral',             contact: 'Jorge Lima',         stage: 'engaged',  value: 32000,  due: -3,  attempt: 2 },
  { id: 8,  type: 'whats',   title: 'Mensagem de follow-up',       deal: 'Clínica Dental Care',        contact: 'Patrícia Rocha',     stage: 'proposal', value: 55000,  due: -1,  attempt: 5, suggestion: 'Patrícia mencionou que precisa conversar com o sócio. Ofereça uma call rápida de 15 min com ambos.' },
  { id: 9,  type: 'call',    title: 'Ligação de qualificação',     deal: 'Maident Porto',              contact: 'Henrique Santos',    stage: 'lead',     value: 9800,   due: 0,   time: '09:00', attempt: 0 },
  { id: 10, type: 'meeting', title: 'Reunião de diagnóstico',      deal: 'Clínica Sorri.Dente',        contact: 'Camila Oliveira',    stage: 'meeting',  value: 78000,  due: 0,   time: '10:30', attempt: 0, suggestion: 'Preparar apresentação de ROI focada em implantes. Camila é diretora clínica com poder de decisão.' },
  { id: 11, type: 'whats',   title: 'Enviar material informativo', deal: 'SmileCare Odontologia',      contact: 'Diego Ferreira',     stage: 'engaged',  value: 19500,  due: 0,   time: '14:00', attempt: 1 },
  { id: 12, type: 'email',   title: 'Follow-up reunião',           deal: 'Dental One',                 contact: 'Fabricia Luciano',   stage: 'nego',     value: 120000, due: 0,   time: '16:00', attempt: 2, suggestion: 'Fabricia está comparando com concorrente. Destaque o suporte pós-venda e o prazo de implantação.' },
  { id: 13, type: 'task',    title: 'Preparar proposta comercial',  deal: 'XL Smile Coimbra',           contact: 'Rafael Monteiro',    stage: 'proposal', value: 42000,  due: 0,   time: '17:30', attempt: 0 },
  { id: 14, type: 'call',    title: 'Ligação de follow-up',        deal: 'Great Essence Odonto',       contact: 'Laura Martins',      stage: 'engaged',  value: 27000,  due: 2,   attempt: 1 },
  { id: 15, type: 'whats',   title: 'Enviar depoimento de cliente',deal: 'Concept Smile',              contact: 'Thiago Barbosa',     stage: 'meeting',  value: 35000,  due: 5,   attempt: 0 },
  { id: 16, type: 'meeting', title: 'Reunião de apresentação',     deal: 'Med 360 Clínica',            contact: 'Juliana Almeida',    stage: 'proposal', value: 95000,  due: 7,   attempt: 0, suggestion: 'Segunda reunião. Juliana quer ver demonstração do sistema. Preparar demo ao vivo com dados reais.' },
  { id: 17, type: 'email',   title: 'Enviar case de sucesso',      deal: 'Clínica Dental Braga',       contact: 'André Vieira',       stage: 'lead',     value: 11000,  due: 12,  attempt: 0 },
  { id: 18, type: 'task',    title: 'Montar proposta premium',      deal: 'OdontoMax Premium',          contact: 'Beatriz Nunes',      stage: 'nego',     value: 185000, due: 21,  attempt: 1 },
];

export const HISTORY_MOCK = [
  { type: 'call' as ActivityType, text: 'Ligação realizada — sem resposta', date: 'há 3 dias' },
  { type: 'whats' as ActivityType, text: 'Mensagem enviada pelo WhatsApp', date: 'há 5 dias' },
  { type: 'email' as ActivityType, text: 'E-mail de apresentação enviado', date: 'há 12 dias' },
];
