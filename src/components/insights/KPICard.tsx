import VariationBadge from './VariationBadge';

interface KPICardProps {
    title: string;
    value: string | number;
    variation?: number;
    subtitle?: string;
    icon?: React.ReactNode;
    loading?: boolean;
}

export default function KPICard({ title, value, variation, subtitle, icon, loading }: KPICardProps) {
    if (loading) {
        return (
            <div className="h-28 bg-[#E5E7EB] dark:bg-[#1F2937] animate-pulse rounded-xl" />
        );
    }

    return (
        <div className="flex flex-col gap-1 p-5 bg-[#FFFFFF] dark:bg-[#141414] rounded-xl border border-[#E5E7EB] dark:border-[#262626] shadow-sm hover:shadow-md transition-shadow duration-200">
            {icon && <div className="mb-1 text-primary">{icon}</div>}
            <span className="text-[10px] uppercase font-bold text-[#6B7280] dark:text-[#8A8A8A] tracking-widest">
                {title}
            </span>
            <div className="flex items-baseline gap-3 my-1">
                <span className="text-4xl font-semibold tracking-tighter text-[#111827] dark:text-[#EAEAEA]">
                    {value}
                </span>
                {variation !== undefined && <VariationBadge value={variation} />}
            </div>
            {subtitle && (
                <span className="text-xs text-[#6B7280] dark:text-[#8A8A8A] font-medium">
                    {subtitle}
                </span>
            )}
        </div>
    );
}
