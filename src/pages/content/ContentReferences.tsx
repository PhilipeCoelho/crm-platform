import { BookMarked } from 'lucide-react';
import ContentEmptyState from '@/components/content/ContentEmptyState';

export default function ContentReferences() {
  return (
    <ContentEmptyState
      icon={BookMarked}
      title="Referências"
      description="Guarde referências, exemplos e inspirações para consulta durante a produção. Links, imagens, vídeos e anotações organizados por tema e vinculados às suas ideias."
    />
  );
}
