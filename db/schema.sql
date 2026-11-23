-- Nimiseremonia schema. Paste the whole file into the Supabase SQL editor and
-- press Run. Safe to run again: it creates what is missing and replaces the
-- functions, and never touches existing rows.

-- Guests. `username_key` is the normalized nickname (see shared/normalize.ts),
-- so "Matti" and "matti" can't both join.
create table if not exists public.players (
    id uuid primary key default gen_random_uuid(),
    username text not null check (char_length(username) between 1 and 20),
    username_key text not null unique,
    created_at timestamptz not null default clock_timestamp()
);

-- One row per admin click. The latest row (by started_at) is the current game
-- state; no rows means the lobby. Points are set only on clue rows.
create table if not exists public.timeline (
    id bigint generated always as identity primary key,
    step text not null
        check (step in ('second', 'pause', 'first', 'finished', 'revealed')),
    points int check (points is null or points > 0),
    started_at timestamptz not null default clock_timestamp(),
    check ((step in ('second', 'first')) = (points is not null))
);

-- Raw facts only: who guessed what, and when. Round, clue and points are
-- derived afterwards by matching created_at against the timeline, which is what
-- lets the admin undo a mis-click by deleting the latest timeline row.
-- `text_key` is the normalized text, computed by the API.
create table if not exists public.guesses (
    id uuid primary key,
    player_id uuid not null references public.players (id) on delete cascade,
    text text not null check (char_length(text) between 1 and 40),
    text_key text not null,
    created_at timestamptz not null default clock_timestamp()
);

-- Both clue counts are set before the game starts: the first-name count rides
-- on the row that starts the second-name round, and the first-name round
-- starts from it.
alter table public.timeline
    add column if not exists first_points int
    check (first_points is null or first_points > 0);

create index if not exists guesses_player_created_idx
    on public.guesses (player_id, created_at);
create index if not exists timeline_started_idx
    on public.timeline (started_at);

-- The public anon key ships in the app bundle (it is only used to listen to
-- the Realtime channel). With RLS on and no policies it can read and write
-- nothing; the API uses the service-role key, which bypasses RLS.
alter table public.players enable row level security;
alter table public.timeline enable row level security;
alter table public.guesses enable row level security;

-- The timeline step a moment falls in: the latest row started at or before it.
create or replace function public.step_at(p_at timestamptz)
returns public.timeline
language sql
stable
set search_path = ''
as $$
    select t.*
    from public.timeline t
    where t.started_at <= p_at
    order by t.started_at desc, t.id desc
    limit 1
$$;

-- Saves one guess, enforcing the rules atomically. The correct names are passed
-- in (already normalized) by the API, so they are never stored in the database.
-- Statuses: ok | closed (no round running) | solved (already guessed this name)
-- | cooldown (previous guess under 10 s ago) | conflict (id taken by another
-- player).
create or replace function public.submit_guess(
    p_player uuid,
    p_id uuid,
    p_text text,
    p_key text,
    p_second_key text,
    p_first_key text
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
    v_cooldown constant interval := interval '10 seconds';
    v_existing public.guesses;
    v_step public.timeline;
    v_target text;
    v_last timestamptz;
    v_now timestamptz;
begin
    -- Serializes one player's requests, so two parallel guesses can't both
    -- pass the cooldown check. Other players are not blocked.
    perform pg_advisory_xact_lock(hashtextextended(p_player::text, 0));

    -- A retry of a guess already stored gets the original answer.
    select * into v_existing from public.guesses where id = p_id;
    if found then
        if v_existing.player_id <> p_player then
            return jsonb_build_object('status', 'conflict');
        end if;
        v_step := public.step_at(v_existing.created_at);
        return jsonb_build_object(
            'status', 'ok',
            'correct', v_existing.text_key = case v_step.step
                when 'second' then p_second_key
                when 'first' then p_first_key
            end,
            'savedAt', v_existing.created_at,
            'cooldownMs', greatest(0, ceil(extract(epoch from
                v_existing.created_at + v_cooldown - clock_timestamp()) * 1000))::int
        );
    end if;

    v_now := clock_timestamp();
    v_step := public.step_at(v_now);
    if v_step.id is null or v_step.step not in ('second', 'first') then
        return jsonb_build_object('status', 'closed');
    end if;
    v_target := case v_step.step when 'second' then p_second_key else p_first_key end;

    if exists (
        select 1
        from public.guesses g
        where g.player_id = p_player
          and g.text_key = v_target
          and (public.step_at(g.created_at)).step = v_step.step
    ) then
        return jsonb_build_object('status', 'solved');
    end if;

    select max(created_at) into v_last
    from public.guesses
    where player_id = p_player;
    if v_last is not null and v_now - v_last < v_cooldown then
        return jsonb_build_object(
            'status', 'cooldown',
            'retryAfterMs',
            ceil(extract(epoch from v_last + v_cooldown - v_now) * 1000)::int
        );
    end if;

    insert into public.guesses (id, player_id, text, text_key, created_at)
    values (p_id, p_player, p_text, p_key, v_now);

    return jsonb_build_object(
        'status', 'ok',
        'correct', p_key = v_target,
        'savedAt', v_now,
        'cooldownMs', (extract(epoch from v_cooldown) * 1000)::int
    );
end
$$;

-- "Nollaa kaikki": back to an empty lobby.
create or replace function public.reset_game()
returns void
language sql
set search_path = ''
as $$
    truncate public.guesses, public.players, public.timeline restart identity
$$;

-- Only the API (service role) may call these.
revoke all on function public.step_at(timestamptz) from public, anon, authenticated;
revoke all on function public.submit_guess(uuid, uuid, text, text, text, text)
    from public, anon, authenticated;
revoke all on function public.reset_game() from public, anon, authenticated;
grant execute on function public.step_at(timestamptz) to service_role;
grant execute on function public.submit_guess(uuid, uuid, text, text, text, text)
    to service_role;
grant execute on function public.reset_game() to service_role;
