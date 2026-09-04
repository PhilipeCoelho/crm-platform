import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter 
} from '@/components/ui/dialog';
import { ContentIdea } from '@/services/contentService';
import { AlertTriangle } from 'lucide-react';

interface IdeaDeleteDialogProps {
  idea: ContentIdea | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  isDeleting?: boolean;
}

export default function IdeaDeleteDialog({
  idea,
  isOpen,
  onClose,
  onConfirm,
  isDeleting = false,
}: IdeaDeleteDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-destructive mb-1">
            <AlertTriangle size={18} />
            <DialogTitle className="text-base font-bold text-foreground">
              Excluir esta ideia?
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
            Essa ação removerá a ideia do banco. A origem original (Daily ou CRM) não será apagada.
          </DialogDescription>
        </DialogHeader>

        {idea && (
          <div className="p-3 bg-muted/50 border border-border rounded-xl text-xs text-foreground/80 font-medium">
            &ldquo;{idea.title}&rdquo;
          </div>
        )}

        <DialogFooter className="flex gap-2 sm:justify-end mt-2">
          <button
            type="button"
            disabled={isDeleting}
            onClick={onClose}
            className="px-3 py-2 rounded-xl border border-border text-xs font-medium text-foreground hover:bg-muted/70 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={isDeleting}
            onClick={onConfirm}
            className="px-3.5 py-2 rounded-xl bg-destructive text-destructive-foreground text-xs font-medium hover:bg-destructive/90 transition-colors shadow-sm disabled:opacity-50"
          >
            {isDeleting ? 'Excluindo...' : 'Excluir ideia'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
