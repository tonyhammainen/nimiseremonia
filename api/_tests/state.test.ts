import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import handler from '../state.js';
import {
    createRequest,
    createResponse,
    stubEnv,
    stubSupabase,
} from './harness.js';

const row = (step: string, points: number | null = null) => [
    { id: 1, step, points, startedAt: '2026-12-05T20:00:00+00:00' },
];

describe('GET /api/state', () => {
    beforeEach(stubEnv);
    afterEach(() => {
        vi.unstubAllEnvs();
        vi.unstubAllGlobals();
    });

    it('is the lobby before the first clue', async () => {
        stubSupabase({ 'GET /rest/v1/timeline': [] });
        const { sent, res } = createResponse();
        await handler(createRequest(), res);
        expect(sent.body).toEqual({ phase: 'lobby', cluePoints: null });
    });

    it('shows the points of the current clue', async () => {
        stubSupabase({ 'GET /rest/v1/timeline': row('second', 5) });
        const { sent, res } = createResponse();
        await handler(createRequest(), res);
        expect(sent.body).toEqual({ phase: 'second', cluePoints: 5 });
    });

    it.each([
        ['second', 5],
        ['pause', null],
        ['first', 1],
        ['finished', null],
    ])('never contains the names during %s', async (step, points) => {
        stubSupabase({ 'GET /rest/v1/timeline': row(step, points) });
        const { sent, res } = createResponse();
        await handler(createRequest(), res);
        const text = JSON.stringify(sent.body);
        expect(text).not.toMatch(/kuura/i);
        expect(text).not.toMatch(/äätos/i);
        expect(sent.body).not.toHaveProperty('names');
    });

    it('contains the names once revealed', async () => {
        stubSupabase({ 'GET /rest/v1/timeline': row('revealed') });
        const { sent, res } = createResponse();
        await handler(createRequest(), res);
        expect(sent.body).toEqual({
            phase: 'revealed',
            cluePoints: null,
            names: { first: 'Äätos', second: 'Kuura' },
        });
    });
});
