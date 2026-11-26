import { describe, expect, it } from 'vitest';
import type { TimelineRow } from './game.js';
import {
    computeResults,
    ownGuesses,
    rowAt,
    toMicros,
    wrongGuesses,
    type GuessRow,
    type PlayerRow,
} from './scoring.js';

const KEYS = { second: 'kuura', first: 'aatos' };

/** An ISO timestamp `s` seconds after 20:00 UTC on the party night. */
const at = (s: number) =>
    new Date(Date.UTC(2026, 11, 5, 20, 0, 0) + s * 1000).toISOString();

const timeline: TimelineRow[] = [
    { id: 1, step: 'second', points: 3, startedAt: at(0) },
    { id: 2, step: 'second', points: 2, startedAt: at(100) },
    { id: 3, step: 'second', points: 1, startedAt: at(200) },
    { id: 4, step: 'pause', points: null, startedAt: at(300) },
    { id: 5, step: 'first', points: 2, startedAt: at(400) },
    { id: 6, step: 'first', points: 1, startedAt: at(500) },
    { id: 7, step: 'finished', points: null, startedAt: at(600) },
];

const players: PlayerRow[] = [
    { id: 'a', username: 'Anni' },
    { id: 'b', username: 'Benjamin' },
    { id: 'c', username: 'Cecilia' },
];

const guess = (playerId: string, text: string, s: number): GuessRow => ({
    playerId,
    text,
    textKey: text.toLowerCase(),
    createdAt: at(s),
});

describe('toMicros', () => {
    it('keeps the microseconds a Date would drop', () => {
        expect(
            toMicros('2026-12-05T20:00:00.000002+00:00') -
                toMicros('2026-12-05T20:00:00.000001+00:00'),
        ).toBe(1);
    });

    it('reads short fractions and zone offsets', () => {
        expect(toMicros('2026-12-05T22:00:00.5+02:00')).toBe(
            toMicros('2026-12-05T20:00:00.500000Z'),
        );
    });
});

describe('rowAt', () => {
    it('counts a guess at the exact moment of a clue change toward the new clue', () => {
        expect(rowAt(timeline, at(100))?.points).toBe(2);
    });

    it('finds no row before the game started', () => {
        expect(rowAt(timeline, at(-1))).toBeNull();
    });
});

describe('computeResults', () => {
    it('gives the points of the clue that was on at the first correct guess', () => {
        const results = computeResults(
            players,
            timeline,
            [guess('a', 'Väinö', 50), guess('a', 'Kuura', 150)],
            KEYS,
        );
        const anni = results.second.find((s) => s.username === 'Anni');
        expect(anni).toMatchObject({ points: 2, guesses: 2, solveMs: 150_000 });
    });

    it('gives nobody points for the other name guessed in the wrong round', () => {
        const results = computeResults(
            players,
            timeline,
            [guess('a', 'Aatos', 50)],
            KEYS,
        );
        expect(results.second[0].points).toBe(0);
        expect(results.first.every((s) => s.points === 0)).toBe(true);
    });

    it('ranks by points, then fewer guesses, then the earlier correct guess', () => {
        const results = computeResults(
            players,
            timeline,
            [
                // Cecilia: 3 p in two guesses.
                guess('c', 'Ilo', 10),
                guess('c', 'Kuura', 30),
                // Benjamin: 3 p in one guess, but later than Anni.
                guess('b', 'Kuura', 40),
                // Anni: 3 p in one guess, first.
                guess('a', 'Kuura', 20),
            ],
            KEYS,
        );
        expect(results.second.map((s) => s.username)).toEqual([
            'Anni',
            'Benjamin',
            'Cecilia',
        ]);
        expect(results.winners.second.map((s) => s.username)).toEqual(['Anni']);
    });

    it('ignores guesses that never existed after a correct one', () => {
        // Guests may keep guessing after a correct guess; those don't count.
        const results = computeResults(
            players,
            timeline,
            [guess('a', 'Kuura', 20), guess('a', 'Ilo', 250)],
            KEYS,
        );
        expect(results.second[0]).toMatchObject({ points: 3, guesses: 1 });
    });

    it('re-scores guesses to the previous clue when the admin undoes a clue', () => {
        const guesses = [guess('a', 'Kuura', 150)];
        const undone = timeline.filter((row) => row.id !== 2);
        expect(
            computeResults(players, timeline, guesses, KEYS).second[0].points,
        ).toBe(2);
        expect(
            computeResults(players, undone, guesses, KEYS).second[0].points,
        ).toBe(3);
    });

    it('breaks a combined tie on the sum of solve times', () => {
        const results = computeResults(
            players,
            timeline,
            [
                // Anni: 3 p after 90 s, 2 p after 10 s -> 100 s.
                guess('a', 'Kuura', 90),
                guess('a', 'Aatos', 410),
                // Benjamin: 3 p after 10 s, 2 p after 50 s -> 60 s.
                guess('b', 'Kuura', 10),
                guess('b', 'Aatos', 450),
            ],
            KEYS,
        );
        expect(results.combined.slice(0, 2)).toMatchObject([
            { username: 'Benjamin', points: 5, guesses: 2, solveMs: 60_000 },
            { username: 'Anni', points: 5, guesses: 2, solveMs: 100_000 },
        ]);
        expect(results.winners.combined.map((s) => s.username)).toEqual([
            'Benjamin',
        ]);
    });

    it('declares a shared win when every ranking key is equal', () => {
        const results = computeResults(
            players,
            timeline,
            [guess('a', 'Aatos', 450), guess('b', 'Aatos', 450)],
            KEYS,
        );
        expect(results.winners.first.map((s) => s.username).sort()).toEqual([
            'Anni',
            'Benjamin',
        ]);
    });

    it('declares no winner when nobody scored', () => {
        const results = computeResults(
            players,
            timeline,
            [guess('a', 'Ilo', 20)],
            KEYS,
        );
        expect(results.winners.second).toEqual([]);
        expect(results.winners.combined).toEqual([]);
    });

    it('lists guests who never guessed with 0 points', () => {
        const results = computeResults(players, timeline, [], KEYS);
        expect(results.combined).toHaveLength(3);
        expect(results.combined.every((s) => s.points === 0)).toBe(true);
    });
});

