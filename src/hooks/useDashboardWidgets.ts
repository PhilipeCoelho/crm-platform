import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { WidgetKey } from '@/data/widgetDefinitions';

export interface UserDashboardWidget {
    id?: string;
    widget_key: WidgetKey;
    position: number;
    is_visible?: boolean;
}

export function useDashboardWidgets() {
    const { user } = useSupabaseAuth();
    const [widgets, setWidgets] = useState<UserDashboardWidget[]>([]);
    const [isLoadingWidgets, setIsLoadingWidgets] = useState(true);
    const [showPriority, setShowPriority] = useState(true);

    const fetchWidgets = useCallback(async () => {
        if (!user) {
            setIsLoadingWidgets(false);
            return;
        }

        try {
            const { data, error } = await supabase
                .from('user_dashboard_widgets')
                .select('*')
                .eq('user_id', user.id)
                .order('position', { ascending: true });

            if (error) {
                console.warn("Could not load widgets from Supabase (maybe table missing?), using localStorage fallback.", error);

                // localStorage fallback
                const localData = localStorage.getItem(`crm_dashboard_widgets_${user.id}`);
                if (localData) {
                    try {
                        setWidgets(JSON.parse(localData));
                    } catch (e) {
                        console.error("Local storage parse error:", e);
                    }
                }
            } else if (data && data.length > 0) {
                setWidgets(data);
                localStorage.setItem(`crm_dashboard_widgets_${user.id}`, JSON.stringify(data));
            } else {
                // Empty array returned from DB, check local
                const localData = localStorage.getItem(`crm_dashboard_widgets_${user.id}`);
                if (localData) {
                    setWidgets(JSON.parse(localData));
                }
            }
        } catch (e) {
            console.error('Error fetching dashboard widgets:', e);
            const localData = localStorage.getItem(`crm_dashboard_widgets_${user.id}`);
            if (localData) {
                try {
                    setWidgets(JSON.parse(localData));
                } catch (e) { }
            }
        } finally {
            setIsLoadingWidgets(false);
        }
    }, [user]);

    // Initial load
    useEffect(() => {
        fetchWidgets();
        if (user) {
            const saved = localStorage.getItem(`crm_show_priority_${user.id}`);
            if (saved !== null) {
                setShowPriority(saved === 'true');
            }
        }
    }, [fetchWidgets, user]);

    const togglePriority = useCallback((val: boolean) => {
        if (!user) return;
        setShowPriority(val);
        localStorage.setItem(`crm_show_priority_${user.id}`, String(val));
    }, [user]);

    const saveWidgets = async (newWidgets: UserDashboardWidget[]) => {
        if (!user) return;

        // 1. Optimistic UI and LocalStorage update
        setWidgets(newWidgets);
        localStorage.setItem(`crm_dashboard_widgets_${user.id}`, JSON.stringify(newWidgets));

        try {
            // 2. Fetch current state from DB for comparison
            const { data: currentDBWidgets } = await supabase
                .from('user_dashboard_widgets')
                .select('id, widget_key, position')
                .eq('user_id', user.id);

            const dbWidgets = currentDBWidgets || [];
            const newKeys = newWidgets.map(nw => nw.widget_key);

            // 3. Identify widgets to DELETE (in DB but not in our new list)
            const keysToRemove = dbWidgets
                .filter(dbw => !newKeys.includes(dbw.widget_key))
                .map(dbw => dbw.widget_key);

            if (keysToRemove.length > 0) {
                await supabase
                    .from('user_dashboard_widgets')
                    .delete()
                    .eq('user_id', user.id)
                    .in('widget_key', keysToRemove);
            }

            // 4. Identify widgets to INSERT or UPDATE
            for (let i = 0; i < newWidgets.length; i++) {
                const nw = newWidgets[i];
                const existing = dbWidgets.find(dbw => dbw.widget_key === nw.widget_key);

                if (existing) {
                    // UPDATE position if changed
                    if (existing.position !== i) {
                        await supabase
                            .from('user_dashboard_widgets')
                            .update({ position: i, updated_at: new Date().toISOString() })
                            .eq('id', existing.id);
                    }
                } else {
                    // INSERT new widget
                    await supabase
                        .from('user_dashboard_widgets')
                        .insert({
                            user_id: user.id,
                            widget_key: nw.widget_key,
                            position: i,
                            is_visible: true
                        });
                }
            }
        } catch (error) {
            console.error("Failed to sync widgets with db:", error);
            // Optional: Re-fetch on error to ensure sync
            fetchWidgets();
        }
    };

    return {
        widgets,
        isLoadingWidgets,
        saveWidgets,
        fetchWidgets,
        showPriority,
        togglePriority
    };
}
