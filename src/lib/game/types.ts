// 定義攻城牌遊戲的型態定義文件 (繁體中文註解)

export type CardSuit = 'H' | 'D' | 'C' | 'S'; // H: 紅心, D: 方塊, C: 梅花, S: 黑桃

export interface Card {
  id: string;      // 唯一識別碼
  suit: CardSuit;  // 花色
  value: number;   // 數值 (1=A, 2-10, 11=J, 12=Q, 13=K)
}

export interface AttackCard {
  card: Card;
  charge: number;  // 蓄力值 (大於等於 0)
}

export interface Wall {
  cards: Card[];       // 該城牆上的防守牌列表
  breached: boolean;   // 是否已被攻破
  revealed: boolean[]; // 每張防守牌是否已公開（對應 cards 索引；偵查／破勢後永久公開）
}

export interface PlayerState {
  id: string;              // 玩家 ID (或 'guest')
  email: string;           // 玩家 Email
  hand: Card[];            // 手牌列表
  walls: Wall[];           // 三層城牆，索引 0 為第一層 (上限 20)，1 為第二層 (上限 30)，2 為第三層 (上限 40)
  attackZone: AttackCard[]; // 攻擊區，最多 4 張牌
}

export type GamePhase = 
  | 'setup'                  // 開局階段：雙方配置防守牌與攻擊牌
  | 'main_action'            // 主要行動階段：放攻擊、放防禦、蓄力三選一
  | 'extra_action'           // 額外行動階段：抽2、偵查、破勢、進攻四選一，或跳過
  | 'wall_breached_response' // 城牆攻破階段：防守方從手牌補牌防守
  | 'finished';              // 遊戲結束階段

export interface GameState {
  player1: PlayerState;
  player2: PlayerState;
  drawPile: Card[];         // 公共牌堆
  discardPile: Card[];      // 棄牌堆
  activePlayerId: string;   // 當前行動的玩家 ID
  turnCount: number;        // 當前回合數
  phase: GamePhase;         // 當前遊戲階段
  hasDoneExtraAction: boolean; // 本回合是否已執行過額外行動
  setupState?: {
    player1Ready: boolean;
    player2Ready: boolean;
    // 玩家抽到的初始 9 張牌 (防窺，暫存在 setupState)
    player1Draft: Card[];
    player2Draft: Card[];
  };
  breachedResponseState?: {
    defenderId: string;        // 需回應城牆被攻破的防守方玩家 ID
    breachedWallIndex: number; // 被攻破的城牆索引 (0 或 1)
    cardsPlacedThisTurn: number; // 已經在此反應階段放置的卡牌數量 (最多 2)
  };
  winnerId?: string;        // 獲勝玩家 ID
  logs: string[];           // 行動紀錄日誌
}
