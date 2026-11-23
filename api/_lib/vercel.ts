import type { IncomingMessage, ServerResponse } from 'node:http';

// Local stand-ins for VercelRequest/VercelResponse.
//
// The official types come from @vercel/node, which is a ~150-package
// devDependency (edge-runtime, ts-morph, tsx, a second esbuild and a second
// typescript) that exists to run and bundle functions - work Vercel's build
// does for us. We only ever wanted the types, so we declare the surface we
// actually use. Vercel's runtime provides these objects unchanged; this file
// only describes them to the compiler.

export interface VercelRequest extends IncomingMessage {
    /** Parsed by Vercel from the request body; shape depends on content-type. */
    body: unknown;
    query: Partial<Record<string, string | string[]>>;
    cookies: Partial<Record<string, string>>;
}

export interface VercelResponse extends ServerResponse {
    status(statusCode: number): VercelResponse;
    json(body: unknown): VercelResponse;
    send(body: unknown): VercelResponse;
    redirect(statusOrUrl: string | number, url?: string): VercelResponse;
}
