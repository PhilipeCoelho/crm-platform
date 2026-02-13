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

    // Unified sync function
    const syncWithRemote = (session: any) => {
        const remoteTheme = session?.user?.user_metadata?.theme as Theme;
        if (remoteTheme && (remoteTheme === "light" || remoteTheme === "dark" || remoteTheme === "system")) {
            if (remoteTheme !== theme) {
                console.log('🌓 Theme synced from remote:', remoteTheme);
                localStorage.setItem(storageKey, remoteTheme);
                setThemeState(remoteTheme);
            }
        }
    };

    // Listen for Auth Changes to sync theme from user_metadata
    useEffect(() => {
        // Initial Fetch
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) syncWithRemote(session);
        });

        // Auth Listener
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (session && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'USER_UPDATED')) {
                syncWithRemote(session);
            }
        });

        // Browser Focus Sync (Helpful for multi-device live sync)
        const handleFocus = () => {
            supabase.auth.getSession().then(({ data: { session } }) => {
                if (session) syncWithRemote(session);
            });
        };

        window.addEventListener('focus', handleFocus);

        return () => {
            subscription.unsubscribe();
            window.removeEventListener('focus', handleFocus);
        };
    }, [theme]); // Re-bind if theme changes to avoid stale checks

    useEffect(() => {
        const root = window.document.documentElement

        // Remove old classes
        root.classList.remove("light", "dark")

        if (theme === "system") {
            const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
                .matches
                ? "dark"
                : "light"

            root.classList.add(systemTheme)
            return
        }

        root.classList.add(theme)
    }, [theme])

    const value = {
        theme,
        setTheme: async (newTheme: Theme) => {
            localStorage.setItem(storageKey, newTheme)
            setThemeState(newTheme)

            // Sync to cloud if logged in
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                const { error } = await supabase.auth.updateUser({
                    data: { theme: newTheme }
                });
                if (error) console.error('❌ Error syncing theme to cloud:', error);
                else console.log('✅ Theme synced to cloud:', newTheme);
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
