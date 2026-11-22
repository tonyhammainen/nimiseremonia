// The game's states and the admin's moves between them. Shared so the admin
// view offers exactly the moves the API accepts.

export type Step = 'second' | 'pause' | 'first' | 'finished' | 'revealed';
export type Phase = 'lobby' | Step;
export type NameKey = 'second' | 'first';

export const COOLDOWN_MS = 10_000;
export const USERNAME_MAX = 20;
export const GUESS_MAX = 40;

export interface TimelineRow {
    id: number;
    step: Step;
    points: number | null;
    startedAt: string;
}

/** What every phone polls. `names` is present only after the reveal. */
export interface GameState {
    phase: Phase;
    cluePoints: number | null;
    names?: { first: string; second: string };
}

export type AdminAction =
    | { type: 'startSecond'; points: number }
    | { type: 'next' }
    | { type: 'pause' }
    | { type: 'startFirst'; points: number }
    | { type: 'finish' }
    | { type: 'reveal' }
    | { type: 'undo' };

/** The row to append for a move, or null if the move isn't allowed now. */
export function applyAction(
    current: TimelineRow | null,
    action: Exclude<AdminAction, { type: 'undo' }>,
): { step: Step; points: number | null } | null {
    const phase: Phase = current?.step ?? 'lobby';
    const points = current?.points ?? 0;
    switch (action.type) {
        case 'startSecond':
            return phase === 'lobby' && validClueCount(action.points)
                ? { step: 'second', points: action.points }
                : null;
        case 'next':
            return (phase === 'second' || phase === 'first') && points > 1
                ? { step: phase, points: points - 1 }
                : null;
        case 'pause':
            return phase === 'second' ? { step: 'pause', points: null } : null;
        case 'startFirst':
            return phase === 'pause' && validClueCount(action.points)
                ? { step: 'first', points: action.points }
                : null;
        case 'finish':
            return phase === 'first'
                ? { step: 'finished', points: null }
                : null;
        case 'reveal':
            return phase === 'finished'
                ? { step: 'revealed', points: null }
                : null;
    }
}

export function validClueCount(n: unknown): n is number {
    return typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 100;
}
