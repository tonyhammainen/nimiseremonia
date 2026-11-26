import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { useGameState } from '../useGameState';
import GuessForm from './GuessForm';
import JoinScreen from './JoinScreen';
import Reveal from './Reveal';
import type { NameKey } from '../../shared/game';

interface Me {
    username: string;
    /** What this guest has guessed in each round, oldest first. */
    guesses: Record<NameKey, string[]>;
    cooldownMs: number;
}

const ROUND_TITLE: Record<NameKey, string> = {
    second: 'Arvaa toinen nimi',
    first: 'Arvaa etunimi',
};

function Centered({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
            {children}
        </div>
    );
}

export default function GuestApp() {
    const { state, offline, refresh } = useGameState();
    // undefined: still asking the server; null: this phone hasn't joined.
    const [me, setMe] = useState<Me | null | undefined>(undefined);
    const [nextAt, setNextAt] = useState(0);

    const loadMe = useCallback(async () => {
        try {
            const { status, body } = await api<Me>('/api/me');
            if (status === 200) {
                setMe(body);
                setNextAt(performance.now() + body.cooldownMs);
            } else if (status === 401) {
                setMe(null);
            }
        } catch {
            // Keep what we had; the next wake-up or round change retries.
        }
    }, []);

    useEffect(() => {
        void loadMe();
        const onVisible = () => {
            if (document.visibilityState === 'visible') void loadMe();
        };
        document.addEventListener('visibilitychange', onVisible);
        return () =>
            document.removeEventListener('visibilitychange', onVisible);
    }, [loadMe]);

    const phase = state?.phase;
    const onGuessed = useCallback(
        (text: string) => {
            if (phase !== 'second' && phase !== 'first') return;
            setMe((current) =>
                current
                    ? {
                          ...current,
                          guesses: {
                              ...current.guesses,
                              [phase]: [...current.guesses[phase], text],
                          },
                      }
                    : current,
            );
        },
        [phase],
    );

    const onStale = useCallback(() => {
        void refresh();
        void loadMe();
    }, [refresh, loadMe]);

    const onUnauthorized = useCallback(() => setMe(null), []);

    let content: React.ReactNode;
    if (!state || me === undefined) {
        content = (
            <Centered>
                <p className="text-ink-3">Ladataan…</p>
            </Centered>
        );
    } else if (state.phase === 'revealed' && state.names) {
        content = <Reveal names={state.names} />;
    } else if (me === null) {
        content = (
            <JoinScreen
                onJoined={(username) => {
                    setMe({
                        username,
                        guesses: { second: [], first: [] },
                        cooldownMs: 0,
                    });
                }}
            />
        );
    } else if (state.phase === 'lobby') {
        content = (
            <Centered>
                <p className="font-display text-3xl font-bold text-accent">
                    Hei {me.username}!
                </p>
                <p className="text-xl text-ink-2">
                    Odotetaan, että peli alkaa…
                </p>
            </Centered>
        );
    } else if (state.phase === 'second' || state.phase === 'first') {
        const guessed = me.guesses[state.phase];
        content = (
            <div className="flex flex-col gap-6">
                <header className="text-center">
                    <h1 className="font-display text-3xl font-bold text-accent">
                        {ROUND_TITLE[state.phase]}
                    </h1>
                    <p className="mt-2 inline-block rounded-full bg-gold-soft px-4 py-1 text-lg font-bold text-ink">
                        {state.cluePoints}p vihje
                    </p>
                </header>
                <GuessForm
                    key={state.phase}
                    nextAt={nextAt}
                    setNextAt={setNextAt}
                    guessed={guessed}
                    onGuessed={onGuessed}
                    onStale={onStale}
                    onUnauthorized={onUnauthorized}
                />
                {guessed.length > 0 && (
                    <section aria-labelledby="own-guesses">
                        <h2
                            id="own-guesses"
                            className="mb-2 text-center text-lg font-bold text-ink-2"
                        >
                            Aiemmat arvauksesi
                        </h2>
                        <ul className="flex flex-col gap-2">
                            {[...guessed].reverse().map((text) => (
                                <li
                                    key={text}
                                    className="rounded-xl bg-surface px-4 py-2 text-center text-lg font-bold tracking-wide text-ink uppercase"
                                >
                                    {text}
                                </li>
                            ))}
                        </ul>
                    </section>
                )}
            </div>
        );
    } else {
        content = (
            <Centered>
                <p className="font-display text-4xl font-bold text-accent">
                    Jännitys tiivistyy..
                </p>
            </Centered>
        );
    }

    return (
        <main className="mx-auto flex min-h-dvh max-w-md flex-col px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-8">
            {offline && (
                <p
                    role="alert"
                    className="mb-4 rounded-xl bg-danger-bg px-3 py-2 text-center text-danger"
                >
                    Ei yhteyttä – yritetään uudelleen…
                </p>
            )}
            {content}
        </main>
    );
}
