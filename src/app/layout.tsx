import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '戰國攻城牌 | 二人和風對策卡牌戰原型',
  description: '一款基於撲克牌規則設計的雙人熱座 (Hot-seat) 和風攻城卡牌遊戲。玩家需要合理配置防禦城牆、規劃攻擊陣容、蓄力提升威能，最終突破敵方防線！',
  keywords: '攻城牌, 卡牌遊戲, 和風遊戲, Next.js, Zustand, Tailwind, 雙人遊戲, 熱座模式',
};

export default function RootLayout({
  children,
  }: Readonly<{
    children: React.ReactNode;
  }>) {
  return (
    <html lang="zh-TW" className="h-full antialiased dark">
      <body className="min-h-full flex flex-col font-sans">
        {children}
      </body>
    </html>
  );
}
