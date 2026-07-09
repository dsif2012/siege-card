import type { GamePhase } from './types';

export type MainActionIntent = 'attack' | 'defense' | 'charge' | null;

export type SpotlightTarget =
  | 'actions'
  | 'hand'
  | 'ally-wall'
  | 'enemy-wall'
  | 'attack-zone'
  | null;

export function computeSpotlight(params: {
  phase: GamePhase;
  canIControl: boolean;
  mainActionIntent: MainActionIntent;
  extraActionType: 'scout' | 'disrupt' | 'none';
  selectedHandCount: number;
  selectedWallIndex: number | null;
  selectedOpponentCardCount: number;
  selectedDisruptAttackCount: number;
  hasDoneExtraAction: boolean;
}): SpotlightTarget {
  const {
    phase,
    canIControl,
    mainActionIntent,
    extraActionType,
    selectedHandCount,
    selectedWallIndex,
    selectedOpponentCardCount,
    selectedDisruptAttackCount,
    hasDoneExtraAction,
  } = params;

  if (!canIControl) return null;

  if (phase === 'main_action') {
    if (!mainActionIntent) return 'actions';
    if (mainActionIntent === 'attack') return 'hand';
    if (mainActionIntent === 'defense') {
      if (selectedHandCount < 1) return 'hand';
      if (selectedWallIndex === null) return 'ally-wall';
      return null;
    }
    return null;
  }

  if (phase === 'extra_action' && !hasDoneExtraAction) {
    if (extraActionType === 'none') return 'actions';
    if (extraActionType === 'scout') return 'enemy-wall';
    if (extraActionType === 'disrupt') {
      if (selectedOpponentCardCount < 1) return 'enemy-wall';
      if (selectedDisruptAttackCount < 1) return 'attack-zone';
      return null;
    }
  }

  if (phase === 'wall_breached_response') {
    if (selectedHandCount < 1) return 'hand';
    if (selectedWallIndex === null) return 'ally-wall';
    return null;
  }

  return null;
}

export function shortPhaseLabel(phase: GamePhase): string {
  switch (phase) {
    case 'setup': return '配置';
    case 'main_action': return '主回合';
    case 'extra_action': return '額外';
    case 'wall_breached_response': return '補防';
    case 'finished': return '結束';
    default: return '';
  }
}

/** 戰軸中央面板用，語意較完整 */
export function hubPhaseLabel(phase: GamePhase): string {
  switch (phase) {
    case 'setup': return '戰前配置';
    case 'main_action': return '主回合';
    case 'extra_action': return '額外攻城';
    case 'wall_breached_response': return '破城補防';
    case 'finished': return '對局結束';
    default: return '';
  }
}
