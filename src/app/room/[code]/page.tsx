'use client';

import { useEffect, useState, useRef, useCallback, use, type DragEvent, type MouseEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useGameStore } from '@/store/useGameStore';
import { Card } from '@/lib/game/types';
import { getAttackValue, getWallDefenseValue, WALL_LIMITS } from '@/lib/game/engine';
import { computeSpotlight, computeBreachGuide } from '@/lib/game/ui-step';
import { ArrowLeft, RotateCcw, Eye, Sword } from 'lucide-react';
import {
  GameCard, WallArc, SiegeAxis, HandDock, ActionDock,
  LogDrawer, WaitingRoom, DiscardPileModal, BreachGuideBar,
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
    fetchUser, fetchRoom, subscribeRoomEvents, submitAction, restartGame,
    toggleHandCardSelection, toggleOpponentCardSelection,
    toggleDisruptAttackCardSelection, selectWallIndex,
    clearUISelections, setScoutedCards,
  } = useGameStore();

  const [isPassDeviceOverlayVisible, setIsPassDeviceOverlayVisible] = useState(false);
  const [activeActorId, setActiveActorId] = useState('');
  const [activeActorName, setActiveActorName] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  const [setupWall1, setSetupWall1] = useState<Card | null>(null);
  const [setupWall2, setSetupWall2] = useState<Card | null>(null);
  const [setupWall3, setSetupWall3] = useState<Card | null>(null);
  const [setupAttackSlots, setSetupAttackSlots] = useState<[Card | null, Card | null]>([null, null]);
  const [setupDraggingCardId, setSetupDraggingCardId] = useState<string | null>(null);
  const [setupDropTarget, setSetupDropTarget] = useState<string | null>(null);

  const [replaceAttackIds, setReplaceAttackIds] = useState<string[]>([]);
  const [extraActionType, setExtraActionType] = useState<'scout' | 'disrupt' | 'none'>('none');
  const [mainActionIntent, setMainActionIntent] = useState<'attack' | 'defense' | 'charge' | null>(null);
  const [isLogOpen, setIsLogOpen] = useState(false);
  const [isDiscardModalOpen, setIsDiscardModalOpen] = useState(false);

  const lastActorIdRef = useRef<string | null>(null);
  const timeoutFiredRef = useRef<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2800);
  }, []);

  const runAction = useCallback(async (fn: () => Promise<void>) => {
    try {
      await fn();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : '行動失敗');
    }
  }, [showToast]);

  /* ═══ Effects ═══ */

  useEffect(() => {
    fetchUser();
    fetchRoom(code);
    clearUISelections();
  }, [code, fetchUser, fetchRoom, clearUISelections]);

  useEffect(() => {
    const unsubscribe = subscribeRoomEvents(code);
    return unsubscribe;
  }, [code, subscribeRoomEvents]);

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

  useEffect(() => {
    setMainActionIntent(null);
    setExtraActionType('none');
    setReplaceAttackIds([]);
    clearUISelections();
    timeoutFiredRef.current = null;
  }, [gameState?.phase, gameState?.activePlayerId, gameState?.phaseDeadlineAt, clearUISelections]);

  /* ═══ Early returns ═══ */

  if (room && room.status === 'WAITING' && !gameState) {
    return <WaitingRoom inviteCode={room.code} />;
  }

  if (!room || !gameState) {
    return (
      <div className="game-shell items-center justify-center">
        <div className="w-12 h-12 border-4 border-shiko-red border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-yamabuki-gold font-serif tracking-widest text-sm">載入中…</p>
      </div>
    );
  }

  /* ═══ Derived state ═══ */

  const isLocalGuest = gameState.player2.id === 'guest';
  const isPlayer1 = room.player1Id === user?.id;
  const isPlayer2 = room.player2Id === user?.id;

  let currentActorId = '';
  if (gameState.phase === 'setup') {
    if (isLocalGuest) {
      if (!gameState.setupState?.player1Ready) currentActorId = gameState.player1.id;
      else currentActorId = gameState.player2.id;
    } else {
      const p1r = !!gameState.setupState?.player1Ready;
      const p2r = !!gameState.setupState?.player2Ready;
      if (isPlayer1 && !p1r) currentActorId = gameState.player1.id;
      else if (isPlayer2 && !p2r) currentActorId = gameState.player2.id;
      else if (!p1r) currentActorId = gameState.player1.id;
      else if (!p2r) currentActorId = gameState.player2.id;
    }
  } else if (gameState.phase === 'wall_breached_response' && gameState.breachedResponseState) {
    currentActorId = gameState.breachedResponseState.defenderId;
  } else {
    currentActorId = gameState.activePlayerId;
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

  const spotlight = computeSpotlight({
    phase: gameState.phase,
    canIControl,
    mainActionIntent,
    extraActionType,
    selectedHandCount: selectedHandCardIds.length,
    selectedWallIndex,
    selectedOpponentCardCount: selectedOpponentWallCardIndexes.length,
    selectedDisruptAttackCount: selectedDisruptAttackCards.length,
    hasDoneExtraAction: gameState.hasDoneExtraAction,
  });

  const isBreachPhase =
    gameState.phase === 'wall_breached_response' && !!gameState.breachedResponseState;
  const breachedWallIndex = gameState.breachedResponseState?.breachedWallIndex ?? 0;
  const breachWallNames = ['首關', '二關', '本丸'] as const;
  const breachGuide = isBreachPhase
    ? computeBreachGuide({
        canIControl,
        selectedHandCount: selectedHandCardIds.length,
        selectedWallIndex,
        breachedWallIndex,
      })
    : null;

  const attackReady = selectedHandCardIds.length >= 1 && selectedHandCardIds.length <= 2;
  const defenseReady =
    selectedHandCardIds.length >= 1 &&
    selectedHandCardIds.length <= 2 &&
    selectedWallIndex !== null;

  const handleTimerExpire = () => {
    if (!canIControl || !gameState.phaseDeadlineAt) return;
    const key = `${gameState.phase}-${gameState.phaseDeadlineAt}`;
    if (timeoutFiredRef.current === key) return;
    timeoutFiredRef.current = key;
    void (async () => {
      try {
        await submitAction(code, 'timeout_skip', {});
        setMainActionIntent(null);
        setExtraActionType('none');
      } catch {
        timeoutFiredRef.current = null;
        await fetchRoom(code);
      }
    })();
  };

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

  const handleSetupSubmit = () => runAction(async () => {
    if (!setupWall1 || !setupWall2 || !setupWall3 || !setupAttackSlots[0] || !setupAttackSlots[1]) {
      throw new Error('牆×3 ＋ 攻×2');
    }
    await submitAction(code, 'setup', {
      defenseCardIds: [setupWall1.id, setupWall2.id, setupWall3.id],
      attackCardIds: [setupAttackSlots[0].id, setupAttackSlots[1].id],
    });
    setSetupWall1(null); setSetupWall2(null); setSetupWall3(null);
    setSetupAttackSlots([null, null]); clearSetupSelection();
  });

  const handlePlaceAttack = () => runAction(async () => {
    if (!attackReady) throw new Error('選 1～2 張');
    await submitAction(code, 'place_attack', {
      cardIds: selectedHandCardIds,
      replaceIds: replaceAttackIds.length > 0 ? replaceAttackIds : undefined,
    });
    setReplaceAttackIds([]);
    setMainActionIntent(null);
  });

  const handlePlaceDefense = () => runAction(async () => {
    if (!defenseReady) throw new Error('選手牌＋城牆');
    await submitAction(code, 'place_defense', { wallIndex: selectedWallIndex, cardIds: selectedHandCardIds });
    setMainActionIntent(null);
  });

  const handleCharge = () => runAction(async () => {
    await submitAction(code, 'charge', {});
    setMainActionIntent(null);
  });

  const handleDraw2 = () => runAction(async () => {
    await submitAction(code, 'draw', {});
    setExtraActionType('none');
  });

  const handleAttack = () => runAction(async () => { await submitAction(code, 'attack', {}); });

  const handleScout = () => runAction(async () => {
    if (selectedOpponentWallIndex === null || selectedOpponentWallCardIndexes.length === 0) {
      throw new Error('選對手蓋牌');
    }
    await submitAction(code, 'scout', {
      targetWallIndex: selectedOpponentWallIndex,
      cardIndexes: selectedOpponentWallCardIndexes,
    });
    setExtraActionType('none');
  });

  const handleDisrupt = () => runAction(async () => {
    if (selectedOpponentWallIndex === null || selectedOpponentWallCardIndexes.length === 0) {
      throw new Error('選對手蓋牌');
    }
    if (selectedDisruptAttackCards.length === 0) throw new Error('選攻擊牌');
    await submitAction(code, 'disrupt', {
      scoutPlacements: selectedOpponentWallCardIndexes.map(idx => ({
        wallIndex: selectedOpponentWallIndex,
        cardIndex: idx,
      })),
      resetAttackPlacements: selectedDisruptAttackCards,
    });
    setExtraActionType('none');
  });

  const handleEndTurn = () => runAction(async () => { await submitAction(code, 'skip_extra', {}); });

  const handleBreachResponseSubmit = () => runAction(async () => {
    if (selectedHandCardIds.length === 0) {
      await submitAction(code, 'respond_breach', { placements: [] });
      return;
    }
    if (selectedWallIndex === null) throw new Error('選城牆');
    const placements = selectedHandCardIds.map(id => ({ wallIndex: selectedWallIndex, cardId: id }));
    await submitAction(code, 'respond_breach', { placements });
  });

  const cancelIntent = () => {
    setMainActionIntent(null);
    setExtraActionType('none');
    clearUISelections();
  };

  /* ═══ Hand dock computed props ═══ */

  const handCardsToShow = gameState.phase === 'setup'
    ? (setupCommitted ? bottomPlayer.hand : setupAvailableDraft)
    : bottomPlayer.hand;

  const handInfoLabel = gameState.phase === 'setup'
    ? (setupCommitted ? '就緒' : '手牌')
    : isBreachPhase && canIControl
      ? '選補防牌'
      : '手牌';

  const handEmptyMessage = gameState.phase === 'setup'
    ? (setupCommitted ? '等待對手' : '拖放部署')
    : '無牌';

  const isSetupDraft = gameState.phase === 'setup' && !setupCommitted;

  const primaryCTA = (() => {
    if (gameState.phase === 'setup') {
      if (setupCommitted) return null;
      if (setupIsReady && canIControl) {
        return (
          <button type="button" onClick={handleSetupSubmit} className="btn-primary primary-cta">
            部署
          </button>
        );
      }
      return null;
    }
    if (!canIControl || gameState.phase === 'finished') return null;

    if (gameState.phase === 'main_action' && mainActionIntent) {
      const label =
        mainActionIntent === 'attack' ? '出兵' :
        mainActionIntent === 'defense' ? '補防' : '蓄力';
      const onClick =
        mainActionIntent === 'attack' ? handlePlaceAttack :
        mainActionIntent === 'defense' ? handlePlaceDefense : handleCharge;
      const disabled =
        mainActionIntent === 'attack' ? !attackReady :
        mainActionIntent === 'defense' ? !defenseReady : false;
      return (
        <>
          <button type="button" onClick={cancelIntent} className="btn-ghost primary-cta--ghost">取消</button>
          <button type="button" onClick={onClick} disabled={disabled} className="btn-primary primary-cta">
            {label}
          </button>
        </>
      );
    }

    if (gameState.phase === 'extra_action' && extraActionType !== 'none' && !gameState.hasDoneExtraAction) {
      const ready =
        selectedOpponentWallCardIndexes.length >= 1 &&
        (extraActionType === 'scout' || selectedDisruptAttackCards.length >= 1);
      return (
        <>
          <button type="button" onClick={cancelIntent} className="btn-ghost primary-cta--ghost">取消</button>
          <button
            type="button"
            onClick={extraActionType === 'scout' ? handleScout : handleDisrupt}
            disabled={!ready}
            className="btn-primary primary-cta"
          >
            確認
          </button>
        </>
      );
    }

    if (gameState.phase === 'wall_breached_response') {
      const ready = selectedHandCardIds.length > 0 && selectedWallIndex !== null;
      if (selectedHandCardIds.length === 0) {
        return (
          <button
            type="button"
            onClick={() => runAction(async () => { await submitAction(code, 'respond_breach', { placements: [] }); })}
            className="btn-primary primary-cta"
          >
            略過
          </button>
        );
      }
      return (
        <>
          <button type="button" onClick={cancelIntent} className="btn-ghost primary-cta--ghost">取消</button>
          <button
            type="button"
            onClick={handleBreachResponseSubmit}
            disabled={!ready}
            className="btn-primary primary-cta"
          >
            補防
          </button>
        </>
      );
    }

    return null;
  })();

  const shellSpotlight = gameState.phase === 'setup' ? 'setup' : (spotlight ?? 'none');

  /* ═══ Render ═══ */

  return (
    <div className="game-shell select-none font-sans" data-spotlight={shellSpotlight}>
      <header className="room-header">
        <div className="room-header__slot room-header__slot--left">
          <button type="button" onClick={() => router.push('/')} className="room-header__btn" aria-label="返回大廳">
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
        </div>
        <span className="room-header__title" title="瑪麗亞的城牆">瑪麗亞的城牆</span>
        <div className="room-header__slot room-header__slot--right">
          <span className="room-header__code">{room.code}</span>
          <button type="button" onClick={() => setIsLogOpen(prev => !prev)} className="room-header__btn">日誌</button>
          <button type="button" onClick={() => restartGame(code)} className="room-header__btn room-header__btn--danger" aria-label="重開">
            <RotateCcw className="w-3 h-3" />
          </button>
        </div>
      </header>

      <div className="siege-board">
        <div className="flex items-center justify-between px-1 siege-board__enemy-bar">
          <div className="player-chip">
            <span className="player-chip__dot player-chip__dot--enemy" />
            <span>{topPlayer.email}</span>
          </div>
          <span className="player-chip player-chip--muted">{topPlayer.hand.length}</span>
        </div>

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
          guideHighlight={spotlight === 'enemy-wall'}
        />

        <SiegeAxis
          topAttackZone={topPlayer.attackZone}
          bottomAttackZone={bottomPlayer.attackZone}
          drawPileCount={gameState.drawPile.length}
          discardPileCount={gameState.discardPile.length}
          onDiscardPileClick={() => setIsDiscardModalOpen(true)}
          turnCount={gameState.turnCount}
          phase={gameState.phase}
          isP2View={isP2View}
          canIControl={canIControl}
          extraActionType={extraActionType}
          selectedDisruptAttackCards={selectedDisruptAttackCards}
          onDisruptCardClick={toggleDisruptAttackCardSelection}
          replaceAttackIds={replaceAttackIds}
          onReplaceToggle={(cardId) => {
            if (mainActionIntent !== 'attack' && gameState.phase === 'main_action') return;
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
          breachGuideMessage={breachGuide?.message}
          phaseDeadlineAt={gameState.phaseDeadlineAt}
          onTimerExpire={handleTimerExpire}
          guideHighlight={spotlight === 'attack-zone'}
        />

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
            if (gameState.phase === 'main_action' && mainActionIntent !== 'defense') return;
            if (gameState.phase === 'wall_breached_response' || mainActionIntent === 'defense') {
              if (canIControl && !bottomPlayer.walls[wallIndex].breached) {
                selectWallIndex(selectedWallIndex === wallIndex ? null : wallIndex);
              }
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
          guideHighlight={spotlight === 'ally-wall'}
          breachMode={isBreachPhase}
          breachedWallIndex={isBreachPhase ? breachedWallIndex : null}
        />
      </div>

      {breachGuide && (
        <BreachGuideBar
          step={breachGuide.step}
          stepNo={breachGuide.stepNo}
          message={breachGuide.message}
          breachedWallName={breachWallNames[breachedWallIndex] ?? '城牆'}
          canIControl={canIControl}
        />
      )}

      <ActionDock
        phase={gameState.phase}
        canIControl={canIControl}
        spotlight={spotlight}
        mainActionIntent={mainActionIntent}
        setMainActionIntent={setMainActionIntent}
        hasDoneExtraAction={gameState.hasDoneExtraAction}
        turnCount={gameState.turnCount}
        extraActionType={extraActionType}
        setExtraActionType={setExtraActionType}
        onClearSelections={clearUISelections}
        onDraw2={handleDraw2}
        onAttack={handleAttack}
        onEndTurn={handleEndTurn}
        isBreachPhase={gameState.phase === 'wall_breached_response' && !!gameState.breachedResponseState}
        winnerEmail={gameState.winnerId === bottomPlayer.id ? bottomPlayer.email : topPlayer.email}
        onRestart={() => restartGame(code)}
      />

      <HandDock
        cards={handCardsToShow}
        selectedCardIds={selectedHandCardIds}
        canIControl={canIControl}
        onCardClick={(cardId) => {
          if (isSetupDraft) {
            if (selectedHandCardIds.includes(cardId)) clearUISelections();
            else { clearUISelections(); toggleHandCardSelection(cardId); }
            return;
          }
          if (gameState.phase === 'main_action') {
            if (mainActionIntent !== 'attack' && mainActionIntent !== 'defense') return;
          }
          if (gameState.phase === 'wall_breached_response') {
            toggleHandCardSelection(cardId);
            return;
          }
          toggleHandCardSelection(cardId);
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
        guideHighlight={spotlight === 'hand'}
        trailingAction={primaryCTA}
      />

      <LogDrawer logs={gameState.logs} isOpen={isLogOpen} onClose={() => setIsLogOpen(false)} />

      <DiscardPileModal
        cards={gameState.discardPile}
        isOpen={isDiscardModalOpen}
        onClose={() => setIsDiscardModalOpen(false)}
      />

      {toast && <div className="game-toast" role="status">{toast}</div>}
      {error && !toast && <div className="game-toast game-toast--error" role="alert">{error}</div>}

      {scoutedCards && scoutedCards.length > 0 && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-sm washi-paper rounded-xl p-6 border-t-4 border-t-yamabuki-gold text-center space-y-4 shadow-2xl">
            <h3 className="text-sm font-black font-serif text-yamabuki-gold tracking-widest flex items-center justify-center gap-1.5">
              <Eye className="w-4 h-4" /><span>偵查</span>
            </h3>
            <div className="flex gap-3 justify-center py-2">
              {scoutedCards.map((card, idx) => (
                <GameCard key={idx} card={card} />
              ))}
            </div>
            <button type="button" onClick={() => setScoutedCards(null)} className="btn-primary py-2 px-6">
              關閉
            </button>
          </div>
        </div>
      )}

      {isPassDeviceOverlayVisible && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-50 flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-md washi-paper rounded-xl p-8 border-2 border-shiko-red text-center space-y-6 shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-red-950 border border-shiko-red/40 flex items-center justify-center mx-auto text-shiko-red animate-pulse">
              <Sword className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-black font-serif text-shiko-red tracking-widest">移交裝置</h3>
            <p className="text-yamabuki-gold font-bold text-sm font-serif">{activeActorName}</p>
            <button
              type="button"
              onClick={() => setIsPassDeviceOverlayVisible(false)}
              className="btn-danger w-full py-3 tracking-widest text-xs"
            >
              就位
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
