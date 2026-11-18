/** What the relay needs to know about an IRC line to route it, without decoding its tags. */
export interface IrcLineInfo {
    command: string;
    /** Channel login without the leading `#`, when the first parameter is a channel. */
    channel: string | undefined;
    /** Offset of the first character after the tag section; 0 when the line has no tags. */
    bodyStart: number;
}

const AT = 64;
const COLON = 58;
const HASH = 35;

export function inspectIrcLine(line: string): IrcLineInfo | undefined {
    let pos = 0;
    if (line.charCodeAt(0) === AT) {
        const end = line.indexOf(" ");
        if (end === -1) return undefined;
        pos = end + 1;
    }
    const bodyStart = pos;
    if (line.charCodeAt(pos) === COLON) {
        const end = line.indexOf(" ", pos);
        if (end === -1) return undefined;
        pos = end + 1;
    }
    let end = line.indexOf(" ", pos);
    if (end === -1) end = line.length;
    const command = line.slice(pos, end);
    if (!command) return undefined;
    let channel: string | undefined;
    if (line.charCodeAt(end + 1) === HASH) {
        let stop = line.indexOf(" ", end + 2);
        if (stop === -1) stop = line.length;
        channel = line.slice(end + 2, stop);
    }
    return { command, channel, bodyStart };
}

/** Raw (still escaped) value of one tag, found without splitting the whole tag section. */
export function tagValue(line: string, info: IrcLineInfo, name: string): string | undefined {
    const tagsEnd = info.bodyStart - 1;
    const needle = `${name}=`;
    let at = 1;
    while (at < tagsEnd) {
        const next = line.indexOf(";", at);
        const stop = next === -1 || next > tagsEnd ? tagsEnd : next;
        if (line.startsWith(needle, at)) return line.slice(at + needle.length, stop);
        at = stop + 1;
    }
    return undefined;
}

/** Who said what, as the chat log of the hub keeps it. */
export interface ChatMessage {
    /** Login of the sender; a USERNOTICE names it in a tag instead of the prefix. */
    login: string | undefined;
    /** Empty when a USERNOTICE, such as a subscription, came without words. */
    text: string;
}

/** Reads a PRIVMSG or USERNOTICE. Twitch always marks the text with a colon. */
export function chatMessage(line: string, info: IrcLineInfo): ChatMessage {
    let login = tagValue(line, info, "login");
    if (line.charCodeAt(info.bodyStart) === COLON) {
        const bang = line.indexOf("!", info.bodyStart);
        const space = line.indexOf(" ", info.bodyStart);
        if (bang !== -1 && bang < space) login = line.slice(info.bodyStart + 1, bang);
    }
    const text = line.indexOf(" :", info.bodyStart);
    return { login, text: text === -1 ? "" : line.slice(text + 2) };
}

/** Inserts a tag in front of the existing ones, or starts a tag section. */
export function withTag(line: string, tag: string): string {
    return line.charCodeAt(0) === AT ? `@${tag};${line.slice(1)}` : `@${tag} ${line}`;
}
