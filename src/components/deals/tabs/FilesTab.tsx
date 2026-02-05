import { useState } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { Deal } from '@/types/schema';
import { UploadCloud, FileText, X } from 'lucide-react';

interface FilesTabProps {
    deal: Deal;
    onSave?: () => void;
}

export default function FilesTab({ deal, onSave }: FilesTabProps) {
    const { addActivity } = useCRM();
    const [isDragOver, setIsDragOver] = useState(false);
    const [mockFile, setMockFile] = useState<string | null>(null);

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        // Mock file upload
        const fileName = e.dataTransfer.files[0]?.name;
        if (fileName) {
            handleUpload(fileName);
        }
    };

    const handleUpload = (fileName: string) => {
        addActivity({
            type: 'fileUpload',
            title: `Arquivo anexado: ${fileName}`,
            dealId: deal.id,
            completed: true
        });
        setMockFile(fileName);
        setTimeout(() => setMockFile(null), 3000); // Clear success msg
        if (onSave) onSave();
    };

    return (
        <div className="space-y-4">
            <div
                className={`border-2 border-dashed rounded-lg p-12 flex flex-col items-center justify-center gap-4 transition-colors
                           ${isDragOver ? 'border-primary bg-primary/5' : 'border-border bg-card/50'}`}
                onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
            >
                <div className="p-4 bg-muted rounded-full">
                    <UploadCloud size={32} className="text-muted-foreground" />
                </div>
                <div className="text-center">
                    <p className="font-medium">Arraste e solte arquivos aqui</p>
                    <p className="text-sm text-muted-foreground">ou</p>
                    <button
                        onClick={() => handleUpload(`Documento_Exemplo_${Math.floor(Math.random() * 100)}.pdf`)}
                        className="text-primary hover:underline font-medium mt-2"
                    >
                        Selecione do computador
                    </button>
                </div>
            </div>

            {mockFile && (
                <div className="flex items-center gap-3 p-3 bg-green-50 text-green-700 rounded border border-green-200 animate-in fade-in slide-in-from-top-2">
                    <FileText size={16} />
                    <span className="text-sm font-medium">Upload concluído: {mockFile}</span>
                    <button onClick={() => setMockFile(null)} className="ml-auto hover:bg-green-100 rounded p-1"><X size={14} /></button>
                </div>
            )}

            <div className="text-xs text-center text-muted-foreground">
                Arquivos enviados aparecerão no histórico abaixo.
            </div>
        </div>
    );
}
