'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useGameStore } from '@/store/useGameStore';
import { Sword, Shield, LogOut, Plus, ArrowRight, UserPlus, LogIn, Mail, Lock } from 'lucide-react';

export default function LobbyPage() {
  const router = useRouter();
  const {
    user,
    isLoading,
    error,
    fetchUser,
    login,
    register,
    logout,
    createRoom,
    joinRoom,
    clearUISelections
  } = useGameStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  // 初始化時獲取使用者資訊
  useEffect(() => {
    fetchUser();
    clearUISelections();
  }, [fetchUser, clearUISelections]);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    if (!email || !password) {
      setActionError('請填寫所有欄位');
      return;
    }

    const success = await login(email, password);
    if (success) {
      setActionError(null);
    }
  };

  const handleCreateLocalGame = async () => {
    setActionError(null);
    const code = await createRoom(true); // true = local guest mode
    if (code) {
      router.push(`/room/${code}`);
    }
  };

  const handleCreateOnlineGame = async () => {
    setActionError(null);
    const code = await createRoom(false); // false = online mode
    if (code) {
      router.push(`/room/${code}`);
    }
  };

  const handleJoinGame = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    if (!joinCode) {
      setActionError('請輸入 6 碼房間代碼');
      return;
    }
    const code = await joinRoom(joinCode);
    if (code) {
      router.push(`/room/${code}`);
    }
  };

  return (
    <main className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 relative">
      {/* 頂部日系標題與裝飾 */}
      <div className="text-center mb-8 max-w-lg select-none">
        <div className="inline-flex items-center justify-center space-x-2 text-shiko-red mb-2 animate-pulse">
          <Sword className="w-5 h-5" />
          <span className="font-semibold tracking-widest text-sm">二人對策卡牌戰</span>
          <Shield className="w-5 h-5" />
        </div>
        <h1 className="text-4xl md:text-5xl font-black font-serif tracking-widest text-yamabuki-gold mb-3 drop-shadow-[0_2px_8px_rgba(212,175,55,0.2)]">
          戰國攻城牌
        </h1>
        <p className="text-xs md:text-sm text-foreground/60 tracking-wider">
          —— 兵法蓄力，強攻破防，決勝於方寸城牆 ——
        </p>
      </div>

      {user ? (
        /* 已登入：顯示大廳與房間選擇 */
        <div className="w-full max-w-md washi-paper rounded-xl p-6 md:p-8 shadow-2xl relative border-t-4 border-t-shiko-red">
          <div className="flex items-center justify-between mb-8 pb-4 border-b border-foreground/10">
            <div>
              <p className="text-xs text-foreground/50">當前將領</p>
              <h2 className="text-sm md:text-base font-bold text-foreground/80 truncate max-w-[200px]">
                {user.email}
              </h2>
            </div>
            <button
              onClick={() => logout()}
              className="flex items-center space-x-1 text-xs text-shiko-red hover:text-shiko-red/80 px-2 py-1.5 rounded border border-shiko-red/20 hover:border-shiko-red/50 transition-all"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>解甲 (登出)</span>
            </button>
          </div>

          {error || actionError ? (
            <div className="mb-6 bg-shiko-red/10 border border-shiko-red/30 text-shiko-red text-xs py-2 px-3 rounded text-center">
              {error || actionError}
            </div>
          ) : null}

          <div className="space-y-6">
            {/* 1. 本機熱座對戰 */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-yamabuki-gold tracking-widest uppercase">
                本機單機熱座 (推薦測試)
              </h3>
              <button
                onClick={handleCreateLocalGame}
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-shiko-red to-red-700 hover:from-red-600 hover:to-red-800 text-white font-serif py-3 px-4 rounded-lg shadow-lg hover:shadow-shiko-red/20 transition-all flex items-center justify-center space-x-2 border border-shiko-red/40 hover:scale-[1.01]"
              >
                <Sword className="w-4 h-4" />
                <span className="tracking-widest font-bold">與本機 Guest 對戰 (單機熱座)</span>
              </button>
              <p className="text-[10px] text-foreground/40 text-center leading-relaxed">
                兩人在同一個瀏覽器上輪流操作，系統會自動在回合交替時提供防窺遮罩。
              </p>
            </div>

            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-foreground/10"></div>
              <span className="flex-shrink mx-4 text-[10px] text-foreground/30 tracking-widest uppercase">或</span>
              <div className="flex-grow border-t border-foreground/10"></div>
            </div>

            {/* 2. 線上聯機對戰 */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-yamabuki-gold tracking-widest uppercase">
                線上房間對戰 (雙瀏覽器)
              </h3>
              
              <button
                onClick={handleCreateOnlineGame}
                disabled={isLoading}
                className="w-full bg-zinc-800 hover:bg-zinc-700 text-foreground font-serif py-2.5 px-4 rounded-lg transition-all flex items-center justify-center space-x-2 border border-foreground/10 hover:border-foreground/30"
              >
                <Plus className="w-4 h-4 text-shiko-red" />
                <span className="tracking-wider">創建對戰房間</span>
              </button>

              <form onSubmit={handleJoinGame} className="flex space-x-2">
                <input
                  type="text"
                  placeholder="輸入 6 碼房間代碼"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  className="flex-1 bg-zinc-900 border border-foreground/10 focus:border-yamabuki-gold rounded px-3 py-2 text-sm text-foreground placeholder:text-foreground/30 focus:outline-none transition-all tracking-wider text-center uppercase"
                />
                <button
                  type="submit"
                  disabled={isLoading}
                  className="bg-yamabuki-gold hover:bg-yellow-600 text-zinc-950 font-bold px-4 py-2 rounded text-sm transition-all flex items-center space-x-1"
                >
                  <span>加入</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </form>
              <p className="text-[10px] text-foreground/40 text-center leading-relaxed">
                兩名玩家登入不同帳號，輸入相同的房間代碼，即可跨瀏覽器同步對戰。
              </p>
            </div>
          </div>
        </div>
      ) : (
        /* 未登入：顯示登入表單 */
        <div className="w-full max-w-md washi-paper rounded-xl p-6 md:p-8 shadow-2xl relative border-t-4 border-t-yamabuki-gold">
          <div className="text-center mb-6">
            <h2 className="text-lg font-serif font-bold text-yamabuki-gold tracking-widest flex items-center justify-center space-x-1.5">
              <LogIn className="w-5 h-5 text-shiko-red" />
              <span>將領登入入陣</span>
            </h2>
            <p className="text-[10px] text-foreground/45 mt-1">
              ※ 若帳號不存在，系統將自動為您創立帳號並登入。
            </p>
          </div>

          {(error || actionError) && (
            <div className="mb-6 bg-shiko-red/10 border border-shiko-red/30 text-shiko-red text-xs py-2 px-3 rounded text-center">
              {error || actionError}
            </div>
          )}

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs text-foreground/55 tracking-wider flex items-center space-x-1">
                <Mail className="w-3.5 h-3.5" />
                <span>軍籍電子郵件 (Email)</span>
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
                className="w-full bg-zinc-950 border border-foreground/10 focus:border-yamabuki-gold rounded px-3 py-2 text-sm text-foreground focus:outline-none transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-foreground/55 tracking-wider flex items-center space-x-1">
                <Lock className="w-3.5 h-3.5" />
                <span>軍令密碼 (Password)</span>
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="******"
                className="w-full bg-zinc-950 border border-foreground/10 focus:border-yamabuki-gold rounded px-3 py-2 text-sm text-foreground focus:outline-none transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-shiko-red hover:bg-red-700 text-white font-serif font-bold py-2.5 px-4 rounded transition-all shadow-lg hover:shadow-shiko-red/20 mt-6 tracking-widest flex items-center justify-center space-x-2 border border-shiko-red/30"
            >
              <LogIn className="w-4 h-4" />
              <span>進入大廳 / 登入</span>
            </button>
          </form>
        </div>
      )}
    </main>
  );
}
