import { describe, expect, it } from 'vitest';
import { normalize } from './normalize.js';

describe('normalize', () => {
    it('ignores case, accents and surrounding space', () => {
        expect(normalize('  ÄÄNI ')).toBe('aani');
        expect(normalize('Élise')).toBe(normalize('elise'));
    });

    it('collapses inner whitespace', () => {
        expect(normalize('Matti   Meikäläinen')).toBe('matti meikalainen');
    });

    it('keeps different names different', () => {
        expect(normalize('Aino')).not.toBe(normalize('Aina'));
    });
});
