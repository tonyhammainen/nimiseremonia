import { supabaseConfig } from './env.js';
import type { Step, TimelineRow } from '../../shared/game.js';
import type { GuessRow, PlayerRow } from '../../shared/scoring.js';

// A thin client for Supabase's REST API (PostgREST) with the service-role key.
// Plain fetch over HTTP, so a serverless function holds no database connection
// and a room full of phones can't exhaust a pool.

export class DbError extends Error {
    readonly status: number;
    readonly code: string | undefined;
    constructor(status: number, code: string | undefined, message: string) {
        super(message);
        this.status = status;
        this.code = code;
    }
}

/** Postgres error codes the handlers react to. */
export const UNIQUE_VIOLATION = '23505';
export const FOREIGN_KEY_VIOLATION = '23503';

function headers(key: string): Record<string, string> {
    return {
        apikey: key,
        // Legacy service-role keys are JWTs and go in Authorization as well;
        // the newer `sb_secret_` keys are read from `apikey` alone.
        ...(key.startsWith('eyJ') ? { Authorization: `Bearer ${key}` } : {}),
        'Content-Type': 'application/json',
    };
}

async function request(
    path: string,
    init: RequestInit & { headers?: Record<string, string> } = {},
): Promise<Response> {
    const { url, key } = supabaseConfig();
    const res = await fetch(`${url}${path}`, {
        ...init,
        headers: { ...headers(key), ...init.headers },
        signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
            code?: string;
            message?: string;
        };
        throw new DbError(
            res.status,
            body.code,
            body.message ?? `Database request failed (${res.status})`,
        );
    }
    return res;
}

async function json<T>(res: Response): Promise<T> {
    const text = await res.text();
    return (text ? JSON.parse(text) : null) as T;
}

// Supabase caps a response at 1000 rows by default, so long lists are read
// page by page.
const PAGE = 1000;

async function selectAll<T>(table: string, query: string): Promise<T[]> {
    const rows: T[] = [];
    for (let offset = 0; ; offset += PAGE) {
        const page = await json<T[]>(
            await request(
                `/rest/v1/${table}?${query}&limit=${PAGE}&offset=${offset}`,
            ),
        );
        rows.push(...page);
        if (page.length < PAGE) return rows;
    }
}

const TIMELINE_COLUMNS = 'select=id,step,points,startedAt:started_at';
const GUESS_COLUMNS =
    'select=playerId:player_id,text,textKey:text_key,createdAt:created_at';

export function loadTimeline(): Promise<TimelineRow[]> {
    return selectAll<TimelineRow>(
        'timeline',
        `${TIMELINE_COLUMNS}&order=started_at.asc,id.asc`,
    );
}

export async function currentRow(): Promise<TimelineRow | null> {
    const rows = await json<TimelineRow[]>(
        await request(
            `/rest/v1/timeline?${TIMELINE_COLUMNS}&order=started_at.desc,id.desc&limit=1`,
        ),
    );
    return rows[0] ?? null;
}

export async function appendStep(
    step: Step,
    points: number | null,
): Promise<void> {
    await request('/rest/v1/timeline', {
        method: 'POST',
        body: JSON.stringify({ step, points }),
    });
}

export async function deleteStep(id: number): Promise<void> {
    await request(`/rest/v1/timeline?id=eq.${id}`, { method: 'DELETE' });
}

export function loadPlayers(): Promise<PlayerRow[]> {
    return selectAll<PlayerRow>(
        'players',
        'select=id,username&order=created_at.asc',
    );
}

export async function findPlayer(id: string): Promise<PlayerRow | null> {
    const rows = await json<PlayerRow[]>(
        await request(
            `/rest/v1/players?select=id,username&id=eq.${encodeURIComponent(id)}`,
        ),
    );
    return rows[0] ?? null;
}

export async function insertPlayer(
    username: string,
    usernameKey: string,
): Promise<PlayerRow> {
    const rows = await json<PlayerRow[]>(
        await request('/rest/v1/players?select=id,username', {
            method: 'POST',
            headers: { Prefer: 'return=representation' },
            body: JSON.stringify({ username, username_key: usernameKey }),
        }),
    );
    return rows[0];
}

export function loadGuesses(playerId?: string): Promise<GuessRow[]> {
    const filter = playerId
        ? `&player_id=eq.${encodeURIComponent(playerId)}`
        : '';
    return selectAll<GuessRow>(
        'guesses',
        `${GUESS_COLUMNS}${filter}&order=created_at.asc,id.asc`,
    );
}

export async function rpc<T>(name: string, args: object): Promise<T> {
    return json<T>(
        await request(`/rest/v1/rpc/${name}`, {
            method: 'POST',
            body: JSON.stringify(args),
        }),
    );
}

/**
 * Tells every open phone that the game state changed. The message carries no
 * data - phones refetch /api/state - so a failure here only delays them until
 * their next poll, and is logged rather than failing the admin's click.
 */
export async function broadcastChanged(): Promise<void> {
    try {
        await request('/realtime/v1/api/broadcast', {
            method: 'POST',
            body: JSON.stringify({
                messages: [{ topic: 'game', event: 'changed', payload: {} }],
            }),
        });
    } catch (error) {
        console.error('Realtime broadcast failed', error);
    }
}
