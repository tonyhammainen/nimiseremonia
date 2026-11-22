import { DbError, insertPlayer, UNIQUE_VIOLATION } from './_lib/db.js';
import { bodyOf, route } from './_lib/http.js';
import { setPlayerCookie } from './_lib/session.js';
import { normalize } from '../shared/normalize.js';
import { USERNAME_MAX } from '../shared/game.js';

// POST { username } -> 200 { username } and a player cookie, or 409 if the
// nickname is taken. Joining is open at any point of the evening.
export default route(['POST'], async (req, res) => {
    const raw = bodyOf(req).username;
    const username = typeof raw === 'string' ? raw.trim() : '';
    const key = normalize(username);
    if (!key || [...username].length > USERNAME_MAX) {
        return res.status(400).json({ error: 'username' });
    }
    try {
        const player = await insertPlayer(username, key);
        setPlayerCookie(res, player.id);
        return res.status(200).json({ username: player.username });
    } catch (error) {
        if (error instanceof DbError && error.code === UNIQUE_VIOLATION) {
            return res.status(409).json({ error: 'taken' });
        }
        throw error;
    }
});
