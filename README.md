# Nimiseremonia

Guests guess the baby's names on their phones during the name-reveal
presentation, Kahoot-style: first the second name, then the first name. Every
clue is worth points (N … 1); a guest scores the points of the clue that was on
when they first guessed right. Guests are never told whether a guess was right:
they see only the list of their own guesses, and find out at the reveal.

| Part     | What                                                          |
| -------- | ------------------------------------------------------------- |
| Frontend | React 19, TypeScript, Vite, Tailwind (`src/`)                 |
| API      | Vercel functions (`api/`), 9 routes                           |
| Data     | Supabase Postgres via its REST API, schema in `db/schema.sql` |
| Live     | Supabase Realtime broadcast `game` + 15 s fallback poll       |

## Setup (once)

1. **Vercel**: import this repo as a project.
2. **Supabase**: in the Vercel project, _Storage / Marketplace → Supabase_ →
   create a free database and connect it. This adds the Supabase URL and keys
   as environment variables.
3. **Schema**: open the Supabase dashboard → _SQL editor_ → paste the whole
   `db/schema.sql` → _Run_. Safe to run again later, and re-run it whenever
   the file changes.
4. **Your variables** (Vercel → Settings → Environment Variables, Production):
   - `SESSION_SECRET` – any long random string
   - `ADMIN_PASSWORD`
   - `CORRECT_SECOND_NAME`, `CORRECT_FIRST_NAME` – one word each
5. Check that the integration created a public URL + anon key and the
   service-role key. Accepted names: `SUPABASE_URL` /
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` /
   `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (see `.env.example`).
6. Redeploy so the build picks the variables up.

## Before the party

- `/admin/qr` → screenshot the QR code into the first slide.
- Rehearse on production with a few phones, then **Nollaa kaikki** on `/admin`.
- The day before: open the Supabase dashboard (free projects pause when idle)
  and load the app once.

## The evening

| Admin (`/admin`)                                               | Guests' phones                       |
| -------------------------------------------------------------- | ------------------------------------ |
| –                                                              | Pick a nickname, wait in the lobby   |
| Set both clue counts (default 5 / 13) → **Aloita toinen nimi** | "Arvaa toinen nimi · Np vihje"       |
| **Seuraava vihje** per slide                                   | Clue value drops; own guesses listed |
| **Tauko**                                                      | "Jännitys tiivistyy.."               |
| **Aloita etunimi** → **Seuraava vihje**…                       | "Arvaa etunimi · Kp vihje"           |
| **Lopeta**                                                     | "Jännitys tiivistyy.."               |
| **Paljasta nimi**                                              | Confetti and the full name           |
| **Tulokset**: winners per name and combined                    | –                                    |
| **Väärät arvaukset** on the big screen                         | –                                    |

**Takaisin** undoes the last click: guesses made meanwhile are re-scored
against the previous clue. One guess per 10 s per guest, enforced in the
database; a guess typed earlier waits on the phone with a countdown. A guess
already made this round is not sent again ("Olet jo arvannut tämän"). Guesses
are compared ignoring case and spaces, but accents count: ÄÄTOS is not AATOS.

Ranking per name: points, then fewer guesses, then the earlier correct guess.
A guest's repeat of the same guess in the same round never counts.
Combined: points, then guesses, then the sum of solve times.

## Development

```bash
npm install
npm test
npm run lint && npm run typecheck && npm run format:check
```

`npm run dev` serves the frontend only; `/api/*` needs `vercel dev` with a
`.env.local` (copy `.env.example`).
