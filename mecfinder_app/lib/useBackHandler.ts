"use client";

import { useEffect, useRef } from 'react';
import { pushBackHandler } from './backButton';

/**
 * Intercept the Android hardware back button while `active` is true.
 *
 * Use for modals / bottom sheets so that pressing back closes the overlay
 * instead of navigating away or exiting the app (native behavior).
 *
 *   useBackHandler(isOpen, () => setOpen(false));
 */
export function useBackHandler(active: boolean, handler: () => void) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!active) return;
    // Register a stable wrapper that always calls the latest handler,
    // so it only re-registers when `active` flips.
    return pushBackHandler(() => handlerRef.current());
  }, [active]);
}
