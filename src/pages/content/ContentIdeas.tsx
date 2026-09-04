import { Lightbulb } from 'lucide-react';
import ContentEmptyState from '@/components/content/ContentEmptyState';

export default function ContentIdeas() {
  return (
    <ContentEmptyState
      icon={Lightbulb}
      title="Ideias"
      description="Organize suas ideias de conteúdo em um único lugar. Ideias podem surgir do Daily, de sinais do CRM, de referências ou da sua criatividade. Aqui você valida, prioriza e seleciona o que merece virar conteúdo."
    />
  );
}
