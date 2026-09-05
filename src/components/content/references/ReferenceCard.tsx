import { 
  Brain, 
  Archive, 
  Trash2, 
  Sparkles, 
  Loader2, 
  Instagram, 
  Youtube, 
  Linkedin, 
  Twitter,
  Globe,
  ExternalLink,
  Facebook
} from 'lucide-react';
import { ContentReference } from '@/services/contentService';

interface ReferenceCardProps {
  reference: ContentReference;
  onOpenDetails: (ref: ContentReference) => void;
  onAnalyze: (ref: ContentReference) => void;
  onArchive: (ref: ContentReference) => void;
  onDelete: (ref: ContentReference) => void;
  isAnalyzing?: boolean;
}

export default function ReferenceCard({
  reference,
  onOpenDetails,
  onAnalyze,
  onArchive,
  onDelete,
  isAnalyzing = false,
}: ReferenceCardProps) {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'analisada':
        return (
          <span className="text-[10px] font-semibold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20">
            Analisada
          </span>
        );
      case 'analisando':
        return (
          <span className="text-[10px] font-semibold uppercase tracking-wider bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/20 flex items-center gap-1">
            <Loader2 size={10} className="animate-spin" />
            Analisando
          </span>
        );
      case 'arquivada':
        return (
          <span className="text-[10px] font-semibold uppercase tracking-wider bg-muted text-muted-foreground px-2 py-0.5 rounded-full line-through opacity-70">
            Arquivada
          </span>
        );
      case 'salva':
      default:
        return (
          <span className="text-[10px] font-semibold uppercase tracking-wider bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/20">
            Salva
          </span>
        );
    }
  };

  const getPlatformBadge = (platform?: string | null) => {
    switch (platform) {
      case 'instagram':
        return (
          <span className="text-[11px] font-medium text-pink-600 bg-pink-500/10 px-2 py-0.5 rounded-md flex items-center gap-1 border border-pink-500/20">
            <Instagram size={11} />
            Instagram
          </span>
        );
      case 'youtube':
        return (
          <span className="text-[11px] font-medium text-red-600 bg-red-500/10 px-2 py-0.5 rounded-md flex items-center gap-1 border border-red-500/20">
            <Youtube size={11} />
            YouTube
          </span>
        );
      case 'tiktok':
        return (
          <span className="text-[11px] font-medium text-foreground bg-foreground/10 px-2 py-0.5 rounded-md flex items-center gap-1 border border-foreground/20">
            <span className="font-bold text-[10px]">d</span>
            TikTok
          </span>
        );
      case 'linkedin':
        return (
          <span className="text-[11px] font-medium text-blue-600 bg-blue-500/10 px-2 py-0.5 rounded-md flex items-center gap-1 border border-blue-500/20">
            <Linkedin size={11} />
            LinkedIn
          </span>
        );
      case 'twitter':
        return (
          <span className="text-[11px] font-medium text-sky-600 bg-sky-500/10 px-2 py-0.5 rounded-md flex items-center gap-1 border border-sky-500/20">
            <Twitter size={11} />
            X (Twitter)
          </span>
        );
      case 'facebook':
        return (
          <span className="text-[11px] font-medium text-blue-700 bg-blue-600/10 px-2 py-0.5 rounded-md flex items-center gap-1 border border-blue-600/20">
            <Facebook size={11} />
            Facebook
          </span>
        );
      default:
        return (
          <span className="text-[11px] font-medium text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-md flex items-center gap-1">
            <Globe size={11} />
            {platform ? platform.charAt(0).toUpperCase() + platform.slice(1) : 'Outro'}
          </span>
        );
    }
  };

  const formattedDate = new Date(reference.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });

  return (
    <div className="bg-card border border-border rounded-2xl p-4 shadow-sm hover:border-border/80 hover:shadow transition-all flex flex-col justify-between group">
      <div>
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            {getStatusBadge(isAnalyzing ? 'analisando' : reference.status)}
            {getPlatformBadge(reference.platform)}
          </div>
        </div>

        <div className="flex gap-3">
          <div className="flex-1 min-w-0" onClick={() => onOpenDetails(reference)}>
            <div className="cursor-pointer">
              {reference.title ? (
                <h3 className="font-bold text-foreground text-sm leading-snug group-hover:text-primary transition-colors line-clamp-1">
                  {reference.title}
                </h3>
              ) : reference.notes ? (
                <h3 className="font-bold text-foreground text-sm leading-snug group-hover:text-primary transition-colors line-clamp-1 italic text-muted-foreground">
                  Sem título
                </h3>
              ) : (
                <h3 className="font-medium text-foreground text-sm leading-snug group-hover:text-primary transition-colors truncate">
                  {reference.url}
                </h3>
              )}
              
              {reference.author && (
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  por {reference.author}
                </p>
              )}

              {reference.notes && (
                <p className="text-xs text-muted-foreground line-clamp-2 mt-1.5 leading-relaxed">
                  {reference.notes}
                </p>
              )}
            </div>
          </div>
          
          {reference.thumbnailUrl && (
            <div className="shrink-0">
              <img 
                src={reference.thumbnailUrl} 
                alt={reference.title || 'Thumbnail'} 
                className="w-12 h-12 rounded object-cover border border-border"
              />
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between pt-3 mt-3 border-t border-border/50 text-xs">
        <div className="flex items-center gap-1.5 text-muted-foreground font-medium text-[11px]">
          <span>{formattedDate}</span>
          {reference.status === 'analisada' && (
            <span className="flex items-center text-emerald-600 dark:text-emerald-400 gap-1 ml-1" title="Análise concluída">
              <Brain size={12} />
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
          {reference.status === 'salva' && !isAnalyzing && (
            <button
              type="button"
              onClick={() => onAnalyze(reference)}
              title="Analisar referência"
              className="p-1 text-muted-foreground hover:text-amber-600 hover:bg-amber-500/10 rounded-lg transition-colors"
            >
              <Sparkles size={13} />
            </button>
          )}
          <a
            href={reference.url}
            target="_blank"
            rel="noopener noreferrer"
            title="Abrir link original"
            className="p-1 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
          >
            <ExternalLink size={13} />
          </a>
          <button
            type="button"
            onClick={() => onArchive(reference)}
            title="Arquivar referência"
            className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
          >
            <Archive size={13} />
          </button>
          <button
            type="button"
            onClick={() => onDelete(reference)}
            title="Excluir referência"
            className="p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
