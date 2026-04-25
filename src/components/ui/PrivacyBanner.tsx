import { useCRM } from "@/contexts/CRMContext";
import { EyeOff } from "lucide-react";

export function PrivacyBanner() {
    const { isPrivacyMode } = useCRM();

    if (!isPrivacyMode) return null;

    return (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-top-4 fade-in duration-300 pointer-events-none">
            <div className="bg-amber-100/90 dark:bg-amber-900/40 border border-amber-200/50 dark:border-amber-700/30 text-amber-800 dark:text-amber-200 px-4 py-1.5 rounded-full shadow-sm flex items-center gap-2 text-xs font-medium">
                <EyeOff size={12} />
                <span>Modo de Privacidade Ativo</span>
            </div>
        </div>
    );
}
