import { useCRM } from "@/contexts/CRMContext";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface PrivacyToggleProps {
    className?: string;
    variant?: 'full' | 'icon' | 'sidebar';
}

export function PrivacyToggle({ className, variant = 'icon' }: PrivacyToggleProps) {
    const { isPrivacyMode, togglePrivacyMode } = useCRM();

    const label = isPrivacyMode ? "Desativar Privacidade" : "Ativar Privacidade";
    const Icon = isPrivacyMode ? EyeOff : Eye;

    if (variant === 'sidebar') {
        return (
            <button
                onClick={togglePrivacyMode}
                title={label + " (Modo Apresentador)"}
                className={cn(
                    "flex items-center w-full text-left gap-3 px-3 py-2 rounded-lg transition-all min-h-[40px]",
                    isPrivacyMode
                        ? "bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 font-medium"
                        : "hover:bg-slate-100 dark:hover:bg-white/5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-amber-400",
                    className
                )}
            >
                <div className="shrink-0 flex items-center justify-center w-5 h-5">
                    <Icon size={18} strokeWidth={isPrivacyMode ? 2.5 : 2} />
                </div>
                <span className="truncate text-sm">{isPrivacyMode ? "Modo Protegido" : "Modo Privacidade"}</span>
            </button>
        );
    }

    return (
        <button
            onClick={togglePrivacyMode}
            title={label + " (Cmd+Shift+P)"}
            className={cn(
                "flex items-center justify-center transition-all p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500/20",
                isPrivacyMode
                    ? "bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted",
                className
            )}
        >
            <Icon size={18} />
            {variant === 'full' && (
                <span className="ml-2 text-sm font-medium hidden sm:inline-block">
                    {isPrivacyMode ? "Ocultar Dados" : "Exibir Dados"}
                </span>
            )}
        </button>
    );
}
