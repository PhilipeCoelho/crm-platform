import { useState } from 'react';
import { 
  Plus, 
  Search, 
  Lightbulb
} from 'lucide-react';
import { useContentIdeas } from '@/hooks/content/useContentIdeas';
import { ContentIdea } from '@/services/contentService';
import { CreateContentIdeaInput } from '@/services/contentIdeasService';
import IdeaCard from '@/components/content/ideas/IdeaCard';
import IdeaModal from '@/components/content/ideas/IdeaModal';
import IdeaDetailDialog from '@/components/content/ideas/IdeaDetailDialog';
import IdeaDeleteDialog from '@/components/content/ideas/IdeaDeleteDialog';

export default function ContentIdeas() {
  const {
    ideas,
    isLoading,
    filters,
    setSearch,
    setStatusFilter,
    setSourceFilter,
    setPriorityFilter,
    setSortBy,
    addIdea,
    editIdea,
    removeIdea,
  } = useContentIdeas();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingIdea, setEditingIdea] = useState<ContentIdea | null>(null);
  const [viewingIdea, setViewingIdea] = useState<ContentIdea | null>(null);
  const [deletingIdea, setDeletingIdea] = useState<ContentIdea | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleOpenCreate = () => {
    setEditingIdea(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (idea: ContentIdea) => {
    setEditingIdea(idea);
    setIsModalOpen(true);
  };

  const handleSaveIdea = async (data: CreateContentIdeaInput) => {
    if (editingIdea) {
      await editIdea(editingIdea.id, data);
    } else {
      await addIdea(data);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingIdea) return;
    setIsDeleting(true);
    try {
      await removeIdea(deletingIdea.id);
      setDeletingIdea(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const STATUS_FILTERS = [
    { value: 'all', label: 'Todas' },
    { value: 'capturada', label: 'Capturadas' },
    { value: 'validada', label: 'Validadas' },
    { value: 'em_producao', label: 'Em Produção' },
    { value: 'descartada', label: 'Descartadas' },
  ];

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      {/* 1. Header do Módulo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Ideias</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Suas ideias de conteúdo em um só lugar. Valide e selecione o que merece virar conteúdo.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium text-xs hover:bg-primary/90 transition-all active:scale-95 shadow-sm self-start sm:self-auto"
        >
          <Plus size={15} />
          <span>Nova ideia</span>
        </button>
      </div>

      {/* 2. Barra de Controle & Filtros */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
          {/* Campo de Busca */}
          <div className="relative flex-1 max-w-md">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={filters.search || ''}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por título, contexto ou temas..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-card border border-border text-xs text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary transition-all shadow-sm"
            />
          </div>

          {/* Filtros Dropdown / Ordenação */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            {/* Origem */}
            <select
              value={filters.sourceType || 'all'}
              onChange={e => setSourceFilter(e.target.value)}
              className="px-2.5 py-2 rounded-xl bg-card border border-border text-xs text-foreground outline-none focus:border-primary transition-all shadow-sm"
            >
              <option value="all">Todas as Origens</option>
              <option value="manual">Manual</option>
              <option value="daily">Daily</option>
              <option value="crm_signal">Inteligência Comercial</option>
            </select>

            {/* Prioridade */}
            <select
              value={filters.priority ? String(filters.priority) : 'all'}
              onChange={e => setPriorityFilter(e.target.value === 'all' ? undefined : Number(e.target.value))}
              className="px-2.5 py-2 rounded-xl bg-card border border-border text-xs text-foreground outline-none focus:border-primary transition-all shadow-sm"
            >
              <option value="all">Todas Prioridades</option>
              <option value="5">P5 — Máxima</option>
              <option value="4">P4 — Alta</option>
              <option value="3">P3 — Relevante</option>
              <option value="2">P2 — Normal</option>
              <option value="1">P1 — Baixa</option>
            </select>

            {/* Ordenação */}
            <select
              value={filters.sortBy || 'updated'}
              onChange={e => setSortBy(e.target.value as any)}
              className="px-2.5 py-2 rounded-xl bg-card border border-border text-xs text-foreground outline-none focus:border-primary transition-all shadow-sm"
            >
              <option value="updated">Mais recentes</option>
              <option value="priority">Maior prioridade</option>
              <option value="oldest">Mais antigas</option>
            </select>
          </div>
        </div>

        {/* Tabs Rápidas de Status */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide text-xs">
          {STATUS_FILTERS.map(st => {
            const isActive = (filters.status || 'all') === st.value;
            return (
              <button
                key={st.value}
                type="button"
                onClick={() => setStatusFilter(st.value)}
                className={`px-3 py-1.5 rounded-lg border font-medium transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                    : 'bg-card text-muted-foreground border-border hover:text-foreground hover:bg-muted/60'
                }`}
              >
                {st.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Grid de Ideias ou Estados de Carregamento / Vazio */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="animate-pulse bg-card border border-border rounded-2xl p-4 space-y-3">
              <div className="flex justify-between items-center">
                <div className="h-4 bg-muted rounded w-20" />
                <div className="h-4 bg-muted rounded w-12" />
              </div>
              <div className="h-5 bg-muted rounded w-3/4" />
              <div className="h-3 bg-muted rounded w-full" />
              <div className="h-3 bg-muted rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : ideas.length === 0 ? (
        <div className="py-16 px-4 text-center bg-card/40 border border-dashed border-border rounded-2xl">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3 text-primary">
            <Lightbulb size={24} />
          </div>
          <h3 className="font-bold text-foreground text-base">Ainda não há ideias aqui.</h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto mt-1.5 leading-relaxed">
            Capture uma ideia que já está na cabeça ou transforme um sinal do seu Daily em conteúdo autêntico.
          </p>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="mt-4 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-all shadow-sm"
          >
            + Criar primeira ideia
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {ideas.map(idea => (
            <IdeaCard
              key={idea.id}
              idea={idea}
              onEdit={handleOpenEdit}
              onDelete={setDeletingIdea}
              onOpenDetails={setViewingIdea}
            />
          ))}
        </div>
      )}

      {/* Modal de Criação / Edição */}
      <IdeaModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSaveIdea}
        initialIdea={editingIdea}
      />

      {/* Diálogo de Detalhes da Ideia */}
      <IdeaDetailDialog
        idea={viewingIdea}
        isOpen={Boolean(viewingIdea)}
        onClose={() => setViewingIdea(null)}
        onEdit={handleOpenEdit}
      />

      {/* Diálogo de Confirmação de Exclusão */}
      <IdeaDeleteDialog
        idea={deletingIdea}
        isOpen={Boolean(deletingIdea)}
        onClose={() => setDeletingIdea(null)}
        onConfirm={handleConfirmDelete}
        isDeleting={isDeleting}
      />
    </div>
  );
}
