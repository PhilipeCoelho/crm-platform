import { useCRM } from '@/contexts/CRMContext';
import { GridItem } from '@/components/dashboard/DashboardGrid';
import { startOfDay, isToday, parseISO, isBefore } from 'date-fns';
import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

const LAYOUT_STORAGE_KEY = 'dashboard_layout_v2_1';

const DEFAULT_LAYOUT: GridItem[] = [
    { id: 'dailyActivities', x: 0, y: 0, w: 6, h: 2 },
    { id: 'monthlyRevenue', x: 6, y: 0, w: 6, h: 2 },
    { id: 'pipelineValue', x: 0, y: 2, w: 3, h: 1 },
    { id: 'openDeals', x: 3, y: 2, w: 3, h: 1 },
    { id: 'wonDeals', x: 6, y: 2, w: 3, h: 1 },
    { id: 'lostDeals', x: 9, y: 2, w: 3, h: 1 },
    { id: 'todayAgenda', x: 0, y: 3, w: 12, h: 4 },
];

export function useDashboardData() {
    const { deals, activities, updateActivity, deleteActivity } = useCRM();
    const navigate = useNavigate();

    // --- Stats Calculation ---
    // Date Filtering State
    const [monthFilter, setMonthFilter] = useState<string[]>([startOfDay(new Date()).toISOString().slice(0, 7)]); // ['YYYY-MM']

    const toggleMonthFilter = useCallback((monthStr: string) => {
        setMonthFilter(prev => {
            if (prev.includes(monthStr)) {
                // Prevent empty filter? Or allow all? Let's allow empty to mean "All Time" or default to current.
                // User requirement: "mostrar acumulado... janeiro e fevereiro".
                // If empty, let's revert to current month or show all. Let's show All Time if empty?
                // Or prevents unselecting the last one?
                // Let's standard: Toggle. Helper `matchesFilter` handles empty as "All"? Or just empty.
                const next = prev.filter(m => m !== monthStr);
                return next.length ? next : [startOfDay(new Date()).toISOString().slice(0, 7)]; // Default to current if empty
            } else {
                return [...prev, monthStr];
            }
        });
    }, []);

    const matchesFilter = useCallback((dateStr?: string) => {
        if (!dateStr) return false;
        // dateStr is ISO. We need YYYY-MM.
        const month = dateStr.slice(0, 7);
        return monthFilter.includes(month);
    }, [monthFilter]);

    const completedTodayCount = activities.filter(a =>
        a.completed && a.dueDate && isToday(parseISO(a.dueDate))
    ).length;

    // Filter Logic:
    // Open: Created in selected months AND currently open.
    // Won: WonAt in selected months.
    // Lost: LostAt in selected months.
    // Value: Value of Open deals created in selected months.

    const totalPipelineValue = deals
        .filter(d => d.status === 'open' && matchesFilter(d.createdAt))
        .reduce((sum, d) => sum + d.value, 0);

    const totalOpenDeals = deals.filter(d => d.status === 'open' && matchesFilter(d.createdAt)).length;
    const wonDealsCount = deals.filter(d => d.status === 'won' && matchesFilter(d.wonAt)).length;
    const lostDealsCount = deals.filter(d => d.status === 'lost' && matchesFilter(d.lostAt)).length;

    // Revenue goal is usually monthly. If multiple months selected, should we multiply goal?
    // User: "acumulado de fev, mas se quiser buscar jan e fev".
    // Current logic: `currentMonthRevenue` was specific to current actual month.
    // We should change `currentMonthRevenue` to `revenueInPeriod`.
    const revenueInPeriod = deals
        .filter(d => d.status === 'won' && matchesFilter(d.wonAt))
        .reduce((sum, d) => sum + d.value, 0);

    // Goal: adjusted by number of selected months?
    // If I select 2 months, goal should probably be 2x? Or just show sum vs fixed goal?
    // Let's keep goal simple for now (monthly goal) and maybe user adjusts it, or we sum it.
    // Let's multiply goal by month count.
    const adjustedRevenueGoal = revenueGoal * monthFilter.length;
    const adjustedActivityGoal = activityGoal; // Daily goal doesn't scale with month filter easily in this UI (Daily is 24h).

    // ... (Keep Goals State same) ...
    // ... (Keep Lists same - lists are operational, maybe shouldn't be filtered by dashboard date header?)
    // Lists: "Overdue", "Today", "Deals without action". These are immediate operational tasks.
    // They should probably Ignore the "Historical Filter".

    // ...

    return {
        stats: {
            completedTodayCount,
            totalPipelineValue,
            totalOpenDeals,
            wonDealsCount,
            lostDealsCount,
            currentMonthRevenue: revenueInPeriod, // Check this mapping in Dashboard
            revenueGoal: adjustedRevenueGoal,
            activityGoal: adjustedActivityGoal,
            monthFilter // Export
        },
        lists: {
            overdueActivities,
            todayActivities,
            dealsWithoutAction
        },
        actions: {
            toggleMonthFilter, // Export
            handleRevenueGoalChange,
            handleActivityGoalChange,
            handleToggleActivity,
            handleDeleteActivity,
            navigate,
            saveLayout,
            resetLayout
        },
        layout,
        DEFAULT_LAYOUT,
        LAYOUT_STORAGE_KEY
    };
}
const [revenueGoal, setRevenueGoal] = useState(() => Number(localStorage.getItem('dashboard_revenue_goal')) || 5000);
const [activityGoal, setActivityGoal] = useState(() => Number(localStorage.getItem('dashboard_activity_goal')) || 10);

