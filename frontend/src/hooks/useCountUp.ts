import { useEffect, useRef, useState } from "react";

// Smoothly tweens a displayed number toward `target` with requestAnimationFrame.
// Used for the hero temperature so new readings glide in instead of snapping.
export function useCountUp(target: number | null, durationMs = 700): number | null {
  const [value, setValue] = useState<number | null>(target);
  const fromRef = useRef<number>(target ?? 0);
  const startRef = useRef<number>(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (target === null) {
      setValue(null);
      return;
    }
    // First real value: appear instantly, no tween from 0.
    if (value === null) {
      fromRef.current = target;
      setValue(target);
      return;
    }

    const from = value;
    fromRef.current = from;
    startRef.current = performance.now();

    const tick = (t: number) => {
      const p = Math.min(1, (t - startRef.current) / durationMs);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      setValue(fromRef.current + (target - fromRef.current) * eased);
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, durationMs]);

  return value;
}
