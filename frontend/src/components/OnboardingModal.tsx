'use client';

import React, { useState } from 'react';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartDemo: () => void;
  onOpenGitHubModal: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  onClose,
  onStartDemo,
  onOpenGitHubModal
}) => {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isSignedInDemo, setIsSignedInDemo] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleDemoSignIn = () => {
    setIsSignedInDemo(true);
    setTimeout(() => {
      setCurrentStep(2);
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fadeIn">
      <div 
        className="bg-[#1a1a1a] border border-[#262626] rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-rise"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-[#262626] bg-[#141414]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#3dff6b]/15 border border-[#3dff6b]/40 flex items-center justify-center text-[#3dff6b]">
              <span className="font-teko text-lg font-bold">S</span>
            </div>
            <div>
              <h2 className="text-xl font-bold font-teko text-white tracking-wide m-0">
                Welcome to Sentry v2
              </h2>
              <span className="text-[11px] text-[#8f8f8f] font-mono">
                Guided First-Run Onboarding &amp; Architecture Tour
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-[#8f8f8f]">
              Step {currentStep} of 3
            </span>
            <button
              onClick={onClose}
              className="text-[#8f8f8f] hover:text-white text-xl p-1 leading-none ml-2"
            >
              &times;
            </button>
          </div>
        </div>

        {/* Step Progress Indicators */}
        <div className="grid grid-cols-3 border-b border-[#262626] bg-[#0c0c0c] text-xs font-mono">
          <div 
            onClick={() => setCurrentStep(1)}
            className={`py-2.5 px-4 text-center cursor-pointer border-r border-[#222] transition-colors ${
              currentStep === 1 ? 'text-[#3dff6b] bg-[#3dff6b]/10 font-bold' : 'text-[#666]'
            }`}
          >
            1. Connect &amp; Auth
          </div>
          <div 
            onClick={() => setCurrentStep(2)}
            className={`py-2.5 px-4 text-center cursor-pointer border-r border-[#222] transition-colors ${
              currentStep === 2 ? 'text-[#3dff6b] bg-[#3dff6b]/10 font-bold' : 'text-[#666]'
            }`}
          >
            2. Review &amp; Fix
          </div>
          <div 
            onClick={() => setCurrentStep(3)}
            className={`py-2.5 px-4 text-center cursor-pointer transition-colors ${
              currentStep === 3 ? 'text-[#3dff6b] bg-[#3dff6b]/10 font-bold' : 'text-[#666]'
            }`}
          >
            3. Self-Learning Loop
          </div>
        </div>

        {/* Step Content */}
        <div className="p-6 space-y-4">
          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-black border border-[#262626]">
                <h3 className="text-base font-bold text-white mb-1 font-urbanist">
                  Connect Your Repositories &amp; Teammates
                </h3>
                <p className="text-xs text-[#a0a0a0] leading-relaxed">
                  Sentry hooks directly into GitHub PR webhooks to run inline reviews automatically. No CI slow-downs: it runs async and posts flags as inline comments.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={onOpenGitHubModal}
                  className="p-4 rounded-xl bg-[#141414] border border-[#262626] hover:border-[#3dff6b] text-left transition-all group"
                >
                  <div className="flex items-center gap-2 mb-1.5 text-xs font-bold text-white group-hover:text-[#3dff6b]">
                    <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
                    </svg>
                    <span>Connect Real GitHub App</span>
                  </div>
                  <p className="text-[11px] text-[#777] leading-relaxed">
                    Set up your webhook secret to receive pull_request and review_comment events.
                  </p>
                </button>

                <button
                  onClick={handleDemoSignIn}
                  className="p-4 rounded-xl bg-[#141414] border border-[#a855f7]/40 hover:border-[#a855f7] text-left transition-all group"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-[#a855f7]">1-Click Recruiter Demo Sign-In</span>
                    <span className="text-[9px] bg-[#a855f7]/20 text-[#a855f7] px-1.5 py-0.5 rounded font-mono">Instant</span>
                  </div>
                  <p className="text-[11px] text-[#777] leading-relaxed">
                    {isSignedInDemo 
                      ? "✓ Authenticated as Demo Recruiter!"
                      : "Try Sentry without configuring GitHub OAuth tokens. Pre-seeds contrasting repositories."}
                  </p>
                </button>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-black border border-[#262626]">
                <h3 className="text-base font-bold text-white mb-1 font-urbanist">
                  Review Multi-Language Diffs with One-Click Fixes
                </h3>
                <p className="text-xs text-[#a0a0a0] leading-relaxed">
                  Sentry analyzes Python, JavaScript, and TypeScript diffs. Every flagged issue contains a transparent explainer and an interactive suggested fix.
                </p>
              </div>

              <div className="bg-[#141414] p-3.5 rounded-xl border border-[#262626] font-mono text-xs space-y-2">
                <div className="text-[11px] text-[#3dff6b] font-bold">Key Utility Features:</div>
                <div className="text-[#a0a0a0] flex items-center gap-2">
                  <span className="text-[#3dff6b]">&#10003;</span>
                  <span><strong>Unified Diffs:</strong> Syntax-colored proposed fixes with standard git diff format.</span>
                </div>
                <div className="text-[#a0a0a0] flex items-center gap-2">
                  <span className="text-[#3dff6b]">&#10003;</span>
                  <span><strong>1-Click Apply:</strong> Creates virtual fix branches automatically.</span>
                </div>
                <div className="text-[#a0a0a0] flex items-center gap-2">
                  <span className="text-[#3dff6b]">&#10003;</span>
                  <span><strong>Teammate Profiles:</strong> Switch perspectives between Sarah Chen, Alex Rivera, and David Kim.</span>
                </div>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-black border border-[#262626]">
                <h3 className="text-base font-bold text-white mb-1 font-urbanist">
                  Provable Self-Learning: The Bayesian Math
                </h3>
                <p className="text-xs text-[#a0a0a0] leading-relaxed">
                  Every Accept increases the category Alpha parameter; every Dismiss increases Beta. Weights decay gently with time so team standards evolve smoothly.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                <div className="bg-[#141414] p-3 rounded-xl border border-[#262626]">
                  <div className="text-[#3dff6b] font-bold text-[11px] uppercase mb-1">Severity-Aware Safety</div>
                  <p className="text-[#888] text-[11px]">
                    Critical defects are NEVER silently dropped. Only low-weight nits are demoted to the collapsed priority drawer.
                  </p>
                </div>
                <div className="bg-[#141414] p-3 rounded-xl border border-[#262626]">
                  <div className="text-[#a855f7] font-bold text-[11px] uppercase mb-1">Offline Benchmark</div>
                  <p className="text-[#888] text-[11px]">
                    Replay 100 historical flags to prove that Sentry reduces false positive noise by over 80%.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="flex justify-between items-center px-6 py-4 border-t border-[#262626] bg-[#141414]">
          <button
            onClick={() => setCurrentStep(prev => Math.max(1, prev - 1))}
            disabled={currentStep === 1}
            className="px-3 py-1.5 rounded-lg border border-[#333] text-xs text-[#8f8f8f] hover:text-white disabled:opacity-30 transition-colors"
          >
            Previous
          </button>

          <div className="flex items-center gap-2">
            {currentStep < 3 ? (
              <button
                onClick={() => setCurrentStep(prev => Math.min(3, prev + 1))}
                className="px-4 py-1.5 rounded-lg bg-[#3dff6b] hover:bg-[#32e05d] text-black font-semibold text-xs transition-colors"
              >
                Next Step &rarr;
              </button>
            ) : (
              <button
                onClick={() => {
                  onStartDemo();
                  onClose();
                }}
                className="px-4 py-1.5 rounded-lg bg-[#3dff6b] hover:bg-[#32e05d] text-black font-semibold text-xs transition-all shadow-[0_0_12px_rgba(61,255,107,0.3)]"
              >
                Launch Recruiter Demo Mode
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
