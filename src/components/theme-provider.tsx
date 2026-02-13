import { createContext, useContext, useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

type Theme = "dark" | "light" | "system"

type ThemeProviderProps = {
    children: React.ReactNode
    defaultTheme?: Theme
    storageKey?: string
}

type ThemeProviderState = {
    theme: Theme
    setTheme: (theme: Theme) => void
}

const initialState: ThemeProviderState = {
    theme: "system",
    setTheme: () => null,
}

const ThemeProviderContext = createContext<ThemeProviderState>(initialState)

export function ThemeProvider({
    children,
    defaultTheme = "dark",
    storageKey = "crm_theme_preference_v2",
}: ThemeProviderProps) {
    const [theme, setThemeState] = useState<Theme>(
        () => (localStorage.getItem(storageKey) as Theme) || defaultTheme
    )

    // Sync function with better validation
    const syncWithRemote = (session: any) => {
        const metadata = session?.user?.user_metadata;
        if (!metadata || !metadata.theme) return;

        const remoteTheme = metadata.theme as Theme;
        const validThemes: Theme[] = ["light", "dark", "system"];

        if (validThemes.includes(remoteTheme) && remoteTheme !== theme) {
            console.log('🌓 Theme synced from cloud:', remoteTheme);
            localStorage.setItem(storageKey, remoteTheme);
            setThemeState(remoteTheme);
        }
    };

    // Aggressive sync effect
    useEffect(() => {
        // 1. Initial manual fetch
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) syncWithRemote(session);
        });

        // 2. Auth changes (Login/Update)
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (session && (event === 'SIGNED_IN' || event === 'USER_UPDATED' || event === 'INITIAL_SESSION')) {
                // For USER_UPDATED, metadata might be in session.user
                syncWithRemote(session);
            }
        });

        // 3. Focus recovery (Multi-device behavior)
        const handleFocus = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) syncWithRemote(session);
        };

        window.addEventListener('focus', handleFocus);
        return () => {
            subscription.unsubscribe();
            window.removeEventListener('focus', handleFocus);
        };
    }, [theme]); // Check against current theme state

    // Real-time DOM and System preference listener
    useEffect(() => {
        const root = window.document.documentElement
        root.classList.remove("light", "dark")

        if (theme === "system") {
            const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")

            const updateAppearance = () => {
                const systemTheme = mediaQuery.matches ? "dark" : "light"
                root.classList.remove("light", "dark")
                root.classList.add(systemTheme)
            }

            updateAppearance()
            mediaQuery.addEventListener("change", updateAppearance)
            return () => mediaQuery.removeEventListener("change", updateAppearance)
        }

        root.classList.add(theme)
    }, [theme])

    const value = {
        theme,
        setTheme: async (newTheme: Theme) => {
            localStorage.setItem(storageKey, newTheme)
            setThemeState(newTheme)

            // Persistence in Supabase
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                console.log('📤 Syncing theme to cloud...', newTheme);
                const { error } = await supabase.auth.updateUser({
                    data: { theme: newTheme }
                });

                if (error) {
                    console.error('❌ Cloud sync error:', error.message);
                } else {
                    console.log('✅ Cloud sync complete');
                }
            }
        },
    }

    return (
        <ThemeProviderContext.Provider value={value}>
            {children}
        </ThemeProviderContext.Provider>
    )
}

export const useTheme = () => {
    const context = useContext(ThemeProviderContext)

    if (context === undefined)
        throw new Error("useTheme must be used within a ThemeProvider")

    return context
}
