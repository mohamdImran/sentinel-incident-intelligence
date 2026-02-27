import { useEffect, useRef, useState } from 'react';

function easeOutExpo(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

interface CountUpProps {
  to: number;
  from?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  durationMs?: number;
  className?: string;
  trigger?: boolean;
}

export function CountUp({
  to,
  from = 0,
  decimals = 0,
  prefix = '',
  suffix = '',
  durationMs = 1400,
  className = '',
  trigger = true,
}: CountUpProps) {
  const [value, setValue] = useState(from);
  const startTimeRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const hasTriggered = useRef(false);

  useEffect(() => {
    if (!trigger || hasTriggered.current) return;
    hasTriggered.current = true;

    const animate = (time: number) => {
      if (startTimeRef.current === null) startTimeRef.current = time;
      const elapsed = time - startTimeRef.current;
      const progress = Math.min(1, elapsed / durationMs);
      const easedProgress = easeOutExpo(progress);
      const current = from + (to - from) * easedProgress;
      setValue(current);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        setValue(to);
      }
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [trigger, to, from, durationMs]);

  const formatted = value.toFixed(decimals);

  return (
    <span className={`font-numeric animate-number-pop ${className}`}>
      {prefix}{formatted}{suffix}
    </span>
  );
}
