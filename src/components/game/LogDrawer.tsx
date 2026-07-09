'use client';

import { useEffect, useRef } from 'react';

interface LogDrawerProps {
  logs: string[];
  isOpen: boolean;
  onClose: () => void;
}

function logColor(log: string): string {
  if (log.includes('【系統】')) return 'text-sky-400';
  if (log.includes('【行動】')) return 'text-emerald-400';
  if (log.includes('【額外行動】')) return 'text-yellow-200/90';
  if (log.includes('【戰報】')) return 'text-shiko-red font-bold';
  if (log.includes('【補防】')) return 'text-amber-400';
  if (log.includes('【結算】') || log.includes('【重啟】'))
    return 'text-yamabuki-gold font-bold text-xs border border-yamabuki-gold/25 p-1 rounded bg-yellow-500/5 my-1';
  return 'text-foreground/75';
}

export function LogDrawer({ logs, isOpen, onClose }: LogDrawerProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs.length, isOpen]);

  return (
    <>
      <div
        className={`log-drawer-backdrop ${isOpen ? 'log-drawer-backdrop--open' : ''}`}
        onClick={onClose}
        aria-hidden={!isOpen}
      />
      <div
        className={`log-drawer ${isOpen ? 'log-drawer--open' : ''}`}
        aria-hidden={!isOpen}
      >
        <div className="log-drawer__handle relative" onClick={onClose}>
          <span className="text-[10px] font-black font-serif text-yamabuki-gold tracking-widest">
            軍務日誌
          </span>
          <span className="font-mono text-[9px] text-foreground/30">
            {logs.length} 筆
          </span>
        </div>
        <div className="log-drawer__body space-y-1 font-mono text-[10px] leading-relaxed select-text">
          {logs.map((log, i) => (
            <div
              key={i}
              className={`${logColor(log)} px-1 rounded hover:bg-zinc-800/30 transition-colors`}
            >
              {log}
            </div>
          ))}
          <div ref={endRef} />
        </div>
      </div>
    </>
  );
}
