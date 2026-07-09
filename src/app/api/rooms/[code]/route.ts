import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { Card, GameState, Wall } from '@/lib/game/types';

// 將卡牌資訊遮罩，防止作弊
function maskCard(card: Card): Card {
  return {
    id: card.id,
    suit: 'H', // 虛設花色
    value: 0,  // 0 代表隱藏
  };
}

// 遮罩防守牆上未被公開的防禦卡
function maskWall(wall: Wall): Wall {
  return {
    ...wall,
    cards: wall.cards.map((card, idx) => (wall.revealed[idx] ? card : maskCard(card))),
  };
}

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

    if (!room.gameState) {
      return NextResponse.json({ room, gameState: null });
    }

    const gameState = room.gameState as unknown as GameState;
    const isPlayer1 = room.player1Id === user.id;
    const isPlayer2 = room.player2Id === user.id;
    const isLocalGuest = gameState.player2.id === 'guest';

    // 如果是本機單機 Hot-seat 模式，不對卡牌進行遮罩（因為同在一台裝置，由前端配合交接遮罩處理）
    if (isLocalGuest) {
      return NextResponse.json({ room, gameState });
    }

    // 否則為聯機對戰模式，執行嚴格的防窺遮罩
    const filteredState: GameState = JSON.parse(JSON.stringify(gameState));

    if (isPlayer1) {
      // 1. 隱藏 Player 2 的手牌
      filteredState.player2.hand = filteredState.player2.hand.map(maskCard);
      // 2. 隱藏 Player 2 城牆上未公開的牌
      filteredState.player2.walls = filteredState.player2.walls.map(maskWall);
    } else if (isPlayer2) {
      // 1. 隱藏 Player 1 的手牌
      filteredState.player1.hand = filteredState.player1.hand.map(maskCard);
      // 2. 隱藏 Player 1 城牆上未公開的牌
      filteredState.player1.walls = filteredState.player1.walls.map(maskWall);
    } else {
      // 旁觀者（或其他玩家）：兩邊的手牌與蓋牌皆隱藏
      filteredState.player1.hand = filteredState.player1.hand.map(maskCard);
      filteredState.player2.hand = filteredState.player2.hand.map(maskCard);
      filteredState.player1.walls = filteredState.player1.walls.map(maskWall);
      filteredState.player2.walls = filteredState.player2.walls.map(maskWall);
    }

    return NextResponse.json({
      room,
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
