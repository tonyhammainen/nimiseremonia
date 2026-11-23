// Stubs shared by the handler tests in this directory. Not a `.test.ts` file,
// and underscore-prefixed, so it is neither a suite nor a route.
import { vi } from 'vitest';
import { seal, keyFrom } from '../_lib/crypto.js';
import type { VercelRequest, VercelResponse } from '../_lib/vercel.js';

export const SESSION_SECRET = 'test-session-secret-not-a-real-one';
export const PLAYER_ID = '11111111-1111-4111-8111-111111111111';

/** Invented stand-ins; the real values live in the Vercel dashboard. */
export function stubEnv() {
    vi.stubEnv('SUPABASE_URL', 'https://test-project.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'sb_secret_test');
    vi.stubEnv('SESSION_SECRET', SESSION_SECRET);
    vi.stubEnv('ADMIN_PASSWORD', 'test-admin-password');
    vi.stubEnv('CORRECT_SECOND_NAME', 'Kuura');
    vi.stubEnv('CORRECT_FIRST_NAME', 'Äätos');
}

export function playerCookie(playerId = PLAYER_ID): string {
    return `ns_player=${encodeURIComponent(
        seal(keyFrom(SESSION_SECRET), JSON.stringify({ p: playerId })),
    )}`;
}

export function adminCookie(exp = Date.now() + 60_000): string {
    return `ns_admin=${encodeURIComponent(
        seal(keyFrom(SESSION_SECRET), JSON.stringify({ exp })),
    )}`;
}

export function createRequest({
    method = 'GET',
    body,
    cookie,
}: { method?: string; body?: unknown; cookie?: string } = {}): VercelRequest {
    return {
        method,
        body,
        headers: cookie ? { cookie } : {},
        query: {},
        cookies: {},
    } as unknown as VercelRequest;
}

export function createResponse() {
    const sent = {
        statusCode: 0,
        body: undefined as unknown,
        headers: {} as Record<string, unknown>,
    };
    const res = {
        status(statusCode: number) {
            sent.statusCode = statusCode;
            return res;
        },
        json(body: unknown) {
            sent.body = body;
            return res;
        },
        setHeader(name: string, value: unknown) {
            sent.headers[name.toLowerCase()] = value;
            return res;
        },
        getHeader(name: string) {
            return sent.headers[name.toLowerCase()];
        },
    };
    return { sent, res: res as unknown as VercelResponse };
}

export interface Call {
    method: string;
    path: string;
    body: unknown;
}

type Answer = { httpStatus: number; body: unknown } | unknown;

/**
 * Stubs Supabase at the network edge, so a handler runs through the real
 * database client. `answers` maps "METHOD /path-prefix" to a response body, or
 * to { httpStatus, body } for an error; the longest matching prefix wins.
 */
export function stubSupabase(answers: Record<string, Answer> = {}) {
    const calls: Call[] = [];
    vi.stubGlobal(
        'fetch',
        vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
            const url = new URL(String(input));
            const method = init?.method ?? 'GET';
            const path = url.pathname + url.search;
            calls.push({
                method,
                path,
                body: init?.body ? JSON.parse(String(init.body)) : undefined,
            });
            const match = Object.keys(answers)
                .filter((key) => `${method} ${path}`.startsWith(key))
                .sort((a, b) => b.length - a.length)[0];
            const answer = match === undefined ? [] : answers[match];
            const wrapped =
                answer && typeof answer === 'object' && 'httpStatus' in answer
                    ? (answer as { httpStatus: number; body: unknown })
                    : { httpStatus: 200, body: answer };
            return new Response(JSON.stringify(wrapped.body), {
                status: wrapped.httpStatus,
                headers: { 'Content-Type': 'application/json' },
            });
        }),
    );
    return calls;
}
