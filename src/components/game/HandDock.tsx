'use client';

import React from 'react';
import type { Card } from '@/lib/game/types';
import { GameCard } from './GameCard';

interface HandDockProps {
  cards: Card[];
  selectedCardIds: string[];
  canIControl: boolean;
  onCardClick: (cardId: string) => void;
  emptyMessage: string;

  /* Setup drag-and-drop */
  isDraggable?: boolean;
  onDragStart?: (cardId: string, e: React.DragEvent) => void;
  onDragEnd?: () => void;

  /* Setup hand as drop zone (return cards) */
  isDropTarget?: boolean;
  onHandDragOver?: (e: React.DragEvent) => void;
  onHandDragLeave?: () => void;
  onHandDrop?: (e: React.DragEvent) => void;
  onHandClick?: () => void;

  /* Info chips */
  infoLabel?: string;
  replaceCount?: number;

  /** 引導高亮：目前應選手牌 */
  guideHighlight?: boolean;

  /** 右側操作（如確認部署），併入底欄避免多佔一列 */
  trailingAction?: React.ReactNode;
}

export function HandDock({
  cards, selectedCardIds, canIControl, onCardClick, emptyMessage,
  isDraggable, onDragStart, onDragEnd,
  isDropTarget, onHandDragOver, onHandDragLeave, onHandDrop, onHandClick,
  infoLabel, replaceCount, trailingAction, guideHighlight,
}: HandDockProps) {
  return (
    <div className={`hand-dock-wrap ${guideHighlight ? 'guide-target' : ''}`}>
      <div className="hand-dock-bar">
        <div className="player-chip shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-yamabuki-gold" />
          <span className="text-foreground/70">{infoLabel ?? '手牌'}</span>
        </div>
        {replaceCount !== undefined && replaceCount > 0 && (
          <span className="text-[8px] text-yamabuki-gold animate-pulse bg-zinc-900/80 border border-yamabuki-gold/30 px-1.5 py-0.5 rounded-full shrink-0">
            替換 {replaceCount} 張
          </span>
        )}
        <div className="flex-1" />
        {trailingAction}
      </div>

      <div
        className={`hand-dock ${isDropTarget ? 'hand-dock--drop' : ''}`}
        onDragOver={onHandDragOver}
        onDragLeave={onHandDragLeave}
        onDrop={onHandDrop}
        onClick={onHandClick}
      >
        {cards.length === 0 && (
          <span className="text-[10px] text-foreground/30 italic py-2">{emptyMessage}</span>
        )}
        {cards.map(card => {
          const isSelected = selectedCardIds.includes(card.id);
          return (
            <GameCard
              key={card.id}
              card={card}
              isSelected={isSelected}
              draggable={isDraggable && canIControl}
              onDragStart={isDraggable ? (e) => onDragStart?.(card.id, e) : undefined}
              onDragEnd={isDraggable ? () => onDragEnd?.() : undefined}
              onClick={() => {
                if (canIControl) onCardClick(card.id);
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
