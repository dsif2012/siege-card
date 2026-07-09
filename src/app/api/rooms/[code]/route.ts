import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { GameState } from '@/lib/game/types';
import { filterGameStateForViewer } from '@/lib/game/mask';
import { syncRoomPhaseTimeout } from '@/lib/game/room-timeout';

export async function GET(
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

    const isPlayer1 = room.player1Id === user.id;
    const isPlayer2 = room.player2Id === user.id;
    const isMember = isPlayer1 || isPlayer2;

    const synced = await syncRoomPhaseTimeout(room, Date.now());
    const liveRoom = synced.room;

    // WAITING：尚無 gameState，僅房主可讀（對手應走 join）
    if (!liveRoom.gameState) {
      if (!isPlayer1) {
        return NextResponse.json({ error: '您不是此房間成員' }, { status: 403 });
      }
      return NextResponse.json({ room: liveRoom, gameState: null });
    }

    const gameState = (synced.gameState ?? liveRoom.gameState) as unknown as GameState;
    const isLocalGuest = gameState.player2.id === 'guest';

    // 線上房間僅成員可讀；本機熱座僅房主
    if (isLocalGuest) {
      if (!isPlayer1) {
        return NextResponse.json({ error: '您不是此房間成員' }, { status: 403 });
      }
      return NextResponse.json({ room: liveRoom, gameState });
    }

    if (!isMember) {
      return NextResponse.json({ error: '您不是此房間成員' }, { status: 403 });
    }

    const filteredState = filterGameStateForViewer(gameState, user.id);

    return NextResponse.json({
      room: liveRoom,
      gameState: filteredState,
    });
  } catch (error: any) {
    console.error('獲取房間狀態出錯:', error);
    return NextResponse.json(
      { error: '獲取房間狀態時發生錯誤' },
      { status: 500 }
    );
  }
}
