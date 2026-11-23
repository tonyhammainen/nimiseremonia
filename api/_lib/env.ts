import { keyFrom } from './crypto.js';
import { normalize } from '../../shared/normalize.js';
import type { NameKey } from '../../shared/game.js';

// Server-only configuration. The Supabase integration from the Vercel
// Marketplace names its variables for Next.js, so each value is accepted under
// the names it is likely to have.

function pick(...names: string[]): string {
    for (const name of names) {
        const value = process.env[name]?.trim();
        if (value) return value;
    }
    throw new Error(`Missing environment variable ${names[0]}`);
}

export function supabaseConfig(): { url: string; key: string } {
    return {
        url: pick(
            'SUPABASE_URL',
            'NEXT_PUBLIC_SUPABASE_URL',
            'VITE_SUPABASE_URL',
        ).replace(/\/+$/, ''),
        key: pick('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY'),
    };
}

export function sessionKey(): Buffer {
    return keyFrom(pick('SESSION_SECRET'));
}

export function adminPassword(): string {
    return pick('ADMIN_PASSWORD');
}

/** The answers as configured, for display after the reveal. */
export function correctNames(): Record<NameKey, string> {
    return {
        second: pick('CORRECT_SECOND_NAME'),
        first: pick('CORRECT_FIRST_NAME'),
    };
}

/** The answers in the form guesses are compared in. */
export function correctKeys(): Record<NameKey, string> {
    const names = correctNames();
    return { second: normalize(names.second), first: normalize(names.first) };
}
