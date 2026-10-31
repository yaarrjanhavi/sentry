'use client';

import React, { useEffect, useState } from 'react';
import { RepoSummary, RepoCompareResponse } from '../lib/types';
import { compareRepositories } from '../lib/api';

interface RepoCompareModalProps {
  repos: RepoSummary[];
  initialSourceId: string;
  isOpen: boolean;
  onClose: () => void;
  onSelectRepo: (id: string) => void;
}

export const RepoCompareModal: React.FC<RepoCompareModalProps> = ({
  repos,
  initialSourceId,
  isOpen,
  onClose,
  onSelectRepo
}) => {
  const [sourceId, setSourceId] = useState<string>(initialSourceId);
  const [targetId, setTargetId] = useState<string>(
    repos.find(r => r.id !== initialSourceId)?.id || (initialSourceId === 'api-gateway' ? 'design-system' : 'api-gateway')
  );
  const [compareData, setCompareData] = useState<RepoCompareResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (isOpen && sourceId && targetId) {
      setLoading(true);
      compareRepositories(sourceId, targetId)
        .then(res => {
          setCompareData(res);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [isOpen, sourceId, targetId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fadeIn">
      <div 
        className="bg-[#1a1a1a] border border-[#262626] rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl animate-rise"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-[#262626] bg-[#141414]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#3dff6b]/15 border border-[#3dff6b]/40 flex items-center justify-center text-[#3dff6b]">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold font-teko text-white tracking-wide m-0">
                Repository Taste Comparison
              </h2>
              <span className="text-[11px] text-[#8f8f8f] font-mono">
                Inspect how Bayesian learning converges to different standards across repositories
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#8f8f8f] hover:text-white text-xl p-1 leading-none"
          >
            &times;
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[75vh] overflow-y-auto space-y-5">
          {/* Repository Selector Dropdowns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-black p-4 rounded-xl border border-[#262626]">
            <div>
              <label className="text-[11px] font-mono text-[#8f8f8f] uppercase block mb-1.5">
                Repository A (Source)
              </label>
              <select
                value={sourceId}
                onChange={(e) => setSourceId(e.target.value)}
                className="w-full bg-[#141414] border border-[#262626] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#3dff6b]"
              >
                {repos.map(r => (
                  <option key={r.id} value={r.id} disabled={r.id === targetId}>
                    {r.name} ({r.current_acceptance_rate}% match)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-mono text-[#8f8f8f] uppercase block mb-1.5">
                Repository B (Target)
              </label>
              <select
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                className="w-full bg-[#141414] border border-[#262626] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#a855f7]"
              >
                {repos.map(r => (
                  <option key={r.id} value={r.id} disabled={r.id === sourceId}>
                    {r.name} ({r.current_acceptance_rate}% match)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="py-12 text-center text-[#8f8f8f] font-mono text-xs animate-pulse">
              Computing Bayesian divergence and vector differences...
            </div>
          ) : compareData ? (
            <>
              {/* Divergence Score Banner */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-black via-[#141414] to-black border border-[#262626] flex items-center justify-between gap-4">
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-[#a855f7] font-semibold font-mono">
                    Taste Divergence Score
                  </div>
                  <div className="text-2xl font-bold font-teko text-white mt-0.5">
                    {compareData.divergence_score}% Divergence
                  </div>
                  <p className="text-xs text-[#8f8f8f] mt-1">
                    Normalized distance between learned category distributions.
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-mono px-3 py-1.5 rounded-lg border border-[#3dff6b]/30 bg-[#3dff6b]/10 text-[#3dff6b] font-medium">
                    {compareData.divergence_score > 50 ? 'Distinct Profiles' : 'Aligned Baseline'}
                  </span>
                </div>
              </div>

              {/* Key Differences List */}
              <div className="space-y-2">
                <div className="text-xs font-mono uppercase text-[#8f8f8f] tracking-wider font-semibold">
                  Key Qualitative Divergences
                </div>
                <div className="space-y-1.5">
                  {compareData.key_differences.map((diff, i) => (
                    <div key={i} className="text-xs text-[#a0a0a0] flex items-start gap-2 bg-[#141414] p-2.5 rounded-lg border border-[#222]">
                      <span className="text-[#3dff6b] font-bold">&bull;</span>
                      <span>{diff}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Category-by-Category Comparison Table */}
              <div>
                <div className="text-xs font-mono uppercase text-[#8f8f8f] tracking-wider font-semibold mb-2">
                  Category Weights Comparison
                </div>
                <div className="rounded-xl border border-[#262626] overflow-hidden">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-[#141414] text-[#8f8f8f] border-b border-[#262626]">
                      <tr>
                        <th className="py-2.5 px-3">Category</th>
                        <th className="py-2.5 px-3 text-[#3dff6b]">{compareData.source_repo_name}</th>
                        <th className="py-2.5 px-3 text-[#a855f7]">{compareData.target_repo_name}</th>
                        <th className="py-2.5 px-3">Delta</th>
                        <th className="py-2.5 px-3">Favored By</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#262626]">
                      {compareData.categories.map((c) => (
                        <tr key={c.category} className="hover:bg-white/5 transition-colors">
                          <td className="py-2.5 px-3 text-white font-medium">{c.category}</td>
                          <td className="py-2.5 px-3">
                            <span className="text-[#3dff6b] font-bold">{c.source_percentage}%</span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="text-[#a855f7] font-bold">{c.target_percentage}%</span>
                          </td>
                          <td className="py-2.5 px-3 text-[#8f8f8f]">
                            ±{c.difference}%
                          </td>
                          <td className="py-2.5 px-3">
                            <span className={`text-[10px] px-2 py-0.5 rounded font-mono ${
                              c.favored_by === compareData.source_repo_name 
                                ? 'bg-[#3dff6b]/15 text-[#3dff6b] border border-[#3dff6b]/30'
                                : (c.favored_by === compareData.target_repo_name 
                                    ? 'bg-[#a855f7]/15 text-[#a855f7] border border-[#a855f7]/30'
                                    : 'bg-white/5 text-[#888]')
                            }`}>
                              {c.favored_by}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center text-xs text-[#8f8f8f] py-8">
              Unable to compute comparison.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center px-6 py-3.5 border-t border-[#262626] bg-[#141414]">
          <div className="text-[11px] font-mono text-[#666]">
            Weights updated dynamically on human Accept / Dismiss feedback
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#262626] hover:bg-[#333] text-white text-xs font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
