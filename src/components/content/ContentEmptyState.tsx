import { LucideIcon } from 'lucide-react';

interface ContentEmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  className?: string;
}

export default function ContentEmptyState({
  icon: Icon,
  title,
  description,
  className = '',
}: ContentEmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center gap-4 py-16 px-4 ${className}`}>
      <div className="bg-muted rounded-full p-4">
        <Icon size={28} className="text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold text-foreground text-center">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-md text-center">
        {description}
      </p>
    </div>
  );
}
