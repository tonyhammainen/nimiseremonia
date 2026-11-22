import crypto from 'node:crypto';

// Sealing a short secret so it can be handed to the browser and read back here.
// Two things need it now - the session cookie that carries the Google refresh
// token, and the guest link that carries a read-only grant - and they are
// deliberately sealed under different keys, so rotating one does not disturb
// the other.
//
// AES-256-GCM: the tag is what makes a sealed value unforgeable, which is the
// whole point. A value that opens here was produced here.

const ALGO = 'aes-256-gcm';
const IV_BYTES = 12;
const TAG_BYTES = 16;

/** A 32-byte key from a secret of any length, so the env var can be any long random string. */
export function keyFrom(secret: string): Buffer {
    return crypto.createHash('sha256').update(secret).digest();
}

export function seal(key: Buffer, plain: string): string {
    const iv = crypto.randomBytes(IV_BYTES);
    const cipher = crypto.createCipheriv(ALGO, key, iv);
    const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64url');
}

/** Throws if the value was not produced by `seal` with the same key. */
export function unseal(key: Buffer, token: string): string {
    const raw = Buffer.from(token, 'base64url');
    const decipher = crypto.createDecipheriv(
        ALGO,
        key,
        raw.subarray(0, IV_BYTES),
    );
    decipher.setAuthTag(raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES));
    return Buffer.concat([
        decipher.update(raw.subarray(IV_BYTES + TAG_BYTES)),
        decipher.final(),
    ]).toString('utf8');
}
