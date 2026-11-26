import { describe, expect, it } from 'vitest';
import { normalize } from './normalize.js';

describe('normalize', () => {
    it('ignores case and surrounding space', () => {
        expect(normalize('  ÄÄNI ')).toBe('ääni');
        expect(normalize('Élise')).toBe(normalize('élise'));
    });

    it('keeps accented letters apart from plain ones', () => {
        expect(normalize('Äätos')).not.toBe(normalize('Aatos'));
        expect(normalize('Élise')).not.toBe(normalize('Elise'));
    });

    it('matches the same letter however it was composed', () => {
        expect(normalize('Äino')).toBe(normalize('Äino'));
    });

    it('collapses inner whitespace', () => {
        expect(normalize('Matti   Meikäläinen')).toBe('matti meikäläinen');
    });

    it('keeps different names different', () => {
        expect(normalize('Aino')).not.toBe(normalize('Aina'));
    });
});
