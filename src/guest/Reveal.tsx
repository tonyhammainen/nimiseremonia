import { useEffect } from 'react';
import confetti from 'canvas-confetti';

const LETTER_DELAY_S = 0.18;

/** `anna-liisa` → `Anna-Liisa`: the payload is lower case. */
function capitalizeName(name: string): string {
    return name
        .toLocaleLowerCase('fi')
        .replace(
            /(^|[\s-])(\p{L})/gu,
            (_, sep: string, letter: string) =>
                sep + letter.toLocaleUpperCase('fi'),
        );
}

/** Confetti in the background and the full name rising in letter by letter. */
export default function Reveal({
    names,
}: {
    names: { first: string; second: string };
}) {
    useEffect(() => {
        if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
            return;
        }
        const colors = ['#7a2e5c', '#b5832a', '#f6e7c4', '#e86f8e', '#5fa8d3'];
        const burst = () => {
            void confetti({
                particleCount: 90,
                spread: 100,
                startVelocity: 45,
                origin: { x: Math.random() * 0.6 + 0.2, y: 0.7 },
                colors,
                disableForReducedMotion: true,
            });
        };
        burst();
        const interval = setInterval(burst, 2200);
        return () => {
            clearInterval(interval);
            confetti.reset();
        };
    }, []);

    const words = [names.first, names.second].map(capitalizeName);
    // Each letter's place in the whole name, so the second word continues
    // where the first left off.
    const offsets = words.map((_, w) =>
        words.slice(0, w).reduce((sum, word) => sum + [...word].length, 0),
    );
    return (
        <div className="flex min-h-[70vh] flex-col items-center justify-center gap-6 text-center">
            <p className="text-xl text-ink-2">Vauvan nimi on</p>
            <h1
                aria-label={words.join(' ')}
                className="flex flex-wrap justify-center gap-x-[0.4em] font-display text-[clamp(2.5rem,13vw,7rem)] leading-tight font-bold text-accent"
            >
                {words.map((word, w) => (
                    <span
                        key={w}
                        aria-hidden="true"
                        className="whitespace-nowrap"
                    >
                        {[...word].map((letter, i) => {
                            const delay = (offsets[w] + i) * LETTER_DELAY_S;
                            return (
                                <span
                                    key={i}
                                    className="reveal-letter"
                                    style={{
                                        animationDelay: `${delay}s, ${delay + 0.7}s`,
                                    }}
                                >
                                    {letter}
                                </span>
                            );
                        })}
                    </span>
                ))}
            </h1>
            <p className="text-3xl">🎉</p>
        </div>
    );
}
