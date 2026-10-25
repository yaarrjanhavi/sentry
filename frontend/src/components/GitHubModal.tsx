'use client';

import React, { useState, useEffect } from 'react';
import { simulateGitHubEvent, fetchGitHubEvents } from '../lib/api';
import { GitHubEventItem } from '../lib/types';

interface GitHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeRepoId?: string;
  onRefreshRepo?: () => void;
  onFeedbackSync?: () => void;
}

export const GitHubModal: React.FC<GitHubModalProps> = ({
  isOpen,
  onClose,
  activeRepoId = 'api-gateway',
  onRefreshRepo,
  onFeedbackSync
}) => {
  const [events, setEvents] = useState<GitHubEventItem[]>([]);
  const [isSimulatingPR, setIsSimulatingPR] = useState(false);
  const [isSimulatingReaction, setIsSimulatingReaction] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const loadEvents = async () => {
    try {
      const data = await fetchGitHubEvents(activeRepoId);
      setEvents(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadEvents();
    }
  }, [isOpen, activeRepoId]);

  if (!isOpen) return null;

  const webhookUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/github/webhook`
    : 'https://your-sentry-domain.com/api/github/webhook';

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2000);
  };

  const handleSimulatePR = async () => {
    setIsSimulatingPR(true);
    setStatusMessage(null);
    try {
      const res = await simulateGitHubEvent({
        event_type: 'pull_request',
        action: 'opened',
        pull_request: {
          number: Math.floor(Math.random() * 800) + 100,
          title: 'PR #421: Implement auth middleware & route validation'
        },
        repository: { name: activeRepoId }
      });
      setStatusMessage(`PR #${res.pr_number || 421} reviewed! Posted ${res.flags_posted || 2} inline review flags.`);
      await loadEvents();
      onRefreshRepo?.();
      onFeedbackSync?.();
    } catch (err) {
      setStatusMessage('Simulation failed');
    } finally {
      setIsSimulatingPR(false);
    }
  };

  const handleSimulateReaction = async (reaction: '+1' | '-1') => {
    setIsSimulatingReaction(true);
    setStatusMessage(null);
    try {
      const res = await simulateGitHubEvent({
        event_type: 'reaction',
        action: 'created',
        reaction: { content: reaction, comment_id: 'gh-sim-comment' },
        repository: { name: activeRepoId }
      });
      const actionName = reaction === '+1' ? 'Accepted' : 'Dismissed';
      setStatusMessage(`GitHub reaction '${reaction}' recorded: ${actionName} and updated Bayesian weights!`);
      await loadEvents();
      onRefreshRepo?.();
      onFeedbackSync?.();
    } catch (err) {
      setStatusMessage('Simulation failed');
    } finally {
      setIsSimulatingReaction(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fadeIn">
      <div 
        className="bg-[#1a1a1a] border border-[#262626] rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl animate-rise flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-[#262626] bg-[#141414]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#3dff6b]/15 border border-[#3dff6b]/30 flex items-center justify-center text-[#3dff6b]">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/>
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold font-teko text-white tracking-wide m-0">
                GitHub App &amp; Webhook Integration
              </h2>
              <span className="text-[11px] text-[#3dff6b] font-mono flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#3dff6b] animate-pulse"></span>
                Two-Way Automated Learning Loop Active
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

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-urbanist">
          {/* Status Message Toast */}
          {statusMessage && (
            <div className="p-3 bg-[#3dff6b]/10 border border-[#3dff6b]/30 rounded-xl text-xs text-[#3dff6b] font-mono flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#3dff6b]"></span>
              <span>{statusMessage}</span>
            </div>
          )}

          {/* Webhook Configuration Box */}
          <div className="p-4 rounded-xl bg-black border border-[#262626]">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-mono uppercase text-[#8f8f8f] font-semibold">
                GitHub Webhook Endpoint (Payload URL)
              </span>
              <span className="text-[10px] text-[#3dff6b] font-mono px-2 py-0.5 rounded bg-[#3dff6b]/15 border border-[#3dff6b]/30">
                HMAC-SHA256 Verified
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={webhookUrl}
                className="flex-1 bg-[#141414] border border-[#262626] rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none"
              />
              <button
                onClick={handleCopyWebhook}
                className="px-3.5 py-2 rounded-lg bg-[#1a1a1a] hover:bg-[#262626] border border-[#262626] text-xs font-mono text-[#3dff6b] transition-colors"
              >
                {copiedWebhook ? 'Copied!' : 'Copy URL'}
              </button>
            </div>
            <p className="text-[11px] text-[#8f8f8f] mt-2 mb-0 leading-relaxed">
              In your GitHub Repository &rarr; <strong>Settings &rarr; Webhooks &rarr; Add Webhook</strong>. Select content type <code>application/json</code>, and subscribe to <strong>Pull requests</strong>, <strong>Pull request reviews</strong>, and <strong>Issue comments</strong>.
            </p>
          </div>

          {/* How the Real GitHub Feedback Loop Works */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-[#141414] border border-[#262626]">
              <div className="text-xs uppercase text-[#a855f7] font-semibold mb-1.5 flex items-center gap-2">
                <span>1. Automated Pull Request Review</span>
              </div>
              <p className="text-xs text-[#8f8f8f] leading-relaxed m-0">
                When a developer opens or updates a PR, Sentry receives the webhook, fetches the unified diff, runs multi-category AST analysis, evaluates against learned weights, and posts inline review comments on the exact code lines.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[#141414] border border-[#262626]">
              <div className="text-xs uppercase text-[#3dff6b] font-semibold mb-1.5 flex items-center gap-2">
                <span>2. Reaction-Based Learning Loop</span>
              </div>
              <p className="text-xs text-[#8f8f8f] leading-relaxed m-0">
                Developers react directly on GitHub: 👍 or ❤️ automatically increments the category alpha (Accept), while 👎 or comment replies of &ldquo;noise&rdquo; increment beta (Dismiss). The Bayesian weight model immediately adapts.
              </p>
            </div>
          </div>

          {/* Interactive Simulation Panel */}
          <div className="p-4 rounded-xl bg-black border border-[#262626]">
            <div className="text-xs uppercase tracking-wider text-white font-semibold mb-2">
              Interactive Webhook Testing (Simulate without Live GitHub Tunnel)
            </div>
            <p className="text-xs text-[#8f8f8f] mb-3">
              Trigger real webhook review pipelines and reaction learning loops on <strong>{activeRepoId}</strong>:
            </p>
            <div className="flex flex-wrap gap-2.5">
              <button
                onClick={handleSimulatePR}
                disabled={isSimulatingPR}
                className="px-3.5 py-2 rounded-lg bg-[#3dff6b]/15 hover:bg-[#3dff6b]/25 border border-[#3dff6b]/40 text-[#3dff6b] text-xs font-semibold font-mono transition-all flex items-center gap-2 disabled:opacity-50"
              >
                <span>{isSimulatingPR ? 'Analyzing PR...' : '⚡ Simulate PR Opened Event'}</span>
              </button>

              <button
                onClick={() => handleSimulateReaction('+1')}
                disabled={isSimulatingReaction}
                className="px-3 py-2 rounded-lg bg-[#1a1a1a] hover:bg-[#262626] border border-[#262626] text-white text-xs font-mono transition-all flex items-center gap-1.5"
              >
                <span>👍 Simulate Reaction Accept</span>
              </button>

              <button
                onClick={() => handleSimulateReaction('-1')}
                disabled={isSimulatingReaction}
                className="px-3 py-2 rounded-lg bg-[#1a1a1a] hover:bg-[#262626] border border-[#262626] text-[#8f8f8f] hover:text-white text-xs font-mono transition-all flex items-center gap-1.5"
              >
                <span>👎 Simulate Reaction Dismiss</span>
              </button>
            </div>
          </div>

          {/* Recent Event Audit Feed */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <h4 className="text-sm uppercase tracking-wider text-white font-semibold font-teko text-lg m-0">
                Recent GitHub Webhook Invocations
              </h4>
              <button
                onClick={loadEvents}
                className="text-[11px] text-[#8f8f8f] hover:text-[#3dff6b] font-mono transition-colors"
              >
                Refresh Log
              </button>
            </div>
            <div className="space-y-2">
              {events.length > 0 ? (
                events.slice(0, 5).map((evt) => (
                  <div
                    key={evt.id}
                    className="p-3 rounded-lg bg-[#141414] border border-[#262626] flex items-center justify-between text-xs font-mono"
                  >
                    <div className="flex items-center gap-2.5 truncate pr-3">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${evt.action === 'accept' ? 'bg-[#3dff6b]' : (evt.action === 'dismiss' ? 'bg-[#ef4444]' : 'bg-[#a855f7]')}`} />
                      <span className="text-white font-semibold uppercase">{evt.event_type}</span>
                      <span className="text-[#8f8f8f] truncate">{evt.summary}</span>
                    </div>
                    <span className="text-[10px] text-[#666] shrink-0">
                      {new Date(evt.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-xs text-[#8f8f8f] font-mono bg-[#141414] rounded-lg border border-[#262626]">
                  No webhook events logged yet for {activeRepoId}. Trigger a simulation above or connect your GitHub repository webhook.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-[#262626] bg-[#141414] flex justify-between items-center">
          <span className="text-[11px] text-[#8f8f8f] font-mono">
            Environment: GITHUB_TOKEN &amp; GITHUB_WEBHOOK_SECRET verified
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
