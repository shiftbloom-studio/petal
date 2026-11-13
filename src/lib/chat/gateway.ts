import { platformOrigin } from "./platform";

/**
 * Provider base URLs and where the data gateway of the overlay's own origin serves them. The
 * rest of the path and the query stay as the provider expects them. Mirrors
 * `GATEWAY_PREFIXES` in `src/worker/gateway/routes.ts`, which the browser bundle cannot import.
 */
export const GATEWAY_PREFIXES: Readonly<Record<string, string>> = {
    "https://7tv.io/": "/api/data/7tv/",
    "https://api.betterttv.net/": "/api/data/bttv/",
    "https://api.frankerfacez.com/": "/api/data/ffz/",
    "https://api.ffzap.com/": "/api/data/ffzap/",
    "https://api.chatterino.com/": "/api/data/chatterino/",
    "https://api.ivr.fi/": "/api/data/ivr/",
};

export const PROVIDER_FETCH_TIMEOUT_MS = 8_000;

/** On every answer of the gateway, and on nothing else that may answer under its path. */
const GATEWAY_HEADER = "x-petal-cache";

/** What a provider request consists of; both the gateway and the provider get all of it. */
export type JsonRequest = Pick<RequestInit, "method" | "headers" | "body">;

/** The gateway URL for a provider URL; undefined when the provider has to be asked itself. */
export function gatewayUrl(url: string): string | undefined {
    const origin = platformOrigin();
    if (!origin) return undefined;
    for (const [base, prefix] of Object.entries(GATEWAY_PREFIXES)) {
        if (url.startsWith(base)) return origin + prefix + url.slice(base.length);
    }
    return undefined;
}

const NOT_FOUND = 404;

async function readJson<T>(response: Response, url: string): Promise<T | undefined> {
    if (response.status === NOT_FOUND) return undefined;
    if (!response.ok) throw new Error(`${url} answered ${response.status}`);
    return (await response.json()) as T;
}

interface Deadline {
    signal: AbortSignal;
    elapsed: Promise<never>;
    stop: () => void;
}

function deadlineAfter(milliseconds: number): Deadline {
    const controller = new AbortController();
    let stop = () => {};
    const elapsed = new Promise<never>((_, reject) => {
        const timer = setTimeout(() => {
            controller.abort();
            reject(controller.signal.reason);
        }, milliseconds);
        stop = () => clearTimeout(timer);
    });
    return { signal: controller.signal, elapsed, stop };
}

function providerStatus(response: Response): boolean {
    return response.ok || response.status === NOT_FOUND;
}

function requireGatewayResponse(response: Response, url: string): void {
    if (providerStatus(response) && !response.headers.has(GATEWAY_HEADER)) {
        throw new Error(`${url} is not the gateway`);
    }
}

function preventUnhandledRejection<T>(work: Promise<T>): Promise<T> {
    work.catch(() => undefined);
    return work;
}

async function readWithinTimeout<T>(
    url: string,
    request: JsonRequest | undefined,
    read: (response: Response) => Promise<T>,
): Promise<T> {
    const deadline = deadlineAfter(PROVIDER_FETCH_TIMEOUT_MS);
    try {
        const response = await Promise.race([
            preventUnhandledRejection(fetch(url, { ...request, signal: deadline.signal })),
            deadline.elapsed,
        ]);
        return await Promise.race([preventUnhandledRejection(read(response)), deadline.elapsed]);
    } finally {
        deadline.stop();
    }
}

async function fetchFromGateway<T>(url: string, request?: JsonRequest): Promise<T | undefined> {
    return readWithinTimeout(url, request, async (response) => {
        requireGatewayResponse(response, url);
        return readJson<T>(response, url);
    });
}

/**
 * Fetches provider data as JSON, undefined when the provider answers 404. The gateway is asked
 * first; whenever it fails to give the provider's answer, the provider is asked directly, which
 * is all the overlay did before there was a gateway.
 */
export async function fetchJson<T>(url: string, request?: JsonRequest): Promise<T | undefined> {
    const gateway = gatewayUrl(url);
    if (gateway) {
        try {
            return await fetchFromGateway<T>(gateway, request);
        } catch (error) {
            console.warn("[gateway] no answer, asking the provider directly", error);
        }
    }
    return readWithinTimeout(url, request, (response) => readJson<T>(response, url));
}
