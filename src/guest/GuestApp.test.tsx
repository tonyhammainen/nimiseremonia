import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
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
        guesses: { second: ['Ilo', 'Väinö'], first: ['Eino'] },
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

    it("lists this round's own guesses, newest first, and keeps the form", async () => {
        stubApi({ phase: 'second', cluePoints: 3 }, player);
        render(<GuestApp />);
        const list = await screen.findByRole('list');
        expect(
            within(list)
                .getAllByRole('listitem')
                .map((item) => item.textContent),
        ).toEqual(['Väinö', 'Ilo']);
        expect(screen.queryByText('Eino')).not.toBeInTheDocument();
        expect(screen.getByLabelText('Arvauksesi')).toBeInTheDocument();
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

    it('reveals the full name, capitalized, to everyone, joined or not', async () => {
        stubApi(
            {
                phase: 'revealed',
                cluePoints: null,
                names: { first: 'aatos', second: 'anna-liisa' },
            },
            { status: 401, body: {} },
        );
        render(<GuestApp />);
        expect(
            await screen.findByRole('heading', { name: 'Aatos Anna-Liisa' }),
        ).toBeInTheDocument();
    });
});
