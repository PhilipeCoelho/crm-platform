import { memo, useMemo } from "react";
import { useCRM } from "@/contexts/CRMContext";
import { cn } from "@/lib/utils";
import { Eye, EyeOff } from "lucide-react";

interface PrivacyMaskProps {
    children: React.ReactNode;
    fallback?: React.ReactNode;
    className?: string;
    width?: string | number;
    blur?: boolean;
}

/**
 * Component to mask sensitive data when Privacy Mode is active.
 * 
 * @param children The content to display when privacy mode is OFF.
 * @param fallback The content to display when privacy mode is ON. Defaults to a blur effect or skeleton.
 * @param className Additional classes for the wrapper.
 * @param width Optional fixed width for skeleton mode.
 * @param blur If true, applies a CSS blur filter instead of replacing content.
 */
export function PrivacyMask({
    children,
    fallback,
    className,
    width,
    blur = false
}: PrivacyMaskProps) {
    const { isPrivacyMode } = useCRM();

    if (!isPrivacyMode) {
        return <>{children}</>;
    }

    if (blur) {
        return (
            <span className={cn("filter blur-[6px] select-none transition-all duration-300", className)} aria-hidden="true">
                {children}
            </span>
        );
    }

    if (fallback) {
        return (
            <span className={cn("text-muted-foreground/50 italic text-[0.9em] select-none", className)} title="Oculto pelo Modo Privacidade">
                {fallback}
            </span>
        );
    }

    // Default Skeleton style
    return (
        <span
            className={cn("inline-block h-[1em] bg-slate-200 dark:bg-slate-700/50 rounded animate-pulse align-middle select-none", className)}
            style={{ width: width || '80%' }}
            title="Oculto pelo Modo Privacidade"
        />
    );
}

// Specialized masks for common types
export const PrivacyText = memo(function PrivacyText({ text, type = 'text', className }: { text: string; type?: 'name' | 'email' | 'phone' | 'company' | 'text'; className?: string }) {
    const { isPrivacyMode } = useCRM();

    if (!isPrivacyMode) return <span className={className}>{text}</span>;

    let masked = "";
    switch (type) {
        case 'email':
            masked = "••••••";
            break;
        case 'phone':
            masked = "••••••";
            break;
        case 'company':
            masked = "••••••";
            break;
        case 'name':
        default:
            masked = "••••••";
            break;
    }

    return (
        <span className={cn("text-muted-foreground/60 select-none", className)} title="Dado oculto">
            {masked}
        </span>
    );
});

/**
 * Splits activity title into action prefix (e.g. "Ligar para ", "Enviar e-mail para ")
 * and the target clinic/company/client name.
 */
function parseActivityTitle(title: string, activityType?: string): { actionPrefix: string; targetName: string } {
    if (!title) return { actionPrefix: '', targetName: '' };

    const prefixRegex = /^(Ligar(?:\s+(?:para(?:\s+[ao]s?)?|a|com))?|Ligação(?:\s+(?:para(?:\s+[ao]s?)?|a|com))?|Chamada(?:\s+(?:para(?:\s+[ao]s?)?|a|com))?|Enviar\s+(?:e-?mail|mensagem|proposta)(?:\s+(?:para(?:\s+[ao]s?)?|a))?|E-?mail(?:\s+(?:para(?:\s+[ao]s?)?|a))?|Mensagem(?:\s+(?:para(?:\s+[ao]s?)?|a|com))?|WhatsApp(?:\s+(?:para(?:\s+[ao]s?)?|a|com))?|Reunião(?:\s+(?:com(?:\s+[ao]s?)?|para))?|Contato(?:\s+(?:com(?:\s+[ao]s?)?|para))?|Contacto(?:\s+(?:com(?:\s+[ao]s?)?|para))?|Auditoria(?:\s+para)?|Análise(?:\s+para)?|Tarefa(?:\s+para)?|Follow-?up(?:\s+(?:com|para))?|Visita(?:\s+(?:a|para))?|Lembrete(?:\s+(?:para|de))?)(?::|\s+|-|–)/i;

    const match = title.match(prefixRegex);
    if (match) {
        let prefix = match[0].trim();
        // Capitalize first letter cleanly
        prefix = prefix.charAt(0).toUpperCase() + prefix.slice(1);
        let target = title.slice(match[0].length).trim();
        target = target.replace(/^[-–:]\s*/, '');
        return {
            actionPrefix: `${prefix} `,
            targetName: target
        };
    }

    // Check for delimiter like ": " or " - "
    const sepMatch = title.match(/^([^:\-–]{2,20})[:\-–]\s*(.+)$/);
    if (sepMatch) {
        let prefix = sepMatch[1].trim();
        prefix = prefix.charAt(0).toUpperCase() + prefix.slice(1);
        return {
            actionPrefix: `${prefix} `,
            targetName: sepMatch[2].trim()
        };
    }

    // Fallback based on activityType if available
    if (activityType) {
        const typeActionMap: Record<string, string> = {
            call: 'Ligar para ',
            message: 'Mensagem para ',
            email: 'Enviar e-mail para ',
            meeting: 'Reunião com ',
            task: 'Tarefa: ',
            analysis: 'Análise: ',
            audit: 'Auditoria: '
        };
        const defaultAction = typeActionMap[activityType];
        if (defaultAction) {
            return {
                actionPrefix: defaultAction,
                targetName: title.trim()
            };
        }
    }

    return {
        actionPrefix: '',
        targetName: title
    };
}

