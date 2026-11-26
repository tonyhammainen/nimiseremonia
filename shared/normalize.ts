/**
 * The form two guesses (or nicknames) are compared in: trimmed, lower-case,
 * inner whitespace collapsed. Accents are letters of their own and are kept:
 * "  ÄÄNI " and "ääni" match, "ääni" and "aani" don't. Composed to NFC so the
 * same letter typed two ways (Ä vs A + combining diaeresis) still matches.
 * The API is the only place guesses are normalized; the database stores the
 * result next to the raw text, so SQL never needs its own copy of these rules.
 */
export function normalize(text: string): string {
    return text.normalize('NFC').toLowerCase().trim().replace(/\s+/g, ' ');
}
