import { useState } from 'react';
import { post } from '../api';
import { USERNAME_MAX } from '../../shared/game';

export default function JoinScreen({
    onJoined,
}: {
    onJoined: (username: string) => void;
}) {
    const [name, setName] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const submit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!name.trim() || busy) return;
        setBusy(true);
        setError(null);
        try {
            const { status, body } = await post<{ username: string }>(
                '/api/join',
                { username: name },
            );
            if (status === 200) return onJoined(body.username);
            setError(
                status === 409
                    ? 'Nimi on jo käytössä – valitse toinen.'
                    : status === 400
                      ? `Nimimerkki voi olla enintään ${USERNAME_MAX} merkkiä.`
                      : 'Jokin meni pieleen. Yritä uudelleen.',
            );
        } catch {
            setError('Ei yhteyttä. Yritä uudelleen.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <form onSubmit={submit} className="flex flex-col gap-4">
            <h1 className="text-center font-display text-3xl font-bold text-accent">
                Tervetuloa nimiseremoniaan!
            </h1>
            <label
                htmlFor="username"
                className="text-center text-lg text-ink-2"
            >
                Valitse nimimerkki
            </label>
            <input
                id="username"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={USERNAME_MAX}
                autoComplete="nickname"
                autoCapitalize="words"
                enterKeyHint="go"
                className="rounded-2xl border-2 border-hairline bg-sheet px-4 py-4 text-center text-2xl text-ink focus:border-accent focus:outline-none"
            />
            <button
                type="submit"
                disabled={busy || !name.trim()}
                className="rounded-2xl bg-accent px-4 py-4 text-xl font-bold text-on-accent disabled:opacity-50"
            >
                Mukaan!
            </button>
            {error && (
                <p role="alert" className="text-center text-danger">
                    {error}
                </p>
            )}
        </form>
    );
}
