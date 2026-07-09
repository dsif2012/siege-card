import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { GameState } from '@/lib/game/types';
import * as engine from '@/lib/game/engine';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const user = await getCurrentUser(req);

    if (!user) {
      return NextResponse.json({ error: '未授權，請先登入' }, { status: 401 });
    }

    const room = await db.room.findUnique({
      where: { code: code.toUpperCase() },
      include: {
        player1: { select: { id: true, email: true } },
        player2: { select: { id: true, email: true } },
      },
    });

    if (!room) {
      return NextResponse.json({ error: '找不到指定的房間' }, { status: 404 });
    }

    if (room.status !== 'PLAYING') {
      return NextResponse.json({ error: '該房間目前不允許進行遊戲行動' }, { status: 400 });
    }

    const gameState = room.gameState as unknown as GameState;
    if (!gameState) {
      return NextResponse.json({ error: '遊戲未初始化' }, { status: 400 });
    }

    const body = await req.json();
    const { action, payload } = body;

    const isPlayer1 = room.player1Id === user.id;
    const isPlayer2 = room.player2Id === user.id;
    const isLocalGuest = gameState.player2.id === 'guest';

    // 權限驗證：
    // 1. 如果是本機單機 Guest 模式，房主 (Player 1) 可以替雙方操作
    // 2. 如果是線上模式，操作者必須是當前回合玩家 (activePlayerId)
    // 3. 在緊急防守補牌階段，操作者必須是防守方 (defenderId)
    let actionPlayerId = '';
    if (gameState.phase === 'wall_breached_response' && gameState.breachedResponseState) {
      actionPlayerId = gameState.breachedResponseState.defenderId;
    } else if (gameState.phase === 'setup') {
      // 設置階段，玩家設定各自的卡牌
      actionPlayerId = isPlayer1 ? room.player1Id : (room.player2Id || 'guest');
    } else {
      actionPlayerId = gameState.activePlayerId;
    }

    const isAuthorized = isLocalGuest
      ? isPlayer1 // 單機模式下，只有房主可以發送請求
      : (actionPlayerId === room.player1Id && isPlayer1) || (actionPlayerId === room.player2Id && isPlayer2);

    if (!isAuthorized && action !== 'restart') {
      return NextResponse.json({ error: '現在不是您的回合或您無權操作此玩家' }, { status: 403 });
    }

    // 為了安全，使用深拷貝處理狀態
    let nextState: GameState = JSON.parse(JSON.stringify(gameState));
    let responseData: any = {};

    // 根據行動呼叫遊戲引擎
    switch (action) {
      case 'setup': {
        const { defenseCardIds, attackCardIds } = payload;
        nextState = engine.setupPlayer(nextState, actionPlayerId, defenseCardIds, attackCardIds);
        break;
      }
      case 'place_attack': {
        const { cardIds, replaceIds } = payload;
        nextState = engine.placeAttackCards(nextState, actionPlayerId, cardIds, replaceIds);
        break;
      }
      case 'place_defense': {
        const { wallIndex, cardIds } = payload;
        nextState = engine.placeDefenseCards(nextState, actionPlayerId, wallIndex, cardIds);
        break;
      }
      case 'charge': {
        nextState = engine.chargeAttackZone(nextState, actionPlayerId);
        break;
      }
      case 'draw': {
        nextState = engine.drawTwoCards(nextState, actionPlayerId);
        break;
      }
      case 'scout': {
        const { targetWallIndex, cardIndexes } = payload;
        const result = engine.scoutDefense(nextState, actionPlayerId, targetWallIndex, cardIndexes);
        nextState = result.state;
        responseData.scoutedCards = result.scoutedCards; // 回傳給前端本次偵查到的蓋牌內容
        break;
      }
      case 'disrupt': {
        const { scoutPlacements, resetAttackPlacements } = payload;
        nextState = engine.disruptDefense(nextState, actionPlayerId, scoutPlacements, resetAttackPlacements);
        break;
      }
      case 'attack': {
        nextState = engine.attackWall(nextState, actionPlayerId);
        break;
      }
      case 'respond_breach': {
        const { placements } = payload;
        nextState = engine.respondToBreach(nextState, actionPlayerId, placements);
        break;
      }
      case 'skip_extra': {
        nextState = engine.skipExtraAction(nextState, actionPlayerId);
        break;
      }
      case 'restart': {
        // 重開一局按鈕 (雙方皆可重開)
        const p2Id = isLocalGuest ? 'guest' : (room.player2Id || 'guest');
        const p2Email = isLocalGuest ? 'Guest (本機客場玩家)' : (room.player2?.email || 'Guest');
        nextState = engine.initGameState(room.player1Id, room.player1.email, p2Id, p2Email);
        nextState.logs.push(`【重啟】玩家 ${user.email} 重啟了遊戲。`);
        break;
      }
      default:
        return NextResponse.json({ error: '無效的遊戲行動' }, { status: 400 });
    }

    // 檢查遊戲是否結束，更新房間狀態
    let roomStatus = room.status;
    let roomWinnerId = room.winnerId;

    if (nextState.phase === 'finished') {
      roomStatus = 'FINISHED';
      roomWinnerId = nextState.winnerId === 'guest' ? null : nextState.winnerId || null;
    }

    // 將新狀態寫入資料庫
    const updatedRoom = await db.room.update({
      where: { code: code.toUpperCase() },
      data: {
        status: roomStatus,
        winnerId: roomWinnerId,
        gameState: nextState as any,
      },
    });

    // 如果不是單機模式，也對回應回來的 gameState 進行過濾
    let returnedState = nextState;
    if (!isLocalGuest) {
      returnedState = JSON.parse(JSON.stringify(nextState));
      const maskCard = (c: any) => ({ id: c.id, suit: 'H' as const, value: 0 });
      const maskWall = (w: any) => ({
        ...w,
        cards: w.cards.map((c: any, i: number) => (w.revealed[i] ? c : maskCard(c))),
      });

      if (isPlayer1) {
        returnedState.player2.hand = returnedState.player2.hand.map(maskCard);
        returnedState.player2.walls = returnedState.player2.walls.map(maskWall);
      } else if (isPlayer2) {
        returnedState.player1.hand = returnedState.player1.hand.map(maskCard);
        returnedState.player1.walls = returnedState.player1.walls.map(maskWall);
      }
    }

    return NextResponse.json({
      room: updatedRoom,
      gameState: returnedState,
      ...responseData,
    });
  } catch (error: any) {
    console.error('執行行動出錯:', error);
    return NextResponse.json(
      { error: error.message || '執行行動時發生錯誤' },
      { status: 400 }
    );
  }
}
