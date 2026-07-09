import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { initGameState } from '@/lib/game/engine';
import { filterGameStateForViewer } from '@/lib/game/mask';
import { GameState } from '@/lib/game/types';
import { publishRoom } from '@/lib/room-events';

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: '未授權，請先登入' }, { status: 401 });
    }

    const { code } = await req.json();
    if (!code) {
      return NextResponse.json({ error: '請輸入房間代碼' }, { status: 400 });
    }

    const upperCode = code.trim().toUpperCase();

    const result = await db.$transaction(async (tx) => {
      const room = await tx.room.findUnique({
        where: { code: upperCode },
        include: { player1: true },
      });

      if (!room) {
        return { error: '找不到指定的房間', status: 404 as const };
      }

      if (room.status !== 'WAITING' || room.player2Id) {
        return { error: '該房間已在遊戲中或已結束', status: 400 as const };
      }

      if (room.player1Id === user.id) {
        return {
          error: `身分衝突：此房房主是 ${room.player1.email}，但您目前 cookie 登入也是 ${user.email}（同一帳號）。若您剛換成另一帳號，請先「解甲登出」再重新登入，或清除此網站 Cookie 後重試。`,
          status: 400 as const,
        };
      }

      const claimed = await tx.room.updateMany({
        where: {
          code: upperCode,
          status: 'WAITING',
          player2Id: null,
        },
        data: {
          player2Id: user.id,
          status: 'PLAYING',
        },
      });

      if (claimed.count === 0) {
        return { error: '該房間剛被其他玩家加入，請另開房間', status: 409 as const };
      }

      const initialGameState = initGameState(
        room.player1Id,
        room.player1.email,
        user.id,
        user.email
      );

      const updatedRoom = await tx.room.update({
        where: { code: upperCode },
        data: {
          gameState: initialGameState as any,
        },
        include: {
          player1: { select: { id: true, email: true } },
          player2: { select: { id: true, email: true } },
        },
      });

      return { room: updatedRoom, gameState: initialGameState as GameState };
    });

    if ('error' in result && result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const filtered = filterGameStateForViewer(result.gameState!, user.id);

    publishRoom(upperCode, result.room!.updatedAt.toISOString());

    return NextResponse.json({ room: result.room, gameState: filtered });
  } catch (error: any) {
    console.error('加入房間錯誤:', error);
    return NextResponse.json(
      { error: '加入房間時發生錯誤' },
      { status: 500 }
    );
  }
}
