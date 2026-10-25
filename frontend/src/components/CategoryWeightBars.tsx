'use client';

import React from 'react';
import { CategoryWeight } from '../lib/types';

interface CategoryWeightBarsProps {
  weights: CategoryWeight[];
  summaryText?: string;
  onOpenExplainTaste?: () => void;
}

export const CategoryWeightBars: React.FC<CategoryWeightBarsProps> = ({
  weights,
  summaryText,
  onOpenExplainTaste
}) => {
  // Sort descending by weight
  const sorted = [...(weights || [])].sort((a, b) => b.weight - a.weight);

  const getBarColor = (category: string) => {
    switch (category.toLowerCase()) {
      case 'security':
        return '#a855f7'; // Purple accent
      case 'complexity':
        return '#3dff6b'; // Green primary
      case 'best-practice':
        return '#c084fc'; // Light purple
      case 'duplication':
        return '#888888'; // Mid gray
      case 'style':
        return '#555555'; // Darker gray
      default:
        return '#888888';
    }
  };

  return (
    <div className="card bg-[#1a1a1a] border border-[#262626] rounded-2xl p-6 h-full flex flex-col justify-between">
      <div>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-[22px] font-semibold tracking-wide text-white m-0 font-teko">
            Category weights
          </h3>
          <span className="text-[11px] font-mono text-[#8f8f8f] uppercase tracking-wider">
            Bayesian Posterior
          </span>
        </div>

        <div className="space-y-3.5 my-3">
          {sorted.map((item) => {
            const color = getBarColor(item.category);
            const isSuppressed = item.weight < 0.28;

            return (
              <div key={item.category} className="group">
                <div className="flex items-center gap-3 text-xs mb-1">
                  <div className="w-24 text-[#8f8f8f] capitalize font-medium flex items-center justify-between">
                    <span className="truncate">{item.category}</span>
                    <div className="flex items-center gap-1">
                      {item.is_cold_start && (
                        <span className="text-[8px] text-[#f59e0b] px-1 py-0.2 bg-[#f59e0b]/15 rounded border border-[#f59e0b]/30 uppercase font-mono" title="Cold start prior: fewer than 5 feedback reviews recorded">
                          Cold
                        </span>
                      )}
                      {isSuppressed && (
                        <span className="text-[9px] text-[#ef4444] px-1 py-0.2 bg-[#ef4444]/10 rounded border border-[#ef4444]/20" title="Low weight: Non-critical flags are suppressed">
                          Low
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex-1 h-[9px] bg-[#0f0f0f] rounded-md overflow-hidden relative border border-[#1f1f1f]">
                    {/* 90% Credible Interval Uncertainty Range */}
                    {item.ci_percentage_lower !== undefined && item.ci_percentage_upper !== undefined && (
                      <div
                        className="absolute top-0 bottom-0 opacity-25 rounded"
                        style={{
                          left: `${item.ci_percentage_lower}%`,
                          width: `${Math.max(3, item.ci_percentage_upper - item.ci_percentage_lower)}%`,
                          backgroundColor: color
                        }}
                        title={`90% Credible Interval: [${item.ci_percentage_lower}% - ${item.ci_percentage_upper}%]`}
                      />
                    )}
                    <div
                      className="h-full rounded-md transition-all duration-300 ease-out"
                      style={{
                        width: `${item.percentage}%`,
                        backgroundColor: color,
                        boxShadow: item.percentage > 70 ? `0 0 10px ${color}40` : 'none',
                        animation: 'grow 1s ease-out forwards'
                      }}
                    />
                  </div>

                  <span className="w-8 text-right font-mono font-bold text-white text-xs">
                    {item.percentage}%
                  </span>
                </div>

                {/* Subtext info on hover with 90% CI */}
                <div className="text-[10px] text-[#666] font-mono pl-28 flex justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="flex gap-3">
                    <span>Accepts: {item.accept_count}</span>
                    <span>Dismissals: {item.dismiss_count + item.not_relevant_count}</span>
                  </div>
                  {item.ci_percentage_lower !== undefined && item.ci_percentage_upper !== undefined && (
                    <span className="text-[#888]">
                      90% CI: [{item.ci_percentage_lower}% - {item.ci_percentage_upper}%]
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="pt-4 border-t border-[#262626] mt-4">
        <p className="text-[13px] text-[#8f8f8f] leading-relaxed m-0">
          {summaryText ? (
            <span dangerouslySetInnerHTML={{ __html: summaryText }} />
          ) : (
            <>
              This repo has learned to prioritize{' '}
              <span className="text-[#a855f7] font-medium">security</span> and{' '}
              <span className="text-[#3dff6b] font-medium">complexity</span> issues — style nits are surfaced rarely.
            </>
          )}
        </p>

        {onOpenExplainTaste && (
          <button
            onClick={onOpenExplainTaste}
            className="mt-3 text-xs text-[#a855f7] hover:text-white flex items-center gap-1 font-medium transition-colors"
          >
            <span>Ask agent: &ldquo;Explain my taste&rdquo;</span>
            <span>&rarr;</span>
          </button>
        )}
      </div>
    </div>
  );
};
