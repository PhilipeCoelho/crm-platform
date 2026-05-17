import { useState, useEffect } from 'react';
import { Mic, Square } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VoiceMicButtonProps {
    isRecording: boolean;
    isPaused?: boolean;
    onToggle: () => void;
    onReset?: () => void;
    className?: string;
    size?: 'xs' | 'sm' | 'md' | 'lg';
    variant?: 'default' | 'minimal';
}

export function VoiceMicButton({
    isRecording,
    isPaused = false,
    onToggle,
    className,
    size = 'md',
    variant = 'default'
}: VoiceMicButtonProps) {
    const [timer, setTimer] = useState(0);

    useEffect(() => {
        let interval: any;
        if (isRecording && !isPaused) {
            interval = setInterval(() => {
                setTimer(prev => prev + 1);
            }, 1000);
        } else if (!isRecording) {
            setTimer(0);
        }
        return () => clearInterval(interval);
    }, [isRecording, isPaused]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const sizeClasses = {
        xs: 'w-7 h-7',
        sm: 'w-9 h-9',
        md: 'w-12 h-12',
        lg: 'w-16 h-16'
    };

    const iconSizes = {
        xs: 12,
        sm: 15,
        md: 20,
        lg: 28
    };

    if (variant === 'minimal') {
        return (
            <div className={cn("flex items-center gap-2", className)}>
                {isRecording && (
                    <span className="text-[10px] font-bold font-mono text-rose-500 animate-pulse bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100">
                        {formatTime(timer)}
                    </span>
                )}
                <button
                    onClick={(e) => {
                        e.preventDefault();
                        onToggle();
                    }}
                    className={cn(
                        "relative flex items-center justify-center rounded-full transition-all duration-300 active:scale-90",
                        sizeClasses[size],
                        isRecording 
                            ? "bg-rose-500 text-white shadow-lg shadow-rose-500/20" 
                            : "text-slate-400 dark:text-slate-500 hover:bg-primary/10 hover:text-primary"
                    )}
                >
                    {isRecording && (
                        <div className="absolute inset-0 rounded-full animate-ping bg-rose-500/20" />
                    )}
                    {isRecording ? (
                        <Square size={iconSizes[size]} fill="currentColor" />
                    ) : (
                        <Mic size={iconSizes[size]} />
                    )}
                </button>
            </div>
        );
    }

    return (
        <div className={cn("flex flex-col items-center gap-3", className)}>
            <div className="relative">
                {isRecording && (
                    <div className="absolute inset-0 rounded-full animate-ping bg-rose-500/20" />
                )}
                <button
                    onClick={(e) => {
                        e.preventDefault();
                        onToggle();
                    }}
                    className={cn(
                        "relative flex items-center justify-center rounded-full transition-all duration-300 shadow-xl active:scale-95",
                        sizeClasses[size],
                        isRecording 
                            ? "bg-rose-500 text-white shadow-rose-500/40 glow-rose" 
                            : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-primary hover:text-primary"
                    )}
                >
                    {isRecording ? (
                        <Square size={iconSizes[size]} fill="currentColor" />
                    ) : (
                        <Mic size={iconSizes[size]} />
                    )}
                </button>
            </div>
            
            {isRecording && (
                <div className="flex flex-col items-center gap-1">
                    <span className="text-[10px] font-black font-mono text-rose-500 animate-pulse tracking-widest uppercase">
                        {isPaused ? 'Pausado' : 'Gravando'}
                    </span>
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                        {formatTime(timer)}
                    </span>
                </div>
            )}

            <style>{`
                .glow-rose {
                    box-shadow: 0 0 20px rgba(244, 63, 94, 0.4);
                }
            `}</style>
        </div>
    );
}
