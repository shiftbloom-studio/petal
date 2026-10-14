import assert from "node:assert/strict";
import { it } from "node:test";

import { loadGif } from "../../src/lib/overlay/gifs";

const URL = "https://media1.giphy.com/media/p3hZ9PbhVBO9gM6LoE/giphy.gif?cid=twitch&ct=g";
const GIF = Buffer.from("R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==", "base64");
const response = (bytes: Uint8Array = GIF, headers: Record<string, string> = {}) =>
    new Response(bytes, { headers: { "content-type": "image/gif", ...headers } });

it("loads only bounded GIFs, without cache, credentials, referrer or redirects", async (t) => {
    const fetch = t.mock.method(globalThis, "fetch", async (url: string, options: RequestInit) => {
        assert.equal(url, URL);
        assert.equal(options.cache, "no-store");
        assert.equal(options.credentials, "omit");
        assert.equal(options.referrerPolicy, "no-referrer");
        assert.equal(options.redirect, "error");
        return response();
    });
    await assert.rejects(
        loadGif("https://untrusted.example/image.gif", new AbortController().signal),
    );
    assert.equal(fetch.mock.callCount(), 0);
    const result = await loadGif(URL, new AbortController().signal);
    assert.equal(result.width, 1);
    assert.equal(result.height, 1);
    assert.deepEqual(Buffer.from(await result.blob.arrayBuffer()), GIF);
});

it("rejects wrong types, truncated containers, oversized frames and excessive frame counts", async (t) => {
    const huge = Buffer.from(GIF);
    huge.writeUInt16LE(65535, 6);
    huge.writeUInt16LE(65535, 8);
    const frames = Buffer.concat([
        GIF.subarray(0, 19),
        ...Array(301).fill(GIF.subarray(19, -1)),
        Buffer.from([0x3b]),
    ]);
    const manyPixels = Buffer.from(frames);
    manyPixels.writeUInt16LE(1024, 6);
    manyPixels.writeUInt16LE(1024, 8);
    for (const answer of [
        response(GIF, { "content-type": "image/svg+xml" }),
        response(GIF, { "content-length": "5242881" }),
        response(Buffer.from("<svg onload='alert(1)'/>")),
        response(GIF.subarray(0, -1)),
        response(huge),
        response(frames),
        response(manyPixels),
    ]) {
        t.mock.method(globalThis, "fetch", async () => answer);
        await assert.rejects(loadGif(URL, new AbortController().signal));
    }
});

it("cancels streams over the byte limit even without a Content-Length", async (t) => {
    let cancelled = false;
    t.mock.method(
        globalThis,
        "fetch",
        async () =>
            new Response(
                new ReadableStream({
                    pull(controller) {
                        controller.enqueue(new Uint8Array(1024 * 1024));
                    },
                    cancel() {
                        cancelled = true;
                    },
                }),
                { headers: { "content-type": "image/gif" } },
            ),
    );
    await assert.rejects(loadGif(URL, new AbortController().signal), /too large/);
    assert.equal(cancelled, true);
});

it("forwards cancellation and times out a stalled fetch", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    t.mock.method(
        globalThis,
        "fetch",
        async (_url: string, options: RequestInit) =>
            new Promise((_resolve, reject) => {
                options.signal?.addEventListener("abort", () => reject(options.signal?.reason));
            }),
    );
    const controller = new AbortController();
    const cancelled = assert.rejects(loadGif(URL, controller.signal));
    controller.abort();
    await cancelled;
    const timedOut = assert.rejects(loadGif(URL, new AbortController().signal));
    t.mock.timers.tick(10_000);
    await timedOut;
});
