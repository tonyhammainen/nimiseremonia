import { findPlayer, loadGuesses, loadTimeline } from './_lib/db.js';
import { route } from './_lib/http.js';
import { clearPlayerCookie, playerIdFrom } from './_lib/session.js';
import { ownGuesses, toMicros } from '../shared/scoring.js';
import { COOLDOWN_MS } from '../shared/game.js';

// GET -> who this phone is, what it has guessed in each round, and how long
// until it may guess again. Read when the app opens or wakes; after that the
// guess responses keep the phone up to date.
export default route(['GET'], async (req, res) => {
    const playerId = playerIdFrom(req);
    const player = playerId ? await findPlayer(playerId) : null;
    if (!player) {
        // Never joined, or the admin reset the game since.
        if (playerId) clearPlayerCookie(res);
        return res.status(401).json({ error: 'player' });
    }
    const [timeline, guesses] = await Promise.all([
        loadTimeline(),
        loadGuesses(player.id),
    ]);
    const last = guesses.at(-1);
    const sinceLast = last
        ? Date.now() - toMicros(last.createdAt) / 1000
        : Infinity;
    return res.status(200).json({
        username: player.username,
        guesses: ownGuesses(timeline, guesses),
        cooldownMs: Math.max(0, Math.ceil(COOLDOWN_MS - sinceLast)),
    });
});
