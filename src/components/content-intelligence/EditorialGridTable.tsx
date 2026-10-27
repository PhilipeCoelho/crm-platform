import { ContentProposal } from '@/types/contentIntelligence';
import { Send, Eye, Check } from 'lucide-react';

interface EditorialGridTableProps {
    proposals: ContentProposal[];
    onOpenProposal: (proposal: ContentProposal) => void;
    onSendToKanban: (proposalId: string) => Promise<void>;
}

export function EditorialGridTable({
    proposals,
    onOpenProposal,
    onSendToKanban
}: EditorialGridTableProps) {
    if (!proposals || proposals.length === 0) {
        return (
            <div className="p-8 text-center text-muted-foreground bg-card border border-border/60 rounded-xl text-xs">
                Nenhuma proposta editorial gerada ainda. Submete uma ideia ou referência para a IA processar.
            </div>
        );
    }

    return (
        <div className="w-full overflow-hidden border border-border/70 rounded-xl bg-card shadow-xs">
            {/* Cabeçalho explicativo */}
            <div className="px-4 py-2.5 bg-secondary/20 border-b border-border/60 flex items-center justify-between">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                    Grelha Editorial Oficial ({proposals.length} propostas)
                </span>
                <span className="text-[10px] text-muted-foreground">
                    Clica em qualquer linha para ver o roteiro e detalhes completos
                </span>
            </div>

            {/* Tabela com as 4 Colunas Obrigatórias */}
            <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                    <thead>
                        <tr className="border-b border-border/60 bg-muted/30 text-[10.5px] uppercase tracking-wider font-medium text-muted-foreground select-none">
                            <th className="py-2.5 px-3 w-[15%]">Ângulo</th>
                            <th className="py-2.5 px-3 w-[35%]">Ideia melhorada</th>
                            <th className="py-2.5 px-3 w-[25%]">Gancho / Base</th>
                            <th className="py-2.5 px-3 w-[17%]">Retenção / Hook</th>
                            <th className="py-2.5 px-2.5 w-[8%] text-right pr-3">Ação</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40 font-normal">
                        {proposals.map(proposal => {
                            const hasCard = Boolean(proposal.cardId);

                            return (
                                <tr
                                    key={proposal.id}
                                    onClick={() => onOpenProposal(proposal)}
                                    className="hover:bg-muted/40 transition-colors cursor-pointer group"
                                >
                                    {/* 1. Ângulo */}
                                    <td className="py-3 px-3 align-top">
                                        <div className="flex flex-col gap-1">
                                            <span className="font-medium text-foreground leading-snug">
                                                {proposal.angulo}
                                            </span>
                                            <span className="inline-block w-fit text-[9.5px] font-normal px-1.5 py-0.2 rounded bg-muted text-muted-foreground">
                                                {proposal.formato}
                                            </span>
                                        </div>
                                    </td>

                                    {/* 2. Ideia melhorada */}
                                    <td className="py-3 px-3 align-top">
                                        <p className="text-foreground leading-snug line-clamp-3">
                                            {proposal.ideiaMelhorada}
                                        </p>
                                    </td>

                                    {/* 3. Gancho / Base */}
                                    <td className="py-3 px-3 align-top">
                                        <p className="text-foreground/90 italic leading-snug line-clamp-3">
                                            "{proposal.ganchoBase}"
                                        </p>
                                    </td>

                                    {/* 4. Retenção / Hook */}
                                    <td className="py-3 px-3 align-top">
                                        <p className="text-muted-foreground leading-snug line-clamp-3">
                                            {proposal.retencaoHook}
                                        </p>
                                    </td>

                                    {/* Ações Rápidas */}
                                    <td className="py-3 px-2.5 align-top text-right pr-3" onClick={e => e.stopPropagation()}>
                                        <div className="flex items-center justify-end gap-1">
                                            <button
                                                type="button"
                                                onClick={() => onOpenProposal(proposal)}
                                                className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded"
                                                title="Ver detalhe e roteiro"
                                            >
                                                <Eye size={13} />
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => onSendToKanban(proposal.id)}
                                                className={`p-1 rounded transition-colors ${
                                                    hasCard 
                                                        ? 'text-emerald-500 bg-emerald-500/10 hover:bg-emerald-500/20' 
                                                        : 'text-primary hover:bg-primary/10'
                                                }`}
                                                title={hasCard ? "Já enviado ao Kanban (clica para reenviar)" : "Aprovar e Enviar para o Kanban"}
                                            >
                                                {hasCard ? <Check size={13} /> : <Send size={13} />}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
