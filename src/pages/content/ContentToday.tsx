import { CalendarDays } from 'lucide-react';
import ContentEmptyState from '@/components/content/ContentEmptyState';

export default function ContentToday() {
  return (
    <ContentEmptyState
      icon={CalendarDays}
      title="Hoje"
      description="Capture acontecimentos, experiências e ideias do dia a dia. Registros feitos aqui alimentarão a inteligência de conteúdo e ajudarão a identificar oportunidades autênticas."
    />
  );
}
