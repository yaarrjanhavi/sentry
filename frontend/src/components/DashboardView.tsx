'use client';

import React, { useState } from 'react';
import { RepoDetail, RepoSummary, FlagItem } from '../lib/types';
import { AcceptanceChart } from './AcceptanceChart';
import { CategoryWeightBars } from './CategoryWeightBars';
import { submitFlagAction } from '../lib/api';

interface DashboardViewProps {
  repoDetail: RepoDetail | null;
  repos: RepoSummary[];
  activeRepoId: string;
  onSelectRepo: (id: string) => void;
  onOpenExplainTaste: () => void;
  onQueueUpdated: () => void;
  onNavigateToReview: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  repoDetail,
  repos,
  activeRepoId,
  onSelectRepo,
  onOpenExplainTaste,
  onQueueUpdated,
  onNavigateToReview
}) => {
  const [animatingFlagId, setAnimatingFlagId] = useState<string | null>(null);
  const [animationType, setAnimationType] = useState<'accept' | 'dismiss' | null>(null);
  const [feedbackToast, setFeedbackToast] = useState<{ message: string; type: string } | null>(null);

  const handleAction = async (flag: FlagItem, action: 'accept' | 'dismiss' | 'not_relevant') => {
    setAnimatingFlagId(flag.id);
    setAnimationType(action === 'accept' ? 'accept' : 'dismiss');

    try {
      const res = await submitFlagAction(flag.id, action);
      
      const actionText = action === 'accept' ? 'Accepted' : (action === 'dismiss' ? 'Dismissed' : 'Marked Not Relevant');
      const arrow = action === 'accept' ? '↑' : '↓';
      setFeedbackToast({
        message: `${actionText}: ${flag.category} weight adjusted to ${res.updated_percentage}% (${arrow})`,
        type: action === 'accept' ? 'primary' : 'muted'
      });

      setTimeout(() => {
        setFeedbackToast(null);
      }, 4000);

      // Allow micro-animation (250ms) to complete before refreshing state
      setTimeout(() => {
        setAnimatingFlagId(null);
        setAnimationType(null);
        onQueueUpdated();
      }, 260);

    } catch (err) {
      console.error("Action error:", err);
      setAnimatingFlagId(null);
      setAnimationType(null);
    }
  };

  const currentRate = repoDetail?.current_acceptance_rate ?? 78;
  const trendText = repoDetail?.trend_text ?? '↑ 34% since round 1';
  const flagsThisWeek = repoDetail?.flags_this_week ?? 142;
  const topCategory = repoDetail?.top_category ?? 'Security';
  const topWeight = repoDetail?.top_category_weight ?? 88;
  const totalReposCount = repos.length || 3;
  const queue = repoDetail?.queue || [];

  return (
    <div className="w-full">
      {/* Toast Notification */}
      {feedbackToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 bg-[#1a1a1a] border border-[#3dff6b] rounded-xl shadow-2xl text-xs font-mono text-white animate-rise">
          <span className="w-2 h-2 rounded-full bg-[#3dff6b] animate-ping" />
          <span>{feedbackToast.message}</span>
        </div>
      )}

      {/* Repo Switcher Header Bar */}
      <div className="px-9 pt-6 pb-2 flex flex-wrap justify-between items-center gap-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <span className="text-xs text-[#8f8f8f] mr-2 uppercase tracking-wider font-semibold">
            Repositories:
          </span>
          {repos.map((r) => {
            const isActive = r.id === activeRepoId;
            return (
              <button
                key={r.id}
                onClick={() => onSelectRepo(r.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 border flex items-center gap-2 ${
                  isActive
                    ? 'bg-[#1a1a1a] border-[#3dff6b] text-white shadow-[0_0_12px_rgba(61,255,107,0.2)]'
                    : 'bg-transparent border-[#262626] text-[#8f8f8f] hover:text-white hover:border-[#404040]'
                }`}
              >
                <span 
                  className={`w-1.5 h-1.5 rounded-full ${
                    isActive ? 'bg-[#3dff6b]' : 'bg-[#555]'
                  }`} 
                />
                <span>{r.name}</span>
                <span className="text-[10px] font-mono text-[#666]">
                  {r.current_acceptance_rate}%
                </span>
              </button>
            );
          })}
        </div>

        <button
          onClick={onNavigateToReview}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#3dff6b] hover:bg-[#32e05d] text-black font-semibold text-xs tracking-wide transition-all shadow-[0_0_16px_rgba(61,255,107,0.25)]"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          Review Code Diff
        </button>
      </div>

      {/* Hero Section: 4 Stat Cards directly from design.html */}
      <div className="hero px-9 pt-6 pb-2">
        <div className="stat-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="stat-card bg-[#1a1a1a] border border-[#262626] rounded-2xl p-5 hover:border-[#3dff6b]/40 transition-colors">
            <div className="stat-label text-xs text-[#8f8f8f] uppercase tracking-wider">
              Acceptance rate
            </div>
            <div className="big-stat text-[46px] leading-none mt-1.5 font-teko text-[#3dff6b]">
              {currentRate}%
            </div>
            <div className="trend text-xs text-[#3dff6b] mt-1 font-mono">
              {trendText}
            </div>
          </div>

          <div className="stat-card bg-[#1a1a1a] border border-[#262626] rounded-2xl p-5 hover:border-[#333] transition-colors">
            <div className="stat-label text-xs text-[#8f8f8f] uppercase tracking-wider">
              Flags this week
            </div>
            <div className="big-stat text-[46px] leading-none mt-1.5 font-teko text-white">
              {flagsThisWeek}
            </div>
            <div className="trend text-xs text-[#8f8f8f] mt-1 font-mono">
              across 9 PRs
            </div>
          </div>

          <div className="stat-card bg-[#1a1a1a] border border-[#262626] rounded-2xl p-5 hover:border-[#a855f7]/40 transition-colors">
            <div className="stat-label text-xs text-[#8f8f8f] uppercase tracking-wider">
              Top category
            </div>
            <div className="big-stat text-[46px] leading-none mt-1.5 font-teko text-[#a855f7]">
              {topCategory}
            </div>
            <div className="trend text-xs text-[#a855f7] mt-1 font-mono">
              {topWeight}% weight
            </div>
          </div>

          <div className="stat-card bg-[#1a1a1a] border border-[#262626] rounded-2xl p-5 hover:border-[#333] transition-colors">
            <div className="stat-label text-xs text-[#8f8f8f] uppercase tracking-wider">
              Repos learning
            </div>
            <div className="big-stat text-[46px] leading-none mt-1.5 font-teko text-white">
              {totalReposCount}
            </div>
            <div className="trend text-xs text-[#8f8f8f] mt-1 font-mono">
              independent profiles
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: 1.4fr 1fr matching design.html */}
      <div className="main grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-5 px-9 py-7 pb-12">
        {/* Left Card: Chart + Review Queue */}
        <div className="card bg-[#1a1a1a] border border-[#262626] rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <AcceptanceChart 
              history={repoDetail?.history || []} 
              repoName={repoDetail?.name || activeRepoId} 
            />

            <div className="flex justify-between items-center mt-7 mb-3">
              <h3 className="text-[22px] font-semibold tracking-wide text-white m-0 font-teko">
                Review queue
              </h3>
              <span className="text-xs font-mono text-[#8f8f8f]">
                {queue.length} items awaiting review
              </span>
            </div>

            <div className="divide-y divide-[#262626] border-t border-[#262626]">
              {queue.length > 0 ? (
                queue.map((flag) => {
                  const isCurrent = animatingFlagId === flag.id;
                  let animClass = '';
                  if (isCurrent && animationType === 'accept') {
                    animClass = 'scale-[1.02] border-l-4 border-l-[#3dff6b] bg-[#3dff6b]/10 transition-all duration-200';
                  } else if (isCurrent && animationType === 'dismiss') {
                    animClass = 'opacity-0 scale-95 transition-all duration-200';
                  }

                  const dotColor = 
                    flag.category === 'security' ? 'bg-[#a855f7]' :
                    flag.category === 'complexity' ? 'bg-[#3dff6b]' :
                    flag.category === 'best-practice' ? 'bg-[#c084fc]' :
                    flag.category === 'duplication' ? 'bg-[#888888]' : 'bg-[#666666]';

                  return (
                    <div
                      key={flag.id}
                      className={`queue-item flex justify-between items-center py-3.5 transition-all duration-200 ${animClass}`}
                    >
                      <div className="qi-left flex items-center gap-3 min-w-0 pr-4">
                        <span className={`qi-dot w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
                        <div className="truncate">
                          <div className="qi-text text-sm text-white font-medium truncate flex items-center gap-2">
                            <span>{flag.title}</span>
                            {flag.severity === 'critical' && (
                              <span className="text-[10px] text-[#ef4444] bg-[#ef4444]/15 px-1.5 py-0.5 rounded border border-[#ef4444]/30 uppercase font-mono">
                                Critical
                              </span>
                            )}
                          </div>
                          <div className="qi-file text-xs text-[#8f8f8f] font-mono mt-0.5">
                            {flag.file_path} · line {flag.line_number}
                          </div>
                        </div>
                      </div>

                      <div className="qi-actions flex items-center shrink-0">
                        <button
                          onClick={() => handleAction(flag, 'accept')}
                          className="accept hover:bg-[#3dff6b] hover:text-black hover:border-[#3dff6b] border border-[#262626] text-[#8f8f8f] rounded-[7px] px-2.5 py-1 text-xs cursor-pointer transition-all duration-200 font-medium"
                          title="Accept issue: Increases category weight"
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => handleAction(flag, 'dismiss')}
                          className="dismiss hover:bg-white/10 border border-[#262626] text-[#8f8f8f] rounded-[7px] px-2.5 py-1 text-xs ml-1.5 cursor-pointer transition-all duration-200"
                          title="Dismiss issue: Reduces category weight"
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-8 text-center">
                  <p className="text-sm text-[#8f8f8f] font-urbanist">
                    No pending flags in queue for {activeRepoId}.
                  </p>
                  <button
                    onClick={onNavigateToReview}
                    className="mt-2 text-xs text-[#3dff6b] hover:underline font-mono"
                  >
                    Paste a diff to run new review &rarr;
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#262626] flex justify-between items-center text-xs text-[#8f8f8f]">
            <span>Feedback feeds directly into Bayesian category weights.</span>
            <span className="font-mono text-[#3dff6b]">Real-time loop active</span>
          </div>
        </div>

        {/* Right Card: Category Weights */}
        <div className="h-full">
          <CategoryWeightBars
            weights={repoDetail?.weights || []}
            onOpenExplainTaste={onOpenExplainTaste}
          />
        </div>
      </div>
    </div>
  );
};
