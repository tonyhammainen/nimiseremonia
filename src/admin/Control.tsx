import { useCallback, useEffect, useState } from 'react';
import { api, post } from '../api';
import { onGameChanged } from '../realtime';
import type { AdminAction, NameKey, Phase } from '../../shared/game';

interface Status {
    phase: Phase;
    cluePoints: number | null;
    players: number;
    playerNames: string[];
    guesses: number;
    solved: number | null;
    /** The name `solved` counts: the current round's, or the one just played. */
    solvedName: NameKey | null;
    steps: number;
    firstClueCount: number | null;
}

const PHASE_LABEL: Record<Phase, string> = {
    lobby: 'Aula – peli ei ole alkanut',
    second: 'Toinen nimi',
    pause: 'Tauko',
    first: 'Etunimi',
    finished: 'Arvaaminen päättynyt',
    revealed: 'Nimi paljastettu 🎉',
};

const POLL_MS = 3_000;

interface Move {
    label: string;
    action: AdminAction;
    confirm?: string;
}

/** The big button's move for this moment, and any secondary ones. */
function movesFor(
    status: Status,
    counts: { second: number; first: number },
): Move[] {
    const p = status.cluePoints ?? 0;
    switch (status.phase) {
        case 'lobby':
            return [
                {
                    label: `Aloita toinen nimi (${counts.second} p)`,
                    action: {
                        type: 'startSecond',
                        points: counts.second,
                        firstPoints: counts.first,
                    },
                },
            ];
        case 'second':
            return [
                ...(p > 1
                    ? [
                          {
                              label: `Seuraava vihje (${p - 1} p)`,
                              action: { type: 'next' } as const,
                          },
                      ]
                    : []),
                {
                    label: 'Tauko',
                    action: { type: 'pause' },
                    confirm: 'Lopetetaanko toisen nimen arvaaminen?',
                },
            ];
        case 'pause':
            return [
                {
                    label: `Aloita etunimi (${status.firstClueCount} p)`,
                    action: { type: 'startFirst' },
                    confirm: `Aloitetaanko etunimen arvaaminen ${status.firstClueCount} pisteen vihjeellä?`,
                },
            ];
        case 'first':
            return [
                ...(p > 1
                    ? [
                          {
                              label: `Seuraava vihje (${p - 1} p)`,
                              action: { type: 'next' } as const,
                          },
                      ]
                    : []),
                {
                    label: 'Lopeta',
                    action: { type: 'finish' },
                    confirm: 'Lopetetaanko etunimen arvaaminen?',
                },
            ];
        case 'finished':
            return [
                {
                    label: 'Paljasta nimi',
                    action: { type: 'reveal' },
                    confirm: 'Paljastetaanko nimi nyt kaikkien puhelimiin?',
                },
            ];
        case 'revealed':
            return [];
    }
}

