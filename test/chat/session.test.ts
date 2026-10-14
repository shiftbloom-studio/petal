import assert from "node:assert/strict";
import { it, type TestContext } from "node:test";

import { createDemoSession } from "../../src/lib/chat/demo";
import { createChatSession } from "../../src/lib/chat/session";
import { FakeWebSocket, useFakeWebSocket, useLocation } from "../helpers";

const JOIN_ECHO = ":justinfan1!justinfan1@justinfan1.tmi.twitch.tv JOIN #forsen";

/** A chat line of user `u<user>`; the relay tags the lines it replays to every new connection. */
const line = (id: string, user = "1", tag = "") =>
    `@id=${id};user-id=${user}${tag} :u${user}!u${user}@u${user}.tmi.twitch.tv PRIVMSG #forsen :${id}`;
const replayed = (id: string, user?: string) => line(id, user, ";petal-replay=1");

function openSession(t: TestContext) {
    t.mock.timers.enable({ apis: ["setTimeout", "setInterval"] });
    // Emotes and badges are not the subject here: no provider knows anything.
    const nothing = new Response("{}", { status: 404, headers: { "x-petal-cache": "MISS" } });
    t.mock.method(globalThis, "fetch", async () => nothing.clone());
    t.after(useFakeWebSocket());
    t.after(useLocation("https://chat.shiftbloom.studio/chat/forsen"));
    const session = createChatSession("forsen");
    t.after(() => session.dispose());
    // The emote providers open sockets of their own.
    const chat = () => FakeWebSocket.instances.findLast((ws) => ws.url.includes("/api/irc"));
    /** The relay accepts a connection and sends the JOIN echo with its replay in one frame. */
    const join = (...replay: string[]) => {
        chat()?.accept();
        chat()?.receive([JOIN_ECHO, ...replay].join("\r\n"));
    };
    const ids = () => session.state.messages.map((message) => message.id);
    return { chat, join, ids, session };
}

it("renders a line once, however often it arrives", (t) => {
    const { chat, join, ids } = openSession(t);
    join(replayed("m1"));
    chat()?.receive(line("m2"));
    chat()?.receive(line("m2"));
    chat()?.drop();
    t.mock.timers.tick(1500);
    // m3 was sent while the overlay was away.
    join(replayed("m1"), replayed("m2"), replayed("m3"));
    assert.deepEqual(ids(), ["m1", "m2", "m3"]);
});

it("removes what moderators removed and does not bring it back", (t) => {
    const { chat, join, ids } = openSession(t);
    join(replayed("m1"), replayed("m2", "2"), replayed("m3"));
    chat()?.receive("@target-msg-id=m2 :tmi.twitch.tv CLEARMSG #forsen :x");
    chat()?.receive(replayed("m2", "2"));
    assert.deepEqual(ids(), ["m1", "m3"]);
    chat()?.receive("@target-user-id=1 :tmi.twitch.tv CLEARCHAT #forsen :u1");
    assert.deepEqual(ids(), []);
});

it("passes Twitch GIF tags through replay and preserves the complete media URL", (t) => {
    const { chat, join, session } = openSession(t);
    const url = "https://media1.giphy.com/media/p3hZ9PbhVBO9gM6LoE/giphy.gif?cid=twitch&ct=g";
    join(line("[GIF]", "1", `;petal-replay=1;gifs=0-4|p3hZ9PbhVBO9gM6LoE|${url}`));
    assert.deepEqual(session.parts(session.state.messages[0]), [
        { type: "gif", source: "twitch", url, text: "[GIF]" },
    ]);
    chat()?.receive("@target-msg-id=[GIF] :tmi.twitch.tv CLEARMSG #forsen :[GIF]");
    assert.equal(session.state.messages.length, 0);
});

it("keeps native and repeated link GIF slots alive when a channel emote arrives", (t) => {
    const { join, session } = openSession(t);
    const url = "https://media1.giphy.com/media/p3hZ9PbhVBO9gM6LoE/giphy.gif?cid=twitch&ct=g";
    join(
        `@id=m1;user-id=1;room-id=42;gifs=0-4|id|${url} ` +
            `:u1!u1@u1.tmi.twitch.tv PRIVMSG #forsen :[GIF] Clap ${url} ${url}`,
    );
    const message = session.state.messages[0];
    const before = session.parts(message);
    const gifs = before.filter((part) => part.type === "gif");
    assert.deepEqual(
        gifs.map((part) => part.source),
        ["twitch", "link", "link"],
    );
    assert.notEqual(gifs[1], gifs[2]);

    const bttv = FakeWebSocket.instances.find((ws) => ws.url.includes("sockets.betterttv.net"));
    assert.ok(bttv);
    bttv.receive(
        JSON.stringify({
            name: "emote_create",
            data: { channel: "twitch:42", emote: { id: "clap", code: "Clap" } },
        }),
    );
    const after = session.parts(message, before);
    assert.ok(after.some((part) => part.type === "emote" && part.emote.name === "Clap"));
    const afterGifs = after.filter((part) => part.type === "gif");
    assert.equal(afterGifs.length, gifs.length);
    afterGifs.forEach((part, index) => {
        assert.equal(part, gifs[index]);
    });
});

it("includes both GIF options in the initial setup preview", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const demo = createDemoSession();
    t.after(() => demo.dispose());
    const gifs = demo.state.messages
        .flatMap((message) => demo.parts(message))
        .filter((part) => part.type === "gif");
    assert.deepEqual(
        gifs.map((part) => part.source),
        ["twitch", "link"],
    );
    assert.equal(gifs[0].text, "[GIF]");
    assert.equal(gifs[1].text, gifs[1].url);
});
