import { loadGuesses, loadTimeline } from '../_lib/db.js';
import { correctKeys } from '../_lib/env.js';
import { route } from '../_lib/http.js';
import { wrongGuesses } from '../../shared/scoring.js';

// GET -> wrong guesses per name, most common first, without who guessed them.
export default route(
    ['GET'],
    async (_req, res) => {
        const [timeline, guesses] = await Promise.all([
            loadTimeline(),
            loadGuesses(),
        ]);
        return res
            .status(200)
            .json(wrongGuesses(timeline, guesses, correctKeys()));
    },
    { admin: true },
);
