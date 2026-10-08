import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type UIEvent,
} from "react";

interface VirtualListOptions {
  itemCount: number;
  itemHeight: number;
  overscan?: number;
  threshold?: number;
  defaultViewportHeight?: number;
}

export function useVirtualList({
  itemCount,
  itemHeight,
  overscan = 5,
  threshold = 80,
  defaultViewportHeight = 640,
}: VirtualListOptions) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(defaultViewportHeight);
  const isVirtualized = itemCount > threshold;

  const measure = useCallback(() => {
    const height = containerRef.current?.clientHeight;

    if (height) {
      setViewportHeight(height);
    }
  }, []);

  useLayoutEffect(() => {
    if (!isVirtualized) {
      return;
    }

    measure();
    window.addEventListener("resize", measure);

    return () => window.removeEventListener("resize", measure);
  }, [isVirtualized, measure]);

  const handleScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
    setScrollTop(event.currentTarget.scrollTop);
  }, []);

  return useMemo(() => {
    if (!isVirtualized) {
      return {
        containerRef,
        endIndex: itemCount,
        handleScroll,
        isVirtualized,
        paddingAfter: 0,
        paddingBefore: 0,
        startIndex: 0,
      };
    }

    const firstVisible = Math.floor(scrollTop / itemHeight);
    const visibleCount = Math.ceil(viewportHeight / itemHeight);
    const startIndex = Math.max(0, firstVisible - overscan);
    const endIndex = Math.min(itemCount, firstVisible + visibleCount + overscan);

    return {
      containerRef,
      endIndex,
      handleScroll,
      isVirtualized,
      paddingAfter: Math.max(0, itemCount - endIndex) * itemHeight,
      paddingBefore: startIndex * itemHeight,
      startIndex,
    };
  }, [
    handleScroll,
    isVirtualized,
    itemCount,
    itemHeight,
    overscan,
    scrollTop,
    viewportHeight,
  ]);
}
