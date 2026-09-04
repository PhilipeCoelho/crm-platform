import { Sparkles } from 'lucide-react';
import ContentEmptyState from '@/components/content/ContentEmptyState';

export default function ContentOpportunities() {
  return (
    <ContentEmptyState
      icon={Sparkles}
      title="Oportunidades"
      description="Quando experiências, sinais comerciais e ideias começarem a entrar no sistema, o motor de inteligência cruzará essas fontes e mostrará as melhores oportunidades de conteúdo aqui."
    />
  );
}
