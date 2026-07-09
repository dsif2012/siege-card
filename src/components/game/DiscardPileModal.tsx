'use client';

import { useEffect } from 'react';
import type { Card } from '@/lib/game/types';
import { GameCard } from './GameCard';

interface DiscardPileModalProps {
  cards: Card[];
  isOpen: boolean;
  onClose: () => void;
}

export function DiscardPileModal({ cards, isOpen, onClose }: DiscardPileModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const history = [...cards].reverse();

  return (
    <div
      className="discard-modal-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="discard-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="discard-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="discard-modal__header">
          <h2 id="discard-modal-title" className="discard-modal__title">
            棄牌堆
          </h2>
          <span className="discard-modal__count">{cards.length} 張</span>
        </header>

        <p className="discard-modal__hint">由新到舊排列，最近棄掉的牌在最上方</p>

        <div className="discard-modal__body">
          {history.length === 0 ? (
            <p className="discard-modal__empty">目前尚無棄牌</p>
          ) : (
            <div className="discard-modal__grid">
              {history.map((card, idx) => (
                <div key={`${card.id}-${idx}`} className="discard-modal__item">
                  {idx === 0 && (
                    <span className="discard-modal__badge">最近</span>
                  )}
                  <GameCard card={card} />
                </div>
              ))}
            </div>
          )}
        </div>

        <footer className="discard-modal__footer">
          <button type="button" onClick={onClose} className="btn-primary py-2 px-6">
            關閉
          </button>
        </footer>
      </div>
    </div>
  );
}
