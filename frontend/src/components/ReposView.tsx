'use client';

import React, { useState } from 'react';
import { RepoSummary } from '../lib/types';
import { resetRepo } from '../lib/api';

interface ReposViewProps {
  repos: RepoSummary[];
  activeRepoId: string;
  onSelectRepo: (id: string) => void;
  onOpenExplainTasteForRepo: (id: string) => void;
  onRepoReset: () => void;
}

export const ReposView: React.FC<ReposViewProps> = ({
  repos,
  activeRepoId,
  onSelectRepo,
  onOpenExplainTasteForRepo,
  onRepoReset
}) => {
  const [resettingId, setResettingId] = useState<string | null>(null);

  const handleReset = async (repoId: string) => {
    if (!confirm(`Reset ${repoId} to cold-start defaults? This will erase learned weights.`)) return;
    setResettingId(repoId);
    try {
      await resetRepo(repoId);
      onRepoReset();
    } catch (err) {
      console.error("Reset error:", err);
    } finally {
      setResettingId(null);
    }
  };

  return (
    <div className="px-9 py-6 max-w-7xl mx-auto w-full">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-3xl font-bold font-teko text-white tracking-wide m-0">
            Repository Learning Profiles
          </h2>
          <p className="text-xs text-[#8f8f8f] mt-1 font-urbanist">
            Each repository maintains an isolated Bayesian model that evolves independently based on human code review actions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-[#3dff6b] font-mono px-3 py-1 bg-[#1a1a1a] border border-[#262626] rounded-full">
            ● {repos.length} Repositories Calibrated
          </span>
        </div>
      </div>

      {/* Grid of Repository Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {repos.map((repo) => {
          const isActive = repo.id === activeRepoId;
          const isResetting = resettingId === repo.id;

          return (
            <div
              key={repo.id}
              className={`bg-[#1a1a1a] border rounded-2xl p-6 transition-all duration-200 flex flex-col justify-between ${
                isActive
                  ? 'border-[#3dff6b] shadow-[0_0_20px_rgba(61,255,107,0.15)]'
                  : 'border-[#262626] hover:border-[#404040]'
              }`}
            >
              <div>
                {/* Header */}
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="text-2xl font-bold font-teko text-white tracking-wide m-0 flex items-center gap-2">
                      <span>{repo.name}</span>
                      {isActive && (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-[#3dff6b]/20 text-[#3dff6b] border border-[#3dff6b]/30 font-mono uppercase">
                          Active
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-[#8f8f8f] mt-1 line-clamp-2 leading-relaxed">
                      {repo.description || 'Configured with adaptive category weighting.'}
                    </p>
                  </div>
                </div>

                {/* Key Metrics */}
                <div className="grid grid-cols-2 gap-3 my-4 p-3 bg-black/60 rounded-xl border border-[#262626]">
                  <div>
                    <span className="text-[10px] text-[#8f8f8f] uppercase font-mono block">
                      Acceptance Rate
                    </span>
                    <span className="text-2xl font-bold font-teko text-[#3dff6b]">
                      {repo.current_acceptance_rate}%
                    </span>
                    <div className="text-[10px] text-[#8f8f8f] font-mono">
                      {repo.trend_text}
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] text-[#8f8f8f] uppercase font-mono block">
                      Dominant Category
                    </span>
                    <span className="text-2xl font-bold font-teko text-[#a855f7]">
                      {repo.top_category}
                    </span>
                    <div className="text-[10px] text-[#a855f7] font-mono">
                      {repo.top_category_weight}% weight
                    </div>
                  </div>
                </div>

                {/* Category Bars Mini Preview */}
                <div className="space-y-2 mb-5">
                  <div className="text-[11px] text-[#8f8f8f] font-mono uppercase flex justify-between">
                    <span>Category Weights</span>
                    <span>Posterior</span>
                  </div>
                  {repo.weights.map((w) => (
                    <div key={w.category} className="flex items-center gap-2 text-xs">
                      <span className="w-20 text-[#8f8f8f] capitalize text-[11px] truncate">
                        {w.category}
                      </span>
                      <div className="flex-1 h-1.5 bg-[#0f0f0f] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${w.percentage}%`,
                            backgroundColor:
                              w.category === 'security' ? '#a855f7' :
                              w.category === 'complexity' ? '#3dff6b' :
                              w.category === 'style' ? (w.percentage > 50 ? '#3dff6b' : '#555555') :
                              '#888888'
                          }}
                        />
                      </div>
                      <span className="w-7 text-right font-mono text-[11px] text-white">
                        {w.percentage}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="pt-4 border-t border-[#262626] flex items-center justify-between gap-2">
                <button
                  onClick={() => onSelectRepo(repo.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-[#3dff6b] text-black'
                      : 'bg-[#262626] hover:bg-[#333] text-white'
                  }`}
                >
                  {isActive ? 'Current Repo' : 'Select Repo'}
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onOpenExplainTasteForRepo(repo.id)}
                    className="p-1.5 rounded-lg border border-[#a855f7]/30 text-[#a855f7] hover:bg-[#a855f7]/10 text-xs transition-colors"
                    title="Explain taste for this repo"
                  >
                    Taste &rarr;
                  </button>

                  <button
                    onClick={() => handleReset(repo.id)}
                    disabled={isResetting}
                    className="p-1.5 rounded-lg border border-[#262626] text-[#8f8f8f] hover:text-[#ef4444] hover:border-[#ef4444]/40 text-xs transition-colors disabled:opacity-40"
                    title="Reset to Cold Start Defaults"
                  >
                    &#8635;
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
