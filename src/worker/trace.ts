import { tracing } from "cloudflare:workers";

/**
 * What the code adds to the trace span of a request, so traces can be filtered by it. Fixed
 * words and numbers only, the same that `analytics.ts` counts: never a channel, a client
 * address, a user name or a line of chat.
 *
 * | attribute               | value                                             |
 * | ----------------------- | ------------------------------------------------- |
 * | `petal.route`           | `page`, `irc`, `data`, `status` or `unknown`      |
 * | `petal.refusal`         | the error code of a refusal, as in the body       |
 * | `petal.shard`           | the hub a chat connection was sent to             |
 * | `petal.gateway.route`   | route id of the data gateway                      |
 * | `petal.gateway.outcome` | cache status of the gateway's answer              |
 * | `petal.gateway.layer`   | cache layer that answered                         |
 */
export type TraceAttributes = Record<string, boolean | number | string | undefined>;

/**
 * Sets attributes on the active span. Does nothing for a request that is not traced and never
 * throws: tracing must not be able to break what it traces.
 */
export function annotate(attributes: TraceAttributes): void {
    try {
        tracing.getActiveSpan()?.setAttributes(attributes);
    } catch {
        // A span that has ended, or a runtime without tracing.
    }
}
