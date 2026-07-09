import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { GameState } from '@/lib/game/types';
import * as engine from '@/lib/game/engine';
import { filterGameStateForViewer } from '@/lib/game/mask';

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
    const isMember = isPlayer1 || isPlayer2;

    if (!isLocalGuest && !isMember && action !== 'restart') {
      return NextResponse.json({ error: '您不是此房間成員' }, { status: 403 });
    }
    if (isLocalGuest && !isPlayer1) {
      return NextResponse.json({ error: '您不是此房間成員' }, { status: 403 });
    }

    let actionPlayerId = '';
    if (gameState.phase === 'wall_breached_response' && gameState.breachedResponseState) {
      actionPlayerId = gameState.breachedResponseState.defenderId;
    } else if (gameState.phase === 'setup') {
      if (isLocalGuest) {
        actionPlayerId = gameState.setupState?.player1Ready
          ? gameState.player2.id
          : gameState.player1.id;
      } else {
        actionPlayerId = isPlayer1 ? room.player1Id! : room.player2Id!;
      }
    } else {
      actionPlayerId = gameState.activePlayerId;
    }

    const isAuthorized = isLocalGuest
      ? isPlayer1
      : (actionPlayerId === room.player1Id && isPlayer1) || (actionPlayerId === room.player2Id && isPlayer2);

    if (!isAuthorized && action !== 'restart') {
      return NextResponse.json({ error: '現在不是您的回合或您無權操作此玩家' }, { status: 403 });
    }
    if (action === 'restart' && !isMember && !isLocalGuest) {
      return NextResponse.json({ error: '您不是此房間成員' }, { status: 403 });
    }
    if (action === 'restart' && isLocalGuest && !isPlayer1) {
      return NextResponse.json({ error: '您不是此房間成員' }, { status: 403 });
    }

    let nextState: GameState = JSON.parse(JSON.stringify(gameState));
    let responseData: Record<string, unknown> = {};

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
        responseData.scoutedCards = result.scoutedCards;
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
        const p2Id = isLocalGuest ? 'guest' : (room.player2Id || 'guest');
        const p2Email = isLocalGuest ? 'Guest (本機客場玩家)' : (room.player2?.email || 'Guest');
        nextState = engine.initGameState(room.player1Id, room.player1.email, p2Id, p2Email);
        nextState.logs.push(`【重啟】玩家 ${user.email} 重啟了遊戲。`);
        break;
      }
      default:
        return NextResponse.json({ error: '無效的遊戲行動' }, { status: 400 });
    }

    let roomStatus = room.status;
    let roomWinnerId = room.winnerId;

    if (nextState.phase === 'finished') {
      roomStatus = 'FINISHED';
      roomWinnerId = nextState.winnerId === 'guest' ? null : nextState.winnerId || null;
    } else if (action === 'restart') {
      roomStatus = 'PLAYING';
      roomWinnerId = null;
    }

    const updatedRoom = await db.room.update({
      where: { code: code.toUpperCase() },
      data: {
        status: roomStatus,
        winnerId: roomWinnerId,
        gameState: nextState as any,
      },
      include: {
        player1: { select: { id: true, email: true } },
        player2: { select: { id: true, email: true } },
      },
    });

    const returnedState = isLocalGuest
      ? nextState
      : filterGameStateForViewer(nextState, user.id);

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
