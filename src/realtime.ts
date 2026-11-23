import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

/**
 * Calls `onChange` whenever the admin moves the game along, and once more each
 * time the connection is (re)established, so a phone that slept through a
 * change catches up. The message itself carries nothing; listeners refetch.
 * Without Supabase configured (local `npm run dev`) this is a no-op and the
 * callers' polling does the work.
 */
export function onGameChanged(onChange: () => void): () => void {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!url || !key) return () => {};
    client ??= createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
    });
    const channel = client
        .channel('game')
        .on('broadcast', { event: 'changed' }, onChange)
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') onChange();
        });
    return () => {
        void client?.removeChannel(channel);
    };
}
