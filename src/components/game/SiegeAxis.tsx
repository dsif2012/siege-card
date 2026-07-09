'use client';

import React from 'react';
import type { Card, AttackCard, GamePhase } from '@/lib/game/types';
import { getAttackValue } from '@/lib/game/engine';
import { GameCard } from './GameCard';

export interface SiegeAxisProps {
  topAttackZone: AttackCard[];
  bottomAttackZone: AttackCard[];
  drawPileCount: number;
  discardPileCount: number;
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
  activeActorName: string;
}

export function SiegeAxis(props: SiegeAxisProps) {
  const {
    topAttackZone, bottomAttackZone,
    drawPileCount, discardPileCount, turnCount, phase,
    isP2View, canIControl,
    extraActionType, selectedDisruptAttackCards, onDisruptCardClick,
    replaceAttackIds, onReplaceToggle,
    setupCommitted, displayAttackSlots, setupSlotDropProps,
    onSetupCardDragStart, onSetupCardDragEnd,
    mySetupReady, isLocalGuest, activeActorName,
  } = props;

  const isSetup = phase === 'setup';
  const topPlayerKey = isP2View ? 'player1' : 'player2';
  const bottomPlayerKey = isP2View ? 'player2' : 'player1';

  return (
    <div className="siege-axis">
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

      <div className="relative grid grid-cols-[1fr_auto_1fr] items-center gap-1.5 sm:gap-3 px-2 py-2 min-h-[5rem] sm:min-h-[6rem]">
        {/* Left: top player (enemy) attack */}
        <div className="flex items-center gap-1.5 min-w-0 justify-start">
          <div className="hidden sm:flex flex-col items-center shrink-0 gap-0.5">
            <div className="w-8 h-8 rounded-full bg-shiko-red/10 border border-shiko-red/30 flex items-center justify-center text-shiko-red">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M14.5 3.5 L20.5 9.5 L18 12 L16.5 10.5 L13.5 13.5 L15 15 L12.5 17.5 L9.5 14.5 L4 20 L3 19 L8.5 13.5 L5.5 10.5 L8 8 L9.5 9.5 L12.5 6.5 L11 5 Z" /></svg>
            </div>
            <span className="text-[8px] font-bold tracking-wider text-shiko-red/80">敵攻</span>
            <span className="text-xs font-black font-serif text-shiko-red leading-none">{getAttackValue(topAttackZone)}</span>
          </div>
          <div className="sm:hidden text-[8px] text-shiko-red/70 font-bold shrink-0">
            敵攻 {getAttackValue(topAttackZone)}
          </div>
          <div className="flex gap-1 overflow-x-auto min-w-0">
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
              <div className="slot-empty slot-empty--red w-11 h-[3.75rem] sm:w-12 sm:h-16 md:w-14 md:h-20">
                <span className="text-[8px] text-foreground/25">空</span>
              </div>
            )}
          </div>
        </div>

        {/* Center: piles + turn */}
        <div className="flex flex-col items-center gap-1 shrink-0 px-1">
          <div className="flex items-center gap-1.5 sm:gap-2.5">
            <div className="pile-stack w-8 h-11 sm:w-10 sm:h-14 md:w-12 md:h-16 flex flex-col items-center justify-center">
              <span className="text-[7px] sm:text-[8px] text-foreground/40 relative z-[1]">牌堆</span>
              <span className="text-xs sm:text-sm font-bold text-foreground/80 relative z-[1]">{drawPileCount}</span>
            </div>
            <div className="text-center leading-tight">
              <span className="block text-[7px] sm:text-[8px] text-foreground/35 tracking-widest uppercase">Turn</span>
              <span className="block text-lg sm:text-xl font-black font-serif text-yamabuki-gold">{turnCount}</span>
            </div>
            <div className="pile-stack w-8 h-11 sm:w-10 sm:h-14 md:w-12 md:h-16 flex flex-col items-center justify-center opacity-80">
              <span className="text-[7px] sm:text-[8px] text-foreground/35">棄牌</span>
              <span className="text-xs sm:text-sm font-bold text-foreground/55">{discardPileCount}</span>
            </div>
          </div>

          {/* Phase chip */}
          {isSetup && (
            mySetupReady && !isLocalGuest ? (
              <div className="bg-sky-500/10 border border-sky-400/35 rounded-full px-2 py-0.5">
                <p className="text-[8px] sm:text-[9px] text-sky-300 font-bold tracking-wider">已就緒</p>
              </div>
            ) : (
              <div className="bg-yamabuki-gold/10 border border-yamabuki-gold/35 rounded-full px-2 py-0.5">
                <p className="text-[8px] sm:text-[9px] text-yamabuki-gold font-bold tracking-wider">配置中</p>
              </div>
            )
          )}
          {phase === 'wall_breached_response' && (
            <div className="bg-shiko-red/15 border border-shiko-red/40 rounded-full px-2 py-0.5 animate-pulse">
              <p className="text-[8px] sm:text-[9px] text-shiko-red font-bold tracking-wider">緊急補防</p>
            </div>
          )}
          {(phase === 'main_action' || phase === 'extra_action') && (
            <div className="bg-zinc-900/70 border border-foreground/8 rounded-full px-2 py-0.5 max-w-[8rem]">
              <p className="text-[8px] sm:text-[9px] text-foreground/60 truncate">
                <span className="text-foreground/30">操盤 </span>{activeActorName}
              </p>
            </div>
          )}
        </div>

        {/* Right: bottom player (ally) attack */}
        <div className="flex items-center gap-1.5 min-w-0 justify-end">
          <div className="flex gap-1 overflow-x-auto min-w-0 justify-end">
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
                      drop?.classNameHighlight ? 'slot-empty slot-empty--hot' : occupying ? '' : 'slot-empty slot-empty--gold'
                    } ${occupying ? '' : 'w-11 h-[3.75rem] sm:w-12 sm:h-16 md:w-14 md:h-20'}`}
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
                  <div className="slot-empty slot-empty--gold w-11 h-[3.75rem] sm:w-12 sm:h-16 md:w-14 md:h-20">
                    <span className="text-[8px] text-foreground/25">空</span>
                  </div>
                )}
              </>
            )}
          </div>
          <div className="hidden sm:flex flex-col items-center shrink-0 gap-0.5">
            <div className="w-8 h-8 rounded-full bg-yamabuki-gold/10 border border-yamabuki-gold/35 flex items-center justify-center text-yamabuki-gold">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M14.5 3.5 L20.5 9.5 L18 12 L16.5 10.5 L13.5 13.5 L15 15 L12.5 17.5 L9.5 14.5 L4 20 L3 19 L8.5 13.5 L5.5 10.5 L8 8 L9.5 9.5 L12.5 6.5 L11 5 Z" /></svg>
            </div>
            <span className="text-[8px] font-bold tracking-wider text-yamabuki-gold/80">我攻</span>
            <span className="text-xs font-black font-serif text-yamabuki-gold leading-none">
              {isSetup
                ? `${[displayAttackSlots[0], displayAttackSlots[1]].filter(Boolean).length}/2`
                : getAttackValue(bottomAttackZone)}
            </span>
          </div>
          <div className="sm:hidden text-[8px] text-yamabuki-gold/70 font-bold shrink-0 text-right">
            我攻 {isSetup
              ? `${[displayAttackSlots[0], displayAttackSlots[1]].filter(Boolean).length}/2`
              : getAttackValue(bottomAttackZone)}
          </div>
        </div>
      </div>
    </div>
  );
}
