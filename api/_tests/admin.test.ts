import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import control from '../admin/control.js';
import login from '../admin/login.js';
import reset from '../admin/reset.js';
import results from '../admin/results.js';
import {
    adminCookie,
    createRequest,
    createResponse,
    stubEnv,
    stubSupabase,
} from './harness.js';

const at = '2026-12-05T20:00:00+00:00';

describe('admin routes', () => {
    beforeEach(stubEnv);
    afterEach(() => {
        vi.unstubAllEnvs();
        vi.unstubAllGlobals();
    });

    it.each([
        ['control', control, 'GET'],
        ['results', results, 'GET'],
        ['reset', reset, 'POST'],
    ] as const)(
        '%s refuses a browser without the admin cookie',
        async (_, handler, method) => {
            const calls = stubSupabase();
            const { sent, res } = createResponse();
            await handler(createRequest({ method }), res);
            expect(sent.statusCode).toBe(401);
            expect(calls).toHaveLength(0);
        },
    );

    it('refuses an expired admin cookie', async () => {
        stubSupabase();
        const { sent, res } = createResponse();
        await control(
            createRequest({ cookie: adminCookie(Date.now() - 1) }),
            res,
        );
        expect(sent.statusCode).toBe(401);
    });

    it('signs in with the right password only', async () => {
        const wrong = createResponse();
        await login(
            createRequest({ method: 'POST', body: { password: 'nope' } }),
            wrong.res,
        );
        expect(wrong.sent.statusCode).toBe(401);
        expect(wrong.sent.headers['set-cookie']).toBeUndefined();

        const right = createResponse();
        await login(
            createRequest({
                method: 'POST',
                body: { password: 'test-admin-password' },
            }),
            right.res,
        );
        expect(right.sent.statusCode).toBe(200);
        expect(String(right.sent.headers['set-cookie'])).toMatch(/^ns_admin=/);
    });

    it('advances to the next clue and tells the phones', async () => {
        const calls = stubSupabase({
            'GET /rest/v1/timeline': [
                { id: 1, step: 'second', points: 5, startedAt: at },
            ],
        });
        const { sent, res } = createResponse();
        await control(
            createRequest({
                method: 'POST',
                body: { type: 'next' },
                cookie: adminCookie(),
            }),
            res,
        );
        expect(sent.statusCode).toBe(200);
        expect(
            calls.find(
                (c) => c.method === 'POST' && c.path === '/rest/v1/timeline',
            )?.body,
        ).toEqual({ step: 'second', points: 4 });
        expect(calls.some((c) => c.path === '/realtime/v1/api/broadcast')).toBe(
            true,
        );
    });

    it('cannot reveal the names during a round', async () => {
        const calls = stubSupabase({
            'GET /rest/v1/timeline': [
                { id: 1, step: 'first', points: 2, startedAt: at },
            ],
        });
        const { sent, res } = createResponse();
        await control(
            createRequest({
                method: 'POST',
                body: { type: 'reveal' },
                cookie: adminCookie(),
            }),
            res,
        );
        expect(sent.statusCode).toBe(409);
        expect(calls.filter((c) => c.method === 'POST')).toHaveLength(0);
    });

    it('undoes a mis-click by deleting the latest timeline row', async () => {
        const calls = stubSupabase({
            'GET /rest/v1/timeline': [
                { id: 1, step: 'second', points: 5, startedAt: at },
                { id: 2, step: 'second', points: 4, startedAt: at },
            ],
        });
        const { sent, res } = createResponse();
        await control(
            createRequest({
                method: 'POST',
                body: { type: 'undo' },
                cookie: adminCookie(),
            }),
            res,
        );
        expect(sent.statusCode).toBe(200);
        expect(calls.find((c) => c.method === 'DELETE')?.path).toBe(
            '/rest/v1/timeline?id=eq.2',
        );
    });
});
