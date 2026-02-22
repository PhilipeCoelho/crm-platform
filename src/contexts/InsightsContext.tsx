import React, { createContext, useContext, useState, useEffect } from 'react';
import { subDays, format } from 'date-fns';
import { getInsightsData, InsightsData } from '@/services/insights';

export type PeriodType = '7d' | '30d' | '90d' | 'all' | 'custom';

interface InsightsContextType {
    period: PeriodType;
    setPeriod: (period: PeriodType) => void;
    startDate: string;
    endDate: string;
    setCustomRange: (start: string, end: string) => void;
    isComparing: boolean;
    setIsComparing: (value: boolean) => void;
    comparisonDates: {
        startDate: string;
        endDate: string;
    } | null;
    data: InsightsData | null;
    loading: boolean;
}

const InsightsContext = createContext<InsightsContextType | undefined>(undefined);

export function InsightsProvider({ children }: { children: React.ReactNode }) {
    const [period, setPeriod] = useState<PeriodType>('30d');
    const [isComparing, setIsComparing] = useState(false);
    const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [comparisonDates, setComparisonDates] = useState<{ startDate: string; endDate: string } | null>(null);
    const [data, setData] = useState<InsightsData | null>(null);
    const [loading, setLoading] = useState(true);

    // Update dates based on period
    useEffect(() => {
        if (period === 'custom') return;

        if (period === 'all') {
            setStartDate('2020-01-01');
            setEndDate(format(new Date(), 'yyyy-MM-dd'));
            return;
        }

        const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
        const start = format(subDays(new Date(), days), 'yyyy-MM-dd');
        const end = format(new Date(), 'yyyy-MM-dd');

        setStartDate(start);
        setEndDate(end);
    }, [period]);

    // Calculate comparison period
    useEffect(() => {
        if (!isComparing) {
            setComparisonDates(null);
            return;
        }

        const start = new Date(startDate);
        const end = new Date(endDate);
        const durationMs = end.getTime() - start.getTime();

        // previous_end_date = start_date - 1 day
        const prevEnd = new Date(start);
        prevEnd.setDate(prevEnd.getDate() - 1);

        // previous_start_date = previous_end_date - duration
        const prevStart = new Date(prevEnd.getTime() - durationMs);

        setComparisonDates({
            startDate: format(prevStart, 'yyyy-MM-dd'),
            endDate: format(prevEnd, 'yyyy-MM-dd')
        });
    }, [isComparing, startDate, endDate]);

    const setCustomRange = (start: string, end: string) => {
        setStartDate(start);
        setEndDate(end);
        setPeriod('custom');
    };

    // Fetch data centrally
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const result = await getInsightsData(
                    startDate,
                    endDate,
                    comparisonDates?.startDate,
                    comparisonDates?.endDate
                );
                setData(result);
            } catch (error) {
                console.error("Error loading insights data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [startDate, endDate, comparisonDates]);

    return (
        <InsightsContext.Provider value={{
            period,
            setPeriod,
            startDate,
            endDate,
            setCustomRange,
            isComparing,
            setIsComparing,
            comparisonDates,
            data,
            loading
        }}>
            {children}
        </InsightsContext.Provider>
    );
}

export function useInsights() {
    const context = useContext(InsightsContext);
    if (!context) {
        throw new Error('useInsights must be used within an InsightsProvider');
    }
    return context;
}
