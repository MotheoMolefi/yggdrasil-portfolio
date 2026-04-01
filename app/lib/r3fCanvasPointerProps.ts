/**
 * @react-three/fiber calls `events.connect(target)` during `onCreated`. Passing a
 * ref (`eventSource={ref}`) can still leave `ref.current === null` at that moment,
 * which throws when calling `target.addEventListener`.
 *
 * Subscribing on `document.body` is always valid in the browser; `eventPrefix="client"`
 * matches coordinates for a non-canvas event target (see R3F Canvas docs).
 */
export function r3fCanvasPointerProps(): {
  eventSource: HTMLElement
  eventPrefix: 'client'
} {
  return { eventSource: document.body, eventPrefix: 'client' }
}
