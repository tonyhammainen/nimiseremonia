import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GuessForm from './GuessForm';

interface Reply {
    status: number;
    body: unknown;
}

/** Stubs /api/guess; each call takes the next reply. Records the texts sent. */
function stubGuessApi(...replies: Reply[]) {
    const sent: { id: string; text: string }[] = [];
    vi.stubGlobal(
        'fetch',
        vi.fn(async (_path: string, init: RequestInit) => {
            sent.push(JSON.parse(String(init.body)));
            const reply = replies.shift() ?? replies.at(-1)!;
            return new Response(JSON.stringify(reply.body), {
                status: reply.status,
            });
        }),
    );
    return sent;
}

const ok = (correct: boolean): Reply => ({
    status: 200,
    body: { correct, savedAt: '2026-12-05T20:00:00Z', cooldownMs: 10_000 },
});

function Harness({ onCorrect = () => {} }: { onCorrect?: () => void }) {
    const [nextAt, setNextAt] = useState(0);
    return (
        <GuessForm
            nextAt={nextAt}
            setNextAt={setNextAt}
            onCorrect={onCorrect}
            onStale={() => {}}
            onUnauthorized={() => {}}
        />
    );
}

async function guess(user: ReturnType<typeof userEvent.setup>, text: string) {
    const input = screen.getByLabelText('Arvauksesi');
    await user.clear(input);
    await user.type(input, text);
    await user.click(screen.getByRole('button', { name: 'Arvaa' }));
}

describe('GuessForm', () => {
    let user: ReturnType<typeof userEvent.setup>;

    beforeEach(() => {
        vi.useFakeTimers({
            shouldAdvanceTime: true,
            toFake: [
                'setTimeout',
                'clearTimeout',
                'setInterval',
                'clearInterval',
                'performance',
                'Date',
            ],
        });
        user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    it('sends a guess at once and flashes a cross when it is wrong', async () => {
        const sent = stubGuessApi(ok(false));
        render(<Harness />);
        await guess(user, 'Ilo');
        expect(sent.map((g) => g.text)).toEqual(['Ilo']);
        expect(await screen.findByText('Väärin (1)')).toBeInTheDocument();
        expect(screen.getByLabelText('Arvauksesi')).toHaveValue('');
    });

    it('tells the round it was right', async () => {
        stubGuessApi(ok(true));
        const onCorrect = vi.fn();
        render(<Harness onCorrect={onCorrect} />);
        await guess(user, 'Kuura');
        await vi.waitFor(() => expect(onCorrect).toHaveBeenCalledOnce());
    });

    it('holds a guess made within 10 s and sends the edited text when the time is up', async () => {
        const sent = stubGuessApi(ok(false), ok(false));
        render(<Harness />);
        await guess(user, 'Ilo');
        await act(() => vi.advanceTimersByTimeAsync(3_000));

        await guess(user, 'Väinö');
        expect(
            screen.getByText('Arvausten määrä ei korvaa laatua.'),
        ).toBeVisible();
        expect(screen.getByText(/Arvaus lähtee 7 s kuluttua/)).toBeVisible();

        // Still editable while it waits.
        const input = screen.getByLabelText('Arvauksesi');
        await user.clear(input);
        await user.type(input, 'Eino');

        await act(() => vi.advanceTimersByTimeAsync(4_000));
        expect(sent).toHaveLength(1);
        await act(() => vi.advanceTimersByTimeAsync(4_000));
        expect(sent.map((g) => g.text)).toEqual(['Ilo', 'Eino']);
    });

    it('does not send a held guess that was cancelled', async () => {
        const sent = stubGuessApi(ok(false));
        render(<Harness />);
        await guess(user, 'Ilo');
        await guess(user, 'Väinö');
        await user.click(screen.getByRole('button', { name: 'Peru' }));
        await act(() => vi.advanceTimersByTimeAsync(15_000));
        expect(sent).toHaveLength(1);
        expect(screen.getByLabelText('Arvauksesi')).toHaveValue('Väinö');
    });

    it('waits as long as the server says when it refuses a guess as too early', async () => {
        const sent = stubGuessApi(
            { status: 429, body: { error: 'cooldown', retryAfterMs: 5_000 } },
            ok(false),
        );
        render(<Harness />);
        await guess(user, 'Ilo');
        expect(
            await screen.findByText(/Arvaus lähtee 5 s kuluttua/),
        ).toBeVisible();
        await act(() => vi.advanceTimersByTimeAsync(5_100));
        expect(sent.map((g) => g.text)).toEqual(['Ilo', 'Ilo']);
    });

    it('resends a guess with the same id after a network failure', async () => {
        const sent: string[] = [];
        let calls = 0;
        vi.stubGlobal(
            'fetch',
            vi.fn(async (_path: string, init: RequestInit) => {
                sent.push(JSON.parse(String(init.body)).id);
                if (calls++ === 0) throw new TypeError('Failed to fetch');
                return new Response(JSON.stringify(ok(false).body));
            }),
        );
        render(<Harness />);
        await guess(user, 'Ilo');
        expect(
            await screen.findByText('Yhteys katkesi – yritetään uudelleen…'),
        ).toBeInTheDocument();
        await act(() => vi.advanceTimersByTimeAsync(2_100));
        expect(sent).toHaveLength(2);
        expect(sent[1]).toBe(sent[0]);
    });
});
