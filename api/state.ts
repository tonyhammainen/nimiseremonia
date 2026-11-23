import { currentRow } from './_lib/db.js';
import { correctNames } from './_lib/env.js';
import { route } from './_lib/http.js';
import type { GameState } from '../shared/game.js';

// GET -> the game state every phone shows. Identical for everyone, so the CDN
// may serve it for a second. The names are added only once the admin has
// pressed "Paljasta nimi" - no earlier response, and nothing in the bundle,
// contains them.
export default route(['GET'], async (_req, res) => {
    const row = await currentRow();
    const state: GameState = {
        phase: row?.step ?? 'lobby',
        cluePoints: row?.points ?? null,
    };
    if (state.phase === 'revealed') {
        state.names = correctNames();
    }
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=1');
    return res.status(200).json(state);
});
