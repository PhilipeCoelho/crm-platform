import { Brain } from 'lucide-react';
import ContentEmptyState from '@/components/content/ContentEmptyState';

export default function ContentIntelligence() {
  return (
    <ContentEmptyState
      icon={Brain}
      title="Inteligência"
      description="Entenda padrões de conteúdo, aprendizados e tendências. A inteligência conecta performance de publicações, sinais do CRM e dados do Daily para revelar o que realmente funciona."
    />
  );
}
