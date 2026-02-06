import React from 'react'
import ReactDOM from 'react-dom/client'
import CRMApp from './CRMApp.tsx'
import './index.css'

import { ThemeProvider } from "@/components/theme-provider"

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <ThemeProvider defaultTheme="system" storageKey="crm_theme_mode">
            <CRMApp />
        </ThemeProvider>
    </React.StrictMode>,
)
