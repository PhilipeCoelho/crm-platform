import { useCRM } from '@/contexts/CRMContext';
import { GridItem } from '@/components/dashboard/DashboardGrid';
import { startOfDay, isToday, parseISO, isBefore } from 'date-fns';
import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

const LAYOUT_STORAGE_KEY = 'dashboard_layout_v2_1';

const DEFAULT_LAYOUT: GridItem[] = [
    { id: 'lateActivities', x: 0, y: 0, w: 6, h: 3 },
    { id: 'noActionDeals', x: 6, y: 0, w: 6, h: 3 },
    { id: 'dailyActivities', x: 0, y: 3, w: 6, h: 2 },
    { id: 'monthlyRevenue', x: 6, y: 3, w: 6, h: 2 },
    { id: 'pipelineValue', x: 0, y: 5, w: 3, h: 1 },
    { id: 'openDeals', x: 3, y: 5, w: 3, h: 1 },
    { id: 'wonDeals', x: 6, y: 5, w: 3, h: 1 },
    { id: 'lostDeals', x: 9, y: 5, w: 3, h: 1 },
    { id: 'todayAgenda', x: 0, y: 6, w: 12, h: 4 },
];

export function useDashboardData() {
    const { deals, activities, updateActivity, deleteActivity } = useCRM();
    const navigate = useNavigate();

    // --- Date Filtering State ---
    const [monthFilter, setMonthFilter] = useState<string[]>([startOfDay(new Date()).toISOString().slice(0, 7)]); // ['YYYY-MM']

    const toggleMonthFilter = useCallback((monthStr: string) => {
        setMonthFilter(prev => {
            if (prev.includes(monthStr)) {
                const next = prev.filter(m => m !== monthStr);
                return next.length ? next : [startOfDay(new Date()).toISOString().slice(0, 7)];
            } else {
                return [...prev, monthStr];
            }
        });
    }, []);

    const matchesFilter = useCallback((dateStr?: string) => {
        if (!dateStr) return false;
        const month = dateStr.slice(0, 7);
        return monthFilter.includes(month);
    }, [monthFilter]);

    // --- Stats Calculation ---
    const today = startOfDay(new Date());

    const completedTodayCount = activities.filter(a =>
        a.completed && a.dueDate && isToday(parseISO(a.dueDate))
    ).length;

    // Filter Logic:
    const totalPipelineValue = deals
        .filter(d => d.status === 'open' && matchesFilter(d.createdAt))
        .reduce((sum, d) => sum + d.value, 0);

    const totalOpenDeals = deals.filter(d => d.status === 'open' && matchesFilter(d.createdAt)).length;
    const wonDealsCount = deals.filter(d => d.status === 'won' && matchesFilter(d.wonAt)).length;
    const lostDealsCount = deals.filter(d => d.status === 'lost' && matchesFilter(d.lostAt)).length;

    const revenueInPeriod = deals
        .filter(d => d.status === 'won' && matchesFilter(d.wonAt))
        .reduce((sum, d) => sum + d.value, 0);

    // --- Goals State ---
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

    // Adjusted Goal based on number of selected months
    const adjustedRevenueGoal = revenueGoal * monthFilter.length;
    const adjustedActivityGoal = activityGoal;

    // --- Lists Processing ---
    // Lists are likely operational and shouldn't disappear when filtering historical data,
    // BUT user context might imply "Show me activities from that month?".
    // Usually "Today's Agenda" is always today. "Overdue" is always overdue.
    // "Deals Without Action" is current state.
    // So we Keep lists independent of the month filter (standard dashboard behavior).

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
            currentMonthRevenue: revenueInPeriod,
            revenueGoal: adjustedRevenueGoal,
            activityGoal: adjustedActivityGoal,
            monthFilter
        },
        lists: {
            overdueActivities,
            todayActivities,
            dealsWithoutAction
        },
        actions: {
            toggleMonthFilter,
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
