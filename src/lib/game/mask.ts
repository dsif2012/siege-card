import { Card, GameState, Wall } from '@/lib/game/types';

/** 將卡牌資訊遮罩，防止作弊 */
export function maskCard(card: Card): Card {
  return {
    id: card.id,
    suit: 'H',
    value: 0,
  };
}

/** 遮罩防守牆上未被公開的防禦卡 */
export function maskWall(wall: Wall): Wall {
  return {
    ...wall,
    cards: wall.cards.map((card, idx) => (wall.revealed[idx] ? card : maskCard(card))),
  };
}

/**
 * 依觀看者身分過濾 gameState（線上模式）。
 * - 對手手牌、未公開城牆蓋牌
 * - setup 草稿只保留自己的；對手 draft 清空
 * - 公共牌堆只回傳張數（內容清空）
 */
export function filterGameStateForViewer(
  gameState: GameState,
  viewerId: string,
  options?: { isLocalGuest?: boolean }
): GameState {
  if (options?.isLocalGuest || gameState.player2.id === 'guest') {
    return gameState;
  }

  const filtered: GameState = JSON.parse(JSON.stringify(gameState));
  const isPlayer1 = filtered.player1.id === viewerId;
  const isPlayer2 = filtered.player2.id === viewerId;

  // 牌堆內容不應洩漏（只保留長度語意：前端用 length）
  const drawCount = filtered.drawPile.length;
  filtered.drawPile = Array.from({ length: drawCount }, (_, i) => ({
    id: `hidden_draw_${i}`,
    suit: 'H' as const,
    value: 0,
  }));

  if (isPlayer1) {
    filtered.player2.hand = filtered.player2.hand.map(maskCard);
    filtered.player2.walls = filtered.player2.walls.map(maskWall);
    if (filtered.setupState) {
      filtered.setupState.player2Draft = [];
    }
  } else if (isPlayer2) {
    filtered.player1.hand = filtered.player1.hand.map(maskCard);
    filtered.player1.walls = filtered.player1.walls.map(maskWall);
    if (filtered.setupState) {
      filtered.setupState.player1Draft = [];
    }
  } else {
    filtered.player1.hand = filtered.player1.hand.map(maskCard);
    filtered.player2.hand = filtered.player2.hand.map(maskCard);
    filtered.player1.walls = filtered.player1.walls.map(maskWall);
    filtered.player2.walls = filtered.player2.walls.map(maskWall);
    if (filtered.setupState) {
      filtered.setupState.player1Draft = [];
      filtered.setupState.player2Draft = [];
    }
  }

  return filtered;
}