describe('repeated guesses', () => {
    it('counts only the first time a player guesses the same text in a round', () => {
        const results = computeResults(
            players,
            timeline,
            [
                guess('a', 'Ilo', 10),
                { ...guess('a', 'ILO ', 30), textKey: 'ilo' },
                guess('a', 'Kuura', 150),
            ],
            KEYS,
        );
        expect(results.second[0]).toMatchObject({
            username: 'Anni',
            points: 2,
            guesses: 2,
        });
    });

    it('keeps accented and plain letters apart', () => {
        const results = computeResults(
            players,
            timeline,
            [guess('a', 'Äätos', 410), guess('a', 'Aatos', 450)],
            KEYS,
        );
        // ÄÄTOS is a different, wrong guess; AATOS is right on the second try.
        expect(results.first[0]).toMatchObject({ points: 2, guesses: 2 });
    });

    it('lets the same text be guessed once in each round', () => {
        const guesses = [guess('a', 'Ilo', 10), guess('a', 'Ilo', 410)];
        expect(ownGuesses(timeline, guesses)).toEqual({
            second: ['Ilo'],
            first: ['Ilo'],
        });
    });

    it('drops a repeat that an undo moved into the same round', () => {
        const guesses = [guess('a', 'Ilo', 250), guess('a', 'Ilo', 410)];
        const undone = timeline.filter((row) => row.id < 4);
        expect(ownGuesses(undone, guesses)).toEqual({
            second: ['Ilo'],
            first: [],
        });
    });
});

describe('wrongGuesses', () => {
    it('groups by normalized text, counts guests, and keeps names apart', () => {
        const wrong = wrongGuesses(
            timeline,
            [
                { ...guess('a', 'Väinö', 10), textKey: 'vaino' },
                { ...guess('b', 'väinö ', 20), textKey: 'vaino' },
                // The same guest twice still counts once.
                { ...guess('b', 'Väinö', 40), textKey: 'vaino' },
                guess('c', 'Ilo', 30),
                guess('c', 'Kuura', 60),
                guess('a', 'Eino', 450),
            ],
            KEYS,
        );
        expect(wrong.second).toEqual([
            { text: 'VÄINÖ', count: 2 },
            { text: 'ILO', count: 1 },
        ]);
        expect(wrong.first).toEqual([{ text: 'EINO', count: 1 }]);
    });
});
