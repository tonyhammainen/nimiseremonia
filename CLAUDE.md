# Rules for working in this repo

Nimiseremonia is a one-evening party app: guests guess a newborn's names on
their phones while the host runs a clue presentation. Hosted on Vercel.

## What you are working on

- React 19 + TypeScript + Vite + Tailwind in `src/`, Vercel serverless
  functions in `api/`, and `shared/` for the code both sides import. Every file
  under `api/` that is not underscore-prefixed is published as a route. Vercel
  Hobby allows at most 12 functions per deployment, so keep the route count
  there or below.
- The database is Supabase Postgres. The functions reach it over HTTP
  (PostgREST and `rpc`) with the service-role key in `api/_lib/db.ts`. The
  browser never talks to the database: it only subscribes to the Realtime
  channel `game` with the public anon key, to hear that the game state changed.
- `db/schema.sql` is the whole schema. It is applied by pasting it into the
  Supabase SQL editor, and it must stay safe to run again.
- `npm run dev` serves the frontend only. Anything touching `/api/*` needs
  `vercel dev`.

`README.md` has the setup steps and the game flow end to end.

## Invariants

Load-bearing, and mostly invisible from the code you are likely to edit. If you
have to touch one, say so out loud.

- **Guesses are raw facts.** A row in `guesses` holds who, what and when -
  never the round, clue or points. Scoring matches each guess to the latest
  `timeline` row whose `started_at` is not after the guess, in
  `shared/scoring.ts` (and the same match in SQL inside `submit_guess`). That is
  what makes **Takaisin** a true undo: deleting the latest timeline row
  re-matches the guesses made meanwhile to the previous clue.
- **The correct names never leave the server before the reveal.** They live
  only in env vars, are not stored in the database, are not in the bundle, and
  `/api/state` includes them only when the latest timeline step is `revealed`.
  `api/_tests/state.test.ts` guards this.
- **The 10 second limit is enforced in the database.** `submit_guess` takes a
  per-player advisory lock, so parallel requests cannot both pass. The UI
  limit is a convenience, never the enforcement point.
- **A guess id makes a retry safe.** The client generates it; `submit_guess`
  returns the original answer for an id it has already stored.
- **The anon key can do nothing but listen.** RLS is on with no policies, and
  the functions are revoked from `anon`. A Realtime message carries no data, so
  a spoofed one only causes a refetch.
- **The Content-Security-Policy lives in `vercel.json`.** A new external origin
  needs an entry there too.

## Branching and releases

- Every commit pushed to GitHub must use `tony.hammainen@kolumbus.fi` as both
  author and committer email, or Vercel rejects the deployment. Set it with
  `git config user.email tony.hammainen@kolumbus.fi` and verify before pushing.
- `main` is the default branch. Never push to it directly.
- Every change goes on its own feature branch, with a PR from that branch
  against `main`. Before opening each PR, bring the branch up to date with
  `main` (merge it in if `main` has moved) and run the checks.
- Merging is a human decision: it deploys to production.
- Testing happens on production (rehearsal with real phones, then
  **Nollaa kaikki** in the admin view).

## Language

- Code, comments, commits and PRs: English.
- **The whole UI is Finnish**, guest and admin alike. Strings are hardcoded
  inline; there is no i18n layer.

## UI

- Mobile-first: guests use phones, often one-handed, in a room full of people.
- Semantic HTML with real labels; `<button>` for actions.
- Every colour is a token from `src/index.css`.
- Guest input is shown in capitals so that capitalisation visibly can't matter.
  How guesses are matched (case, accents) is never explained to guests.

## Testing

Vitest. `*.test.ts` runs in Node, `*.test.tsx` in jsdom with Testing Library.
Handler tests live in `api/_tests/` and stub `fetch`, so the real handler and
database-client code runs. Query the DOM by role and label. CI runs format,
lint, typecheck, tests and build.

## Code style

- Prettier formats; `npm run lint` runs with `--max-warnings=0`.
- Relative imports in `api/` and `shared/` carry a `.js` extension.
- Ask before adding a dependency.

## Secrets

- Never commit `.env` files or keys. `.env.example` documents every variable.
- Environment variables live in the Vercel dashboard.
