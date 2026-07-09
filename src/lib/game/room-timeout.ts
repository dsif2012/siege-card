import db from '@/lib/db';
import type { GameState } from '@/lib/game/types';
import * as engine from '@/lib/game/engine';
import { publishRoom } from '@/lib/room-events';

type RoomRow = {
  code: string;
  status: string;
  gameState: unknown;
  winnerId: string | null;
  updatedAt: Date;
};

function phaseSnapshot(state: GameState) {
  return JSON.stringify({
    phase: state.phase,
    active: state.activePlayerId,
    deadline: state.phaseDeadlineAt,
  });
}

/** 讀取時若階段已逾時，寫回 DB 並廣播（SSE／輪詢可推進卡住的回合） */
export async function syncRoomPhaseTimeout<T extends RoomRow>(
  room: T,
  now = Date.now(),
): Promise<{ room: T; gameState: GameState | null; changed: boolean }> {
  if (!room.gameState || room.status !== 'PLAYING') {
    return { room, gameState: room.gameState as GameState | null, changed: false };
  }

  let state = JSON.parse(JSON.stringify(room.gameState)) as GameState;
  state = engine.ensurePhaseDeadline(state, now);
  const before = phaseSnapshot(state);
  state = engine.applyDuePhaseTimeout(state, now);
  const after = phaseSnapshot(state);

  if (before === after) {
    return { room, gameState: state, changed: false };
  }

  let roomStatus = room.status;
  let winnerId = room.winnerId;
  if (state.phase === 'finished') {
    roomStatus = 'FINISHED';
    winnerId = state.winnerId === 'guest' ? null : state.winnerId || null;
  }

  const updated = await db.room.update({
    where: { code: room.code },
    data: {
      status: roomStatus,
      winnerId,
      gameState: state as object,
    },
    include: {
      player1: { select: { id: true, email: true } },
      player2: { select: { id: true, email: true } },
    },
  });

  publishRoom(room.code, updated.updatedAt.toISOString());

  return {
    room: updated as unknown as T,
    gameState: state,
    changed: true,
  };
}
