import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { initGameState } from '@/lib/game/engine';

function generateRoomCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: '未授權，請先登入' }, { status: 401 });
    }

    const { localGuest } = await req.json().catch(() => ({ localGuest: false }));

    // 產生唯一的房間邀請碼
    let code = '';
    let isUnique = false;
    let attempts = 0;
    while (!isUnique && attempts < 10) {
      code = generateRoomCode();
      const existing = await db.room.findUnique({ where: { code } });
      if (!existing) {
        isUnique = true;
      }
      attempts++;
    }

    if (!isUnique) {
      return NextResponse.json({ error: '無法產生唯一的房間代碼，請重試' }, { status: 500 });
    }

    let room;
    if (localGuest) {
      // 建立與本機 Guest 對戰的房間，直接初始化遊戲狀態
      const initialGameState = initGameState(
        user.id,
        user.email,
        'guest',
        'Guest (本機客場玩家)'
      );

      room = await db.room.create({
        data: {
          code,
          player1Id: user.id,
          player2Id: null, // 資料庫中 player2 設為 null，但在遊戲邏輯中使用 'guest'
          status: 'PLAYING',
          gameState: initialGameState as any,
        },
      });
    } else {
      // 一般等待對手加入的房間
      room = await db.room.create({
        data: {
          code,
          player1Id: user.id,
          status: 'WAITING',
        },
      });
    }

    return NextResponse.json({ room });
  } catch (error: any) {
    console.error('創建房間錯誤:', error);
    return NextResponse.json(
      { error: '創建房間時發生錯誤' },
      { status: 500 }
    );
  }
}
