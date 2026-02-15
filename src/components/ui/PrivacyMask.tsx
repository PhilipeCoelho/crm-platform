import { useCRM } from "@/contexts/CRMContext";
import { cn } from "@/lib/utils";

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
export function PrivacyText({ text, type = 'text', className }: { text: string; type?: 'name' | 'email' | 'phone' | 'company' | 'text'; className?: string }) {
    const { isPrivacyMode } = useCRM();

    if (!isPrivacyMode) return <span className={className}>{text}</span>;

    let masked = "";
    switch (type) {
        case 'email':
            const [user, domain] = text.split('@');
            masked = `${user?.[0] || 'u'}***@${domain || '***.com'}`;
            break;
        case 'phone':
            masked = text.replace(/[\d]/g, '*').slice(0, 12) || "**** *** ***";
            break;
        case 'company':
            masked = "Empresa Confidencial";
            break;
        case 'name':
        default:
            masked = "Contato Oculto";
            break;
    }

    return (
        <span className={cn("text-muted-foreground/60 italic select-none", className)} title="Dado oculto">
            {masked}
        </span>
    );
}
