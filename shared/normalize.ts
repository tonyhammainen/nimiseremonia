/**
 * The form two guesses (or nicknames) are compared in: trimmed, lower-case,
 * accents stripped, inner whitespace collapsed. "  ÄÄNI " and "aani" match.
 * The API is the only place guesses are normalized; the database stores the
 * result next to the raw text, so SQL never needs its own copy of these rules.
 */
export function normalize(text: string): string {
    return text
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' ');
}
