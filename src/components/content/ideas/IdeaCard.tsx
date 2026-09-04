import { 
  Star, 
  CalendarDays, 
  Brain, 
  Sparkles, 
  Edit3, 
  Trash2, 
  Video, 
  Layers, 
  FileText, 
  Smartphone,
  BookOpen
} from 'lucide-react';
import { ContentIdea } from '@/services/contentService';

interface IdeaCardProps {
  idea: ContentIdea;
  onEdit: (idea: ContentIdea) => void;
  onDelete: (idea: ContentIdea) => void;
  onOpenDetails: (idea: ContentIdea) => void;
}

export default function IdeaCard({
  idea,
  onEdit,
  onDelete,
  onOpenDetails,
}: IdeaCardProps) {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'validada':
        return (
          <span className="text-[10px] font-semibold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20">
            Validada
          </span>
        );
      case 'em_producao':
        return (
          <span className="text-[10px] font-semibold uppercase tracking-wider bg-purple-500/10 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded-full border border-purple-500/20">
            Em Produção
          </span>
        );
      case 'descartada':
        return (
          <span className="text-[10px] font-semibold uppercase tracking-wider bg-muted text-muted-foreground px-2 py-0.5 rounded-full line-through opacity-70">
            Descartada
          </span>
        );
      default:
        return (
          <span className="text-[10px] font-semibold uppercase tracking-wider bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/20">
            Capturada
          </span>
        );
    }
  };

  const getSourceBadge = (sourceType: string) => {
    switch (sourceType) {
      case 'daily':
        return (
          <span className="text-[11px] font-medium text-primary bg-primary/5 px-2 py-0.5 rounded-md flex items-center gap-1 border border-primary/10">
            <CalendarDays size={11} />
            Daily
          </span>
        );
      case 'crm_signal':
        return (
          <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/5 px-2 py-0.5 rounded-md flex items-center gap-1 border border-amber-500/20">
            <Brain size={11} />
            CRM
          </span>
        );
      default:
        return (
          <span className="text-[11px] font-medium text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-md flex items-center gap-1">
            <Sparkles size={11} />
            Manual
          </span>
        );
    }
  };

  const getFormatIcon = (format?: string | null) => {
    switch (format) {
      case 'reel':
        return <span className="flex items-center gap-1 text-[11px] text-muted-foreground font-medium"><Video size={11} /> Reel</span>;
      case 'carrossel':
        return <span className="flex items-center gap-1 text-[11px] text-muted-foreground font-medium"><Layers size={11} /> Carrossel</span>;
      case 'post':
        return <span className="flex items-center gap-1 text-[11px] text-muted-foreground font-medium"><FileText size={11} /> Post</span>;
      case 'story':
        return <span className="flex items-center gap-1 text-[11px] text-muted-foreground font-medium"><Smartphone size={11} /> Story</span>;
      case 'artigo':
        return <span className="flex items-center gap-1 text-[11px] text-muted-foreground font-medium"><BookOpen size={11} /> Artigo</span>;
      default:
        return null;
    }
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-4 shadow-sm hover:border-border/80 hover:shadow transition-all flex flex-col justify-between group">
      <div>
        {/* Header com Badges e Ações */}
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            {getStatusBadge(idea.status)}
            {getSourceBadge(idea.sourceType)}
          </div>

          <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={() => onEdit(idea)}
              title="Editar ideia"
              className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
            >
              <Edit3 size={13} />
            </button>
            <button
              type="button"
              onClick={() => onDelete(idea)}
              title="Excluir ideia"
              className="p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        {/* Título & Descrição Clicáveis para Abrir Detalhes */}
        <div 
          onClick={() => onOpenDetails(idea)}
          className="cursor-pointer"
        >
          <h3 className="font-bold text-foreground text-sm leading-snug group-hover:text-primary transition-colors">
            {idea.title}
          </h3>

          {idea.description ? (
            <p className="text-xs text-muted-foreground line-clamp-2 mt-1.5 leading-relaxed">
              {idea.description}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground/50 italic mt-1.5">
              Sem descrição adicional
            </p>
          )}
        </div>
      </div>

      {/* Footer do Card com Prioridade e Formato */}
      <div className="flex items-center justify-between pt-3 mt-3 border-t border-border/50 text-xs">
        <div className="flex items-center gap-1 text-amber-500 font-semibold text-[11px]">
          <Star size={12} fill="currentColor" />
          <span>P{idea.priority || 2}</span>
        </div>

        <div>
          {getFormatIcon(idea.format)}
        </div>
      </div>
    </div>
  );
}
