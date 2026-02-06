import { ReactNode, useState, useRef, useEffect } from 'react';
import { GripVertical } from 'lucide-react';

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
    cols = 12,
    rowHeight = 100,
    gap = 24,
    isEditable = false
}: DraggableGridProps) {
    const [layout, setLayout] = useState<GridItem[]>(items);
    const [dragging, setDragging] = useState<string | null>(null);
    const [resizing, setResizing] = useState<string | null>(null);
    const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const saveTimeoutRef = useRef<NodeJS.Timeout>();

    // Update layout when items prop changes
    useEffect(() => {
        setLayout(items);
    }, [items]);

    // Auto-save with debounce
    const saveLayout = (newLayout: GridItem[]) => {
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }
        saveTimeoutRef.current = setTimeout(() => {
            onLayoutChange(newLayout);
        }, 400);
    };

    const getColWidth = () => {
        if (!containerRef.current) return 0;
        const containerWidth = containerRef.current.offsetWidth;
        return (containerWidth - gap * (cols - 1)) / cols;
    };

    const pixelToGrid = (x: number, y: number) => {
        const colWidth = getColWidth();
        const gridX = Math.round(x / (colWidth + gap));
        const gridY = Math.round(y / (rowHeight + gap));
        return { gridX: Math.max(0, Math.min(gridX, cols - 1)), gridY: Math.max(0, gridY) };
    };

    // Unified Event Handlers (Mouse + Touch)
    const getClientCoords = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
        if ('touches' in e) {
            return { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
        return { x: (e as MouseEvent).clientX, y: (e as MouseEvent).clientY };
    };

    const handleDragStart = (e: React.MouseEvent | React.TouchEvent, itemId: string) => {
        if (!isEditable) return;
        // e.preventDefault(); // Don't prevent default on touch immediately or scroll breaks
        const coords = getClientCoords(e);
        setDragging(itemId);
        setDragStart(coords);
    };

    const handleResizeStart = (e: React.MouseEvent | React.TouchEvent, itemId: string) => {
        if (!isEditable) return;
        e.preventDefault();
        e.stopPropagation();
        const coords = getClientCoords(e);
        setResizing(itemId);
        setDragStart(coords);
    };

    const handleMove = (e: MouseEvent | TouchEvent) => {
        if (!dragStart || !containerRef.current) return;

        const coords = getClientCoords(e);
        const deltaX = coords.x - dragStart.x;
        const deltaY = coords.y - dragStart.y;

        // Prevent scrolling while dragging/resizing
        if (e.cancelable) e.preventDefault();

        if (dragging) {
            const item = layout.find(i => i.id === dragging);
            if (!item) return;

            const { gridX, gridY } = pixelToGrid(deltaX, deltaY);

            const newX = Math.max(0, Math.min(item.x + gridX, cols - item.w));
            const newY = Math.max(0, item.y + gridY);

            if (newX !== item.x || newY !== item.y) {
                const newLayout = layout.map(i =>
                    i.id === dragging ? { ...i, x: newX, y: newY } : i
                );
                setLayout(newLayout);
                setDragStart(coords);
            }
        }

        if (resizing) {
            const item = layout.find(i => i.id === resizing);
            if (!item) return;

            const { gridX, gridY } = pixelToGrid(deltaX, deltaY);

            const newW = Math.max(2, Math.min(item.w + gridX, cols - item.x));
            const newH = Math.max(1, item.h + gridY);

            if (newW !== item.w || newH !== item.h) {
                const newLayout = layout.map(i =>
                    i.id === resizing ? { ...i, w: newW, h: newH } : i
                );
                setLayout(newLayout);
                setDragStart(coords);
            }
        }
    };

    const handleEnd = () => {
        if (dragging || resizing) {
            saveLayout(layout);
        }
        setDragging(null);
        setResizing(null);
        setDragStart(null);
    };

    useEffect(() => {
        if (dragging || resizing) {
            const moveEvents = ['mousemove', 'touchmove'];
            const endEvents = ['mouseup', 'touchend'];

            moveEvents.forEach(ev => document.addEventListener(ev, handleMove as any, { passive: false }));
            endEvents.forEach(ev => document.addEventListener(ev, handleEnd));

            return () => {
                moveEvents.forEach(ev => document.removeEventListener(ev, handleMove as any));
                endEvents.forEach(ev => document.removeEventListener(ev, handleEnd));
            };
        }
    }, [dragging, resizing, dragStart, layout]);

    const getItemStyle = (item: GridItem): React.CSSProperties => {
        const colWidth = getColWidth();
        return {
            position: 'absolute',
            left: `${item.x * (colWidth + gap)}px`,
            top: `${item.y * (rowHeight + gap)}px`,
            width: `${item.w * colWidth + (item.w - 1) * gap}px`,
            height: `${item.h * rowHeight + (item.h - 1) * gap}px`,
            transition: dragging === item.id || resizing === item.id ? 'none' : 'all 300ms cubic-bezier(0.25, 0.8, 0.25, 1)',
            opacity: dragging === item.id ? 0.9 : 1,
            zIndex: dragging === item.id || resizing === item.id ? 50 : 1,
            scale: dragging === item.id ? '1.02' : '1',
            boxShadow: dragging === item.id ? '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)' : undefined
        };
    };

    const maxY = Math.max(...layout.map(item => item.y + item.h), 0);
    const containerHeight = maxY * rowHeight + (maxY - 1) * gap;

    return (
        <div
            ref={containerRef}
            className="relative w-full transition-all duration-300"
            style={{ height: `${containerHeight}px`, minHeight: '400px' }}
        >
            {layout.map(item => (
                <div
                    key={item.id}
                    style={getItemStyle(item)}
                    className={`bg-card border rounded-[12px] overflow-hidden group 
                        ${resizing === item.id ? 'border-primary ring-2 ring-primary/20' : 'border-border/60'} 
                        ${isEditable ? 'cursor-grab active:cursor-grabbing hover:border-primary/50' : ''}
                    `}
                >
                    {/* Drag Handle - Only visible in Edit Mode */}
                    {isEditable && (
                        <div
                            onMouseDown={(e) => handleDragStart(e, item.id)}
                            onTouchStart={(e) => handleDragStart(e, item.id)}
                            className="absolute top-2 right-2 p-1.5 rounded-md bg-background/80 hover:bg-muted cursor-grab active:cursor-grabbing z-20 shadow-sm border border-border/10 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            <GripVertical size={16} className="text-muted-foreground" />
                        </div>
                    )}

                    {/* Content */}
                    <div className={`h-full w-full overflow-hidden ${isEditable ? 'pointer-events-none select-none' : ''}`}>
                        {/* Wrap content in a div that handles internal scroll if not editing */}
                        <div className="h-full w-full overflow-y-auto custom-scrollbar p-0">
                            {item.content}
                        </div>
                    </div>

                    {/* Resize Handle - Only visible in Edit Mode */}
                    {isEditable && (
                        <div
                            onMouseDown={(e) => handleResizeStart(e, item.id)}
                            onTouchStart={(e) => handleResizeStart(e, item.id)}
                            className="absolute bottom-0 right-0 w-8 h-8 cursor-nwse-resize z-20 flex items-end justify-end p-1.5 hover:bg-muted/10 rounded-tl-xl transition-colors"
                        >
                            <div className="w-2.5 h-2.5 border-r-2 border-b-2 border-primary/50 rounded-br-[2px]" />
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}
