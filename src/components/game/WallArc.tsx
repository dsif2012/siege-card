'use client';

import React from 'react';
import type { Wall, Card, GamePhase } from '@/lib/game/types';
import { getWallDefenseValue } from '@/lib/game/engine';
import { GameCard, getCardValueLabel } from './GameCard';

const WALL_NAMES = ['首關', '二關', '本丸'] as const;

export interface WallArcProps {
  walls: Wall[];
  wallLimits: readonly number[];
  side: 'enemy' | 'ally';
  turnCount: number;
  canIControl: boolean;
  phase: GamePhase;

  /* Enemy scout/disrupt */
  extraActionType?: 'scout' | 'disrupt' | 'none';
  selectedOpponentWallIndex?: number | null;
  selectedOpponentWallCardIndexes?: number[];
  onEnemyCardClick?: (wallIndex: number, cardIndex: number) => void;

  /* Ally wall selection */
  selectedWallIndex?: number | null;
  onAllyWallClick?: (wallIndex: number) => void;

  /* Setup (ally only) */
  setupCommitted?: boolean;
  displayCards?: (Card | null)[];
  setupIsPlacing?: boolean;
  setupSlotDropProps?: (
    slot: 'wall1' | 'wall2' | 'wall3',
    card: Card | null,
  ) => {
    onDragOver: (e: React.DragEvent) => void;
    onDragLeave: () => void;
    onDrop: (e: React.DragEvent) => void;
    onClick: (e: React.MouseEvent) => void;
    classNameHighlight: boolean;
  } | null;
  onCardDragStart?: (cardId: string, e: React.DragEvent) => void;
  onCardDragEnd?: () => void;
}

