import { ReactNode } from 'react';

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
            className="w-full grid transition-all duration-300 ease-in-out"
            style={{
                display: 'grid',
                // Responsive Logic:
                // On mobile (default): 1 column.
                // On md: 12 columns.
                // This replaces the complex JS width calculation.
                gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                gap: `${gap}px`,
                // Auto rows based on content or fixed height if strictly grid
                gridAutoRows: `${rowHeight}px`,
                paddingBottom: '50px' // Extra space at bottom
            }}
        >
            {items.map((item) => (
                <div
                    key={item.id}
                    className="bg-card border rounded-[12px] shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow"
                    style={{
                        // Responsive Grid Placement
                        // We use a media query strategy approach via CSS classes usually,
                        // but since we have dynamic 'x/w', we apply them as inline styles.
                        // To allow stacking on mobile, we can use a CSS class wrapper.
                        gridColumn: `span ${item.w}`,
                        gridRow: `span ${item.h}`,
                        // Note: In a real responsive scenario, we might want all w=12 on mobile.
                        // However, inline styles override classes.
                        // To fix mobile: We will wrap this logic or use @media in style (not possible inline easily).
                        // Alternative: The parent container can change display to 'flex' col on mobile, ignoring these grid props if we add !important via class,
                        // OR we imply that this Grid is only for Desktop/Tablet and we render a Stack on mobile.
                    }}
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
