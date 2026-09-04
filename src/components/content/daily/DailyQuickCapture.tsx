import { useState, useRef, useEffect, type FormEvent, type KeyboardEvent } from 'react';
import { Send, Sparkles } from 'lucide-react';
import { VoiceMicButton } from '@/components/shared/VoiceMicButton';
import { useVoiceTranscription } from '@/hooks/useVoiceTranscription';

interface DailyQuickCaptureProps {
  onAddEntry: (content: string, sourceType: 'text' | 'voice') => Promise<void>;
  isSubmitting?: boolean;
}

export default function DailyQuickCapture({
  onAddEntry,
  isSubmitting = false,
}: DailyQuickCaptureProps) {
  const [text, setText] = useState('');
  const [usedVoice, setUsedVoice] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { isRecording, toggleRecording, isSupported } = useVoiceTranscription({
    lang: 'pt-BR',
    continuous: true,
    interimResults: true,
    onResult: (transcribedChunk, isFinal) => {
      setUsedVoice(true);
      if (isFinal) {
        setText(prev => (prev ? `${prev} ${transcribedChunk}` : transcribedChunk).trim());
      }
    },
  });

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [text]);

  const handleSubmit = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    const content = text.trim();
    if (!content || isSubmitting) return;

    const sourceType = usedVoice ? 'voice' : 'text';
    setText('');
    setUsedVoice(false);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    await onAddEntry(content, sourceType);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Send on Cmd+Enter / Ctrl+Enter or single Enter on desktop if no Shift
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-3 sm:p-4 shadow-sm transition-all focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10">
      <div className="flex items-center justify-between gap-2 mb-2 px-1">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Sparkles size={13} className="text-primary" />
          <span>Registro rápido do dia</span>
        </div>
        {isRecording && (
          <span className="text-[11px] font-medium text-rose-500 animate-pulse flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            Ouvindo voz...
          </span>
        )}
      </div>

      <div className="relative">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            isRecording
              ? 'Fale livremente... a transcrição aparecerá aqui...'
              : 'O que aconteceu agora? (reunião, insight, obstáculo, fechamento...)'
          }
          rows={2}
          className="w-full bg-transparent text-sm sm:text-base text-foreground placeholder:text-muted-foreground/60 resize-none outline-none pr-12 transition-all leading-relaxed"
          disabled={isSubmitting}
        />

        {isSupported && (
          <div className="absolute right-1 top-1">
            <VoiceMicButton
              isRecording={isRecording}
              onToggle={toggleRecording}
              size="sm"
              variant="minimal"
            />
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-2 mt-1 border-t border-border/50 text-xs text-muted-foreground">
        <span className="hidden sm:inline text-[11px]">
          Pressione <kbd className="px-1 py-0.5 rounded bg-muted font-mono text-[10px]">Cmd</kbd> + <kbd className="px-1 py-0.5 rounded bg-muted font-mono text-[10px]">Enter</kbd> para registrar
        </span>
        <span className="sm:hidden text-[11px]">
          {isRecording ? 'Gravando áudio...' : 'Voz ou texto livre'}
        </span>

        <button
          type="button"
          onClick={() => handleSubmit()}
          disabled={!text.trim() || isSubmitting}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-primary-foreground font-medium text-xs disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary/90 transition-all active:scale-95 shadow-sm"
        >
          <span>Registrar</span>
          <Send size={12} />
        </button>
      </div>
    </div>
  );
}
