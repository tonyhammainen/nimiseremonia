import { isAdmin } from './session.js';
import type { VercelRequest, VercelResponse } from './vercel.js';

type Handler = (req: VercelRequest, res: VercelResponse) => Promise<unknown>;

/**
 * Wraps a route: answers only the given methods, optionally only for the
 * admin, never lets a response be cached unless the route says so, and turns
 * an unexpected failure into a 500 without leaking its details.
 */
export function route(
    methods: string[],
    handler: Handler,
    { admin = false } = {},
) {
    return async (req: VercelRequest, res: VercelResponse) => {
        res.setHeader('Cache-Control', 'no-store');
        if (!methods.includes(req.method ?? '')) {
            res.setHeader('Allow', methods.join(', '));
            return res.status(405).json({ error: 'method' });
        }
        if (admin && !isAdmin(req)) {
            return res.status(401).json({ error: 'admin' });
        }
        try {
            await handler(req, res);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'server' });
        }
    };
}

/** The JSON body as a plain object, or an empty one. */
export function bodyOf(req: VercelRequest): Record<string, unknown> {
    const body = req.body;
    return body && typeof body === 'object' && !Array.isArray(body)
        ? (body as Record<string, unknown>)
        : {};
}
