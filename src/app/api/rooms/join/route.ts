import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { initGameState } from '@/lib/game/engine';
import { filterGameStateForViewer } from '@/lib/game/mask';
import { GameState } from '@/lib/game/types';

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
          error: '您是房主，不能加入自己建立的房間。請提供房間代碼給另一位玩家加入',
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

    return NextResponse.json({ room: result.room, gameState: filtered });
  } catch (error: any) {
    console.error('加入房間錯誤:', error);
    return NextResponse.json(
      { error: '加入房間時發生錯誤' },
      { status: 500 }
    );
  }
}
