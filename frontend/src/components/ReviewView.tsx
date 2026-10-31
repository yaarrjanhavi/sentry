'use client';

import React, { useState } from 'react';
import { RepoSummary, FlagItem, ReviewerProfile } from '../lib/types';
import { SAMPLE_DIFFS } from '../lib/sampleDiffs';
import { submitDiffReview, submitFlagAction } from '../lib/api';
import { SuggestedFixDiff } from './SuggestedFixDiff';

interface ReviewViewProps {
  repos: RepoSummary[];
  activeRepoId: string;
  reviewers?: ReviewerProfile[];
  onSelectRepo: (id: string) => void;
  onOpenExplainTaste: () => void;
  onFeedbackGiven: () => void;
}

export const ReviewView: React.FC<ReviewViewProps> = ({
  repos,
  activeRepoId,
  reviewers = [],
  onSelectRepo,
  onOpenExplainTaste,
  onFeedbackGiven
}) => {
  const [selectedSample, setSelectedSample] = useState<string>('sample-auth');
  const [diffTitle, setDiffTitle] = useState<string>('PR #342: Refactor session authentication and route validation');
  const [diffContent, setDiffContent] = useState<string>(SAMPLE_DIFFS[0].diff);
  const [isReviewing, setIsReviewing] = useState<boolean>(false);
  const [flags, setFlags] = useState<FlagItem[]>([]);
  const [suppressedCount, setSuppressedCount] = useState<number>(0);
  const [filterSuppressed, setFilterSuppressed] = useState<boolean>(true);
  const [activeFlagId, setActiveFlagId] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [selectedReviewerId, setSelectedReviewerId] = useState<string | null>(null);
  const [showDemotedSection, setShowDemotedSection] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const activeReviewer = selectedReviewerId ? reviewers.find(r => r.id === selectedReviewerId) || null : null;

  const handleSampleChange = (sampleId: string) => {
    setSelectedSample(sampleId);
    const sample = SAMPLE_DIFFS.find(s => s.id === sampleId);
    if (sample) {
      setDiffTitle(sample.name);
      setDiffContent(sample.diff);
      if (sample.repoId) {
        onSelectRepo(sample.repoId);
      }
    }
  };

  const handleRunReview = async () => {
    if (!diffContent.trim()) return;
    setIsReviewing(true);
    try {
      const res = await submitDiffReview(activeRepoId, diffTitle, diffContent);
      setFlags(res.flags);
      setSuppressedCount(res.filtered_out_count);
      if (res.flags.length > 0) {
        setActiveFlagId(res.flags[0].id);
      }
    } catch (err) {
      console.error("Review error:", err);
    } finally {
      setIsReviewing(false);
    }
  };

  const handleFlagAction = async (flagId: string, action: 'accept' | 'dismiss' | 'not_relevant') => {
    setActionInProgress(flagId);
    try {
      const res = await submitFlagAction(flagId, action, selectedReviewerId || undefined);
      // Update local flag state
      setFlags(prev => prev.map(f => f.id === flagId ? { ...f, status: action } : f));
      
      const revNote = res.reviewer_profile ? ` for ${res.reviewer_profile.name}` : '';
      setToastMessage(`Feedback recorded${revNote}: ${res.category} weight adjusted to ${res.updated_percentage}%`);
      setTimeout(() => setToastMessage(null), 3500);

      onFeedbackGiven();
    } catch (err) {
      console.error("Action error:", err);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleFixApplied = (flagId: string, res: import('../lib/types').ApplyFixResponse) => {
    setToastMessage(`Proposed patch applied to branch '${res.branch_name}'! Auto-accepting flag.`);
    handleFlagAction(flagId, 'accept');
  };

  // Filter flags according to suppression toggle
  const visibleFlags = filterSuppressed 
    ? flags.filter(f => !f.suppressed)
    : flags;

  // Phase 2 Severity-aware suppression: split into active flags and demoted (low priority) flags
  const activeFlags = visibleFlags.filter(f => !f.demoted);
  const demotedFlags = visibleFlags.filter(f => f.demoted);

  // Split diff into lines for viewer
  const diffLines = diffContent.split('\n');

  return (
    <div className="px-9 py-6 max-w-[1700px] mx-auto w-full">
      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1a1a1a] border border-[#3dff6b]/40 text-white px-4 py-2.5 rounded-xl shadow-[0_0_20px_rgba(61,255,107,0.2)] flex items-center gap-2 text-xs font-mono animate-rise">
          <span className="w-2 h-2 rounded-full bg-[#3dff6b] animate-ping" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Controls Bar */}
      <div className="bg-[#1a1a1a] border border-[#262626] rounded-2xl p-5 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <label className="text-[11px] text-[#8f8f8f] uppercase font-mono block mb-1">
                Target Repo
              </label>
              <select
                value={activeRepoId}
                onChange={(e) => onSelectRepo(e.target.value)}
                className="bg-black border border-[#262626] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#3dff6b]"
              >
                {repos.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.current_acceptance_rate}% match)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] text-[#8f8f8f] uppercase font-mono block mb-1">
                Load Sample Diff
              </label>
              <select
                value={selectedSample}
                onChange={(e) => handleSampleChange(e.target.value)}
                className="bg-black border border-[#262626] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#a855f7]"
              >
                {SAMPLE_DIFFS.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] text-[#8f8f8f] uppercase font-mono block mb-1">
                PR / Diff Title
              </label>
              <input
                type="text"
                value={diffTitle}
                onChange={(e) => setDiffTitle(e.target.value)}
                className="bg-black border border-[#262626] rounded-lg px-3 py-1.5 text-xs text-white w-72 focus:outline-none focus:border-[#3dff6b]"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setFilterSuppressed(!filterSuppressed)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs transition-all ${
                filterSuppressed
                  ? 'bg-[#141414] border-[#a855f7]/40 text-[#a855f7]'
                  : 'bg-transparent border-[#333] text-[#8f8f8f]'
              }`}
              title="When enabled, Sentry suppresses categories that this repo has down-weighted"
            >
              <span className={`w-2 h-2 rounded-full ${filterSuppressed ? 'bg-[#a855f7]' : 'bg-[#555]'}`} />
              <span>Learned Suppression {filterSuppressed ? 'Active' : 'Off'}</span>
              {suppressedCount > 0 && filterSuppressed && (
                <span className="px-1.5 py-0.2 text-[10px] rounded bg-[#a855f7]/20 text-[#a855f7] font-mono">
                  {suppressedCount} hidden
                </span>
              )}
            </button>

            <button
              onClick={handleRunReview}
              disabled={isReviewing}
              className="flex items-center gap-2 px-5 py-2 rounded-lg bg-[#3dff6b] hover:bg-[#32e05d] text-black font-semibold text-xs tracking-wide transition-all shadow-[0_0_16px_rgba(61,255,107,0.25)] disabled:opacity-50 cursor-pointer"
            >
              {isReviewing ? (
                <>
                  <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                  </svg>
                  <span>Analyzing Diff...</span>
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polygon points="5 3 19 12 5 21 5 3"/>
                  </svg>
                  <span>Review Code Diff</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Phase 2: Per-Reviewer Profile Filter Bar */}
        {reviewers.length > 0 && (
          <div className="mt-4 pt-3.5 border-t border-[#262626] flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-mono text-[#8f8f8f] uppercase">Reviewer Perspective:</span>
              <button
                onClick={() => setSelectedReviewerId(null)}
                className={`px-3 py-1 rounded-lg text-xs font-mono transition-all flex items-center gap-1.5 ${
                  selectedReviewerId === null
                    ? 'bg-[#3dff6b] text-black font-semibold shadow-[0_0_10px_rgba(61,255,107,0.3)]'
                    : 'bg-black/60 text-[#8f8f8f] hover:text-white border border-[#262626]'
                }`}
              >
                <span>Team Consensus</span>
              </button>
              {reviewers.map(r => (
                <button
                  key={r.id}
                  onClick={() => setSelectedReviewerId(r.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-mono transition-all flex items-center gap-1.5 ${
                    selectedReviewerId === r.id
                      ? 'bg-[#a855f7] text-white font-semibold shadow-[0_0_10px_rgba(168,85,247,0.3)]'
                      : 'bg-black/60 text-[#8f8f8f] hover:text-white border border-[#262626]'
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
                <span>Active Profile: {activeReviewer.name} · Priority: {activeReviewer.top_category} ({activeReviewer.top_category_weight}%)</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main Review Section: GitHub-PR-style split view */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Code Diff Viewer (7 cols) */}
        <div className="lg:col-span-7 bg-[#1a1a1a] border border-[#262626] rounded-2xl overflow-hidden flex flex-col h-[750px]">
          <div className="flex justify-between items-center px-4 py-3 border-b border-[#262626] bg-[#141414]">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#3dff6b]/40"></span>
              <span className="text-xs font-mono text-white font-medium">Diff Inspector</span>
              <span className="text-[11px] font-mono text-[#8f8f8f]">
                ({diffLines.length} lines)
              </span>
            </div>
            <div className="text-[11px] font-mono text-[#8f8f8f]">
              Click a flagged line to focus explanation
            </div>
          </div>

          <div className="p-4 flex-1 overflow-auto font-mono text-xs leading-relaxed bg-black/60">
            {diffLines.map((line, idx) => {
              const lineNo = idx + 1;
              const isAdded = line.startsWith('+') && !line.startsWith('+++');
              const isDeleted = line.startsWith('-') && !line.startsWith('---');
              const isHunkHeader = line.startsWith('@@');
              const isFileHeader = line.startsWith('diff ') || line.startsWith('---') || line.startsWith('+++');

              // Check if any flag matches this line
              const lineFlag = flags.find(f => f.line_number === lineNo || line.includes(f.title.split(' ')[0]));
              const isFlagged = Boolean(lineFlag);

              let lineClass = 'hover:bg-white/[0.03] transition-colors';
              if (isAdded) lineClass = 'diff-line-added text-emerald-300';
              else if (isDeleted) lineClass = 'diff-line-deleted text-red-300';
              else if (isHunkHeader) lineClass = 'text-[#a855f7] bg-[#a855f7]/5 py-1 font-semibold';
              else if (isFileHeader) lineClass = 'text-[#8f8f8f] font-semibold bg-[#111] py-1 border-t border-b border-[#222]';

              if (isFlagged) {
                lineClass += ' diff-line-flagged';
              }

              return (
                <div
                  key={idx}
                  onClick={() => lineFlag && setActiveFlagId(lineFlag.id)}
                  className={`flex items-start px-2 py-0.5 rounded cursor-pointer ${lineClass}`}
                >
                  <span className="w-10 text-right pr-3 select-none text-[#555] shrink-0">
                    {lineNo}
                  </span>
                  <span className="w-4 select-none text-[#666] shrink-0 font-bold">
                    {isAdded ? '+' : isDeleted ? '-' : ' '}
                  </span>
                  <span className="flex-1 whitespace-pre-wrap break-all">
                    {line}
                  </span>

                  {lineFlag && (
                    <span 
                      className={`ml-2 px-1.5 py-0.2 rounded text-[10px] shrink-0 uppercase font-bold tracking-wider ${
                        lineFlag.category === 'security' ? 'bg-[#a855f7] text-white' :
                        lineFlag.category === 'complexity' ? 'bg-[#3dff6b] text-black' :
                        'bg-[#444] text-white'
                      }`}
                    >
                      {lineFlag.category}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          <div className="p-3 border-t border-[#262626] bg-[#141414] text-[11px] text-[#8f8f8f] flex justify-between items-center">
            <span>Unified Diff View</span>
            <span>Language-aware AST heuristics + Bayesian priors</span>
          </div>
        </div>

        {/* Right Column: Inline Agent Feedback & Comments (5 cols) */}
        <div className="lg:col-span-5 flex flex-col h-[750px] space-y-4">
          <div className="flex justify-between items-center bg-[#1a1a1a] border border-[#262626] px-4 py-3 rounded-xl">
            <div>
              <h3 className="text-xl font-bold font-teko text-white tracking-wide m-0">
                Agent Flags ({activeFlags.length})
              </h3>
              <p className="text-[11px] text-[#8f8f8f] m-0">
                {activeReviewer 
                  ? `Reviewing through ${activeReviewer.name}'s perspective.` 
                  : `Accept or dismiss to tune ${activeRepoId}'s category weights.`}
              </p>
            </div>
            <button
              onClick={onOpenExplainTaste}
              className="text-xs text-[#a855f7] hover:underline font-mono"
            >
              Why these flags?
            </button>
          </div>

          {/* Flags Container */}
          <div className="flex-1 overflow-y-auto space-y-3.5 pr-1">
            {activeFlags.length > 0 ? (
              activeFlags.map((flag) => {
                const isActive = activeFlagId === flag.id;
                const isActing = actionInProgress === flag.id;

                const categoryColor =
                  flag.category === 'security' ? 'text-[#a855f7] bg-[#a855f7]/15 border-[#a855f7]/30' :
                  flag.category === 'complexity' ? 'text-[#3dff6b] bg-[#3dff6b]/15 border-[#3dff6b]/30' :
                  flag.category === 'best-practice' ? 'text-[#c084fc] bg-[#c084fc]/15 border-[#c084fc]/30' :
                  'text-[#888888] bg-[#888888]/15 border-[#888888]/30';

                const severityColor =
                  flag.severity === 'critical' ? 'text-[#ef4444] bg-[#ef4444]/15 border-[#ef4444]/30' :
                  flag.severity === 'warning' ? 'text-[#f59e0b] bg-[#f59e0b]/15 border-[#f59e0b]/30' :
                  'text-[#38bdf8] bg-[#38bdf8]/15 border-[#38bdf8]/30';

                return (
                  <div
                    key={flag.id}
                    id={`flag-card-${flag.id}`}
                    onClick={() => setActiveFlagId(flag.id)}
                    className={`bg-[#1a1a1a] border rounded-2xl p-4 transition-all duration-200 cursor-pointer ${
                      isActive 
                        ? 'border-[#3dff6b] shadow-[0_0_15px_rgba(61,255,107,0.12)]' 
                        : 'border-[#262626] hover:border-[#404040]'
                    } ${flag.status === 'accepted' ? 'border-l-4 border-l-[#3dff6b]' : ''} ${
                      flag.status === 'dismissed' ? 'opacity-50' : ''
                    }`}
                  >
                    {/* Header: Badges & Location */}
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-mono font-bold border ${categoryColor}`}>
                          {flag.category}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-mono font-bold border ${severityColor}`}>
                          {flag.severity}
                        </span>
                        {flag.language && (
                          <span className="px-2 py-0.5 rounded text-[10px] uppercase font-mono font-bold bg-[#222] text-[#8f8f8f] border border-[#333]">
                            {flag.language.toUpperCase()}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] font-mono text-[#8f8f8f]">
                        Line {flag.line_number}
                      </span>
                    </div>

                    {/* Title */}
                    <div className="text-sm font-semibold text-white mb-1.5 font-urbanist">
                      {flag.title}
                    </div>

                    {/* Plain English Explanation */}
                    <p className="text-xs text-[#a0a0a0] leading-relaxed mb-3">
                      {flag.explanation}
                    </p>

                    {/* Why was this shown? Transparency Explainer */}
                    {flag.why_shown && (
                      <div className="mb-3 px-3 py-2 rounded-xl bg-black/70 border border-[#a855f7]/40 text-xs font-mono flex items-start gap-2.5 shadow-sm">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#a855f7] mt-1 shrink-0 animate-pulse" />
                        <div>
                          <div className="text-[10px] uppercase font-bold text-[#a855f7] tracking-wider mb-0.5">
                            Why was this shown?
                          </div>
                          <div className="text-[#e2e8f0] text-[11px] leading-relaxed">
                            {flag.why_shown}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Phase 2: One-Click Suggested Fix Unified Diff */}
                    {(flag.diff_patch || flag.proposed_fix) && (
                      <div className="mb-3">
                        <SuggestedFixDiff
                          flagId={flag.id}
                          filePath={flag.file_path}
                          lineNumber={flag.line_number}
                          proposedFix={flag.proposed_fix}
                          diffPatch={flag.diff_patch}
                          language={flag.language}
                          onFixApplied={(res) => handleFixApplied(flag.id, res)}
                        />
                      </div>
                    )}

                    {/* Relevance & Actions Bar */}
                    <div className="flex justify-between items-center pt-2 border-t border-[#262626]">
                      <div className="text-[11px] font-mono text-[#8f8f8f]">
                        Taste weight: <strong className="text-white">{flag.repo_weight}%</strong>
                        {flag.ci_bounds && (
                          <span className="text-[#666] ml-1">
                            (90% CI: [{flag.ci_bounds[0]}% - {flag.ci_bounds[1]}%])
                          </span>
                        )}
                      </div>

                      {flag.status === 'pending' ? (
                        <div className="flex items-center gap-1.5 qi-actions">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleFlagAction(flag.id, 'accept');
                            }}
                            disabled={isActing}
                            className="accept hover:bg-[#3dff6b] hover:text-black font-semibold text-xs border border-[#262626] px-3 py-1 rounded-lg text-[#3dff6b] transition-all"
                          >
                            Accept
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleFlagAction(flag.id, 'dismiss');
                            }}
                            disabled={isActing}
                            className="dismiss hover:bg-white/10 text-xs border border-[#262626] px-3 py-1 rounded-lg text-[#8f8f8f] transition-all"
                          >
                            Dismiss
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleFlagAction(flag.id, 'not_relevant');
                            }}
                            disabled={isActing}
                            className="not-relevant hover:bg-[#a855f7]/20 text-[11px] border border-[#262626] px-2 py-1 rounded-lg text-[#8f8f8f] transition-all"
                            title="Noise for this context"
                          >
                            Irrelevant
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-xs font-mono">
                          {flag.status === 'accepted' ? (
                            <span className="text-[#3dff6b] flex items-center gap-1">
                              <span>&#10003;</span> Accepted (+1 weight)
                            </span>
                          ) : (
                            <span className="text-[#8f8f8f]">
                              Dismissed (-1 weight)
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-12 flex flex-col items-center justify-center text-center p-8 bg-[#1a1a1a] border border-[#262626] rounded-2xl">
                <div className="w-12 h-12 rounded-full bg-black border border-[#262626] flex items-center justify-center text-[#3dff6b] mb-3">
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </div>
                <h4 className="text-lg font-bold font-teko text-white m-0">
                  Ready to Review
                </h4>
                <p className="text-xs text-[#8f8f8f] mt-1 max-w-xs">
                  Click &ldquo;Review Code Diff&rdquo; above to run static AST analysis and evaluate findings against {activeRepoId}&apos;s Bayesian profile.
                </p>
                <button
                  onClick={handleRunReview}
                  className="mt-4 px-4 py-2 rounded-lg bg-[#3dff6b] text-black font-semibold text-xs hover:bg-[#32e05d] transition-all"
                >
                  Run Review Now
                </button>
              </div>
            )}

            {/* PHASE 2: Collapsible Low Priority / Demoted Section */}
            {demotedFlags.length > 0 && (
              <div className="pt-2 border-t border-[#262626]">
                <button
                  onClick={() => setShowDemotedSection(!showDemotedSection)}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-[#141414] border border-[#262626] hover:border-[#383838] transition-all text-xs text-[#a0a0a0]"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[#888] font-mono text-[10px]">
                      {showDemotedSection ? '▼' : '▶'}
                    </span>
                    <span className="font-semibold text-white">
                      Low Priority Flags ({demotedFlags.length})
                    </span>
                    <span className="text-[10px] bg-[#f59e0b]/10 text-[#f59e0b] px-2 py-0.5 rounded border border-[#f59e0b]/30 font-mono uppercase">
                      Demoted by repo taste
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-[#666]">
                    Never silently dropped
                  </span>
                </button>

                {showDemotedSection && (
                  <div className="mt-2 space-y-2.5">
                    {demotedFlags.map(flag => (
                      <div
                        key={flag.id}
                        className="p-3 rounded-xl bg-[#141414] border border-[#222] opacity-80 hover:opacity-100 transition-opacity"
                      >
                        <div className="flex justify-between items-start gap-2 mb-1.5">
                          <div>
                            <span className="text-white text-xs font-semibold">{flag.title}</span>
                            <span className="ml-2 text-[10px] font-mono uppercase text-[#f59e0b]">({flag.category})</span>
                            <div className="text-[11px] text-[#777] font-mono mt-0.5">
                              {flag.file_path} · line {flag.line_number}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              onClick={() => handleFlagAction(flag.id, 'accept')}
                              className="accept hover:bg-[#3dff6b] hover:text-black border border-[#333] text-[#8f8f8f] rounded px-2 py-0.5 text-[11px] transition-all"
                              title="Accept flag to revive this category over time"
                            >
                              Accept
                            </button>
                            <button
                              onClick={() => handleFlagAction(flag.id, 'dismiss')}
                              className="dismiss hover:bg-white/10 border border-[#333] text-[#8f8f8f] rounded px-2 py-0.5 text-[11px] transition-all"
                            >
                              Dismiss
                            </button>
                          </div>
                        </div>
                        <p className="text-[11px] text-[#888] mb-1">
                          {flag.explanation}
                        </p>
                        <div className="text-[10px] font-mono text-[#f59e0b]/80 bg-[#f59e0b]/5 px-2 py-1 rounded border border-[#f59e0b]/20">
                          Suppression status: {flag.suppression_reason || 'Demoted due to low historical category acceptance'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
