// 攻城牌核心遊戲引擎 - 包含所有規則與狀態移轉邏輯 (繁體中文註解)

import { Card, CardSuit, GameState, PlayerState, AttackCard, Wall } from './types';

// 洗牌函數
export function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// 建立一副撲克牌 (52張)
export function createDeck(): Card[] {
  const suits: CardSuit[] = ['H', 'D', 'C', 'S'];
  const deck: Card[] = [];
  let idCounter = 1;

  for (const suit of suits) {
    for (let value = 1; value <= 13; value++) {
      deck.push({
        id: `card_${suit}_${value}_${idCounter++}`,
        suit,
        value,
      });
    }
  }
  return deck;
}

// 格式化卡牌名稱，用於 Log 輸出
export function formatCard(card: Card): string {
  const suitMap = { H: '紅心', D: '方塊', C: '梅花', S: '黑桃' };
  const valueMap: Record<number, string> = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' };
  const valStr = valueMap[card.value] || card.value.toString();
  return `【${suitMap[card.suit]}${valStr}】`;
}

// 安全抽牌函數：若牌堆空了，將棄牌堆洗回牌堆
export function drawCards(state: GameState, count: number): Card[] {
  const drawn: Card[] = [];
  for (let i = 0; i < count; i++) {
    if (state.drawPile.length === 0) {
      if (state.discardPile.length === 0) {
        break; // 全場無牌可抽
      }
      state.drawPile = shuffle([...state.discardPile]);
      state.discardPile = [];
      state.logs.push('【系統】公共牌堆已空，已將棄牌堆洗回公共牌堆。');
    }
    const card = state.drawPile.pop();
    if (card) {
      drawn.push(card);
    }
  }
  return drawn;
}

// 初始化遊戲狀態
export function initGameState(
  p1Id: string,
  p1Email: string,
  p2Id: string,
  p2Email: string
): GameState {
  const deck = shuffle(createDeck());

  // 每位玩家抽 9 張初始牌
  const p1Draft = deck.splice(0, 9);
  const p2Draft = deck.splice(0, 9);

  const player1: PlayerState = {
    id: p1Id,
    email: p1Email,
    hand: [],
    walls: [
      { cards: [], breached: false, revealed: [] }, // 第一層 (上限 20)
      { cards: [], breached: false, revealed: [] }, // 第二層 (上限 30)
      { cards: [], breached: false, revealed: [] }, // 第三層 (上限 40)
    ],
    attackZone: [],
  };

  const player2: PlayerState = {
    id: p2Id,
    email: p2Email,
    hand: [],
    walls: [
      { cards: [], breached: false, revealed: [] },
      { cards: [], breached: false, revealed: [] },
      { cards: [], breached: false, revealed: [] },
    ],
    attackZone: [],
  };

  return {
    player1,
    player2,
    drawPile: deck,
    discardPile: [],
    activePlayerId: p1Id,
    turnCount: 1,
    phase: 'setup',
    hasDoneExtraAction: false,
    setupState: {
      player1Ready: false,
      player2Ready: false,
      player1Draft: p1Draft,
      player2Draft: p2Draft,
    },
    logs: ['【系統】遊戲開始，進入開局配置階段。每位玩家已抽 9 張牌，請配置 3 張防守牌與 2 張攻擊牌。'],
  };
}

// 獲取玩家與對手狀態
export function getPlayers(state: GameState, playerId: string) {
  if (state.player1.id === playerId) {
    return { player: state.player1, opponent: state.player2, key: 'player1' as const, oppKey: 'player2' as const };
  } else if (state.player2.id === playerId) {
    return { player: state.player2, opponent: state.player1, key: 'player2' as const, oppKey: 'player1' as const };
  }
  throw new Error('未知的玩家 ID');
}

// 計算城牆當前防禦值
export function getWallDefenseValue(wall: Wall): number {
  if (wall.breached) return 0;
  return wall.cards.reduce((sum, c) => sum + c.value, 0);
}

// 計算當前攻擊值
export function getAttackValue(attackZone: AttackCard[]): number {
  return attackZone.reduce((sum, ac) => sum + ac.card.value + ac.charge, 0);
}

