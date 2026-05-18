import { useCallback, useRef, useSyncExternalStore } from 'react';

export type ScrollEdges = {
  hasOverflow: boolean;
  canScrollLeft: boolean;
  canScrollRight: boolean;
};

const EMPTY: ScrollEdges = {
  hasOverflow: false,
  canScrollLeft: false,
  canScrollRight: false,
};

/**
 * Track whether a horizontally scrollable element can scroll further
 * left or right. Subscribes to scroll, size, and child-list changes so
 * the state stays accurate as tabs are added or removed.
 *
 * Built on useSyncExternalStore so React reads layout directly from
 * the DOM at the right time — no setState in an effect, no extra
 * renders to converge on the snapshot. The cached-snapshot pattern
 * makes sure equal reads return the same object reference, so the
 * tearing check in useSyncExternalStore doesn't loop.
 *
 * 1-pixel slack on the right edge so subpixel layout rounding doesn't
 * leave canScrollRight stuck true at the actual end.
 */
export function useHorizontalScrollEdges(el: HTMLElement | null): ScrollEdges {
  const cachedRef = useRef<ScrollEdges>(EMPTY);

  const subscribe = useCallback(
    (onChange: () => void) => {
      if (el == null) return () => {};
      el.addEventListener('scroll', onChange);
      const ro = new ResizeObserver(onChange);
      ro.observe(el);
      const mo = new MutationObserver(onChange);
      mo.observe(el, { childList: true, subtree: true });
      return () => {
        el.removeEventListener('scroll', onChange);
        ro.disconnect();
        mo.disconnect();
      };
    },
    [el],
  );

  const getSnapshot = useCallback((): ScrollEdges => {
    if (el == null) {
      if (cachedRef.current !== EMPTY) cachedRef.current = EMPTY;
      return cachedRef.current;
    }
    const hasOverflow = el.scrollWidth > el.clientWidth;
    const canScrollLeft = el.scrollLeft > 0;
    const canScrollRight = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    const prev = cachedRef.current;
    if (
      prev.hasOverflow === hasOverflow &&
      prev.canScrollLeft === canScrollLeft &&
      prev.canScrollRight === canScrollRight
    ) {
      return prev;
    }
    const next: ScrollEdges = { hasOverflow, canScrollLeft, canScrollRight };
    cachedRef.current = next;
    return next;
  }, [el]);

  return useSyncExternalStore(subscribe, getSnapshot);
}
