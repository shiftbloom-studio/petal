export const WorkerLogEvent = {
    upstreamUnavailable: "upstream_unavailable",
    hubUnavailable: "hub_unavailable",
} as const;

export type WorkerLogEventName = (typeof WorkerLogEvent)[keyof typeof WorkerLogEvent];

export function logWorkerEvent(
    level: "warn" | "error",
    event: WorkerLogEventName,
    fields: Readonly<Record<string, string | number>>,
): void {
    const body = Object.entries(fields)
        .map(([key, value]) => `${key}=${value}`)
        .join(" ");
    const line = body.length > 0 ? `${event} ${body}` : event;
    if (level === "error") console.error(line);
    else console.warn(line);
}
