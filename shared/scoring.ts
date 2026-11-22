// Post-fact scoring. A guess is stored as who, what and when; everything else -
// which name was being guessed, which clue was on, how many points it was
// worth - comes from matching its timestamp to the timeline here. Deleting a
// timeline row (the admin's undo) therefore re-scores the guesses made
// meanwhile without touching them.

import type { NameKey, TimelineRow } from './game.js';

export interface PlayerRow {
    id: string;
    username: string;
}

export interface GuessRow {
    playerId: string;
    text: string;
    textKey: string;
    createdAt: string;
}

export interface NameScore {
    playerId: string;
    username: string;
    points: number;
    /** Guesses up to and including the first correct one; all of them if none. */
    guesses: number;
    /** First correct guess, or the first guess if never correct. */
    time: string | null;
    /** From the start of the round's first clue to the first correct guess. */
    solveMs: number | null;
}

export interface CombinedScore {
    playerId: string;
    username: string;
    points: number;
    guesses: number;
    /** Sum of solve times over the names this player solved. */
    solveMs: number;
}

export interface Results {
    second: NameScore[];
    first: NameScore[];
    combined: CombinedScore[];
    winners: {
        second: NameScore[];
        first: NameScore[];
        combined: CombinedScore[];
    };
}

export interface WrongGuess {
    text: string;
    /** How many different guests guessed it. */
    count: number;
}

/**
 * Postgres timestamps carry microseconds, which `Date` would drop - and a
 * guess and a clue change can land in the same millisecond. Compared as whole
 * microseconds instead.
 */
export function toMicros(iso: string): number {
    const match = /^(.*T\d\d:\d\d:\d\d)(?:\.(\d+))?(.*)$/.exec(iso);
    if (!match) return NaN;
    const [, base, fraction = '', zone] = match;
    const seconds = Date.parse(base + (zone || 'Z'));
    return seconds * 1000 + Number(fraction.padEnd(6, '0').slice(0, 6));
}

/** The timeline row a moment falls in: the latest one started at or before it. */
export function rowAt(
    timeline: readonly TimelineRow[],
    at: string,
): TimelineRow | null {
    const t = toMicros(at);
    let match: TimelineRow | null = null;
    let matchStart = -Infinity;
    for (const row of timeline) {
        const start = toMicros(row.startedAt);
        if (
            start <= t &&
            (start > matchStart ||
                (start === matchStart && match !== null && row.id > match.id))
        ) {
            match = row;
            matchStart = start;
        }
    }
    return match;
}

interface MatchedGuess extends GuessRow {
    row: TimelineRow;
}

/** Each guess with the clue it was made during, grouped by the name guessed. */
function matchGuesses(
    timeline: readonly TimelineRow[],
    guesses: readonly GuessRow[],
): Record<NameKey, MatchedGuess[]> {
    const byName: Record<NameKey, MatchedGuess[]> = { second: [], first: [] };
    for (const guess of guesses) {
        const row = rowAt(timeline, guess.createdAt);
        if (row && (row.step === 'second' || row.step === 'first')) {
            byName[row.step].push({ ...guess, row });
        }
    }
    for (const list of Object.values(byName)) {
        list.sort((a, b) => toMicros(a.createdAt) - toMicros(b.createdAt));
    }
    return byName;
}

function roundStart(
    timeline: readonly TimelineRow[],
    name: NameKey,
): number | null {
    const starts = timeline
        .filter((row) => row.step === name)
        .map((row) => toMicros(row.startedAt));
    return starts.length ? Math.min(...starts) : null;
}

function scoreName(
    players: readonly PlayerRow[],
    guesses: readonly MatchedGuess[],
    correctKey: string,
    start: number | null,
): NameScore[] {
    return players.map((player) => {
        const own = guesses.filter((g) => g.playerId === player.id);
        const firstCorrect = own.findIndex((g) => g.textKey === correctKey);
        if (firstCorrect === -1) {
            return {
                playerId: player.id,
                username: player.username,
                points: 0,
                guesses: own.length,
                time: own[0]?.createdAt ?? null,
                solveMs: null,
            };
        }
        const hit = own[firstCorrect];
        return {
            playerId: player.id,
            username: player.username,
            points: hit.row.points ?? 0,
            guesses: firstCorrect + 1,
            time: hit.createdAt,
            solveMs:
                start === null
                    ? null
                    : Math.round((toMicros(hit.createdAt) - start) / 1000),
        };
    });
}

