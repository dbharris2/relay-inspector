import { useEffect } from 'react';

/**
 * Attach a wheel handler to `el` that redirects vertical wheel input
 * to horizontal scroll. Native trackpad horizontal gestures
 * (deltaX != 0) pass through untouched, and the redirect only kicks in
 * when the container actually has horizontal overflow.
 *
 * Pass the element via state (e.g. `useState<HTMLDivElement | null>`
 * + `ref={setEl}`) rather than `useRef`, so the effect re-runs when
 * the element actually mounts. With `useRef`, an effect whose deps
 * are `[]` would attach once with a null ref and never re-run for the
 * eventual mount.
 */
export function useWheelHorizontalScroll<T extends HTMLElement>(
  el: T | null,
): void {
  useEffect(() => {
    if (el == null) return;

    const onWheel = (e: WheelEvent) => {
      if (e.deltaX !== 0) return;
      if (e.deltaY === 0) return;
      if (el.scrollWidth <= el.clientWidth) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [el]);
}