const handleRevenueGoalChange = (val: number) => {
    setRevenueGoal(val);
    localStorage.setItem('dashboard_revenue_goal', String(val));
};

const handleActivityGoalChange = (val: number) => {
    setActivityGoal(val);
    localStorage.setItem('dashboard_activity_goal', String(val));
};

// --- Lists Processing ---
const openActivities = activities.filter(a => !a.completed).sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));

const overdueActivities = openActivities.filter(a => {
    if (!a.dueDate) return false;
    return isBefore(parseISO(a.dueDate), today);
});

const todayActivities = openActivities.filter(a => {
    if (!a.dueDate) return false;
    return isToday(parseISO(a.dueDate));
});

const dealsWithoutAction = deals.filter(deal => {
    if (deal.status !== 'open') return false;
    const hasOpenActivity = activities.some(a => a.dealId === deal.id && !a.completed);
    return !hasOpenActivity;
});

// --- Actions ---
const handleToggleActivity = useCallback((id: string) => {
    const activity = activities.find(a => a.id === id);
    if (activity) {
        updateActivity(id, { completed: !activity.completed });
    }
}, [activities, updateActivity]);

const handleDeleteActivity = useCallback((id: string) => {
    if (window.confirm('Excluir atividade?')) {
        deleteActivity(id);
    }
}, [deleteActivity]);

// --- Layout State Management ---
const [layout, setLayout] = useState<GridItem[]>(() => {
    try {
        const saved = localStorage.getItem(LAYOUT_STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved) as GridItem[];
            // Merge with default to ensure any new widgets added in future updates appear
            // This logic prioritizes saved positions but adds missing default items
            const validItems = DEFAULT_LAYOUT.map(def => {
                const savedItem = parsed.find(p => p.id === def.id);
                return savedItem ? { ...def, ...savedItem, content: undefined } : def;
            });
            return validItems;
        }
    } catch (e) {
        console.error('Error loading layout', e);
    }
    return DEFAULT_LAYOUT;
});

const saveLayout = useCallback((newLayout: GridItem[]) => {
    // Strip content property before saving to avoid circular refs or huge storage usage
    const cleanLayout = newLayout.map(({ content, ...rest }) => rest);
    localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(cleanLayout));
    setLayout(newLayout);
}, []);

const resetLayout = useCallback(() => {
    localStorage.removeItem(LAYOUT_STORAGE_KEY);
    setLayout(DEFAULT_LAYOUT);
}, []);

return {
    stats: {
        completedTodayCount,
        totalPipelineValue,
        totalOpenDeals,
        wonDealsCount,
        lostDealsCount,
        currentMonthRevenue,
        revenueGoal,
        activityGoal
    },
    lists: {
        overdueActivities,
        todayActivities,
        dealsWithoutAction
    },
    actions: {
        handleRevenueGoalChange,
        handleActivityGoalChange,
        handleToggleActivity,
        handleDeleteActivity,
        navigate,
        saveLayout,
        resetLayout
    },
    layout, // Export current state
    DEFAULT_LAYOUT,
    LAYOUT_STORAGE_KEY
};
}
