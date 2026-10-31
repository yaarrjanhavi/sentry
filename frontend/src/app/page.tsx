'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { RepoSummary, RepoDetail } from '../lib/types';
import { fetchRepos, fetchRepoDetail } from '../lib/api';
import { Header } from '../components/Header';
import { DashboardView } from '../components/DashboardView';
import { ReviewView } from '../components/ReviewView';
import { ReposView } from '../components/ReposView';
import { SettingsView } from '../components/SettingsView';
import { BenchmarkView } from '../components/BenchmarkView';
import { GitHubModal } from '../components/GitHubModal';
import { ExplainTasteModal } from '../components/ExplainTasteModal';
import { RepoCompareModal } from '../components/RepoCompareModal';
import { OnboardingModal } from '../components/OnboardingModal';

export default function SentryApp() {
  const [currentTab, setCurrentTab] = useState<'dashboard' | 'review' | 'benchmark' | 'repos' | 'settings'>('dashboard');
  const [activeRepoId, setActiveRepoId] = useState<string>('api-gateway');
  const [repos, setRepos] = useState<RepoSummary[]>([]);
  const [repoDetail, setRepoDetail] = useState<RepoDetail | null>(null);
  const [isExplainTasteOpen, setIsExplainTasteOpen] = useState<boolean>(false);
  const [explainTasteRepoId, setExplainTasteRepoId] = useState<string>('api-gateway');
  const [isGitHubModalOpen, setIsGitHubModalOpen] = useState<boolean>(false);
  const [isCompareOpen, setIsCompareOpen] = useState<boolean>(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState<boolean>(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState<boolean>(false);

  // Load repos list
  const loadRepos = useCallback(async () => {
    try {
      const data = await fetchRepos();
      setRepos(data);
    } catch (err) {
      console.error("Failed to load repos:", err);
    }
  }, []);

  // Load active repo detail
  const loadActiveRepoDetail = useCallback(async (repoId: string) => {
    setIsLoadingDetail(true);
    try {
      const detail = await fetchRepoDetail(repoId);
      setRepoDetail(detail);
    } catch (err) {
      console.error("Failed to load repo detail:", err);
    } finally {
      setIsLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    loadRepos();
  }, [loadRepos]);

  useEffect(() => {
    if (activeRepoId) {
      loadActiveRepoDetail(activeRepoId);
    }
  }, [activeRepoId, loadActiveRepoDetail]);

  const handleSelectRepo = (id: string) => {
    setActiveRepoId(id);
    loadActiveRepoDetail(id);
  };

  const handleOpenExplainTaste = (id?: string) => {
    setExplainTasteRepoId(id || activeRepoId);
    setIsExplainTasteOpen(true);
  };

  const handleQueueUpdated = () => {
    loadRepos();
    loadActiveRepoDetail(activeRepoId);
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col font-urbanist selection:bg-[#3dff6b] selection:text-black">
      {/* Header matching design.html */}
      <Header
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        activeRepoId={activeRepoId}
        onOpenExplainTaste={() => handleOpenExplainTaste()}
        onOpenGitHubModal={() => setIsGitHubModalOpen(true)}
        onOpenOnboarding={() => setIsOnboardingOpen(true)}
        onOpenCompare={() => setIsCompareOpen(true)}
      />

      {/* Main Content View Container */}
      <main className="flex-1 w-full">
        {currentTab === 'dashboard' && (
          <DashboardView
            repoDetail={repoDetail}
            repos={repos}
            activeRepoId={activeRepoId}
            isLoading={isLoadingDetail}
            onSelectRepo={handleSelectRepo}
            onOpenExplainTaste={() => handleOpenExplainTaste()}
            onQueueUpdated={handleQueueUpdated}
            onNavigateToReview={() => setCurrentTab('review')}
            onOpenCompare={() => setIsCompareOpen(true)}
            onOpenOnboarding={() => setIsOnboardingOpen(true)}
          />
        )}

        {currentTab === 'review' && (
          <ReviewView
            repos={repos}
            activeRepoId={activeRepoId}
            reviewers={repoDetail?.reviewers || []}
            onSelectRepo={handleSelectRepo}
            onOpenExplainTaste={() => handleOpenExplainTaste()}
            onFeedbackGiven={handleQueueUpdated}
          />
        )}

        {currentTab === 'benchmark' && (
          <BenchmarkView
            activeRepoId={activeRepoId}
            onNavigateToReview={() => setCurrentTab('review')}
          />
        )}

        {currentTab === 'repos' && (
          <ReposView
            repos={repos}
            activeRepoId={activeRepoId}
            onSelectRepo={handleSelectRepo}
            onOpenExplainTasteForRepo={(id) => handleOpenExplainTaste(id)}
            onRepoReset={handleQueueUpdated}
          />
        )}

        {currentTab === 'settings' && (
          <SettingsView />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#262626] px-9 py-6 text-xs text-[#8f8f8f] flex flex-wrap justify-between items-center gap-4 bg-black">
        <div className="flex items-center gap-3">
          <span className="font-teko text-lg text-white font-semibold">
            Sentry<span className="text-[#3dff6b]">.</span>
          </span>
          <span>Self-learning code review agent</span>
        </div>
        <div className="flex items-center gap-6 font-mono text-[11px]">
          <span>Bayesian Beta-Binomial Posterior</span>
          <span>FastAPI + SQLite + Next.js</span>
          <span className="text-[#3dff6b]">All systems operational</span>
        </div>
      </footer>

      {/* Explain Taste Modal */}
      <ExplainTasteModal
        repoId={explainTasteRepoId}
        isOpen={isExplainTasteOpen}
        onClose={() => setIsExplainTasteOpen(false)}
      />

      {/* GitHub App & Webhook Modal */}
      <GitHubModal
        isOpen={isGitHubModalOpen}
        onClose={() => setIsGitHubModalOpen(false)}
        activeRepoId={activeRepoId}
        onFeedbackSync={handleQueueUpdated}
      />

      {/* PHASE 3: Side-by-Side Repo Compare Modal */}
      <RepoCompareModal
        repos={repos}
        initialSourceId={activeRepoId}
        isOpen={isCompareOpen}
        onClose={() => setIsCompareOpen(false)}
        onSelectRepo={handleSelectRepo}
      />

      {/* PHASE 3: First-Run Onboarding & Demo Auth Modal */}
      <OnboardingModal
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
        onStartDemo={() => {
          handleQueueUpdated();
          handleSelectRepo('fintech-core');
        }}
        onOpenGitHubModal={() => {
          setIsOnboardingOpen(false);
          setIsGitHubModalOpen(true);
        }}
      />
    </div>
  );
}
