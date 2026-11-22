import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import GuestApp from './GuestApp';

vi.mock('canvas-confetti', () => ({
    default: Object.assign(() => Promise.resolve(), { reset: () => {} }),
}));

/** Stubs the two reads the guest view makes when it opens. */
function stubApi(state: unknown, me: { status: number; body: unknown }) {
    vi.stubGlobal(
        'fetch',
        vi.fn(async (path: string) =>
            path === '/api/state'
                ? new Response(JSON.stringify(state))
                : new Response(JSON.stringify(me.body), { status: me.status }),
        ),
    );
}

const player = {
    status: 200,
    body: {
        username: 'Anni',
        solved: { second: true, first: false },
        cooldownMs: 0,
    },
};

describe('GuestApp', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('asks a new phone for a nickname first', async () => {
        stubApi({ phase: 'second', cluePoints: 5 }, { status: 401, body: {} });
        render(<GuestApp />);
        expect(
            await screen.findByLabelText('Valitse nimimerkki'),
        ).toBeInTheDocument();
    });

    it('shows the round and the clue value as "5p vihje"', async () => {
        stubApi({ phase: 'first', cluePoints: 5 }, player);
        render(<GuestApp />);
        expect(
            await screen.findByRole('heading', { name: 'Arvaa etunimi' }),
        ).toBeInTheDocument();
        expect(screen.getByText('5p vihje')).toBeInTheDocument();
        expect(screen.getByLabelText('Arvauksesi')).toBeInTheDocument();
    });

    it('keeps a solved name locked', async () => {
        stubApi({ phase: 'second', cluePoints: 3 }, player);
        render(<GuestApp />);
        expect(await screen.findByText('Oikein!')).toBeInTheDocument();
        expect(screen.queryByLabelText('Arvauksesi')).not.toBeInTheDocument();
    });

    it.each(['pause', 'finished'])(
        'builds suspense during %s',
        async (phase) => {
            stubApi({ phase, cluePoints: null }, player);
            render(<GuestApp />);
            expect(
                await screen.findByText('Jännitys tiivistyy..'),
            ).toBeInTheDocument();
        },
    );

    it('reveals the full name to everyone, joined or not', async () => {
        stubApi(
            {
                phase: 'revealed',
                cluePoints: null,
                names: { first: 'Aatos', second: 'Kuura' },
            },
            { status: 401, body: {} },
        );
        render(<GuestApp />);
        expect(
            await screen.findByRole('heading', { name: 'Aatos Kuura' }),
        ).toBeInTheDocument();
    });
});