/**
 * Helper to get 2-letter uppercase initials from clinic / company name
 */
export function getInitials(name: string): string {
    if (!name) return 'CL';
    const clean = name
        .replace(/^(clínica\s+dentária|clinica\s+dentaria|clínica|clinica|dr\.|dra\.|consultório|consultorio|instituto)\s+/i, '')
        .trim();
    const words = (clean || name).split(/\s+/).filter(w => w.length >= 2);
    if (words.length >= 2) {
        return (words[0][0] + words[1][0]).toUpperCase();
    }
    if (words.length === 1 && words[0].length >= 2) {
        return words[0].slice(0, 2).toUpperCase();
    }
    return (clean || name).slice(0, 2).toUpperCase();
}

/**
 * Masked clinic badge with initials avatar + dots + eye reveal toggle
 */
export const PrivacyMaskedName = memo(function PrivacyMaskedName({
    id,
    name,
    className,
    showInitials = true
}: {
    id?: string;
    name: string;
    className?: string;
    showInitials?: boolean;
}) {
    const {
        isPrivacyMode,
        revealedPrivacyIds,
        toggleRevealPrivacyId,
        isAllTemporarilyRevealed
    } = useCRM();

    const isRevealed = Boolean(
        !isPrivacyMode ||
        isAllTemporarilyRevealed ||
        (id && revealedPrivacyIds.includes(id))
    );

    if (isRevealed) {
        return (
            <span className={cn("inline-flex items-center gap-2 align-middle", className)}>
                {showInitials && (
                    <span className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0 select-none">
                        {getInitials(name)}
                    </span>
                )}
                <span className="text-xs font-semibold text-foreground">{name}</span>
                {isPrivacyMode && id && (
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            toggleRevealPrivacyId(id);
                        }}
                        className="text-muted-foreground/60 hover:text-foreground p-1 rounded hover:bg-muted/50 transition-colors cursor-pointer"
                        title="Ocultar nome novamente"
                    >
                        <Eye size={13} />
                    </button>
                )}
            </span>
        );
    }

    return (
        <span className={cn("inline-flex items-center gap-2 align-middle", className)}>
            {showInitials && (
                <span className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0 select-none">
                    {getInitials(name)}
                </span>
            )}
            <span className="text-xs font-mono font-bold tracking-[0.25em] text-slate-700 dark:text-slate-300 select-none">
                ••••••••
            </span>
            {id && (
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        toggleRevealPrivacyId(id);
                    }}
                    className="text-muted-foreground/50 hover:text-foreground p-1 rounded hover:bg-muted/50 transition-colors cursor-pointer"
                    title="Clique para revelar temporariamente"
                >
                    <EyeOff size={13} />
                </button>
            )}
        </span>
    );
});

/**
 * Renders an activity title with the clinic/target name masked as in the mockup:
 * Line 1: Action prefix ("Ligar para", "Mensagem para", etc.)
 * Line 2: Initials avatar + dots + eye toggle button
 */
export const PrivacyActivityTitle = memo(function PrivacyActivityTitle({
    id,
    title,
    activityType,
    className
}: {
    id?: string;
    title: string;
    activityType?: string;
    className?: string;
}) {
    const { isPrivacyMode } = useCRM();
    const { actionPrefix, targetName } = useMemo(() => parseActivityTitle(title, activityType), [title, activityType]);

    if (!isPrivacyMode) {
        return <span className={className}>{title}</span>;
    }

    if (!targetName) {
        return <span className={className}>{title}</span>;
    }

    return (
        <div className={cn("flex flex-col gap-1.5 w-full", className)}>
            <div className="font-bold text-foreground text-[12px] sm:text-[11px] leading-tight">
                {actionPrefix.trim() || title}
            </div>
            <div className="flex items-center gap-2">
                <PrivacyMaskedName id={id} name={targetName} showInitials={true} />
            </div>
        </div>
    );
});



