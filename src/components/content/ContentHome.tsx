import { CalendarDays, Sparkles, Layers, Brain } from 'lucide-react';

export default function ContentHome() {
  return (
    <div className="p-4 md:p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Section A: 'Hoje' card */}
        <div className="bg-card border border-border rounded-xl p-4 md:col-span-2 min-h-[160px] flex flex-col">
          <div className="flex items-center gap-2 mb-1">
            <CalendarDays size={18} className="text-muted-foreground" />
            <h2 className="font-semibold text-foreground">Hoje</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-4">Capture acontecimentos, experiências e ideias do dia</p>
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-muted-foreground italic text-center max-w-lg">
              Quando o Daily estiver ativo, aqui você verá um resumo do dia e poderá registrar novas entradas rapidamente.
            </p>
          </div>
        </div>

        {/* Section B: 'Oportunidades' card */}
        <div className="bg-card border border-border rounded-xl p-4 min-h-[160px] flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles size={18} className="text-muted-foreground" />
            <h2 className="font-semibold text-foreground">Oportunidades</h2>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-muted-foreground italic text-center">
              Quando experiências, sinais comerciais e ideias começarem a entrar no sistema, esta área mostrará as melhores oportunidades de conteúdo.
            </p>
          </div>
        </div>

        {/* Section C: 'Em Produção' card */}
        <div className="bg-card border border-border rounded-xl p-4 min-h-[160px] flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <Layers size={18} className="text-muted-foreground" />
            <h2 className="font-semibold text-foreground">Em Produção</h2>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-muted-foreground italic text-center">
              Conteúdos em desenvolvimento aparecerão aqui com seus status de produção.
            </p>
          </div>
        </div>

        {/* Section D: 'Sinais de Inteligência' card */}
        <div className="bg-card border border-border rounded-xl p-4 md:col-span-2 min-h-[160px] flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <Brain size={18} className="text-muted-foreground" />
            <h2 className="font-semibold text-foreground">Sinais de Inteligência</h2>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-muted-foreground italic text-center max-w-2xl">
              Sinais vindos da Central de Inteligência Comercial aparecerão aqui, conectando dores, objeções e padrões do CRM a oportunidades de conteúdo.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