export default function Control() {
    const [status, setStatus] = useState<Status | null>(null);
    const [counts, setCounts] = useState({ second: 5, first: 13 });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            const { status: code, body } =
                await api<Status>('/api/admin/control');
            if (code === 200) setStatus(body);
        } catch {
            // The next poll tries again.
        }
    }, []);

    useEffect(() => {
        void load();
        const poll = setInterval(() => void load(), POLL_MS);
        const unsubscribe = onGameChanged(() => void load());
        return () => {
            clearInterval(poll);
            unsubscribe();
        };
    }, [load]);

    const run = async (action: AdminAction, confirmText?: string) => {
        if (confirmText && !window.confirm(confirmText)) return;
        setBusy(true);
        setError(null);
        try {
            const { status: code, body } = await post<Status>(
                '/api/admin/control',
                action,
            );
            if (code === 200) setStatus(body);
            else {
                setError('Siirto ei onnistunut – tila päivitetty.');
                void load();
            }
        } catch {
            setError('Ei yhteyttä. Yritä uudelleen.');
        } finally {
            setBusy(false);
        }
    };

    const reset = async () => {
        if (
            !window.confirm(
                'Nollataanko KAIKKI? Pelaajat, arvaukset ja vihjehistoria poistetaan.',
            ) ||
            !window.confirm('Oletko varma? Tätä ei voi perua.')
        ) {
            return;
        }
        setBusy(true);
        try {
            await post('/api/admin/reset', {});
            await load();
        } finally {
            setBusy(false);
        }
    };

    if (!status) return <p className="p-6 text-ink-3">Ladataan…</p>;

    const moves = movesFor(status, counts);
    const [primary, ...secondary] = moves;

    return (
        <main className="mx-auto flex max-w-md flex-col gap-5 px-4 py-6">
            <section className="rounded-2xl bg-sheet p-4 text-center shadow-sm">
                <p className="text-sm text-ink-3">Nyt</p>
                <p className="font-display text-2xl font-bold text-accent">
                    {PHASE_LABEL[status.phase]}
                </p>
                {status.cluePoints !== null && (
                    <p className="mt-1 text-4xl font-black text-ink">
                        {status.cluePoints}p vihje
                    </p>
                )}
                <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
                    <div>
                        <dt className="text-ink-3">Pelaajia</dt>
                        <dd className="text-xl font-bold">{status.players}</dd>
                    </div>
                    <div>
                        <dt className="text-ink-3">Arvauksia</dt>
                        <dd className="text-xl font-bold">{status.guesses}</dd>
                    </div>
                    <div>
                        <dt className="text-ink-3">
                            {status.solvedName === 'first'
                                ? 'Etunimi oikein'
                                : 'Toinen nimi oikein'}
                        </dt>
                        <dd className="text-xl font-bold tabular-nums">
                            {status.solved === null
                                ? '–'
                                : `${status.solved}/${status.players}`}
                        </dd>
                    </div>
                </dl>
            </section>

            <section aria-labelledby="players-heading">
                <h2
                    id="players-heading"
                    className="mb-2 font-semibold text-ink"
                >
                    Pelaajat ({status.playerNames.length})
                </h2>
                {status.playerNames.length === 0 ? (
                    <p className="text-ink-3">Ei vielä pelaajia</p>
                ) : (
                    <ul className="flex flex-wrap gap-1.5">
                        {status.playerNames.map((name, i) => (
                            <li
                                key={`${i}-${name}`}
                                className="rounded-full bg-surface px-3 py-1 text-sm text-ink"
                            >
                                {name}
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            {status.phase === 'lobby' && (
                <fieldset className="flex flex-col gap-3">
                    <legend className="mb-2 font-semibold text-ink">
                        Vihjeiden määrät
                    </legend>
                    {(
                        [
                            ['second', 'Toinen nimi'],
                            ['first', 'Etunimi'],
                        ] as const
                    ).map(([key, label]) => (
                        <label
                            key={key}
                            className="flex items-center justify-between gap-3 text-ink-2"
                        >
                            {label}
                            <input
                                type="number"
                                inputMode="numeric"
                                min={1}
                                max={100}
                                value={counts[key]}
                                onChange={(e) =>
                                    setCounts((current) => ({
                                        ...current,
                                        [key]: Math.min(
                                            100,
                                            Math.max(
                                                1,
                                                Math.round(
                                                    Number(e.target.value),
                                                ) || 1,
                                            ),
                                        ),
                                    }))
                                }
                                className="w-24 rounded-xl border-2 border-hairline bg-sheet px-3 py-2 text-center text-xl"
                            />
                        </label>
                    ))}
                </fieldset>
            )}

            {primary && (
                <button
                    type="button"
                    disabled={busy}
                    onClick={() => void run(primary.action, primary.confirm)}
                    className="rounded-3xl bg-accent px-4 py-8 text-2xl font-black text-on-accent shadow disabled:opacity-50"
                >
                    {primary.label}
                </button>
            )}
            {secondary.map((move) => (
                <button
                    key={move.label}
                    type="button"
                    disabled={busy}
                    onClick={() => void run(move.action, move.confirm)}
                    className="rounded-2xl border-2 border-accent px-4 py-4 text-lg font-bold text-accent disabled:opacity-50"
                >
                    {move.label}
                </button>
            ))}

            {status.steps > 0 && (
                <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                        void run(
                            { type: 'undo' },
                            'Perutaanko viimeisin painallus?',
                        )
                    }
                    className="rounded-2xl bg-surface px-4 py-3 font-semibold text-ink-2 disabled:opacity-50"
                >
                    ↶ Takaisin
                </button>
            )}

            {error && (
                <p role="alert" className="text-center text-danger">
                    {error}
                </p>
            )}

            <button
                type="button"
                disabled={busy}
                onClick={() => void reset()}
                className="mt-10 rounded-xl px-4 py-3 text-sm font-semibold text-danger underline disabled:opacity-50"
            >
                Nollaa kaikki
            </button>
        </main>
    );
}
