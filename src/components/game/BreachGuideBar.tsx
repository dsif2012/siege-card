'use client';

import type { BreachGuideStep } from '@/lib/game/ui-step';
import { ShieldAlert } from 'lucide-react';

interface BreachGuideBarProps {
  step: BreachGuideStep;
  stepNo: number;
  message: string;
  breachedWallName: string;
  canIControl: boolean;
}

const STEP_LABELS = ['', '選手牌', '選城牆', '確認補防'];

export function BreachGuideBar({
  step,
  stepNo,
  message,
  breachedWallName,
  canIControl,
}: BreachGuideBarProps) {
  return (
    <div
      className={`breach-guide ${canIControl ? 'breach-guide--active' : ''}`}
      role="status"
      aria-live="polite"
    >
      <div className="breach-guide__icon" aria-hidden>
        <ShieldAlert size={18} strokeWidth={2.25} />
      </div>
      <div className="breach-guide__body">
        <div className="breach-guide__head">
          <span className="breach-guide__tag">城破補防</span>
          <span className="breach-guide__breach">{breachedWallName} 已被攻破</span>
          {canIControl && stepNo > 0 && (
            <span className="breach-guide__step">
              步驟 {stepNo}/3 · {STEP_LABELS[stepNo]}
            </span>
          )}
        </div>
        <p className="breach-guide__message">{message}</p>
      </div>
    </div>
  );
}
