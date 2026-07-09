'use client';

import type { ReactNode } from 'react';
import type { GamePhase } from '@/lib/game/types';
import { Sword, Swords, Shield, Sparkles, Layers, Eye, Zap } from 'lucide-react';

export type MainActionIntent = 'attack' | 'defense' | 'charge' | null;

export interface ActionDockProps {
  phase: GamePhase;
  canIControl: boolean;
  spotlight: string | null;

  mainActionIntent: MainActionIntent;
  setMainActionIntent: (intent: MainActionIntent) => void;
  hasDoneExtraAction: boolean;
  turnCount: number;

  extraActionType: 'scout' | 'disrupt' | 'none';
  setExtraActionType: (type: 'scout' | 'disrupt' | 'none') => void;
  onClearSelections: () => void;

  onDraw2: () => void;
  onAttack: () => void;
  onEndTurn: () => void;

  isBreachPhase: boolean;
  winnerEmail: string;
  onRestart: () => void;
}

function ActionIcon({
  label,
  icon,
  onClick,
  disabled,
  selected,
}: {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  selected?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`action-icon ${selected ? 'action-icon--selected' : ''}`}
      aria-label={label}
    >
      <span className="action-icon__glyph">{icon}</span>
      <span className="action-icon__label">{label}</span>
    </button>
  );
}

export function ActionDock(props: ActionDockProps) {
  const {
    phase,
    canIControl,
    spotlight,
    mainActionIntent,
    setMainActionIntent,
    hasDoneExtraAction,
    turnCount,
    extraActionType,
    setExtraActionType,
    onClearSelections,
    onDraw2,
    onAttack,
    onEndTurn,
    isBreachPhase,
    winnerEmail,
    onRestart,
  } = props;

  const pickMainIntent = (intent: Exclude<MainActionIntent, null>) => {
    onClearSelections();
    setMainActionIntent(intent);
  };

  if (phase === 'finished') {
    return (
      <div className="action-dock action-dock--finished">
        <span className="action-dock__winner">{winnerEmail} 勝</span>
        <button type="button" onClick={onRestart} className="btn-danger action-dock__restart">
          再戰
        </button>
      </div>
    );
  }

  if (isBreachPhase || phase === 'setup') {
    return null;
  }

  const showMainPick = phase === 'main_action' && !mainActionIntent && canIControl;
  const showExtraPick =
    phase === 'extra_action' &&
    extraActionType === 'none' &&
    canIControl &&
    !hasDoneExtraAction;

  if (!showMainPick && !showExtraPick) {
    return null;
  }

  return (
    <div
      className={`action-strip ${spotlight === 'actions' ? 'spotlight' : ''}`}
      role="toolbar"
      aria-label="行動選擇"
    >
      {showMainPick && (
        <>
          <ActionIcon
            label="攻"
            icon={<Sword className="w-5 h-5" />}
            onClick={() => pickMainIntent('attack')}
          />
          <ActionIcon
            label="防"
            icon={<Shield className="w-5 h-5" />}
            onClick={() => pickMainIntent('defense')}
          />
          <ActionIcon
            label="蓄"
            icon={<Sparkles className="w-5 h-5" />}
            onClick={() => pickMainIntent('charge')}
          />
        </>
      )}

      {showExtraPick && (
        <>
          <ActionIcon
            label="抽"
            icon={<Layers className="w-5 h-5" />}
            onClick={onDraw2}
          />
          <ActionIcon
            label="城"
            icon={<Swords className="w-5 h-5" />}
            onClick={onAttack}
            disabled={turnCount === 1}
          />
          <ActionIcon
            label="偵"
            icon={<Eye className="w-5 h-5" />}
            onClick={() => {
              onClearSelections();
              setExtraActionType('scout');
            }}
          />
          <ActionIcon
            label="破"
            icon={<Zap className="w-5 h-5" />}
            onClick={() => {
              onClearSelections();
              setExtraActionType('disrupt');
            }}
          />
          <button type="button" onClick={onEndTurn} className="action-icon action-icon--end">
            <span className="action-icon__label">結束</span>
          </button>
        </>
      )}
    </div>
  );
}
