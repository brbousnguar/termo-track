import { useCallback, useEffect, useRef, useState } from "react";

export type PullState = "idle" | "pulling" | "ready" | "refreshing";

export function usePullToRefresh(onRefresh: () => void) {
  const [pullState, setPullState] = useState<PullState>("idle");
  const [pullDistance, setPullDistance] = useState(0);
  const startY = useRef(0);
  const pulling = useRef(false);
  const isTouchDevice = useRef(false);

  const THRESHOLD = 80;

  const reset = useCallback(() => {
    setPullState("idle");
    setPullDistance(0);
    pulling.current = false;
  }, []);

  useEffect(() => {
    isTouchDevice.current = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    if (!isTouchDevice.current) return;

    const onTouchStart = (e: TouchEvent) => {
      if (window.scrollY > 0) return; // Only at the top of the page
      if (pullState === "refreshing") return;
      startY.current = e.touches[0].clientY;
      pulling.current = true;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!pulling.current || pullState === "refreshing") return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy <= 0) {
        setPullDistance(0);
        setPullState("idle");
        return;
      }
      // Prevent native pull-to-refresh / overscroll
      if (window.scrollY <= 0 && dy > 0) {
        e.preventDefault();
      }
      setPullDistance(Math.min(dy, THRESHOLD * 1.5));
      setPullState(dy >= THRESHOLD ? "ready" : "pulling");
    };

    const onTouchEnd = () => {
      if (!pulling.current) return;
      pulling.current = false;
      if (pullState === "ready") {
        setPullState("refreshing");
        onRefresh();
        setTimeout(reset, 1200);
      } else {
        reset();
      }
    };

    // Use { passive: false } so preventDefault works on touchmove
    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
    };
  }, [pullState, onRefresh, reset]);

  return { pullState, pullDistance };
}
