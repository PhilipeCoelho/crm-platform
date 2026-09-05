import { useState } from 'react';
import {
  Plus,
  Search,
  BookMarked,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';
import { useContentReferences } from '@/hooks/content/useContentReferences';
import { ContentReference } from '@/services/contentService';
import { CreateReferenceInput } from '@/services/contentReferenceService';
import ReferenceCard from '@/components/content/references/ReferenceCard';
import ReferenceModal from '@/components/content/references/ReferenceModal';
import ReferenceDetailDialog from '@/components/content/references/ReferenceDetailDialog';
import ReferenceConvertIdeaDialog from '@/components/content/references/ReferenceConvertIdeaDialog';

export default function ContentReferences() {
  const {
    references,
    isLoading,
    isAnalyzing,
    filters,
    setSearch,
    setStatusFilter,
    setPlatformFilter,
    setSortBy,
    addReference,
    editReference,
    removeReference,
    archive,
    analyze,
    convertToIdea,
    checkDuplicate,
    refresh,
    unanalyzedCount,
    showAntiAccumulationWarning,
    showAnalyzedUnusedWarning,
  } = useContentReferences();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRef, setEditingRef] = useState<ContentReference | null>(null);
  const [viewingRef, setViewingRef] = useState<ContentReference | null>(null);
  const [convertingRef, setConvertingRef] = useState<ContentReference | null>(null);
  const [duplicateRef, setDuplicateRef] = useState<ContentReference | null>(null);

  const handleOpenCreate = () => {
    setEditingRef(null);
    setDuplicateRef(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (ref: ContentReference) => {
    setEditingRef(ref);
    setDuplicateRef(null);
    setIsModalOpen(true);
  };

  const handleSaveReference = async (data: CreateReferenceInput) => {
    if (editingRef) {
      await editReference(editingRef.id, data);
    } else {
      try {
        await addReference(data);
      } catch (err: any) {
        if (err?.message === 'DUPLICATE_URL') {
          return; // Duplicate warning already shown
        }
        throw err;
      }
    }
  };

  const handleAnalyze = async (ref: ContentReference) => {
    await analyze(ref.id);
    // Refresh the viewing ref if it's the one being analyzed
    if (viewingRef?.id === ref.id) {
      refresh();
    }
  };

  const handleArchive = async (ref: ContentReference) => {
    await archive(ref.id);
  };

  const handleDelete = async (ref: ContentReference) => {
    await removeReference(ref.id);
    if (viewingRef?.id === ref.id) {
      setViewingRef(null);
    }
  };

  const handleConvertToIdea = async (
    referenceId: string,
    ideaData: { title: string; description?: string; format?: 'reel' | 'carrossel' | 'post' | 'story' | 'artigo' | null; priority?: number }
  ): Promise<boolean> => {
    return convertToIdea(referenceId, ideaData);
  };

  const handleCheckDuplicate = async (url: string) => {
    const existing = await checkDuplicate(url);
    setDuplicateRef(existing);
    return existing;
  };

  const STATUS_FILTERS = [
    { value: 'all', label: 'Todas' },
    { value: 'salva', label: 'Salvas' },
    { value: 'analisada', label: 'Analisadas' },
    { value: 'arquivada', label: 'Arquivadas' },
  ];

  const PLATFORM_OPTIONS = [
    { value: 'all', label: 'Todas Plataformas' },
    { value: 'instagram', label: 'Instagram' },
    { value: 'youtube', label: 'YouTube' },
    { value: 'tiktok', label: 'TikTok' },
    { value: 'linkedin', label: 'LinkedIn' },
    { value: 'twitter', label: 'X (Twitter)' },
    { value: 'facebook', label: 'Facebook' },
    { value: 'blog', label: 'Blog' },
    { value: 'outro', label: 'Outro' },
  ];

  // Keep viewingRef in sync with latest data
  const currentViewingRef = viewingRef
    ? references.find(r => r.id === viewingRef.id) || viewingRef
    : null;

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Referências</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Salve o que chamou sua atenção. Depois descubra o que realmente vale aprender.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium text-xs hover:bg-primary/90 transition-all active:scale-95 shadow-sm self-start sm:self-auto"
        >
          <Plus size={15} />
          <span>Salvar referência</span>
        </button>
      </div>

      {/* Anti-accumulation banners */}
      {showAntiAccumulationWarning && (
        <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400">
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
          <div className="text-xs">
            <p className="font-semibold">Você já tem {unanalyzedCount} referências sem análise.</p>
            <p className="text-amber-600 dark:text-amber-500 mt-0.5">Analise algumas antes de salvar mais. A referência só vale quando gera aprendizado aplicável.</p>
          </div>
        </div>
      )}

      {showAnalyzedUnusedWarning && !showAntiAccumulationWarning && (
        <div className="flex items-start gap-3 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-400">
          <ArrowRight size={16} className="mt-0.5 flex-shrink-0" />
          <div className="text-xs">
            <p className="font-semibold">Você já extraiu aprendizados de várias referências.</p>
            <p className="text-blue-600 dark:text-blue-500 mt-0.5">Agora aplique em um conteúdo. Transforme uma referência analisada em ideia de conteúdo.</p>
          </div>
        </div>
      )}

      {/* 2. Filters */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={filters.search || ''}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por título, URL, autor ou notas..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-card border border-border text-xs text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary transition-all shadow-sm"
            />
          </div>

          {/* Dropdowns */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            <select
              value={filters.platform || 'all'}
              onChange={e => setPlatformFilter(e.target.value)}
              className="px-2.5 py-2 rounded-xl bg-card border border-border text-xs text-foreground outline-none focus:border-primary transition-all shadow-sm"
            >
              {PLATFORM_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>

            <select
              value={filters.sortBy || 'recent'}
              onChange={e => setSortBy(e.target.value as any)}
              className="px-2.5 py-2 rounded-xl bg-card border border-border text-xs text-foreground outline-none focus:border-primary transition-all shadow-sm"
            >
              <option value="recent">Mais recentes</option>
              <option value="analyzed">Analisadas primeiro</option>
              <option value="oldest">Mais antigas</option>
            </select>
          </div>
        </div>

        {/* Status tabs */}
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

      {/* 3. Grid */}
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
      ) : references.length === 0 ? (
        <div className="py-16 px-4 text-center bg-card/40 border border-dashed border-border rounded-2xl">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3 text-primary">
            <BookMarked size={24} />
          </div>
          <h3 className="font-bold text-foreground text-base">Ainda não há referências aqui.</h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto mt-1.5 leading-relaxed">
            Salve conteúdos que chamaram sua atenção e descubra o que pode aprender com eles.
          </p>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="mt-4 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-all shadow-sm"
          >
            + Salvar primeira referência
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {references.map(ref => (
            <ReferenceCard
              key={ref.id}
              reference={ref}
              onOpenDetails={setViewingRef}
              onAnalyze={handleAnalyze}
              onArchive={handleArchive}
              onDelete={handleDelete}
              isAnalyzing={isAnalyzing === ref.id}
            />
          ))}
        </div>
      )}

      {/* Modal de Criação / Edição */}
      <ReferenceModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSaveReference}
        initialReference={editingRef}
        duplicateWarning={duplicateRef}
        onCheckDuplicate={handleCheckDuplicate}
      />

      {/* Diálogo de Detalhes */}
      <ReferenceDetailDialog
        reference={currentViewingRef}
        isOpen={Boolean(viewingRef)}
        onClose={() => setViewingRef(null)}
        onEdit={handleOpenEdit}
        onAnalyze={handleAnalyze}
        onConvertToIdea={(ref) => {
          setConvertingRef(ref);
          setViewingRef(null);
        }}
        isAnalyzing={isAnalyzing === viewingRef?.id}
      />

      {/* Diálogo de Conversão para Ideia */}
      <ReferenceConvertIdeaDialog
        reference={convertingRef}
        isOpen={Boolean(convertingRef)}
        onClose={() => setConvertingRef(null)}
        onSubmit={handleConvertToIdea}
      />
    </div>
  );
}
