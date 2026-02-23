import { useState } from 'react';
import { Info, Copy, Check } from 'lucide-react';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface Props {
    suggestion?: string;
    script?: string;
    className?: string;
}

export function ActivityScriptPopover({ suggestion, script, className }: Props) {
    const [isOpen, setIsOpen] = useState(false);
    const [copied, setCopied] = useState(false);

    const handleCopy = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!script) return;
        navigator.clipboard.writeText(script);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (!suggestion && !script) return null;

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <button
                    onMouseEnter={() => setIsOpen(true)}
                    onMouseLeave={() => setIsOpen(false)}
                    className={cn(
                        "inline-flex items-center justify-center h-4 w-4 rounded-full bg-primary/10 text-primary hover:bg-primary hover:text-white transition-colors cursor-help",
                        className
                    )}
                >
                    <Info size={10} />
                </button>
            </PopoverTrigger>
            <PopoverContent
                side="top"
                align="start"
                className="w-80 p-4 shadow-xl border-primary/20 bg-background/95 backdrop-blur-sm z-[100]"
                onMouseEnter={() => setIsOpen(true)}
                onMouseLeave={() => setIsOpen(false)}
            >
                <div className="space-y-4">
                    {suggestion && (
                        <div className="space-y-1.5">
                            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-widest block">Objetivo / Sugestão</span>
                            <p className="text-xs text-foreground/80 leading-relaxed font-medium">
                                {suggestion}
                            </p>
                        </div>
                    )}

                    {script && (
                        <div className="space-y-3 pt-2 border-t border-border/50">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] uppercase font-bold text-primary tracking-widest">Script para Copiar</span>
                                <button
                                    onClick={handleCopy}
                                    className="flex items-center gap-1.5 px-2 py-1 rounded bg-primary text-primary-foreground text-[10px] font-bold uppercase transition-all hover:opacity-90 active:scale-95"
                                >
                                    {copied ? <Check size={10} /> : <Copy size={10} />}
                                    {copied ? 'Copiado!' : 'Copiar'}
                                </button>
                            </div>
                            <p className="text-xs text-primary bg-primary/5 p-3 rounded-lg border border-primary/10 italic font-medium leading-relaxed">
                                "{script}"
                            </p>
                        </div>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}
