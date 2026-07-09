import { NextRequest } from 'next/server';
import db from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { GameState } from '@/lib/game/types';
import { filterGameStateForViewer } from '@/lib/game/mask';
import { subscribeRoom } from '@/lib/room-events';
import { syncRoomPhaseTimeout } from '@/lib/game/room-timeout';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function sseEncode(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

async function loadRoomPayload(code: string, userId: string) {
  const room = await db.room.findUnique({
    where: { code: code.toUpperCase() },
    include: {
      player1: { select: { id: true, email: true } },
      player2: { select: { id: true, email: true } },
    },
  });

  if (!room) return { error: '找不到指定的房間', status: 404 as const };

  const isPlayer1 = room.player1Id === userId;
  const isPlayer2 = room.player2Id === userId;
  const isMember = isPlayer1 || isPlayer2;

  const synced = await syncRoomPhaseTimeout(room, Date.now());
  const liveRoom = synced.room;

  if (!liveRoom.gameState) {
    if (!isPlayer1) return { error: '您不是此房間成員', status: 403 as const };
    return {
      room: liveRoom,
      gameState: null as GameState | null,
      version: liveRoom.updatedAt.toISOString(),
    };
  }

  const gameState = (synced.gameState ?? liveRoom.gameState) as unknown as GameState;
  const isLocalGuest = gameState.player2.id === 'guest';

  if (isLocalGuest) {
    if (!isPlayer1) return { error: '您不是此房間成員', status: 403 as const };
    return { room: liveRoom, gameState, version: liveRoom.updatedAt.toISOString() };
  }

  if (!isMember) return { error: '您不是此房間成員', status: 403 as const };

  return {
    room: liveRoom,
    gameState: filterGameStateForViewer(gameState, userId),
    version: liveRoom.updatedAt.toISOString(),
  };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const user = await getCurrentUser(req);
  if (!user) {
    return new Response(JSON.stringify({ error: '未授權，請先登入' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const upper = code.toUpperCase();
  const encoder = new TextEncoder();
  let closed = false;
  let lastVersion = '';
  let unsubscribe: (() => void) | null = null;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(sseEncode(event, data)));
        } catch {
          cleanup();
        }
      };

      const pushSnapshot = async (reason: string) => {
        try {
          const payload = await loadRoomPayload(upper, user.id);
          if ('error' in payload) {
            send('room_error', { error: payload.error });
            cleanup();
            controller.close();
            return;
          }
          if (payload.version === lastVersion && reason !== 'hello') return;
          lastVersion = payload.version;
          send('room', {
            room: payload.room,
            gameState: payload.gameState,
            version: payload.version,
            reason,
          });
        } catch (err: any) {
          send('room_error', { error: err?.message || '串流讀取失敗' });
        }
      };

      const cleanup = () => {
        if (closed) return;
        closed = true;
        unsubscribe?.();
        unsubscribe = null;
        if (pollTimer) clearInterval(pollTimer);
        if (heartbeatTimer) clearInterval(heartbeatTimer);
        pollTimer = null;
        heartbeatTimer = null;
      };

      unsubscribe = subscribeRoom(upper, () => {
        void pushSnapshot('publish');
      });

      // 備援：同實例漏訊／多實例時仍能追上
      pollTimer = setInterval(() => {
        void pushSnapshot('poll');
      }, 800);

      heartbeatTimer = setInterval(() => {
        send('ping', { t: Date.now() });
      }, 15000);

      void pushSnapshot('hello');

      req.signal.addEventListener('abort', () => {
        cleanup();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
    cancel() {
      closed = true;
      unsubscribe?.();
      if (pollTimer) clearInterval(pollTimer);
      if (heartbeatTimer) clearInterval(heartbeatTimer);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
