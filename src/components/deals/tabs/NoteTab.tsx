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

    const handleSave = () => {
        if (!content.trim()) return;

        addActivity({
            type: 'note',
            title: content, // Storing note content in title for now, or could add 'description'
            dealId: deal.id,
            completed: true // Notes are instantaneous records
        });
        setContent('');
        if (onSave) onSave();
    };

    return (
        <div className="border rounded-lg bg-card/50 overflow-hidden">
            {/* Toolbar */}
            <div className="flex items-center gap-1 p-2 border-b bg-muted/30">
                <button className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground"><Bold size={16} /></button>
                <button className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground"><Italic size={16} /></button>
                <div className="w-px h-4 bg-border mx-1" />
                <button className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground"><List size={16} /></button>
                <button className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground"><LinkIcon size={16} /></button>
                <button className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground"><Image size={16} /></button>
            </div>

            <textarea
                className="w-full h-32 p-4 bg-transparent outline-none resize-none"
                placeholder="Comece a escrever uma nota..."
                value={content}
                onChange={e => setContent(e.target.value)}
            />

            <div className="flex justify-between items-center p-2 bg-muted/10 border-t">
                <span className="text-xs text-muted-foreground px-2">Suporta Markdown básico</span>
                <button
                    onClick={handleSave}
                    disabled={!content.trim()}
                    className="px-4 py-1.5 bg-yellow-500 hover:bg-yellow-600 text-white rounded font-medium text-sm transition-colors"
                >
                    Salvar Nota
                </button>
            </div>
        </div>
    );
}
