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
    /** Clue count for the first name, set on the row that starts the game. */
    firstPoints?: number | null;
    startedAt: string;
}

/** What every phone polls. `names` is present only after the reveal. */
export interface GameState {
    phase: Phase;
    cluePoints: number | null;
    names?: { first: string; second: string };
}

export type AdminAction =
    | { type: 'startSecond'; points: number; firstPoints: number }
    | { type: 'next' }
    | { type: 'pause' }
    | { type: 'startFirst' }
    | { type: 'finish' }
    | { type: 'reveal' }
    | { type: 'undo' };

export interface NewRow {
    step: Step;
    points: number | null;
    firstPoints?: number;
}

/** The first-name clue count set when the game started, if it has. */
export function firstClueCount(
    timeline: readonly TimelineRow[],
): number | null {
    return (
        timeline.find((row) => row.step === 'second' && row.firstPoints)
            ?.firstPoints ?? null
    );
}

/** The row to append for a move, or null if the move isn't allowed now. */
export function applyAction(
    timeline: readonly TimelineRow[],
    action: Exclude<AdminAction, { type: 'undo' }>,
): NewRow | null {
    const current = timeline.at(-1) ?? null;
    const phase: Phase = current?.step ?? 'lobby';
    const points = current?.points ?? 0;
    switch (action.type) {
        case 'startSecond':
            return phase === 'lobby' &&
                validClueCount(action.points) &&
                validClueCount(action.firstPoints)
                ? {
                      step: 'second',
                      points: action.points,
                      firstPoints: action.firstPoints,
                  }
                : null;
        case 'next':
            return (phase === 'second' || phase === 'first') && points > 1
                ? { step: phase, points: points - 1 }
                : null;
        case 'pause':
            return phase === 'second' ? { step: 'pause', points: null } : null;
        case 'startFirst': {
            const count = firstClueCount(timeline);
            return phase === 'pause' && count
                ? { step: 'first', points: count }
                : null;
        }
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
