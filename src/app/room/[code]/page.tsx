'use client';

import { useEffect, useState, useRef, use, type DragEvent, type MouseEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useGameStore } from '@/store/useGameStore';
import { Card, AttackCard } from '@/lib/game/types';
import { formatCard, getAttackValue, getWallDefenseValue, WALL_LIMITS } from '@/lib/game/engine';
import { Sword, Shield, RotateCcw, ArrowLeft, Eye, HelpCircle, AlertCircle, Sparkles, Send } from 'lucide-react';

export default function GameRoomPage({ params: paramsPromise }: { params: Promise<{ code: string }> }) {
  const params = use(paramsPromise);
  const code = params.code;
  const router = useRouter();
  
  const {
    user,
    room,
    gameState,
    scoutedCards,
    selectedHandCardIds,
    selectedWallIndex,
    selectedOpponentWallCardIndexes,
    selectedOpponentWallIndex,
    selectedDisruptAttackCards,
    isLoading,
    error,
    fetchUser,
    fetchRoom,
    submitAction,
    restartGame,
    toggleHandCardSelection,
    toggleOpponentCardSelection,
    toggleDisruptAttackCardSelection,
    selectWallIndex,
    clearUISelections,
    setScoutedCards,
  } = useGameStore();

  const [isPassDeviceOverlayVisible, setIsPassDeviceOverlayVisible] = useState(false);
  const [activeActorId, setActiveActorId] = useState<string>('');
  const [activeActorName, setActiveActorName] = useState<string>('');
  
  // 用於開局部署暫存狀態
  const [setupWall1, setSetupWall1] = useState<Card | null>(null);
  const [setupWall2, setSetupWall2] = useState<Card | null>(null);
  const [setupWall3, setSetupWall3] = useState<Card | null>(null);
  const [setupAttackSlots, setSetupAttackSlots] = useState<[Card | null, Card | null]>([null, null]);
  /** setup：拖曳中的卡牌 id；點選部署時與 selectedHandCardIds 共用選取 */
  const [setupDraggingCardId, setSetupDraggingCardId] = useState<string | null>(null);
  const [setupDropTarget, setSetupDropTarget] = useState<string | null>(null);

  // 主要行動替換攻擊牌暫存
  const [replaceAttackIds, setReplaceAttackIds] = useState<string[]>([]);
  // 破勢與偵查的 UI 控制
  const [extraActionType, setExtraActionType] = useState<'scout' | 'disrupt' | 'none'>('none');

  const logsEndRef = useRef<HTMLDivElement>(null);
  const lastActorIdRef = useRef<string | null>(null);

  // 1. 初始化使用者與房間資訊
  useEffect(() => {
    fetchUser();
    fetchRoom(code);
    clearUISelections();
  }, [code, fetchUser, fetchRoom, clearUISelections]);

  // 2. 房間狀態輪詢（WAITING 等對手；PLAYING 同步對戰）
  useEffect(() => {
    if (!room) return;

    if (room.status === 'WAITING') {
      const timer = setInterval(() => fetchRoom(code), 2000);
      return () => clearInterval(timer);
    }

    if (room.status !== 'PLAYING') return;

    const isLocalGuest = gameState?.player2.id === 'guest';
    const isMyTurn =
      gameState?.activePlayerId === user?.id ||
      (gameState?.phase === 'wall_breached_response' &&
        gameState?.breachedResponseState?.defenderId === user?.id) ||
      (gameState?.phase === 'setup' &&
        ((user?.id === gameState.player1.id && !gameState.setupState?.player1Ready) ||
          (user?.id === gameState.player2.id && !gameState.setupState?.player2Ready)));

    const intervalTime = isLocalGuest ? 10000 : isMyTurn ? 4000 : 2000;
    const timer = setInterval(() => fetchRoom(code), intervalTime);
    return () => clearInterval(timer);
  }, [code, room, gameState, user, fetchRoom]);

  // 3. 自動捲動行動日誌
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [gameState?.logs]);

  // 4. 計算當前應操作的角色 (用於 Hot-seat 遮罩)
  useEffect(() => {
    if (!gameState) return;

    let actorId = '';
    let actorName = '';

    if (gameState.phase === 'setup') {
      if (gameState.player2.id === 'guest') {
        if (!gameState.setupState?.player1Ready) {
          actorId = gameState.player1.id;
          actorName = gameState.player1.email;
        } else {
          actorId = gameState.player2.id;
          actorName = gameState.player2.email;
        }
      } else {
        // 線上並行配置：以「自己尚未就緒」為操作焦點
        const p1Ready = !!gameState.setupState?.player1Ready;
        const p2Ready = !!gameState.setupState?.player2Ready;
        if (!p1Ready && !p2Ready) {
          actorId = gameState.player1.id;
          actorName = '雙方配置中';
        } else if (!p1Ready) {
          actorId = gameState.player1.id;
          actorName = gameState.player1.email;
        } else if (!p2Ready) {
          actorId = gameState.player2.id;
          actorName = gameState.player2.email;
        }
      }
    } else if (gameState.phase === 'wall_breached_response' && gameState.breachedResponseState) {
      actorId = gameState.breachedResponseState.defenderId;
      actorName = actorId === gameState.player1.id ? gameState.player1.email : gameState.player2.email;
    } else {
      actorId = gameState.activePlayerId;
      actorName = actorId === gameState.player1.id ? gameState.player1.email : gameState.player2.email;
    }

    setActiveActorId(actorId);
    setActiveActorName(actorName);

    // 觸發 Hot-seat 交接遮罩 (僅在單機對戰且操作角色改變時觸發)
    const isLocalGuest = gameState.player2.id === 'guest';
    if (isLocalGuest && lastActorIdRef.current && lastActorIdRef.current !== actorId) {
      setIsPassDeviceOverlayVisible(true);
    }
    lastActorIdRef.current = actorId;
  }, [gameState]);

  // 開局換手時清空本機部署暫存（僅本機熱座；線上各自配置不因對手就緒而清空）
  useEffect(() => {
    if (gameState?.phase !== 'setup') return;
    if (gameState.player2.id !== 'guest') return;
    setSetupWall1(null);
    setSetupWall2(null);
    setSetupWall3(null);
    setSetupAttackSlots([null, null]);
    setSetupDraggingCardId(null);
    setSetupDropTarget(null);
    clearUISelections();
  }, [activeActorId, gameState?.phase, gameState?.player2.id, clearUISelections]);

  // WAITING：房主等待對手加入
  if (room && room.status === 'WAITING' && !gameState) {
    const inviteCode = room.code;
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-[#0c0c0e] relative overflow-hidden">
        <div className="w-full max-w-md washi-paper rounded-2xl p-8 border border-yamabuki-gold/25 text-center space-y-6 shadow-2xl relative z-10">
          <div className="mx-auto w-14 h-14 rounded-full bg-yamabuki-gold/10 border border-yamabuki-gold/35 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-yamabuki-gold border-t-transparent rounded-full animate-spin" />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-black font-serif text-yamabuki-gold tracking-widest">等待對手加入</h2>
            <p className="text-xs text-foreground/55 leading-relaxed">
              將下方邀請碼分享給<strong className="text-foreground/75">另一個 email 帳號</strong>
              （另一瀏覽器／無痕），對方於大廳登入後輸入即可開打。同一帳號無法加入自己的房。
            </p>
          </div>
          <div className="bg-zinc-950/60 border border-yamabuki-gold/30 rounded-xl py-4 px-3">
            <p className="text-[10px] text-foreground/40 tracking-[0.25em] uppercase mb-1">邀請碼</p>
            <p className="text-3xl font-black font-serif text-yamabuki-gold tracking-[0.35em]">{inviteCode}</p>
          </div>
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(inviteCode);
                alert('已複製邀請碼');
              } catch {
                alert(`邀請碼：${inviteCode}`);
              }
            }}
            className="w-full confirm-fab font-serif font-bold py-2.5 rounded-full text-sm tracking-wider"
          >
            複製邀請碼
          </button>
          <button
            type="button"
            onClick={() => router.push('/')}
            className="text-xs text-foreground/45 hover:text-foreground/70 transition-colors"
          >
            返回大廳
          </button>
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[#0c0c0e]">
        <div className="w-12 h-12 border-4 border-shiko-red border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-yamabuki-gold font-serif tracking-widest text-sm">正在載入房間...</p>
      </div>
    );
  }

  if (!gameState) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[#0c0c0e]">
        <div className="w-12 h-12 border-4 border-shiko-red border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-yamabuki-gold font-serif tracking-widest text-sm">正在載入古戰場狀態...</p>
      </div>
    );
  }

  const isLocalGuest = gameState.player2.id === 'guest';
  const isPlayer1 = room.player1Id === user?.id;
  const isPlayer2 = room.player2Id === user?.id;

  // 決定當前應操作的角色 ID 與姓名 (直接在 render 中計算，更安全防手震)
  let currentActorId = '';
  let currentActorName = '';
  if (gameState) {
    if (gameState.phase === 'setup') {
      if (isLocalGuest) {
        // 本機熱座：依序配置
        if (!gameState.setupState?.player1Ready) {
          currentActorId = gameState.player1.id;
          currentActorName = gameState.player1.email;
        } else {
          currentActorId = gameState.player2.id;
          currentActorName = gameState.player2.email;
        }
      } else {
        // 線上：雙方可並行配置；提示用「尚未就緒者」
        const p1Ready = !!gameState.setupState?.player1Ready;
        const p2Ready = !!gameState.setupState?.player2Ready;
        if (isPlayer1 && !p1Ready) {
          currentActorId = gameState.player1.id;
          currentActorName = gameState.player1.email;
        } else if (isPlayer2 && !p2Ready) {
          currentActorId = gameState.player2.id;
          currentActorName = gameState.player2.email;
        } else if (!p1Ready) {
          currentActorId = gameState.player1.id;
          currentActorName = `${gameState.player1.email}（配置中）`;
        } else if (!p2Ready) {
          currentActorId = gameState.player2.id;
          currentActorName = `${gameState.player2.email}（配置中）`;
        }
      }
    } else if (gameState.phase === 'wall_breached_response' && gameState.breachedResponseState) {
      currentActorId = gameState.breachedResponseState.defenderId;
      currentActorName = currentActorId === gameState.player1.id ? gameState.player1.email : gameState.player2.email;
    } else {
      currentActorId = gameState.activePlayerId;
      currentActorName = currentActorId === gameState.player1.id ? gameState.player1.email : gameState.player2.email;
    }
  }

  const mySetupReady = isPlayer1
    ? !!gameState.setupState?.player1Ready
    : isPlayer2
      ? !!gameState.setupState?.player2Ready
      : false;

  // 決定目前瀏覽器使用者是否能夠操作
  const canIControl = isLocalGuest
    ? isPlayer1
    : gameState.phase === 'setup'
      ? (isPlayer1 || isPlayer2) && !mySetupReady
      : (currentActorId === room.player1Id && isPlayer1) || (currentActorId === room.player2Id && isPlayer2);

  // 取得玩家與對手的視角
  const isP2View = isLocalGuest
    ? (currentActorId === gameState.player2.id)
    : isPlayer2;
  const bottomPlayer = isP2View ? gameState.player2 : gameState.player1;
  const topPlayer = isP2View ? gameState.player1 : gameState.player2;

  // 格式化花色圖示與顏色
  const getSuitSymbol = (suit: string) => {
    switch (suit) {
      case 'H': return { symbol: '♥', color: 'text-red-500' };
      case 'D': return { symbol: '♦', color: 'text-red-400' };
      case 'C': return { symbol: '♣', color: 'text-zinc-400' };
      case 'S': return { symbol: '♠', color: 'text-zinc-300' };
      default: return { symbol: '?', color: 'text-zinc-500' };
    }
  };

  const getCardValueLabel = (value: number) => {
    if (value === 1) return 'A';
    if (value === 11) return 'J';
    if (value === 12) return 'Q';
    if (value === 13) return 'K';
    return value.toString();
  };

  // 卡牌渲染組件
  const RenderCard = ({ card, isSelected, onClick, isFlipped = false, showCharge = 0, draggable = false, onDragStart, onDragEnd }: {
    card: Card;
    isSelected?: boolean;
    onClick?: () => void;
    isFlipped?: boolean; // true 代表蓋牌
    showCharge?: number;
    draggable?: boolean;
    onDragStart?: (e: DragEvent) => void;
    onDragEnd?: (e: DragEvent) => void;
  }) => {
    // 遮罩防竊看：如果 value 為 0，則強制當成蓋牌處理
    const isReallyFlipped = isFlipped || card.value === 0;

    if (isReallyFlipped) {
      return (
        <div
          onClick={onClick}
          draggable={draggable}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          className={`w-12 h-16 md:w-14 md:h-20 rounded border-2 flex items-center justify-center select-none transition-all duration-200 ${
            onClick || draggable ? 'cursor-pointer hover:scale-105' : ''
          } ${draggable ? 'cursor-grab active:cursor-grabbing' : ''} ${
            isSelected 
              ? 'border-yamabuki-gold scale-105 shadow-[0_0_8px_rgba(212,175,55,0.6)]' 
              : 'border-red-950 shadow-md'
          } japanese-pattern`}
        >
          {/* 青海波/櫻花蓋牌質感 */}
          <div className="text-[10px] text-red-100/30 font-serif font-black tracking-widest pointer-events-none transform -rotate-12">
            軍
          </div>
        </div>
      );
    }

    const { symbol, color } = getSuitSymbol(card.suit);
    const valueLabel = getCardValueLabel(card.value);
    const isRed = card.suit === 'H' || card.suit === 'D';

    return (
      <div
        onClick={onClick}
        draggable={draggable}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        className={`w-12 h-16 md:w-14 md:h-20 washi-card-light rounded border flex flex-col justify-between p-1.5 select-none relative transition-all duration-200 ${
          onClick || draggable ? 'cursor-pointer hover:scale-105' : ''
        } ${draggable ? 'cursor-grab active:cursor-grabbing' : ''} ${
          isSelected 
            ? 'border-yamabuki-gold scale-105 ring-2 ring-yamabuki-gold shadow-[0_0_12px_rgba(212,175,55,0.8)]' 
            : 'border-zinc-300 shadow-md'
        } ${showCharge > 0 ? 'charge-glow' : ''}`}
      >
        {/* 左上角數值與花色 */}
        <div className="flex flex-col leading-none items-start">
          <span className={`text-xs md:text-sm font-bold font-serif ${isRed ? 'text-shiko-red' : 'text-zinc-950'}`}>
            {valueLabel}
          </span>
          <span className={`text-[10px] md:text-xs ${color}`}>{symbol}</span>
        </div>

        {/* 中央花色大圖示 */}
        <div className={`absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none text-2xl ${color}`}>
          {symbol}
        </div>

        {/* 右下角小數值 */}
        <div className="flex justify-end items-end leading-none">
          <span className={`text-[10px] md:text-xs font-bold font-serif ${isRed ? 'text-shiko-red' : 'text-zinc-950'}`}>
            {valueLabel}
          </span>
        </div>

        {/* Charge 蓄力顯示 */}
        {showCharge > 0 && (
          <div className="absolute -top-2.5 -right-2.5 bg-gradient-to-r from-yellow-500 to-amber-600 text-zinc-950 border border-yellow-200 text-[9px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow-lg animate-bounce">
            +{showCharge}
          </div>
        )}
      </div>
    );
  };

  type SetupSlot = 'wall1' | 'wall2' | 'wall3' | 'attack0' | 'attack1';

  const setupDraftCards = isP2View
    ? gameState.setupState?.player2Draft
    : gameState.setupState?.player1Draft;

  // 線上已送出配置後：改顯示 gameState（本地暫存會被清空）
  const setupCommitted =
    gameState.phase === 'setup' && mySetupReady && !isLocalGuest;

  const displayWall1 =
    setupCommitted || gameState.phase !== 'setup'
      ? bottomPlayer.walls[0]?.cards[0] ?? null
      : setupWall1;
  const displayWall2 =
    setupCommitted || gameState.phase !== 'setup'
      ? bottomPlayer.walls[1]?.cards[0] ?? null
      : setupWall2;
  const displayWall3 =
    setupCommitted || gameState.phase !== 'setup'
      ? bottomPlayer.walls[2]?.cards[0] ?? null
      : setupWall3;
  const displayAttackSlots: [Card | null, Card | null] =
    setupCommitted || gameState.phase !== 'setup'
      ? [
          bottomPlayer.attackZone[0]?.card ?? null,
          bottomPlayer.attackZone[1]?.card ?? null,
        ]
      : setupAttackSlots;

  const setupUsedIds = new Set(
    [setupWall1?.id, setupWall2?.id, setupWall3?.id, setupAttackSlots[0]?.id, setupAttackSlots[1]?.id]
      .filter(Boolean) as string[]
  );

  const setupAvailableDraft = setupCommitted
    ? []
    : (setupDraftCards ?? []).filter(c => !setupUsedIds.has(c.id));
  const setupSelectedCardId = selectedHandCardIds[0] ?? null;
  const setupIsReady = !!(setupWall1 && setupWall2 && setupWall3 && setupAttackSlots[0] && setupAttackSlots[1]);
  const setupIsPlacing = !setupCommitted && !!(setupDraggingCardId || setupSelectedCardId);

  const findSetupCard = (cardId: string): Card | undefined =>
    setupDraftCards?.find(c => c.id === cardId);

  const clearSetupSelection = () => {
    clearUISelections();
    setSetupDraggingCardId(null);
    setSetupDropTarget(null);
  };

  const placeSetupCard = (cardId: string, target: SetupSlot) => {
    if (!canIControl) return;
    const card = findSetupCard(cardId);
    if (!card) return;

    let w1 = setupWall1?.id === cardId ? null : setupWall1;
    let w2 = setupWall2?.id === cardId ? null : setupWall2;
    let w3 = setupWall3?.id === cardId ? null : setupWall3;
    const attacks: [Card | null, Card | null] = [
      setupAttackSlots[0]?.id === cardId ? null : setupAttackSlots[0],
      setupAttackSlots[1]?.id === cardId ? null : setupAttackSlots[1],
    ];

    if (target === 'wall1') w1 = card;
    else if (target === 'wall2') w2 = card;
    else if (target === 'wall3') w3 = card;
    else if (target === 'attack0') attacks[0] = card;
    else if (target === 'attack1') attacks[1] = card;

    setSetupWall1(w1);
    setSetupWall2(w2);
    setSetupWall3(w3);
    setSetupAttackSlots(attacks);
    clearSetupSelection();
  };

  const returnSetupCardToHand = (cardId: string) => {
    if (!canIControl) return;
    setSetupWall1(prev => (prev?.id === cardId ? null : prev));
    setSetupWall2(prev => (prev?.id === cardId ? null : prev));
    setSetupWall3(prev => (prev?.id === cardId ? null : prev));
    setSetupAttackSlots(prev => [
      prev[0]?.id === cardId ? null : prev[0],
      prev[1]?.id === cardId ? null : prev[1],
    ]);
    clearSetupSelection();
  };

  const handleSetupSlotInteract = (slot: SetupSlot, occupyingCard: Card | null) => {
    if (!canIControl || gameState.phase !== 'setup') return;

    const activeId = setupDraggingCardId || setupSelectedCardId;
    if (activeId) {
      placeSetupCard(activeId, slot);
      return;
    }
    if (occupyingCard) {
      returnSetupCardToHand(occupyingCard.id);
    }
  };

  const setupSlotDropProps = (slot: SetupSlot, occupyingCard: Card | null) => {
    const highlighted = setupIsPlacing && (setupDropTarget === slot || !!setupSelectedCardId);
    return {
      onDragOver: (e: DragEvent) => {
        if (!canIControl || gameState.phase !== 'setup') return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setSetupDropTarget(slot);
      },
      onDragLeave: () => {
        setSetupDropTarget(prev => (prev === slot ? null : prev));
      },
      onDrop: (e: DragEvent) => {
        e.preventDefault();
        const cardId = e.dataTransfer.getData('text/plain') || setupDraggingCardId;
        if (cardId) placeSetupCard(cardId, slot);
        else handleSetupSlotInteract(slot, occupyingCard);
      },
      onClick: (e: MouseEvent) => {
        e.stopPropagation();
        handleSetupSlotInteract(slot, occupyingCard);
      },
      classNameHighlight: highlighted,
    };
  };

  // 提交開局配置
  const handleSetupSubmit = async () => {
    if (!setupWall1 || !setupWall2 || !setupWall3 || !setupAttackSlots[0] || !setupAttackSlots[1]) {
      alert('請填滿所有配置格子！防禦牌 3 張（各牆1張），攻擊牌 2 張。');
      return;
    }

    try {
      const defenseCardIds = [setupWall1.id, setupWall2.id, setupWall3.id];
      const attackCardIds = [setupAttackSlots[0].id, setupAttackSlots[1].id];
      
      await submitAction(code, 'setup', { defenseCardIds, attackCardIds });
      
      // 清空暫存
      setSetupWall1(null);
      setSetupWall2(null);
      setSetupWall3(null);
      setSetupAttackSlots([null, null]);
      clearSetupSelection();
    } catch (e: any) {
      alert(e.message || '配置失敗');
    }
  };

  // 主要行動：放攻擊牌
  const handlePlaceAttack = async () => {
    if (selectedHandCardIds.length < 1 || selectedHandCardIds.length > 2) {
      alert('請選擇 1~2 張手牌放入攻擊區');
      return;
    }

    try {
      await submitAction(code, 'place_attack', {
        cardIds: selectedHandCardIds,
        replaceIds: replaceAttackIds.length > 0 ? replaceAttackIds : undefined,
      });
      setReplaceAttackIds([]);
    } catch (e: any) {
      alert(e.message || '行動失敗');
    }
  };

  // 主要行動：放防守牌
  const handlePlaceDefense = async () => {
    if (selectedHandCardIds.length < 1 || selectedHandCardIds.length > 2) {
      alert('請選擇 1~2 張手牌作為防守牌');
      return;
    }
    if (selectedWallIndex === null) {
      alert('請在下方己方城牆區域選擇要補防的城牆 (Wall 1 ~ 3)');
      return;
    }

    try {
      await submitAction(code, 'place_defense', {
        wallIndex: selectedWallIndex,
        cardIds: selectedHandCardIds,
      });
    } catch (e: any) {
      alert(e.message || '行動失敗');
    }
  };

  // 主要行動：蓄力
  const handleCharge = async () => {
    try {
      await submitAction(code, 'charge', {});
    } catch (e: any) {
      alert(e.message || '行動失敗');
    }
  };

  // 額外行動：抽 2 張
  const handleDraw2 = async () => {
    try {
      await submitAction(code, 'draw', {});
    } catch (e: any) {
      alert(e.message || '行動失敗');
    }
  };

  // 額外行動：進攻
  const handleAttack = async () => {
    try {
      await submitAction(code, 'attack', {});
    } catch (e: any) {
      alert(e.message || '行動失敗');
    }
  };

  // 額外行動：偵查
  const handleScout = async () => {
    if (selectedOpponentWallIndex === null || selectedOpponentWallCardIndexes.length === 0) {
      alert('請點擊上方對手防護牆上的蓋牌 (最多2張) 以進行偵查');
      return;
    }
    try {
      await submitAction(code, 'scout', {
        targetWallIndex: selectedOpponentWallIndex,
        cardIndexes: selectedOpponentWallCardIndexes,
      });
      setExtraActionType('none');
    } catch (e: any) {
      alert(e.message || '行動失敗');
    }
  };

  // 額外行動：破勢
  const handleDisrupt = async () => {
    if (selectedOpponentWallIndex === null || selectedOpponentWallCardIndexes.length === 0) {
      alert('請點擊上方對手防護牆上的蓋牌 (1~2張) 作為破勢公開對象');
      return;
    }
    if (selectedDisruptAttackCards.length === 0) {
      alert('請選擇場上 1~2 張攻擊牌（雙方攻擊區均可選擇）使蓄力歸零');
      return;
    }

    try {
      await submitAction(code, 'disrupt', {
        scoutPlacements: selectedOpponentWallCardIndexes.map(idx => ({
          wallIndex: selectedOpponentWallIndex,
          cardIndex: idx,
        })),
        resetAttackPlacements: selectedDisruptAttackCards,
      });
      setExtraActionType('none');
    } catch (e: any) {
      alert(e.message || '行動失敗');
    }
  };

  // 結束回合
  const handleEndTurn = async () => {
    try {
      await submitAction(code, 'skip_extra', {});
    } catch (e: any) {
      alert(e.message || '行動失敗');
    }
  };

  // 緊急補防提交
  const handleBreachResponseSubmit = async () => {
    // 找出已放置到牆面的手牌
    // 為了簡化，玩家在 UI 點擊手牌，並選擇剩餘牆面進行放置
    // 我們在 UI 點選卡牌，然後點擊牆面直接加入。為了避免出錯，可以使用暫存方式，或直接呼叫 API 執行
    // 我們使用 direct assignment (點擊卡牌後點擊牆面直接執行放置)
    // 這裡我們提供防禦擺設列表
    if (selectedHandCardIds.length === 0) {
      // 玩家可以選擇不放置任何牌
      try {
        await submitAction(code, 'respond_breach', { placements: [] });
      } catch (e: any) {
        alert(e.message || '行動失敗');
      }
      return;
    }

    if (selectedWallIndex === null) {
      alert('請選擇要放置防守牌的剩餘城牆');
      return;
    }

    try {
      const placements = selectedHandCardIds.map(id => ({
        wallIndex: selectedWallIndex,
        cardId: id,
      }));
      await submitAction(code, 'respond_breach', { placements });
    } catch (e: any) {
      alert(e.message || '行動失敗');
    }
  };

  // 離開房間
  const handleLeaveRoom = () => {
    router.push('/');
  };

  // 牆面防禦上限與名稱
  // 牆面防禦上限與名稱（與引擎 WALL_LIMITS 一致：20 / 30 / 40）
  const wallLimits = [...WALL_LIMITS];

  return (
    <div className="flex-1 flex flex-col bg-[#0c0c0e] relative overflow-hidden select-none font-sans">
      
      {/* 1. 頂部導覽列 */}
      <header className="room-header px-4 py-3 flex items-center justify-between">
        <button
          onClick={handleLeaveRoom}
          className="flex items-center space-x-1 text-xs text-foreground/55 hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>大廳</span>
        </button>
        <div className="flex items-center gap-2">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-yamabuki-gold/80" aria-hidden>
            <path d="M4 20V10l8-6 8 6v10H4z" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.15" />
            <path d="M10 20v-6h4v6" stroke="currentColor" strokeWidth="1.5" />
          </svg>
          <div className="text-center leading-tight">
            <span className="text-[9px] text-foreground/35 font-mono tracking-[0.2em] uppercase">Siege · </span>
            <span className="text-sm font-bold font-serif text-yamabuki-gold tracking-widest">{room.code}</span>
          </div>
          <span className="text-[9px] bg-zinc-900/80 border border-foreground/10 text-foreground/60 px-2 py-0.5 rounded-full">
            {gameState.player2.id === 'guest' ? '本機' : '線上'}
          </span>
        </div>
        <button
          onClick={() => restartGame(code)}
          className="flex items-center space-x-1 text-xs text-shiko-red/90 hover:text-shiko-red transition-colors border border-shiko-red/25 bg-shiko-red/5 px-2.5 py-1 rounded-full"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>重開</span>
        </button>
      </header>

      {/* 2. 遊戲主畫面佈局 */}
      <div className="flex-1 flex flex-col lg:flex-row p-3 md:p-4 gap-4 overflow-hidden h-[calc(100vh-60px)]">
        
        {/* 左側：對戰戰場 (占大比例) */}
        <div className="flex-1 flex flex-col justify-between battlefield-frame p-3 md:p-4 relative">
          
          {/* A. 對手區域 (上方) */}
          <div className="space-y-2">
            {/* 對手資訊與手牌數 */}
            <div className="flex items-center justify-between">
              <div className="player-chip">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-shiko-red opacity-40"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-shiko-red"></span>
                </span>
                <span className="text-xs font-semibold text-foreground/80">{topPlayer.email}</span>
              </div>
              <span className="text-[10px] text-foreground/50 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-zinc-900/60 border border-foreground/8">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="opacity-60" aria-hidden>
                  <rect x="5" y="3" width="10" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
                  <rect x="9" y="7" width="10" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.5" fill="#0c0c0e" />
                </svg>
                手牌 {topPlayer.hand.length}
              </span>
            </div>

            {/* 對手三層圓弧城牆 */}
            <div className="wall-stage wall-stage--enemy relative w-full max-w-[520px] aspect-[500/220] mx-auto select-none p-1">
              <svg viewBox="0 0 500 220" className="absolute inset-0 w-full h-full pointer-events-none">
                <defs>
                  <linearGradient id="enemy-ground" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1a1012" stopOpacity="0" />
                    <stop offset="100%" stopColor="#2a1216" stopOpacity="0.5" />
                  </linearGradient>
                  <filter id="wall-glow-red" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="1.5" result="b" />
                    <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                  </filter>
                </defs>
                <rect width="500" height="220" fill="url(#enemy-ground)" />
                {/* 櫻花 */}
                <g opacity="0.35" fill="#f9a8d4">
                  <path d="M40 28c2-4 6-4 5 2-2 3-6 2-5-2z" />
                  <path d="M455 55c2-4 6-4 5 2-2 3-6 2-5-2z" />
                  <path d="M80 70c1.5-3 4.5-3 3.5 1.5-1.5 2-4.5 1.5-3.5-1.5z" />
                </g>
                {/* 本陣 */}
                <g filter="url(#wall-glow-red)">
                  <path d="M228 0h44v18l-4 4h-8l-2 6h-16l-2-6h-8l-4-4V0z" fill="#1c1214" stroke="#d33f49" strokeWidth="1.4" />
                  <path d="M236 0v10M244 0v10M252 0v10M260 0v10" stroke="#d33f49" strokeWidth="1" opacity="0.5" />
                </g>
                {/* 城牆弧線（由內到外） */}
                <path d="M185 0 A 65 65 0 0 0 315 0" stroke={topPlayer.walls[2].breached ? "#7f1d1d" : "#8a8a92"} strokeWidth="5" fill="none" strokeLinecap="round" strokeDasharray={topPlayer.walls[2].breached ? "3 3" : "10 5"} opacity={topPlayer.walls[2].breached ? 0.5 : 0.9} />
                <path d="M120 0 A 130 130 0 0 0 380 0" stroke={topPlayer.walls[1].breached ? "#7f1d1d" : "#6b6b74"} strokeWidth="7" fill="none" strokeLinecap="round" strokeDasharray={topPlayer.walls[1].breached ? "3 3" : "12 5"} opacity={topPlayer.walls[1].breached ? 0.5 : 0.95} />
                <path d="M55 0 A 195 195 0 0 0 445 0" stroke={topPlayer.walls[0].breached ? "#7f1d1d" : "#d33f49"} strokeWidth="9" fill="none" strokeLinecap="round" strokeDasharray={topPlayer.walls[0].breached ? "3 3" : "14 6"} opacity={topPlayer.walls[0].breached ? 0.45 : 0.75} />
              </svg>

              {/* Wall 3 卡牌 (Apex Y = 65) */}
              <div 
                className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center"
                style={{ top: '55px' }}
              >
                <div className={`wall-badge ${topPlayer.walls[2].breached ? 'wall-badge--breached' : 'text-foreground/75'}`}>
                  <span>本丸</span>
                  {topPlayer.walls[2].breached ? (
                    <span className="font-bold">破</span>
                  ) : (
                    <span>{getWallDefenseValue(topPlayer.walls[2])}/{wallLimits[2]}</span>
                  )}
                </div>
                <div className="flex gap-1 mt-1 justify-center items-center scale-90 origin-top">
                  {!topPlayer.walls[2].breached && topPlayer.walls[2].cards.map((card, cardIdx) => {
                    const isSelected = selectedOpponentWallIndex === 2 && selectedOpponentWallCardIndexes.includes(cardIdx);
                    const isPublic = topPlayer.walls[2].revealed[cardIdx];
                    return (
                      <RenderCard
                        key={cardIdx}
                        card={card}
                        isFlipped={!isPublic}
                        isSelected={isSelected}
                        onClick={() => {
                          if (canIControl && extraActionType !== 'none') {
                            if (!isPublic) toggleOpponentCardSelection(2, cardIdx);
                          }
                        }}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Wall 2 卡牌 (Apex Y = 130) */}
              <div 
                className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center"
                style={{ top: '120px' }}
              >
                <div className={`wall-badge ${topPlayer.walls[1].breached ? 'wall-badge--breached' : 'text-foreground/75'}`}>
                  <span>二關</span>
                  {topPlayer.walls[1].breached ? (
                    <span className="font-bold">破</span>
                  ) : (
                    <span>{getWallDefenseValue(topPlayer.walls[1])}/{wallLimits[1]}</span>
                  )}
                </div>
                <div className="flex gap-1 mt-1 justify-center items-center scale-90 origin-top">
                  {!topPlayer.walls[1].breached && topPlayer.walls[1].cards.map((card, cardIdx) => {
                    const isSelected = selectedOpponentWallIndex === 1 && selectedOpponentWallCardIndexes.includes(cardIdx);
                    const isPublic = topPlayer.walls[1].revealed[cardIdx];
                    return (
                      <RenderCard
                        key={cardIdx}
                        card={card}
                        isFlipped={!isPublic}
                        isSelected={isSelected}
                        onClick={() => {
                          if (canIControl && extraActionType !== 'none') {
                            if (!isPublic) toggleOpponentCardSelection(1, cardIdx);
                          }
                        }}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Wall 1 卡牌 (Apex Y = 195) */}
              <div 
                className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center"
                style={{ top: '185px' }}
              >
                {gameState.turnCount > 1 && !topPlayer.walls[0].breached && (
                  <div className="absolute -inset-2 rounded-lg border border-shiko-red/35 animate-pulse pointer-events-none shadow-[0_0_12px_rgba(211,63,73,0.25)]"></div>
                )}
                <div className={`wall-badge ${
                  topPlayer.walls[0].breached
                    ? 'wall-badge--breached'
                    : gameState.turnCount > 1
                      ? 'wall-badge--target text-foreground/80'
                      : 'text-foreground/75'
                }`}>
                  <span>首關</span>
                  {topPlayer.walls[0].breached ? (
                    <span className="font-bold">破</span>
                  ) : (
                    <span>{getWallDefenseValue(topPlayer.walls[0])}/{wallLimits[0]}</span>
                  )}
                </div>
                <div className="flex gap-1 mt-1 justify-center items-center scale-90 origin-top">
                  {!topPlayer.walls[0].breached && topPlayer.walls[0].cards.map((card, cardIdx) => {
                    const isSelected = selectedOpponentWallIndex === 0 && selectedOpponentWallCardIndexes.includes(cardIdx);
                    const isPublic = topPlayer.walls[0].revealed[cardIdx];
                    return (
                      <RenderCard
                        key={cardIdx}
                        card={card}
                        isFlipped={!isPublic}
                        isSelected={isSelected}
                        onClick={() => {
                          if (canIControl && extraActionType !== 'none') {
                            if (!isPublic) toggleOpponentCardSelection(0, cardIdx);
                          }
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            </div>

          </div>

          {/* B. 戰場中軸：對手攻擊 | 牌堆／回合 | 己方攻擊 */}
          <div className="siege-axis my-2">
            <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 1000 120" preserveAspectRatio="none" aria-hidden>
              <defs>
                <linearGradient id="axis-fade" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#d33f49" stopOpacity="0.12" />
                  <stop offset="45%" stopColor="#d4af37" stopOpacity="0.04" />
                  <stop offset="55%" stopColor="#d4af37" stopOpacity="0.04" />
                  <stop offset="100%" stopColor="#d4af37" stopOpacity="0.12" />
                </linearGradient>
              </defs>
              <rect width="1000" height="120" fill="url(#axis-fade)" />
              <g className="axis-clash" stroke="#d4af37" strokeWidth="1.5" fill="#d4af37">
                <path d="M430 60h40" strokeOpacity="0.45" strokeLinecap="round" />
                <path d="M530 60h40" strokeOpacity="0.45" strokeLinecap="round" />
                <polygon points="470,54 500,60 470,66" fillOpacity="0.55" />
                <polygon points="530,54 500,60 530,66" fillOpacity="0.55" />
                <circle cx="500" cy="60" r="3.5" fillOpacity="0.7" />
              </g>
              {/* 青海波暗示線 */}
              <path d="M60 100c20-8 40-8 60 0s40 8 60 0" fill="none" stroke="#d33f49" strokeOpacity="0.12" strokeWidth="1" />
              <path d="M820 20c20 8 40 8 60 0s40-8 60 0" fill="none" stroke="#d4af37" strokeOpacity="0.12" strokeWidth="1" />
            </svg>

            <div className="relative grid grid-cols-[1fr_auto_1fr] items-center gap-2 md:gap-4 px-2 md:px-4 py-2.5 min-h-[100px]">
              {/* 左：對手攻擊 */}
              <div className="flex items-center gap-2.5 min-w-0 justify-start">
                <div className="hidden sm:flex flex-col items-center shrink-0 gap-0.5">
                  <div className="w-9 h-9 rounded-full bg-shiko-red/10 border border-shiko-red/30 flex items-center justify-center text-shiko-red">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                      <path d="M14.5 3.5 L20.5 9.5 L18 12 L16.5 10.5 L13.5 13.5 L15 15 L12.5 17.5 L9.5 14.5 L4 20 L3 19 L8.5 13.5 L5.5 10.5 L8 8 L9.5 9.5 L12.5 6.5 L11 5 Z" />
                    </svg>
                  </div>
                  <span className="text-[9px] font-bold tracking-wider text-shiko-red/80">敵攻</span>
                  <span className="text-sm font-black font-serif text-shiko-red leading-none">{getAttackValue(topPlayer.attackZone)}</span>
                </div>
                <div className="flex flex-col min-w-0 sm:hidden">
                  <span className="text-[9px] text-shiko-red/70 font-bold">敵攻 {getAttackValue(topPlayer.attackZone)}</span>
                </div>
                <div className="flex space-x-1.5 overflow-x-auto min-w-0">
                  {topPlayer.attackZone.map((ac, idx) => {
                    const isSelected = selectedDisruptAttackCards.some(x => x.playerKey === (isP2View ? 'player1' : 'player2') && x.cardIndex === idx);
                    return (
                      <RenderCard
                        key={idx}
                        card={ac.card}
                        showCharge={ac.charge}
                        isSelected={isSelected}
                        onClick={() => {
                          if (canIControl && extraActionType === 'disrupt') {
                            toggleDisruptAttackCardSelection(isP2View ? 'player1' : 'player2', idx);
                          }
                        }}
                      />
                    );
                  })}
                  {topPlayer.attackZone.length === 0 && (
                    <div className="slot-empty slot-empty--red w-12 h-16 md:w-14 md:h-20">
                      <span className="text-[9px] text-foreground/25">空</span>
                    </div>
                  )}
                </div>
              </div>

              {/* 中：牌堆／回合／棄牌 */}
              <div className="flex flex-col items-center gap-1.5 shrink-0 px-1 md:px-3">
                <div className="flex items-center gap-2 md:gap-3">
                  <div className="pile-stack w-10 h-14 md:w-12 md:h-16 flex flex-col items-center justify-center">
                    <svg className="absolute inset-1.5 opacity-15" viewBox="0 0 40 56" aria-hidden>
                      <rect x="6" y="6" width="28" height="44" rx="2" fill="none" stroke="#f5f4ef" strokeWidth="1.2" />
                      <path d="M12 20h16M12 28h16M12 36h10" stroke="#f5f4ef" strokeWidth="1" />
                    </svg>
                    <span className="text-[8px] text-foreground/40 relative z-[1]">牌堆</span>
                    <span className="text-sm font-bold text-foreground/80 relative z-[1]">{gameState.drawPile.length}</span>
                  </div>
                  <div className="text-center leading-tight px-1">
                    <span className="block text-[8px] text-foreground/35 tracking-widest uppercase">Turn</span>
                    <span className="block text-xl font-black font-serif text-yamabuki-gold">{gameState.turnCount}</span>
                  </div>
                  <div className="pile-stack w-10 h-14 md:w-12 md:h-16 flex flex-col items-center justify-center opacity-80">
                    <span className="text-[8px] text-foreground/35">棄牌</span>
                    <span className="text-sm font-bold text-foreground/55">{gameState.discardPile.length}</span>
                  </div>
                </div>
                <div className="text-center max-w-[11rem] md:max-w-[14rem]">
                  {gameState.phase === 'setup' ? (
                    mySetupReady && !isLocalGuest ? (
                      <div className="bg-sky-500/10 border border-sky-400/35 rounded-full px-3 py-0.5">
                        <p className="text-[9px] text-sky-300 font-bold tracking-wider">已就緒 · 等待對手</p>
                      </div>
                    ) : (
                      <div className="bg-yamabuki-gold/10 border border-yamabuki-gold/35 rounded-full px-3 py-0.5">
                        <p className="text-[9px] text-yamabuki-gold font-bold tracking-wider">配置 · 牆×3＋攻×2</p>
                      </div>
                    )
                  ) : gameState.phase === 'wall_breached_response' ? (
                    <div className="bg-shiko-red/15 border border-shiko-red/40 rounded-full px-3 py-0.5 animate-pulse">
                      <p className="text-[9px] text-shiko-red font-bold tracking-wider">緊急補防</p>
                    </div>
                  ) : (
                    <div className="bg-zinc-900/70 border border-foreground/8 rounded-full px-3 py-0.5">
                      <p className="text-[9px] text-foreground/70 truncate max-w-[10rem]">
                        <span className="text-foreground/35">操盤 </span>{activeActorName}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* 右：己方攻擊 */}
              <div className="flex items-center gap-2.5 min-w-0 justify-end">
                <div className="flex space-x-1.5 overflow-x-auto min-w-0 justify-end">
                  {gameState.phase === 'setup' ? (
                    ([0, 1] as const).map(idx => {
                      const slot = (idx === 0 ? 'attack0' : 'attack1') as SetupSlot;
                      const occupying = displayAttackSlots[idx];
                      const drop = setupCommitted ? null : setupSlotDropProps(slot, setupAttackSlots[idx]);
                      return (
                        <div
                          key={slot}
                          onDragOver={drop?.onDragOver}
                          onDragLeave={drop?.onDragLeave}
                          onDrop={drop?.onDrop}
                          onClick={drop?.onClick}
                          className={`min-w-[3rem] h-16 md:min-w-[3.5rem] md:h-20 ${
                            setupCommitted ? '' : 'cursor-pointer'
                          } ${
                            drop?.classNameHighlight
                              ? 'slot-empty slot-empty--hot'
                              : occupying
                                ? ''
                                : 'slot-empty slot-empty--gold'
                          }`}
                        >
                          {occupying ? (
                            <RenderCard
                              card={occupying}
                              draggable={!!canIControl && !setupCommitted}
                              onDragStart={setupCommitted ? undefined : (e) => {
                                e.dataTransfer.setData('text/plain', occupying.id);
                                e.dataTransfer.effectAllowed = 'move';
                                setSetupDraggingCardId(occupying.id);
                                clearUISelections();
                              }}
                              onDragEnd={setupCommitted ? undefined : () => {
                                setSetupDraggingCardId(null);
                                setSetupDropTarget(null);
                              }}
                            />
                          ) : (
                            <span className="text-[9px] text-yamabuki-gold/55 font-serif">攻{idx + 1}</span>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <>
                      {bottomPlayer.attackZone.map((ac, idx) => {
                        const isSelected = selectedDisruptAttackCards.some(x => x.playerKey === (isP2View ? 'player2' : 'player1') && x.cardIndex === idx);
                        const isReplaceSelected = replaceAttackIds.includes(ac.card.id);
                        return (
                          <RenderCard
                            key={idx}
                            card={ac.card}
                            showCharge={ac.charge}
                            isSelected={isSelected || isReplaceSelected}
                            onClick={() => {
                              if (canIControl) {
                                if (extraActionType === 'disrupt') {
                                  toggleDisruptAttackCardSelection(isP2View ? 'player2' : 'player1', idx);
                                } else if (gameState.phase === 'main_action') {
                                  if (replaceAttackIds.includes(ac.card.id)) {
                                    setReplaceAttackIds(replaceAttackIds.filter(id => id !== ac.card.id));
                                  } else if (replaceAttackIds.length >= 2) {
                                    setReplaceAttackIds([replaceAttackIds[1], ac.card.id]);
                                  } else {
                                    setReplaceAttackIds([...replaceAttackIds, ac.card.id]);
                                  }
                                }
                              }
                            }}
                          />
                        );
                      })}
                      {bottomPlayer.attackZone.length === 0 && (
                        <div className="slot-empty slot-empty--gold w-12 h-16 md:w-14 md:h-20">
                          <span className="text-[9px] text-foreground/25">空</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
                <div className="hidden sm:flex flex-col items-center shrink-0 gap-0.5">
                  <div className="w-9 h-9 rounded-full bg-yamabuki-gold/10 border border-yamabuki-gold/35 flex items-center justify-center text-yamabuki-gold">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                      <path d="M14.5 3.5 L20.5 9.5 L18 12 L16.5 10.5 L13.5 13.5 L15 15 L12.5 17.5 L9.5 14.5 L4 20 L3 19 L8.5 13.5 L5.5 10.5 L8 8 L9.5 9.5 L12.5 6.5 L11 5 Z" />
                    </svg>
                  </div>
                  <span className="text-[9px] font-bold tracking-wider text-yamabuki-gold/80">我攻</span>
                  <span className="text-sm font-black font-serif text-yamabuki-gold leading-none">
                    {gameState.phase === 'setup'
                      ? `${[displayAttackSlots[0], displayAttackSlots[1]].filter(Boolean).length}/2`
                      : getAttackValue(bottomPlayer.attackZone)}
                  </span>
                </div>
                <div className="flex flex-col min-w-0 sm:hidden text-right">
                  <span className="text-[9px] text-yamabuki-gold/70 font-bold">
                    我攻 {gameState.phase === 'setup'
                      ? `${[displayAttackSlots[0], displayAttackSlots[1]].filter(Boolean).length}/2`
                      : getAttackValue(bottomPlayer.attackZone)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* C. 玩家區域 (下方) */}
          <div className="space-y-3">
            {/* 己方三層圓弧城牆 */}
            <div className="wall-stage wall-stage--ally relative w-full max-w-[520px] aspect-[500/220] mx-auto select-none p-1">
              <svg viewBox="0 0 500 220" className="absolute inset-0 w-full h-full pointer-events-none">
                <defs>
                  <linearGradient id="ally-ground" x1="0" y1="1" x2="0" y2="0">
                    <stop offset="0%" stopColor="#1a1810" stopOpacity="0" />
                    <stop offset="100%" stopColor="#2a2414" stopOpacity="0.45" />
                  </linearGradient>
                  <filter id="wall-glow-gold" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="1.5" result="b" />
                    <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                  </filter>
                </defs>
                <rect width="500" height="220" fill="url(#ally-ground)" />
                <g opacity="0.3" fill="#f9a8d4">
                  <path d="M80 185c2-4 6-4 5 2-2 3-6 2-5-2z" />
                  <path d="M420 145c2-4 6-4 5 2-2 3-6 2-5-2z" />
                </g>
                <g filter="url(#wall-glow-gold)">
                  <path d="M228 220h44v-18l-4-4h-8l-2-6h-16l-2 6h-8l-4 4v18z" fill="#1c1910" stroke="#d4af37" strokeWidth="1.4" />
                  <path d="M236 220v-10M244 220v-10M252 220v-10M260 220v-10" stroke="#d4af37" strokeWidth="1" opacity="0.5" />
                </g>
                <path d="M185 220 A 65 65 0 0 1 315 220" stroke={bottomPlayer.walls[2].breached ? "#7f1d1d" : "#8a8a92"} strokeWidth="5" fill="none" strokeLinecap="round" strokeDasharray={bottomPlayer.walls[2].breached ? "3 3" : "10 5"} opacity={bottomPlayer.walls[2].breached ? 0.5 : 0.9} />
                <path d="M120 220 A 130 130 0 0 1 380 220" stroke={bottomPlayer.walls[1].breached ? "#7f1d1d" : "#6b6b74"} strokeWidth="7" fill="none" strokeLinecap="round" strokeDasharray={bottomPlayer.walls[1].breached ? "3 3" : "12 5"} opacity={bottomPlayer.walls[1].breached ? 0.5 : 0.95} />
                <path d="M55 220 A 195 195 0 0 1 445 220" stroke={bottomPlayer.walls[0].breached ? "#7f1d1d" : "#d4af37"} strokeWidth="9" fill="none" strokeLinecap="round" strokeDasharray={bottomPlayer.walls[0].breached ? "3 3" : "14 6"} opacity={bottomPlayer.walls[0].breached ? 0.45 : 0.8} />
              </svg>

              {/* Wall 1 卡牌 (Apex Y = 25) */}
              {(() => {
                const wallDrop = gameState.phase === 'setup' && !setupCommitted
                  ? setupSlotDropProps('wall1', setupWall1)
                  : null;
                return (
              <div 
                className={`absolute left-1/2 -translate-x-1/2 flex flex-col items-center cursor-pointer transition-all ${selectedWallIndex === 0 ? 'scale-102' : ''} ${wallDrop?.classNameHighlight ? 'drop-shadow-[0_0_12px_rgba(212,175,55,0.45)]' : ''}`}
                style={{ top: '5px' }}
                onDragOver={wallDrop?.onDragOver}
                onDragLeave={wallDrop?.onDragLeave}
                onDrop={wallDrop?.onDrop}
                onClick={() => {
                  if (gameState.phase === 'setup' && !setupCommitted) {
                    handleSetupSlotInteract('wall1', setupWall1);
                    return;
                  }
                  if (canIControl && !bottomPlayer.walls[0].breached) {
                    selectWallIndex(selectedWallIndex === 0 ? null : 0);
                  }
                }}
              >
                <div className={`wall-badge ${
                  bottomPlayer.walls[0].breached
                    ? 'wall-badge--breached'
                    : selectedWallIndex === 0 || (gameState.phase === 'setup' && setupIsPlacing)
                      ? 'wall-badge--active'
                      : 'text-foreground/75'
                }`}>
                  <span>首關</span>
                  {gameState.phase === 'setup' ? (
                    <span>
                      {displayWall1
                        ? (setupCommitted ? '已部署' : getCardValueLabel(displayWall1.value))
                        : '放置'}
                    </span>
                  ) : bottomPlayer.walls[0].breached ? (
                    <span className="font-bold">破</span>
                  ) : (
                    <span>{getWallDefenseValue(bottomPlayer.walls[0])}/{wallLimits[0]}</span>
                  )}
                </div>
                <div className="flex gap-1 mt-1 justify-center items-center scale-90 origin-top min-h-[4.5rem]">
                  {gameState.phase === 'setup' ? (
                    displayWall1 ? (
                      <RenderCard
                        card={displayWall1}
                        draggable={!!canIControl && !setupCommitted}
                        onDragStart={setupCommitted ? undefined : (e) => {
                          e.dataTransfer.setData('text/plain', displayWall1.id);
                          e.dataTransfer.effectAllowed = 'move';
                          setSetupDraggingCardId(displayWall1.id);
                          clearUISelections();
                        }}
                        onDragEnd={setupCommitted ? undefined : () => {
                          setSetupDraggingCardId(null);
                          setSetupDropTarget(null);
                        }}
                      />
                    ) : (
                      <div className="slot-empty slot-empty--gold w-12 h-16 md:w-14 md:h-20">
                        <span className="text-[8px] text-yamabuki-gold/40">空</span>
                      </div>
                    )
                  ) : (
                    !bottomPlayer.walls[0].breached && bottomPlayer.walls[0].cards.map((card, cardIdx) => (
                      <RenderCard key={cardIdx} card={card} />
                    ))
                  )}
                </div>
              </div>
                );
              })()}

              {/* Wall 2 卡牌 (Apex Y = 90) */}
              {(() => {
                const wallDrop = gameState.phase === 'setup' && !setupCommitted
                  ? setupSlotDropProps('wall2', setupWall2)
                  : null;
                return (
              <div 
                className={`absolute left-1/2 -translate-x-1/2 flex flex-col items-center cursor-pointer transition-all ${selectedWallIndex === 1 ? 'scale-102' : ''} ${wallDrop?.classNameHighlight ? 'drop-shadow-[0_0_12px_rgba(212,175,55,0.45)]' : ''}`}
                style={{ top: '70px' }}
                onDragOver={wallDrop?.onDragOver}
                onDragLeave={wallDrop?.onDragLeave}
                onDrop={wallDrop?.onDrop}
                onClick={() => {
                  if (gameState.phase === 'setup' && !setupCommitted) {
                    handleSetupSlotInteract('wall2', setupWall2);
                    return;
                  }
                  if (canIControl && !bottomPlayer.walls[1].breached) {
                    selectWallIndex(selectedWallIndex === 1 ? null : 1);
                  }
                }}
              >
                <div className={`wall-badge ${
                  bottomPlayer.walls[1].breached
                    ? 'wall-badge--breached'
                    : selectedWallIndex === 1 || (gameState.phase === 'setup' && setupIsPlacing)
                      ? 'wall-badge--active'
                      : 'text-foreground/75'
                }`}>
                  <span>二關</span>
                  {gameState.phase === 'setup' ? (
                    <span>
                      {displayWall2
                        ? (setupCommitted ? '已部署' : getCardValueLabel(displayWall2.value))
                        : '放置'}
                    </span>
                  ) : bottomPlayer.walls[1].breached ? (
                    <span className="font-bold">破</span>
                  ) : (
                    <span>{getWallDefenseValue(bottomPlayer.walls[1])}/{wallLimits[1]}</span>
                  )}
                </div>
                <div className="flex gap-1 mt-1 justify-center items-center scale-90 origin-top min-h-[4.5rem]">
                  {gameState.phase === 'setup' ? (
                    displayWall2 ? (
                      <RenderCard
                        card={displayWall2}
                        draggable={!!canIControl && !setupCommitted}
                        onDragStart={setupCommitted ? undefined : (e) => {
                          e.dataTransfer.setData('text/plain', displayWall2.id);
                          e.dataTransfer.effectAllowed = 'move';
                          setSetupDraggingCardId(displayWall2.id);
                          clearUISelections();
                        }}
                        onDragEnd={setupCommitted ? undefined : () => {
                          setSetupDraggingCardId(null);
                          setSetupDropTarget(null);
                        }}
                      />
                    ) : (
                      <div className="slot-empty slot-empty--gold w-12 h-16 md:w-14 md:h-20">
                        <span className="text-[8px] text-yamabuki-gold/40">空</span>
                      </div>
                    )
                  ) : (
                    !bottomPlayer.walls[1].breached && bottomPlayer.walls[1].cards.map((card, cardIdx) => (
                      <RenderCard key={cardIdx} card={card} />
                    ))
                  )}
                </div>
              </div>
                );
              })()}

              {/* Wall 3 卡牌 (Apex Y = 155) */}
              {(() => {
                const wallDrop = gameState.phase === 'setup' && !setupCommitted
                  ? setupSlotDropProps('wall3', setupWall3)
                  : null;
                return (
              <div 
                className={`absolute left-1/2 -translate-x-1/2 flex flex-col items-center cursor-pointer transition-all ${selectedWallIndex === 2 ? 'scale-102' : ''} ${wallDrop?.classNameHighlight ? 'drop-shadow-[0_0_12px_rgba(212,175,55,0.45)]' : ''}`}
                style={{ top: '135px' }}
                onDragOver={wallDrop?.onDragOver}
                onDragLeave={wallDrop?.onDragLeave}
                onDrop={wallDrop?.onDrop}
                onClick={() => {
                  if (gameState.phase === 'setup' && !setupCommitted) {
                    handleSetupSlotInteract('wall3', setupWall3);
                    return;
                  }
                  if (canIControl && !bottomPlayer.walls[2].breached) {
                    selectWallIndex(selectedWallIndex === 2 ? null : 2);
                  }
                }}
              >
                <div className={`wall-badge ${
                  bottomPlayer.walls[2].breached
                    ? 'wall-badge--breached'
                    : selectedWallIndex === 2 || (gameState.phase === 'setup' && setupIsPlacing)
                      ? 'wall-badge--active'
                      : 'text-foreground/75'
                }`}>
                  <span>本丸</span>
                  {gameState.phase === 'setup' ? (
                    <span>
                      {displayWall3
                        ? (setupCommitted ? '已部署' : getCardValueLabel(displayWall3.value))
                        : '放置'}
                    </span>
                  ) : bottomPlayer.walls[2].breached ? (
                    <span className="font-bold">破</span>
                  ) : (
                    <span>{getWallDefenseValue(bottomPlayer.walls[2])}/{wallLimits[2]}</span>
                  )}
                </div>
                <div className="flex gap-1 mt-1 justify-center items-center scale-90 origin-top min-h-[4.5rem]">
                  {gameState.phase === 'setup' ? (
                    displayWall3 ? (
                      <RenderCard
                        card={displayWall3}
                        draggable={!!canIControl && !setupCommitted}
                        onDragStart={setupCommitted ? undefined : (e) => {
                          e.dataTransfer.setData('text/plain', displayWall3.id);
                          e.dataTransfer.effectAllowed = 'move';
                          setSetupDraggingCardId(displayWall3.id);
                          clearUISelections();
                        }}
                        onDragEnd={setupCommitted ? undefined : () => {
                          setSetupDraggingCardId(null);
                          setSetupDropTarget(null);
                        }}
                      />
                    ) : (
                      <div className="slot-empty slot-empty--gold w-12 h-16 md:w-14 md:h-20">
                        <span className="text-[8px] text-yamabuki-gold/40">空</span>
                      </div>
                    )
                  ) : (
                    !bottomPlayer.walls[2].breached && bottomPlayer.walls[2].cards.map((card, cardIdx) => (
                      <RenderCard key={cardIdx} card={card} />
                    ))
                  )}
                </div>
              </div>
                );
              })()}
            </div>

            {/* 己方資訊與手牌 */}
            <div className="flex items-center justify-between pt-1">
              <div className="player-chip">
                <span className="w-2 h-2 rounded-full bg-yamabuki-gold"></span>
                <span className="text-xs font-semibold text-foreground/80">
                  {gameState.phase === 'setup'
                    ? (setupCommitted ? '剩餘手牌' : '待派卡牌')
                    : `${bottomPlayer.email} · 手牌`}
                </span>
                {(gameState.phase !== 'setup' || setupCommitted) && (
                  <span className="text-[9px] text-foreground/40">
                    {setupCommitted ? `${bottomPlayer.hand.length} 張` : '上限 8'}
                  </span>
                )}
              </div>
              {gameState.phase === 'setup' && (
                <span className="text-[10px] text-yamabuki-gold/80 font-mono tracking-wide">
                  {setupCommitted
                    ? '5/5'
                    : `${[setupWall1, setupWall2, setupWall3, setupAttackSlots[0], setupAttackSlots[1]].filter(Boolean).length}/5`}
                </span>
              )}
              {replaceAttackIds.length > 0 && (
                <span className="text-[9px] text-yamabuki-gold animate-pulse bg-zinc-900/80 border border-yamabuki-gold/30 px-2 py-0.5 rounded-full">
                  替換 {replaceAttackIds.length} 張
                </span>
              )}
            </div>

            {/* 手牌展示與選取區 */}
            <div
              className={`hand-tray flex space-x-2 overflow-x-auto py-3 px-2 min-h-[96px] justify-center ${
                gameState.phase === 'setup' && !setupCommitted && setupDropTarget === 'hand' ? 'hand-tray--drop' : ''
              }`}
              onDragOver={(e) => {
                if (gameState.phase !== 'setup' || setupCommitted || !canIControl) return;
                e.preventDefault();
                setSetupDropTarget('hand');
              }}
              onDragLeave={() => setSetupDropTarget(prev => (prev === 'hand' ? null : prev))}
              onDrop={(e) => {
                if (gameState.phase !== 'setup' || setupCommitted) return;
                e.preventDefault();
                const cardId = e.dataTransfer.getData('text/plain') || setupDraggingCardId;
                if (cardId) returnSetupCardToHand(cardId);
              }}
              onClick={() => {
                if (gameState.phase === 'setup' && !setupCommitted && setupSelectedCardId && setupUsedIds.has(setupSelectedCardId)) {
                  returnSetupCardToHand(setupSelectedCardId);
                }
              }}
            >
              {gameState.phase === 'setup' && setupCommitted && bottomPlayer.hand.map(card => (
                <RenderCard key={card.id} card={card} />
              ))}
              {gameState.phase === 'setup' && setupCommitted && bottomPlayer.hand.length === 0 && (
                <span className="text-xs text-yamabuki-gold/70 italic self-center py-4">
                  已就緒，等待對手完成配置
                </span>
              )}
              {gameState.phase === 'setup' && !setupCommitted && setupAvailableDraft.map(card => {
                const isSelected = selectedHandCardIds.includes(card.id);
                return (
                  <RenderCard
                    key={card.id}
                    card={card}
                    isSelected={isSelected}
                    draggable={canIControl}
                    onDragStart={(e) => {
                      if (!canIControl) return;
                      e.dataTransfer.setData('text/plain', card.id);
                      e.dataTransfer.effectAllowed = 'move';
                      setSetupDraggingCardId(card.id);
                      clearUISelections();
                    }}
                    onDragEnd={() => {
                      setSetupDraggingCardId(null);
                      setSetupDropTarget(null);
                    }}
                    onClick={() => {
                      if (!canIControl) return;
                      // 單選：再點同一張取消，點其他張改選
                      if (selectedHandCardIds.includes(card.id)) {
                        clearUISelections();
                      } else {
                        clearUISelections();
                        toggleHandCardSelection(card.id);
                      }
                    }}
                  />
                );
              })}
              {gameState.phase === 'setup' && !setupCommitted && setupAvailableDraft.length === 0 && (
                <span className="text-xs text-yamabuki-gold/70 italic self-center py-4">
                  五張已就位，點右下角確認部署
                </span>
              )}
              {gameState.phase !== 'setup' && bottomPlayer.hand.map((card) => {
                const isSelected = selectedHandCardIds.includes(card.id);
                return (
                  <RenderCard
                    key={card.id}
                    card={card}
                    isSelected={isSelected}
                    onClick={() => {
                      if (canIControl) {
                        toggleHandCardSelection(card.id);
                      }
                    }}
                  />
                );
              })}
              {gameState.phase !== 'setup' && bottomPlayer.hand.length === 0 && (
                <span className="text-xs text-foreground/20 italic self-center py-4">兩手空空，請儘快抽牌補給</span>
              )}
            </div>
          </div>
        </div>

        {/* 右側：操控面板與行動日誌（開局 setup 改為場上拖放，隱藏此欄） */}
        {gameState.phase !== 'setup' && (
        <div className="w-full lg:w-80 flex flex-col justify-between gap-4 h-full">
          
          {/* A. 操盤手行動按鈕面板 */}
          <div className="washi-paper rounded-xl p-4 flex flex-col justify-between border-t-2 border-t-yamabuki-gold flex-1 max-h-[55%] overflow-y-auto">
            <h2 className="text-xs font-black font-serif text-yamabuki-gold tracking-widest mb-3 border-b border-foreground/10 pb-1.5 flex items-center justify-between">
              <span>軍機操盤所</span>
              <Sparkles className="w-3.5 h-3.5" />
            </h2>

            {/* 2. 緊急防守增援面板 (僅在 wall_breached_response 階段顯示) */}
            {gameState.phase === 'wall_breached_response' && gameState.breachedResponseState && (
              <div className="space-y-3 flex-1 flex flex-col justify-between">
                <div className="bg-shiko-red/10 border border-shiko-red/30 p-2.5 rounded text-[11px] text-foreground/80 leading-relaxed">
                  <span className="text-shiko-red font-bold">防禦突破警告！</span>
                  您的城牆被打破了。請在下方己方剩餘城牆中選定城牆（Wall 2 或 3，需點選該層牆面），並挑選 1~2 張手牌，點擊按鈕派遣援兵。您也可以直接點擊按鈕，跳過防守。
                </div>

                <div className="space-y-1 bg-zinc-900/60 p-2 rounded">
                  <div className="text-[10px] text-foreground/45 flex justify-between">
                    <span>所選目標城牆：</span>
                    <span className="text-yamabuki-gold font-bold">
                      {selectedWallIndex !== null ? `第 ${selectedWallIndex+1} 層城牆` : '尚未選定'}
                    </span>
                  </div>
                  <div className="text-[10px] text-foreground/45 flex justify-between">
                    <span>所選增援卡牌：</span>
                    <span className="text-yamabuki-gold font-bold">
                      {selectedHandCardIds.length} 張
                    </span>
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <button
                    onClick={handleBreachResponseSubmit}
                    disabled={!canIControl}
                    className="w-full bg-gradient-to-r from-shiko-red to-red-700 hover:from-red-600 hover:to-red-800 text-white font-bold py-2 rounded text-xs transition-all flex items-center justify-center space-x-1"
                  >
                    <Shield className="w-3.5 h-3.5" />
                    <span>派兵補防</span>
                  </button>
                  <button
                    onClick={() => submitAction(code, 'respond_breach', { placements: [] })}
                    disabled={!canIControl}
                    className="w-full bg-zinc-800 hover:bg-zinc-700 text-foreground/70 py-1.5 rounded text-[10px] transition-all"
                  >
                    不做調整，直接略過
                  </button>
                </div>
              </div>
            )}

            {/* 3. 標準回合階段 (主行動 / 額外行動) */}
            {gameState.phase !== 'wall_breached_response' && gameState.phase !== 'finished' && (
              <div className="space-y-4 flex-1 flex flex-col justify-between">
                
                {/* 頂部當前回合權限警示 */}
                {!canIControl && (
                  <div className="bg-zinc-900 border border-foreground/5 p-2 rounded flex items-center space-x-2 text-[10px] text-foreground/50">
                    <AlertCircle className="w-3.5 h-3.5 text-yamabuki-gold flex-shrink-0" />
                    <span>正待對手行動，本機無法下達軍令。</span>
                  </div>
                )}

                {/* 階段 1：主要行動 */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-foreground/45 font-bold uppercase tracking-wider">
                      主要行動 (三選一，必須執行)
                    </span>
                    {gameState.phase === 'main_action' && canIControl && (
                      <span className="text-[9px] bg-yamabuki-gold/20 text-yamabuki-gold px-1.5 py-0.5 rounded font-black animate-pulse">進行中</span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-1.5">
                    {/* A. 放置攻擊牌 */}
                    <button
                      onClick={handlePlaceAttack}
                      disabled={!canIControl || gameState.phase !== 'main_action'}
                      className={`w-full text-left py-2 px-3 rounded text-xs font-medium border transition-all flex justify-between items-center ${
                        gameState.phase === 'main_action' && canIControl
                          ? 'bg-zinc-800 border-foreground/15 hover:border-yamabuki-gold hover:bg-zinc-750 text-foreground'
                          : 'bg-zinc-950/20 border-transparent text-foreground/30'
                      }`}
                    >
                      <span className="flex items-center space-x-1.5">
                        <Sword className="w-3.5 h-3.5 text-shiko-red" />
                        <span>派遣攻擊牌至攻擊區</span>
                      </span>
                      <span className="text-[9px] text-foreground/40 font-mono">手牌{selectedHandCardIds.length}張</span>
                    </button>
                    
                    {/* B. 放置防守牌 */}
                    <button
                      onClick={handlePlaceDefense}
                      disabled={!canIControl || gameState.phase !== 'main_action'}
                      className={`w-full text-left py-2 px-3 rounded text-xs font-medium border transition-all flex justify-between items-center ${
                        gameState.phase === 'main_action' && canIControl
                          ? 'bg-zinc-800 border-foreground/15 hover:border-yamabuki-gold hover:bg-zinc-750 text-foreground'
                          : 'bg-zinc-950/20 border-transparent text-foreground/30'
                      }`}
                    >
                      <span className="flex items-center space-x-1.5">
                        <Shield className="w-3.5 h-3.5 text-sky-500" />
                        <span>增建防守牌至指定城牆</span>
                      </span>
                      <span className="text-[9px] text-foreground/40 font-mono">
                        {selectedWallIndex !== null ? `Wall ${selectedWallIndex+1}` : '選牆'}
                      </span>
                    </button>

                    {/* C. 蓄力 */}
                    <button
                      onClick={handleCharge}
                      disabled={!canIControl || gameState.phase !== 'main_action'}
                      className={`w-full text-left py-2 px-3 rounded text-xs font-medium border transition-all flex justify-between items-center ${
                        gameState.phase === 'main_action' && canIControl
                          ? 'bg-zinc-800 border-foreground/15 hover:border-yamabuki-gold hover:bg-zinc-750 text-foreground'
                          : 'bg-zinc-950/20 border-transparent text-foreground/30'
                      }`}
                    >
                      <span className="flex items-center space-x-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-yamabuki-gold" />
                        <span>三軍蓄力 (攻擊區 Charge +1)</span>
                      </span>
                      <span className="text-[9px] text-yamabuki-gold font-bold">Charge</span>
                    </button>
                  </div>
                </div>

                {/* 階段 2：額外行動 */}
                <div className="space-y-2 pt-2 border-t border-foreground/5">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-foreground/45 font-bold uppercase tracking-wider">
                      額外行動 (四選一，或跳過)
                    </span>
                    {gameState.phase === 'extra_action' && canIControl && (
                      <span className="text-[9px] bg-sky-500/20 text-sky-400 px-1.5 py-0.5 rounded font-black animate-pulse">進行中</span>
                    )}
                  </div>

                  {extraActionType === 'none' ? (
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        onClick={handleDraw2}
                        disabled={!canIControl || gameState.phase !== 'extra_action' || gameState.hasDoneExtraAction}
                        className="py-2 px-2 bg-zinc-800 border border-foreground/10 rounded text-center text-xs hover:border-yamabuki-gold text-foreground font-serif disabled:opacity-30 disabled:border-transparent"
                      >
                        抽牌 2 張
                      </button>
                      <button
                        onClick={handleAttack}
                        disabled={!canIControl || gameState.phase !== 'extra_action' || gameState.hasDoneExtraAction || gameState.turnCount === 1}
                        className="py-2 px-2 bg-zinc-800 border border-foreground/10 rounded text-center text-xs hover:border-shiko-red text-foreground font-serif disabled:opacity-30 disabled:border-transparent"
                      >
                        攻打城牆
                      </button>
                      <button
                        onClick={() => setExtraActionType('scout')}
                        disabled={!canIControl || gameState.phase !== 'extra_action' || gameState.hasDoneExtraAction}
                        className="py-2 px-2 bg-zinc-800 border border-foreground/10 rounded text-center text-xs hover:border-yamabuki-gold text-foreground font-serif disabled:opacity-30 disabled:border-transparent"
                      >
                        偵查蓋牌
                      </button>
                      <button
                        onClick={() => setExtraActionType('disrupt')}
                        disabled={!canIControl || gameState.phase !== 'extra_action' || gameState.hasDoneExtraAction}
                        className="py-2 px-2 bg-zinc-800 border border-foreground/10 rounded text-center text-xs hover:border-yamabuki-gold text-foreground font-serif disabled:opacity-30 disabled:border-transparent"
                      >
                        破勢阻擊
                      </button>
                    </div>
                  ) : (
                    /* 偵查 / 破勢的互動選項 */
                    <div className="bg-zinc-900 border border-foreground/10 rounded p-2.5 space-y-2">
                      <p className="text-[10px] text-yamabuki-gold font-bold">
                        {extraActionType === 'scout' ? '【偵查模式】' : '【破勢模式】'}
                      </p>
                      <p className="text-[9px] text-foreground/70 leading-relaxed">
                        {extraActionType === 'scout'
                          ? '請於上方對手城牆點擊 1~2 張蓋牌，隨後點擊下方送出偵查。'
                          : '請點擊上方對手城牆 1~2 張蓋牌，並點選場上 1~2 張攻擊牌將其蓄力歸零，最後點擊按鈕。'}
                      </p>
                      
                      <div className="grid grid-cols-2 gap-1.5 pt-1.5">
                        <button
                          onClick={extraActionType === 'scout' ? handleScout : handleDisrupt}
                          className="bg-yamabuki-gold text-zinc-950 text-[10px] font-bold py-1.5 rounded"
                        >
                          確定施法
                        </button>
                        <button
                          onClick={() => {
                            setExtraActionType('none');
                            clearUISelections();
                          }}
                          className="bg-zinc-800 text-foreground/60 text-[10px] py-1.5 rounded"
                        >
                          取消
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 結束回合 / 跳過額外行動 */}
                  <button
                    onClick={handleEndTurn}
                    disabled={!canIControl || gameState.phase !== 'extra_action'}
                    className="w-full bg-zinc-900 border border-foreground/10 hover:border-foreground/30 text-foreground text-xs py-2 rounded tracking-widest transition-all mt-2 disabled:opacity-30 disabled:border-transparent flex items-center justify-center space-x-1"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>結束回合 / 跳過行動</span>
                  </button>
                </div>
              </div>
            )}

            {/* 4. 結算畫面 (僅在 Finished 階段顯示) */}
            {gameState.phase === 'finished' && (
              <div className="space-y-4 flex-1 flex flex-col justify-between py-2 text-center">
                <div className="py-6 space-y-2">
                  <div className="text-shiko-red font-black text-xl font-serif tracking-widest animate-bounce">
                    合戰結束！
                  </div>
                  <div className="text-sm text-foreground/80 leading-relaxed">
                    獲勝將軍：
                    <span className="text-yamabuki-gold font-bold block text-base font-serif mt-1">
                      {gameState.winnerId === bottomPlayer.id ? bottomPlayer.email : topPlayer.email}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => restartGame(code)}
                  className="w-full bg-gradient-to-r from-shiko-red to-red-700 hover:from-red-650 hover:to-red-800 text-white font-serif font-bold py-2.5 px-4 rounded text-xs transition-all shadow-lg flex items-center justify-center space-x-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>重整旗鼓 (重開一局)</span>
                </button>
              </div>
            )}
          </div>

          {/* B. 行動 Log 面板 (下方) */}
          <div className="washi-paper rounded-xl p-3 flex flex-col border border-foreground/10 flex-1 min-h-[38%] overflow-hidden bg-zinc-950/30">
            <h2 className="text-[10px] font-black font-serif text-yamabuki-gold tracking-widest mb-1.5 border-b border-foreground/5 pb-1 flex justify-between items-center">
              <span>軍務日誌 (Action Log)</span>
              <span className="font-mono text-[9px] text-foreground/30">記錄數: {gameState.logs.length}</span>
            </h2>
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 font-mono text-[10px] leading-relaxed scrollbar-thin select-text">
              {gameState.logs.map((log, index) => {
                let textClass = 'text-foreground/75';
                if (log.includes('【系統】')) textClass = 'text-sky-400';
                else if (log.includes('【行動】')) textClass = 'text-emerald-400';
                else if (log.includes('【額外行動】')) textClass = 'text-yellow-200/90';
                else if (log.includes('【戰報】')) textClass = 'text-shiko-red font-bold';
                else if (log.includes('【補防】')) textClass = 'text-amber-400';
                else if (log.includes('【結算】') || log.includes('【重啟】')) textClass = 'text-yamabuki-gold font-bold text-xs border border-yamabuki-gold/25 p-1 rounded bg-yellow-500/5 my-1';

                return (
                  <div key={index} className={`${textClass} transition-all duration-300 hover:bg-zinc-800/30 px-1 rounded`}>
                    {log}
                  </div>
                );
              })}
              <div ref={logsEndRef} />
            </div>
          </div>
        </div>
        )}
      </div>

      {/* Setup：右下角浮動確認部署 */}
      {gameState.phase === 'setup' && setupIsReady && canIControl && (
        <button
          onClick={handleSetupSubmit}
          className="confirm-fab absolute bottom-6 right-6 z-40 font-serif font-bold py-3 px-6 rounded-full text-sm tracking-wider transition-all"
        >
          確認部署
        </button>
      )}

      {/* 3. 偵查卡牌檢視彈窗 (Scouted Cards Modal) */}
      {scoutedCards && scoutedCards.length > 0 && (
        <div className="absolute inset-0 bg-black/85 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-sm washi-paper rounded-xl p-6 border-t-4 border-t-yamabuki-gold text-center space-y-6 shadow-2xl">
            <h3 className="text-sm font-black font-serif text-yamabuki-gold tracking-widest flex items-center justify-center space-x-1.5">
              <Eye className="w-4 h-4" />
              <span>探子來報：城防偵查結果</span>
            </h3>
            
            <p className="text-xs text-foreground/70 leading-relaxed">
              您所派遣的密探成功偵查到對手防線卡牌，請迅速查閱並規劃策略。
            </p>

            <div className="flex space-x-3 justify-center py-2">
              {scoutedCards.map((card, idx) => (
                <RenderCard key={idx} card={card} />
              ))}
            </div>

            <button
              onClick={() => setScoutedCards(null)}
              className="bg-yamabuki-gold hover:bg-yellow-600 text-zinc-950 text-xs font-bold py-2 px-6 rounded transition-all shadow-lg tracking-wider"
            >
              微臣遵旨 (關閉並遮蔽)
            </button>
          </div>
        </div>
      )}

      {/* 4. Hot-seat 輪流操作防窺交接遮罩 */}
      {isPassDeviceOverlayVisible && (
        <div className="absolute inset-0 bg-black/95 backdrop-blur-md z-50 flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-md washi-paper rounded-xl p-8 border-2 border-shiko-red text-center space-y-6 shadow-2xl relative">
            <div className="w-16 h-16 rounded-full bg-red-950 border border-shiko-red/40 flex items-center justify-center mx-auto text-shiko-red animate-pulse">
              <Sword className="w-8 h-8" />
            </div>
            
            <h3 className="text-lg font-black font-serif text-shiko-red tracking-widest">
              【回合交替：裝置移交】
            </h3>
            
            <div className="space-y-3 py-2 bg-zinc-900/60 p-4 rounded border border-foreground/5 leading-relaxed text-xs">
              <p className="text-foreground/80">
                下一個行動將領為：
                <span className="text-yamabuki-gold font-bold block text-sm font-serif mt-1">
                  {activeActorName}
                </span>
              </p>
              <p className="text-foreground/50 text-[10px] leading-relaxed">
                為防窺探對方手牌與軍情部署，請將手機/電腦移交給該將軍。準備妥當後，點擊下方按鈕以展開戰局。
              </p>
            </div>

            <button
              onClick={() => setIsPassDeviceOverlayVisible(false)}
              className="w-full bg-gradient-to-r from-shiko-red to-red-700 hover:from-red-650 hover:to-red-800 text-white font-serif font-bold py-3 px-4 rounded text-xs transition-all shadow-lg tracking-widest"
            >
              末將就位，開啟回合！
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
