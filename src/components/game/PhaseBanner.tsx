'use client';

import type { GamePhase } from '@/lib/game/types';
import type { MainActionIntent } from './ActionDock';

interface PhaseBannerProps {
  phase: GamePhase;
  activeActorName: string;
  canIControl: boolean;
  turnCount: number;
  mySetupReady: boolean;
  isLocalGuest: boolean;
  setupCommitted: boolean;
  mainActionIntent?: MainActionIntent;
  extraActionType?: 'scout' | 'disrupt' | 'none';
}

export function PhaseBanner({
  phase,
  activeActorName,
  canIControl,
  turnCount,
  setupCommitted,
  mainActionIntent = null,
  extraActionType = 'none',
}: PhaseBannerProps) {
  let label = '';
  let detail = '';
  let colorClass = 'text-yamabuki-gold';

  if (phase === 'setup') {
    if (setupCommitted) {
      label = '已就緒';
      detail = '等待對手完成配置';
      colorClass = 'text-sky-300';
    } else {
      label = '開局配置';
      detail = '牆×3 ＋ 攻×2';
    }
  } else if (phase === 'main_action') {
    label = `第 ${turnCount} 回合`;
    if (!canIControl) {
      detail = `${activeActorName} 行動中`;
      colorClass = 'text-foreground/50';
    } else if (!mainActionIntent) {
      detail = '① 先選主要行動';
    } else if (mainActionIntent === 'attack') {
      detail = '攻擊牌 · 選手牌後確認';
      colorClass = 'text-shiko-red';
    } else if (mainActionIntent === 'defense') {
      detail = '防守牌 · 選手牌＋城牆';
      colorClass = 'text-sky-300';
    } else {
      detail = '蓄力 · 確認即可';
    }
  } else if (phase === 'extra_action') {
    label = `第 ${turnCount} 回合`;
    if (!canIControl) {
      detail = `${activeActorName} 行動中`;
      colorClass = 'text-foreground/50';
    } else if (extraActionType === 'scout') {
      detail = '偵查 · 選對手蓋牌';
      colorClass = 'text-sky-300';
    } else if (extraActionType === 'disrupt') {
      detail = '破勢 · 選蓋牌＋攻擊牌';
      colorClass = 'text-sky-300';
    } else {
      detail = '① 先選額外行動或結束';
      colorClass = 'text-sky-300';
    }
  } else if (phase === 'wall_breached_response') {
    label = '防禦突破';
    detail = '緊急補防 · 選牌＋選牆';
    colorClass = 'text-shiko-red';
  } else if (phase === 'finished') {
    label = '合戰結束';
    detail = '';
    colorClass = 'text-shiko-red';
  }

  return (
    <div className="phase-banner">
      <span className={`font-serif font-black tracking-widest ${colorClass}`}>{label}</span>
      {detail && (
        <>
          <span className="text-foreground/20">·</span>
          <span className="text-foreground/55 truncate max-w-[16rem]">{detail}</span>
        </>
      )}
    </div>
  );
}
