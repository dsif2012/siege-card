'use client';

import React from 'react';
import { Swords } from 'lucide-react';
import type { Card, AttackCard, GamePhase } from '@/lib/game/types';
import { getAttackValue } from '@/lib/game/engine';
import { hubPhaseLabel } from '@/lib/game/ui-step';
import { GameCard } from './GameCard';
import { TurnTimer } from './TurnTimer';

function SiegeLaneBadge({
  side,
  label,
  value,
}: {
  side: 'enemy' | 'ally';
  label: string;
  value: string | number;
}) {
  return (
    <div className={`siege-axis__badge siege-axis__badge--${side}`}>
      <div className={`siege-axis__badge-icon siege-axis__badge-icon--${side}`}>
        <Swords size={14} strokeWidth={2.25} aria-hidden />
      </div>
      <div className="siege-axis__badge-meta">
        <span className="siege-axis__badge-label">{label}</span>
        <span className="siege-axis__badge-value">{value}</span>
      </div>
    </div>
  );
}

export interface SiegeAxisProps {
  topAttackZone: AttackCard[];
  bottomAttackZone: AttackCard[];
  drawPileCount: number;
  discardPileCount: number;
  onDiscardPileClick?: () => void;
  turnCount: number;
  phase: GamePhase;
  isP2View: boolean;
  canIControl: boolean;

  extraActionType: 'scout' | 'disrupt' | 'none';
  selectedDisruptAttackCards: { playerKey: 'player1' | 'player2'; cardIndex: number }[];
  onDisruptCardClick: (playerKey: 'player1' | 'player2', cardIndex: number) => void;

  replaceAttackIds: string[];
  onReplaceToggle: (cardId: string) => void;

  /* Setup */
  setupCommitted: boolean;
  displayAttackSlots: [Card | null, Card | null];
  setupSlotDropProps?: (
    slot: 'attack0' | 'attack1',
    card: Card | null,
  ) => {
    onDragOver: (e: React.DragEvent) => void;
    onDragLeave: () => void;
    onDrop: (e: React.DragEvent) => void;
    onClick: (e: React.MouseEvent) => void;
    classNameHighlight: boolean;
  } | null;
  onSetupCardDragStart?: (cardId: string, e: React.DragEvent) => void;
  onSetupCardDragEnd?: () => void;

  mySetupReady: boolean;
  isLocalGuest: boolean;

  breachGuideMessage?: string | null;

  phaseDeadlineAt?: number;
  onTimerExpire?: () => void;

  guideHighlight?: boolean;
}

