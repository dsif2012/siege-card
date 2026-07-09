'use client';

import { useEffect, useRef, useState } from 'react';

interface TurnTimerProps {
  deadlineAt: number;
  onExpire?: () => void;
  active?: boolean;
  compact?: boolean;
}

export function TurnTimer({ deadlineAt, onExpire, active = true, compact = false }: TurnTimerProps) {
  const [remainingMs, setRemainingMs] = useState(() => Math.max(0, deadlineAt - Date.now()));
  const expiredRef = useRef(false);

  useEffect(() => {
    expiredRef.current = false;
  }, [deadlineAt]);

  useEffect(() => {
    const tick = () => {
      const left = Math.max(0, deadlineAt - Date.now());
      setRemainingMs(left);
      if (left <= 0 && active && onExpire && !expiredRef.current) {
        expiredRef.current = true;
        onExpire();
      }
    };
    tick();
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [deadlineAt, onExpire, active]);

  const totalMs = 30_000;
  const secs = Math.ceil(remainingMs / 1000);
  const progress = Math.min(1, remainingMs / totalMs);
  const urgent = secs <= 5;
  const circumference = 2 * Math.PI * 14;
  const dash = circumference * progress;

  return (
    <div
      className={`turn-timer ${urgent ? 'turn-timer--urgent' : ''} ${compact ? 'turn-timer--compact' : ''}`}
      aria-label={`剩餘 ${secs} 秒`}
    >
      <svg width={compact ? 28 : 36} height={compact ? 28 : 36} viewBox="0 0 36 36" className="turn-timer__ring">
        <circle cx="18" cy="18" r="14" className="turn-timer__track" />
        <circle
          cx="18"
          cy="18"
          r="14"
          className="turn-timer__progress"
          strokeDasharray={`${dash} ${circumference}`}
          transform="rotate(-90 18 18)"
        />
      </svg>
      <span className="turn-timer__label">{secs}</span>
    </div>
  );
}
