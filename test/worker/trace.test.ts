import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { type ApiHandlers, handleApi } from "../../src/worker/api";
import type { Env } from "../../src/worker/env";
import { shardOf } from "../../src/worker/relay/shard";
import { traceBroken, traceNothing, traceRequest } from "../stubs/cloudflare-workers";

const UPGRADED = { status: 101 } as Response;
const BROWSER =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) " +
    "Chrome/127.0.0.0 Safari/537.36 OBS/31.0.3";
const CONTEXT = { waitUntil: () => {}, passThroughOnException: () => {} } as ExecutionContext;

const ENV = {
    CHAT_HUB: { idFromName: (name: string) => name, get: () => ({ fetch: async () => UPGRADED }) },
} as unknown as Env;

/** A gateway that answers from the cache without asking a provider. */
const HANDLERS: ApiHandlers = {
    data: async (_request, _env, _context, _url, report) => {
        report({ route: "bttv-global", outcome: "HIT", layer: "kv", status: 200 });
        return new Response("[]");
    },
};

function call(path: string, headers: Record<string, string> = {}) {
    const url = new URL(path, "https://chat.example");
    const request = new Request(url, { headers: { "user-agent": BROWSER, ...headers } });
    return handleApi(request, ENV, CONTEXT, url, HANDLERS);
}

describe("trace attributes", () => {
    afterEach(traceNothing);

    it("names the endpoint and the shard of a chat connection, never the channel", async () => {
        const attributes = traceRequest();
        await call("/api/irc?channel=somechannel", { upgrade: "websocket" });
        assert.deepEqual(attributes, {
            "petal.route": "irc",
            "petal.shard": shardOf("somechannel", 4),
        });
        assert.ok(!JSON.stringify(attributes).includes("somechannel"));
    });

    it("names the reason of a refusal", async () => {
        const refused = traceRequest();
        await call("/api/irc?channel=somechannel");
        assert.deepEqual(refused, { "petal.route": "irc", "petal.refusal": "upgrade_required" });

        const unknown = traceRequest();
        await call("/api/somewhere");
        assert.deepEqual(unknown, { "petal.route": "unknown", "petal.refusal": "not_found" });
    });

    it("names what the gateway answered from", async () => {
        const attributes = traceRequest();
        await call("/api/data/bttv/3/cached/emotes/global");
        assert.deepEqual(attributes, {
            "petal.route": "data",
            "petal.gateway.route": "bttv-global",
            "petal.gateway.outcome": "HIT",
            "petal.gateway.layer": "kv",
        });
    });

    it("leaves the answer alone when the span refuses attributes", async () => {
        traceBroken();
        const response = await call("/api/irc?channel=somechannel", { upgrade: "websocket" });
        assert.equal(response.status, 101);
    });
});
