'use client';

import type { GamePhase } from '@/lib/game/types';
import { shortPhaseLabel } from '@/lib/game/ui-step';
import { TurnTimer } from './TurnTimer';

interface PhaseBannerProps {
  phase: GamePhase;
  canIControl: boolean;
  turnCount: number;
  phaseDeadlineAt?: number;
  onTimerExpire?: () => void;
}

export function PhaseBanner({
  phase,
  canIControl,
  turnCount,
  phaseDeadlineAt,
  onTimerExpire,
}: PhaseBannerProps) {
  const showTimer =
    (phase === 'main_action' || phase === 'extra_action') &&
    !!phaseDeadlineAt;

  return (
    <div className="phase-banner">
      <span className="phase-banner__turn">R{turnCount}</span>
      <span className={`phase-banner__phase ${canIControl ? 'phase-banner__phase--active' : ''}`}>
        {shortPhaseLabel(phase)}
      </span>
      {showTimer && phaseDeadlineAt && (
        <TurnTimer
          deadlineAt={phaseDeadlineAt}
          onExpire={canIControl ? onTimerExpire : undefined}
          active={canIControl}
        />
      )}
      {!canIControl && phase !== 'finished' && phase !== 'setup' && (
        <span className="phase-banner__wait">對手</span>
      )}
    </div>
  );
}
