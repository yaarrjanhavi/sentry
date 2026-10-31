'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { RepoDetail, RepoSummary, FlagItem, ReviewerProfile } from '../lib/types';
import { AcceptanceChart } from './AcceptanceChart';
import { CategoryWeightBars } from './CategoryWeightBars';
import { SuggestedFixDiff } from './SuggestedFixDiff';
import { submitFlagAction, triggerDemoDivergence, getRepoCsvExportUrl } from '../lib/api';

interface DashboardViewProps {
  repoDetail: RepoDetail | null;
  repos: RepoSummary[];
  activeRepoId: string;
  isLoading?: boolean;
  onSelectRepo: (id: string) => void;
  onOpenExplainTaste: () => void;
  onQueueUpdated: () => void;
  onNavigateToReview: () => void;
  onOpenCompare?: () => void;
  onOpenOnboarding?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  repoDetail,
  repos,
  activeRepoId,
  isLoading = false,
  onSelectRepo,
  onOpenExplainTaste,
  onQueueUpdated,
  onNavigateToReview,
  onOpenCompare,
  onOpenOnboarding
}) => {
  const [animatingFlagId, setAnimatingFlagId] = useState<string | null>(null);
  const [animationType, setAnimationType] = useState<'accept' | 'dismiss' | null>(null);
  const [feedbackToast, setFeedbackToast] = useState<{ message: string; type: string } | null>(null);
  const [selectedReviewerId, setSelectedReviewerId] = useState<string | null>(null);
  const [showDemotedGroup, setShowDemotedGroup] = useState<boolean>(false);
  const [expandedFixId, setExpandedFixId] = useState<string | null>(null);
  const [focusedQueueIndex, setFocusedQueueIndex] = useState<number>(0);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState<boolean>(false);
  const [isDemoSimulating, setIsDemoSimulating] = useState<boolean>(false);

  const reviewers = repoDetail?.reviewers || [];
  const activeReviewer: ReviewerProfile | null = 
    selectedReviewerId ? (reviewers.find(r => r.id === selectedReviewerId) || null) : null;

  const queue = repoDetail?.queue || [];
  const activeQueue = queue.filter(f => !f.demoted);
  const demotedQueue = queue.filter(f => f.demoted);

  const handleAction = useCallback(async (flag: FlagItem, action: 'accept' | 'dismiss' | 'not_relevant') => {
    setAnimatingFlagId(flag.id);
    setAnimationType(action === 'accept' ? 'accept' : 'dismiss');

    try {
      const res = await submitFlagAction(flag.id, action, selectedReviewerId || undefined);
      
      const actionText = action === 'accept' ? 'Accepted' : (action === 'dismiss' ? 'Dismissed' : 'Marked Not Relevant');
      const arrow = action === 'accept' ? '↑' : '↓';
      const reviewerNote = res.reviewer_profile ? ` (${res.reviewer_profile.name} tuned)` : '';

      setFeedbackToast({
        message: `${actionText}: ${flag.category} adjusted to ${res.updated_percentage}% (${arrow})${reviewerNote}`,
        type: action === 'accept' ? 'primary' : 'muted'
      });

      setTimeout(() => {
        setFeedbackToast(null);
      }, 4000);

      setTimeout(() => {
        setAnimatingFlagId(null);
        setAnimationType(null);
        onQueueUpdated();
      }, 250);
    } catch (err) {
      console.error("Action error:", err);
      setAnimatingFlagId(null);
      setAnimationType(null);
    }
  }, [selectedReviewerId, onQueueUpdated]);

  // Phase 3: Keyboard Navigation Hook (A for accept, D for dismiss, J/K for navigation, ? for help)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.key === '?') {
        setShowShortcutsHelp(prev => !prev);
      } else if (e.key === 'j' || e.key === 'ArrowDown') {
        if (activeQueue.length > 0) {
          setFocusedQueueIndex(prev => (prev + 1) % activeQueue.length);
        }
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        if (activeQueue.length > 0) {
          setFocusedQueueIndex(prev => (prev - 1 + activeQueue.length) % activeQueue.length);
        }
      } else if (e.key === 'a' || e.key === 'A') {
        if (activeQueue[focusedQueueIndex]) {
          handleAction(activeQueue[focusedQueueIndex], 'accept');
        }
      } else if (e.key === 'd' || e.key === 'D') {
        if (activeQueue[focusedQueueIndex]) {
          handleAction(activeQueue[focusedQueueIndex], 'dismiss');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeQueue, focusedQueueIndex, handleAction]);

  const handleTriggerDemo = async () => {
    setIsDemoSimulating(true);
    try {
      await triggerDemoDivergence();
      onQueueUpdated();
      onSelectRepo('fintech-core');
      setFeedbackToast({
        message: 'Recruiter Demo: Loaded fintech-core (94% Security) & web-design-system (94% Style)!',
        type: 'primary'
      });
      setTimeout(() => setFeedbackToast(null), 5000);
    } catch (err) {
      console.error("Demo trigger failed", err);
    } finally {
      setIsDemoSimulating(false);
    }
  };

  const handlePrintReport = () => {
    window.print();
  };

  // Metrics calculation
  const currentRate = activeReviewer 
    ? activeReviewer.current_acceptance_rate 
    : (repoDetail?.current_acceptance_rate ?? 78);

  const trendText = activeReviewer
    ? `${activeReviewer.total_reviews_count} feedback reviews recorded`
    : (repoDetail?.trend_text ?? '↑ 34% since round 1');

  const flagsThisWeek = repoDetail?.flags_this_week ?? 142;

  const topCategory = activeReviewer
    ? activeReviewer.top_category
    : (repoDetail?.top_category ?? 'Security');

  const topWeight = activeReviewer
    ? activeReviewer.top_category_weight
    : (repoDetail?.top_category_weight ?? 88);

  const totalReposCount = repos.length || 3;

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
        <div className="fixed bottom-6 right-6 z-50 bg-[#1a1a1a] border border-[#3dff6b]/40 text-white px-5 py-3 rounded-xl shadow-[0_0_24px_rgba(61,255,107,0.25)] flex items-center gap-3 text-xs font-mono animate-rise">
          <span className="w-2.5 h-2.5 rounded-full bg-[#3dff6b] animate-ping" />
          <span>{feedbackToast.message}</span>
        </div>
      )}

      {/* Keyboard Shortcuts Help Modal */}
      {showShortcutsHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#1a1a1a] border border-[#262626] rounded-2xl w-full max-w-sm p-5 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-lg font-bold font-teko text-white m-0">Keyboard Shortcuts</h4>
              <button onClick={() => setShowShortcutsHelp(false)} className="text-[#888] hover:text-white">&times;</button>
            </div>
            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between p-2 rounded bg-black/50 border border-[#222]">
                <span className="text-[#8f8f8f]">Accept focused flag</span>
                <kbd className="px-2 py-0.5 rounded bg-[#222] text-[#3dff6b] font-bold">A</kbd>
              </div>
              <div className="flex justify-between p-2 rounded bg-black/50 border border-[#222]">
                <span className="text-[#8f8f8f]">Dismiss focused flag</span>
                <kbd className="px-2 py-0.5 rounded bg-[#222] text-[#f59e0b] font-bold">D</kbd>
              </div>
              <div className="flex justify-between p-2 rounded bg-black/50 border border-[#222]">
                <span className="text-[#8f8f8f]">Next / Previous flag</span>
                <kbd className="px-2 py-0.5 rounded bg-[#222] text-white font-bold">J / K</kbd>
              </div>
              <div className="flex justify-between p-2 rounded bg-black/50 border border-[#222]">
                <span className="text-[#8f8f8f]">Toggle shortcuts cheat sheet</span>
                <kbd className="px-2 py-0.5 rounded bg-[#222] text-white font-bold">?</kbd>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PHASE 3: Recruiter Demo Mode & Global Action Bar */}
      <div className="px-9 py-2.5 bg-[#0e0e0e] border-b border-[#1f1f1f] flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-1.5 text-[11px] font-mono uppercase text-[#3dff6b] bg-[#3dff6b]/10 border border-[#3dff6b]/25 px-2.5 py-0.5 rounded-full font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-[#3dff6b] animate-pulse" />
            Recruiter Demo Workspace
          </span>
          <span className="text-[#888] font-urbanist hidden sm:inline">
            Two pre-seeded repos visibly converging to contrasting standards without signing in.
          </span>
        </div>

        <div className="flex items-center gap-2">
          {onOpenOnboarding && (
            <button
              onClick={onOpenOnboarding}
              className="px-2.5 py-1 rounded-lg border border-[#333] hover:border-[#3dff6b] text-[#8f8f8f] hover:text-white font-mono text-[11px] transition-colors"
            >
              Guided Tour
            </button>
          )}

          {onOpenCompare && (
            <button
              onClick={onOpenCompare}
              className="px-2.5 py-1 rounded-lg border border-[#333] hover:border-[#a855f7] text-[#8f8f8f] hover:text-[#a855f7] font-mono text-[11px] transition-colors flex items-center gap-1"
            >
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>
              </svg>
              <span>Compare Repos</span>
            </button>
          )}

          <a
            href={getRepoCsvExportUrl(activeRepoId)}
            download
            className="px-2.5 py-1 rounded-lg border border-[#333] hover:border-[#3dff6b] text-[#8f8f8f] hover:text-[#3dff6b] font-mono text-[11px] transition-colors flex items-center gap-1"
            title="Download full Bayesian learning progression CSV audit report"
          >
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
            </svg>
            <span>Export CSV</span>
          </a>

          <button
            onClick={handlePrintReport}
            className="px-2.5 py-1 rounded-lg border border-[#333] hover:border-white text-[#8f8f8f] hover:text-white font-mono text-[11px] transition-colors"
            title="Print or export PDF Learning Report"
          >
            Print / PDF
          </button>

          <button
            onClick={handleTriggerDemo}
            disabled={isDemoSimulating}
            className="px-3 py-1 rounded-lg bg-[#3dff6b] hover:bg-[#32e05d] text-black font-semibold font-mono text-[11px] transition-all shadow-[0_0_12px_rgba(61,255,107,0.25)] disabled:opacity-50"
          >
            {isDemoSimulating ? 'Simulating...' : 'Auto-Converge Demo Repos'}
          </button>
        </div>
      </div>

      {/* Header Bar matching design.html */}
      <div className="header border-b border-[#262626] px-9 py-6 flex flex-wrap justify-between items-center gap-4 bg-black">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="title text-[28px] font-semibold tracking-wide text-white m-0 font-teko">
              Repo: {repoDetail?.name || activeRepoId}
            </h2>
            {repoDetail?.is_cold_start && (
              <span className="text-[10px] text-[#f59e0b] bg-[#f59e0b]/15 px-2.5 py-0.5 rounded-full border border-[#f59e0b]/30 font-mono uppercase tracking-wider">
                Cold Start (Baseline Priors)
              </span>
            )}
          </div>
          <div className="subtitle text-xs text-[#8f8f8f] mt-1 font-urbanist">
            {activeReviewer 
              ? `Viewing learned preferences for ${activeReviewer.name} (${activeReviewer.role})`
              : (repoDetail?.description || 'Bayesian self-learning code review agent active.')}
          </div>
        </div>

        <div className="header-actions flex flex-wrap items-center gap-3">
          <button
            onClick={onOpenExplainTaste}
            className="btn btn-secondary px-4 py-2 rounded-lg bg-transparent border border-[#333] hover:border-[#a855f7] text-[#a855f7] hover:text-white text-xs font-medium transition-all"
          >
            Explain my taste
          </button>

          <button
            onClick={onNavigateToReview}
            className="btn btn-primary px-4 py-2 rounded-lg bg-[#3dff6b] hover:bg-[#32e05d] text-black text-xs font-semibold tracking-wide transition-all shadow-[0_0_16px_rgba(61,255,107,0.3)]"
          >
            Review code diff
          </button>
        </div>
      </div>

      {/* PHASE 2 & 3: Per-Reviewer Profile Perspective Toggle */}
      {reviewers.length > 0 && (
        <div className="px-9 py-2.5 flex flex-wrap items-center justify-between gap-3 border-y border-[#1f1f1f] bg-[#0c0c0c]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-[#8f8f8f] uppercase font-mono font-semibold">Perspective:</span>
            <button
              onClick={() => setSelectedReviewerId(null)}
              className={`px-3 py-1 rounded-lg text-xs font-mono transition-all flex items-center gap-1.5 ${
                selectedReviewerId === null
                  ? 'bg-[#3dff6b] text-black font-semibold shadow-[0_0_10px_rgba(61,255,107,0.3)]'
                  : 'bg-black text-[#8f8f8f] hover:text-white border border-[#262626]'
              }`}
            >
              <span>Repository Consensus</span>
            </button>

            {reviewers.map(r => (
              <button
                key={r.id}
                onClick={() => setSelectedReviewerId(r.id)}
                className={`px-3 py-1 rounded-lg text-xs font-mono transition-all flex items-center gap-1.5 ${
                  selectedReviewerId === r.id
                    ? 'bg-[#a855f7] text-white font-semibold shadow-[0_0_10px_rgba(168,85,247,0.3)]'
                    : 'bg-black text-[#8f8f8f] hover:text-white border border-[#262626]'
                }`}
              >
                <span>{r.name}</span>
                <span className="text-[10px] opacity-75">({r.role.split(' ')[0]})</span>
              </button>
            ))}
          </div>

          {activeReviewer && (
            <div className="text-[11px] font-mono text-[#a855f7] bg-[#a855f7]/10 px-3 py-1 rounded-lg border border-[#a855f7]/25 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#a855f7] animate-pulse" />
              <span>Personalized Model: {activeReviewer.name} · Priority: {activeReviewer.top_category} ({activeReviewer.top_category_weight}%)</span>
            </div>
          )}
        </div>
      )}

      {/* Stat Cards 4-Column Row */}
      <div className="stats-row px-9 pt-7">
        {isLoading ? (
          /* Loading Skeletons for Stat Cards */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-28 rounded-2xl bg-[#141414] border border-[#222] p-5 animate-pulse">
                <div className="h-3 w-20 bg-[#262626] rounded mb-3" />
                <div className="h-8 w-24 bg-[#262626] rounded mb-2" />
                <div className="h-2.5 w-32 bg-[#222] rounded" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="stat-card bg-[#1a1a1a] border border-[#262626] rounded-2xl p-5 hover:border-[#333] transition-colors">
              <div className="stat-label text-xs text-[#8f8f8f] uppercase tracking-wider">
                {activeReviewer ? `${activeReviewer.name}'s acceptance` : 'Current acceptance rate'}
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
                Across {totalReposCount} active repositories
              </div>
            </div>

            <div className="stat-card bg-[#1a1a1a] border border-[#262626] rounded-2xl p-5 hover:border-[#333] transition-colors">
              <div className="stat-label text-xs text-[#8f8f8f] uppercase tracking-wider">
                {activeReviewer ? 'Reviewer top priority' : 'Top category'}
              </div>
              <div className="big-stat text-[46px] leading-none mt-1.5 font-teko text-[#a855f7]">
                {topCategory}
              </div>
              <div className="trend text-xs text-[#8f8f8f] mt-1 font-mono">
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
        )}
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

            {/* Review Queue Title */}
            <div className="queue-title text-xl tracking-wide text-white font-teko font-semibold mt-7 mb-3.5 flex justify-between items-center">
              <span>Review Queue — Pending Flags ({activeQueue.length})</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowShortcutsHelp(true)}
                  className="text-[11px] font-mono text-[#666] hover:text-[#888] flex items-center gap-1 border border-[#333] px-1.5 py-0.5 rounded"
                  title="Keyboard shortcuts: A (accept), D (dismiss), J/K (navigate)"
                >
                  <kbd className="text-[#3dff6b] font-bold">A</kbd>/<kbd className="text-[#f59e0b] font-bold">D</kbd> shortcuts
                </button>
                <span className="text-xs text-[#8f8f8f] font-mono">
                  {activeReviewer ? `Perspective: ${activeReviewer.name}` : 'Repo Consensus'}
                </span>
              </div>
            </div>

            {/* Queue List */}
            <div className="queue space-y-3">
              {activeQueue.length > 0 ? (
                activeQueue.map((flag, idx) => {
                  const isAnimating = animatingFlagId === flag.id;
                  const isFixExpanded = expandedFixId === flag.id;
                  const isFocused = focusedQueueIndex === idx;

                  let itemClasses = 'queue-item p-3.5 rounded-xl border transition-all duration-200 ';
                  if (isFocused) {
                    itemClasses += 'ring-1 ring-[#3dff6b]/50 ';
                  }

                  if (isAnimating && animationType === 'accept') {
                    itemClasses += 'accepted-flash bg-[#3dff6b]/10 border-[#3dff6b] ';
                  } else if (isAnimating && animationType === 'dismiss') {
                    itemClasses += 'dismissed-flash opacity-25 border-transparent ';
                  } else {
                    itemClasses += 'bg-[#141414] border-[#262626] hover:border-[#383838] ';
                  }

                  return (
                    <div 
                      key={flag.id} 
                      className={itemClasses}
                      onClick={() => setFocusedQueueIndex(idx)}
                    >
                      <div className="flex justify-between items-start gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="qi-title text-sm font-semibold text-white font-urbanist">
                              {flag.title}
                            </span>
                            <span className={`text-[10px] font-mono uppercase px-2 py-0.2 rounded font-bold ${
                              flag.category === 'security' ? 'text-[#a855f7] bg-[#a855f7]/15' :
                              flag.category === 'complexity' ? 'text-[#3dff6b] bg-[#3dff6b]/15' :
                              flag.category === 'best-practice' ? 'text-[#38bdf8] bg-[#38bdf8]/15' :
                              'text-[#888] bg-white/10'
                            }`}>
                              {flag.category}
                            </span>
                            {flag.language && (
                              <span className="text-[10px] font-mono uppercase text-[#888] bg-[#222] px-1.5 py-0.2 rounded">
                                {flag.language}
                              </span>
                            )}
                          </div>

                          <div className="qi-meta text-xs text-[#8f8f8f] font-mono mb-2">
                            {flag.file_path} · line {flag.line_number}
                          </div>

                          {/* Plain English explanation */}
                          <p className="text-xs text-[#a0a0a0] leading-relaxed mb-2 font-urbanist">
                            {flag.explanation}
                          </p>

                          {/* Why was this shown? Explainer */}
                          {flag.why_shown && (
                            <div className="text-[11px] font-mono text-[#a855f7] bg-[#a855f7]/10 p-2 rounded-lg border border-[#a855f7]/20 flex items-start gap-2 mb-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#a855f7] mt-1 shrink-0" />
                              <span>{flag.why_shown}</span>
                            </div>
                          )}

                          {/* Expand Suggested Fix Diff toggle */}
                          {(flag.diff_patch || flag.proposed_fix) && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedFixId(isFixExpanded ? null : flag.id);
                              }}
                              className="text-[11px] font-mono text-[#3dff6b] hover:underline flex items-center gap-1 mb-2"
                            >
                              <span>{isFixExpanded ? '▲ Hide Suggested Patch' : '▼ View Proposed Unified Fix'}</span>
                            </button>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="qi-actions flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => handleAction(flag, 'accept')}
                            className="accept hover:bg-[#3dff6b] hover:text-black font-semibold text-xs border border-[#262626] px-3 py-1.5 rounded-lg text-[#3dff6b] transition-all cursor-pointer"
                            title="Accept flag (Press 'A' when focused)"
                          >
                            Accept
                          </button>
                          <button
                            onClick={() => handleAction(flag, 'dismiss')}
                            className="dismiss hover:bg-white/10 text-xs border border-[#262626] px-3 py-1.5 rounded-lg text-[#8f8f8f] transition-all cursor-pointer"
                            title="Dismiss flag (Press 'D' when focused)"
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
                            handleAction(flag, 'accept');
                          }}
                        />
                      )}
                    </div>
                  );
                })
              ) : (
                /* Celebration Empty State when Queue is Clean */
                <div className="py-12 text-center p-6 bg-black/40 rounded-xl border border-[#222]">
                  <div className="w-12 h-12 rounded-full bg-[#3dff6b]/15 border border-[#3dff6b]/30 text-[#3dff6b] flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <h4 className="text-lg font-bold font-teko text-white m-0">Review Queue is Clear!</h4>
                  <p className="text-xs text-[#8f8f8f] font-urbanist mt-1 max-w-sm mx-auto">
                    All flagged issues have been reviewed. Bayesian weights for {activeRepoId} have incorporated your feedback.
                  </p>
                  <button
                    onClick={onNavigateToReview}
                    className="mt-4 px-4 py-1.5 rounded-lg bg-[#3dff6b] text-black text-xs font-semibold hover:bg-[#32e05d] transition-all shadow-[0_0_12px_rgba(61,255,107,0.25)]"
                  >
                    Review Next Code Diff →
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
