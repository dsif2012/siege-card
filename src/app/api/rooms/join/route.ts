import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { initGameState } from '@/lib/game/engine';

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

    // 尋找房間與房主資訊
    const room = await db.room.findUnique({
      where: { code: upperCode },
      include: {
        player1: true,
      },
    });

    if (!room) {
      return NextResponse.json({ error: '找不到指定的房間' }, { status: 404 });
    }

    if (room.status !== 'WAITING') {
      return NextResponse.json({ error: '該房間已在遊戲中或已結束' }, { status: 400 });
    }

    if (room.player1Id === user.id) {
      return NextResponse.json(
        { error: '您是房主，不能加入自己建立的房間。請提供房間代碼給另一位玩家加入' },
        { status: 400 }
      );
    }

    // 初始化遊戲狀態
    const initialGameState = initGameState(
      room.player1Id,
      room.player1.email,
      user.id,
      user.email
    );

    // 更新房間狀態
    const updatedRoom = await db.room.update({
      where: { code: upperCode },
      data: {
        player2Id: user.id,
        status: 'PLAYING',
        gameState: initialGameState as any,
      },
    });

    return NextResponse.json({ room: updatedRoom });
  } catch (error: any) {
    console.error('加入房間錯誤:', error);
    return NextResponse.json(
      { error: '加入房間時發生錯誤' },
      { status: 500 }
    );
  }
}
