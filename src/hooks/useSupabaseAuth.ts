import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { User } from '@supabase/supabase-js';

export function useSupabaseAuth() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
            setLoading(false);
        });

        // Listen for changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
            setLoading(false);
        });

        return () => subscription.unsubscribe();
    }, []);

    return {
        user,
        loading,
        signIn: (args: any) => supabase.auth.signInWithPassword(args),
        signUp: (args: any) => supabase.auth.signUp(args),
        signOut: () => supabase.auth.signOut(),
    };
}