// 1. 開局玩家配置防守牌與攻擊牌
export function setupPlayer(
  state: GameState,
  playerId: string,
  defenseCardIds: string[], // 必須是 3 張
  attackCardIds: string[]  // 必須是 2 張
): GameState {
  if (state.phase !== 'setup' || !state.setupState) {
    throw new Error('目前不是開局配置階段');
  }

  const { player, key } = getPlayers(state, playerId);
  const draft = key === 'player1' ? state.setupState.player1Draft : state.setupState.player2Draft;

  // 驗證選擇的卡牌是否均在 draft 中
  const selectedIds = [...defenseCardIds, ...attackCardIds];
  const allInDraft = selectedIds.every(id => draft.some(c => c.id === id));
  if (!allInDraft || defenseCardIds.length !== 3 || attackCardIds.length !== 2) {
    throw new Error('請選擇正確數量的開局配置卡牌');
  }

  // 抽出卡牌
  const defenseCards = defenseCardIds.map(id => draft.find(c => c.id === id)!);
  const attackCards = attackCardIds.map(id => draft.find(c => c.id === id)!);
  const remainingHand = draft.filter(c => !selectedIds.includes(c.id));

  // 配置防禦牆 (各放 1 張，蓋牌)
  player.walls[0].cards = [defenseCards[0]];
  player.walls[0].revealed = [false];
  player.walls[1].cards = [defenseCards[1]];
  player.walls[1].revealed = [false];
  player.walls[2].cards = [defenseCards[2]];
  player.walls[2].revealed = [false];

  // 配置攻擊牌 (放 2 張，公開，charge=0)
  player.attackZone = attackCards.map(c => ({ card: c, charge: 0 }));

  // 剩餘 4 張牌入手牌
  player.hand = remainingHand;

  // 標記該玩家已就緒
  if (key === 'player1') {
    state.setupState.player1Ready = true;
  } else {
    state.setupState.player2Ready = true;
  }

  state.logs.push(`【系統】玩家 ${player.email} 已完成開局配置。`);

  // 若雙方皆就緒，正式進入第一回合
  if (state.setupState.player1Ready && state.setupState.player2Ready) {
    state.phase = 'main_action';
    state.setupState = undefined;
    state.activePlayerId = state.player1.id;
    state.turnCount = 1;
    state.hasDoneExtraAction = false;
    state.logs.push('【系統】雙方配置完成！進入第一回合，輪到玩家 ' + state.player1.email + ' 的主要行動階段（第一回合不可進攻）。');
  }

  return state;
}

// 2. 主要行動 1：放攻擊牌
export function placeAttackCards(
  state: GameState,
  playerId: string,
  cardIds: string[], // 放 1~2 張
  replaceIds?: string[] // 若攻擊區滿了 (最多4張)，要替换的卡牌 ID (最多2張)
): GameState {
  if (state.phase !== 'main_action' || state.activePlayerId !== playerId) {
    throw new Error('不是您的主要行動階段');
  }

  const { player } = getPlayers(state, playerId);

  if (cardIds.length < 1 || cardIds.length > 2) {
    throw new Error('必須放置 1~2 張攻擊牌');
  }

  // 驗證卡牌在手牌中
  const cardsToPlace = cardIds.map(id => {
    const c = player.hand.find(h => h.id === id);
    if (!c) throw new Error('手牌中找不到指定的卡牌');
    return c;
  });

  // 計算放置後的攻擊區大小
  const currentCount = player.attackZone.length;
  const placeCount = cardIds.length;
  const replaceCount = replaceIds?.length || 0;
  const nextCount = currentCount + placeCount - replaceCount;

  if (nextCount > 4) {
    throw new Error('攻擊區最多只能容納 4 張卡牌，請提供需要替換的卡牌');
  }

  // 處理替換卡牌進入棄牌堆
  if (replaceIds && replaceIds.length > 0) {
    if (replaceIds.length !== replaceCount) {
      throw new Error('替換卡牌數量不符');
    }
    const toDiscard: Card[] = [];
    player.attackZone = player.attackZone.filter(ac => {
      const isReplaced = replaceIds.includes(ac.card.id);
      if (isReplaced) {
        toDiscard.push(ac.card);
      }
      return !isReplaced;
    });
    state.discardPile.push(...toDiscard);
    state.logs.push(`【行動】玩家 ${player.email} 替換了 ${replaceIds.length} 張攻擊牌進棄牌堆。`);
  }

  // 從手牌移除
  player.hand = player.hand.filter(c => !cardIds.includes(c.id));

  // 新牌加入攻擊區，charge = 0
  const newAttackCards = cardsToPlace.map(card => ({ card, charge: 0 }));
  player.attackZone.push(...newAttackCards);

  const cardNames = cardsToPlace.map(formatCard).join('、');
  state.logs.push(`【行動】玩家 ${player.email} 從手牌放了 ${placeCount} 張攻擊牌到攻擊區：${cardNames}。`);

  // 進入額外行動階段
  state.phase = 'extra_action';
  return state;
}

