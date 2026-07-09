'use client';

import React from 'react';
import type { Wall, Card, GamePhase } from '@/lib/game/types';
import { getWallDefenseValue, getKnownWallDefenseValue, WALL_CARD_LIMIT } from '@/lib/game/engine';
import { GameCard, getCardValueLabel } from './GameCard';

const WALL_NAMES = ['首關', '二關', '本丸'] as const;
/** 雙方皆左→右：首關｜二關｜本丸 */
const TIER_ORDER = [0, 1, 2] as const;

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

  /** 引導高亮 */
  guideHighlight?: boolean;

  /** 城破補防 */
  breachMode?: boolean;
  breachedWallIndex?: number | null;
}

export function WallArc(props: WallArcProps) {
  const {
    walls, wallLimits, side, turnCount, canIControl, phase,
    extraActionType = 'none',
    selectedOpponentWallIndex, selectedOpponentWallCardIndexes = [],
    onEnemyCardClick,
    selectedWallIndex, onAllyWallClick,
    setupCommitted = false, displayCards, setupIsPlacing = false,
    setupSlotDropProps,     onCardDragStart, onCardDragEnd,
    guideHighlight = false,
    breachMode = false,
    breachedWallIndex = null,
  } = props;

  const isSetup = phase === 'setup';

  return (
    <div className={`wall-stage ${side === 'enemy' ? 'wall-stage--enemy' : 'wall-stage--ally'} ${guideHighlight ? 'spotlight' : ''}`}>
      <div className="wall-row" role="group" aria-label={side === 'enemy' ? '敵方城牆' : '己方城牆'}>
        {TIER_ORDER.map((wallIndex) => {
          const wall = walls[wallIndex];
          const isFrontline = wallIndex === 0 && turnCount > 1;
          const isBreachRuin = breachMode && breachedWallIndex === wallIndex;
          const isBreachPlaceable =
            breachMode &&
            side === 'ally' &&
            canIControl &&
            !wall.breached &&
            breachedWallIndex !== wallIndex;

          return (
            <div
              key={wallIndex}
              className={`wall-tier ${
                isFrontline && side === 'enemy' && !wall.breached ? 'wall-tier--frontline' : ''
              } ${isBreachRuin ? 'wall-tier--breach-ruin' : ''} ${
                isBreachPlaceable ? 'wall-tier--breach-placeable' : ''
              } ${isBreachPlaceable && selectedWallIndex === wallIndex ? 'wall-tier--breach-selected' : ''}`}
            >
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

              <div
                className={`wall-tier__cards ${
                  !isSetup && wall.cards.length > 1 ? 'wall-tier__cards--stack' : ''
                } ${
                  side === 'ally' && !isSetup && !wall.breached
                    ? `cursor-pointer rounded-lg p-0.5 transition-all ${
                        selectedWallIndex === wallIndex ? 'ring-1 ring-yamabuki-gold/40 bg-yamabuki-gold/5' : ''
                      }`
                    : ''
                }`}
                onClick={
                  side === 'ally' && !isSetup && !wall.breached && !isBreachRuin
                    ? () => onAllyWallClick?.(wallIndex)
                    : undefined
                }
              >
                {side === 'enemy'
                  ? renderEnemyCards(wall, wallIndex, extraActionType, canIControl, selectedOpponentWallIndex ?? null, selectedOpponentWallCardIndexes, onEnemyCardClick)
                  : renderAllyCards(wall, wallIndex, isSetup, setupCommitted, displayCards, canIControl, setupSlotDropProps, onCardDragStart, onCardDragEnd, isBreachRuin)
                }
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Badge sub-components ── */

function EnemyBadge({ wall, wallIndex, wallLimit, isFrontline }: { wall: Wall; wallIndex: number; wallLimit: number; isFrontline: boolean }) {
  const { known, hiddenCount, totalCards } = getKnownWallDefenseValue(wall);
  let defenseLabel: string;
  if (wall.breached) {
    defenseLabel = '破';
  } else if (totalCards === 0) {
    defenseLabel = `0/${wallLimit}`;
  } else if (hiddenCount === totalCards) {
    // 全蓋：不洩漏任何點數
    defenseLabel = `?/${wallLimit}`;
  } else if (hiddenCount > 0) {
    defenseLabel = `${known}+?/${wallLimit}`;
  } else {
    defenseLabel = `${known}/${wallLimit}`;
  }

  return (
    <div className={`wall-badge ${
      wall.breached ? 'wall-badge--breached'
        : isFrontline ? 'wall-badge--target text-foreground/80'
        : 'text-foreground/75'
    }`}>
      <span>{WALL_NAMES[wallIndex]}</span>
      {wall.breached ? (
        <span className="font-bold">破</span>
      ) : (
        <>
          <span>{defenseLabel}</span>
          <span className="wall-badge__cards" title="防守牌張數">
            {totalCards}/{WALL_CARD_LIMIT}
          </span>
        </>
      )}
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
  const cardCount = isSetup && !setupCommitted
    ? (displayCard ? 1 : 0)
    : wall.cards.length;

  return (
    <div className={`wall-badge ${
      wall.breached ? 'wall-badge--breached'
        : active ? 'wall-badge--active'
        : 'text-foreground/75'
    }`}>
      <span>{WALL_NAMES[wallIndex]}</span>
      {isSetup && !setupCommitted ? (
        <>
          <span>{displayCard ? getCardValueLabel(displayCard.value) : '放置'}</span>
          <span className="wall-badge__cards" title="防守牌張數">
            {cardCount}/{WALL_CARD_LIMIT}
          </span>
        </>
      ) : wall.breached ? (
        <span className="font-bold">破</span>
      ) : (
        <>
          <span>{getWallDefenseValue(wall)}/{wallLimit}</span>
          <span className="wall-badge__cards" title="防守牌張數">
            {cardCount}/{WALL_CARD_LIMIT}
          </span>
        </>
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
  isSetup: boolean,
  setupCommitted: boolean,
  displayCards?: (Card | null)[],
  canIControl?: boolean,
  setupSlotDropProps?: WallArcProps['setupSlotDropProps'],
  onCardDragStart?: (id: string, e: React.DragEvent) => void,
  onCardDragEnd?: () => void,
  isBreachRuin = false,
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
          <div className="slot-empty slot-empty--gold slot-card">
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

  if (wall.breached) {
    if (isBreachRuin) {
      return (
        <div className="wall-tier__ruin slot-card" aria-label="破口，無法放置">
          <span className="wall-tier__ruin-label">破口</span>
        </div>
      );
    }
    return null;
  }

  return wall.cards.map((card, cardIdx) => (
    <GameCard
      key={`${card.id}-${cardIdx}`}
      card={card}
    />
  ));
}
