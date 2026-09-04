import { Layers } from 'lucide-react';
import ContentEmptyState from '@/components/content/ContentEmptyState';

export default function ContentProduction() {
  return (
    <ContentEmptyState
      icon={Layers}
      title="Produção"
      description="Transforme ideias selecionadas em conteúdos executáveis. Acompanhe o progresso de cada peça desde o rascunho até a aprovação final, com um fluxo visual claro e organizado."
    />
  );
}