// 3. 主要行動 2：放防守牌
export function placeDefenseCards(
  state: GameState,
  playerId: string,
  wallIndex: number, // 0: 第一層 (限20), 1: 第二層 (限30), 2: 第三層 (限40)
  cardIds: string[]  // 1~2 張
): GameState {
  if (state.phase !== 'main_action' || state.activePlayerId !== playerId) {
    throw new Error('不是您的主要行動階段');
  }

  const { player } = getPlayers(state, playerId);

  if (wallIndex < 0 || wallIndex > 2) {
    throw new Error('無效的城牆層數');
  }

  const targetWall = player.walls[wallIndex];
  if (targetWall.breached) {
    throw new Error('該城牆已被攻破，無法放置防守牌');
  }

  if (cardIds.length < 1 || cardIds.length > 2) {
    throw new Error('必須放置 1~2 張防守牌');
  }

  // 驗證卡牌在手牌中
  const cardsToPlace = cardIds.map(id => {
    const c = player.hand.find(h => h.id === id);
    if (!c) throw new Error('手牌中找不到指定的卡牌');
    return c;
  });

  // 檢查加上新卡牌後是否超過上限
  const currentSum = targetWall.cards.reduce((sum, c) => sum + c.value, 0);
  const newSum = cardsToPlace.reduce((sum, c) => sum + c.value, currentSum);
  const limits = [20, 30, 40];
  const limit = limits[wallIndex];

  if (newSum > limit) {
    throw new Error(`放置防守牌後將超過該層城牆上限值 (${limit})，目前加總為 ${newSum}`);
  }

  // 從手牌扣除並放到城牆 (蓋牌)
  player.hand = player.hand.filter(c => !cardIds.includes(c.id));
  targetWall.cards.push(...cardsToPlace);
  targetWall.revealed.push(...cardsToPlace.map(() => false));

  state.logs.push(`【行動】玩家 ${player.email} 往 第 ${wallIndex + 1} 層城牆 (防守值變更為 ${newSum}/${limit}) 放入了 ${cardIds.length} 張防守牌（蓋牌）。`);

  // 進入額外行動階段
  state.phase = 'extra_action';
  return state;
}

// 4. 主要行動 3：續力
export function chargeAttackZone(state: GameState, playerId: string): GameState {
  if (state.phase !== 'main_action' || state.activePlayerId !== playerId) {
    throw new Error('不是您的主要行動階段');
  }

  const { player } = getPlayers(state, playerId);

  if (player.attackZone.length === 0) {
    throw new Error('攻擊區沒有卡牌，無法續力');
  }

  // 己方攻擊區所有牌 charge +1
  player.attackZone.forEach(ac => {
    ac.charge += 1;
  });

  state.logs.push(`【行動】玩家 ${player.email} 執行蓄力，攻擊區所有卡牌的蓄力值 (Charge) +1。`);

  // 進入額外行動階段
  state.phase = 'extra_action';
  return state;
}

