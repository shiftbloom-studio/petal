import { isGifUrl } from "../chat/gifs";

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_PIXELS = 1024 * 1024;
const MAX_FRAME_PIXELS = 64 * 1024 * 1024;
const LOAD_TIMEOUT = 10_000;

/** Check the container before handing it to the browser's image decoder. No frames are decoded. */
function gifSize(bytes: Uint8Array): { width: number; height: number } {
    const invalid = () => new Error("Unsupported GIF");
    const word = (at: number) => bytes[at] | (bytes[at + 1] << 8);
    const signature = String.fromCharCode(...bytes.subarray(0, 6));
    if (bytes.length < 13 || (signature !== "GIF89a" && signature !== "GIF87a")) throw invalid();
    const width = word(6);
    const height = word(8);
    if (!width || !height || width * height > MAX_PIXELS) throw invalid();
    const tableSize = (flags: number) => (flags & 128 ? 3 * 2 ** ((flags & 7) + 1) : 0);
    let pos = 13 + tableSize(bytes[10]);
    let frames = 0;
    const skipBlocks = () => {
        while (pos < bytes.length) {
            const length = bytes[pos++];
            if (!length) return;
            pos += length;
        }
        throw invalid();
    };
    while (pos < bytes.length) {
        const block = bytes[pos++];
        if (block === 0x3b && frames > 0) return { width, height };
        if (block === 0x21) {
            pos++; // Extension label; all extensions contain length-prefixed sub-blocks.
            skipBlocks();
        } else if (block === 0x2c) {
            if (
                pos + 9 >= bytes.length ||
                !word(pos + 4) ||
                !word(pos + 6) ||
                word(pos) + word(pos + 4) > width ||
                word(pos + 2) + word(pos + 6) > height ||
                ++frames > 300 ||
                frames * width * height > MAX_FRAME_PIXELS
            )
                throw invalid();
            pos += 9 + tableSize(bytes[pos + 8]);
            const codeSize = bytes[pos++];
            if (codeSize < 2 || codeSize > 8) throw invalid();
            skipBlocks();
        } else {
            throw invalid();
        }
    }
    throw invalid();
}

/** Bounded, cancellable downloads with no HTTP cache, cookies, referrer or redirects. */
export async function loadGif(url: string, signal: AbortSignal) {
    if (!isGifUrl(url)) throw new Error("Unsupported GIF URL");
    const timeout = new AbortController();
    const timer = setTimeout(() => timeout.abort(), LOAD_TIMEOUT);
    const aborted = AbortSignal.any([signal, timeout.signal]);
    try {
        const response = await fetch(url, {
            signal: aborted,
            cache: "no-store",
            credentials: "omit",
            referrerPolicy: "no-referrer",
            redirect: "error",
            headers: { Accept: "image/gif" },
        });
        if (
            !response.ok ||
            response.headers.get("content-type")?.split(";")[0].trim() !== "image/gif" ||
            Number(response.headers.get("content-length")) > MAX_BYTES ||
            !response.body
        ) {
            await response.body?.cancel();
            throw new Error("Unsupported GIF response");
        }
        const reader = response.body.getReader();
        const chunks: Uint8Array<ArrayBuffer>[] = [];
        let length = 0;
        try {
            while (true) {
                const { done, value } = await reader.read();
                aborted.throwIfAborted();
                if (done) break;
                length += value.byteLength;
                if (length > MAX_BYTES) throw new Error("GIF is too large");
                chunks.push(value);
            }
        } finally {
            await reader.cancel();
        }
        const blob = new Blob(chunks, { type: "image/gif" });
        const size = gifSize(new Uint8Array(await blob.arrayBuffer()));
        aborted.throwIfAborted();
        return { blob, ...size };
    } finally {
        clearTimeout(timer);
    }
}
