import {
    appendStep,
    broadcastChanged,
    deleteStep,
    loadGuesses,
    loadPlayers,
    loadTimeline,
} from '../_lib/db.js';
import { correctKeys } from '../_lib/env.js';
import { bodyOf, route } from '../_lib/http.js';
import type { VercelResponse } from '../_lib/vercel.js';
import {
    applyAction,
    firstClueCount,
    type AdminAction,
} from '../../shared/game.js';
import { computeResults } from '../../shared/scoring.js';

const ACTIONS = new Set<AdminAction['type']>([
    'startSecond',
    'next',
    'pause',
    'startFirst',
    'finish',
    'reveal',
    'undo',
]);

async function status(res: VercelResponse) {
    const [timeline, players, guesses] = await Promise.all([
        loadTimeline(),
        loadPlayers(),
        loadGuesses(),
    ]);
    const current = timeline.at(-1) ?? null;
    const phase = current?.step ?? 'lobby';
    const results = computeResults(players, timeline, guesses, correctKeys());
    const solved =
        phase === 'second' || phase === 'first'
            ? results[phase].filter((s) => s.points > 0).length
            : null;
    return res.status(200).json({
        phase,
        cluePoints: current?.points ?? null,
        players: players.length,
        guesses: guesses.length,
        solved,
        steps: timeline.length,
        firstClueCount: firstClueCount(timeline),
    });
}

// GET -> the live overview for the admin view.
// POST { type, points?, firstPoints? } -> one move along the evening (see shared/game.ts),
// or { type: 'undo' } to delete the latest timeline row. Guesses are scored
// after the fact against the timeline, so an undo re-scores the guesses made
// since the mis-click and nobody gains or loses by it.
export default route(
    ['GET', 'POST'],
    async (req, res) => {
        if (req.method === 'GET') return status(res);

        const body = bodyOf(req);
        const type = body.type as AdminAction['type'];
        if (!ACTIONS.has(type)) {
            return res.status(400).json({ error: 'action' });
        }
        const timeline = await loadTimeline();
        const current = timeline.at(-1) ?? null;

        if (type === 'undo') {
            if (!current) return res.status(409).json({ error: 'action' });
            await deleteStep(current.id);
        } else {
            const next = applyAction(timeline, {
                type,
                points: body.points,
                firstPoints: body.firstPoints,
            } as Exclude<AdminAction, { type: 'undo' }>);
            if (!next) return res.status(409).json({ error: 'action' });
            await appendStep(next);
        }
        await broadcastChanged();
        return status(res);
    },
    { admin: true },
);
