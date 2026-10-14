import { createEffect, createSignal, onCleanup, onMount, Show } from "solid-js";

import type { GifPart } from "~/lib/chat/tokenize";
import { loadGif } from "~/lib/overlay/gifs";

import styles from "./Chat.module.css";

/** A slot keeps its size while off screen; only visible GIFs own a download or a blob URL. */
export default function GifView(props: { part: GifPart; faded: boolean }) {
    let slot!: HTMLSpanElement;
    const [visible, setVisible] = createSignal(false);
    const [failed, setFailed] = createSignal(false);
    const [source, setSource] = createSignal<string>();
    const [size, setSize] = createSignal({ width: 240, height: 180 });

    onMount(() => {
        const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
        observer.observe(slot);
        onCleanup(() => observer.disconnect());
    });

    createEffect(() => {
        if (!visible() || props.faded || failed()) return;
        const controller = new AbortController();
        let objectUrl: string | undefined;
        onCleanup(() => {
            controller.abort();
            setSource(undefined);
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        });
        void loadGif(props.part.url, controller.signal).then(
            ({ blob, width, height }) => {
                if (controller.signal.aborted) return;
                setSize({ width, height });
                objectUrl = URL.createObjectURL(blob);
                setSource(objectUrl);
            },
            () => {
                if (!controller.signal.aborted) setFailed(true);
            },
        );
    });

    return (
        <span
            ref={slot}
            class={failed() ? undefined : styles.gif}
            style={
                failed()
                    ? undefined
                    : {
                          width: `${Math.min(320, size().width, (240 * size().width) / size().height)}px`,
                          "aspect-ratio": `${size().width} / ${size().height}`,
                      }
            }
        >
            <Show when={!failed()} fallback={props.part.text}>
                <Show when={source()}>
                    {(url) => (
                        <img
                            src={url()}
                            alt={props.part.text}
                            decoding="async"
                            onError={() => setFailed(true)}
                        />
                    )}
                </Show>
            </Show>
        </span>
    );
}
