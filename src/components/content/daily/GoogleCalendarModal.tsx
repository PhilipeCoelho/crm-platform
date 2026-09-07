import { useState, useEffect } from 'react';
import { 
  Calendar, 
  CheckCircle2, 
  ExternalLink, 
  AlertCircle, 
  Trash2, 
  Loader2, 
  HelpCircle, 
  Link as LinkIcon,
  Plus,
  Layers
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { 
  getCalendarAccounts, 
  addCalendarAccount, 
  removeCalendarAccount,
  fetchGoogleCalendarEvents,
  CalendarAccount
} from '@/services/googleCalendarService';

interface GoogleCalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnected?: () => void;
}

const COLOR_MAP: Record<string, { bg: string; text: string; border: string; label: string }> = {
  blue: { bg: 'bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-500/30', label: 'Azul' },
  emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-500/30', label: 'Verde' },
  purple: { bg: 'bg-purple-500/10', text: 'text-purple-600 dark:text-purple-400', border: 'border-purple-500/30', label: 'Roxo' },
  amber: { bg: 'bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-500/30', label: 'Âmbar' },
  rose: { bg: 'bg-rose-500/10', text: 'text-rose-600 dark:text-rose-400', border: 'border-rose-500/30', label: 'Rosa' },
};

export default function GoogleCalendarModal({
  isOpen,
  onClose,
  onConnected,
}: GoogleCalendarModalProps) {
  const [accounts, setAccounts] = useState<CalendarAccount[]>([]);
  const [name, setName] = useState('');
  const [icalUrl, setIcalUrl] = useState('');
  const [selectedColor, setSelectedColor] = useState<'blue' | 'emerald' | 'purple' | 'amber' | 'rose'>('blue');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success?: boolean;
    count?: number;
    message?: string;
  } | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const current = getCalendarAccounts();
      setAccounts(current);
      setName(current.length === 0 ? 'Vamuss' : current.length === 1 ? 'Pessoal' : `Agenda ${current.length + 1}`);
      setIcalUrl('');
      setTestResult(null);
      setShowInstructions(current.length === 0);
    }
  }, [isOpen]);

  const handleAddCalendar = async () => {
    const trimmedUrl = icalUrl.trim();
    const trimmedName = name.trim() || 'Google Agenda';

    if (!trimmedUrl) {
      setTestResult({
        success: false,
        message: 'Por favor, insira o link secreto iCal da agenda.'
      });
      return;
    }

    if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
      setTestResult({
        success: false,
        message: 'O link deve começar com https://'
      });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    const todayStr = new Date().toISOString().split('T')[0];
    const res = await fetchGoogleCalendarEvents(todayStr, trimmedUrl);

    setIsTesting(false);

    if (res.success) {
      const added = addCalendarAccount({
        name: trimmedName,
        url: trimmedUrl,
        color: selectedColor
      });

      const updated = [...accounts, added];
      setAccounts(updated);
      setIcalUrl('');
      setName(updated.length === 1 ? 'Pessoal' : `Agenda ${updated.length + 1}`);
      setTestResult({
        success: true,
        count: res.events.length,
        message: `Agenda "${trimmedName}" conectada com sucesso! Encontramos ${res.events.length} evento(s) para hoje.`
      });

      if (onConnected) {
        onConnected();
      }
    } else {
      setTestResult({
        success: false,
        message: res.error || 'Não foi possível ler os eventos deste link. Verifique se copiou o "Endereço secreto em formato iCal".'
      });
    }
  };

  const handleRemoveAccount = (id: string) => {
    removeCalendarAccount(id);
    const updated = accounts.filter(a => a.id !== id);
    setAccounts(updated);
    setTestResult(null);
    if (onConnected) {
      onConnected();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary mb-1">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
              <Calendar size={18} />
            </div>
            <DialogTitle className="text-base font-bold text-foreground">
              Agendas Conectadas ({accounts.length})
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
            Conecte múltiplas agendas (Vamuss, Pessoal, Consultório). O CRM sincroniza automaticamente em tempo real sempre que você volta para a tela.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* List of currently connected calendars */}
          {accounts.length > 0 && (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Layers size={13} className="text-primary" />
                <span>Suas agendas ativas:</span>
              </label>

              <div className="space-y-2">
                {accounts.map(acc => {
                  const style = COLOR_MAP[acc.color || 'blue'] || COLOR_MAP.blue;
                  return (
                    <div
                      key={acc.id}
                      className="p-3 bg-muted/40 border border-border rounded-xl flex items-center justify-between text-xs transition-all hover:bg-muted/60"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <span className={`px-2 py-0.5 rounded-md font-semibold text-[11px] border ${style.bg} ${style.text} ${style.border}`}>
                          {acc.name}
                        </span>
                        <span className="text-[11px] text-muted-foreground font-mono truncate max-w-[260px]">
                          {acc.url}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveAccount(acc.id)}
                        title={`Desconectar agenda ${acc.name}`}
                        className="text-muted-foreground hover:text-destructive p-1.5 rounded-lg transition-colors ml-2 shrink-0"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Form to add another calendar */}
          <div className="p-3.5 bg-card border border-border/80 rounded-xl space-y-3">
            <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Plus size={14} className="text-primary" />
              <span>{accounts.length === 0 ? 'Conectar Primeira Agenda' : 'Adicionar Outra Agenda'}</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="sm:col-span-2 space-y-1">
                <label className="text-[11px] font-medium text-muted-foreground">Nome da Agenda</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Ex: Vamuss, Pessoal, Reuniões"
                  className="w-full text-xs border border-input bg-background rounded-lg p-2 text-foreground placeholder:text-muted-foreground/50 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-muted-foreground">Cor do Marcador</label>
                <select
                  value={selectedColor}
                  onChange={e => setSelectedColor(e.target.value as any)}
                  className="w-full text-xs border border-input bg-background rounded-lg p-2 text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                >
                  <option value="blue">Azul (Comercial)</option>
                  <option value="emerald">Verde (Vamuss)</option>
                  <option value="purple">Roxo (Estratégico)</option>
                  <option value="amber">Âmbar (Pessoal)</option>
                  <option value="rose">Rosa (Consultoria)</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">Endereço secreto em formato iCal (.ics)</label>
              <div className="relative">
                <input
                  type="url"
                  value={icalUrl}
                  onChange={e => setIcalUrl(e.target.value)}
                  placeholder="https://calendar.google.com/calendar/ical/.../basic.ics"
                  className="w-full text-xs font-mono border border-input bg-background rounded-lg p-2 pr-8 text-foreground placeholder:text-muted-foreground/50 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                />
                <div className="absolute right-2.5 top-2.5 text-muted-foreground pointer-events-none">
                  <LinkIcon size={14} />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                disabled={isTesting || !icalUrl.trim()}
                onClick={handleAddCalendar}
                className="px-3.5 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
              >
                {isTesting ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Conectando...</span>
                  </>
                ) : (
                  <>
                    <Plus size={13} />
                    <span>Conectar Esta Agenda</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Feedback message */}
          {testResult && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                testResult.success
                  ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-300'
                  : 'bg-destructive/10 border-destructive/20 text-destructive'
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
              )}
              <span>{testResult.message}</span>
            </div>
          )}

          {/* Instructions Accordion */}
          <div className="border border-border/80 rounded-xl overflow-hidden bg-card">
            <button
              type="button"
              onClick={() => setShowInstructions(prev => !prev)}
              className="w-full px-3.5 py-2.5 bg-muted/40 hover:bg-muted/70 flex items-center justify-between text-xs font-semibold text-foreground transition-colors"
            >
              <div className="flex items-center gap-2">
                <HelpCircle size={14} className="text-primary" />
                <span>Como pegar o link secreto no Google Agenda (passo a passo)</span>
              </div>
              <span className="text-[11px] text-primary">{showInstructions ? 'Ocultar' : 'Ver passos'}</span>
            </button>

            {showInstructions && (
              <div className="p-3.5 space-y-3 text-xs text-muted-foreground border-t border-border/60">
                <ol className="list-decimal pl-4 space-y-2 leading-relaxed">
                  <li>
                    No computador, acesse{' '}
                    <a
                      href="https://calendar.google.com"
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary font-medium underline inline-flex items-center gap-0.5"
                    >
                      Google Agenda <ExternalLink size={10} />
                    </a>.
                  </li>
                  <li>
                    Na barra lateral esquerda, passe o mouse sobre a agenda desejada (em <em>&ldquo;Minhas agendas&rdquo;</em>), clique nos <strong>3 pontinhos (...)</strong> e escolha <strong>Configurações e compartilhamento</strong>.
                  </li>
                  <li>
                    Role até a seção <strong>Integrar agenda</strong> e localize o campo:
                    <div className="my-1.5 p-2 rounded-lg bg-muted text-foreground font-mono text-[11px] select-all border border-border">
                      &ldquo;Endereço secreto em formato iCal&rdquo;
                    </div>
                  </li>
                  <li>
                    Clique em <strong>Copiar</strong> (URL que termina em <code className="text-[11px] bg-muted px-1 py-0.5 rounded">.ics</code>) e cole acima.
                  </li>
                </ol>
                <p className="text-[11px] text-amber-600 dark:text-amber-400 bg-amber-500/10 p-2 rounded-lg border border-amber-500/20">
                  ⚠️ <strong>Atenção:</strong> Sempre use o <em>&ldquo;Endereço secreto&rdquo;</em> para sincronizar seus compromissos privados com total segurança.
                </p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex gap-2 sm:justify-end pt-2 border-t border-border/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground text-xs font-medium transition-colors"
          >
            Concluir
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