export function WallArc(props: WallArcProps) {
  const {
    walls, wallLimits, side, turnCount, canIControl, phase,
    extraActionType = 'none',
    selectedOpponentWallIndex, selectedOpponentWallCardIndexes = [],
    onEnemyCardClick,
    selectedWallIndex, onAllyWallClick,
    setupCommitted = false, displayCards, setupIsPlacing = false,
    setupSlotDropProps, onCardDragStart, onCardDragEnd,
  } = props;

  const isSetup = phase === 'setup';
  const tierOrder = side === 'enemy' ? [2, 1, 0] : [0, 1, 2];

  return (
    <div className={`wall-stage ${side === 'enemy' ? 'wall-stage--enemy' : 'wall-stage--ally'}`}>
      {/* Decorative gate */}
      <div className="flex justify-center mb-1">
        <svg width="48" height="16" viewBox="0 0 48 16" className={side === 'enemy' ? 'text-shiko-red/40' : 'text-yamabuki-gold/40'}>
          <path d="M8 16V6l16-5 16 5v10" stroke="currentColor" strokeWidth="1.2" fill="currentColor" fillOpacity="0.08" />
          <path d="M16 16v-6h4v6M28 16v-6h4v6" stroke="currentColor" strokeWidth="0.8" opacity="0.5" />
        </svg>
      </div>

      {tierOrder.map((wallIndex, orderIdx) => {
        const wall = walls[wallIndex];
        const isFrontline = wallIndex === 0 && turnCount > 1;

        return (
          <React.Fragment key={wallIndex}>
            {orderIdx > 0 && (
              <div className={`wall-divider ${side === 'enemy' ? 'wall-divider--enemy' : 'wall-divider--ally'}`} />
            )}
            <div
              className={`wall-tier ${isFrontline && side === 'enemy' && !wall.breached ? 'ring-1 ring-shiko-red/25 rounded-lg' : ''}`}
            >
              {/* Badge */}
              {side === 'enemy' ? (
                <EnemyBadge wall={wall} wallIndex={wallIndex} wallLimit={wallLimits[wallIndex]} isFrontline={isFrontline} />
              ) : (
                <AllyBadge
                  wall={wall}
                  wallIndex={wallIndex}
                  wallLimit={wallLimits[wallIndex]}
                  isSetup={isSetup}
                  setupCommitted={setupCommitted}
                  displayCard={displayCards?.[wallIndex] ?? null}
                  selectedWallIndex={selectedWallIndex ?? null}
                  setupIsPlacing={setupIsPlacing}
                />
              )}

              {/* Cards */}
              <div className="wall-tier__cards">
                {side === 'enemy'
                  ? renderEnemyCards(wall, wallIndex, extraActionType, canIControl, selectedOpponentWallIndex ?? null, selectedOpponentWallCardIndexes, onEnemyCardClick)
                  : renderAllyCards(wall, wallIndex, walls, isSetup, setupCommitted, displayCards, canIControl, setupSlotDropProps, onAllyWallClick, selectedWallIndex ?? null, onCardDragStart, onCardDragEnd)
                }
              </div>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

/* ── Badge sub-components ── */

function EnemyBadge({ wall, wallIndex, wallLimit, isFrontline }: { wall: Wall; wallIndex: number; wallLimit: number; isFrontline: boolean }) {
  return (
    <div className={`wall-badge ${
      wall.breached ? 'wall-badge--breached'
        : isFrontline ? 'wall-badge--target text-foreground/80'
        : 'text-foreground/75'
    }`}>
      <span>{WALL_NAMES[wallIndex]}</span>
      {wall.breached
        ? <span className="font-bold">破</span>
        : <span>{getWallDefenseValue(wall)}/{wallLimit}</span>
      }
    </div>
  );
}

function AllyBadge({
  wall, wallIndex, wallLimit, isSetup, setupCommitted, displayCard, selectedWallIndex, setupIsPlacing,
}: {
  wall: Wall; wallIndex: number; wallLimit: number;
  isSetup: boolean; setupCommitted: boolean; displayCard: Card | null;
  selectedWallIndex: number | null; setupIsPlacing: boolean;
}) {
  const active = selectedWallIndex === wallIndex || (isSetup && !setupCommitted && setupIsPlacing);
  return (
    <div className={`wall-badge ${
      wall.breached ? 'wall-badge--breached'
        : active ? 'wall-badge--active'
        : 'text-foreground/75'
    }`}>
      <span>{WALL_NAMES[wallIndex]}</span>
      {isSetup && !setupCommitted ? (
        <span>{displayCard ? (setupCommitted ? '已部署' : getCardValueLabel(displayCard.value)) : '放置'}</span>
      ) : wall.breached ? (
        <span className="font-bold">破</span>
      ) : (
        <span>{getWallDefenseValue(wall)}/{wallLimit}</span>
      )}
    </div>
  );
}

/* ── Card renderers ── */

function renderEnemyCards(
  wall: Wall,
  wallIndex: number,
  extraActionType: string,
  canIControl: boolean,
  selectedWallIndex: number | null,
  selectedCardIndexes: number[],
  onCardClick?: (wi: number, ci: number) => void,
) {
  if (wall.breached) return null;
  return wall.cards.map((card, cardIdx) => {
    const isPublic = wall.revealed[cardIdx];
    const isSelected = selectedWallIndex === wallIndex && selectedCardIndexes.includes(cardIdx);
    return (
      <GameCard
        key={cardIdx}
        card={card}
        isFlipped={!isPublic}
        isSelected={isSelected}
        onClick={() => {
          if (canIControl && extraActionType !== 'none' && !isPublic) {
            onCardClick?.(wallIndex, cardIdx);
          }
        }}
      />
    );
  });
}

function renderAllyCards(
  wall: Wall,
  wallIndex: number,
  _walls: Wall[],
  isSetup: boolean,
  setupCommitted: boolean,
  displayCards?: (Card | null)[],
  canIControl?: boolean,
  setupSlotDropProps?: WallArcProps['setupSlotDropProps'],
  onAllyWallClick?: (wi: number) => void,
  selectedWallIndex?: number | null,
  onCardDragStart?: (id: string, e: React.DragEvent) => void,
  onCardDragEnd?: () => void,
) {
  if (isSetup && !setupCommitted) {
    const slotName = `wall${wallIndex + 1}` as 'wall1' | 'wall2' | 'wall3';
    const displayCard = displayCards?.[wallIndex] ?? null;
    const drop = setupSlotDropProps?.(slotName, displayCard);

    return (
      <div
        onDragOver={drop?.onDragOver}
        onDragLeave={drop?.onDragLeave}
        onDrop={drop?.onDrop}
        onClick={drop?.onClick}
        className={`cursor-pointer ${drop?.classNameHighlight ? 'drop-shadow-[0_0_10px_rgba(212,175,55,0.4)]' : ''}`}
      >
        {displayCard ? (
          <GameCard
            card={displayCard}
            draggable={!!canIControl}
            onDragStart={(e) => onCardDragStart?.(displayCard.id, e)}
            onDragEnd={() => onCardDragEnd?.()}
          />
        ) : (
          <div className="slot-empty slot-empty--gold w-11 h-[3.75rem] sm:w-12 sm:h-16 md:w-14 md:h-20">
            <span className="text-[8px] text-yamabuki-gold/40">空</span>
          </div>
        )}
      </div>
    );
  }

  if (isSetup && setupCommitted) {
    const displayCard = displayCards?.[wallIndex] ?? null;
    return displayCard ? <GameCard card={displayCard} /> : null;
  }

  if (wall.breached) return null;

  return (
    <div
      className={`flex gap-1 justify-center items-center cursor-pointer rounded-lg p-0.5 transition-all ${
        selectedWallIndex === wallIndex ? 'ring-1 ring-yamabuki-gold/40 bg-yamabuki-gold/5' : ''
      }`}
      onClick={() => {
        if (!wall.breached) onAllyWallClick?.(wallIndex);
      }}
    >
      {wall.cards.map((card, cardIdx) => (
        <GameCard key={cardIdx} card={card} />
      ))}
    </div>
  );
}
