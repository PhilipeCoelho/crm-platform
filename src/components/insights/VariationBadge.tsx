import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

interface VariationBadgeProps {
    value: number | undefined;
    inverse?: boolean;
}

export default function VariationBadge({ value, inverse = false }: VariationBadgeProps) {
    if (value === undefined) return null;

    const isPositive = value > 0;
    const isNegative = value < 0;
    const isNeutral = value === 0;

    const formattedValue = Math.abs(value).toFixed(1) + '%';

    if (isNeutral) {
        return (
            <div className="flex items-center gap-1 text-[11px] font-bold text-muted-foreground bg-muted/20 px-1.5 py-0.5 rounded-full border border-border/30">
                <Minus size={10} />
                <span>—</span>
            </div>
        );
    }

    const isGood = inverse ? isNegative : isPositive;

    return (
        <div className={`
            flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border
            ${isGood
                ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20'
                : 'text-rose-500 bg-rose-500/10 border-rose-500/20'
            }
        `}>
            {isPositive ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
            <span>{formattedValue}</span>
        </div>
    );
}