// 5. 額外行動 1：抽兩張 (受手牌上限 8 限制)
export function drawTwoCards(state: GameState, playerId: string): GameState {
  if (state.phase !== 'extra_action' || state.activePlayerId !== playerId) {
    throw new Error('不是您的額外行動階段');
  }
  if (state.hasDoneExtraAction) {
    throw new Error('此回合您已執行過額外行動');
  }

  const { player } = getPlayers(state, playerId);

  // 檢查手牌是否已達上限 8 張
  if (player.hand.length >= 8) {
    throw new Error('手牌已達上限 8 張，無法抽牌');
  }

  // 抽牌，受手牌上限 8 張限制 (提案 A: 只抽到手牌上限，其餘忽略)
  const drawCount = Math.min(2, 8 - player.hand.length);
  const drawn = drawCards(state, drawCount);
  player.hand.push(...drawn);

  state.logs.push(`【額外行動】玩家 ${player.email} 執行抽卡，抽了 ${drawn.length} 張牌。`);
  state.hasDoneExtraAction = true;

  return state;
}

// 6. 額外行動 2：偵查 (查看對方任意 2 張蓋牌防禦牌，看完蓋回)
// 此處 engine 只做基本驗證與 Log 記錄，實際在 API 回傳值中將這兩張牌回傳給前端顯示，但不改變 DB status 的 revealed 為 true
export function scoutDefense(
  state: GameState,
  playerId: string,
  targetWallIndex: number,
  cardIndexes: number[] // 長度應為 1~2
): { state: GameState; scoutedCards: Card[] } {
  if (state.phase !== 'extra_action' || state.activePlayerId !== playerId) {
    throw new Error('不是您的額外行動階段');
  }
  if (state.hasDoneExtraAction) {
    throw new Error('此回合您已執行過額外行動');
  }

  const { player, opponent } = getPlayers(state, playerId);

  if (targetWallIndex < 0 || targetWallIndex > 2) {
    throw new Error('無效的城牆層數');
  }

  const targetWall = opponent.walls[targetWallIndex];
  if (targetWall.breached) {
    throw new Error('該城牆已被攻破，無法偵查');
  }

  if (cardIndexes.length < 1 || cardIndexes.length > 2) {
    throw new Error('必須偵查 1~2 張卡牌');
  }

  const scoutedCards: Card[] = [];
  for (const idx of cardIndexes) {
    if (idx < 0 || idx >= targetWall.cards.length) {
      throw new Error('指定的卡牌索引無效');
    }
    if (targetWall.revealed[idx]) {
      throw new Error('該卡牌已是公開狀態，不需偵查');
    }
    scoutedCards.push(targetWall.cards[idx]);
  }

  state.logs.push(`【額外行動】玩家 ${player.email} 對對手第 ${targetWallIndex + 1} 層城牆執行了偵查，探查了 ${scoutedCards.length} 張卡牌。`);
  state.hasDoneExtraAction = true;

  return { state, scoutedCards };
}

// 7. 額外行動 3：破勢 (公開對方 1~2 張蓋牌防守牌，然後選場上 1~2 張攻擊牌使 charge 歸 0)
export function disruptDefense(
  state: GameState,
  playerId: string,
  scoutPlacements: { wallIndex: number; cardIndex: number }[], // 對方蓋牌，1~2張
  resetAttackPlacements: { playerKey: 'player1' | 'player2'; cardIndex: number }[] // 場上攻擊卡，1~2張
): GameState {
  if (state.phase !== 'extra_action' || state.activePlayerId !== playerId) {
    throw new Error('不是您的額外行動階段');
  }
  if (state.hasDoneExtraAction) {
    throw new Error('此回合您已執行過額外行動');
  }

  const { player, opponent } = getPlayers(state, playerId);

  if (scoutPlacements.length < 1 || scoutPlacements.length > 2) {
    throw new Error('必須公開對方 1~2 張蓋牌防守牌');
  }
  if (resetAttackPlacements.length < 1 || resetAttackPlacements.length > 2) {
    throw new Error('必須選擇場上 1~2 張攻擊牌進行壓制');
  }

  // 1. 公開對方城牆蓋牌
  const revealedDetails: string[] = [];
  for (const { wallIndex, cardIndex } of scoutPlacements) {
    if (wallIndex < 0 || wallIndex > 2) throw new Error('無效的城牆層數');
    const wall = opponent.walls[wallIndex];
    if (wall.breached) throw new Error('城牆已被攻破');
    if (cardIndex < 0 || cardIndex >= wall.cards.length) throw new Error('卡牌索引無效');
    if (wall.revealed[cardIndex]) throw new Error('該防守牌已經公開');

    wall.revealed[cardIndex] = true;
    revealedDetails.push(`第 ${wallIndex + 1} 層防守牌 ${formatCard(wall.cards[cardIndex])}`);
  }

  // 2. 使場上攻擊牌 charge 歸 0
  const resetDetails: string[] = [];
  for (const { playerKey, cardIndex } of resetAttackPlacements) {
    const targetPlayer = state[playerKey];
    if (cardIndex < 0 || cardIndex >= targetPlayer.attackZone.length) {
      throw new Error('攻擊卡牌索引無效');
    }
    const ac = targetPlayer.attackZone[cardIndex];
    ac.charge = 0;
    resetDetails.push(`${targetPlayer.email} 的攻擊牌 ${formatCard(ac.card)}`);
  }

  state.logs.push(`【額外行動】玩家 ${player.email} 執行破勢：`);
  state.logs.push(`  - 公開了對手：${revealedDetails.join('、')}`);
  state.logs.push(`  - 將以下攻擊卡蓄力值歸零：${resetDetails.join('、')}`);

  state.hasDoneExtraAction = true;
  return state;
}

