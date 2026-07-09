'use client';

import React from 'react';
import type { Card } from '@/lib/game/types';

const SUIT_MAP: Record<string, { symbol: string; color: string }> = {
  H: { symbol: '♥', color: 'text-red-500' },
  D: { symbol: '♦', color: 'text-red-400' },
  C: { symbol: '♣', color: 'text-zinc-400' },
  S: { symbol: '♠', color: 'text-zinc-300' },
};

const VALUE_LABELS: Record<number, string> = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' };

export function getCardValueLabel(value: number): string {
  return VALUE_LABELS[value] ?? value.toString();
}

export interface GameCardProps {
  card: Card;
  isSelected?: boolean;
  onClick?: () => void;
  isFlipped?: boolean;
  showCharge?: number;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd?: (e: React.DragEvent<HTMLDivElement>) => void;
}

export function GameCard({
  card,
  isSelected,
  onClick,
  isFlipped = false,
  showCharge = 0,
  draggable = false,
  onDragStart,
  onDragEnd,
}: GameCardProps) {
  const isReallyFlipped = isFlipped || card.value === 0;

  if (isReallyFlipped) {
    return (
      <div
        onClick={onClick}
        draggable={draggable}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        className={`game-card w-11 h-[3.75rem] sm:w-12 sm:h-16 md:w-14 md:h-20 rounded border-2 flex items-center justify-center ${
          onClick || draggable ? 'cursor-pointer hover:scale-105' : ''
        } ${draggable ? 'cursor-grab active:cursor-grabbing' : ''} ${
          isSelected
            ? 'border-yamabuki-gold scale-105 shadow-[0_0_8px_rgba(212,175,55,0.6)]'
            : 'border-red-950 shadow-md'
        } japanese-pattern`}
      >
        <div className="text-[10px] text-red-100/30 font-serif font-black tracking-widest pointer-events-none -rotate-12">
          軍
        </div>
      </div>
    );
  }

  const suit = SUIT_MAP[card.suit] ?? { symbol: '?', color: 'text-zinc-500' };
  const valueLabel = getCardValueLabel(card.value);
  const isRed = card.suit === 'H' || card.suit === 'D';

  return (
    <div
      onClick={onClick}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`game-card w-11 h-[3.75rem] sm:w-12 sm:h-16 md:w-14 md:h-20 washi-card-light rounded border flex flex-col justify-between p-1 sm:p-1.5 relative ${
        onClick || draggable ? 'cursor-pointer hover:scale-105' : ''
      } ${draggable ? 'cursor-grab active:cursor-grabbing' : ''} ${
        isSelected
          ? 'border-yamabuki-gold scale-105 ring-2 ring-yamabuki-gold shadow-[0_0_12px_rgba(212,175,55,0.8)]'
          : 'border-zinc-300 shadow-md'
      } ${showCharge > 0 ? 'charge-glow' : ''}`}
    >
      <div className="flex flex-col leading-none items-start">
        <span className={`text-[10px] sm:text-xs md:text-sm font-bold font-serif ${isRed ? 'text-shiko-red' : 'text-zinc-950'}`}>
          {valueLabel}
        </span>
        <span className={`text-[8px] sm:text-[10px] md:text-xs ${suit.color}`}>{suit.symbol}</span>
      </div>
      <div className={`absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none text-lg sm:text-2xl ${suit.color}`}>
        {suit.symbol}
      </div>
      <div className="flex justify-end items-end leading-none">
        <span className={`text-[8px] sm:text-[10px] md:text-xs font-bold font-serif ${isRed ? 'text-shiko-red' : 'text-zinc-950'}`}>
          {valueLabel}
        </span>
      </div>
      {showCharge > 0 && (
        <div className="absolute -top-2 -right-2 sm:-top-2.5 sm:-right-2.5 bg-gradient-to-r from-yellow-500 to-amber-600 text-zinc-950 border border-yellow-200 text-[8px] sm:text-[9px] font-black w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center shadow-lg animate-bounce">
          +{showCharge}
        </div>
      )}
    </div>
  );
}
