// A tiny stack-based registry so overlays (modals, bottom sheets, drawers)
// can intercept the Android hardware back button before it navigates or exits.
//
// The most recently opened overlay is the first to receive "back", which is
// exactly how a native Android app behaves: back closes the top-most thing.

type BackHandler = () => void;

const stack: BackHandler[] = [];

/**
 * Register a handler to receive the next hardware "back" press.
 * Returns an unregister function — call it when the overlay closes/unmounts.
 */
export function pushBackHandler(handler: BackHandler): () => void {
  stack.push(handler);
  return () => {
    const idx = stack.lastIndexOf(handler);
    if (idx !== -1) stack.splice(idx, 1);
  };
}

/**
 * Run the top-most registered back handler, if any.
 * Returns true when a handler consumed the back press.
 */
export function runTopBackHandler(): boolean {
  const handler = stack[stack.length - 1];
  if (handler) {
    handler();
    return true;
  }
  return false;
}
