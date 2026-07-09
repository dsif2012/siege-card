'use client';

import { useEffect, useState, useRef, use } from 'react';
import { useRouter } from 'next/navigation';
import { useGameStore } from '@/store/useGameStore';
import { Card, AttackCard } from '@/lib/game/types';
import { formatCard, getAttackValue, getWallDefenseValue } from '@/lib/game/engine';
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
  const [setupAttackCards, setSetupAttackCards] = useState<Card[]>([]);

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

  // 2. 聯機對戰定期輪詢
  useEffect(() => {
    if (!room || room.status !== 'PLAYING') return;
    
    // 如果是線上對戰且不輪到當前玩家，則進行輪詢
    const isLocalGuest = gameState?.player2.id === 'guest';
    const isMyTurn = gameState?.activePlayerId === user?.id || (gameState?.phase === 'wall_breached_response' && gameState?.breachedResponseState?.defenderId === user?.id);
    
    // 即使輪到自己也進行低頻率同步，若不是自己則高頻率同步
    const intervalTime = isLocalGuest ? 10000 : (isMyTurn ? 5000 : 2500);

    const timer = setInterval(() => {
      fetchRoom(code);
    }, intervalTime);

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
      if (!gameState.setupState?.player1Ready) {
        actorId = gameState.player1.id;
        actorName = gameState.player1.email;
      } else {
        actorId = gameState.player2.id;
        actorName = gameState.player2.email;
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

  if (!gameState || !room) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[#111113]">
        <div className="w-12 h-12 border-4 border-shiko-red border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-yamabuki-gold font-serif tracking-widest text-sm">正在載入古戰場狀態...</p>
      </div>
    );
  }

  const isLocalGuest = gameState.player2.id === 'guest';
  const isPlayer1 = room.player1Id === user?.id;
  const isPlayer2 = room.player2Id === user?.id;
  
  // 決定目前瀏覽器使用者是否能夠操作
  const canIControl = isLocalGuest
    ? isPlayer1 // 本機模式下，只有房主 (Player 1) 可以操控
    : (activeActorId === room.player1Id && isPlayer1) || (activeActorId === room.player2Id && isPlayer2);

  // 取得玩家與對手的視角
  // 如果是 Player 2 連線進來，則將 Player 2 顯示在下方，Player 1 顯示在上方
  const isP2View = !isLocalGuest && isPlayer2;
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
  const RenderCard = ({ card, isSelected, onClick, isFlipped = false, showCharge = 0 }: {
    card: Card;
    isSelected?: boolean;
    onClick?: () => void;
    isFlipped?: boolean; // true 代表蓋牌
    showCharge?: number;
  }) => {
    // 遮罩防竊看：如果 value 為 0，則強制當成蓋牌處理
    const isReallyFlipped = isFlipped || card.value === 0;

    if (isReallyFlipped) {
      return (
        <div
          onClick={onClick}
          className={`w-12 h-16 md:w-14 md:h-20 rounded border-2 flex items-center justify-center select-none transition-all duration-200 ${
            onClick ? 'cursor-pointer hover:scale-105' : ''
          } ${
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
        className={`w-12 h-16 md:w-14 md:h-20 washi-card-light rounded border flex flex-col justify-between p-1.5 select-none relative transition-all duration-200 ${
          onClick ? 'cursor-pointer hover:scale-105' : ''
        } ${
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

  // 提交開局配置
  const handleSetupSubmit = async () => {
    if (!setupWall1 || !setupWall2 || !setupWall3 || setupAttackCards.length !== 2) {
      alert('請填滿所有配置格子！防禦牌 3 張（各牆1張），攻擊牌 2 張。');
      return;
    }

    try {
      const defenseCardIds = [setupWall1.id, setupWall2.id, setupWall3.id];
      const attackCardIds = setupAttackCards.map(c => c.id);
      
      await submitAction(code, 'setup', { defenseCardIds, attackCardIds });
      
      // 清空暫存
      setSetupWall1(null);
      setSetupWall2(null);
      setSetupWall3(null);
      setSetupAttackCards([]);
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
  const wallLimits = [20, 30, 40];

  return (
    <div className="flex-1 flex flex-col bg-[#111113] relative overflow-hidden select-none font-sans">
      
      {/* 1. 頂部導覽列 */}
      <header className="border-b border-foreground/10 px-4 py-3 flex items-center justify-between washi-paper">
        <button
          onClick={handleLeaveRoom}
          className="flex items-center space-x-1 text-xs text-foreground/60 hover:text-foreground hover:scale-95 transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>大廳</span>
        </button>
        <div className="text-center">
          <span className="text-[10px] text-foreground/40 font-mono tracking-widest">邀請碼：</span>
          <span className="text-sm font-bold font-serif text-yamabuki-gold tracking-widest">{room.code}</span>
          <span className="ml-2 text-[10px] bg-zinc-800 text-foreground/75 px-1.5 py-0.5 rounded">
            {gameState.player2.id === 'guest' ? '本機對戰' : '線上聯機'}
          </span>
        </div>
        <button
          onClick={() => restartGame(code)}
          className="flex items-center space-x-1 text-xs text-shiko-red hover:text-red-400 hover:scale-95 transition-all border border-shiko-red/20 px-2 py-1 rounded"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>重開一局</span>
        </button>
      </header>

      {/* 2. 遊戲主畫面佈局 */}
      <div className="flex-1 flex flex-col lg:flex-row p-3 md:p-4 gap-4 overflow-hidden h-[calc(100vh-60px)]">
        
        {/* 左側：對戰戰場 (占大比例) */}
        <div className="flex-1 flex flex-col justify-between border border-foreground/10 rounded-xl p-3 bg-zinc-950/40 relative">
          
          {/* A. 對手區域 (上方) */}
          <div className="space-y-3">
            {/* 對手資訊與手牌數 */}
            <div className="flex items-center justify-between pb-2 border-b border-foreground/5">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 rounded-full bg-shiko-red animate-pulse"></div>
                <span className="text-xs font-bold text-foreground/70">{topPlayer.email}</span>
              </div>
              <span className="text-[10px] bg-zinc-900 border border-foreground/5 text-foreground/60 px-2 py-0.5 rounded">
                手牌：{topPlayer.hand.length} 張
              </span>
            </div>

            {/* 對手三層城牆 (顯示順序：Wall 3, Wall 2, Wall 1) */}
            <div className="grid grid-cols-3 gap-2">
              {[2, 1, 0].map(wallIdx => {
                const wall = topPlayer.walls[wallIdx];
                const sum = getWallDefenseValue(wall);
                const limit = wallLimits[wallIdx];
                const isTarget = gameState.turnCount > 1 && 
                                 !wall.breached && 
                                 (topPlayer.walls.findIndex(w => !w.breached) === wallIdx);

                return (
                  <div
                    key={wallIdx}
                    onClick={() => {
                      if (extraActionType !== 'none' && canIControl && !wall.breached) {
                        // 破勢或偵查選擇對方城牆
                        // 這裡不需動作，點擊裡面的卡牌才會觸發
                      }
                    }}
                    className={`washi-paper rounded-lg p-2 transition-all border ${
                      wall.breached
                        ? 'border-dashed border-red-950 bg-red-950/10'
                        : isTarget
                          ? 'border-shiko-red ring-1 ring-shiko-red bg-shiko-red/5'
                          : 'border-foreground/10'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-2">
                      <span className={`text-[10px] font-bold ${wall.breached ? 'text-shiko-red' : 'text-foreground/70'}`}>
                        {wallIdx === 0 ? '首關 (Wall 1)' : wallIdx === 1 ? '次關 (Wall 2)' : '本丸 (Wall 3)'}
                      </span>
                      {wall.breached ? (
                        <span className="text-[9px] bg-red-950 text-shiko-red font-serif px-1 rounded animate-pulse">破</span>
                      ) : (
                        <span className="text-[9px] font-mono text-foreground/50">
                          {sum}/{limit}
                        </span>
                      )}
                    </div>
                    {/* 城牆內的防守牌列表 */}
                    <div className="flex flex-wrap gap-1 min-h-[48px] justify-center items-center">
                      {!wall.breached && wall.cards.map((card, cardIdx) => {
                        const isSelected = selectedOpponentWallIndex === wallIdx && selectedOpponentWallCardIndexes.includes(cardIdx);
                        const isPublic = wall.revealed[cardIdx];
                        
                        return (
                          <RenderCard
                            key={cardIdx}
                            card={card}
                            isFlipped={!isPublic}
                            isSelected={isSelected}
                            onClick={() => {
                              if (canIControl && !wall.breached && extraActionType !== 'none') {
                                if (!isPublic) {
                                  toggleOpponentCardSelection(wallIdx, cardIdx);
                                }
                              }
                            }}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 對手攻擊區 */}
            <div className="washi-paper rounded-lg p-2 flex items-center justify-between border-foreground/5">
              <div className="flex flex-col">
                <span className="text-[10px] text-foreground/40 font-bold uppercase tracking-wider">對手攻擊區</span>
                <span className="text-sm font-black font-serif text-shiko-red">
                  攻勢值：{getAttackValue(topPlayer.attackZone)}
                </span>
              </div>
              <div className="flex space-x-1.5">
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
                  <span className="text-[10px] text-foreground/20 italic self-center py-2">攻擊區空無一物</span>
                )}
              </div>
            </div>
          </div>

          {/* B. 牌堆與資訊中心 (中間) */}
          <div className="my-4 flex items-center justify-between gap-6 py-2 px-3 washi-paper rounded-lg border-foreground/5 bg-zinc-950/20">
            {/* 公共牌堆 */}
            <div className="flex items-center space-x-3">
              <div className="w-12 h-16 rounded border-2 border-dashed border-foreground/20 flex flex-col justify-center items-center shadow-inner relative bg-zinc-900/50">
                <span className="text-[10px] text-foreground/30 font-serif">牌堆</span>
                <span className="text-sm font-bold text-foreground/50">{gameState.drawPile.length}</span>
              </div>
              <div className="flex flex-col leading-tight">
                <span className="text-[10px] text-foreground/40">回合數</span>
                <span className="text-base font-black font-serif text-yamabuki-gold">第 {gameState.turnCount} 回合</span>
              </div>
            </div>

            {/* 回合提示面板 */}
            <div className="text-center flex-1 max-w-xs px-2">
              {gameState.phase === 'setup' ? (
                <div className="bg-yamabuki-gold/10 border border-yamabuki-gold/30 rounded px-2 py-1">
                  <p className="text-[10px] text-yamabuki-gold font-bold tracking-widest">【配置階段】</p>
                  <p className="text-[9px] text-foreground/60 truncate">請設置 3 張防守牌與 2 張攻擊牌</p>
                </div>
              ) : gameState.phase === 'wall_breached_response' ? (
                <div className="bg-shiko-red/20 border border-shiko-red/40 rounded px-2 py-1 animate-pulse">
                  <p className="text-[10px] text-shiko-red font-bold tracking-widest">【緊急防守補牌】</p>
                  <p className="text-[9px] text-foreground/80 truncate">對手正進行防禦增援...</p>
                </div>
              ) : (
                <div className="bg-zinc-900 border border-foreground/5 rounded px-2 py-1.5">
                  <p className="text-[9px] text-foreground/45 tracking-widest">當前操盤手</p>
                  <p className="text-xs font-bold text-foreground truncate">{activeActorName}</p>
                </div>
              )}
            </div>

            {/* 棄牌堆 */}
            <div className="flex items-center space-x-3">
              <div className="flex flex-col leading-tight text-right">
                <span className="text-[10px] text-foreground/40">棄牌堆</span>
                <span className="text-sm font-bold text-foreground/50">{gameState.discardPile.length} 張</span>
              </div>
              <div className="w-12 h-16 rounded border-2 border-dashed border-foreground/20 flex flex-col justify-center items-center shadow-inner relative bg-zinc-900/50">
                <span className="text-[10px] text-foreground/30 font-serif">棄牌</span>
                {gameState.discardPile.length > 0 ? (
                  <div className="absolute inset-0 rounded washi-paper border border-foreground/10 flex items-center justify-center opacity-40">
                    <span className="text-[8px] text-foreground/30 select-none">墓</span>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {/* C. 玩家區域 (下方) */}
          <div className="space-y-3">
            {/* 玩家攻擊區 */}
            <div className="washi-paper rounded-lg p-2 flex items-center justify-between border-foreground/5">
              <div className="flex flex-col">
                <span className="text-[10px] text-foreground/40 font-bold uppercase tracking-wider">己方攻擊區</span>
                <span className="text-sm font-black font-serif text-yamabuki-gold">
                  攻勢值：{getAttackValue(bottomPlayer.attackZone)}
                </span>
              </div>
              <div className="flex space-x-1.5">
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
                            // 提供主要行動中替換攻擊牌的機制
                            if (replaceAttackIds.includes(ac.card.id)) {
                              setReplaceAttackIds(replaceAttackIds.filter(id => id !== ac.card.id));
                            } else {
                              if (replaceAttackIds.length >= 2) {
                                setReplaceAttackIds([replaceAttackIds[1], ac.card.id]);
                              } else {
                                setReplaceAttackIds([...replaceAttackIds, ac.card.id]);
                              }
                            }
                          }
                        }
                      }}
                    />
                  );
                })}
                {bottomPlayer.attackZone.length === 0 && (
                  <span className="text-[10px] text-foreground/20 italic self-center py-2">攻擊區空無一物</span>
                )}
              </div>
            </div>

            {/* 己方三層城牆 (顯示順序：Wall 1, Wall 2, Wall 3) */}
            <div className="grid grid-cols-3 gap-2">
              {[0, 1, 2].map(wallIdx => {
                const wall = bottomPlayer.walls[wallIdx];
                const sum = getWallDefenseValue(wall);
                const limit = wallLimits[wallIdx];
                const isSelected = selectedWallIndex === wallIdx;

                return (
                  <div
                    key={wallIdx}
                    onClick={() => {
                      if (canIControl && !wall.breached) {
                        selectWallIndex(isSelected ? null : wallIdx);
                      }
                    }}
                    className={`washi-paper rounded-lg p-2 transition-all border cursor-pointer ${
                      wall.breached
                        ? 'border-dashed border-red-950 bg-red-950/10 cursor-not-allowed'
                        : isSelected
                          ? 'border-yamabuki-gold ring-1 ring-yamabuki-gold bg-yamabuki-gold/5 scale-[1.01]'
                          : 'border-foreground/10 hover:border-foreground/20'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-2">
                      <span className={`text-[10px] font-bold ${wall.breached ? 'text-shiko-red' : 'text-foreground/70'}`}>
                        {wallIdx === 0 ? '首關 (Wall 1)' : wallIdx === 1 ? '次關 (Wall 2)' : '本丸 (Wall 3)'}
                      </span>
                      {wall.breached ? (
                        <span className="text-[9px] bg-red-950 text-shiko-red font-serif px-1 rounded animate-pulse">破</span>
                      ) : (
                        <span className="text-[9px] font-mono text-foreground/50">
                          {sum}/{limit}
                        </span>
                      )}
                    </div>
                    {/* 城牆內的防守牌列表 */}
                    <div className="flex flex-wrap gap-1 min-h-[48px] justify-center items-center">
                      {!wall.breached && wall.cards.map((card, cardIdx) => {
                        const isPublic = wall.revealed[cardIdx];
                        return (
                          <RenderCard
                            key={cardIdx}
                            card={card}
                            isFlipped={!isPublic}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 己方資訊與手牌 */}
            <div className="flex items-center justify-between pb-1 border-t border-foreground/5 pt-2">
              <span className="text-xs font-bold text-foreground/75">{bottomPlayer.email} 的手牌 (上限 8)</span>
              {replaceAttackIds.length > 0 && (
                <span className="text-[9px] text-yamabuki-gold animate-pulse bg-zinc-900 px-2 py-0.5 rounded">
                  已選中 {replaceAttackIds.length} 張攻擊卡待替換
                </span>
              )}
            </div>

            {/* 手牌展示與選取區 */}
            <div className="flex space-x-2 overflow-x-auto py-2 px-1 min-h-[88px] justify-center bg-zinc-950/20 rounded-lg border border-foreground/5">
              {gameState.phase !== 'setup' && bottomPlayer.hand.map((card, idx) => {
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
              {gameState.phase === 'setup' && (
                <span className="text-xs text-yamabuki-gold/60 italic self-center py-4">開局配置中，請於右側操作面板佈防</span>
              )}
            </div>
          </div>
        </div>

        {/* 右側：操控面板與行動日誌 */}
        <div className="w-full lg:w-80 flex flex-col justify-between gap-4 h-full">
          
          {/* A. 操盤手行動按鈕面板 */}
          <div className="washi-paper rounded-xl p-4 flex flex-col justify-between border-t-2 border-t-yamabuki-gold flex-1 max-h-[55%] overflow-y-auto">
            <h2 className="text-xs font-black font-serif text-yamabuki-gold tracking-widest mb-3 border-b border-foreground/10 pb-1.5 flex items-center justify-between">
              <span>軍機操盤所</span>
              <Sparkles className="w-3.5 h-3.5" />
            </h2>

            {/* 1. 開局部署面板 (僅在 Setup 階段顯示) */}
            {gameState.phase === 'setup' && (
              <div className="space-y-4 flex-1 flex flex-col justify-between">
                {/* 部署棋盤 */}
                <div className="space-y-3">
                  <div className="text-[11px] text-foreground/75 leading-relaxed bg-zinc-900/50 p-2 rounded border border-foreground/5">
                    請從發牌的 9 張初始卡牌中部署防守牌與攻擊牌：
                  </div>
                  
                  {/* 防守卡放置區 */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] text-foreground/50 font-bold uppercase">防守部署 (各1張)</span>
                    <div className="grid grid-cols-3 gap-1">
                      <button
                        onClick={() => {
                          const selected = selectedHandCardIds[0];
                          if (selected) {
                            const card = (isP2View ? gameState.setupState?.player2Draft : gameState.setupState?.player1Draft)?.find(c => c.id === selected);
                            if (card) {
                              setSetupWall1(card);
                              toggleHandCardSelection(selected);
                            }
                          } else if (setupWall1) {
                            setSetupWall1(null);
                          }
                        }}
                        className="bg-zinc-900 border border-foreground/10 hover:border-yamabuki-gold text-[10px] py-2 rounded font-serif text-center truncate px-1 text-foreground/80 h-10 flex items-center justify-center"
                      >
                        {setupWall1 ? `${setupWall1.value}點` : '首關 (Wall1)'}
                      </button>
                      
                      <button
                        onClick={() => {
                          const selected = selectedHandCardIds[0];
                          if (selected) {
                            const card = (isP2View ? gameState.setupState?.player2Draft : gameState.setupState?.player1Draft)?.find(c => c.id === selected);
                            if (card) {
                              setSetupWall2(card);
                              toggleHandCardSelection(selected);
                            }
                          } else if (setupWall2) {
                            setSetupWall2(null);
                          }
                        }}
                        className="bg-zinc-900 border border-foreground/10 hover:border-yamabuki-gold text-[10px] py-2 rounded font-serif text-center truncate px-1 text-foreground/80 h-10 flex items-center justify-center"
                      >
                        {setupWall2 ? `${setupWall2.value}點` : '次關 (Wall2)'}
                      </button>
                      
                      <button
                        onClick={() => {
                          const selected = selectedHandCardIds[0];
                          if (selected) {
                            const card = (isP2View ? gameState.setupState?.player2Draft : gameState.setupState?.player1Draft)?.find(c => c.id === selected);
                            if (card) {
                              setSetupWall3(card);
                              toggleHandCardSelection(selected);
                            }
                          } else if (setupWall3) {
                            setSetupWall3(null);
                          }
                        }}
                        className="bg-zinc-900 border border-foreground/10 hover:border-yamabuki-gold text-[10px] py-2 rounded font-serif text-center truncate px-1 text-foreground/80 h-10 flex items-center justify-center"
                      >
                        {setupWall3 ? `${setupWall3.value}點` : '本丸 (Wall3)'}
                      </button>
                    </div>
                  </div>

                  {/* 攻擊卡放置區 */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-foreground/50 font-bold uppercase">攻擊部署 (滿2張)</span>
                      {setupAttackCards.length > 0 && (
                        <button onClick={() => setSetupAttackCards([])} className="text-[9px] text-shiko-red">清空</button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {[0, 1].map(idx => (
                        <button
                          key={idx}
                          onClick={() => {
                            const selected = selectedHandCardIds[0];
                            if (selected) {
                              const card = (isP2View ? gameState.setupState?.player2Draft : gameState.setupState?.player1Draft)?.find(c => c.id === selected);
                              if (card && setupAttackCards.length < 2 && !setupAttackCards.some(x => x.id === card.id)) {
                                setSetupAttackCards([...setupAttackCards, card]);
                                toggleHandCardSelection(selected);
                              }
                            }
                          }}
                          className="bg-zinc-900 border border-foreground/10 hover:border-yamabuki-gold text-[10px] py-2 rounded font-serif text-center truncate px-1 text-foreground/80 h-10 flex items-center justify-center"
                        >
                          {setupAttackCards[idx] ? `${setupAttackCards[idx].value}點` : `攻擊 Card ${idx+1}`}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 備選卡牌 (即初始 9 張草稿牌) */}
                <div className="space-y-2 pt-2 border-t border-foreground/10">
                  <span className="text-[10px] text-foreground/50 font-bold uppercase">選取待派卡牌：</span>
                  <div className="flex flex-wrap gap-1 justify-center max-h-[100px] overflow-y-auto">
                    {(isP2View ? gameState.setupState?.player2Draft : gameState.setupState?.player1Draft)?.map(card => {
                      const isUsed = setupWall1?.id === card.id || 
                                     setupWall2?.id === card.id || 
                                     setupWall3?.id === card.id || 
                                     setupAttackCards.some(x => x.id === card.id);
                      if (isUsed) return null;
                      
                      const isSelected = selectedHandCardIds.includes(card.id);
                      return (
                        <RenderCard
                          key={card.id}
                          card={card}
                          isSelected={isSelected}
                          onClick={() => toggleHandCardSelection(card.id)}
                        />
                      );
                    })}
                  </div>
                </div>

                <button
                  onClick={handleSetupSubmit}
                  disabled={!canIControl}
                  className="w-full bg-yamabuki-gold hover:bg-yellow-600 text-zinc-950 font-serif font-bold py-2 px-4 rounded text-xs transition-all shadow-lg tracking-wider mt-4"
                >
                  確認卡牌部署，奔赴沙場！
                </button>
              </div>
            )}

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
            {gameState.phase !== 'setup' && gameState.phase !== 'wall_breached_response' && gameState.phase !== 'finished' && (
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
      </div>

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
