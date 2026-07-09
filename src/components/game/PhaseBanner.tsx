'use client';

import type { GamePhase } from '@/lib/game/types';

interface PhaseBannerProps {
  phase: GamePhase;
  activeActorName: string;
  canIControl: boolean;
  turnCount: number;
  mySetupReady: boolean;
  isLocalGuest: boolean;
  setupCommitted: boolean;
}

export function PhaseBanner({
  phase,
  activeActorName,
  canIControl,
  turnCount,
  mySetupReady,
  isLocalGuest,
  setupCommitted,
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
    if (canIControl) {
      detail = '主要行動 · 三選一';
    } else {
      detail = `${activeActorName} 行動中`;
      colorClass = 'text-foreground/50';
    }
  } else if (phase === 'extra_action') {
    label = `第 ${turnCount} 回合`;
    if (canIControl) {
      detail = '額外行動 · 四選一或跳過';
      colorClass = 'text-sky-300';
    } else {
      detail = `${activeActorName} 行動中`;
      colorClass = 'text-foreground/50';
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
          <span className="text-foreground/55 truncate max-w-[12rem]">{detail}</span>
        </>
      )}
    </div>
  );
}
