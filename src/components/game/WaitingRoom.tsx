'use client';

import { useRouter } from 'next/navigation';

interface WaitingRoomProps {
  inviteCode: string;
}

export function WaitingRoom({ inviteCode }: WaitingRoomProps) {
  const router = useRouter();

  return (
    <div className="game-shell items-center justify-center p-6 relative overflow-hidden">
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
          className="w-full btn-primary py-2.5 rounded-full text-sm tracking-wider"
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
