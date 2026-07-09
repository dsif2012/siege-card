'use client';

import type { GamePhase } from '@/lib/game/types';
import { Sword, Shield, Sparkles, Send, RotateCcw } from 'lucide-react';

export interface ActionDockProps {
  phase: GamePhase;
  canIControl: boolean;

  /* Setup */
  setupIsReady: boolean;
  setupCommitted: boolean;
  onSetupSubmit: () => void;

  /* Main action */
  onPlaceAttack: () => void;
  onPlaceDefense: () => void;
  onCharge: () => void;

  /* Extra action */
  extraActionType: 'scout' | 'disrupt' | 'none';
  setExtraActionType: (type: 'scout' | 'disrupt' | 'none') => void;
  hasDoneExtraAction: boolean;
  turnCount: number;
  onDraw2: () => void;
  onAttack: () => void;
  onScout: () => void;
  onDisrupt: () => void;
  onEndTurn: () => void;
  onClearSelections: () => void;

  /* Breach */
  isBreachPhase: boolean;
  onBreachResponse: () => void;
  onBreachSkip: () => void;

  /* Finished */
  winnerEmail: string;
  onRestart: () => void;

}

export function ActionDock(props: ActionDockProps) {
  const {
    phase, canIControl,
    setupIsReady, setupCommitted, onSetupSubmit,
    onPlaceAttack, onPlaceDefense, onCharge,
    extraActionType, setExtraActionType, hasDoneExtraAction, turnCount,
    onDraw2, onAttack, onScout, onDisrupt, onEndTurn, onClearSelections,
    isBreachPhase, onBreachResponse, onBreachSkip,
    winnerEmail, onRestart,
  } = props;

  return (
    <div className="action-dock">
      {/* Setup */}
      {phase === 'setup' && !setupCommitted && (
        setupIsReady && canIControl ? (
          <button onClick={onSetupSubmit} className="btn-primary flex-1 max-w-xs">確認部署</button>
        ) : (
          <span className="text-[9px] text-foreground/35 tracking-wider">拖放或點選卡牌至城牆與攻擊區</span>
        )
      )}

      {phase === 'setup' && setupCommitted && (
        <span className="text-[9px] text-sky-300/70 tracking-wider">已就緒 · 等待對手完成配置</span>
      )}

      {/* Main action */}
      {phase === 'main_action' && (
        <>
          <button onClick={onPlaceAttack} disabled={!canIControl} className="btn-ghost flex-1 flex items-center justify-center gap-1">
            <Sword className="w-3.5 h-3.5 text-shiko-red" /><span>攻擊牌</span>
          </button>
          <button onClick={onPlaceDefense} disabled={!canIControl} className="btn-ghost flex-1 flex items-center justify-center gap-1">
            <Shield className="w-3.5 h-3.5 text-sky-400" /><span>防守牌</span>
          </button>
          <button onClick={onCharge} disabled={!canIControl} className="btn-ghost flex-1 flex items-center justify-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-yamabuki-gold" /><span>蓄力</span>
          </button>
        </>
      )}

      {/* Extra action */}
      {phase === 'extra_action' && extraActionType === 'none' && (
        <>
          <button onClick={onDraw2} disabled={!canIControl || hasDoneExtraAction} className="btn-ghost flex-1 text-center">
            抽牌
          </button>
          <button onClick={onAttack} disabled={!canIControl || hasDoneExtraAction || turnCount === 1} className="btn-ghost flex-1 text-center">
            攻城
          </button>
          <button onClick={() => setExtraActionType('scout')} disabled={!canIControl || hasDoneExtraAction} className="btn-ghost flex-1 text-center">
            偵查
          </button>
          <button onClick={() => setExtraActionType('disrupt')} disabled={!canIControl || hasDoneExtraAction} className="btn-ghost flex-1 text-center">
            破勢
          </button>
          <button onClick={onEndTurn} disabled={!canIControl} className="btn-ghost w-full flex items-center justify-center gap-1">
            <Send className="w-3 h-3" /><span>結束回合</span>
          </button>
        </>
      )}

      {phase === 'extra_action' && extraActionType !== 'none' && (
        <>
          <span className="text-[9px] text-yamabuki-gold font-bold shrink-0">
            {extraActionType === 'scout' ? '【偵查】選蓋牌' : '【破勢】選蓋牌＋攻擊牌'}
          </span>
          <button
            onClick={extraActionType === 'scout' ? onScout : onDisrupt}
            className="btn-primary flex-1"
          >
            確定施法
          </button>
          <button
            onClick={() => { setExtraActionType('none'); onClearSelections(); }}
            className="btn-ghost"
          >
            取消
          </button>
        </>
      )}

      {/* Breach response */}
      {isBreachPhase && (
        <>
          <button onClick={onBreachResponse} disabled={!canIControl} className="btn-danger flex-1 flex items-center justify-center gap-1">
            <Shield className="w-3.5 h-3.5" /><span>派兵補防</span>
          </button>
          <button onClick={onBreachSkip} disabled={!canIControl} className="btn-ghost flex-1">
            直接略過
          </button>
        </>
      )}

      {/* Finished */}
      {phase === 'finished' && (
        <div className="flex flex-col items-center gap-2 w-full">
          <div className="text-center">
            <span className="text-shiko-red font-black text-base font-serif tracking-widest">合戰結束！</span>
            <span className="text-yamabuki-gold font-bold text-sm font-serif ml-2">{winnerEmail}</span>
          </div>
          <button onClick={onRestart} className="btn-danger flex items-center justify-center gap-1.5 w-full max-w-xs">
            <RotateCcw className="w-3.5 h-3.5" /><span>重整旗鼓</span>
          </button>
        </div>
      )}
    </div>
  );
}
