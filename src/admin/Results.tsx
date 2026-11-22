import { useEffect, useState } from 'react';
import { api } from '../api';
import type { CombinedScore, NameScore, Results } from '../../shared/scoring';

const clock = new Intl.DateTimeFormat('fi-FI', {
    timeZone: 'Europe/Helsinki',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
});

const seconds = (ms: number | null) =>
    ms === null ? '–' : `${(ms / 1000).toFixed(1)} s`;

function WinnerCard({
    title,
    winners,
}: {
    title: string;
    winners: (NameScore | CombinedScore)[];
}) {
    return (
        <section className="rounded-2xl bg-gold-soft p-4 text-center">
            <h2 className="text-sm font-semibold tracking-wide text-ink-2 uppercase">
                {title}
            </h2>
            {winners.length === 0 ? (
                <p className="mt-2 text-ink-3">Ei voittajaa</p>
            ) : (
                <>
                    <p className="mt-1 font-display text-2xl font-bold text-accent">
                        🏆 {winners.map((w) => w.username).join(' & ')}
                    </p>
                    <p className="text-ink-2">
                        {winners[0].points} p · {winners[0].guesses} arvausta
                        {winners.length > 1 && ' · tasapeli'}
                    </p>
                </>
            )}
        </section>
    );
}

function NameTable({ title, rows }: { title: string; rows: NameScore[] }) {
    return (
        <section>
            <h2 className="mb-2 font-display text-xl font-bold text-accent">
                {title}
            </h2>
            <table className="w-full text-left text-sm">
                <thead className="text-ink-3">
                    <tr>
                        <th className="py-1">#</th>
                        <th>Nimimerkki</th>
                        <th className="text-right">Pisteet</th>
                        <th className="text-right">Arvauksia</th>
                        <th className="text-right">Aika</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, i) => (
                        <tr
                            key={row.playerId}
                            className="border-t border-hairline"
                        >
                            <td className="py-1">{i + 1}</td>
                            <td>{row.username}</td>
                            <td className="text-right font-bold">
                                {row.points}
                            </td>
                            <td className="text-right">{row.guesses}</td>
                            <td className="text-right tabular-nums">
                                {row.time
                                    ? clock.format(new Date(row.time))
                                    : '–'}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </section>
    );
}

export default function ResultsPage() {
    const [results, setResults] = useState<Results | null>(null);
    const [error, setError] = useState(false);

    useEffect(() => {
        const load = () =>
            api<Results>('/api/admin/results')
                .then(({ status, body }) => {
                    if (status === 200) {
                        setResults(body);
                        setError(false);
                    } else setError(true);
                })
                .catch(() => setError(true));
        void load();
        const poll = setInterval(() => void load(), 10_000);
        return () => clearInterval(poll);
    }, []);

    if (!results) {
        return (
            <p className="p-6 text-ink-3">
                {error ? 'Tulosten haku epäonnistui.' : 'Ladataan…'}
            </p>
        );
    }

    return (
        <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-6">
            <div className="grid gap-3 sm:grid-cols-3">
                <WinnerCard
                    title="Toinen nimi"
                    winners={results.winners.second}
                />
                <WinnerCard title="Etunimi" winners={results.winners.first} />
                <WinnerCard
                    title="Yhteispisteet"
                    winners={results.winners.combined}
                />
            </div>

            <section>
                <h2 className="mb-2 font-display text-xl font-bold text-accent">
                    Yhteispisteet
                </h2>
                <table className="w-full text-left text-sm">
                    <thead className="text-ink-3">
                        <tr>
                            <th className="py-1">#</th>
                            <th>Nimimerkki</th>
                            <th className="text-right">Pisteet</th>
                            <th className="text-right">Arvauksia</th>
                            <th className="text-right">Ratkaisuaika</th>
                        </tr>
                    </thead>
                    <tbody>
                        {results.combined.map((row, i) => (
                            <tr
                                key={row.playerId}
                                className="border-t border-hairline"
                            >
                                <td className="py-1">{i + 1}</td>
                                <td>{row.username}</td>
                                <td className="text-right font-bold">
                                    {row.points}
                                </td>
                                <td className="text-right">{row.guesses}</td>
                                <td className="text-right tabular-nums">
                                    {seconds(row.solveMs || null)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </section>
            <NameTable title="Toinen nimi" rows={results.second} />
            <NameTable title="Etunimi" rows={results.first} />
            <p className="text-sm text-ink-3">
                Järjestys: pisteet, sitten vähemmän arvauksia, sitten aiempi
                oikea arvaus (yhteispisteissä ratkaisuaikojen summa).
            </p>
        </main>
    );
}
