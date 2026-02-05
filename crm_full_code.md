# Full Codebase Export

## File: package.json
```typescript
{
  "name": "crm-platform",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.2.1",
    "lucide-react": "^0.344.0",
    "date-fns": "^3.3.1",
    "@dnd-kit/core": "^6.1.0",
    "@dnd-kit/sortable": "^8.0.0",
    "@dnd-kit/utilities": "^3.2.2"
  },
  "devDependencies": {
    "@types/react": "^18.2.56",
    "@types/react-dom": "^18.2.19",
    "@typescript-eslint/eslint-plugin": "^7.0.2",
    "@typescript-eslint/parser": "^7.0.2",
    "@vitejs/plugin-react": "^4.2.1",
    "autoprefixer": "^10.4.18",
    "eslint": "^8.56.0",
    "eslint-plugin-react-hooks": "^4.6.0",
    "eslint-plugin-react-refresh": "^0.4.5",
    "postcss": "^8.4.35",
    "tailwindcss": "^3.4.1",
    "typescript": "^5.2.2",
    "vite": "^5.1.4"
  }
}
```

## File: tsconfig.json
```typescript
{
    "compilerOptions": {
        "target": "ES2020",
        "useDefineForClassFields": true,
        "lib": [
            "ES2020",
            "DOM",
            "DOM.Iterable"
        ],
        "module": "ESNext",
        "skipLibCheck": true,
        /* Bundler mode */
        "moduleResolution": "bundler",
        "allowImportingTsExtensions": true,
        "resolveJsonModule": true,
        "isolatedModules": true,
        "noEmit": true,
        "jsx": "react-jsx",
        /* Linting */
        "strict": true,
        "noUnusedLocals": true,
        "noUnusedParameters": true,
        "noFallthroughCasesInSwitch": true,
        "baseUrl": ".",
        "paths": {
            "@/*": [
                "./src/*"
            ]
        }
    },
    "include": [
        "src"
    ],
    "references": [
        {
            "path": "./tsconfig.node.json"
        }
    ]
}```

## File: vite.config.ts
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
```

## File: tailwind.config.js
```typescript
/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                background: "hsl(var(--background))",
                foreground: "hsl(var(--foreground))",
                card: "hsl(var(--card))",
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
            }
        },
    },
    plugins: [],
}
```

## File: index.html
```typescript
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>CRM Platform</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

