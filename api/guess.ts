import { DbError, FOREIGN_KEY_VIOLATION, rpc } from './_lib/db.js';
import { bodyOf, route } from './_lib/http.js';
import { clearPlayerCookie, playerIdFrom } from './_lib/session.js';
import { normalize } from '../shared/normalize.js';
import { GUESS_MAX } from '../shared/game.js';

type SubmitResult =
    | {
          status: 'ok';
          text: string;
          savedAt: string;
          cooldownMs: number;
      }
    | { status: 'cooldown'; retryAfterMs: number }
    | { status: 'closed' | 'conflict' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// POST { id, text } -> the accepted guess. The rules - a round must be running,
// one guess per 10 s - are enforced atomically by `submit_guess` in the
// database (db/schema.sql). Whether the guess is right is never said: guests
// find out at the reveal. Correctness is worked out afterwards by scoring.
export default route(['POST'], async (req, res) => {
    const playerId = playerIdFrom(req);
    if (!playerId) return res.status(401).json({ error: 'player' });

    const body = bodyOf(req);
    const id = typeof body.id === 'string' ? body.id : '';
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    const key = normalize(text);
    if (!UUID.test(id) || !key || [...text].length > GUESS_MAX) {
        return res.status(400).json({ error: 'guess' });
    }

    let result: SubmitResult;
    try {
        result = await rpc<SubmitResult>('submit_guess', {
            p_player: playerId,
            p_id: id,
            p_text: text,
            p_key: key,
        });
    } catch (error) {
        // The player was removed by "Nollaa kaikki".
        if (error instanceof DbError && error.code === FOREIGN_KEY_VIOLATION) {
            clearPlayerCookie(res);
            return res.status(401).json({ error: 'player' });
        }
        throw error;
    }

    switch (result.status) {
        case 'ok':
            return res.status(200).json({
                guess: { text: result.text, savedAt: result.savedAt },
                cooldownMs: result.cooldownMs,
            });
        case 'cooldown':
            return res
                .status(429)
                .json({ error: 'cooldown', retryAfterMs: result.retryAfterMs });
        default:
            return res.status(409).json({ error: result.status });
    }
});