// 8. 額外行動 4：進攻 (進攻對方最前方未破城牆)
export function attackWall(state: GameState, playerId: string): GameState {
  if (state.phase !== 'extra_action' || state.activePlayerId !== playerId) {
    throw new Error('不是您的額外行動階段');
  }
  if (state.hasDoneExtraAction) {
    throw new Error('此回合您已執行過額外行動');
  }
  if (state.turnCount === 1) {
    throw new Error('第一回合雙方都不能進攻');
  }

  const { player, opponent, oppKey } = getPlayers(state, playerId);

  // 取得對手最前線未被攻破的城牆
  const wallIndex = opponent.walls.findIndex(w => !w.breached);
  if (wallIndex === -1) {
    throw new Error('對手所有城牆已被攻破');
  }

  const targetWall = opponent.walls[wallIndex];

  // 計算攻擊力 (攻擊牌面數值總和 + charge 總和)
  const attackValue = getAttackValue(player.attackZone);
  // 計算防守力 (城牆防守牌數值總和)
  const defenseValue = getWallDefenseValue(targetWall);

  state.logs.push(`【額外行動】玩家 ${player.email} 進攻對手第 ${wallIndex + 1} 層城牆！`);
  state.logs.push(`  - 攻擊值為 ${attackValue}（牌面和與 Charge 和）`);
  state.logs.push(`  - 防禦值為 ${defenseValue}（防禦牆上所有牌面和）`);

  const breached = attackValue > defenseValue;

  // 無論成功與否，進攻方攻擊區所有牌皆進棄牌堆
  const attackerCards = player.attackZone.map(ac => ac.card);
  state.discardPile.push(...attackerCards);
  player.attackZone = [];

  if (breached) {
    targetWall.breached = true;
    // 攻破城牆上的所有牌進入防護方棄牌堆
    state.discardPile.push(...targetWall.cards);
    targetWall.cards = [];
    targetWall.revealed = [];

    state.logs.push(`【戰報】攻破成功！對手第 ${wallIndex + 1} 層城牆已被擊毀。`);

    // 若第三層被攻破，防守方敗北
    if (wallIndex === 2) {
      state.phase = 'finished';
      state.winnerId = player.id;
      state.logs.push(`【結算】防線崩潰！玩家 ${player.email} 獲得了勝利！`);
    } else {
      // 否則，防護方立即抽 2 張，並可補最多 2 張手牌至其餘城牆
      const defenderDraw = drawCards(state, Math.min(2, 8 - opponent.hand.length));
      opponent.hand.push(...defenderDraw);

      state.logs.push(`【系統】玩家 ${opponent.email} 抽取了 ${defenderDraw.length} 張補牌，進入緊急防守補牌狀態。`);

      // 移轉到防守補牌階段
      state.phase = 'wall_breached_response';
      state.breachedResponseState = {
        defenderId: opponent.id,
        breachedWallIndex: wallIndex,
        cardsPlacedThisTurn: 0,
      };
    }
  } else {
    state.logs.push('【戰報】進攻失敗！城牆堅固如初，進攻卡牌全數損毀。');
    // 進攻失敗直接換下一位玩家
    state = endTurn(state, playerId);
  }

  return state;
}

