import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '瑪麗亞的城牆 | 雙人對策卡牌戰',
  description: '瑪麗亞的城牆：基於撲克牌規則的雙人熱座／線上攻城卡牌遊戲。配置防禦城牆、規劃攻擊陣容、蓄力提升威能，最終突破敵方防線！',
  keywords: '瑪麗亞的城牆, 卡牌遊戲, 攻城, Next.js, Zustand, Tailwind, 雙人遊戲, 熱座模式',
};

export default function RootLayout({
  children,
  }: Readonly<{
    children: React.ReactNode;
  }>) {
  return (
    <html
      lang="zh-TW"
      className="h-full overflow-hidden antialiased dark"
      suppressHydrationWarning
    >
      <body className="h-full overflow-hidden flex flex-col font-sans" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
