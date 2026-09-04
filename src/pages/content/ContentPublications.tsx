import { Share2 } from 'lucide-react';
import ContentEmptyState from '@/components/content/ContentEmptyState';

export default function ContentPublications() {
  return (
    <ContentEmptyState
      icon={Share2}
      title="Publicações"
      description="Acompanhe conteúdos publicados e seus resultados. Visualize o histórico de publicações, métricas de desempenho e o impacto real do seu conteúdo no funil comercial."
    />
  );
}
