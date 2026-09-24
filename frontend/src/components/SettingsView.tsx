'use client';

import React, { useState } from 'react';

export const SettingsView: React.FC = () => {
  const [geminiKey, setGeminiKey] = useState<string>('');
  const [openaiKey, setOpenaiKey] = useState<string>('');
  const [suppressionThreshold, setSuppressionThreshold] = useState<number>(28);
  const [learningEngine, setLearningEngine] = useState<string>('bayesian');
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  const handleSave = () => {
    localStorage.setItem('sentry_gemini_key', geminiKey);
    localStorage.setItem('sentry_openai_key', openaiKey);
    localStorage.setItem('sentry_suppression_threshold', suppressionThreshold.toString());
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  return (
    <div className="px-9 py-6 max-w-4xl mx-auto w-full">
      <div className="mb-6">
        <h2 className="text-3xl font-bold font-teko text-white tracking-wide m-0">
          Agent Settings &amp; Learning Parameters
        </h2>
        <p className="text-xs text-[#8f8f8f] mt-1 font-urbanist">
          Configure LLM synthesis keys, AST static inspection, and Bayesian learning sensitivity.
        </p>
      </div>

      <div className="space-y-6">
        {/* LLM Engine Config */}
        <div className="bg-[#1a1a1a] border border-[#262626] rounded-2xl p-6">
          <h3 className="text-xl font-bold font-teko text-white mb-2">
            LLM Synthesis Layer
          </h3>
          <p className="text-xs text-[#8f8f8f] mb-4">
            Sentry includes a built-in static AST analyzer that operates offline with zero configuration. Add an API key below to enable natural-language reasoning and patch suggestions.
          </p>

          <div className="space-y-4">
            <div>
              <label className="text-xs text-white font-medium block mb-1">
                Google Gemini API Key
              </label>
              <input
                type="password"
                placeholder="AIzaSy..."
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
                className="w-full bg-black border border-[#262626] rounded-lg px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#3dff6b] font-mono"
              />
              <span className="text-[10px] text-[#666] font-mono mt-1 block">
                Powers fast contextual review explanations using Gemini 1.5 Flash.
              </span>
            </div>

            <div>
              <label className="text-xs text-white font-medium block mb-1">
                OpenAI API Key
              </label>
              <input
                type="password"
                placeholder="sk-..."
                value={openaiKey}
                onChange={(e) => setOpenaiKey(e.target.value)}
                className="w-full bg-black border border-[#262626] rounded-lg px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#a855f7] font-mono"
              />
            </div>
          </div>
        </div>

        {/* Bayesian Learning Parameters */}
        <div className="bg-[#1a1a1a] border border-[#262626] rounded-2xl p-6">
          <h3 className="text-xl font-bold font-teko text-white mb-2">
            Adaptive Weight Model
          </h3>
          <p className="text-xs text-[#8f8f8f] mb-4">
            Fine-tune how aggressively user feedback updates per-repo priorities.
          </p>

          <div className="space-y-5">
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs text-white font-medium">
                  Noise Suppression Threshold
                </label>
                <span className="text-xs font-mono text-[#3dff6b] font-bold">
                  {suppressionThreshold}%
                </span>
              </div>
              <input
                type="range"
                min="10"
                max="50"
                value={suppressionThreshold}
                onChange={(e) => setSuppressionThreshold(Number(e.target.value))}
                className="w-full accent-[#3dff6b] bg-black cursor-pointer"
              />
              <span className="text-[10px] text-[#666] font-mono block mt-1">
                Categories with posterior weight below this percentage will be suppressed in PR reviews unless marked critical.
              </span>
            </div>

            <div>
              <label className="text-xs text-white font-medium block mb-1.5">
                Update Algorithm
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setLearningEngine('bayesian')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    learningEngine === 'bayesian'
                      ? 'bg-black border-[#3dff6b] text-white'
                      : 'bg-black/50 border-[#262626] text-[#8f8f8f]'
                  }`}
                >
                  <div className="text-xs font-bold font-mono text-[#3dff6b]">
                    Bayesian Beta-Binomial
                  </div>
                  <div className="text-[11px] text-[#8f8f8f] mt-1 leading-normal">
                    Prior distribution updated with exact evidence counts. Highly explainable and stable.
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setLearningEngine('ema')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    learningEngine === 'ema'
                      ? 'bg-black border-[#a855f7] text-white'
                      : 'bg-black/50 border-[#262626] text-[#8f8f8f]'
                  }`}
                >
                  <div className="text-xs font-bold font-mono text-[#a855f7]">
                    Exponential Moving Average
                  </div>
                  <div className="text-[11px] text-[#8f8f8f] mt-1 leading-normal">
                    Applies time-decay factor favoring recent feedback over historical decisions.
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Save Bar */}
        <div className="flex items-center justify-between pt-2">
          {savedSuccess ? (
            <span className="text-xs text-[#3dff6b] font-mono flex items-center gap-1.5">
              <span>&#10003;</span> Configuration saved successfully
            </span>
          ) : (
            <span className="text-xs text-[#666] font-mono">
              Changes take effect immediately on next review round.
            </span>
          )}

          <button
            onClick={handleSave}
            className="px-6 py-2 rounded-lg bg-[#3dff6b] hover:bg-[#32e05d] text-black font-semibold text-xs transition-all shadow-[0_0_12px_rgba(61,255,107,0.2)]"
          >
            Save Preferences
          </button>
        </div>
      </div>
    </div>
  );
};
