import { useState, useRef } from 'react';
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
    const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const handleEnter = () => {
        if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
        setIsOpen(true);
    };

    const handleLeave = () => {
        closeTimeoutRef.current = setTimeout(() => {
            setIsOpen(false);
        }, 150);
    };

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
                    onMouseEnter={handleEnter}
                    onMouseLeave={handleLeave}
                    className={cn(
                        "inline-flex items-center justify-center h-4 w-4 rounded-full bg-primary/5 text-primary/40 hover:bg-primary hover:text-white transition-all cursor-help",
                        className
                    )}
                >
                    <Info size={10} strokeWidth={2.5} />
                </button>
            </PopoverTrigger>
            <PopoverContent
                side="right"
                align="start"
                sideOffset={12}
                className="w-80 p-0 shadow-2xl border-border bg-background overflow-hidden z-[99999]"
                onMouseEnter={handleEnter}
                onMouseLeave={handleLeave}
            >
                <div className="flex flex-col">
                    {suggestion && (
                        <div className="p-3 bg-muted/30">
                            <span className="text-[9px] uppercase font-bold text-muted-foreground tracking-widest block mb-1">SUGESTÃO</span>
                            <p className="text-[11px] text-foreground font-medium leading-relaxed">
                                {suggestion}
                            </p>
                        </div>
                    )}

                    {script && (
                        <div className="p-3 space-y-2 border-t border-border/50">
                            <div className="flex items-center justify-between">
                                <span className="text-[9px] uppercase font-bold text-primary tracking-widest">SCRIPT SUGERIDO</span>
                                <button
                                    onClick={handleCopy}
                                    className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-primary/10 text-primary text-[9px] font-bold uppercase transition-all hover:bg-primary hover:text-white active:scale-95"
                                >
                                    {copied ? <Check size={10} /> : <Copy size={10} />}
                                    {copied ? 'Copiado!' : 'Copiar'}
                                </button>
                            </div>
                            <div className="relative group/script">
                                <p className="text-[11px] text-foreground/90 bg-primary/[0.02] p-2.5 rounded border border-primary/10 italic font-medium leading-relaxed whitespace-pre-wrap">
                                    {script}
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}
