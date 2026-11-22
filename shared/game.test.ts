import { describe, expect, it } from 'vitest';
import { applyAction, type TimelineRow } from './game.js';

const row = (step: TimelineRow['step'], points: number | null = null) => ({
    id: 1,
    step,
    points,
    startedAt: '2026-12-05T20:00:00Z',
});

describe('applyAction', () => {
    it('walks the whole evening in order', () => {
        expect(applyAction(null, { type: 'startSecond', points: 3 })).toEqual({
            step: 'second',
            points: 3,
        });
        expect(applyAction(row('second', 3), { type: 'next' })).toEqual({
            step: 'second',
            points: 2,
        });
        expect(applyAction(row('second', 1), { type: 'pause' })).toEqual({
            step: 'pause',
            points: null,
        });
        expect(
            applyAction(row('pause'), { type: 'startFirst', points: 5 }),
        ).toEqual({ step: 'first', points: 5 });
        expect(applyAction(row('first', 1), { type: 'finish' })).toEqual({
            step: 'finished',
            points: null,
        });
        expect(applyAction(row('finished'), { type: 'reveal' })).toEqual({
            step: 'revealed',
            points: null,
        });
    });

    it('has no clue below 1 point', () => {
        expect(applyAction(row('first', 1), { type: 'next' })).toBeNull();
    });

    it('cannot reveal the names before the game is finished', () => {
        expect(applyAction(row('first', 2), { type: 'reveal' })).toBeNull();
        expect(applyAction(null, { type: 'reveal' })).toBeNull();
    });

    it('refuses a clue count that is not a positive whole number', () => {
        expect(
            applyAction(null, { type: 'startSecond', points: 0 }),
        ).toBeNull();
        expect(
            applyAction(null, { type: 'startSecond', points: 2.5 }),
        ).toBeNull();
    });
});
