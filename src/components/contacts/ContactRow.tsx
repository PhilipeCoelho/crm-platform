import React, { memo } from 'react';
import { Mail, Phone, MessageCircle, MoreHorizontal, Edit, Trash2 } from 'lucide-react';
import { Contact, Activity } from '@/types/schema';
import { PrivacyText } from '../ui/PrivacyMask';
import { isMobileNumber, getCleanedWhatsAppLink, getCleanedPhoneLink } from '@/utils/phoneHelpers';

interface ContactRowProps {
    contact: Contact;
    style?: React.CSSProperties;
    isSelected: boolean;
    onSelect: () => void;
    onEdit: (contact: Contact, e: React.MouseEvent) => void;
    onDelete: (id: string) => void;
    onClick: () => void;
    companyName: string;
    openDealsCount: number;
    closedDealsCount: number;
    nextActivity: Activity | undefined;
    visibleColumns: Array<{ id: string; label: string; visible: boolean }>;
    isMenuOpen: boolean;
    onToggleMenu: (e: React.MouseEvent) => void;
}

const getColumnClass = (id: string) => {
    switch (id) {
        case 'name': return 'flex-[2] min-w-[150px]';
        case 'organization': return 'flex-[1.5] min-w-[120px]';
        case 'email': return 'flex-[2] min-w-[180px]';
        case 'phone': return 'flex-[1.2] min-w-[120px]';
        case 'brevoStatus': return 'w-36 shrink-0';
        case 'marketingStatus': return 'w-28 shrink-0';
        case 'openDeals': return 'w-28 shrink-0';
        case 'closedDeals': return 'w-28 shrink-0';
        case 'nextActivity': return 'flex-[1.5] min-w-[140px]';
        default: return 'flex-1';
    }
};

