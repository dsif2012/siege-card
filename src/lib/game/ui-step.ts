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

export type BreachGuideStep = 'wait' | 'hand' | 'wall' | 'confirm';

export function computeBreachGuide(params: {
  canIControl: boolean;
  selectedHandCount: number;
  selectedWallIndex: number | null;
  breachedWallIndex: number;
}): { step: BreachGuideStep; message: string; stepNo: number } {
  const { canIControl, selectedHandCount, selectedWallIndex, breachedWallIndex } = params;
  const tierName = ['首關', '二關', '本丸'][breachedWallIndex] ?? '城牆';

  if (!canIControl) {
    return { step: 'wait', message: '對手正在緊急補防…', stepNo: 0 };
  }
  if (selectedHandCount < 1) {
    return {
      step: 'hand',
      message: `城牆被破！請從手牌選 1～2 張防守牌（也可按「略過」）`,
      stepNo: 1,
    };
  }
  if (selectedWallIndex === null) {
    return {
      step: 'wall',
      message: `點擊未破的城牆層放置（${tierName}已毀，不可再放）`,
      stepNo: 2,
    };
  }
  return {
    step: 'confirm',
    message: '按右下角「補防」確認；可再選第二張牌後一次補上',
    stepNo: 3,
  };
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
