import { useEffect, useRef, useState } from "react";

/**
 * Smart lazy-loading hook. Reveals items in chunks as the user scrolls
 * near the bottom of the page. Avoids rendering thousands of nodes at once.
 */
export function useInfiniteScroll<T>(items: T[], pageSize = 18) {
  const [visibleCount, setVisibleCount] = useState(pageSize);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Reset when the underlying list changes (e.g. category filter)
  useEffect(() => {
    setVisibleCount(pageSize);
  }, [items, pageSize]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    if (visibleCount >= items.length) return;

    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((c) => Math.min(c + pageSize, items.length));
        }
      },
      { rootMargin: "600px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [items.length, visibleCount, pageSize]);

  return {
    visible: items.slice(0, visibleCount),
    hasMore: visibleCount < items.length,
    sentinelRef,
  };
}
