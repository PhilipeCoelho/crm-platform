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
    const layouts = useMemo(() => ({
        lg: items.map(item => ({
            i: item.id,
            x: item.x,
            y: item.y,
            w: item.w,
            h: item.h,
            minW: 2,
            minH: 2
        }))
    }), [items]);

    // Internal state to track optimistic updates while dragging
    const [currentLayout, setCurrentLayout] = useState(layouts.lg);

    useEffect(() => {
        setCurrentLayout(layouts.lg);
    }, [layouts]);

    const handleLayoutChange = (layout: any) => {
        setCurrentLayout(layout);
        // Map back to our GridItem format for persistence
        const newItems = layout.map((l: any) => {
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
                layouts={{ lg: currentLayout }}
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
