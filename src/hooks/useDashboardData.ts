import { useCRM } from '@/contexts/CRMContext';
import { GridItem } from '@/components/dashboard/DashboardGrid';
import { startOfDay, isToday, parseISO, isBefore, subDays, startOfMonth, isAfter, isWithinInterval, endOfDay, subMonths, endOfMonth } from 'date-fns';
import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { filterRealActivities } from '@/utils/activityHelpers';

const LAYOUT_STORAGE_KEY = 'dashboard_layout_v2_2';

const DEFAULT_LAYOUT: GridItem[] = [
    { id: 'dailyActivities', x: 0, y: 0, w: 6, h: 2 },
    { id: 'monthlyRevenue', x: 6, y: 0, w: 6, h: 2 },
    { id: 'pipelineValue', x: 0, y: 2, w: 3, h: 1 },
    { id: 'openDeals', x: 3, y: 2, w: 3, h: 1 },
    { id: 'wonDeals', x: 6, y: 2, w: 3, h: 1 },
    { id: 'lostDeals', x: 9, y: 2, w: 3, h: 1 },
];

export type ProductivityFilter = 'today' | '7d' | '30d' | '90d' | 'month' | 'custom';
export type RevenueFilter = 'this_month' | 'last_month' | '30d' | '90d' | 'custom';

