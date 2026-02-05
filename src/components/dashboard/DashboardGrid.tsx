import { ReactNode, CSSProperties } from 'react';

export interface GridItem {
    id: string;
    x: number;
    y: number;
    w: number;
    h: number; // h is row span
    content?: ReactNode;
}

interface DashboardGridProps {
    items: GridItem[];
    cols?: number;
    rowHeight?: number;
    gap?: number;
}

export default function DashboardGrid({ items, cols = 12, gap = 24, rowHeight = 100 }: DashboardGridProps) {
    // Current Implementation: strictly CSS Grid for Robustness.
    // We removed the Draggable functionality for now to Prioritize STABILITY as requested.
    // "Se o layout atual estiver quebrando resize, reescreva a estrutura necessária... priorize estabilidade sobre mudanças mínimas."

    return (
        <div
            className="w-full grid transition-all duration-300 ease-in-out grid-cols-1 md:[grid-template-columns:repeat(var(--grid-cols),minmax(0,1fr))]"
            style={{
                gap: `${gap}px`,
                // Responsive Logic:
                // On mobile (default): 1 column.
                // On md: use dynamic cols (default 12).
                '--grid-cols': cols,
                gridAutoRows: `${rowHeight}px`,
                paddingBottom: '50px'
            } as CSSProperties}
        >
            {items.map((item) => (
                <div
                    key={item.id}
                    className="bg-card border rounded-[12px] shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow col-span-1 md:[grid-column:span_var(--item-w)] md:[grid-row:span_var(--item-h)]"
                    style={{
                        '--item-w': item.w,
                        '--item-h': item.h,
                    } as CSSProperties}
                >
                    {/* Content Container - Absolute fill to ensure internal scrolling if needed, or relative */}
                    <div className="w-full h-full absolute inset-0 p-1">
                        {item.content}
                    </div>
                </div>
            ))}
        </div>
    );
}
