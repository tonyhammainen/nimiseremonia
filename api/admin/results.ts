import { loadGuesses, loadPlayers, loadTimeline } from '../_lib/db.js';
import { correctKeys } from '../_lib/env.js';
import { route } from '../_lib/http.js';
import { computeResults } from '../../shared/scoring.js';

// GET -> winners and full rankings per name and combined.
export default route(
    ['GET'],
    async (_req, res) => {
        const [players, timeline, guesses] = await Promise.all([
            loadPlayers(),
            loadTimeline(),
            loadGuesses(),
        ]);
        return res
            .status(200)
            .json(computeResults(players, timeline, guesses, correctKeys()));
    },
    { admin: true },
);
