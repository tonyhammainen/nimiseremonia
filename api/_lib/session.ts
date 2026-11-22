import crypto from 'node:crypto';
import { seal, unseal } from './crypto.js';
import { adminPassword, sessionKey } from './env.js';
import type { VercelRequest, VercelResponse } from './vercel.js';

// Two sealed cookies: the guest's player id, and the admin's grant. A cookie
// that unseals was issued by this server - that is the whole proof of identity.

const PLAYER_COOKIE = 'ns_player';
const ADMIN_COOKIE = 'ns_admin';
const PLAYER_MAX_AGE = 7 * 24 * 60 * 60;
const ADMIN_MAX_AGE = 24 * 60 * 60;

function readCookie(req: VercelRequest, name: string): string | undefined {
    const header = req.headers.cookie ?? '';
    for (const part of header.split(';')) {
        const [key, ...value] = part.trim().split('=');
        if (key === name) return decodeURIComponent(value.join('='));
    }
    return undefined;
}

function cookie(name: string, value: string, maxAge: number): string {
    return `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}

function appendCookie(res: VercelResponse, value: string) {
    const existing = res.getHeader('Set-Cookie');
    const list = Array.isArray(existing)
        ? existing
        : existing
          ? [String(existing)]
          : [];
    res.setHeader('Set-Cookie', [...list, value]);
}

function open(req: VercelRequest, name: string): unknown {
    const token = readCookie(req, name);
    if (!token) return null;
    try {
        return JSON.parse(unseal(sessionKey(), token));
    } catch {
        return null;
    }
}

export function playerIdFrom(req: VercelRequest): string | null {
    const value = open(req, PLAYER_COOKIE) as { p?: unknown } | null;
    return typeof value?.p === 'string' ? value.p : null;
}

export function setPlayerCookie(res: VercelResponse, playerId: string) {
    appendCookie(
        res,
        cookie(
            PLAYER_COOKIE,
            seal(sessionKey(), JSON.stringify({ p: playerId })),
            PLAYER_MAX_AGE,
        ),
    );
}

export function clearPlayerCookie(res: VercelResponse) {
    appendCookie(res, cookie(PLAYER_COOKIE, '', 0));
}

export function isAdmin(req: VercelRequest): boolean {
    const value = open(req, ADMIN_COOKIE) as { exp?: unknown } | null;
    return typeof value?.exp === 'number' && value.exp > Date.now();
}

export function setAdminCookie(res: VercelResponse) {
    const exp = Date.now() + ADMIN_MAX_AGE * 1000;
    appendCookie(
        res,
        cookie(
            ADMIN_COOKIE,
            seal(sessionKey(), JSON.stringify({ exp })),
            ADMIN_MAX_AGE,
        ),
    );
}

/** Constant-time, so the comparison leaks nothing about the password. */
export function passwordMatches(candidate: unknown): boolean {
    if (typeof candidate !== 'string') return false;
    const hash = (value: string) =>
        crypto.createHash('sha256').update(value).digest();
    return crypto.timingSafeEqual(hash(candidate), hash(adminPassword()));
}
