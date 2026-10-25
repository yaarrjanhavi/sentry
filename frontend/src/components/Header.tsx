'use client';

import React from 'react';

interface HeaderProps {
  currentTab: 'dashboard' | 'review' | 'benchmark' | 'repos' | 'settings';
  setCurrentTab: (tab: 'dashboard' | 'review' | 'benchmark' | 'repos' | 'settings') => void;
  activeRepoId: string;
  onOpenExplainTaste: () => void;
  onOpenGitHubModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  setCurrentTab,
  activeRepoId,
  onOpenExplainTaste,
  onOpenGitHubModal
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
        {(['dashboard', 'review', 'benchmark', 'repos', 'settings'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setCurrentTab(tab)}
            className={`capitalize text-sm ml-6 transition-colors duration-200 cursor-pointer ${
              currentTab === tab ? 'text-white font-medium border-b border-[#3dff6b] pb-0.5' : 'text-[#8f8f8f] hover:text-white'
            }`}
          >
            {tab === 'benchmark' ? 'Benchmark Proof' : tab}
          </button>
        ))}

        {onOpenGitHubModal && (
          <button
            onClick={onOpenGitHubModal}
            className="ml-6 hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#262626] bg-[#141414] text-white hover:border-[#3dff6b]/50 hover:bg-[#3dff6b]/10 transition-all text-xs font-semibold"
            title="Configure GitHub webhook & simulate inline review loop"
          >
            <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
            </svg>
            <span>GitHub Sync</span>
            <span className="w-1.5 h-1.5 rounded-full bg-[#3dff6b] animate-pulse" />
          </button>
        )}

        <button
          onClick={onOpenExplainTaste}
          className="ml-3 hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#a855f7]/40 text-[#a855f7] hover:bg-[#a855f7]/10 transition-all text-xs font-semibold"
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
