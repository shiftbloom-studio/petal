/** Stand-in for the base class of the Workers runtime; the tests only drive the hub's core. */
export class DurableObject {}

type Attributes = Record<string, boolean | number | string | undefined>;

/** Stand-in for the runtime's tracing. Without a call to `traceRequest` no request is traced. */
let active: { setAttributes(attributes: Attributes): void } | undefined;

export const tracing = { getActiveSpan: () => active };

/** Starts a span that stays active until the next call, and returns what is set on it. */
export function traceRequest(): Attributes {
    const attributes: Attributes = {};
    active = { setAttributes: (added) => void Object.assign(attributes, added) };
    return attributes;
}

/** A span that refuses attributes, as one that has ended may. */
export function traceBroken(): void {
    active = {
        setAttributes: () => {
            throw new Error("span has ended");
        },
    };
}

export function traceNothing(): void {
    active = undefined;
}
