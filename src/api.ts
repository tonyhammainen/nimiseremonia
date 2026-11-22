export interface ApiResult<T> {
    status: number;
    body: T;
}

/**
 * A request to our own API. Resolves with the status and the parsed body for
 * any HTTP answer, so callers branch on status; rejects only when the server
 * could not be reached at all.
 */
export async function api<T = Record<string, unknown>>(
    path: string,
    init?: { method?: string; body?: unknown },
): Promise<ApiResult<T>> {
    const res = await fetch(path, {
        method: init?.method ?? 'GET',
        credentials: 'same-origin',
        headers:
            init?.body === undefined
                ? undefined
                : { 'Content-Type': 'application/json' },
        body: init?.body === undefined ? undefined : JSON.stringify(init.body),
    });
    const body = (await res.json().catch(() => ({}))) as T;
    return { status: res.status, body };
}

export const post = <T = Record<string, unknown>>(
    path: string,
    body: unknown,
) => api<T>(path, { method: 'POST', body });
