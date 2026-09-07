import { useState } from "react";
import { useCRM } from "@/contexts/CRMContext";
import { Eye, EyeOff, Shield } from "lucide-react";

export function PrivacyBanner() {
    const {
        isPrivacyMode,
        isAllTemporarilyRevealed,
        revealAllTemporarily,
        hideAllRevealed
    } = useCRM();
    const [isPopoverOpen, setIsPopoverOpen] = useState(false);

    if (!isPrivacyMode) return null;

    return (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-top-4 fade-in duration-300">
            <div className="relative">
                <button
                    onClick={() => setIsPopoverOpen(prev => !prev)}
                    className="bg-amber-100/95 dark:bg-amber-900/60 border border-amber-200/70 dark:border-amber-700/50 text-amber-800 dark:text-amber-200 px-4 py-1.5 rounded-full shadow-sm flex items-center gap-2 text-xs font-semibold cursor-pointer hover:bg-amber-200/80 transition-colors"
                >
                    <EyeOff size={13} />
                    <span>Modo de Privacidade Ativo</span>
                </button>

                {isPopoverOpen && (
                    <>
                        <div
                            className="fixed inset-0 z-40"
                            onClick={() => setIsPopoverOpen(false)}
                        />
                        <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-card border border-border rounded-xl shadow-xl p-4 w-[280px] z-50 text-left animate-in fade-in zoom-in-95 duration-150">
                            <div className="flex items-center gap-2 mb-1.5">
                                <Shield size={16} className="text-blue-600" />
                                <span className="font-bold text-sm text-foreground">Modo de Privacidade</span>
                            </div>
                            <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                                Os nomes das clínicas estão ocultos para maior segurança.
                            </p>
                            <button
                                onClick={() => {
                                    if (isAllTemporarilyRevealed) {
                                        hideAllRevealed();
                                    } else {
                                        revealAllTemporarily(5);
                                    }
                                    setIsPopoverOpen(false);
                                }}
                                className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:underline cursor-pointer"
                            >
                                <Eye size={13} />
                                {isAllTemporarilyRevealed ? "Ocultar nomes novamente" : "Revelar nomes temporariamente"}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
