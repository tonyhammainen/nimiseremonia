import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { api, post } from '../api';

const LINKS = [
    { to: '/admin', label: 'Ohjaus', end: true },
    { to: '/admin/tulokset', label: 'Tulokset' },
    { to: '/admin/vaarat', label: 'Väärät arvaukset' },
    { to: '/admin/qr', label: 'QR' },
];

function Login({ onSignedIn }: { onSignedIn: () => void }) {
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);

    const submit = async (event: React.FormEvent) => {
        event.preventDefault();
        setError(null);
        try {
            const { status } = await post('/api/admin/login', { password });
            if (status === 200) onSignedIn();
            else setError('Väärä salasana.');
        } catch {
            setError('Ei yhteyttä.');
        }
    };

    return (
        <form
            onSubmit={submit}
            className="mx-auto flex max-w-sm flex-col gap-3 px-4 pt-16"
        >
            <h1 className="font-display text-2xl font-bold text-accent">
                Ylläpito
            </h1>
            <label htmlFor="password" className="text-ink-2">
                Salasana
            </label>
            <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="rounded-xl border-2 border-hairline bg-sheet px-3 py-3 text-lg focus:border-accent focus:outline-none"
            />
            <button
                type="submit"
                className="rounded-xl bg-accent px-4 py-3 font-bold text-on-accent"
            >
                Kirjaudu
            </button>
            {error && (
                <p role="alert" className="text-danger">
                    {error}
                </p>
            )}
        </form>
    );
}

export default function AdminLayout() {
    const [signedIn, setSignedIn] = useState<boolean | null>(null);

    useEffect(() => {
        api('/api/admin/login')
            .then(({ status }) => setSignedIn(status === 200))
            .catch(() => setSignedIn(false));
    }, []);

    if (signedIn === null) {
        return <p className="p-6 text-ink-3">Ladataan…</p>;
    }
    if (!signedIn) return <Login onSignedIn={() => setSignedIn(true)} />;

    return (
        <div className="min-h-dvh">
            <nav className="sticky top-0 z-10 flex gap-1 overflow-x-auto border-b border-hairline bg-sheet px-2 py-2">
                {LINKS.map((link) => (
                    <NavLink
                        key={link.to}
                        to={link.to}
                        end={link.end}
                        className={({ isActive }) =>
                            `rounded-full px-3 py-2 text-sm font-semibold whitespace-nowrap ${
                                isActive
                                    ? 'bg-accent text-on-accent'
                                    : 'text-ink-2'
                            }`
                        }
                    >
                        {link.label}
                    </NavLink>
                ))}
            </nav>
            <Outlet />
        </div>
    );
}
