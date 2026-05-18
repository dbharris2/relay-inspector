import { useEffect, useState } from 'react';

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
 * left or right. Updates on scroll, on size changes (ResizeObserver),
 * and on child changes (MutationObserver) so the state stays accurate
 * as tabs are added or removed.
 *
 * 1-pixel slack on the right edge so subpixel layout rounding doesn't
 * leave `canScrollRight` stuck true at the actual end.
 */
export function useHorizontalScrollEdges(el: HTMLElement | null): ScrollEdges {
  const [edges, setEdges] = useState<ScrollEdges>(EMPTY);

  useEffect(() => {
    if (el == null) {
      setEdges(EMPTY);
      return;
    }

    const update = () => {
      const hasOverflow = el.scrollWidth > el.clientWidth;
      const canScrollLeft = el.scrollLeft > 0;
      const canScrollRight =
        el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
      setEdges({ hasOverflow, canScrollLeft, canScrollRight });
    };

    update();
    el.addEventListener('scroll', update);
    const ro = new ResizeObserver(update);
    ro.observe(el);
    const mo = new MutationObserver(update);
    mo.observe(el, { childList: true, subtree: true });

    return () => {
      el.removeEventListener('scroll', update);
      ro.disconnect();
      mo.disconnect();
    };
  }, [el]);

  return edges;
}
