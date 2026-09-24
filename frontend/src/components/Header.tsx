'use client';

import React from 'react';

interface HeaderProps {
  currentTab: 'dashboard' | 'review' | 'repos' | 'settings';
  setCurrentTab: (tab: 'dashboard' | 'review' | 'repos' | 'settings') => void;
  activeRepoId: string;
  onOpenExplainTaste: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  setCurrentTab,
  activeRepoId,
  onOpenExplainTaste
}) => {
  return (
    <header className="flex justify-between items-center px-9 py-5 border-b border-[#262626] bg-black sticky top-0 z-40 backdrop-blur-md bg-opacity-95">
      <div className="flex items-center gap-6">
        <div 
          className="brand text-3xl cursor-pointer select-none tracking-tight font-teko"
          onClick={() => setCurrentTab('dashboard')}
        >
          Sentry<span className="text-[#3dff6b]">.</span>
        </div>
        <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-[#1a1a1a] border border-[#262626] rounded-full text-xs text-[#8f8f8f]">
          <span className="w-2 h-2 rounded-full bg-[#3dff6b] animate-pulse"></span>
          <span>Repo: <strong className="text-white font-medium">{activeRepoId}</strong></span>
        </div>
      </div>

      <nav className="flex items-center">
        {(['dashboard', 'review', 'repos', 'settings'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setCurrentTab(tab)}
            className={`capitalize text-sm ml-6 transition-colors duration-200 cursor-pointer ${
              currentTab === tab ? 'text-white font-medium border-b border-[#3dff6b] pb-0.5' : 'text-[#8f8f8f] hover:text-white'
            }`}
          >
            {tab}
          </button>
        ))}

        <button
          onClick={onOpenExplainTaste}
          className="ml-6 hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#a855f7]/40 text-[#a855f7] hover:bg-[#a855f7]/10 transition-all text-xs font-semibold"
          title="Ask the agent what it has learned about this repository"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2a8 8 0 0 0-8 8c0 3.5 2.5 6.5 6 7.5v2.5a2 2 0 0 0 4 0v-2.5c3.5-1 6-4 6-7.5a8 8 0 0 0-8-8z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          Explain Taste
        </button>
      </nav>
    </header>
  );
};
