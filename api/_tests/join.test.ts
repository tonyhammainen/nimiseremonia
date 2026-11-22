import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import handler from '../join.js';
import {
    createRequest,
    createResponse,
    stubEnv,
    stubSupabase,
} from './harness.js';

async function post(body: unknown) {
    const { sent, res } = createResponse();
    await handler(createRequest({ method: 'POST', body }), res);
    return sent;
}

describe('POST /api/join', () => {
    beforeEach(stubEnv);
    afterEach(() => {
        vi.unstubAllEnvs();
        vi.unstubAllGlobals();
    });

    it('creates the player and sets an httpOnly cookie', async () => {
        const calls = stubSupabase({
            'POST /rest/v1/players': [{ id: 'p1', username: 'Matti' }],
        });
        const sent = await post({ username: '  Matti ' });
        expect(sent.statusCode).toBe(200);
        expect(sent.body).toEqual({ username: 'Matti' });
        expect(calls[0].body).toEqual({
            username: 'Matti',
            username_key: 'matti',
        });
        const cookie = String(sent.headers['set-cookie']);
        expect(cookie).toMatch(/^ns_player=/);
        expect(cookie).toContain('HttpOnly');
    });

    it('answers 409 when the nickname is taken', async () => {
        stubSupabase({
            'POST /rest/v1/players': {
                httpStatus: 409,
                body: { code: '23505', message: 'duplicate' },
            },
        });
        const sent = await post({ username: 'matti' });
        expect(sent.statusCode).toBe(409);
        expect(sent.body).toEqual({ error: 'taken' });
    });

    it.each([[''], ['   '], ['x'.repeat(21)], [42]])(
        'refuses the nickname %j',
        async (username) => {
            const calls = stubSupabase();
            expect((await post({ username })).statusCode).toBe(400);
            expect(calls).toHaveLength(0);
        },
    );
});
