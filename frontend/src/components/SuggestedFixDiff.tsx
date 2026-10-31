'use client';

import React, { useState } from 'react';
import { applyFlagFix } from '../lib/api';
import { ApplyFixResponse } from '../lib/types';

interface SuggestedFixDiffProps {
  flagId: string;
  filePath: string;
  lineNumber?: number;
  proposedFix?: string;
  diffPatch?: string;
  language?: string;
  onFixApplied?: (res: ApplyFixResponse) => void;
}

export const SuggestedFixDiff: React.FC<SuggestedFixDiffProps> = ({
  flagId,
  filePath,
  lineNumber = 1,
  proposedFix,
  diffPatch,
  language = 'python',
  onFixApplied
}) => {
  const [isApplying, setIsApplying] = useState(false);
  const [copiedPatch, setCopiedPatch] = useState(false);
  const [appliedResult, setAppliedResult] = useState<ApplyFixResponse | null>(null);
  const [showFullDiff, setShowFullDiff] = useState(false);

  // Generate a standard unified git patch if not pre-built
  const patchText = diffPatch || `--- a/${filePath}\n+++ b/${filePath}\n@@ -${lineNumber},1 +${lineNumber},${proposedFix?.split('\n').length || 1} @@\n+${proposedFix || ''}`;

  const handleCopyPatch = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(patchText);
    setCopiedPatch(true);
    setTimeout(() => setCopiedPatch(false), 2200);
  };

  const handleApplyFix = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsApplying(true);
    try {
      const res = await applyFlagFix(flagId);
      setAppliedResult(res);
      onFixApplied?.(res);
    } catch (err) {
      console.error("Failed to apply fix", err);
    } finally {
      setIsApplying(false);
    }
  };

  if (!proposedFix && !diffPatch) {
    return null;
  }

  // Parse lines for visualization
  const patchLines = patchText.split('\n');

  return (
    <div className="mt-3 rounded-xl bg-black/80 border border-[#262626] overflow-hidden text-xs font-mono shadow-inner">
      {/* Top Bar with Language Tag & One-Click Actions */}
      <div className="flex flex-wrap justify-between items-center px-3.5 py-2 border-b border-[#262626] bg-[#141414]/90 gap-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#3dff6b] animate-pulse" />
          <span className="text-[11px] font-semibold text-white tracking-wide uppercase">
            Suggested Fix Diff
          </span>
          <span className="text-[10px] px-1.5 py-0.2 rounded bg-white/10 text-[#8f8f8f] uppercase font-mono">
            {language}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {appliedResult ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#3dff6b]/15 border border-[#3dff6b]/40 text-[#3dff6b] text-[11px] font-medium animate-fadeIn">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              <span>Applied to <strong className="font-mono">{appliedResult.branch_name}</strong> ({appliedResult.commit_sha})</span>
            </div>
          ) : (
            <>
              <button
                onClick={handleCopyPatch}
                className="px-2.5 py-1 rounded-lg border border-[#333] hover:border-[#3dff6b]/50 hover:bg-[#3dff6b]/10 text-[#a0a0a0] hover:text-white transition-all text-[11px] flex items-center gap-1.5"
                title="Copy git-compatible unified patch to clipboard"
              >
                {copiedPatch ? (
                  <>
                    <svg className="w-3 h-3 text-[#3dff6b]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    <span className="text-[#3dff6b]">Patch Copied!</span>
                  </>
                ) : (
                  <>
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                    </svg>
                    <span>Copy Patch</span>
                  </>
                )}
              </button>

              <button
                onClick={handleApplyFix}
                disabled={isApplying}
                className="px-3 py-1 rounded-lg bg-[#3dff6b] hover:bg-[#34e05e] text-black font-semibold transition-all text-[11px] flex items-center gap-1.5 shadow-[0_0_12px_rgba(61,255,107,0.25)] disabled:opacity-50"
                title="Apply fix: creates virtual fix branch & marks accepted"
              >
                {isApplying ? (
                  <>
                    <span className="w-3 h-3 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    <span>Applying...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                      <polyline points="22 4 12 14.01 9 11.01"/>
                    </svg>
                    <span>Apply Fix</span>
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Unified Diff Line View */}
      <div className="p-3 overflow-x-auto text-[11px] leading-relaxed max-h-56 overflow-y-auto">
        {patchLines.map((line, idx) => {
          let lineClass = 'text-[#8f8f8f]';
          let bgClass = 'bg-transparent';
          let prefix = ' ';

          if (line.startsWith('---') || line.startsWith('+++')) {
            lineClass = 'text-[#666] font-semibold';
          } else if (line.startsWith('@@')) {
            lineClass = 'text-[#a855f7] font-semibold bg-[#a855f7]/5 px-1 py-0.5 rounded';
          } else if (line.startsWith('-')) {
            lineClass = 'text-[#ef4444]';
            bgClass = 'bg-[#ef4444]/10';
            prefix = '-';
          } else if (line.startsWith('+')) {
            lineClass = 'text-[#3dff6b] font-medium';
            bgClass = 'bg-[#3dff6b]/10';
            prefix = '+';
          }

          return (
            <div key={idx} className={`flex items-start px-1.5 py-0.5 rounded ${bgClass}`}>
              <span className="select-none text-[#555] w-6 shrink-0 text-right pr-2 text-[10px]">
                {idx + 1}
              </span>
              <span className={`select-none w-4 shrink-0 font-bold ${lineClass}`}>
                {line.startsWith('-') ? '-' : (line.startsWith('+') ? '+' : ' ')}
              </span>
              <span className={`whitespace-pre-wrap break-all ${lineClass}`}>
                {line.startsWith('-') || line.startsWith('+') ? line.slice(1) : line}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