## File: src/App.tsx
```typescript
import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Users, CheckSquare, Settings, Menu, Building, PlusCircle, LogOut, ChevronDown, ChevronRight, CheckSquare as CheckIcon } from 'lucide-react';
import KanbanBoard from '@/components/kanban/KanbanBoard';
import ContactList from '@/components/contacts/ContactList';
import Login from '@/pages/Login';
import Onboarding from '@/pages/Onboarding';
import { currencies, Currency } from '@/data/currencies';

type View = 'pipelines' | 'contacts' | 'activities';

interface UserProfile {
    id: string;
    companyName: string;
    // ... other fields
}

function App() {
    // Initialize auth state from localStorage
    const [isAuthenticated, setIsAuthenticated] = useState(() => {
        return localStorage.getItem('crm_auth') === 'true';
    });

    const [currentView, setCurrentView] = useState<View>('pipelines');
    const [profiles, setProfiles] = useState<UserProfile[]>([]);
    const [currentProfileId, setCurrentProfileId] = useState<string | null>(null);
    const [showOnboarding, setShowOnboarding] = useState(false);
    const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

    // Currency Settings State
    const [selectedCurrency, setSelectedCurrency] = useState<Currency>(currencies[0]); // Default EUR
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isCurrencySubmenuOpen, setIsCurrencySubmenuOpen] = useState(false);

    // Load state from local storage on mount
    useEffect(() => {
        // Load profiles
        try {
            const savedProfiles = JSON.parse(localStorage.getItem('crm_profiles') || '[]');
            setProfiles(savedProfiles);
            if (savedProfiles.length > 0) {
                // If we are already authenticated (from reload), set the profile
                // otherwise it will be set on login
                if (!currentProfileId) {
                    setCurrentProfileId(savedProfiles[0].id);
                }
            }
        } catch (e) {
            console.error("Failed to parse profiles", e);
            setProfiles([]);
        }
    }, [isAuthenticated]); // Re-run if auth changes to ensure profile is set

    const handleLogin = () => {
        setIsAuthenticated(true);
        localStorage.setItem('crm_auth', 'true');

        // Check if user has any profiles
        try {
            const savedProfiles = JSON.parse(localStorage.getItem('crm_profiles') || '[]');
            if (savedProfiles.length === 0) {
                setShowOnboarding(true);
            } else {
                setProfiles(savedProfiles);
                setCurrentProfileId(savedProfiles[0].id);
            }
        } catch (e) {
            setProfiles([]);
            setShowOnboarding(true);
        }
    };

    const handleCreateProfile = (data: any) => {
        const newProfile: UserProfile = {
            id: Math.random().toString(36).substr(2, 9),
            companyName: data.companyName,
            ...data
        };
        const updatedProfiles = [...profiles, newProfile];
        setProfiles(updatedProfiles);
        setCurrentProfileId(newProfile.id);
        localStorage.setItem('crm_profiles', JSON.stringify(updatedProfiles));

        setShowOnboarding(false);
    };

    const handleSwitchProfile = (profileId: string) => {
        setCurrentProfileId(profileId);
        setIsProfileMenuOpen(false);
    };

    const handleLogout = () => {
        setIsAuthenticated(false);
        setCurrentProfileId(null);
        localStorage.removeItem('crm_auth');
    };

    if (!isAuthenticated) {
        return <Login onLogin={handleLogin} />;
    }

    if (showOnboarding) {
        return (
            <Onboarding
                onComplete={handleCreateProfile}
                onCancel={profiles.length > 0 ? () => setShowOnboarding(false) : undefined}
            />
        );
    }

    const currentProfile = profiles.find(p => p.id === currentProfileId);

    return (
        <div className="flex h-screen bg-background text-foreground">
            {/* Sidebar */}
            <aside className="w-64 border-r border-border bg-card hidden md:flex flex-col">
                <div className="p-4 border-b border-border">
                    {/* Profile Switcher */}
                    <div className="relative">
                        <button
                            onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                            className="w-full flex items-center justify-between p-2 rounded-md hover:bg-muted transition-colors border border-transparent hover:border-border"
                        >
                            <div className="flex items-center gap-3 overflow-hidden">
                                <div className="w-8 h-8 rounded bg-primary text-primary-foreground flex items-center justify-center font-bold shrink-0">
                                    {currentProfile?.companyName?.substring(0, 2).toUpperCase() || 'CP'}
                                </div>
                                <div className="flex flex-col items-start min-w-0">
                                    <span className="text-sm font-medium truncate w-full text-left">{currentProfile?.companyName || 'Meu CRM'}</span>
                                    <span className="text-xs text-muted-foreground">Plano Grátis</span>
                                </div>
                            </div>
                            <ChevronDown size={14} className="text-muted-foreground shrink-0 ml-1" />
                        </button>

                        {isProfileMenuOpen && (
                            <div className="absolute top-full left-0 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg z-50 py-1">
                                <div className="px-2 py-1 text-xs text-muted-foreground font-medium uppercase tracking-wider">
                                    Minhas Organizações
                                </div>
                                {profiles.map(p => (
                                    <button
                                        key={p.id}
                                        onClick={() => handleSwitchProfile(p.id)}
                                        className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-muted ${currentProfileId === p.id ? 'text-primary font-medium' : ''}`}
                                    >
                                        <Building size={14} />
                                        {p.companyName}
                                    </button>
                                ))}
                                <div className="h-px bg-border my-1"></div>
                                <button
                                    onClick={() => {
                                        setShowOnboarding(true);
                                        setIsProfileMenuOpen(false);
                                    }}
                                    className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-muted text-foreground"
                                >
                                    <PlusCircle size={14} />
                                    Criar Nova Empresa
                                </button>
                                <button
                                    onClick={handleLogout}
                                    className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-red-50 text-red-600 dark:hover:bg-red-900/10"
                                >
                                    <LogOut size={14} />
                                    Sair
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                    <button
                        onClick={() => setCurrentView('pipelines')}
                        className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors ${currentView === 'pipelines' ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-muted-foreground'}`}
                    >
                        <LayoutDashboard size={20} />
                        Pipelines
                    </button>
                    <button
                        onClick={() => setCurrentView('contacts')}
                        className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors ${currentView === 'contacts' ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-muted-foreground'}`}
                    >
                        <Users size={20} />
                        Contatos
                    </button>
                    <button
                        onClick={() => setCurrentView('activities')}
                        className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors ${currentView === 'activities' ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-muted-foreground'}`}
                    >
                        <CheckSquare size={20} />
                        Atividades
                    </button>
                </nav>

                <div className="p-4 border-t border-border relative">
                    <button
                        onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                        className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md hover:bg-muted text-muted-foreground transition-colors"
                    >
                        <Settings size={20} />
                        Configurações
                    </button>

                    {/* Settings Popover */}
                    {isSettingsOpen && (
                        <div className="absolute bottom-full left-4 mb-2 w-64 bg-popover border border-border rounded-lg shadow-xl z-50">
                            <div className="p-3 border-b border-border">
                                <h3 className="font-medium text-sm">Configurações</h3>
                            </div>
                            <div className="p-2">
                                <button
                                    onClick={() => setIsCurrencySubmenuOpen(!isCurrencySubmenuOpen)}
                                    className="w-full flex items-center justify-between px-2 py-2 text-sm font-medium hover:bg-muted rounded-md transition-colors"
                                >
                                    <span className="flex items-center gap-2">
                                        <div className="w-1 h-4 bg-primary/50 rounded-full"></div>
                                        Moedas Principais
                                    </span>
                                    <ChevronRight size={14} className={`transition-transform duration-200 ${isCurrencySubmenuOpen ? 'rotate-90' : ''}`} />
                                </button>

                                {isCurrencySubmenuOpen && (
                                    <div className="mt-1 pl-2 space-y-0.5 animate-in slide-in-from-top-1 fade-in duration-200">
                                        {currencies.map(currency => (
                                            <button
                                                key={currency.code}
                                                onClick={() => {
                                                    setSelectedCurrency(currency);
                                                    setIsSettingsOpen(false);
                                                }}
                                                className="w-full text-left px-3 py-1.5 hover:bg-muted rounded-md text-xs flex items-center justify-between text-muted-foreground hover:text-foreground"
                                            >
                                                <span>{currency.name} ({currency.symbol})</span>
                                                {selectedCurrency.code === currency.code && <CheckIcon size={12} className="text-primary" />}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            {/* Backdrop to close */}
                            <div
                                className="fixed inset-0 z-[-1] bg-transparent"
                                onClick={() => setIsSettingsOpen(false)}
                            />
                        </div>
                    )}
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <header className="h-16 border-b border-border bg-card flex items-center justify-between px-6 shrink-0">
                    <div className="md:hidden">
                        <Menu className="text-muted-foreground" />
                    </div>
                    <div className="flex items-center gap-4">
                        {/* Header content placeholder */}
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                            {currentProfile?.companyName?.substring(0, 1).toUpperCase() || 'U'}
                        </div>
                    </div>
                </header>

                {/* Dynamic View Area */}
                <div className="flex-1 overflow-auto p-6">
                    <div className="max-w-6xl mx-auto h-full">
                        {currentView === 'pipelines' && (
                            <>
                                <h2 className="text-2xl font-bold mb-6">Pipeline de Vendas</h2>
                                <div className="h-[calc(100vh-160px)]">
                                    <KanbanBoard currency={selectedCurrency} />
                                </div>
                            </>
                        )}

                        {currentView === 'contacts' && (
                            <ContactList />
                        )}

                        {currentView === 'activities' && (
                            <div className="flex items-center justify-center h-full text-muted-foreground">
                                Em breve: Módulo de Atividades
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    )
}

export default App;
```

## File: src/components/contacts/ContactList.tsx
```typescript
import React, { useState } from 'react';
import { Contact } from '@/types';
import { Search, Filter, Plus, MoreHorizontal, Mail, Phone } from 'lucide-react';
import NewContactModal from './NewContactModal';

const defaultContacts: Contact[] = [
    { id: 1, name: 'Ana Silva', email: 'ana.silva@techcorp.com', phone: '+55 11 99999-0001', role: 'CTO', companyName: 'TechCorp', status: 'active', lastActivity: '2023-10-25' },
    { id: 2, name: 'Carlos Souza', email: 'carlos@logistics.sa', phone: '+55 11 98888-0002', role: 'Diretor de Compras', companyName: 'Logistics SA', status: 'lead', lastActivity: '2023-10-20' },
    { id: 3, name: 'Beatriz Costa', email: 'bia@ecommstore.com.br', role: 'Marketing Manager', companyName: 'E-comm Store', status: 'active', lastActivity: '2023-10-26' },
    { id: 4, name: 'João Pereira', email: 'joao@fintechx.com', phone: '+55 21 97777-0003', role: 'CEO', companyName: 'Fintech X', status: 'inactive', lastActivity: '2023-09-15' },
];

export default function ContactList() {
    const [contacts, setContacts] = useState<Contact[]>(defaultContacts);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);

    const filteredContacts = contacts.filter(contact =>
        contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contact.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contact.companyName?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleCreateContact = (newContactData: Omit<Contact, 'id'>) => {
        const newContact: Contact = {
            ...newContactData,
            id: Math.random(), // Temporary ID generation
        };
        setContacts([newContact, ...contacts]);
    };

    return (
        <div className="h-full flex flex-col space-y-4">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Contatos</h2>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md flex items-center gap-2 text-sm font-medium transition-colors"
                >
                    <Plus size={16} />
                    Novo Contato
                </button>
            </div>

            {/* Filters Bar */}
            <div className="flex gap-4 items-center bg-card p-4 rounded-lg border border-border">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                    <input
                        type="text"
                        placeholder="Buscar por nome, email ou empresa..."
                        className="w-full pl-10 pr-4 py-2 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <button className="flex items-center gap-2 px-3 py-2 border border-input rounded-md hover:bg-muted transition-colors text-sm font-medium">
                    <Filter size={16} />
                    Filtros
                </button>
            </div>

            {/* Table */}
            <div className="bg-card rounded-lg border border-border flex-1 overflow-hidden flex flex-col">
                <div className="overflow-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-muted/50 text-muted-foreground font-medium uppercase text-xs border-b border-border">
                            <tr>
                                <th className="px-6 py-3">Nome</th>
                                <th className="px-6 py-3">Empresa</th>
                                <th className="px-6 py-3">Status</th>
                                <th className="px-6 py-3">Última Atividade</th>
                                <th className="px-6 py-3 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {filteredContacts.map((contact) => (
                                <tr key={contact.id} className="hover:bg-muted/30 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span className="font-medium text-foreground">{contact.name}</span>
                                            <span className="text-muted-foreground text-xs">{contact.email}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span className="text-foreground">{contact.companyName || '-'}</span>
                                            <span className="text-muted-foreground text-xs">{contact.role}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium
                      ${contact.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                                contact.status === 'lead' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                                    'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'}`}>
                                            {contact.status === 'active' ? 'Ativo' : contact.status === 'lead' ? 'Lead' : 'Inativo'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-muted-foreground">
                                        {contact.lastActivity ? new Date(contact.lastActivity).toLocaleDateString('pt-BR') : '-'}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button className="p-2 hover:bg-muted rounded-full text-muted-foreground hover:text-primary" title="Enviar Email">
                                                <Mail size={16} />
                                            </button>
                                            <button className="p-2 hover:bg-muted rounded-full text-muted-foreground hover:text-primary" title="Ligar">
                                                <Phone size={16} />
                                            </button>
                                            <button className="p-2 hover:bg-muted rounded-full text-muted-foreground hover:text-foreground">
                                                <MoreHorizontal size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <NewContactModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleCreateContact}
            />
        </div>
    );
}
```

## File: src/components/contacts/NewContactModal.tsx
```typescript
import React, { useState } from 'react';
import Modal from '@/components/ui/Modal';
import { Contact, Id } from '@/types';
import PhoneInput from '@/components/ui/PhoneInput';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSave: (contact: Omit<Contact, 'id'>) => void;
}

export default function NewContactModal({ isOpen, onClose, onSave }: Props) {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        role: '',
        companyName: '',
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({
            ...formData,
            status: 'lead',
            lastActivity: new Date().toISOString(),
        });
        setFormData({ name: '', email: '', phone: '', role: '', companyName: '' }); // Reset
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Novo Contato">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium mb-1">Nome Completo</label>
                    <input
                        required
                        type="text"
                        className="w-full px-3 py-2 border border-input rounded-md bg-transparent focus:outline-none focus:ring-2 focus:ring-ring"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1">Email</label>
                    <input
                        required
                        type="email"
                        className="w-full px-3 py-2 border border-input rounded-md bg-transparent focus:outline-none focus:ring-2 focus:ring-ring"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1">Telefone</label>
                    <PhoneInput
                        value={formData.phone}
                        onChange={(value) => setFormData({ ...formData, phone: value })}
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Cargo</label>
                        <input
                            type="text"
                            className="w-full px-3 py-2 border border-input rounded-md bg-transparent focus:outline-none focus:ring-2 focus:ring-ring"
                            value={formData.role}
                            onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Empresa</label>
                        <input
                            type="text"
                            className="w-full px-3 py-2 border border-input rounded-md bg-transparent focus:outline-none focus:ring-2 focus:ring-ring"
                            value={formData.companyName}
                            onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                        />
                    </div>
                </div>

                <div className="flex justify-end gap-3 mt-6 pt-2 border-t border-border">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
                    >
                        Salvar Contato
                    </button>
                </div>
            </form>
        </Modal>
    );
}
```

## File: src/components/kanban/KanbanBoard.tsx
```typescript
import { useMemo, useState, useEffect } from "react";
import { Column, Id, Task } from "@/types";
import KanbanColumn from "./KanbanColumn";
import {
    DndContext,
    DragEndEvent,
    DragOverEvent,
    DragOverlay,
    DragStartEvent,
    PointerSensor,
    useSensor,
    useSensors,
} from "@dnd-kit/core";
import { SortableContext, arrayMove } from "@dnd-kit/sortable";
import { createPortal } from "react-dom";
import KanbanCard from "./KanbanCard";
import NewDealModal from "./NewDealModal";
import { Plus, Filter } from "lucide-react";
import { Currency } from "@/data/currencies";

// Mock Data for Multiple Pipelines
const pipelinesData = {
    'sales': {
        id: 'sales',
        label: 'Funil de Vendas (Padrão)',
        columns: [
            { id: "new", title: "Lead Novo" },
            { id: "contacted", title: "Contactado" },
            { id: "proposal", title: "Proposta Enviada" },
            { id: "negotiation", title: "Negociação" },
        ]
    },
    'onboarding': {
        id: 'onboarding',
        label: 'Onboarding de Clientes',
        columns: [
            { id: "welcome", title: "Boas Vindas" },
            { id: "setup", title: "Configuração" },
            { id: "training", title: "Treinamento" },
            { id: "live", title: "Em Produção" },
        ]
    }
};

const defaultTasks: Task[] = [
    { id: "1", columnId: "new", content: "Implementar Design System", companyName: "TechCorp", value: 12000, priority: "high" },
    { id: "2", columnId: "new", content: "Atualizar Landing Page", companyName: "Logistics SA", value: 4500 },
    { id: "3", columnId: "contacted", content: "Consultoria de SEO", companyName: "E-comm Store", value: 2500 },
    { id: "4", columnId: "proposal", content: "Migração de Banco de Dados", companyName: "Fintech X", value: 35000, priority: "high" },
    { id: "5", columnId: "negotiation", content: "App Mobile V2", companyName: "Delivery App", value: 60000 },
    { id: "6", columnId: "welcome", content: "Novo Cliente: StartUp Z", companyName: "StartUp Z", value: 15000 },
];

interface KanbanBoardProps {
    currency: Currency;
}

function KanbanBoard({ currency }: KanbanBoardProps) {
    const [currentPipelineId, setCurrentPipelineId] = useState('sales');

    // Initialize pipelines from localStorage or use default
    const [pipelines, setPipelines] = useState(() => {
        const saved = localStorage.getItem('crm_pipelines');
        try {
            return saved ? JSON.parse(saved) : pipelinesData;
        } catch (e) {
            console.error("Error parsing pipelines from localStorage", e);
            return pipelinesData;
        }
    });

    // Save pipelines to localStorage whenever they change
    useEffect(() => {
        localStorage.setItem('crm_pipelines', JSON.stringify(pipelines));
    }, [pipelines]);

    // Get columns for current pipeline
    const columns = pipelines[currentPipelineId as keyof typeof pipelinesData].columns;

    const columnsId = useMemo(() => columns.map((col: Column) => col.id), [columns]);

    // Initialize tasks from localStorage or use default
    const [tasks, setTasks] = useState<Task[]>(() => {
        const saved = localStorage.getItem('crm_tasks');
        try {
            return saved ? JSON.parse(saved) : defaultTasks;
        } catch (e) {
            console.error("Error parsing tasks from localStorage", e);
            return defaultTasks;
        }
    });

    // Save tasks to localStorage whenever they change
    useEffect(() => {
        localStorage.setItem('crm_tasks', JSON.stringify(tasks));
    }, [tasks]);

    const [activeColumn, setActiveColumn] = useState<Column | null>(null);
    const [activeTask, setActiveTask] = useState<Task | null>(null);

    // New Deal Modal State
    const [isNewDealModalOpen, setIsNewDealModalOpen] = useState(false);
    const [newDealColumnId, setNewDealColumnId] = useState<Id | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 10,
            },
        })
    );

    // State to track newly added column for auto-focus
    const [lastAddedColumnId, setLastAddedColumnId] = useState<Id | null>(null);

    // Sync with other tabs
    useEffect(() => {
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === 'crm_pipelines' && e.newValue) {
                try {
                    setPipelines(JSON.parse(e.newValue));
                } catch (err) {
                    console.error("Sync error pipelines", err);
                }
            }
            if (e.key === 'crm_tasks' && e.newValue) {
                try {
                    setTasks(JSON.parse(e.newValue));
                } catch (err) {
                    console.error("Sync error tasks", err);
                }
            }
        };

        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, []);

    const updateColumn = (id: Id, title: string) => {
        const newColumns = columns.map((col: Column) => {
            if (col.id !== id) return col;
            return { ...col, title };
        });

        setPipelines({
            ...pipelines,
            [currentPipelineId]: {
                ...pipelines[currentPipelineId as keyof typeof pipelinesData],
                columns: newColumns
            }
        });
    };

    const addColumn = () => {
        const newColumnId = `col_${Math.random().toString(36).substr(2, 9)}`;
        const newColumn: Column = {
            id: newColumnId,
            title: `Nova Coluna`,
        };

        const newColumns = [...columns, newColumn];

        setPipelines({
            ...pipelines,
            [currentPipelineId]: {
                ...pipelines[currentPipelineId as keyof typeof pipelinesData],
                columns: newColumns
            }
        });
        setLastAddedColumnId(newColumnId);
    };

    const setColumns = (updateFn: (cols: Column[]) => Column[]) => {
        const newColumns = updateFn(columns);
        setPipelines({
            ...pipelines,
            [currentPipelineId]: {
                ...pipelines[currentPipelineId as keyof typeof pipelinesData],
                columns: newColumns
            }
        });
    }

    const openNewDealModal = (columnId: Id) => {
        setNewDealColumnId(columnId);
        setIsNewDealModalOpen(true);
    };

    const handleCreateDeal = (deal: { title: string; value: number; companyName: string }) => {
        if (!newDealColumnId) return;

        const newTask: Task = {
            id: `task_${Math.random().toString(36).substr(2, 9)}`,
            columnId: newDealColumnId,
            content: deal.title,
            companyName: deal.companyName,
            value: deal.value,
        };

        setTasks([...tasks, newTask]);
        setIsNewDealModalOpen(false);
        setNewDealColumnId(null);
    };

    return (
        <div className="flex flex-col h-full w-full overflow-hidden">
            {/* Header / Pipeline Selector */}
            <div className="px-6 py-4 border-b border-border flex items-center justify-end bg-card shrink-0">
                <div className="flex items-center gap-4">
                    <div className="relative group">
                        <div className="flex items-center gap-2 cursor-pointer px-3 py-1.5 hover:bg-muted rounded-md transition-colors border border-transparent hover:border-border">
                            <Filter size={18} className="text-muted-foreground" />
                            <span className="font-semibold text-lg">{pipelines[currentPipelineId as keyof typeof pipelinesData].label}</span>
                        </div>
                        <div className="absolute top-full right-0 mt-1 w-64 bg-popover border border-border rounded-lg shadow-xl py-1 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-all z-50">
                            <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Seus Pipelines</div>
                            {Object.values(pipelines).map((p: any) => (
                                <button
                                    key={p.id}
                                    onClick={() => setCurrentPipelineId(p.id)}
                                    className={`w-full text-left px-4 py-2 hover:bg-muted flex items-center justify-between ${currentPipelineId === p.id ? 'text-primary font-medium bg-primary/5' : ''}`}
                                >
                                    {p.label}
                                    {currentPipelineId === p.id && <div className="w-2 h-2 rounded-full bg-primary" />}
                                </button>
                            ))}
                            <div className="border-t border-border my-1"></div>
                            <button className="w-full text-left px-4 py-2 hover:bg-muted text-primary flex items-center gap-2 text-sm font-medium">
                                <Plus size={14} /> Novo Pipeline
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Kanban Content */}
            <div className="flex-1 p-6 w-full h-full overflow-hidden">
                <DndContext
                    sensors={sensors}
                    onDragStart={onDragStart}
                    onDragEnd={onDragEnd}
                    onDragOver={onDragOver}
                >
                    <div className="flex h-full gap-4 w-full">
                        <SortableContext items={columnsId}>
                            {columns.map((col: Column) => (
                                <KanbanColumn
                                    key={col.id}
                                    column={col}
                                    tasks={tasks.filter((task) => task.columnId === col.id)}
                                    updateColumn={updateColumn}
                                    onAdd={openNewDealModal}
                                    currency={currency}
                                    initialEditMode={col.id === lastAddedColumnId}
                                />
                            ))}
                        </SortableContext>

                        {/* Add Column Button */}
                        <div
                            className="shrink-0 w-[60px] cursor-pointer bg-transparent hover:bg-muted/50 rounded-lg border-2 border-dashed border-border/50 hover:border-border flex flex-col items-center justify-center transition-all h-[100px]"
                            onClick={addColumn}
                            title="Adicionar Coluna"
                        >
                            <Plus className="text-muted-foreground mb-1" />
                        </div>
                    </div>

                    {createPortal(
                        <DragOverlay>
                            {activeColumn && (
                                <KanbanColumn
                                    column={activeColumn}
                                    tasks={tasks.filter((task) => task.columnId === activeColumn.id)}
                                    updateColumn={updateColumn}
                                    onAdd={() => { }} // No-op for overlay
                                    currency={currency}
                                />
                            )}
                            {activeTask && <KanbanCard task={activeTask} currency={currency} />}
                        </DragOverlay>,
                        document.body
                    )}
                </DndContext>

                <NewDealModal
                    isOpen={isNewDealModalOpen}
                    onClose={() => setIsNewDealModalOpen(false)}
                    onSave={handleCreateDeal}
                    initialColumnId={newDealColumnId || undefined}
                />
            </div>
        </div>
    );

    function onDragStart(event: DragStartEvent) {
        if (event.active.data.current?.type === "Column") {
            setActiveColumn(event.active.data.current.column);
            return;
        }

        if (event.active.data.current?.type === "Task") {
            setActiveTask(event.active.data.current.task);
            return;
        }
    }

    function onDragEnd(event: DragEndEvent) {
        setActiveColumn(null);
        setActiveTask(null);

        const { active, over } = event;
        if (!over) return;

        const activeId = active.id;
        const overId = over.id;

        if (activeId === overId) return;

        const isActiveColumn = active.data.current?.type === "Column";
        if (!isActiveColumn) return;

        // Moving Columns
        setColumns((columns) => {
            const activeColumnIndex = columns.findIndex((col) => col.id === activeId);
            const overColumnIndex = columns.findIndex((col) => col.id === overId);

            return arrayMove(columns, activeColumnIndex, overColumnIndex);
        });
    }

    function onDragOver(event: DragOverEvent) {
        const { active, over } = event;
        if (!over) return;

        const activeId = active.id;
        const overId = over.id;

        if (activeId === overId) return;

        const isActiveTask = active.data.current?.type === "Task";
        const isOverTask = over.data.current?.type === "Task";

        if (!isActiveTask) return;

        // Dropping a Task over another Task
        if (isActiveTask && isOverTask) {
            setTasks((tasks) => {
                const activeIndex = tasks.findIndex((t) => t.id === activeId);
                const overIndex = tasks.findIndex((t) => t.id === overId);

                if (tasks[activeIndex].columnId !== tasks[overIndex].columnId) {
                    tasks[activeIndex].columnId = tasks[overIndex].columnId;
                    return arrayMove(tasks, activeIndex, overIndex - 1);
                }

                return arrayMove(tasks, activeIndex, overIndex);
            });
        }

        const isOverColumn = over.data.current?.type === "Column";

        // Dropping a Task over a Column
        if (isActiveTask && isOverColumn) {
            setTasks((tasks) => {
                const activeIndex = tasks.findIndex((t) => t.id === activeId);
                tasks[activeIndex].columnId = overId;
                return arrayMove(tasks, activeIndex, activeIndex);
            });
        }
    }
}

export default KanbanBoard;
```

## File: src/components/kanban/KanbanCard.tsx
```typescript
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Task } from "@/types";
import { MoreHorizontal } from "lucide-react";
import { Currency } from "@/data/currencies";

interface Props {
    task: Task;
    currency: Currency;
}

function KanbanCard({ task, currency }: Props) {
    const {
        setNodeRef,
        attributes,
        listeners,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id: task.id,
        data: {
            type: "Task",
            task,
        },
    });

    const style = {
        transition,
        transform: CSS.Transform.toString(transform),
    };

    if (isDragging) {
        return (
            <div
                ref={setNodeRef}
                style={style}
                className="bg-background p-3 rounded-lg border-2 border-primary opacity-30 h-[100px]"
            />
        );
    }

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className="bg-card p-3 rounded-lg border border-border shadow-sm hover:border-primary/50 cursor-grab group touch-none"
        >
            <div className="flex justify-between items-start mb-2">
                <h4 className="font-medium text-sm text-foreground line-clamp-2 leading-tight">
                    {task.content}
                </h4>
                <button className="text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                    <MoreHorizontal size={16} />
                </button>
            </div>

            {task.companyName && (
                <p className="text-xs text-muted-foreground mb-3">{task.companyName}</p>
            )}

            <div className="flex items-center justify-between mt-2">
                {task.value && (
                    <span className="text-xs font-semibold text-primary">
                        {new Intl.NumberFormat(currency.locale, { style: 'currency', currency: currency.code }).format(task.value)}
                    </span>
                )}
                {task.priority === 'high' && (
                    <div className="w-2 h-2 rounded-full bg-destructive" title="Alta Prioridade" />
                )}
            </div>
        </div>
    );
}

export default KanbanCard;
```

## File: src/components/kanban/KanbanColumn.tsx
```typescript
import { SortableContext, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Column, Id, Task } from "@/types";
import KanbanCard from "./KanbanCard";
import { useMemo, useState } from "react";
import { MoreHorizontal, Plus, PenLine } from "lucide-react";
import { Currency } from "@/data/currencies";

interface Props {
    column: Column;
    tasks: Task[];
    updateColumn: (id: Id, title: string) => void;
    onAdd: (columnId: Id) => void;
    currency: Currency;
    initialEditMode?: boolean;
}

function KanbanColumn({ column, tasks, updateColumn, onAdd, currency, initialEditMode }: Props) {
    const [editMode, setEditMode] = useState(initialEditMode || false);

    const tasksIds = useMemo(() => {
        return tasks.map((task) => task.id);
    }, [tasks]);

    const {
        setNodeRef,
        attributes,
        listeners,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id: column.id,
        data: {
            type: "Column",
            column,
        },
        disabled: editMode, // Disable drag when editing
    });

    const style = {
        transition,
        transform: CSS.Transform.toString(transform),
    };

    if (isDragging) {
        return (
            <div
                ref={setNodeRef}
                style={style}
                className="bg-muted/50 flex-1 h-[500px] max-h-[500px] rounded-lg border-2 border-primary opacity-40 min-w-0"
            />
        );
    }

    const totalValue = useMemo(() => {
        return tasks.reduce((acc, task) => acc + (task.value || 0), 0);
    }, [tasks]);

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat(currency.locale, { style: 'currency', currency: 'EUR' /* Force EUR symbol if preferred or use currency.code */ }).format(value);
    };

    // Better implementation using the dynamic currency object:
    const formatDynamicCurrency = (value: number) => {
        return new Intl.NumberFormat(currency.locale, { style: 'currency', currency: currency.code }).format(value);
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className="bg-muted/30 flex-1 h-full max-h-full rounded-lg flex flex-col border border-transparent hover:border-border/50 transition-colors min-w-0"
        >
            <div
                {...attributes}
                {...listeners}
                className="bg-muted/50 text-md cursor-grab rounded-t-lg px-3 py-2 font-semibold border-b border-border flex flex-col gap-1 group"
            >
                <div className="flex items-center justify-between w-full">
                    <div className="flex gap-2 items-center flex-1 min-w-0">
                        <span className="flex justify-center items-center bg-background w-6 h-6 text-xs rounded-full text-muted-foreground font-bold border border-border shrink-0">
                            {tasks.length}
                        </span>
                        {!editMode && (
                            <span
                                onClick={() => setEditMode(true)}
                                className="text-sm font-bold truncate cursor-pointer hover:underline decoration-dashed underline-offset-4 decoration-muted-foreground/50"
                            >
                                {column.title}
                            </span>
                        )}
                        {editMode && (
                            <input
                                className="bg-background border-primary border rounded outline-none px-2 py-0.5 text-sm w-full focus:ring-2 ring-primary/20"
                                value={column.title}
                                onChange={(e) => updateColumn(column.id, e.target.value)}
                                autoFocus
                                onBlur={() => setEditMode(false)}
                                onKeyDown={(e) => {
                                    if (e.key !== "Enter") return;
                                    setEditMode(false);
                                }}
                            />
                        )}
                    </div>
                    {!editMode && <PenLine size={14} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" onClick={() => setEditMode(true)} />}
                </div>

                {/* Column Total Value */}
                <div className="text-xs font-medium text-muted-foreground pl-8">
                    {formatDynamicCurrency(totalValue)}
                </div>
            </div>

            {/* Task List */}
            <div className="flex-grow flex flex-col gap-2 p-2 overflow-x-hidden overflow-y-auto">
                <SortableContext items={tasksIds}>
                    {tasks.map((task) => (
                        <KanbanCard key={task.id} task={task} currency={currency} />
                    ))}
                </SortableContext>
            </div>

            {/* Column Footer - Quick Add Trigger */}
            <button
                className="mx-2 mb-2 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted p-2 rounded-md transition-colors"
                onClick={() => {
                    onAdd(column.id);
                }}
                title="Novo Lead"
            >
                <Plus size={20} />
            </button>
        </div>
    );
}

export default KanbanColumn;
```

## File: src/components/kanban/NewDealModal.tsx
```typescript
import { useState, useEffect } from "react";
import Modal from "../ui/Modal";
import { Id } from "@/types";

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSave: (deal: { title: string; value: number; companyName: string }) => void;
    initialColumnId?: Id;
}

export default function NewDealModal({ isOpen, onClose, onSave, initialColumnId }: Props) {
    const [formData, setFormData] = useState({
        title: "",
        value: "",
        companyName: "",
    });

    useEffect(() => {
        if (isOpen) {
            setFormData({
                title: "",
                value: "",
                companyName: "",
            });
        }
    }, [isOpen]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({
            title: formData.title,
            value: Number(formData.value) || 0,
            companyName: formData.companyName,
        });
        onClose();
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Novo Lead / Negócio"
            footer={
                <div className="flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted rounded-md transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        form="new-deal-form"
                        className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-md transition-colors"
                    >
                        Criar Lead
                    </button>
                </div>
            }
        >
            <form id="new-deal-form" onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                    <label htmlFor="title" className="text-sm font-medium">
                        Título do Negócio
                    </label>
                    <input
                        id="title"
                        required
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        placeholder="Ex: Consultoria de Marketing"
                        value={formData.title}
                        onChange={(e) =>
                            setFormData({ ...formData, title: e.target.value })
                        }
                    />
                </div>

                <div className="space-y-2">
                    <label htmlFor="company" className="text-sm font-medium">
                        Cliente / Empresa
                    </label>
                    <input
                        id="company"
                        required
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        placeholder="Nome do cliente ou empresa"
                        value={formData.companyName}
                        onChange={(e) =>
                            setFormData({ ...formData, companyName: e.target.value })
                        }
                    />
                </div>

                <div className="space-y-2">
                    <label htmlFor="value" className="text-sm font-medium">
                        Valor Estimado (R$)
                    </label>
                    <input
                        id="value"
                        type="number"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        placeholder="0,00"
                        value={formData.value}
                        onChange={(e) =>
                            setFormData({ ...formData, value: e.target.value })
                        }
                    />
                </div>
            </form>
        </Modal>
    );
}
```

## File: src/components/ui/Modal.tsx
```typescript
import React from 'react';
import { X } from 'lucide-react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
}

export default function Modal({ isOpen, onClose, title, children }: ModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-background rounded-lg shadow-lg w-full max-w-md border border-border flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center p-4 border-b border-border">
                    <h3 className="text-lg font-semibold">{title}</h3>
                    <button
                        onClick={onClose}
                        className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-muted"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="p-4 overflow-y-auto">
                    {children}
                </div>
            </div>
        </div>
    );
}
```

## File: src/components/ui/PhoneInput.tsx
```typescript
import React, { useState, useEffect } from 'react';
import { ChevronDown, Search } from 'lucide-react';

interface Country {
    code: string;
    name: string;
    dial_code: string;
    flag: string;
}

// Comprehensive list of Europe + Brazil - Sorted Alphabetically
const countries: Country[] = [
    { code: 'DE', name: 'Alemanha', dial_code: '+49', flag: '🇩🇪' },
    { code: 'AT', name: 'Áustria', dial_code: '+43', flag: '🇦🇹' },
    { code: 'BE', name: 'Bélgica', dial_code: '+32', flag: '🇧🇪' },
    { code: 'BR', name: 'Brasil', dial_code: '+55', flag: '🇧🇷' },
    { code: 'DK', name: 'Dinamarca', dial_code: '+45', flag: '🇩🇰' },
    { code: 'ES', name: 'Espanha', dial_code: '+34', flag: '🇪🇸' },
    { code: 'FI', name: 'Finlândia', dial_code: '+358', flag: '🇫🇮' },
    { code: 'FR', name: 'França', dial_code: '+33', flag: '🇫🇷' },
    { code: 'NL', name: 'Holanda', dial_code: '+31', flag: '🇳🇱' },
    { code: 'IE', name: 'Irlanda', dial_code: '+353', flag: '🇮🇪' },
    { code: 'IT', name: 'Itália', dial_code: '+39', flag: '🇮🇹' },
    { code: 'NO', name: 'Noruega', dial_code: '+47', flag: '🇳🇴' },
    { code: 'PT', name: 'Portugal', dial_code: '+351', flag: '🇵🇹' },
    { code: 'GB', name: 'Reino Unido', dial_code: '+44', flag: '🇬🇧' },
    { code: 'SE', name: 'Suécia', dial_code: '+46', flag: '🇸🇪' },
    { code: 'CH', name: 'Suíça', dial_code: '+41', flag: '🇨🇭' },
];

interface Props {
    value: string;
    onChange: (value: string) => void;
}

export default function PhoneInput({ value, onChange }: Props) {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedCountry, setSelectedCountry] = useState<Country>(countries.find(c => c.code === 'BR') || countries[0]);
    const [searchTerm, setSearchTerm] = useState('');

    // Format phone number with spaces for readability (e.g. 964 094 865)
    const formatPhoneNumber = (input: string) => {
        // Remove non-digit chars
        const cleaned = input.replace(/\D/g, '');

        // Group by 3 digits
        const parts = cleaned.match(/.{1,3}/g);
        return parts ? parts.join(' ') : cleaned;
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawValue = e.target.value;
        // We only want to format the user part, but we receive the whole string potentially?
        // Actually the parent component usually holds the state "raw" or "formatted"?
        // The user wants to SEE formatted numbers.
        // Let's format and pass up.

        // Allow spaces and numbers
        if (!/^[0-9\s]*$/.test(rawValue)) return;

        onChange(formatPhoneNumber(rawValue));
    };

    const handleCountrySelect = (country: Country) => {
        setSelectedCountry(country);
        setIsOpen(false);
        setSearchTerm(''); // Clear search term when a country is selected
    };

    const filteredCountries = countries.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.dial_code.includes(searchTerm)
    );

    return (
        <div className="relative w-full">
            <div className="flex border border-input rounded-md bg-background focus-within:ring-2 focus-within:ring-ring focus-within:border-transparent">
                {/* Country Selector Trigger */}
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex items-center gap-1 px-2 py-2 border-r border-border hover:bg-muted/50 rounded-l-md transition-colors shrink-0"
                >
                    <span className="text-xl leading-none">{selectedCountry.flag}</span>
                    <span className="text-sm font-medium ml-1">{selectedCountry.dial_code}</span>
                    <ChevronDown size={14} className="text-muted-foreground ml-1" />
                </button>

                {/* Phone Number Input */}
                <input
                    type="tel"
                    className="flex-1 w-full px-3 py-2 bg-transparent text-sm focus:outline-none min-w-0" // min-w-0 fixes flex child overflow
                    placeholder="000 000 000"
                    value={value}
                    onChange={handleChange}
                />
            </div>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute top-full left-0 mt-1 w-72 max-h-60 overflow-y-auto bg-popover border border-border rounded-md shadow-md z-50 flex flex-col">
                    <div className="p-2 sticky top-0 bg-popover border-b border-border z-10">
                        <div className="relative">
                            <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <input
                                className="w-full pl-8 pr-2 py-1 text-xs border border-border rounded-sm bg-background"
                                placeholder="Buscar país..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                autoFocus
                            />
                        </div>
                    </div>
                    {filteredCountries.map((country) => (
                        <button
                            key={country.code}
                            type="button"
                            className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center gap-3 transition-colors shrink-0"
                            onClick={() => handleCountrySelect(country)}
                        >
                            <span className="text-xl">{country.flag}</span>
                            <span className="text-muted-foreground w-12">{country.dial_code}</span>
                            <span className="truncate">{country.name}</span>
                        </button>
                    ))}
                </div>
            )}

            {/* Backdrop to close */}
            {isOpen && (
                <div
                    className="fixed inset-0 z-40 bg-transparent"
                    onClick={() => setIsOpen(false)}
                />
            )}
        </div>
    );
}
```

## File: src/data/currencies.ts
```typescript
export interface Currency {
    code: string;
    locale: string;
    name: string;
    symbol: string;
}

export const currencies: Currency[] = [
    { code: 'EUR', locale: 'pt-PT', name: 'Euro', symbol: '€' },
    { code: 'BRL', locale: 'pt-BR', name: 'Real Brasileiro', symbol: 'R$' },
    { code: 'USD', locale: 'en-US', name: 'Dólar Americano', symbol: '$' },
    { code: 'GBP', locale: 'en-GB', name: 'Libra Esterlina', symbol: '£' },
    { code: 'JPY', locale: 'ja-JP', name: 'Iene Japonês', symbol: '¥' },
    { code: 'CNY', locale: 'zh-CN', name: 'Yuan Chinês', symbol: '¥' },
];
```

## File: src/index.css
```typescript
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;

    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
 
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
 
    --primary: 221.2 83.2% 53.3%;
    --primary-foreground: 210 40% 98%;
 
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
 
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
 
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
 
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;

    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 221.2 83.2% 53.3%;
 
    --radius: 0.5rem;
  }
 
  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
 
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
 
    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;
 
    --primary: 217.2 91.2% 59.8%;
    --primary-foreground: 222.2 47.4% 11.2%;
 
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
 
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
 
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
 
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
 
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 212.7 26.8% 83.9%;
  }
}
 
@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```

## File: src/main.tsx
```typescript
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
)
```

## File: src/pages/Login.tsx
```typescript
import React, { useState, useEffect } from 'react';
import { Mail, CheckCircle, Loader2, AlertCircle } from 'lucide-react';

interface Props {
    onLogin: () => void;
}

export default function Login({ onLogin }: Props) {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    // Registration Flow State
    const [registrationSuccess, setRegistrationSuccess] = useState(false);

    // Validation Flow State
    const [isValidating, setIsValidating] = useState(false);
    const [validationSuccess, setValidationSuccess] = useState(false);

    useEffect(() => {
        // Check for simulated validation param
        const params = new URLSearchParams(window.location.search);
        const mode = params.get('mode');
        const verifyEmail = params.get('email');

        if (mode === 'verify' && verifyEmail) {
            setIsValidating(true);
            setTimeout(() => {
                // Simulate backend validation
                const users = JSON.parse(localStorage.getItem('crm_users') || '{}');
                if (users[verifyEmail]) {
                    users[verifyEmail].verified = true;
                    localStorage.setItem('crm_users', JSON.stringify(users));
                }

                setIsValidating(false);
                setValidationSuccess(true);
                // Clean URL
                window.history.replaceState({}, '', '/');
            }, 2000);
        }
    }, []);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        if (!isLogin) {
            // REGISTRATION FLOW
            setTimeout(() => {
                const users = JSON.parse(localStorage.getItem('crm_users') || '{}');

                if (users[email]) {
                    setError('Este email já está cadastrado.');
                    setIsLoading(false);
                    return;
                }

                // Save new user (unverified)
                users[email] = {
                    name,
                    password, // In a real app, this would be hashed
                    verified: false
                };
                localStorage.setItem('crm_users', JSON.stringify(users));

                setIsLoading(false);
                setRegistrationSuccess(true);
            }, 1000);
            return;
        }

        // LOGIN FLOW
        setTimeout(() => {
            const users = JSON.parse(localStorage.getItem('crm_users') || '{}');
            const user = users[email];

            if (!user) {
                setError('Usuário não encontrado. Crie uma conta primeiro.');
                setIsLoading(false);
                return;
            }

            if (user.password !== password) {
                setError('Senha incorreta.');
                setIsLoading(false);
                return;
            }

            if (!user.verified) {
                setError('Conta ainda não verificada. Cheque seu "email" simulado.');
                setIsLoading(false);
                return;
            }

            setIsLoading(false);
            onLogin();
        }, 1000);
    };

    if (isValidating) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-muted/30">
                <div className="w-full max-w-md p-8 bg-card rounded-xl border border-border shadow-lg text-center">
                    <div className="flex justify-center mb-6">
                        <Loader2 className="w-12 h-12 text-primary animate-spin" />
                    </div>
                    <h2 className="text-xl font-bold text-foreground">Validando conta de {new URLSearchParams(window.location.search).get('email')}...</h2>
                    <p className="text-muted-foreground mt-2">Estamos confirmando seus dados.</p>
                </div>
            </div>
        );
    }

    if (validationSuccess) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-muted/30">
                <div className="w-full max-w-md p-8 bg-card rounded-xl border border-border shadow-lg text-center">
                    <div className="flex justify-center mb-4">
                        <CheckCircle className="w-16 h-16 text-green-500" />
                    </div>
                    <h2 className="text-2xl font-bold text-foreground">Conta Ativada com Sucesso!</h2>
                    <p className="text-muted-foreground mt-2">
                        Agora você pode acessar o CRM.
                    </p>
                    <button
                        onClick={() => setValidationSuccess(false)}
                        className="mt-6 w-full bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md font-medium"
                    >
                        Ir para Login
                    </button>
                </div>
            </div>
        );
    }

    if (registrationSuccess) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-muted/30">
                <div className="w-full max-w-md p-8 space-y-6 bg-card rounded-xl border border-border shadow-lg text-center">
                    <div className="flex justify-center mb-4">
                        <Mail className="w-16 h-16 text-primary" />
                    </div>
                    <h2 className="text-2xl font-bold text-foreground">Verifique seu Email</h2>
                    <p className="text-muted-foreground">
                        Enviamos um link de confirmação para <strong>{email}</strong>.
                        <br />
                        Para completar o cadastro, você precisa clicar no link abaixo:
                    </p>

                    <div className="p-4 bg-muted/50 rounded-lg border border-border mt-4 text-left">
                        <div className="flex items-center gap-2 border-b border-border pb-2 mb-2">
                            <Mail size={14} className="text-muted-foreground" />
                            <span className="text-xs font-mono text-muted-foreground">inbox@seue-mail.com</span>
                        </div>
                        <p className="text-sm font-medium mb-1">Assunto: Bem-vindo ao CRM!</p>
                        <p className="text-sm text-foreground mb-4">Olá {name}, confirme sua conta clicando aqui:</p>
                        <a
                            href={`?mode=verify&email=${encodeURIComponent(email)}`}
                            className="block w-full bg-primary text-primary-foreground text-center py-2 rounded text-sm font-medium hover:opacity-90 transition-opacity"
                            onClick={() => setRegistrationSuccess(false)}
                        >
                            Confirmar Minha Conta
                        </a>
                    </div>

                    <button
                        onClick={() => {
                            setRegistrationSuccess(false);
                            setIsLogin(true);
                        }}
                        className="mt-6 text-sm text-muted-foreground hover:text-foreground underline"
                    >
                        Voltar para Login
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-muted/30">
            <div className="w-full max-w-md p-8 space-y-6 bg-card rounded-xl border border-border shadow-lg">
                <div className="text-center space-y-2">
                    <h1 className="text-3xl font-bold text-primary">CRM Platform</h1>
                    <p className="text-muted-foreground">
                        {isLogin ? 'Entre para acessar sua conta' : 'Crie sua conta para começar'}
                    </p>
                </div>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-md p-3 flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                        <AlertCircle size={16} />
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    {!isLogin && (
                        <div className="space-y-2">
                            <label className="text-sm font-medium leading-none" htmlFor="name">
                                Nome Completo
                            </label>
                            <input
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                id="name"
                                placeholder="Seu Nome"
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required={!isLogin}
                            />
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="text-sm font-medium leading-none" htmlFor="email">
                            Email
                        </label>
                        <input
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            id="email"
                            placeholder="seu@email.com"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium leading-none" htmlFor="password">
                            Senha
                        </label>
                        <input
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            id="password"
                            type="password"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>

                    <button
                        className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 rounded-md font-medium transition-colors disabled:opacity-50"
                        type="submit"
                        disabled={isLoading}
                    >
                        {isLoading ? 'Processando...' : isLogin ? 'Entrar' : 'Criar Conta'}
                    </button>
                </form>

                <div className="text-center text-sm text-muted-foreground pt-2">
                    <p>
                        {isLogin ? 'Não tem uma conta? ' : 'Já tem uma conta? '}
                        <button
                            onClick={() => {
                                setIsLogin(!isLogin);
                                setError('');
                            }}
                            className="text-primary hover:underline font-medium"
                        >
                            {isLogin ? 'Cadastre-se' : 'Fazer Login'}
                        </button>
                    </p>
                </div>
            </div>
        </div>
    );
}
```

## File: src/pages/Onboarding.tsx
```typescript
import React, { useState } from 'react';
import PhoneInput from '@/components/ui/PhoneInput';
import { Building2, MousePointerClick } from 'lucide-react';

interface Props {
    onComplete: (profileData: any) => void;
    onCancel?: () => void; // Optional incase we are just adding a profile from settings
}

export default function Onboarding({ onComplete, onCancel }: Props) {
    const [formData, setFormData] = useState({
        companyName: '',
        employees: '',
        website: '',
        instagram: '',
        whatsapp: '',
        email: '',
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onComplete(formData);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
            <div className="w-full max-w-2xl bg-card rounded-xl border border-border shadow-lg overflow-hidden flex flex-col md:flex-row">

                {/* Left Side - Visual */}
                <div className="hidden md:flex flex-col justify-center items-center bg-primary/5 p-8 w-1/3 border-r border-border text-center">
                    <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4 text-primary">
                        <Building2 size={32} />
                    </div>
                    <h2 className="text-xl font-bold mb-2">Configure sua Empresa</h2>
                    <p className="text-sm text-muted-foreground">
                        Esses dados serão usados para personalizar seu CRM e relatórios.
                    </p>
                </div>

                {/* Right Side - Form */}
                <div className="flex-1 p-8">
                    <div className="mb-6">
                        <h1 className="text-2xl font-bold">Criar Perfil de Empresa</h1>
                        <p className="text-muted-foreground text-sm">Preencha os dados abaixo para continuar.</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Nome da Empresa</label>
                            <input
                                required
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                value={formData.companyName}
                                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                                placeholder="Ex: Minha Agência"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Colaboradores</label>
                                <select
                                    required
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    value={formData.employees}
                                    onChange={(e) => setFormData({ ...formData, employees: e.target.value })}
                                >
                                    <option value="">Selecione...</option>
                                    <option value="1">Eu sou sozinho (1)</option>
                                    <option value="2-5">2 - 5</option>
                                    <option value="6-10">6 - 10</option>
                                    <option value="11-50">11 - 50</option>
                                    <option value="50+">50+</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Site (Opcional)</label>
                                <input
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    value={formData.website}
                                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                                    placeholder="www.exemplo.com"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Email Comercial</label>
                            <input
                                type="email"
                                required
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                placeholder="contato@empresa.com"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">WhatsApp</label>
                            <PhoneInput
                                value={formData.whatsapp}
                                onChange={(value) => setFormData({ ...formData, whatsapp: value })}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Instagram</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">@</span>
                                <input
                                    className="flex h-10 w-full rounded-md border border-input bg-background pl-7 pr-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    value={formData.instagram}
                                    onChange={(e) => setFormData({ ...formData, instagram: e.target.value })}
                                    placeholder="usuario"
                                />
                            </div>
                        </div>

                        <div className="pt-4 flex gap-3 justify-end">
                            {onCancel && (
                                <button
                                    type="button"
                                    onClick={onCancel}
                                    className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
                                >
                                    Cancelar
                                </button>
                            )}
                            <button
                                type="submit"
                                className="bg-primary text-primary-foreground hover:bg-primary/90 px-8 py-2 rounded-md font-medium transition-colors"
                            >
                                Criar Perfil
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
```

## File: src/types/index.ts
```typescript
export type Id = string | number;

export interface Column {
    id: Id;
    title: string;
}

export interface Task {
    id: Id;
    columnId: Id;
    content: string;
    companyName?: string;
    value?: number;
    priority?: 'low' | 'medium' | 'high';
}

export interface Contact {
    id: Id;
    name: string;
    email: string;
    phone?: string;
    role?: string;
    companyId?: Id;
    companyName?: string;
    lastActivity?: string; // Date string
    status: 'active' | 'inactive' | 'lead';
}
```

