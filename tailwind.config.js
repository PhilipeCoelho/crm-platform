/** @type {import('tailwindcss').Config} - Force Cache Invalidation V1 */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: "class",
    theme: {
        extend: {
            colors: {
                background: "hsl(var(--background))",
                foreground: "hsl(var(--foreground))",
                main: "hsl(var(--bg-main))",
                surface: "hsl(var(--surface))",
                card: "hsl(var(--card))",
                divider: "hsl(var(--divider))",
                "card-foreground": "hsl(var(--card-foreground))",
                popover: "hsl(var(--popover))",
                "popover-foreground": "hsl(var(--popover-foreground))",
                primary: "hsl(var(--primary))",
                "primary-foreground": "hsl(var(--primary-foreground))",
                secondary: "hsl(var(--secondary))",
                "secondary-foreground": "hsl(var(--secondary-foreground))",
                muted: "hsl(var(--muted))",
                "muted-foreground": "hsl(var(--muted-foreground))",
                accent: "hsl(var(--accent))",
                "accent-foreground": "hsl(var(--accent-foreground))",
                destructive: "hsl(var(--destructive))",
                "destructive-foreground": "hsl(var(--destructive-foreground))",
                border: "hsl(var(--border))",
                input: "hsl(var(--input))",
                ring: "hsl(var(--ring))",
                success: "hsl(var(--success))",
                warning: "hsl(var(--warning))",
                info: "hsl(var(--info))",
                disabled: "hsl(var(--text-disabled))",
                meta: "hsl(var(--text-meta))",
            }
        },
    },
    plugins: [],
}
