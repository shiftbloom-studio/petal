import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ChatLog } from "../../src/worker/hub";
import { chatMessage, inspectIrcLine } from "../../src/worker/relay/irc";
import { chatLine } from "./relay/lines";

function read(line: string) {
    const info = inspectIrcLine(line);
    assert.ok(info);
    return { info, message: chatMessage(line, info) };
}

function flushed(log: ChatLog) {
    const written: [string, object][] = [];
    log.flush(2, (message, batch) => written.push([message, batch]));
    return written;
}

describe("chat log", () => {
    it("reads who said what, with colons in the text and without tags", () => {
        assert.deepEqual(read(chatLine("alpha", "m-1")).message, {
            login: "viewer1001",
            text: "synthetic line m-1",
        });
        const plain = ":someone!someone@someone.tmi.twitch.tv PRIVMSG #alpha :look :here: now";
        assert.deepEqual(read(plain).message, { login: "someone", text: "look :here: now" });
    });

    it("reads a USERNOTICE, whose sender is a tag and whose text may be missing", () => {
        const silent = "@id=n-1;login=subscriber;msg-id=sub :tmi.twitch.tv USERNOTICE #alpha";
        assert.deepEqual(read(silent).message, { login: "subscriber", text: "" });
        assert.deepEqual(read(`${silent} :thank you`).message, {
            login: "subscriber",
            text: "thank you",
        });
    });

    it("writes what it holds in batches and forgets it", () => {
        const log = new ChatLog();
        for (let index = 0; index <= ChatLog.BATCH; index += 1) {
            const line = chatLine("alpha", `m-${index}`);
            log.add(1000 + index, "alpha", line, read(line).info);
        }
        const written = flushed(log) as [string, { shard: number; lines: object[] }][];
        assert.deepEqual(
            written.map(([message, batch]) => [message, batch.shard, batch.lines.length]),
            [
                ["chat", 2, ChatLog.BATCH],
                ["chat", 2, 1],
            ],
        );
        assert.deepEqual(written[0]?.[1].lines[0], {
            at: 1000,
            channel: "alpha",
            command: "PRIVMSG",
            id: "m-0",
            login: "viewer1001",
            text: "synthetic line m-0",
        });
        assert.deepEqual(flushed(log), []);
    });

    it("stops at its limit and says how many lines it left out", () => {
        const log = new ChatLog();
        const line = chatLine("alpha", "m-1");
        const { info } = read(line);
        for (let index = 0; index < ChatLog.LIMIT + 3; index += 1) log.add(0, "alpha", line, info);
        const written = flushed(log);
        assert.equal(written.length, ChatLog.LIMIT / ChatLog.BATCH + 1);
        assert.deepEqual(written.at(-1), ["chat lines not logged", { shard: 2, dropped: 3 }]);
    });
});
