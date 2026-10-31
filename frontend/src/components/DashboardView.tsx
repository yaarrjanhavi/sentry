'use client';

import React, { useState } from 'react';
import { RepoDetail, RepoSummary, FlagItem, ReviewerProfile } from '../lib/types';
import { AcceptanceChart } from './AcceptanceChart';
import { CategoryWeightBars } from './CategoryWeightBars';
import { SuggestedFixDiff } from './SuggestedFixDiff';
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
  const [selectedReviewerId, setSelectedReviewerId] = useState<string | null>(null);
  const [showDemotedGroup, setShowDemotedGroup] = useState<boolean>(false);
  const [expandedFixId, setExpandedFixId] = useState<string | null>(null);

  const reviewers = repoDetail?.reviewers || [];
  const activeReviewer: ReviewerProfile | null = 
    selectedReviewerId ? (reviewers.find(r => r.id === selectedReviewerId) || null) : null;

  const handleAction = async (flag: FlagItem, action: 'accept' | 'dismiss' | 'not_relevant') => {
    setAnimatingFlagId(flag.id);
    setAnimationType(action === 'accept' ? 'accept' : 'dismiss');

    try {
      const res = await submitFlagAction(flag.id, action, selectedReviewerId || undefined);
      
      const actionText = action === 'accept' ? 'Accepted' : (action === 'dismiss' ? 'Dismissed' : 'Marked Not Relevant');
      const arrow = action === 'accept' ? '↑' : '↓';
      const reviewerNote = res.reviewer_profile ? ` (${res.reviewer_profile.name} model tuned)` : '';

      setFeedbackToast({
        message: `${actionText}: ${flag.category} weight adjusted to ${res.updated_percentage}% (${arrow})${reviewerNote}`,
        type: action === 'accept' ? 'primary' : 'muted'
      });

      setTimeout(() => {
        setFeedbackToast(null);
      }, 4000);

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

  // Metrics: use active reviewer profile if selected, else repo aggregate
  const currentRate = activeReviewer 
    ? activeReviewer.current_acceptance_rate 
    : (repoDetail?.current_acceptance_rate ?? 78);

  const trendText = activeReviewer
    ? `${activeReviewer.total_reviews_count} feedback events recorded`
    : (repoDetail?.trend_text ?? '↑ 34% since round 1');

  const flagsThisWeek = repoDetail?.flags_this_week ?? 142;

  const topCategory = activeReviewer
    ? activeReviewer.top_category
    : (repoDetail?.top_category ?? 'Security');

  const topWeight = activeReviewer
    ? activeReviewer.top_category_weight
    : (repoDetail?.top_category_weight ?? 88);

  const totalReposCount = repos.length || 3;
  const queue = repoDetail?.queue || [];

  // Phase 2 Severity-Aware Suppression: separate active queue from demoted group
  const activeQueue = queue.filter(f => !f.demoted);
  const demotedQueue = queue.filter(f => f.demoted);

  const displayedWeights = activeReviewer 
    ? activeReviewer.weights 
    : (repoDetail?.weights || []);

  const summaryText = activeReviewer
    ? activeReviewer.taste_summary
    : undefined;

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
                {r.is_cold_start && (
                  <span className="text-[9px] px-1 py-0.2 bg-[#f59e0b]/15 text-[#f59e0b] border border-[#f59e0b]/30 rounded uppercase font-mono">
                    Cold Start
                  </span>
                )}
                <span className="text-[10px] font-mono text-[#666]">
                  {r.current_acceptance_rate}%
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3">
          {repoDetail?.is_cold_start && (
            <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#f59e0b]/10 border border-[#f59e0b]/30 text-[#f59e0b] text-xs font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-[#f59e0b] animate-ping" />
              <span>Cold Start Mode (&lt;5 reviews)</span>
            </div>
          )}

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
      </div>

      {/* PHASE 2: Per-Reviewer Profile Perspective Toggle */}
      {reviewers.length > 0 && (
        <div className="px-9 py-2.5 flex flex-wrap items-center justify-between gap-3 border-y border-[#1f1f1f] bg-[#0c0c0c]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-[#8f8f8f] uppercase font-mono font-semibold tracking-wider mr-1">
              Perspective:
            </span>
            <button
              onClick={() => setSelectedReviewerId(null)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                selectedReviewerId === null
                  ? 'bg-[#3dff6b] text-black font-semibold shadow-[0_0_10px_rgba(61,255,107,0.25)]'
                  : 'bg-[#161616] border border-[#262626] text-[#8f8f8f] hover:text-white'
              }`}
            >
              ● Team Consensus (Repo)
            </button>

            {reviewers.map((rev) => {
              const isSelected = selectedReviewerId === rev.id;
              return (
                <button
                  key={rev.id}
                  onClick={() => setSelectedReviewerId(rev.id)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-[#1a1a1a] border border-[#a855f7] text-white shadow-[0_0_10px_rgba(168,85,247,0.25)]'
                      : 'bg-[#161616] border border-[#262626] text-[#8f8f8f] hover:text-white hover:border-[#383838]'
                  }`}
                >
                  <span 
                    className="w-1.5 h-1.5 rounded-full" 
                    style={{ backgroundColor: rev.avatar_color || '#a855f7' }} 
                  />
                  <span>{rev.name}</span>
                  <span className="text-[10px] text-[#666] font-mono">({rev.role.split(' ')[0]})</span>
                </button>
              );
            })}
          </div>

          {activeReviewer && (
            <div className="text-xs font-mono text-[#a855f7] flex items-center gap-1.5">
              <span>Viewing individual profile:</span>
              <strong className="text-white">{activeReviewer.name}</strong>
              <span className="text-[#888]">({activeReviewer.role})</span>
            </div>
          )}
        </div>
      )}

      {/* Hero Section: 4 Stat Cards directly from design.html */}
      <div className="hero px-9 pt-6 pb-2">
        <div className="stat-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="stat-card bg-[#1a1a1a] border border-[#262626] rounded-2xl p-5 hover:border-[#3dff6b]/40 transition-colors">
            <div className="stat-label text-xs text-[#8f8f8f] uppercase tracking-wider">
              {activeReviewer ? `${activeReviewer.name.split(' ')[0]}'s Acceptance` : 'Acceptance rate'}
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
              {activeReviewer ? 'Teammate Feedback' : 'Repos learning'}
            </div>
            <div className="big-stat text-[46px] leading-none mt-1.5 font-teko text-white">
              {activeReviewer ? activeReviewer.total_reviews_count : totalReposCount}
            </div>
            <div className="trend text-xs text-[#8f8f8f] mt-1 font-mono">
              {activeReviewer ? 'reviews submitted' : 'independent profiles'}
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
              <div className="flex items-center gap-2">
                <h3 className="text-[22px] font-semibold tracking-wide text-white m-0 font-teko">
                  Review queue
                </h3>
                <span className="text-xs font-mono text-[#8f8f8f]">
                  ({activeQueue.length} prioritized items)
                </span>
              </div>
              {demotedQueue.length > 0 && (
                <button
                  onClick={() => setShowDemotedGroup(!showDemotedGroup)}
                  className="text-xs text-[#f59e0b] hover:text-[#fbbf24] font-mono flex items-center gap-1 transition-colors"
                >
                  <span>{showDemotedGroup ? 'Hide Low Priority' : `+${demotedQueue.length} demoted nits`}</span>
                </button>
              )}
            </div>

            <div className="divide-y divide-[#262626] border-t border-[#262626]">
              {activeQueue.length > 0 ? (
                activeQueue.map((flag) => {
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

                  const isFixExpanded = expandedFixId === flag.id;

                  return (
                    <div
                      key={flag.id}
                      className={`queue-item py-3.5 transition-all duration-200 ${animClass}`}
                    >
                      <div className="flex justify-between items-center">
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
                              <span className="text-[10px] px-1 py-0.2 rounded bg-white/5 text-[#888] font-mono uppercase">
                                {flag.language || 'python'}
                              </span>
                            </div>
                            <div className="qi-file text-xs text-[#8f8f8f] font-mono mt-0.5 flex flex-wrap items-center gap-2">
                              <span>{flag.file_path} · line {flag.line_number}</span>
                              {flag.why_shown && (
                                <span className="text-[10px] text-[#a855f7] bg-[#a855f7]/10 px-1.5 py-0.2 rounded border border-[#a855f7]/25 truncate max-w-sm" title={flag.why_shown}>
                                  Why shown: {flag.why_shown}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="qi-actions flex items-center shrink-0 gap-1.5">
                          {(flag.proposed_fix || flag.diff_patch) && (
                            <button
                              onClick={() => setExpandedFixId(isFixExpanded ? null : flag.id)}
                              className="text-[11px] text-[#3dff6b] hover:bg-[#3dff6b]/10 border border-[#3dff6b]/30 px-2.5 py-1 rounded-md transition-all font-mono"
                              title="Toggle Suggested Fix Diff"
                            >
                              {isFixExpanded ? 'Hide Fix' : 'Fix Diff'}
                            </button>
                          )}
                          <button
                            onClick={() => handleAction(flag, 'accept')}
                            className="accept hover:bg-[#3dff6b] hover:text-black hover:border-[#3dff6b] border border-[#262626] text-[#8f8f8f] rounded-[7px] px-2.5 py-1 text-xs cursor-pointer transition-all duration-200 font-medium"
                            title="Accept issue: Increases category weight"
                          >
                            Accept
                          </button>
                          <button
                            onClick={() => handleAction(flag, 'dismiss')}
                            className="dismiss hover:bg-white/10 border border-[#262626] text-[#8f8f8f] rounded-[7px] px-2.5 py-1 text-xs cursor-pointer transition-all duration-200"
                            title="Dismiss issue: Reduces category weight"
                          >
                            Dismiss
                          </button>
                        </div>
                      </div>

                      {/* Expandable Suggested Fix Diff */}
                      {isFixExpanded && (
                        <SuggestedFixDiff
                          flagId={flag.id}
                          filePath={flag.file_path}
                          lineNumber={flag.line_number}
                          proposedFix={flag.proposed_fix}
                          diffPatch={flag.diff_patch}
                          language={flag.language}
                          onFixApplied={() => {
                            setFeedbackToast({
                              message: `Fix applied to ${flag.file_path} (flag marked accepted)`,
                              type: 'primary'
                            });
                            onQueueUpdated();
                          }}
                        />
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="py-8 text-center">
                  <p className="text-sm text-[#8f8f8f] font-urbanist">
                    No active priority flags in queue for {activeRepoId}.
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

            {/* PHASE 2: Collapsible Low Priority / Demoted Group */}
            {demotedQueue.length > 0 && (
              <div className="mt-5 pt-4 border-t border-[#262626]">
                <button
                  onClick={() => setShowDemotedGroup(!showDemotedGroup)}
                  className="flex items-center justify-between w-full p-3 rounded-xl bg-black/50 border border-[#262626] hover:border-[#383838] transition-all text-xs text-[#a0a0a0]"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-[#888] font-mono text-[10px]">
                      {showDemotedGroup ? '▼' : '▶'}
                    </span>
                    <span className="font-semibold text-white">
                      Low Priority Flags ({demotedQueue.length})
                    </span>
                    <span className="text-[10px] bg-[#f59e0b]/10 text-[#f59e0b] px-2 py-0.5 rounded border border-[#f59e0b]/30 font-mono uppercase">
                      Demoted by repo taste
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-[#666]">
                    Critical defects are never demoted
                  </span>
                </button>

                {showDemotedGroup && (
                  <div className="mt-2 divide-y divide-[#222] bg-[#141414] rounded-xl border border-[#222] px-3">
                    {demotedQueue.map(flag => (
                      <div key={flag.id} className="py-2.5 flex justify-between items-center text-xs opacity-75 hover:opacity-100 transition-opacity">
                        <div>
                          <div className="text-white font-medium flex items-center gap-2">
                            <span>{flag.title}</span>
                            <span className="text-[10px] text-[#f59e0b] font-mono uppercase">({flag.category})</span>
                          </div>
                          <div className="text-[11px] text-[#666] font-mono mt-0.5">
                            {flag.file_path} · line {flag.line_number} — {flag.why_shown}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => handleAction(flag, 'accept')}
                            className="accept hover:bg-[#3dff6b] hover:text-black border border-[#333] text-[#8f8f8f] rounded px-2 py-0.5 text-[11px] transition-all"
                            title="Accept flag to revive this category over time"
                          >
                            Accept
                          </button>
                          <button
                            onClick={() => handleAction(flag, 'dismiss')}
                            className="dismiss hover:bg-white/10 border border-[#333] text-[#8f8f8f] rounded px-2 py-0.5 text-[11px] transition-all"
                          >
                            Dismiss
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-[#262626] flex justify-between items-center text-xs text-[#8f8f8f]">
            <span>
              {activeReviewer 
                ? `Feedback is currently tuning ${activeReviewer.name}'s profile.` 
                : 'Feedback feeds directly into Bayesian category weights.'}
            </span>
            <span className="font-mono text-[#3dff6b]">Real-time loop active</span>
          </div>
        </div>

        {/* Right Card: Category Weights */}
        <div className="h-full">
          <CategoryWeightBars
            weights={displayedWeights}
            summaryText={summaryText}
            onOpenExplainTaste={onOpenExplainTaste}
          />
        </div>
      </div>
    </div>
  );
};
