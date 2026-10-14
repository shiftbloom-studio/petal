export interface GifRange {
    start: number;
    end: number;
    url: string;
}

/** Only direct GIF files on the providers' image hosts, never pages or arbitrary URLs. */
export function isGifUrl(value: string, twitch = false): boolean {
    if (value.length > 4096 || /[\s\\]/.test(value)) return false;
    const url = URL.parse(value);
    if (
        url?.protocol !== "https:" ||
        url.username ||
        url.password ||
        url.port ||
        url.hash ||
        !/^\/[a-zA-Z0-9/_.~-]+\.gif$/.test(url.pathname)
    )
        return false;
    return (
        /^(?:media[0-4]?|i)\.giphy\.com$/.test(url.hostname) ||
        (!twitch && url.hostname === "media.tenor.com")
    );
}

/** Twitch IRC `gifs`: inclusive code point ranges, GIF id, and the unmodified media URL. */
export function parseGifsTag(tag: string | undefined): GifRange[] {
    return (tag ?? "").split(",").flatMap((entry) => {
        const match = /^(\d+)-(\d+)\|[a-zA-Z0-9]+\|(.+)$/.exec(entry);
        if (!match || !isGifUrl(match[3], true)) return [];
        const start = Number(match[1]);
        const end = Number(match[2]);
        return Number.isSafeInteger(start) && Number.isSafeInteger(end) && end >= start
            ? [{ start, end, url: match[3] }]
            : [];
    });
}
