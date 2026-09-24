'use client';

import React, { useEffect, useState } from 'react';
import { TasteExplanation } from '../lib/types';
import { fetchRepoTaste } from '../lib/api';

interface ExplainTasteModalProps {
  repoId: string;
  isOpen: boolean;
  onClose: () => void;
}

export const ExplainTasteModal: React.FC<ExplainTasteModalProps> = ({
  repoId,
  isOpen,
  onClose
}) => {
  const [data, setData] = useState<TasteExplanation | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      fetchRepoTaste(repoId)
        .then((res) => {
          setData(res);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [repoId, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div 
        className="bg-[#1a1a1a] border border-[#262626] rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-rise"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-[#262626] bg-[#141414]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#a855f7]/20 border border-[#a855f7]/40 flex items-center justify-center text-[#a855f7]">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2a8 8 0 0 0-8 8c0 3.5 2.5 6.5 6 7.5v2.5a2 2 0 0 0 4 0v-2.5c3.5-1 6-4 6-7.5a8 8 0 0 0-8-8z"/>
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold font-teko text-white tracking-wide m-0">
                Agent Taste Profile — {repoId}
              </h2>
              <span className="text-[11px] text-[#8f8f8f] font-mono">
                {data?.confidence_level || 'Computing Bayesian Prior'}
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
          {loading ? (
            <div className="py-12 text-center text-[#8f8f8f] font-mono text-sm animate-pulse">
              Synthesizing learned taste from historical feedback...
            </div>
          ) : data ? (
            <>
              {/* Headline Badge */}
              <div className="p-4 rounded-xl bg-black border border-[#262626]">
                <div className="text-xs uppercase tracking-wider text-[#a855f7] font-semibold mb-1">
                  Synthesized Consensus
                </div>
                <div className="text-lg font-bold text-white font-urbanist">
                  {data.headline}
                </div>
                <p className="text-sm text-[#8f8f8f] mt-2 leading-relaxed">
                  {data.summary}
                </p>
              </div>

              {/* Priorities & Suppression Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3.5 rounded-xl bg-[#141414] border border-[#262626]">
                  <div className="text-xs uppercase text-[#3dff6b] font-semibold mb-2 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#3dff6b]"></span>
                    Priority Categories
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {data.priorities && data.priorities.length > 0 ? (
                      data.priorities.map((p) => (
                        <span key={p} className="px-2 py-1 rounded bg-[#3dff6b]/10 border border-[#3dff6b]/30 text-[#3dff6b] text-xs font-mono font-medium">
                          {p}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-[#666]">None yet (Equal weighting)</span>
                    )}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-[#141414] border border-[#262626]">
                  <div className="text-xs uppercase text-[#8f8f8f] font-semibold mb-2 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#555]"></span>
                    Noise / Suppressed
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {data.suppressed && data.suppressed.length > 0 ? (
                      data.suppressed.map((s) => (
                        <span key={s} className="px-2 py-1 rounded bg-white/5 border border-[#333] text-[#8f8f8f] text-xs font-mono">
                          {s}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-[#666]">No active suppressions</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Category Breakdown Table */}
              <div>
                <h4 className="text-xs uppercase tracking-wider text-[#8f8f8f] font-semibold mb-2">
                  Category Weight Breakdown
                </h4>
                <div className="rounded-xl border border-[#262626] overflow-hidden">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-[#141414] text-[#8f8f8f] border-b border-[#262626]">
                      <tr>
                        <th className="py-2.5 px-3">Category</th>
                        <th className="py-2.5 px-3">Weight</th>
                        <th className="py-2.5 px-3">Accepts</th>
                        <th className="py-2.5 px-3">Dismissals</th>
                        <th className="py-2.5 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#262626]">
                      {data.category_breakdown?.map((cat) => (
                        <tr key={cat.category} className="hover:bg-white/5 transition-colors">
                          <td className="py-2.5 px-3 capitalize font-sans text-white font-medium">
                            {cat.category}
                          </td>
                          <td className="py-2.5 px-3 text-[#3dff6b] font-bold">
                            {cat.percentage}%
                          </td>
                          <td className="py-2.5 px-3 text-[#8f8f8f]">{cat.accepts}</td>
                          <td className="py-2.5 px-3 text-[#8f8f8f]">{cat.dismisses}</td>
                          <td className="py-2.5 px-3">
                            {cat.is_suppressed ? (
                              <span className="text-[#ef4444] bg-[#ef4444]/10 px-1.5 py-0.5 rounded border border-[#ef4444]/20 text-[10px]">
                                Filtered
                              </span>
                            ) : (
                              <span className="text-[#3dff6b] bg-[#3dff6b]/10 px-1.5 py-0.5 rounded border border-[#3dff6b]/20 text-[10px]">
                                Active
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Recommendations */}
              {data.recommendations && data.recommendations.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs uppercase tracking-wider text-[#8f8f8f] font-semibold">
                    Agent Observations
                  </h4>
                  {data.recommendations.map((rec, i) => (
                    <div key={i} className="text-xs text-[#a0a0a0] flex items-start gap-2 bg-[#141414] p-2.5 rounded-lg border border-[#222]">
                      <span className="text-[#a855f7] font-bold">&bull;</span>
                      <span>{rec}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="text-center text-sm text-[#8f8f8f]">
              Failed to load taste profile.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end px-6 py-3.5 border-t border-[#262626] bg-[#141414]">
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
