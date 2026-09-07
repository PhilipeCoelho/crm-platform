import { useState, useRef, useEffect, type FormEvent, type KeyboardEvent } from 'react';
import { Send, Sparkles, Tag } from 'lucide-react';
import { VoiceMicButton } from '@/components/shared/VoiceMicButton';
import { useVoiceTranscription } from '@/hooks/useVoiceTranscription';

interface DailyQuickCaptureProps {
  onAddEntry: (content: string, sourceType: 'text' | 'voice') => Promise<void>;
  isSubmitting?: boolean;
  prefilledText?: string;
  onClearPrefill?: () => void;
}

const QUICK_TAGS = [
  { label: 'Reunião', prefix: '[Reunião] ' },
  { label: 'Fechamento', prefix: '[Fechamento] ' },
  { label: 'Objeção', prefix: '[Objeção de Cliente] ' },
  { label: 'Reflexão', prefix: '[Reflexão] ' },
  { label: 'Obstáculo', prefix: '[Obstáculo/Gargalo] ' },
];

export default function DailyQuickCapture({
  onAddEntry,
  isSubmitting = false,
  prefilledText,
  onClearPrefill,
}: DailyQuickCaptureProps) {
  const [text, setText] = useState('');
  const [usedVoice, setUsedVoice] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync prefilled text if passed
  useEffect(() => {
    if (prefilledText) {
      setText(prefilledText);
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(prefilledText.length, prefilledText.length);
      }
      if (onClearPrefill) onClearPrefill();
    }
  }, [prefilledText, onClearPrefill]);

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
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
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
    // Send on Cmd+Enter / Ctrl+Enter
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleApplyTag = (prefix: string) => {
    if (text.startsWith(prefix)) return;
    setText(prev => `${prefix}${prev}`);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-3 sm:p-4 shadow-sm transition-all focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10">
      <div className="flex items-center justify-between gap-2 mb-2 px-1">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
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

      {/* Quick context tags */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-1 text-[11px] text-muted-foreground no-scrollbar">
        <span className="shrink-0 text-muted-foreground/70 flex items-center gap-0.5">
          <Tag size={11} />
          <span>Contexto:</span>
        </span>
        {QUICK_TAGS.map(tag => (
          <button
            key={tag.label}
            type="button"
            onClick={() => handleApplyTag(tag.prefix)}
            className="shrink-0 px-2 py-0.5 rounded-md bg-muted/60 hover:bg-primary/10 hover:text-primary border border-border/60 transition-all active:scale-95"
          >
            {tag.label}
          </button>
        ))}
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
              : 'O que aconteceu agora? (reunião, insight, obstáculo, objeção, fechamento...)'
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
