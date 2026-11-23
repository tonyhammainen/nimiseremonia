import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import { onGameChanged } from './realtime';
import type { GameState } from '../shared/game';

const FALLBACK_POLL_MS = 15_000;
// /api/state may be served from the CDN for a second, so a refetch right after
// the change notice can still see the old state. A second look fixes that.
const RECHECK_MS = 1_500;

/** The shared game state, kept current via Realtime with a slow poll as backup. */
export function useGameState() {
    const [state, setState] = useState<GameState | null>(null);
    const [offline, setOffline] = useState(false);

    const refresh = useCallback(async () => {
        try {
            const { status, body } = await api<GameState>('/api/state');
            if (status === 200) {
                setState(body);
                setOffline(false);
            }
        } catch {
            setOffline(true);
        }
    }, []);

    useEffect(() => {
        const timers = new Set<ReturnType<typeof setTimeout>>();
        const onChange = () => {
            void refresh();
            const timer = setTimeout(() => {
                timers.delete(timer);
                void refresh();
            }, RECHECK_MS);
            timers.add(timer);
        };
        void refresh();
        const unsubscribe = onGameChanged(onChange);
        const poll = setInterval(() => void refresh(), FALLBACK_POLL_MS);
        const onVisible = () => {
            if (document.visibilityState === 'visible') void refresh();
        };
        document.addEventListener('visibilitychange', onVisible);
        return () => {
            unsubscribe();
            clearInterval(poll);
            timers.forEach(clearTimeout);
            document.removeEventListener('visibilitychange', onVisible);
        };
    }, [refresh]);

    return { state, offline, refresh };
}
