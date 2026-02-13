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

    // Listen for Auth Changes to sync theme from user_metadata
    useEffect(() => {
        const fetchRemoteTheme = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user?.user_metadata?.theme) {
                const remoteTheme = session.user.user_metadata.theme as Theme;
                if (remoteTheme !== theme) {
                    localStorage.setItem(storageKey, remoteTheme);
                    setThemeState(remoteTheme);
                }
            }
        };

        fetchRemoteTheme();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session?.user?.user_metadata?.theme) {
                const remoteTheme = session.user.user_metadata.theme as Theme;
                localStorage.setItem(storageKey, remoteTheme);
                setThemeState(remoteTheme);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

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
                await supabase.auth.updateUser({
                    data: { theme: newTheme }
                });
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
