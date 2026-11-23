import { bodyOf, route } from '../_lib/http.js';
import { isAdmin, passwordMatches, setAdminCookie } from '../_lib/session.js';

// GET -> 200 if this browser is signed in as admin, 401 if not.
// POST { password } -> 200 and an admin cookie valid for a day, or 401.
export default route(['GET', 'POST'], async (req, res) => {
    if (req.method === 'GET') {
        return res.status(isAdmin(req) ? 200 : 401).json({});
    }
    if (!passwordMatches(bodyOf(req).password)) {
        return res.status(401).json({ error: 'password' });
    }
    setAdminCookie(res);
    return res.status(200).json({});
});
