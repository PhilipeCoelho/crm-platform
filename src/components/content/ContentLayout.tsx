import { NavLink } from 'react-router-dom';
import { 
  CalendarDays, 
  Sparkles, 
  Lightbulb, 
  Layers, 
  BookMarked, 
  Share2, 
  Brain 
} from 'lucide-react';

interface ContentLayoutProps {
  children?: React.ReactNode;
}

const tabs = [
  { name: 'Hoje', path: '/content', icon: CalendarDays, end: true },
  { name: 'Oportunidades', path: '/content/opportunities', icon: Sparkles, end: false },
  { name: 'Ideias', path: '/content/ideas', icon: Lightbulb, end: false },
  { name: 'Produção', path: '/content/production', icon: Layers, end: false },
  { name: 'Referências', path: '/content/references', icon: BookMarked, end: false },
  { name: 'Publicações', path: '/content/publications', icon: Share2, end: false },
  { name: 'Inteligência', path: '/content/intelligence', icon: Brain, end: false },
];

export default function ContentLayout({ children }: ContentLayoutProps) {

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="px-6 py-8 border-b border-border bg-card">
        <h1 className="text-3xl font-bold text-foreground">Conteúdo</h1>
        <p className="text-muted-foreground mt-2">Inteligência estratégica de conteúdo integrada ao CRM</p>
      </div>

      <div className="px-6 border-b border-border bg-card overflow-x-auto whitespace-nowrap scrollbar-hide">
        <nav className="flex space-x-6">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            
            // For tabs other than the end one, we check if pathname starts with the path
            // For 'Hoje' (end: true), we match exactly. 
            // Note: In React Router v6 NavLink handles this with the `end` prop directly, 
            // but since we are writing custom class logic based on active state, we can use 
            // NavLink's callback pattern for className.

            return (
              <NavLink
                key={tab.path}
                to={tab.path}
                end={tab.end}
                className={({ isActive }) => `flex items-center gap-2 py-4 border-b-2 text-sm transition-colors ${
                  isActive
                    ? 'border-primary text-primary font-medium'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon size={18} />
                {tab.name}
              </NavLink>
            );
          })}
        </nav>
      </div>

      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
