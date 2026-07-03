// Tiny event bus to let external UI drive the 3D viewport without prop drilling
// a ref into the R3F canvas subtree.
export type ViewportAction =
  | "rotate-left"
  | "rotate-right"
  | "zoom-in"
  | "zoom-out"
  | "pan-toggle"
  | "reset";

type Handler = (a: ViewportAction) => void;
const handlers = new Set<Handler>();

export function emitViewport(a: ViewportAction) {
  handlers.forEach((h) => h(a));
}
export function subscribeViewport(h: Handler) {
  handlers.add(h);
  return () => {
    handlers.delete(h);
  };
}