// 9. 緊急防守補牌行動 (城牆破裂後，被攻破玩家從手牌放最多 2 張到任意剩餘未破城牆)
export function respondToBreach(
  state: GameState,
  playerId: string,
  placements: { wallIndex: number; cardId: string }[] // 長度最多 2
): GameState {
  if (state.phase !== 'wall_breached_response' || !state.breachedResponseState) {
    throw new Error('目前不是城牆破裂反應階段');
  }
  if (state.breachedResponseState.defenderId !== playerId) {
    throw new Error('不是您的防守補牌階段');
  }

  const { player } = getPlayers(state, playerId);

  if (placements.length > 2) {
    throw new Error('最多只能放置 2 張防守牌');
  }

  // 逐一驗證並放置防守牌
  const limits = [20, 30, 40];
  const activePlacements = placements.filter(p => p.cardId); // 過濾可能為空的項

  for (const placement of activePlacements) {
    const { wallIndex, cardId } = placement;

    if (wallIndex < 0 || wallIndex > 2) {
      throw new Error('無效的城牆層數');
    }
    if (wallIndex === state.breachedResponseState.breachedWallIndex) {
      throw new Error('不能放置牌於剛剛已被攻破的城牆');
    }

    const wall = player.walls[wallIndex];
    if (wall.breached) {
      throw new Error('不能放置防守牌於已攻破的城牆');
    }

    // 檢查手牌
    const card = player.hand.find(c => c.id === cardId);
    if (!card) {
      throw new Error('手牌中找不到指定的防守牌');
    }

    // 驗證放置後是否超限
    const currentSum = wall.cards.reduce((sum, c) => sum + c.value, 0);
    const newSum = currentSum + card.value;
    const limit = limits[wallIndex];

    if (newSum > limit) {
      throw new Error(`放置防守牌後將超過第 ${wallIndex + 1} 層城牆上限 (${limit})，目前加總為 ${newSum}`);
    }

    // 移動卡牌
    player.hand = player.hand.filter(c => c.id !== cardId);
    wall.cards.push(card);
    wall.revealed.push(false);

    state.logs.push(`【補防】玩家 ${player.email} 補防第 ${wallIndex + 1} 層城牆，放入一張防禦牌 (防守值變更為 ${newSum}/${limit})。`);
  }

  // 清除反應狀態
  state.breachedResponseState = undefined;
  
  // 反應結束後，原進攻方的回合強制結束，切換給防護方 (因為進攻是額外行動，已是回合尾聲)
  // 此時原 activePlayerId 應該是進攻方，我們要換成防守方 (即當前的 playerId)
  state.activePlayerId = playerId;
  
  // 若輪到 player1 開始新回合，回合數 +1
  if (state.activePlayerId === state.player1.id) {
    state.turnCount += 1;
  }
  
  state.hasDoneExtraAction = false;
  state.phase = 'main_action';
  
  state.logs.push(`【系統】防守配置完成。進入第 ${state.turnCount} 回合，輪到玩家 ${player.email} 的主要行動階段。`);

  return state;
}

// 10. 跳過額外行動 / 結束回合
export function skipExtraAction(state: GameState, playerId: string): GameState {
  if (state.phase !== 'extra_action' || state.activePlayerId !== playerId) {
    throw new Error('目前不能執行此操作');
  }
  state.logs.push(`【行動】玩家 ${state.player1.id === playerId ? state.player1.email : state.player2.email} 選擇跳過額外行動。`);
  return endTurn(state, playerId);
}

// 結束回合與切換玩家
export function endTurn(state: GameState, playerId: string): GameState {
  const { opponent } = getPlayers(state, playerId);

  // 切換當前行動玩家
  state.activePlayerId = opponent.id;
  state.hasDoneExtraAction = false;
  state.phase = 'main_action';

  // 如果交棒回給 player1，則回合數增加
  if (state.activePlayerId === state.player1.id) {
    state.turnCount += 1;
  }

  state.logs.push(`【系統】回合交替。進入第 ${state.turnCount} 回合，輪到玩家 ${opponent.email} 的主要行動階段。`);
  
  return state;
}
