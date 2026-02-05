import { useCRM } from '@/contexts/CRMContext';
import { startOfDay, isToday, parseISO, isBefore } from 'date-fns';
import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

const LAYOUT_STORAGE_KEY = 'dashboard_layout_v1';

export interface GridItem {
    id: string;
    x: number;
    y: number;
    w: number;
    h: number;
}

const DEFAULT_LAYOUT: GridItem[] = [
    { id: 'dailyActivities', x: 0, y: 0, w: 6, h: 2 },
    { id: 'monthlyRevenue', x: 6, y: 0, w: 6, h: 2 },
    { id: 'pipelineValue', x: 0, y: 2, w: 4, h: 1 },
    { id: 'openDeals', x: 4, y: 2, w: 4, h: 1 },
    { id: 'wonDeals', x: 8, y: 2, w: 4, h: 1 },
    { id: 'todayAgenda', x: 0, y: 3, w: 12, h: 3 },
];

export function useDashboardData() {
    const { deals, activities, updateActivity, deleteActivity } = useCRM();
    const navigate = useNavigate();

    // --- Stats Calculation ---
    const today = startOfDay(new Date());

    const completedTodayCount = activities.filter(a =>
        a.completed && a.dueDate && isToday(parseISO(a.dueDate))
    ).length;

    const totalPipelineValue = deals
        .filter(d => d.status === 'open')
        .reduce((sum, d) => sum + d.value, 0);

    const totalOpenDeals = deals.filter(d => d.status === 'open').length;
    const wonDealsCount = deals.filter(d => d.status === 'won').length;

    const currentMonthRevenue = deals
        .filter(d => d.status === 'won' && (d.wonAt ? new Date(d.wonAt).getMonth() === new Date().getMonth() : true))
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

    return {
        stats: {
            completedTodayCount,
            totalPipelineValue,
            totalOpenDeals,
            wonDealsCount,
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
            navigate
        },
        DEFAULT_LAYOUT,
        LAYOUT_STORAGE_KEY
    };
}