export function useDashboardData() {
    const { deals, activities, updateActivity, deleteActivity } = useCRM();
    const navigate = useNavigate();

    // --- State ---

    // Productivity Filter
    const [productivityFilter, setProductivityFilter] = useState<ProductivityFilter>('today');
    const [productivityCustomRange, setProductivityCustomRange] = useState<{ start: Date | null, end: Date | null }>({ start: null, end: null });

    // Revenue Filter
    const [revenueFilter, setRevenueFilter] = useState<RevenueFilter>('this_month');
    const [revenueCustomRange, setRevenueCustomRange] = useState<{ start: Date | null, end: Date | null }>({ start: null, end: null });



    // Productivity Matcher
    const matchesProductivityPeriod = useCallback((dateStr?: string | null) => {
        if (!dateStr) return false;

        // Handle date-only strings like "2026-02-17" by adding noon UTC to avoid timezone shifts
        let normalizedDate = dateStr;
        if (normalizedDate.length === 10) {
            normalizedDate = `${normalizedDate}T12:00:00Z`;
        }

        const date = parseISO(normalizedDate);
        const now = new Date();

        switch (productivityFilter) {
            case 'today': return isToday(date);
            case '7d': return isAfter(date, subDays(now, 7));
            case '30d': return isAfter(date, subDays(now, 30));
            case '90d': return isAfter(date, subDays(now, 90));
            case 'month': return isAfter(date, startOfMonth(now));
            case 'custom':
                if (!productivityCustomRange.start) return true;
                return isWithinInterval(date, {
                    start: startOfDay(productivityCustomRange.start),
                    end: endOfDay(productivityCustomRange.end || now)
                });
            default: return true;
        }
    }, [productivityFilter, productivityCustomRange]);

    // Revenue Matcher
    const matchesRevenuePeriod = useCallback((dateStr?: string) => {
        if (!dateStr) return false;
        const date = parseISO(dateStr);
        const now = new Date();

        switch (revenueFilter) {
            case 'this_month':
                return isWithinInterval(date, { start: startOfMonth(now), end: endOfMonth(now) });
            case 'last_month':
                const lastMonthStart = startOfMonth(subMonths(now, 1));
                const lastMonthEnd = endOfMonth(subMonths(now, 1));
                return isWithinInterval(date, { start: lastMonthStart, end: lastMonthEnd });
            case '30d': return isAfter(date, subDays(now, 30));
            case '90d': return isAfter(date, subDays(now, 90));
            case 'custom':
                if (!revenueCustomRange.start) return true;
                return isWithinInterval(date, {
                    start: startOfDay(revenueCustomRange.start),
                    end: endOfDay(revenueCustomRange.end || now)
                });
            default: return true;
        }
    }, [revenueFilter, revenueCustomRange]);

    // --- Stats Calculation ---


    // 1. Productivity Stats - APENAS atividades reais (não notas)
    const realActivities = filterRealActivities(activities);

    const completedActivities = realActivities.filter(a =>
        a.completed &&
        a.dealId &&
        matchesProductivityPeriod(a.completedAt || a.dueDate)
    );

    // Let's explicitly calculate "Today's Real Score" for the goal comparison
    const todayProductivityScore = realActivities.filter(a => {
        const dateStr = a.completedAt || a.dueDate;
        if (!a.completed || !a.dealId || !dateStr) return false;

        let normalizedDate = dateStr;
        if (normalizedDate.length === 10) {
            normalizedDate = `${normalizedDate}T12:00:00Z`;
        }
        return isToday(parseISO(normalizedDate));
    }).length;

    // Debugging logs to identify why counts might be 0 after refresh
    console.debug('Dashboard Stats Debug:', {
        totalActivities: activities.length,
        realActivities: realActivities.length,
        completedActivities: completedActivities.length,
        todayScore: todayProductivityScore,
        productivityFilter
    });

    // 2. Revenue & Status Stats
    const revenueInPeriod = deals
        .filter(d => d.status === 'won')
        .filter(d => matchesRevenuePeriod(d.wonAt))
        .reduce((sum, d) => sum + d.value, 0);

    // Only show goal if viewing THIS MONTH
    const isRevenueGoalVisible = revenueFilter === 'this_month';

    // General Stats - Dashboard should consider ONLY OPEN status for pipeline sums
    const totalPipelineValue = deals
        .filter(d => d.status === 'open')
        .reduce((sum, d) => sum + d.value, 0);

    const totalOpenDeals = deals.filter(d => d.status === 'open').length;

    // Won/Lost Counts - Sync with the monthly/period view
    const wonDealsCount = deals.filter(d => d.status === 'won' && matchesRevenuePeriod(d.wonAt)).length;
    const lostDealsCount = deals.filter(d => d.status === 'lost' && matchesRevenuePeriod(d.lostAt)).length;


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

    // --- Lists Processing - APENAS atividades reais ---
    const openRealActivities = realActivities.filter(a => !a.completed).sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));

    const now = new Date();

    const overdueActivities = openRealActivities.filter(a => {
        if (!a.dueDate) return false;
        const dueDate = parseISO(a.dueDate);
        return isBefore(dueDate, now);
    });

    const todayActivities = openRealActivities.filter(a => {
        if (!a.dueDate) return false;
        const dueDate = parseISO(a.dueDate);
        return isToday(dueDate) && isAfter(dueDate, now);
    });

    const upcomingActivities = openRealActivities.filter(a => {
        if (!a.dueDate) return false;
        const dueDate = parseISO(a.dueDate);
        return isAfter(dueDate, endOfDay(now));
    });

    const dealsWithoutAction = deals.filter(deal => {
        if (deal.status !== 'open') return false;
        const hasOpenActivity = realActivities.some(a => a.dealId === deal.id && !a.completed);
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
            // Productivity
            productivityCount: completedActivities.length,
            todayProductivityScore, // For the "Goal" bar when in 'today' mode
            productivityFilter,
            productivityCustomRange,
            activityGoal,

            // Revenue
            currentRevenue: revenueInPeriod,
            revenueGoal,
            isRevenueGoalVisible,
            revenueFilter,
            revenueCustomRange,

            // General
            totalPipelineValue,
            totalOpenDeals,
            wonDealsCount,
            lostDealsCount,
        },
        lists: {
            overdueActivities,
            todayActivities,
            upcomingActivities,
            dealsWithoutAction,
            completedActivities: realActivities
                .filter(a => a.completed)
                .sort((a, b) => (b.dueDate || b.createdAt).localeCompare(a.dueDate || a.createdAt))
                .slice(0, 10) // Only last 10 for dashboard
        },
        actions: {
            // Productivity
            setProductivityFilter,
            setProductivityCustomRange,
            handleActivityGoalChange,

            // Revenue
            setRevenueFilter,
            setRevenueCustomRange,
            handleRevenueGoalChange,

            // General
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
