import { useState } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { Deal } from '@/types/schema';
import { Bold, Italic, List, Link as LinkIcon, Image } from 'lucide-react';

interface NoteTabProps {
    deal: Deal;
    onSave?: () => void;
}

export default function NoteTab({ deal, onSave }: NoteTabProps) {
    const { addActivity } = useCRM();
    const [content, setContent] = useState('');

    const insertFormatting = (prefix: string, suffix: string = '') => {
        const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = content;
        const before = text.substring(0, start);
        const selected = text.substring(start, end);
        const after = text.substring(end);

        const newContent = `${before}${prefix}${selected}${suffix}${after}`;
        setContent(newContent);

        // Restore focus and selection
        setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(start + prefix.length, end + prefix.length);
        }, 0);
    };

    const handleSave = () => {
        if (!content.trim()) return;

        addActivity({
            type: 'note',
            title: content,
            dealId: deal.id,
            completed: true,
            dueDate: new Date().toISOString()
        });
        setContent('');
        if (onSave) onSave();
    };

    return (
        <div className="border rounded-lg bg-card/50 overflow-hidden border-border transition-all focus-within:ring-1 focus-within:ring-primary/50">
            {/* Toolbar */}
            <div className="flex items-center gap-1 p-2 border-b border-border bg-muted/30">
                <button onClick={() => insertFormatting('**', '**')} title="Negrito" type="button" className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors"><Bold size={16} /></button>
                <button onClick={() => insertFormatting('*', '*')} title="Itálico" type="button" className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors"><Italic size={16} /></button>
                <div className="w-px h-4 bg-border mx-1" />
                <button onClick={() => insertFormatting('- ')} title="Lista" type="button" className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors"><List size={16} /></button>
                <button onClick={() => insertFormatting('[', '](url)')} title="Link" type="button" className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors"><LinkIcon size={16} /></button>
                <button onClick={() => insertFormatting('![', '](image-url)')} title="Imagem" type="button" className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors"><Image size={16} /></button>
            </div>

            <textarea
                className="w-full h-32 p-4 bg-transparent outline-none resize-none text-sm leading-relaxed placeholder:text-muted-foreground/50"
                placeholder="Comece a escrever uma nota... (Markdown suportado)"
                value={content}
                onChange={e => setContent(e.target.value)}
                autoFocus
            />

            <div className="flex justify-between items-center p-2 bg-muted/10 border-t border-border">
                <span className="text-xs text-muted-foreground px-2">Suporta Markdown básico</span>
                <button
                    onClick={handleSave}
                    disabled={!content.trim()}
                    className="px-4 py-1.5 bg-yellow-500 hover:bg-yellow-600 text-white rounded-md font-medium text-sm transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Salvar Nota
                </button>
            </div>
        </div>
    );
}
