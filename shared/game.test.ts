import { describe, expect, it } from 'vitest';
import { applyAction, firstClueCount, type TimelineRow } from './game.js';

let id = 0;
const row = (
    step: TimelineRow['step'],
    points: number | null = null,
    firstPoints: number | null = null,
): TimelineRow => ({
    id: ++id,
    step,
    points,
    firstPoints,
    startedAt: '2026-12-05T20:00:00Z',
});

describe('applyAction', () => {
    it('takes both clue counts when the game starts', () => {
        expect(
            applyAction([], { type: 'startSecond', points: 3, firstPoints: 5 }),
        ).toEqual({ step: 'second', points: 3, firstPoints: 5 });
    });

    it('starts the first name from the count set at the start', () => {
        const timeline = [
            row('second', 3, 5),
            row('second', 2),
            row('second', 1),
            row('pause'),
        ];
        expect(firstClueCount(timeline)).toBe(5);
        expect(applyAction(timeline, { type: 'startFirst' })).toEqual({
            step: 'first',
            points: 5,
        });
    });

    it('walks the rest of the evening in order', () => {
        expect(applyAction([row('second', 3, 5)], { type: 'next' })).toEqual({
            step: 'second',
            points: 2,
        });
        expect(applyAction([row('second', 1)], { type: 'pause' })).toEqual({
            step: 'pause',
            points: null,
        });
        expect(applyAction([row('first', 1)], { type: 'finish' })).toEqual({
            step: 'finished',
            points: null,
        });
        expect(applyAction([row('finished')], { type: 'reveal' })).toEqual({
            step: 'revealed',
            points: null,
        });
    });

    it('has no clue below 1 point', () => {
        expect(applyAction([row('first', 1)], { type: 'next' })).toBeNull();
    });

    it('cannot reveal the names before the game is finished', () => {
        expect(applyAction([row('first', 2)], { type: 'reveal' })).toBeNull();
        expect(applyAction([], { type: 'reveal' })).toBeNull();
    });

    it.each([
        [0, 5],
        [2.5, 5],
        [5, 0],
        [5, undefined],
    ])('refuses to start with clue counts %s and %s', (points, firstPoints) => {
        expect(
            applyAction([], {
                type: 'startSecond',
                points,
                firstPoints: firstPoints as number,
            }),
        ).toBeNull();
    });
});
