import React from 'react';

export default function Loading() {
  return (
    <div className="min-h-screen flex flex-col bg-[#f4fbf7] text-slate-800 relative">
      {/* Top animated progress bar for instant route transition feedback */}
      <div className="fixed top-0 inset-x-0 z-50 h-1 bg-emerald-100 overflow-hidden">
        <div
          className="h-full w-1/3 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600 rounded-r-full"
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
      <header className="h-16 bg-white/85 backdrop-blur-xl border-b border-slate-200/80 px-4 sm:px-6 flex items-center justify-between">
        <div className="max-w-7xl w-full mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 animate-pulse" />
            <div className="space-y-1.5">
              <div className="w-32 h-4 rounded-md bg-slate-200 animate-pulse" />
              <div className="w-20 h-2.5 rounded-md bg-slate-100 animate-pulse" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:block w-24 h-8 rounded-xl bg-slate-100 animate-pulse" />
            <div className="w-24 h-9 rounded-xl bg-emerald-100 animate-pulse" />
          </div>
        </div>
      </header>

      {/* Main layout skeleton */}
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-10 space-y-6 flex-1">
        <div className="rounded-3xl bg-white border border-slate-200/80 p-6 sm:p-8 shadow-xs space-y-4">
          <div className="w-36 h-6 rounded-full bg-emerald-100/80 animate-pulse" />
          <div className="w-2/3 h-8 rounded-xl bg-slate-200 animate-pulse" />
          <div className="w-1/2 h-4 rounded-lg bg-slate-100 animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((idx) => (
            <div
              key={idx}
              className="h-44 rounded-3xl bg-white border border-slate-200/80 p-5 space-y-3 shadow-xs"
            >
              <div className="w-24 h-5 rounded-full bg-slate-100 animate-pulse" />
              <div className="w-3/4 h-5 rounded-lg bg-slate-200 animate-pulse" />
              <div className="w-full h-3 rounded bg-slate-100 animate-pulse" />
              <div className="w-1/2 h-3 rounded bg-slate-100 animate-pulse" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