function compareName(a: NameScore, b: NameScore): number {
    return (
        b.points - a.points ||
        a.guesses - b.guesses ||
        (a.time === null ? 1 : 0) - (b.time === null ? 1 : 0) ||
        (a.time && b.time ? toMicros(a.time) - toMicros(b.time) : 0)
    );
}

function compareCombined(a: CombinedScore, b: CombinedScore): number {
    return (
        b.points - a.points || a.guesses - b.guesses || a.solveMs - b.solveMs
    );
}

/** Everyone tied with the leader on every ranking key - if the leader scored. */
function winners<T extends { points: number }>(
    ranked: readonly T[],
    compare: (a: T, b: T) => number,
): T[] {
    const [leader] = ranked;
    if (!leader || leader.points === 0) return [];
    return ranked.filter((entry) => compare(entry, leader) === 0);
}

export function computeResults(
    players: readonly PlayerRow[],
    timeline: readonly TimelineRow[],
    guesses: readonly GuessRow[],
    correctKeys: Record<NameKey, string>,
): Results {
    const matched = matchGuesses(timeline, guesses);
    const second = scoreName(
        players,
        matched.second,
        correctKeys.second,
        roundStart(timeline, 'second'),
    );
    const first = scoreName(
        players,
        matched.first,
        correctKeys.first,
        roundStart(timeline, 'first'),
    );
    const combined: CombinedScore[] = players.map((player, i) => ({
        playerId: player.id,
        username: player.username,
        points: second[i].points + first[i].points,
        guesses: second[i].guesses + first[i].guesses,
        solveMs: (second[i].solveMs ?? 0) + (first[i].solveMs ?? 0),
    }));
    second.sort(compareName);
    first.sort(compareName);
    combined.sort(compareCombined);
    return {
        second,
        first,
        combined,
        winners: {
            second: winners(second, compareName),
            first: winners(first, compareName),
            combined: winners(combined, compareCombined),
        },
    };
}

/** Whether a player has already guessed this name correctly. */
export function hasSolved(
    timeline: readonly TimelineRow[],
    guesses: readonly GuessRow[],
    name: NameKey,
    correctKey: string,
): boolean {
    return matchGuesses(timeline, guesses)[name].some(
        (g) => g.textKey === correctKey,
    );
}

/** Wrong guesses for each name, most common first. */
export function wrongGuesses(
    timeline: readonly TimelineRow[],
    guesses: readonly GuessRow[],
    correctKeys: Record<NameKey, string>,
): Record<NameKey, WrongGuess[]> {
    const matched = matchGuesses(timeline, guesses);
    const group = (name: NameKey): WrongGuess[] => {
        const byKey = new Map<
            string,
            { players: Set<string>; spellings: Map<string, number> }
        >();
        for (const guess of matched[name]) {
            if (guess.textKey === correctKeys[name]) continue;
            const entry = byKey.get(guess.textKey) ?? {
                players: new Set<string>(),
                spellings: new Map<string, number>(),
            };
            entry.players.add(guess.playerId);
            const spelling = guess.text.trim().toUpperCase();
            entry.spellings.set(
                spelling,
                (entry.spellings.get(spelling) ?? 0) + 1,
            );
            byKey.set(guess.textKey, entry);
        }
        return [...byKey.values()]
            .map(({ players, spellings }) => ({
                // The way most people spelled it, accents and all.
                text: [...spellings].sort(
                    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'fi'),
                )[0][0],
                count: players.size,
            }))
            .sort(
                (a, b) =>
                    b.count - a.count || a.text.localeCompare(b.text, 'fi'),
            );
    };
    return { second: group('second'), first: group('first') };
}
