import { useEffect, useState } from 'react';
import { api } from '../api';
import type { NameKey } from '../../shared/game';
import type { WrongGuess } from '../../shared/scoring';

const REFRESH_MS = 10_000;

function Column({ title, rows }: { title: string; rows: WrongGuess[] }) {
    return (
        <section className="min-w-0">
            <h2 className="mb-4 text-center font-display text-3xl font-bold text-accent sm:text-5xl">
                {title}
            </h2>
            {rows.length === 0 ? (
                <p className="text-center text-xl text-ink-3">
                    Ei vääriä arvauksia
                </p>
            ) : (
                <ol className="flex flex-col gap-1">
                    {rows.map((row) => (
                        <li
                            key={row.text}
                            className="flex items-baseline justify-between gap-3 border-b border-hairline py-1"
                        >
                            <span className="truncate text-2xl font-bold sm:text-4xl">
                                {row.text}
                            </span>
                            <span className="shrink-0 text-xl text-ink-2 tabular-nums sm:text-3xl">
                                ×{row.count}
                            </span>
                        </li>
                    ))}
                </ol>
            )}
        </section>
    );
}

/** For the big screen after the reveal. The page itself scrolls. */
export default function WrongGuesses() {
    const [data, setData] = useState<Record<NameKey, WrongGuess[]> | null>(
        null,
    );

    useEffect(() => {
        const load = () =>
            api<Record<NameKey, WrongGuess[]>>('/api/admin/wrong-guesses')
                .then(({ status, body }) => {
                    if (status === 200) setData(body);
                })
                .catch(() => {});
        void load();
        const poll = setInterval(() => void load(), REFRESH_MS);
        return () => clearInterval(poll);
    }, []);

    if (!data) return <p className="p-6 text-ink-3">Ladataan…</p>;

    return (
        <main className="px-4 py-6 sm:px-10">
            <h1 className="mb-8 text-center font-display text-4xl font-black text-ink sm:text-6xl">
                Väärät arvaukset
            </h1>
            <div className="grid grid-cols-2 gap-6 sm:gap-16">
                <Column title="Etunimi" rows={data.first} />
                <Column title="Toinen nimi" rows={data.second} />
            </div>
        </main>
    );
}
