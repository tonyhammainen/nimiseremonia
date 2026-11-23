import { broadcastChanged, rpc } from '../_lib/db.js';
import { route } from '../_lib/http.js';

// POST -> "Nollaa kaikki": deletes every guest, guess and timeline row, back
// to an empty lobby. Guests' cookies then point at nobody, so their phones
// return to the nickname screen.
export default route(
    ['POST'],
    async (_req, res) => {
        await rpc('reset_game', {});
        await broadcastChanged();
        return res.status(200).json({});
    },
    { admin: true },
);
