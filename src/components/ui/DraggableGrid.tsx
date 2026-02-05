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
}

export default function DraggableGrid({
    items,
    onLayoutChange,
    cols = 12,
    rowHeight = 100,
    gap = 24
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

    const handleDragStart = (e: React.MouseEvent, itemId: string) => {
        e.preventDefault();
        setDragging(itemId);
        setDragStart({ x: e.clientX, y: e.clientY });
    };

    const handleResizeStart = (e: React.MouseEvent, itemId: string) => {
        e.preventDefault();
        e.stopPropagation();
        setResizing(itemId);
        setDragStart({ x: e.clientX, y: e.clientY });
    };

    const handleMouseMove = (e: MouseEvent) => {
        if (!dragStart || !containerRef.current) return;

        const deltaX = e.clientX - dragStart.x;
        const deltaY = e.clientY - dragStart.y;

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
                setDragStart({ x: e.clientX, y: e.clientY });
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
                setDragStart({ x: e.clientX, y: e.clientY });
            }
        }
    };

    const handleMouseUp = () => {
        if (dragging || resizing) {
            saveLayout(layout);
        }
        setDragging(null);
        setResizing(null);
        setDragStart(null);
    };

    useEffect(() => {
        if (dragging || resizing) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            return () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
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
            transition: dragging === item.id || resizing === item.id ? 'none' : 'all 120ms ease-out',
            opacity: dragging === item.id ? 0.8 : 1,
            zIndex: dragging === item.id || resizing === item.id ? 1000 : 1,
        };
    };

    const maxY = Math.max(...layout.map(item => item.y + item.h), 0);
    const containerHeight = maxY * rowHeight + (maxY - 1) * gap;

    return (
        <div
            ref={containerRef}
            className="relative w-full"
            style={{ height: `${containerHeight}px`, minHeight: '400px' }}
        >
            {layout.map(item => (
                <div
                    key={item.id}
                    style={getItemStyle(item)}
                    className={`bg-card border rounded-[12px] shadow-[0_6px_24px_rgba(0,0,0,0.05)] dark:shadow-[0_6px_24px_rgba(0,0,0,0.35)] overflow-hidden ${resizing === item.id ? 'border-blue-500' : 'border-border/60'
                        } ${dragging === item.id ? 'shadow-2xl' : ''}`}
                >
                    {/* Drag Handle */}
                    <div
                        onMouseDown={(e) => handleDragStart(e, item.id)}
                        className="absolute top-2 right-2 p-1.5 rounded-md hover:bg-muted/50 cursor-move z-10 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Arrastar"
                    >
                        <GripVertical size={16} className="text-muted-foreground" />
                    </div>

                    {/* Content */}
                    <div className="h-full w-full overflow-auto p-6 group">
                        {item.content}
                    </div>

                    {/* Resize Handle */}
                    <div
                        onMouseDown={(e) => handleResizeStart(e, item.id)}
                        className="absolute bottom-0 right-0 w-6 h-6 cursor-se-resize opacity-0 hover:opacity-100 transition-opacity group-hover:opacity-50"
                        title="Redimensionar"
                    >
                        <div className="absolute bottom-1 right-1 w-3 h-3 border-r-2 border-b-2 border-blue-500 rounded-br" />
                    </div>
                </div>
            ))}
        </div>
    );
}
