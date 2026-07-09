'use client';

import { useEffect, useState, useRef, use, type DragEvent, type MouseEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useGameStore } from '@/store/useGameStore';
import { Card } from '@/lib/game/types';
import { getAttackValue, getWallDefenseValue, WALL_LIMITS } from '@/lib/game/engine';
import { ArrowLeft, RotateCcw, Eye, Sword } from 'lucide-react';
import {
  GameCard, WallArc, SiegeAxis, HandDock, ActionDock,
  LogDrawer, WaitingRoom, PhaseBanner,
} from '@/components/game';

export default function GameRoomPage({ params: paramsPromise }: { params: Promise<{ code: string }> }) {
  const params = use(paramsPromise);
  const code = params.code;
  const router = useRouter();

  const {
    user, room, gameState, scoutedCards,
    selectedHandCardIds, selectedWallIndex,
    selectedOpponentWallCardIndexes, selectedOpponentWallIndex,
    selectedDisruptAttackCards, isLoading, error,
    fetchUser, fetchRoom, submitAction, restartGame,
    toggleHandCardSelection, toggleOpponentCardSelection,
    toggleDisruptAttackCardSelection, selectWallIndex,
    clearUISelections, setScoutedCards,
  } = useGameStore();

  const [isPassDeviceOverlayVisible, setIsPassDeviceOverlayVisible] = useState(false);
  const [activeActorId, setActiveActorId] = useState('');
  const [activeActorName, setActiveActorName] = useState('');

  const [setupWall1, setSetupWall1] = useState<Card | null>(null);
  const [setupWall2, setSetupWall2] = useState<Card | null>(null);
  const [setupWall3, setSetupWall3] = useState<Card | null>(null);
  const [setupAttackSlots, setSetupAttackSlots] = useState<[Card | null, Card | null]>([null, null]);
  const [setupDraggingCardId, setSetupDraggingCardId] = useState<string | null>(null);
  const [setupDropTarget, setSetupDropTarget] = useState<string | null>(null);

  const [replaceAttackIds, setReplaceAttackIds] = useState<string[]>([]);
  const [extraActionType, setExtraActionType] = useState<'scout' | 'disrupt' | 'none'>('none');
  const [isLogOpen, setIsLogOpen] = useState(false);

  const lastActorIdRef = useRef<string | null>(null);

  /* ═══ Effects ═══ */

  useEffect(() => {
    fetchUser();
    fetchRoom(code);
    clearUISelections();
  }, [code, fetchUser, fetchRoom, clearUISelections]);

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

  useEffect(() => {
    if (!gameState) return;
    let actorId = '';
    let actorName = '';
    if (gameState.phase === 'setup') {
      if (gameState.player2.id === 'guest') {
        if (!gameState.setupState?.player1Ready) { actorId = gameState.player1.id; actorName = gameState.player1.email; }
        else { actorId = gameState.player2.id; actorName = gameState.player2.email; }
      } else {
        const p1Ready = !!gameState.setupState?.player1Ready;
        const p2Ready = !!gameState.setupState?.player2Ready;
        if (!p1Ready && !p2Ready) { actorId = gameState.player1.id; actorName = '雙方配置中'; }
        else if (!p1Ready) { actorId = gameState.player1.id; actorName = gameState.player1.email; }
        else if (!p2Ready) { actorId = gameState.player2.id; actorName = gameState.player2.email; }
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
    const isLG = gameState.player2.id === 'guest';
    if (isLG && lastActorIdRef.current && lastActorIdRef.current !== actorId) {
      setIsPassDeviceOverlayVisible(true);
    }
    lastActorIdRef.current = actorId;
  }, [gameState]);

  useEffect(() => {
    if (gameState?.phase !== 'setup') return;
    if (gameState.player2.id !== 'guest') return;
    setSetupWall1(null); setSetupWall2(null); setSetupWall3(null);
    setSetupAttackSlots([null, null]);
    setSetupDraggingCardId(null); setSetupDropTarget(null);
    clearUISelections();
  }, [activeActorId, gameState?.phase, gameState?.player2.id, clearUISelections]);

  /* ═══ Early returns ═══ */

  if (room && room.status === 'WAITING' && !gameState) {
    return <WaitingRoom inviteCode={room.code} />;
  }

  if (!room || !gameState) {
    return (
      <div className="game-shell items-center justify-center">
        <div className="w-12 h-12 border-4 border-shiko-red border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-yamabuki-gold font-serif tracking-widest text-sm">
          {!room ? '正在載入房間...' : '正在載入古戰場狀態...'}
        </p>
      </div>
    );
  }

  /* ═══ Derived state ═══ */

  const isLocalGuest = gameState.player2.id === 'guest';
  const isPlayer1 = room.player1Id === user?.id;
  const isPlayer2 = room.player2Id === user?.id;

  let currentActorId = '';
  let currentActorName = '';
  if (gameState.phase === 'setup') {
    if (isLocalGuest) {
      if (!gameState.setupState?.player1Ready) { currentActorId = gameState.player1.id; currentActorName = gameState.player1.email; }
      else { currentActorId = gameState.player2.id; currentActorName = gameState.player2.email; }
    } else {
      const p1r = !!gameState.setupState?.player1Ready;
      const p2r = !!gameState.setupState?.player2Ready;
      if (isPlayer1 && !p1r) { currentActorId = gameState.player1.id; currentActorName = gameState.player1.email; }
      else if (isPlayer2 && !p2r) { currentActorId = gameState.player2.id; currentActorName = gameState.player2.email; }
      else if (!p1r) { currentActorId = gameState.player1.id; currentActorName = `${gameState.player1.email}（配置中）`; }
      else if (!p2r) { currentActorId = gameState.player2.id; currentActorName = `${gameState.player2.email}（配置中）`; }
    }
  } else if (gameState.phase === 'wall_breached_response' && gameState.breachedResponseState) {
    currentActorId = gameState.breachedResponseState.defenderId;
    currentActorName = currentActorId === gameState.player1.id ? gameState.player1.email : gameState.player2.email;
  } else {
    currentActorId = gameState.activePlayerId;
    currentActorName = currentActorId === gameState.player1.id ? gameState.player1.email : gameState.player2.email;
  }

  const mySetupReady = isPlayer1
    ? !!gameState.setupState?.player1Ready
    : isPlayer2
      ? !!gameState.setupState?.player2Ready
      : false;

  const canIControl = isLocalGuest
    ? isPlayer1
    : gameState.phase === 'setup'
      ? (isPlayer1 || isPlayer2) && !mySetupReady
      : (currentActorId === room.player1Id && isPlayer1) || (currentActorId === room.player2Id && isPlayer2);

  const isP2View = isLocalGuest ? (currentActorId === gameState.player2.id) : isPlayer2;
  const bottomPlayer = isP2View ? gameState.player2 : gameState.player1;
  const topPlayer = isP2View ? gameState.player1 : gameState.player2;

  type SetupSlot = 'wall1' | 'wall2' | 'wall3' | 'attack0' | 'attack1';

  const setupDraftCards = isP2View
    ? gameState.setupState?.player2Draft
    : gameState.setupState?.player1Draft;

  const setupCommitted = gameState.phase === 'setup' && mySetupReady && !isLocalGuest;

  const displayWall1 = setupCommitted || gameState.phase !== 'setup' ? bottomPlayer.walls[0]?.cards[0] ?? null : setupWall1;
  const displayWall2 = setupCommitted || gameState.phase !== 'setup' ? bottomPlayer.walls[1]?.cards[0] ?? null : setupWall2;
  const displayWall3 = setupCommitted || gameState.phase !== 'setup' ? bottomPlayer.walls[2]?.cards[0] ?? null : setupWall3;
  const displayAttackSlots: [Card | null, Card | null] =
    setupCommitted || gameState.phase !== 'setup'
      ? [bottomPlayer.attackZone[0]?.card ?? null, bottomPlayer.attackZone[1]?.card ?? null]
      : setupAttackSlots;

  const setupUsedIds = new Set(
    [setupWall1?.id, setupWall2?.id, setupWall3?.id, setupAttackSlots[0]?.id, setupAttackSlots[1]?.id]
      .filter(Boolean) as string[],
  );

  const setupAvailableDraft = setupCommitted ? [] : (setupDraftCards ?? []).filter(c => !setupUsedIds.has(c.id));
  const setupSelectedCardId = selectedHandCardIds[0] ?? null;
  const setupIsReady = !!(setupWall1 && setupWall2 && setupWall3 && setupAttackSlots[0] && setupAttackSlots[1]);
  const setupIsPlacing = !setupCommitted && !!(setupDraggingCardId || setupSelectedCardId);

  const wallLimits = [...WALL_LIMITS];

  /* ═══ Setup helpers ═══ */

  const findSetupCard = (cardId: string): Card | undefined => setupDraftCards?.find(c => c.id === cardId);

  const clearSetupSelection = () => { clearUISelections(); setSetupDraggingCardId(null); setSetupDropTarget(null); };

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
    setSetupWall1(w1); setSetupWall2(w2); setSetupWall3(w3);
    setSetupAttackSlots(attacks); clearSetupSelection();
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
    if (activeId) { placeSetupCard(activeId, slot); return; }
    if (occupyingCard) returnSetupCardToHand(occupyingCard.id);
  };

  const setupSlotDropProps = (slot: SetupSlot, occupyingCard: Card | null) => {
    const highlighted = setupIsPlacing && (setupDropTarget === slot || !!setupSelectedCardId);
    return {
      onDragOver: (e: DragEvent) => {
        if (!canIControl || gameState.phase !== 'setup') return;
        e.preventDefault(); e.dataTransfer.dropEffect = 'move';
        setSetupDropTarget(slot);
      },
      onDragLeave: () => { setSetupDropTarget(prev => (prev === slot ? null : prev)); },
      onDrop: (e: DragEvent) => {
        e.preventDefault();
        const cardId = e.dataTransfer.getData('text/plain') || setupDraggingCardId;
        if (cardId) placeSetupCard(cardId, slot);
        else handleSetupSlotInteract(slot, occupyingCard);
      },
      onClick: (e: MouseEvent) => { e.stopPropagation(); handleSetupSlotInteract(slot, occupyingCard); },
      classNameHighlight: highlighted,
    };
  };

  /* ═══ Handlers ═══ */

  const handleSetupSubmit = async () => {
    if (!setupWall1 || !setupWall2 || !setupWall3 || !setupAttackSlots[0] || !setupAttackSlots[1]) {
      alert('請填滿所有配置格子！防禦牌 3 張（各牆1張），攻擊牌 2 張。'); return;
    }
    try {
      await submitAction(code, 'setup', {
        defenseCardIds: [setupWall1.id, setupWall2.id, setupWall3.id],
        attackCardIds: [setupAttackSlots[0].id, setupAttackSlots[1].id],
      });
      setSetupWall1(null); setSetupWall2(null); setSetupWall3(null);
      setSetupAttackSlots([null, null]); clearSetupSelection();
    } catch (e: any) { alert(e.message || '配置失敗'); }
  };

  const handlePlaceAttack = async () => {
    if (selectedHandCardIds.length < 1 || selectedHandCardIds.length > 2) { alert('請選擇 1~2 張手牌放入攻擊區'); return; }
    try {
      await submitAction(code, 'place_attack', {
        cardIds: selectedHandCardIds,
        replaceIds: replaceAttackIds.length > 0 ? replaceAttackIds : undefined,
      });
      setReplaceAttackIds([]);
    } catch (e: any) { alert(e.message || '行動失敗'); }
  };

  const handlePlaceDefense = async () => {
    if (selectedHandCardIds.length < 1 || selectedHandCardIds.length > 2) { alert('請選擇 1~2 張手牌作為防守牌'); return; }
    if (selectedWallIndex === null) { alert('請在下方己方城牆區域選擇要補防的城牆 (Wall 1 ~ 3)'); return; }
    try {
      await submitAction(code, 'place_defense', { wallIndex: selectedWallIndex, cardIds: selectedHandCardIds });
    } catch (e: any) { alert(e.message || '行動失敗'); }
  };

  const handleCharge = async () => {
    try { await submitAction(code, 'charge', {}); } catch (e: any) { alert(e.message || '行動失敗'); }
  };

  const handleDraw2 = async () => {
    try { await submitAction(code, 'draw', {}); } catch (e: any) { alert(e.message || '行動失敗'); }
  };

  const handleAttack = async () => {
    try { await submitAction(code, 'attack', {}); } catch (e: any) { alert(e.message || '行動失敗'); }
  };

  const handleScout = async () => {
    if (selectedOpponentWallIndex === null || selectedOpponentWallCardIndexes.length === 0) {
      alert('請點擊上方對手防護牆上的蓋牌 (最多2張) 以進行偵查'); return;
    }
    try {
      await submitAction(code, 'scout', {
        targetWallIndex: selectedOpponentWallIndex, cardIndexes: selectedOpponentWallCardIndexes,
      });
      setExtraActionType('none');
    } catch (e: any) { alert(e.message || '行動失敗'); }
  };

  const handleDisrupt = async () => {
    if (selectedOpponentWallIndex === null || selectedOpponentWallCardIndexes.length === 0) {
      alert('請點擊上方對手防護牆上的蓋牌 (1~2張) 作為破勢公開對象'); return;
    }
    if (selectedDisruptAttackCards.length === 0) {
      alert('請選擇場上 1~2 張攻擊牌（雙方攻擊區均可選擇）使蓄力歸零'); return;
    }
    try {
      await submitAction(code, 'disrupt', {
        scoutPlacements: selectedOpponentWallCardIndexes.map(idx => ({
          wallIndex: selectedOpponentWallIndex, cardIndex: idx,
        })),
        resetAttackPlacements: selectedDisruptAttackCards,
      });
      setExtraActionType('none');
    } catch (e: any) { alert(e.message || '行動失敗'); }
  };

  const handleEndTurn = async () => {
    try { await submitAction(code, 'skip_extra', {}); } catch (e: any) { alert(e.message || '行動失敗'); }
  };

  const handleBreachResponseSubmit = async () => {
    if (selectedHandCardIds.length === 0) {
      try { await submitAction(code, 'respond_breach', { placements: [] }); }
      catch (e: any) { alert(e.message || '行動失敗'); }
      return;
    }
    if (selectedWallIndex === null) { alert('請選擇要放置防守牌的剩餘城牆'); return; }
    try {
      const placements = selectedHandCardIds.map(id => ({ wallIndex: selectedWallIndex, cardId: id }));
      await submitAction(code, 'respond_breach', { placements });
    } catch (e: any) { alert(e.message || '行動失敗'); }
  };

  /* ═══ Hand dock computed props ═══ */

  const handCardsToShow = gameState.phase === 'setup'
    ? (setupCommitted ? bottomPlayer.hand : setupAvailableDraft)
    : bottomPlayer.hand;

  const handInfoLabel = gameState.phase === 'setup'
    ? (setupCommitted ? '剩餘手牌' : '待派卡牌')
    : `${bottomPlayer.email} · 手牌`;

  const handEmptyMessage = gameState.phase === 'setup'
    ? (setupCommitted ? '已就緒，等待對手完成配置' : '五張已就位，確認部署')
    : '兩手空空，請儘快抽牌補給';

  const isSetupDraft = gameState.phase === 'setup' && !setupCommitted;

  /* ═══ Render ═══ */

  return (
    <div className="game-shell select-none font-sans">
      {/* Header */}
      <header className="room-header px-3 py-2 flex items-center justify-between">
        <button onClick={() => router.push('/')} className="flex items-center gap-1 text-xs text-foreground/55 hover:text-foreground transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /><span className="hidden sm:inline">大廳</span>
        </button>
        <div className="flex items-center gap-1.5">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-yamabuki-gold/80" aria-hidden>
            <path d="M4 20V10l8-6 8 6v10H4z" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.15" />
            <path d="M10 20v-6h4v6" stroke="currentColor" strokeWidth="1.5" />
          </svg>
          <span className="text-sm font-bold font-serif text-yamabuki-gold tracking-widest">{room.code}</span>
          <span className="text-[8px] bg-zinc-900/80 border border-foreground/10 text-foreground/60 px-1.5 py-0.5 rounded-full">
            {isLocalGuest ? '本機' : '線上'}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setIsLogOpen(prev => !prev)}
            className="text-[9px] text-foreground/45 hover:text-foreground/70 transition-colors border border-foreground/10 px-2 py-1 rounded-full"
          >
            日誌
          </button>
          <button
            onClick={() => restartGame(code)}
            className="flex items-center gap-1 text-[9px] text-shiko-red/90 hover:text-shiko-red transition-colors border border-shiko-red/25 bg-shiko-red/5 px-2 py-1 rounded-full"
          >
            <RotateCcw className="w-3 h-3" /><span>重開</span>
          </button>
        </div>
      </header>

      {/* Phase Banner */}
      <PhaseBanner
        phase={gameState.phase}
        activeActorName={currentActorName}
        canIControl={canIControl}
        turnCount={gameState.turnCount}
        mySetupReady={mySetupReady}
        isLocalGuest={isLocalGuest}
        setupCommitted={setupCommitted}
      />

      {/* Scrollable Battlefield */}
      <div className="siege-board">
        {/* Enemy info */}
        <div className="flex items-center justify-between px-1">
          <div className="player-chip">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-shiko-red opacity-40" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-shiko-red" />
            </span>
            <span className="font-semibold text-foreground/80">{topPlayer.email}</span>
          </div>
          <span className="text-[9px] text-foreground/50 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-zinc-900/60 border border-foreground/8">
            手牌 {topPlayer.hand.length}
          </span>
        </div>

        {/* Enemy Walls */}
        <WallArc
          walls={topPlayer.walls}
          wallLimits={wallLimits}
          side="enemy"
          turnCount={gameState.turnCount}
          canIControl={canIControl}
          phase={gameState.phase}
          extraActionType={extraActionType}
          selectedOpponentWallIndex={selectedOpponentWallIndex}
          selectedOpponentWallCardIndexes={selectedOpponentWallCardIndexes}
          onEnemyCardClick={(wallIndex, cardIndex) => toggleOpponentCardSelection(wallIndex, cardIndex)}
        />

        {/* Siege Axis */}
        <SiegeAxis
          topAttackZone={topPlayer.attackZone}
          bottomAttackZone={bottomPlayer.attackZone}
          drawPileCount={gameState.drawPile.length}
          discardPileCount={gameState.discardPile.length}
          turnCount={gameState.turnCount}
          phase={gameState.phase}
          isP2View={isP2View}
          canIControl={canIControl}
          extraActionType={extraActionType}
          selectedDisruptAttackCards={selectedDisruptAttackCards}
          onDisruptCardClick={toggleDisruptAttackCardSelection}
          replaceAttackIds={replaceAttackIds}
          onReplaceToggle={(cardId) => {
            if (replaceAttackIds.includes(cardId)) setReplaceAttackIds(replaceAttackIds.filter(id => id !== cardId));
            else if (replaceAttackIds.length >= 2) setReplaceAttackIds([replaceAttackIds[1], cardId]);
            else setReplaceAttackIds([...replaceAttackIds, cardId]);
          }}
          setupCommitted={setupCommitted}
          displayAttackSlots={displayAttackSlots}
          setupSlotDropProps={isSetupDraft ? (slot, card) => setupSlotDropProps(slot as SetupSlot, card) : undefined}
          onSetupCardDragStart={(cardId, e) => {
            e.dataTransfer.setData('text/plain', cardId);
            e.dataTransfer.effectAllowed = 'move';
            setSetupDraggingCardId(cardId);
            clearUISelections();
          }}
          onSetupCardDragEnd={() => { setSetupDraggingCardId(null); setSetupDropTarget(null); }}
          mySetupReady={mySetupReady}
          isLocalGuest={isLocalGuest}
          activeActorName={activeActorName}
        />

        {/* Ally Walls */}
        <WallArc
          walls={bottomPlayer.walls}
          wallLimits={wallLimits}
          side="ally"
          turnCount={gameState.turnCount}
          canIControl={canIControl}
          phase={gameState.phase}
          selectedWallIndex={selectedWallIndex}
          onAllyWallClick={(wallIndex) => {
            if (isSetupDraft) {
              const slotName = `wall${wallIndex + 1}` as SetupSlot;
              handleSetupSlotInteract(slotName, [setupWall1, setupWall2, setupWall3][wallIndex]);
              return;
            }
            if (canIControl && !bottomPlayer.walls[wallIndex].breached) {
              selectWallIndex(selectedWallIndex === wallIndex ? null : wallIndex);
            }
          }}
          setupCommitted={setupCommitted}
          displayCards={[displayWall1, displayWall2, displayWall3]}
          setupIsPlacing={setupIsPlacing}
          setupSlotDropProps={isSetupDraft ? (slot, card) => setupSlotDropProps(slot as SetupSlot, card) : undefined}
          onCardDragStart={(cardId, e) => {
            e.dataTransfer.setData('text/plain', cardId);
            e.dataTransfer.effectAllowed = 'move';
            setSetupDraggingCardId(cardId);
            clearUISelections();
          }}
          onCardDragEnd={() => { setSetupDraggingCardId(null); setSetupDropTarget(null); }}
        />
      </div>

      {/* Hand Dock */}
      <HandDock
        cards={handCardsToShow}
        selectedCardIds={selectedHandCardIds}
        canIControl={canIControl}
        onCardClick={(cardId) => {
          if (isSetupDraft) {
            if (selectedHandCardIds.includes(cardId)) clearUISelections();
            else { clearUISelections(); toggleHandCardSelection(cardId); }
          } else {
            toggleHandCardSelection(cardId);
          }
        }}
        emptyMessage={handEmptyMessage}
        infoLabel={handInfoLabel}
        isDraggable={isSetupDraft}
        onDragStart={(cardId, e) => {
          e.dataTransfer.setData('text/plain', cardId);
          e.dataTransfer.effectAllowed = 'move';
          setSetupDraggingCardId(cardId);
          clearUISelections();
        }}
        onDragEnd={() => { setSetupDraggingCardId(null); setSetupDropTarget(null); }}
        isDropTarget={isSetupDraft && setupDropTarget === 'hand'}
        onHandDragOver={(e) => {
          if (!isSetupDraft || !canIControl) return;
          e.preventDefault(); setSetupDropTarget('hand');
        }}
        onHandDragLeave={() => setSetupDropTarget(prev => (prev === 'hand' ? null : prev))}
        onHandDrop={(e) => {
          if (!isSetupDraft) return;
          e.preventDefault();
          const cardId = e.dataTransfer.getData('text/plain') || setupDraggingCardId;
          if (cardId) returnSetupCardToHand(cardId);
        }}
        onHandClick={() => {
          if (isSetupDraft && setupSelectedCardId && setupUsedIds.has(setupSelectedCardId)) {
            returnSetupCardToHand(setupSelectedCardId);
          }
        }}
        replaceCount={replaceAttackIds.length > 0 ? replaceAttackIds.length : undefined}
      />

      {/* Action Dock */}
      <ActionDock
        phase={gameState.phase}
        canIControl={canIControl}
        setupIsReady={setupIsReady}
        setupCommitted={setupCommitted}
        onSetupSubmit={handleSetupSubmit}
        onPlaceAttack={handlePlaceAttack}
        onPlaceDefense={handlePlaceDefense}
        onCharge={handleCharge}
        extraActionType={extraActionType}
        setExtraActionType={setExtraActionType}
        hasDoneExtraAction={gameState.hasDoneExtraAction}
        turnCount={gameState.turnCount}
        onDraw2={handleDraw2}
        onAttack={handleAttack}
        onScout={handleScout}
        onDisrupt={handleDisrupt}
        onEndTurn={handleEndTurn}
        onClearSelections={clearUISelections}
        isBreachPhase={gameState.phase === 'wall_breached_response' && !!gameState.breachedResponseState}
        onBreachResponse={handleBreachResponseSubmit}
        onBreachSkip={() => submitAction(code, 'respond_breach', { placements: [] })}
        winnerEmail={gameState.winnerId === bottomPlayer.id ? bottomPlayer.email : topPlayer.email}
        onRestart={() => restartGame(code)}
      />

      {/* Log Drawer */}
      <LogDrawer logs={gameState.logs} isOpen={isLogOpen} onClose={() => setIsLogOpen(false)} />

      {/* Scout Modal */}
      {scoutedCards && scoutedCards.length > 0 && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-sm washi-paper rounded-xl p-6 border-t-4 border-t-yamabuki-gold text-center space-y-6 shadow-2xl">
            <h3 className="text-sm font-black font-serif text-yamabuki-gold tracking-widest flex items-center justify-center gap-1.5">
              <Eye className="w-4 h-4" />
              <span>探子來報：城防偵查結果</span>
            </h3>
            <p className="text-xs text-foreground/70 leading-relaxed">
              您所派遣的密探成功偵查到對手防線卡牌，請迅速查閱並規劃策略。
            </p>
            <div className="flex gap-3 justify-center py-2">
              {scoutedCards.map((card, idx) => (
                <GameCard key={idx} card={card} />
              ))}
            </div>
            <button
              onClick={() => setScoutedCards(null)}
              className="btn-primary py-2 px-6 rounded tracking-wider"
            >
              微臣遵旨 (關閉並遮蔽)
            </button>
          </div>
        </div>
      )}

      {/* Hot-seat Overlay */}
      {isPassDeviceOverlayVisible && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-50 flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-md washi-paper rounded-xl p-8 border-2 border-shiko-red text-center space-y-6 shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-red-950 border border-shiko-red/40 flex items-center justify-center mx-auto text-shiko-red animate-pulse">
              <Sword className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-black font-serif text-shiko-red tracking-widest">
              【回合交替：裝置移交】
            </h3>
            <div className="space-y-3 py-2 bg-zinc-900/60 p-4 rounded border border-foreground/5 leading-relaxed text-xs">
              <p className="text-foreground/80">
                下一個行動將領為：
                <span className="text-yamabuki-gold font-bold block text-sm font-serif mt-1">{activeActorName}</span>
              </p>
              <p className="text-foreground/50 text-[10px] leading-relaxed">
                為防窺探對方手牌與軍情部署，請將手機/電腦移交給該將軍。準備妥當後，點擊下方按鈕以展開戰局。
              </p>
            </div>
            <button
              onClick={() => setIsPassDeviceOverlayVisible(false)}
              className="btn-danger w-full py-3 tracking-widest text-xs"
            >
              末將就位，開啟回合！
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
