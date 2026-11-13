const URL_TEXT = /https?:\/\/\S+/g;
const QUERY_TEXT = /\?[^ \n]*/g;

type LogValue = string | number;

export function logSafeCause(error: unknown): string {
    const name = error instanceof Error ? error.name : "Error";
    const message = error instanceof Error ? error.message : "";
    const detail = message.replace(URL_TEXT, "").replace(QUERY_TEXT, "").trim();
    return detail.length > 0 ? `${name}: ${detail}` : name;
}

export const PlatformEvent = {
    HubUnavailable: "hub_unavailable",
    HubStatusUnavailable: "hub_status_unavailable",
    ApiFailed: "api_failed",
} as const;

export type PlatformEvent = (typeof PlatformEvent)[keyof typeof PlatformEvent];

export class PlatformError extends Error {
    readonly event: PlatformEvent;
    readonly fields: Readonly<Record<string, LogValue>>;

    constructor(event: PlatformEvent, cause: unknown, fields: Record<string, LogValue> = {}) {
        super(logSafeCause(cause));
        this.name = "PlatformError";
        this.event = event;
        this.fields = fields;
    }
}

function eventRecord(
    message: string,
    fields: Record<string, LogValue | undefined>,
): Record<string, LogValue> {
    const record: Record<string, LogValue> = { message };
    for (const [key, value] of Object.entries(fields)) {
        if (value !== undefined) record[key] = value;
    }
    return record;
}

function logError(message: string, fields: Record<string, LogValue | undefined> = {}): void {
    console.error(JSON.stringify(eventRecord(message, fields)));
}

export function logWarning(
    message: string,
    fields: Record<string, LogValue | undefined> = {},
): void {
    console.warn(JSON.stringify(eventRecord(message, fields)));
}

export function logPlatformError(error: PlatformError): void {
    logError(error.event, { ...error.fields, cause: error.message });
}
