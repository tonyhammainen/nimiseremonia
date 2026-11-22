import { useCallback, useEffect, useRef, useState } from 'react';
import { post } from '../api';

interface GuessOk {
    correct: boolean;
    cooldownMs: number;
}

interface Props {
    /** performance.now() time from which the next guess may be sent. */
    nextAt: number;
    setNextAt: (at: number) => void;
    onCorrect: () => void;
    /** The server says the round or the player changed; reload both. */
    onStale: () => void;
    onUnauthorized: () => void;
}

const NETWORK_RETRIES = 3;
const NETWORK_RETRY_MS = 2_000;

/**
 * One guess at a time. A guess typed before the 10 s cooldown is over waits
 * here, still editable, and goes out when the countdown reaches zero.
 */
export default function GuessForm({
    nextAt,
    setNextAt,
    onCorrect,
    onStale,
    onUnauthorized,
}: Props) {
    const [text, setText] = useState('');
    const [status, setStatus] = useState<'idle' | 'sending' | 'queued'>('idle');
    const [wrongFlash, setWrongFlash] = useState(0);
    const [note, setNote] = useState<string | null>(null);
    const [now, setNow] = useState(() => performance.now());
    // True while a guess that failed to reach the server waits to be resent.
    const [retrying, setRetrying] = useState(false);
    // A guess that failed to reach the server is resent with the same id, so
    // a retry after a lost answer can't count twice.
    const pending = useRef<{ id: string; text: string; tries: number } | null>(
        null,
    );

    const send = useCallback(async () => {
        // The text as it is now: a queued guess can be edited while it waits.
        const guess =
            pending.current ??
            (text.trim() ? { id: crypto.randomUUID(), text, tries: 0 } : null);
        if (!guess) {
            setStatus('idle');
            return;
        }
        pending.current = guess;
        setStatus('sending');
        setRetrying(false);
        setNote(null);
        try {
            const { status: code, body } = await post<
                GuessOk & { retryAfterMs?: number }
            >('/api/guess', { id: guess.id, text: guess.text });
            if (code === 429) {
                pending.current = null;
                setNextAt(performance.now() + (body.retryAfterMs ?? 1000));
                setNow(performance.now());
                setStatus('queued');
                return;
            }
            if (code >= 500) throw new Error(`HTTP ${code}`);
            pending.current = null;
            setStatus('idle');
            if (code === 200) {
                setNextAt(performance.now() + body.cooldownMs);
                if (body.correct) {
                    onCorrect();
                } else {
                    setWrongFlash((n) => n + 1);
                    setText((current) =>
                        current === guess.text ? '' : current,
                    );
                }
            } else if (code === 401) {
                onUnauthorized();
            } else if (code === 409) {
                onStale();
            } else {
                setNote('Arvausta ei voitu lähettää.');
            }
        } catch {
            if (guess.tries < NETWORK_RETRIES) {
                pending.current = { ...guess, tries: guess.tries + 1 };
                setRetrying(true);
                setNote('Yhteys katkesi – yritetään uudelleen…');
                setNextAt(performance.now() + NETWORK_RETRY_MS);
                setStatus('queued');
            } else {
                pending.current = null;
                setNote('Yhteysvirhe. Yritä uudelleen.');
                setStatus('idle');
            }
        }
    }, [text, onCorrect, onStale, onUnauthorized, setNextAt]);

    useEffect(() => {
        if (status !== 'queued') return;
        const timeout = setTimeout(
            () => void send(),
            Math.max(0, nextAt - performance.now()),
        );
        const tick = setInterval(() => setNow(performance.now()), 200);
        return () => {
            clearTimeout(timeout);
            clearInterval(tick);
        };
    }, [status, nextAt, send]);

    const submit = (event: React.FormEvent) => {
        event.preventDefault();
        if (!text.trim() || status !== 'idle') return;
        if (performance.now() >= nextAt) {
            void send();
        } else {
            setNow(performance.now());
            setStatus('queued');
        }
    };

    const cancel = () => {
        pending.current = null;
        setRetrying(false);
        setStatus('idle');
        setNote(null);
    };

    const secondsLeft = Math.max(1, Math.ceil((nextAt - now) / 1000));
    const waiting = status === 'queued' && !retrying;

    return (
        <form onSubmit={submit} className="flex flex-col gap-3">
            <label htmlFor="guess" className="sr-only">
                Arvauksesi
            </label>
            <div className="relative">
                <input
                    id="guess"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    maxLength={40}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    enterKeyHint="send"
                    placeholder="Kirjoita arvaus"
                    className="w-full rounded-2xl border-2 border-hairline bg-sheet px-4 py-4 text-center text-2xl font-bold tracking-wide text-ink uppercase placeholder:font-normal placeholder:tracking-normal placeholder:text-ink-3 placeholder:normal-case focus:border-accent focus:outline-none"
                />
                {wrongFlash > 0 && (
                    <span
                        key={wrongFlash}
                        aria-hidden="true"
                        className="wrong-cross pointer-events-none absolute inset-0 flex items-center justify-center text-6xl font-black text-danger"
                    >
                        ✕
                    </span>
                )}
            </div>
            <p role="status" className="sr-only">
                {wrongFlash > 0 ? `Väärin (${wrongFlash})` : ''}
            </p>
            {waiting ? (
                <div
                    role="status"
                    className="rounded-2xl bg-gold-soft px-4 py-3 text-center"
                >
                    <p className="text-lg font-bold text-ink">
                        Arvaus lähtee {secondsLeft} s kuluttua
                    </p>
                    <p className="text-ink-2 italic">
                        Arvausten määrä ei korvaa laatua.
                    </p>
                    <button
                        type="button"
                        onClick={cancel}
                        className="mt-2 rounded-full px-4 py-2 font-semibold text-accent underline"
                    >
                        Peru
                    </button>
                </div>
            ) : (
                <button
                    type="submit"
                    disabled={status !== 'idle' || !text.trim()}
                    className="rounded-2xl bg-accent px-4 py-4 text-xl font-bold text-on-accent disabled:opacity-50"
                >
                    {status === 'idle' ? 'Arvaa' : 'Lähetetään…'}
                </button>
            )}
            {note && (
                <p role="alert" className="text-center text-danger">
                    {note}
                </p>
            )}
        </form>
    );
}