export const ContactRow = memo(function ContactRow({
    contact,
    style,
    isSelected,
    onSelect,
    onEdit,
    onDelete,
    onClick,
    companyName,
    openDealsCount,
    closedDealsCount,
    nextActivity,
    visibleColumns,
    isMenuOpen,
    onToggleMenu
}: ContactRowProps) {
    const isOverdue = nextActivity?.dueDate && nextActivity.dueDate < new Date().toISOString().split('T')[0];

    return (
        <div
            style={style}
            className="flex items-center hover:bg-muted/30 border-b border-border transition-colors group cursor-pointer text-sm"
            onClick={onClick}
        >
            {/* Checkbox Column */}
            <div className="px-4 w-12 shrink-0 flex items-center justify-center h-full" onClick={e => e.stopPropagation()}>
                <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={onSelect}
                    className="w-4 h-4 rounded border-input cursor-pointer"
                />
            </div>

            {/* Dynamic Columns */}
            {visibleColumns.map((col) => {
                const columnClass = getColumnClass(col.id);
                switch (col.id) {
                    case 'name':
                        return (
                            <div key={col.id} className={`px-4 flex items-center h-full gap-3 truncate ${columnClass}`}>
                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                                    {contact.name.charAt(0).toUpperCase()}
                                </div>
                                <span className="font-medium text-foreground truncate">
                                    <PrivacyText text={contact.name} type="name" />
                                </span>
                            </div>
                        );
                    case 'organization':
                        return (
                            <div key={col.id} className={`px-4 flex flex-col justify-center h-full truncate ${columnClass}`}>
                                <span className="text-foreground truncate">
                                    <PrivacyText text={companyName} type="company" />
                                </span>
                                {contact.role && (
                                    <span className="text-xs text-muted-foreground truncate">{contact.role}</span>
                                )}
                            </div>
                        );
                    case 'email':
                        return (
                            <div key={col.id} className={`px-4 flex items-center h-full truncate ${columnClass}`}>
                                <PrivacyText text={contact.email} type="email" />
                            </div>
                        );
                    case 'phone':
                        return (
                            <div key={col.id} className={`px-4 flex items-center h-full gap-2 truncate ${columnClass}`}>
                                <a
                                    href={getCleanedPhoneLink(contact.phone || '')}
                                    className="hover:text-primary transition-colors truncate"
                                    onClick={e => e.stopPropagation()}
                                >
                                    <PrivacyText text={contact.phone || '-'} type="phone" />
                                </a>
                                {contact.phone && isMobileNumber(contact.phone) && (
                                    <a
                                        href={getCleanedWhatsAppLink(contact.phone)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-emerald-500 hover:text-emerald-600 transition-colors p-1 hover:bg-emerald-500/10 rounded shrink-0"
                                        onClick={e => e.stopPropagation()}
                                        title="WhatsApp"
                                    >
                                        <MessageCircle size={14} />
                                    </a>
                                )}
                            </div>
                        );
                    case 'brevoStatus':
                        {
                            const syncStatus = contact.brevoSyncStatus || 'nao_sincronizado';
                            return (
                                <div key={col.id} className={`px-4 flex items-center h-full shrink-0 ${columnClass}`}>
                                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ${
                                        syncStatus === 'sincronizado'
                                            ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                                            : syncStatus === 'nao_elegivel'
                                                ? 'bg-amber-50 text-amber-600 border border-amber-100'
                                                : 'bg-rose-50 text-rose-600 border border-rose-100'
                                    }`}>
                                        {syncStatus === 'sincronizado' 
                                            ? '✅ Sincronizado' 
                                            : syncStatus === 'nao_elegivel' 
                                                ? '⚠️ Não elegível' 
                                                : '❌ Não sinc.'}
                                    </span>
                                </div>
                            );
                        }
                    case 'marketingStatus':
                        return (
                            <div key={col.id} className={`px-4 flex items-center h-full shrink-0 ${columnClass}`}>
                                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ${contact.marketingStatus === 'subscribed'
                                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                                    : contact.marketingStatus === 'unsubscribed'
                                        ? 'bg-slate-50 text-slate-500 border border-slate-200'
                                        : 'bg-slate-50 text-slate-400 border border-slate-100'
                                    }`}>
                                    {contact.marketingStatus === 'subscribed' ? 'Inscrito' : 'Não Inscrito'}
                                </span>
                            </div>
                        );
                    case 'openDeals':
                        return (
                            <div key={col.id} className={`px-4 flex items-center h-full shrink-0 ${columnClass}`}>
                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-semibold">
                                    {openDealsCount}
                                </span>
                            </div>
                        );
                    case 'closedDeals':
                        return (
                            <div key={col.id} className={`px-4 flex items-center h-full shrink-0 ${columnClass}`}>
                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-semibold">
                                    {closedDealsCount}
                                </span>
                            </div>
                        );
                    case 'nextActivity':
                        if (!nextActivity) {
                            return (
                                <div key={col.id} className={`px-4 flex items-center h-full text-muted-foreground text-xs shrink-0 ${columnClass}`}>
                                    -
                                </div>
                            );
                        }
                        return (
                            <div key={col.id} className={`px-4 flex flex-col justify-center h-full truncate ${columnClass}`}>
                                <span className="text-sm font-medium text-foreground truncate" title={nextActivity.title}>
                                    <PrivacyText text={nextActivity.title} type="text" />
                                </span>
                                <span className={`text-[11px] ${isOverdue ? 'text-red-500 font-semibold' : 'text-muted-foreground'}`}>
                                    {nextActivity.dueDate ? new Date(nextActivity.dueDate).toLocaleDateString('pt-BR') : 'Sem data'}
                                </span>
                            </div>
                        );
                    default:
                        return null;
                }
            })}

            {/* Actions Column */}
            <div className="px-4 w-20 shrink-0 flex items-center justify-end h-full relative" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="p-1.5 hover:bg-muted rounded-md text-muted-foreground hover:text-primary transition-colors" title="Enviar Email">
                        <Mail size={14} />
                    </button>
                    <a
                        href={getCleanedPhoneLink(contact.phone || '')}
                        className="p-1.5 hover:bg-muted rounded-md text-muted-foreground hover:text-primary transition-colors"
                        title="Ligar"
                    >
                        <Phone size={14} />
                    </a>
                    {contact.phone && isMobileNumber(contact.phone) && (
                        <a
                            href={getCleanedWhatsAppLink(contact.phone)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 hover:bg-muted rounded-md text-muted-foreground hover:text-emerald-500 transition-colors"
                            title="WhatsApp"
                        >
                            <MessageCircle size={14} />
                        </a>
                    )}
                    <div className="relative">
                        <button
                            className="p-1.5 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground transition-colors"
                            onClick={onToggleMenu}
                        >
                            <MoreHorizontal size={14} />
                        </button>
                        {isMenuOpen && (
                            <div className="absolute right-0 mt-2 w-36 bg-popover border border-border rounded-lg shadow-xl z-50 py-1 animate-in fade-in zoom-in-95 duration-200">
                                <button
                                    onClick={(e) => onEdit(contact, e)}
                                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center gap-2 transition-colors"
                                >
                                    <Edit size={14} />
                                    Editar
                                </button>
                                <button
                                    onClick={() => onDelete(contact.id)}
                                    className="w-full text-left px-3 py-2 text-sm hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 flex items-center gap-2 transition-colors"
                                >
                                    <Trash2 size={14} />
                                    Excluir
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
});
