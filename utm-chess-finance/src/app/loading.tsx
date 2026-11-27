import React from 'react';

export default function Loading() {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-canvas)] text-[var(--text-primary)] relative">
      {/* Top animated progress bar for instant route transition feedback */}
      <div className="fixed top-0 inset-x-0 z-50 h-0.5 bg-emerald-100 dark:bg-emerald-950 overflow-hidden">
        <div
          className="h-full w-1/3 bg-emerald-500 rounded-r-full"
          style={{ animation: 'clubsyncRouteProgress 1.1s ease-in-out infinite' }}
        />
      </div>
      <style>{`
        @keyframes clubsyncRouteProgress {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(350%); }
        }
      `}</style>

      {/* Neutral top bar placeholder */}
      <header className="h-16 bg-[var(--bg-surface)]/85 backdrop-blur-xl border-b border-slate-200/80 dark:border-white/10 px-4 sm:px-6 flex items-center justify-between">
        <div className="max-w-7xl w-full mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 animate-pulse" />
            <div className="space-y-1.5">
              <div className="w-32 h-4 rounded-md bg-slate-200 dark:bg-slate-800 animate-pulse" />
              <div className="w-20 h-2.5 rounded-md bg-slate-100 dark:bg-slate-800/60 animate-pulse" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:block w-24 h-8 rounded-xl bg-slate-100 dark:bg-slate-800/60 animate-pulse" />
            <div className="w-24 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 animate-pulse" />
          </div>
        </div>
      </header>

      {/* Main layout skeleton */}
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-10 space-y-6 flex-1">
        <div className="rounded-2xl bg-[var(--bg-surface)] border border-slate-200/80 dark:border-white/10 p-6 sm:p-8 shadow-xs space-y-4">
          <div className="w-36 h-6 rounded-full bg-emerald-100/80 dark:bg-emerald-900/40 animate-pulse" />
          <div className="w-2/3 h-8 rounded-xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
          <div className="w-1/2 h-4 rounded-lg bg-slate-100 dark:bg-slate-800/60 animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((idx) => (
            <div
              key={idx}
              className="h-44 rounded-2xl bg-[var(--bg-surface)] border border-slate-200/80 dark:border-white/10 p-5 space-y-3 shadow-xs"
            >
              <div className="w-24 h-5 rounded-full bg-slate-100 dark:bg-slate-800/60 animate-pulse" />
              <div className="w-3/4 h-5 rounded-lg bg-slate-200 dark:bg-slate-800 animate-pulse" />
              <div className="w-full h-3 rounded bg-slate-100 dark:bg-slate-800/60 animate-pulse" />
              <div className="w-1/2 h-3 rounded bg-slate-100 dark:bg-slate-800/60 animate-pulse" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
