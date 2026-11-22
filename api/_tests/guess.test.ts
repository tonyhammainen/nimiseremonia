import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import handler from '../guess.js';
import {
    createRequest,
    createResponse,
    PLAYER_ID,
    playerCookie,
    stubEnv,
    stubSupabase,
} from './harness.js';

const ID = '22222222-2222-4222-8222-222222222222';
const RPC = 'POST /rest/v1/rpc/submit_guess';

async function post(body: unknown, cookie: string | null = playerCookie()) {
    const { sent, res } = createResponse();
    await handler(
        createRequest({ method: 'POST', body, cookie: cookie ?? undefined }),
        res,
    );
    return sent;
}

describe('POST /api/guess', () => {
    beforeEach(stubEnv);
    afterEach(() => {
        vi.unstubAllEnvs();
        vi.unstubAllGlobals();
    });

    it('needs a nickname first', async () => {
        const calls = stubSupabase();
        const sent = await post({ id: ID, text: 'Kuura' }, null);
        expect(sent.statusCode).toBe(401);
        expect(calls).toHaveLength(0);
    });

    it('refuses a forged player cookie', async () => {
        stubSupabase();
        const sent = await post({ id: ID, text: 'Kuura' }, 'ns_player=forged');
        expect(sent.statusCode).toBe(401);
    });

    it.each([
        [{ id: ID, text: '   ' }],
        [{ id: 'not-a-uuid', text: 'Kuura' }],
        [{ id: ID, text: 'x'.repeat(41) }],
    ])('refuses an invalid guess %j', async (body) => {
        const calls = stubSupabase();
        expect((await post(body)).statusCode).toBe(400);
        expect(calls).toHaveLength(0);
    });

    it('sends the guess and both answers normalized to the database', async () => {
        const calls = stubSupabase({
            [RPC]: {
                status: 'ok',
                correct: true,
                savedAt: '2026-12-05T20:00:00+00:00',
                cooldownMs: 10000,
            },
        });
        const sent = await post({ id: ID, text: '  KUURA ' });
        expect(sent.statusCode).toBe(200);
        expect(sent.body).toEqual({
            correct: true,
            savedAt: '2026-12-05T20:00:00+00:00',
            cooldownMs: 10000,
        });
        expect(calls[0].body).toEqual({
            p_player: PLAYER_ID,
            p_id: ID,
            p_text: 'KUURA',
            p_key: 'kuura',
            p_second_key: 'kuura',
            p_first_key: 'aatos',
        });
    });

    it('answers 429 with the wait while the cooldown runs', async () => {
        stubSupabase({ [RPC]: { status: 'cooldown', retryAfterMs: 4200 } });
        const sent = await post({ id: ID, text: 'Ilo' });
        expect(sent.statusCode).toBe(429);
        expect(sent.body).toEqual({ error: 'cooldown', retryAfterMs: 4200 });
    });

    it.each(['closed', 'solved'])('answers 409 when %s', async (status) => {
        stubSupabase({ [RPC]: { status } });
        const sent = await post({ id: ID, text: 'Ilo' });
        expect(sent.statusCode).toBe(409);
        expect(sent.body).toEqual({ error: status });
    });

    it('sends a reset player back to the nickname screen', async () => {
        stubSupabase({
            [RPC]: { httpStatus: 409, body: { code: '23503', message: 'fk' } },
        });
        const sent = await post({ id: ID, text: 'Ilo' });
        expect(sent.statusCode).toBe(401);
        expect(String(sent.headers['set-cookie'])).toContain('Max-Age=0');
    });
});
