import { ReactNode, useState, useEffect, useMemo } from 'react';
import { Responsive } from 'react-grid-layout';
// @ts-ignore
import { WidthProvider } from 'react-grid-layout/legacy';
import { GripVertical } from 'lucide-react';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const ResponsiveGridLayout = WidthProvider(Responsive) as any;

export interface GridItem {
    id: string;
    x: number;
    y: number;
    w: number;
    h: number;
    content: ReactNode;
}

interface DraggableGridProps {
    items: GridItem[];
    onLayoutChange: (items: GridItem[]) => void;
    cols?: number;
    rowHeight?: number;
    gap?: number;
    isEditable?: boolean;
}

export default function DraggableGrid({
    items,
    onLayoutChange,
    rowHeight = 100,
    gap = 24,
    isEditable = false
}: DraggableGridProps) {
    // Transform our safe GridItem[] to RGL's expected layout format
    // We strictly separate the "Data Layout" from the "Content Map" to avoid RGL mutation issues
    // Transform our safe GridItem[] to RGL's expected layout format
    const layouts = useMemo(() => {
        const base = items.map(item => ({
            i: item.id,
            x: item.x,
            y: item.y,
            w: item.w,
            h: item.h,
            minW: 2,
            minH: 2
        }));

        // Helper to generate column-specific layouts
        const generateMobileLayout = (cols: number) => {
            // Sort by Y, then X to ensure vertical stacking order respects visual flow
            const sorted = [...base].sort((a, b) => {
                if (a.y === b.y) return a.x - b.x;
                return a.y - b.y;
            });

            return sorted.map((item, index) => ({
                ...item,
                x: 0, // Always start at left
                y: index * item.h, // Stack vertically based on height
                w: cols, // Full width
            }));
        };

        return {
            lg: base,
            md: base, // Let RGL handle slight resize for MD (10 cols) to avoid aggressive stacking
            sm: base, // Let RGL handle SM (6 cols) or... actually for 6 cols/tablet, let's keep it fluid.
            // But for true mobile, force stacking:
            xs: generateMobileLayout(4),
            xxs: generateMobileLayout(2)
        };
    }, [items]);

    // Internal state to track optimistic updates while dragging
    const [currentLayouts, setCurrentLayouts] = useState(layouts);

    useEffect(() => {
        setCurrentLayouts(layouts);
    }, [layouts]);

    const handleLayoutChange = (layout: any, allLayouts: any) => {
        setCurrentLayouts(allLayouts);

        // We persist based on the LG layout (source of truth) whenever possible
        // to prevent mobile-specific stacking from overwriting the desktop board structure permanently.
        const sourceLayout = allLayouts.lg || layout;

        // Map back to our GridItem format for persistence
        const newItems = sourceLayout.map((l: any) => {
            const original = items.find(i => i.id === l.i);
            return {
                id: l.i,
                x: l.x,
                y: l.y,
                w: l.w,
                h: l.h,
                content: original?.content || null
            } as GridItem;
        });
        onLayoutChange(newItems);
    };

    return (
        <div className="w-full min-h-[500px]">
            <ResponsiveGridLayout
                className="layout"
                layouts={currentLayouts}
                // Breakpoints match standard Tailwind (lg usually at 1200 or 1024, here we default to strict 12 col or responsive)
                breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
                cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
                rowHeight={rowHeight}
                margin={[gap, gap]}
                containerPadding={[0, 0]}
                isDraggable={isEditable}
                isResizable={isEditable}
                draggableHandle=".drag-handle"
                onLayoutChange={handleLayoutChange}
                useCSSTransforms={true}
                compactType="vertical" // Gravity UP
                preventCollision={false} // Allow pushing other items
                resizeHandle={
                    isEditable ? (
                        <div className="absolute bottom-0 right-0 w-6 h-6 cursor-se-resize z-20 flex items-end justify-end p-1 ">
                            <div className="w-2.5 h-2.5 border-r-2 border-b-2 border-primary/50 rounded-br-[2px]" />
                        </div>
                    ) : undefined
                }
            >
                {items.map((item) => (
                    <div
                        key={item.id}
                        className={`bg-card border rounded-[12px] shadow-sm overflow-hidden group transition-all duration-200
                        ${isEditable ? 'border-primary/40 hover:border-primary hover:shadow-md' : 'border-border/60'}
                        `}
                    >
                        {/* Drag Handle */}
                        {isEditable && (
                            <div
                                className="drag-handle absolute top-2 right-2 p-1.5 rounded-md bg-background/80 hover:bg-muted cursor-move z-30 shadow-sm border border-border/10 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <GripVertical size={16} className="text-muted-foreground" />
                            </div>
                        )}

                        {/* Content */}
                        <div className={`h-full w-full overflow-hidden ${isEditable ? 'pointer-events-none select-none' : ''}`}>
                            <div className="h-full w-full overflow-y-auto custom-scrollbar p-0">
                                {item.content}
                            </div>
                        </div>
                    </div>
                ))}
            </ResponsiveGridLayout>
        </div>
    );
}
