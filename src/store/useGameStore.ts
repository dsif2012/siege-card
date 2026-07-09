import { create } from 'zustand';
import { Card, GameState } from '@/lib/game/types';

interface User {
  id: string;
  email: string;
}

interface Room {
  id: string;
  code: string;
  player1Id: string;
  player2Id: string | null;
  status: string;
  winnerId: string | null;
  player1: { id: string; email: string };
  player2?: { id: string; email: string } | null;
}

interface GameStore {
  user: User | null;
  room: Room | null;
  gameState: GameState | null;
  scoutedCards: Card[] | null; // 用於展示偵查到的卡片 (暫時存在 store)
  
  // UI 互動狀態
  selectedHandCardIds: string[];
  selectedWallIndex: number | null;
  selectedOpponentWallCardIndexes: number[]; // 偵查或破勢時選中的對方城牆卡牌索引
  selectedOpponentWallIndex: number | null; // 偵查或破勢時選中的對方城牆索引
  selectedDisruptAttackCards: { playerKey: 'player1' | 'player2'; cardIndex: number }[]; // 破勢選中的攻擊卡
  
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchUser: () => Promise<User | null>;
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  
  createRoom: (localGuest: boolean) => Promise<string | null>;
  joinRoom: (code: string) => Promise<string | null>;
  fetchRoom: (code: string) => Promise<void>;
  
  submitAction: (code: string, action: string, payload: any) => Promise<void>;
  restartGame: (code: string) => Promise<void>;

  // UI helpers
  toggleHandCardSelection: (id: string) => void;
  toggleOpponentCardSelection: (wallIndex: number, cardIndex: number) => void;
  toggleDisruptAttackCardSelection: (playerKey: 'player1' | 'player2', cardIndex: number) => void;
  selectWallIndex: (idx: number | null) => void;
  clearUISelections: () => void;
  setScoutedCards: (cards: Card[] | null) => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  user: null,
  room: null,
  gameState: null,
  scoutedCards: null,
  selectedHandCardIds: [],
  selectedWallIndex: null,
  selectedOpponentWallCardIndexes: [],
  selectedOpponentWallIndex: null,
  selectedDisruptAttackCards: [],
  isLoading: false,
  error: null,

  fetchUser: async () => {
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      if (data.user) {
        set({ user: data.user });
        return data.user;
      }
      return null;
    } catch {
      return null;
    }
  },

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '登入失敗');
      set({ user: data.user, isLoading: false });
      return true;
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      return false;
    }
  },

  register: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '註冊失敗');
      set({ isLoading: false });
      return true;
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      return false;
    }
  },

  logout: async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      set({ user: null, room: null, gameState: null });
    } catch (e) {
      console.error(e);
    }
  },

  createRoom: async (localGuest) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch('/api/rooms/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ localGuest }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '無法創建房間');
      set({ room: data.room, gameState: data.room.gameState, isLoading: false });
      return data.room.code;
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      return null;
    }
  },

  joinRoom: async (code) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch('/api/rooms/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '無法加入房間');
      set({ room: data.room, gameState: data.room.gameState, isLoading: false });
      return data.room.code;
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      return null;
    }
  },

  fetchRoom: async (code) => {
    try {
      const res = await fetch(`/api/rooms/${code.toUpperCase()}`);
      if (!res.ok) return;
      const data = await res.json();
      // 僅在有變動時更新，避免頻繁渲染
      if (JSON.stringify(get().room) !== JSON.stringify(data.room) || 
          JSON.stringify(get().gameState) !== JSON.stringify(data.gameState)) {
        set({ room: data.room, gameState: data.gameState });
      }
    } catch (e) {
      console.error(e);
    }
  },

  submitAction: async (code, action, payload) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`/api/rooms/${code.toUpperCase()}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, payload }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '執行行動失敗');
      
      set({
        room: data.room,
        gameState: data.gameState,
        isLoading: false,
      });

      // 如果有返回偵查到的卡牌，則更新 store 供 UI 顯示
      if (data.scoutedCards) {
        set({ scoutedCards: data.scoutedCards });
      }

      get().clearUISelections();
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      throw err;
    }
  },

  restartGame: async (code) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`/api/rooms/${code.toUpperCase()}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restart' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '無法重啟遊戲');
      set({
        room: data.room,
        gameState: data.gameState,
        isLoading: false,
      });
      get().clearUISelections();
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  toggleHandCardSelection: (id) => {
    const selected = get().selectedHandCardIds;
    if (selected.includes(id)) {
      set({ selectedHandCardIds: selected.filter(x => x !== id) });
    } else {
      set({ selectedHandCardIds: [...selected, id] });
    }
  },

  toggleOpponentCardSelection: (wallIndex, cardIndex) => {
    const curWallIdx = get().selectedOpponentWallIndex;
    const curCardIdxs = get().selectedOpponentWallCardIndexes;

    // 如果切換城牆，則重設卡牌選取
    if (curWallIdx !== wallIndex) {
      set({
        selectedOpponentWallIndex: wallIndex,
        selectedOpponentWallCardIndexes: [cardIndex],
      });
    } else {
      if (curCardIdxs.includes(cardIndex)) {
        const nextCardIdxs = curCardIdxs.filter(x => x !== cardIndex);
        set({
          selectedOpponentWallCardIndexes: nextCardIdxs,
          selectedOpponentWallIndex: nextCardIdxs.length === 0 ? null : wallIndex,
        });
      } else {
        if (curCardIdxs.length >= 2) {
          // 最多選兩張，替換掉第一張
          set({ selectedOpponentWallCardIndexes: [curCardIdxs[1], cardIndex] });
        } else {
          set({ selectedOpponentWallCardIndexes: [...curCardIdxs, cardIndex] });
        }
      }
    }
  },

  toggleDisruptAttackCardSelection: (playerKey, cardIndex) => {
    const cur = get().selectedDisruptAttackCards;
    const existsIdx = cur.findIndex(x => x.playerKey === playerKey && x.cardIndex === cardIndex);

    if (existsIdx !== -1) {
      set({ selectedDisruptAttackCards: cur.filter((_, idx) => idx !== existsIdx) });
    } else {
      if (cur.length >= 2) {
        set({ selectedDisruptAttackCards: [cur[1], { playerKey, cardIndex }] });
      } else {
        set({ selectedDisruptAttackCards: [...cur, { playerKey, cardIndex }] });
      }
    }
  },

  selectWallIndex: (idx) => {
    set({ selectedWallIndex: idx });
  },

  clearUISelections: () => {
    set({
      selectedHandCardIds: [],
      selectedWallIndex: null,
      selectedOpponentWallCardIndexes: [],
      selectedOpponentWallIndex: null,
      selectedDisruptAttackCards: [],
      error: null,
    });
  },

  setScoutedCards: (cards) => {
    set({ scoutedCards: cards });
  },
}));