export function SiegeAxis(props: SiegeAxisProps) {
  const {
    topAttackZone, bottomAttackZone,
    drawPileCount, discardPileCount, onDiscardPileClick, turnCount, phase,
    isP2View, canIControl,
    extraActionType, selectedDisruptAttackCards, onDisruptCardClick,
    replaceAttackIds, onReplaceToggle,
    setupCommitted, displayAttackSlots, setupSlotDropProps,
    onSetupCardDragStart, onSetupCardDragEnd,
    mySetupReady, isLocalGuest,
    breachGuideMessage,
    phaseDeadlineAt, onTimerExpire,
    guideHighlight = false,
  } = props;

  const isSetup = phase === 'setup';
  const showTimer =
    (phase === 'main_action' || phase === 'extra_action') && !!phaseDeadlineAt;

  const phaseLabel = hubPhaseLabel(phase);
  const turnHint = (() => {
    if (phase === 'finished') return null;
    if (phase === 'wall_breached_response' && breachGuideMessage) {
      return breachGuideMessage;
    }
    if (isSetup) {
      if (mySetupReady && !isLocalGuest) return '已就緒，等待對手';
      return canIControl ? '輪到你配置' : '對手配置中';
    }
    return canIControl ? '輪到你' : '對手回合';
  })();
  const topPlayerKey = isP2View ? 'player1' : 'player2';
  const bottomPlayerKey = isP2View ? 'player2' : 'player1';

  return (
    <div className={`siege-axis ${guideHighlight ? 'spotlight' : ''}`}>
      {/* SVG decorative overlay */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden>
        <defs>
          <linearGradient id="ax-f" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#d33f49" stopOpacity="0.1" />
            <stop offset="45%" stopColor="#d4af37" stopOpacity="0.03" />
            <stop offset="55%" stopColor="#d4af37" stopOpacity="0.03" />
            <stop offset="100%" stopColor="#d4af37" stopOpacity="0.1" />
          </linearGradient>
        </defs>
        <rect width="1000" height="100" fill="url(#ax-f)" />
        <g className="axis-clash" stroke="#d4af37" strokeWidth="1.5" fill="#d4af37">
          <path d="M430 50h40" strokeOpacity="0.4" strokeLinecap="round" />
          <path d="M530 50h40" strokeOpacity="0.4" strokeLinecap="round" />
          <polygon points="470,44 500,50 470,56" fillOpacity="0.5" />
          <polygon points="530,44 500,50 530,56" fillOpacity="0.5" />
          <circle cx="500" cy="50" r="3" fillOpacity="0.6" />
        </g>
      </svg>

      <div className="siege-axis__inner">
        {/* Top: enemy attack */}
        <div className="siege-axis__lane siege-axis__lane--enemy">
          <SiegeLaneBadge
            side="enemy"
            label="敵方攻城"
            value={getAttackValue(topAttackZone)}
          />
          <div className="siege-axis__lane-cards">
            {topAttackZone.map((ac, idx) => {
              const isSelected = selectedDisruptAttackCards.some(
                x => x.playerKey === topPlayerKey && x.cardIndex === idx,
              );
              return (
                <GameCard
                  key={idx}
                  card={ac.card}
                  showCharge={ac.charge}
                  isSelected={isSelected}
                  onClick={() => {
                    if (canIControl && extraActionType === 'disrupt') {
                      onDisruptCardClick(topPlayerKey, idx);
                    }
                  }}
                />
              );
            })}
            {topAttackZone.length === 0 && (
              <div className="slot-empty slot-empty--red slot-card">
                <span className="text-[8px] text-foreground/25">空</span>
              </div>
            )}
          </div>
        </div>

        {/* Center: draw → phase → discard */}
        <div
          className={`axis-hub shrink-0 ${canIControl && phase !== 'finished' ? 'axis-hub--active' : ''}`}
        >
          <div className="axis-hub__pile axis-hub__pile--draw" title="牌庫剩餘">
            <svg className="axis-hub__pile-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
              <rect x="5" y="6" width="12" height="15" rx="1.5" stroke="currentColor" strokeWidth="1.5" opacity="0.45" />
              <rect x="8" y="3" width="12" height="15" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            <span className="axis-hub__pile-label">牌庫</span>
            <span className="axis-hub__pile-count">{drawPileCount}</span>
          </div>

          <div className="axis-hub__command">
            <div className="axis-hub__head">
              {showTimer && phaseDeadlineAt && (
                <TurnTimer
                  deadlineAt={phaseDeadlineAt}
                  onExpire={canIControl ? onTimerExpire : undefined}
                  active={canIControl}
                  compact
                />
              )}
              <div className="axis-hub__phase">
                <span className="axis-hub__round">第 {turnCount} 回合</span>
                <span className="axis-hub__label">{phaseLabel}</span>
              </div>
            </div>
            {turnHint && (
              <span className={`axis-hub__turn ${canIControl ? 'axis-hub__turn--mine' : ''} ${
                phase === 'wall_breached_response' ? 'axis-hub__turn--breach' : ''
              }`}>
                {turnHint}
              </span>
            )}
          </div>

          <button
            type="button"
            className="axis-hub__pile axis-hub__pile--discard"
            title="查看棄牌堆"
            onClick={onDiscardPileClick}
          >
            <svg className="axis-hub__pile-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
              <rect x="6" y="7" width="12" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.5" opacity="0.35" />
              <path d="M9 11h6M9 14h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
            </svg>
            <span className="axis-hub__pile-label">棄牌</span>
            <span className="axis-hub__pile-count">{discardPileCount}</span>
          </button>
        </div>

        {/* Bottom: ally attack */}
        <div className="siege-axis__lane siege-axis__lane--ally">
          <div className="siege-axis__lane-cards">
            {isSetup ? (
              ([0, 1] as const).map(idx => {
                const slot = (idx === 0 ? 'attack0' : 'attack1') as 'attack0' | 'attack1';
                const occupying = displayAttackSlots[idx];
                const drop = setupCommitted ? null : setupSlotDropProps?.(slot, occupying ?? null);
                return (
                  <div
                    key={slot}
                    onDragOver={drop?.onDragOver}
                    onDragLeave={drop?.onDragLeave}
                    onDrop={drop?.onDrop}
                    onClick={drop?.onClick}
                    className={`${setupCommitted ? '' : 'cursor-pointer'} ${
                      occupying
                        ? ''
                        : `slot-empty slot-card ${drop?.classNameHighlight ? 'slot-empty--hot' : 'slot-empty--gold'}`
                    }`}
                  >
                    {occupying ? (
                      <GameCard
                        card={occupying}
                        draggable={!!canIControl && !setupCommitted}
                        onDragStart={setupCommitted ? undefined : (e) => onSetupCardDragStart?.(occupying.id, e)}
                        onDragEnd={setupCommitted ? undefined : () => onSetupCardDragEnd?.()}
                      />
                    ) : (
                      <span className="text-[8px] text-yamabuki-gold/55 font-serif">攻{idx + 1}</span>
                    )}
                  </div>
                );
              })
            ) : (
              <>
                {bottomAttackZone.map((ac, idx) => {
                  const isSelected = selectedDisruptAttackCards.some(
                    x => x.playerKey === bottomPlayerKey && x.cardIndex === idx,
                  );
                  const isReplace = replaceAttackIds.includes(ac.card.id);
                  return (
                    <GameCard
                      key={idx}
                      card={ac.card}
                      showCharge={ac.charge}
                      isSelected={isSelected || isReplace}
                      onClick={() => {
                        if (canIControl) {
                          if (extraActionType === 'disrupt') {
                            onDisruptCardClick(bottomPlayerKey, idx);
                          } else if (phase === 'main_action') {
                            onReplaceToggle(ac.card.id);
                          }
                        }
                      }}
                    />
                  );
                })}
                {bottomAttackZone.length === 0 && (
                  <div className="slot-empty slot-empty--gold slot-card">
                    <span className="text-[8px] text-foreground/25">空</span>
                  </div>
                )}
              </>
            )}
          </div>
          <SiegeLaneBadge
            side="ally"
            label="我方攻城"
            value={
              isSetup
                ? `${[displayAttackSlots[0], displayAttackSlots[1]].filter(Boolean).length}/2`
                : getAttackValue(bottomAttackZone)
            }
          />
        </div>
      </div>
    </div>
  );
}
