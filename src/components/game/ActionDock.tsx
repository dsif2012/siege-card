'use client';

import type { GamePhase } from '@/lib/game/types';
import { Sword, Shield, Sparkles, Send, RotateCcw, MousePointerClick } from 'lucide-react';

export type MainActionIntent = 'attack' | 'defense' | 'charge' | null;

export interface ActionDockProps {
  phase: GamePhase;
  canIControl: boolean;

  /* Setup */
  setupIsReady: boolean;
  setupCommitted: boolean;
  onSetupSubmit: () => void;

  /* Main action — 先選意圖，再選牌／目標 */
  mainActionIntent: MainActionIntent;
  setMainActionIntent: (intent: MainActionIntent) => void;
  selectedHandCount: number;
  selectedWallIndex: number | null;
  replaceAttackCount: number;
  onPlaceAttack: () => void;
  onPlaceDefense: () => void;
  onCharge: () => void;

  /* Extra action */
  extraActionType: 'scout' | 'disrupt' | 'none';
  setExtraActionType: (type: 'scout' | 'disrupt' | 'none') => void;
  hasDoneExtraAction: boolean;
  turnCount: number;
  selectedOpponentCardCount: number;
  selectedDisruptAttackCount: number;
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

function StepHint({ text }: { text: string }) {
  return (
    <div className="guide-step w-full">
      <MousePointerClick className="w-3.5 h-3.5 text-yamabuki-gold shrink-0" />
      <span>{text}</span>
    </div>
  );
}

export function ActionDock(props: ActionDockProps) {
  const {
    phase, canIControl,
    setupIsReady, setupCommitted, onSetupSubmit,
    mainActionIntent, setMainActionIntent,
    selectedHandCount, selectedWallIndex, replaceAttackCount,
    onPlaceAttack, onPlaceDefense, onCharge,
    extraActionType, setExtraActionType, hasDoneExtraAction, turnCount,
    selectedOpponentCardCount, selectedDisruptAttackCount,
    onDraw2, onAttack, onScout, onDisrupt, onEndTurn, onClearSelections,
    isBreachPhase, onBreachResponse, onBreachSkip,
    winnerEmail, onRestart,
  } = props;

  const pickMainIntent = (intent: Exclude<MainActionIntent, null>) => {
    onClearSelections();
    setMainActionIntent(intent);
  };

  const cancelMainIntent = () => {
    setMainActionIntent(null);
    onClearSelections();
  };

  const attackReady = selectedHandCount >= 1 && selectedHandCount <= 2;
  const defenseReady =
    selectedHandCount >= 1 && selectedHandCount <= 2 && selectedWallIndex !== null;

  let mainStepHint = '';
  if (phase === 'main_action' && canIControl) {
    if (!mainActionIntent) {
      mainStepHint = '① 先點下方行動：攻擊牌／防守牌／蓄力';
    } else if (mainActionIntent === 'attack') {
      mainStepHint = attackReady
        ? `已選手牌 ${selectedHandCount} 張${replaceAttackCount > 0 ? `，替換 ${replaceAttackCount} 張` : ''} → 按確認出兵`
        : '② 點手牌選 1～2 張（攻擊區已滿時，再點要替換的攻擊牌）';
    } else if (mainActionIntent === 'defense') {
      if (selectedHandCount < 1) mainStepHint = '② 點手牌選 1～2 張防守牌';
      else if (selectedWallIndex === null) mainStepHint = '③ 點下方己方城牆（首關／二關／本丸）';
      else mainStepHint = `已選 ${selectedHandCount} 張 → 城牆已指定 → 按確認補防`;
    } else if (mainActionIntent === 'charge') {
      mainStepHint = '蓄力會讓攻擊區所有牌 +1，直接確認即可';
    }
  }

  let extraStepHint = '';
  if (phase === 'extra_action' && canIControl && !hasDoneExtraAction) {
    if (extraActionType === 'none') {
      extraStepHint = '① 先選額外行動，或直接結束回合';
    } else if (extraActionType === 'scout') {
      extraStepHint = selectedOpponentCardCount > 0
        ? `已選對手蓋牌 ${selectedOpponentCardCount} 張 → 按確定施法`
        : '② 點上方對手城牆的蓋牌（1～2 張）';
    } else if (extraActionType === 'disrupt') {
      if (selectedOpponentCardCount < 1) extraStepHint = '② 點對手城牆蓋牌（1～2 張）公開';
      else if (selectedDisruptAttackCount < 1) extraStepHint = '③ 點場上攻擊牌（1～2 張）歸零蓄力';
      else extraStepHint = '目標已齊 → 按確定施法';
    }
  }

  if (isBreachPhase && canIControl) {
    if (selectedHandCount < 1) extraStepHint = '選手牌補防，或直接略過';
    else if (selectedWallIndex === null) extraStepHint = '再點剩餘城牆放置';
    else extraStepHint = '按派兵補防確認';
  }

  return (
    <div className={`action-dock ${canIControl && ((phase === 'main_action' && !mainActionIntent) || (phase === 'extra_action' && extraActionType === 'none' && !hasDoneExtraAction)) ? 'action-dock--await-choice' : ''}`}>
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

      {/* Main action — step 1: pick intent */}
      {phase === 'main_action' && !mainActionIntent && (
        <>
          {canIControl && <StepHint text={mainStepHint} />}
          <button
            onClick={() => pickMainIntent('attack')}
            disabled={!canIControl}
            className="btn-ghost flex-1 flex items-center justify-center gap-1 guide-choice"
          >
            <Sword className="w-3.5 h-3.5 text-shiko-red" /><span>攻擊牌</span>
          </button>
          <button
            onClick={() => pickMainIntent('defense')}
            disabled={!canIControl}
            className="btn-ghost flex-1 flex items-center justify-center gap-1 guide-choice"
          >
            <Shield className="w-3.5 h-3.5 text-sky-400" /><span>防守牌</span>
          </button>
          <button
            onClick={() => pickMainIntent('charge')}
            disabled={!canIControl}
            className="btn-ghost flex-1 flex items-center justify-center gap-1 guide-choice"
          >
            <Sparkles className="w-3.5 h-3.5 text-yamabuki-gold" /><span>蓄力</span>
          </button>
        </>
      )}

      {/* Main action — step 2+: select then confirm */}
      {phase === 'main_action' && mainActionIntent && (
        <>
          {canIControl && <StepHint text={mainStepHint} />}
          {mainActionIntent === 'attack' && (
            <button onClick={onPlaceAttack} disabled={!canIControl || !attackReady} className="btn-primary flex-1">
              確認出兵
            </button>
          )}
          {mainActionIntent === 'defense' && (
            <button onClick={onPlaceDefense} disabled={!canIControl || !defenseReady} className="btn-primary flex-1">
              確認補防
            </button>
          )}
          {mainActionIntent === 'charge' && (
            <button onClick={onCharge} disabled={!canIControl} className="btn-primary flex-1">
              確認蓄力
            </button>
          )}
          <button onClick={cancelMainIntent} disabled={!canIControl} className="btn-ghost">
            取消
          </button>
        </>
      )}

      {/* Extra action — pick */}
      {phase === 'extra_action' && extraActionType === 'none' && (
        <>
          {canIControl && !hasDoneExtraAction && <StepHint text={extraStepHint} />}
          <button onClick={onDraw2} disabled={!canIControl || hasDoneExtraAction} className="btn-ghost flex-1 text-center guide-choice">
            抽牌
          </button>
          <button onClick={onAttack} disabled={!canIControl || hasDoneExtraAction || turnCount === 1} className="btn-ghost flex-1 text-center guide-choice">
            攻城
          </button>
          <button
            onClick={() => { onClearSelections(); setExtraActionType('scout'); }}
            disabled={!canIControl || hasDoneExtraAction}
            className="btn-ghost flex-1 text-center guide-choice"
          >
            偵查
          </button>
          <button
            onClick={() => { onClearSelections(); setExtraActionType('disrupt'); }}
            disabled={!canIControl || hasDoneExtraAction}
            className="btn-ghost flex-1 text-center guide-choice"
          >
            破勢
          </button>
          <button onClick={onEndTurn} disabled={!canIControl} className="btn-ghost w-full flex items-center justify-center gap-1">
            <Send className="w-3 h-3" /><span>結束回合</span>
          </button>
        </>
      )}

      {phase === 'extra_action' && extraActionType !== 'none' && (
        <>
          {canIControl && <StepHint text={extraStepHint} />}
          <button
            onClick={extraActionType === 'scout' ? onScout : onDisrupt}
            disabled={
              !canIControl ||
              selectedOpponentCardCount < 1 ||
              (extraActionType === 'disrupt' && selectedDisruptAttackCount < 1)
            }
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
          {canIControl && <StepHint text={extraStepHint || '選手牌補防，或直接略過'} />}
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
