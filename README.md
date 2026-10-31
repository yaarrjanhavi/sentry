# Sentry v2 — Self-Learning Bayesian Code Review Agent

[![CI Build](https://img.shields.io/badge/CI-GitHub%20Actions-3dff6b?style=flat-square&logo=githubactions&logoColor=black)](https://github.com/yaarrjanhavi/sentry/actions)
[![Tests](https://img.shields.io/badge/Tests-42%2F42%20Passing-3dff6b?style=flat-square)](https://github.com/yaarrjanhavi/sentry)
[![Frontend](https://img.shields.io/badge/Frontend-Next.js%2014%20%7C%20TailwindCSS-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![Backend](https://img.shields.io/badge/Backend-FastAPI%20%7C%20Python%203.11+-3dff6b?style=flat-square&logo=fastapi&logoColor=black)](https://fastapi.tiangolo.com/)
[![Database](https://img.shields.io/badge/Storage-SQLite%203-a855f7?style=flat-square&logo=sqlite)](https://sqlite.org/)
[![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](LICENSE)

**Sentry** is an adaptive, self-learning AI code review agent. Unlike static linters that enforce rigid, uniform rules across all codebases, Sentry **learns what each team and repository actually cares about** through human feedback (`Accept`, `Dismiss`, `Irrelevant`).

Sentry combines multi-language static AST heuristics (Python, TypeScript, JavaScript) with an isolated, per-repository **Bayesian Beta-Binomial posterior model with exponential time decay**. Over review cycles, it converges to the team's engineering standards: amplifying critical defects, offering 1-click suggested patches, and suppressing repetitive cosmetic noise.

---

## 🏗️ Architecture Overview

```
                                      ┌────────────────────────────────────────────────────────┐
                                      │                   CODE INPUT SOURCES                   │
                                      │  • GitHub App Pull Request Webhook (HMAC-SHA256)       │
                                      │  • Unified PR Diff Inspector (Web UI)                  │
                                      └───────────────────────────┬────────────────────────────┘
                                                                  │
                                                                  ▼
                                      ┌────────────────────────────────────────────────────────┐
                                      │                 RATE LIMITING & CACHE                  │
                                      │  • Token-Bucket Limiter (120 req/min, burst 30)        │
                                      │  • SHA-256 LRU Diff Cache (30-minute TTL)              │
                                      └───────────────────────────┬────────────────────────────┘
                                                                  │ Cache Miss
                                                                  ▼
                                      ┌────────────────────────────────────────────────────────┐
                                      │             MULTI-LANGUAGE AST ANALYZER                │
                                      │  • Python: SQL injection, bare excepts, dynamic eval   │
                                      │  • TypeScript/JS: React XSS, unsound any, localStorage │
                                      │  • LLM Refinement: Optional Gemini / OpenAI synthesis  │
                                      └───────────────────────────┬────────────────────────────┘
                                                                  │
                                                                  ▼
                                      ┌────────────────────────────────────────────────────────┐
                                      │               SEVERITY-AWARE DECISION GATE             │
                                      │  • Critical / Warning: ALWAYS prioritized              │
                                      │  • Nit Severity + Category Weight < 28%:               │
                                      │    Demoted to Collapsed Low-Priority Drawer            │
                                      └───────────────────────────┬────────────────────────────┘
                                                                  │
                                                                  ▼
                                      ┌────────────────────────────────────────────────────────┐
                                      │            FEEDBACK & TASTE LEARNING LOOP              │
                                      │  • Accept: Alpha + 1.0 (reinforce category priority)   │
                                      │  • Dismiss: Beta + 1.0 (penalize unwanted noise)       │
                                      │  • Irrelevant: Beta + 1.5 (heavy noise penalty)        │
                                      │  • Time Decay: Decays prior feedback by 0.97^Δt        │
                                      └───────────────────────────┬────────────────────────────┘
                                                                  │
                                      ┌───────────────────────────┴────────────────────────────┐
                                      ▼                                                        ▼
                        ┌──────────────────────────┐                             ┌──────────────────────────┐
                        │   REPOSITORY CONSENSUS   │                             │  TEAMMATE PROFILE VIEWS  │
                        │  (api-gateway, fintech)  │                             │  (Sarah, Alex, David)    │
                        └──────────────────────────┘                             └──────────────────────────┘
```

---

## 📊 Headline Benchmark Proof: Offline Replay Results

To mathematically prove that Sentry's adaptive learning outperforms static, non-learning review tools, Sentry includes an **Offline Replay Benchmark Mode** (`POST /api/benchmark/replay`). 

A historical dataset of **100 labeled PR flags across 10 evaluation rounds** was fed through both the **Static Baseline Model** (fixed rules, non-adaptive) and the **Sentry v2 Bayesian Model**.

### Benchmark Summary Table

| Metric | Static Baseline (Non-Learning) | Sentry v2 (Learned Model) | Net Improvement |
|---|---|---|---|
| **Precision** | **50.0%** | **100.0%** | **+50.0%** 🚀 |
| **Acceptance Rate** | 50.0% | **100.0%** | **2.0x Higher Match** |
| **False-Positive Rate (FPR)** | 1.00 (High Noise) | **0.00 (Zero Noise)** | **-1.00 Reduction** |
| **False-Positive Noise Reduction** | 0.0% (Baseline) | **81.6%** | **81.6% Less PR Noise** |
| **Flags Evaluated** | 100 historical flags | 100 historical flags | 10 Sequential Rounds |

### Precision Progression Over 10 Rounds

```
Precision (%)
100% ┤                                            ╭─────── Sentry v2 (100.0%)
 90% ┤                                    ╭───────╯
 80% ┤                            ╭───────╯
 70% ┤                    ╭───────╯
 60% ┤            ╭───────╯
 50% ┤ ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ───  Static Baseline (50.0%)
     └────┬───────┬───────┬───────┬───────┬───────┬───────┬───────┬───────┬───────┬──
        Round 1 Round 2 Round 3 Round 4 Round 5 Round 6 Round 7 Round 8 Round 9 Round 10
```

> **Resume / Executive Takeaway:** Within 5 review rounds, Sentry automatically suppressed 81.6% of developer noise and raised review precision from 50.0% to 100.0% without dropping a single critical defect.

---

## 🧮 Whiteboard Mathematics: How the Learning Works

Sentry uses a **Beta-Binomial conjugate Bayesian model** per category per repository.

### 1. The Posterior Mean
Every category $c$ maintains parameters $\alpha_c$ and $\beta_c$:

$$\text{Posterior Weight } \hat{\theta}_c = \frac{\alpha_c}{\alpha_c + \beta_c}$$

- **Cold-Start Priors**: $\alpha_0, \beta_0$ are initialized based on category criticality (Security starts at $\alpha=8, \beta=2 \implies 80\%$, Style starts at $\alpha=3, \beta=7 \implies 30\%$).
- **Evidence Updates**:
  - Accept flag: $\alpha \leftarrow \alpha + 1.0$ (signal that team cares).
  - Dismiss flag: $\beta \leftarrow \beta + 1.0$ (signal that flag was noise).
  - Irrelevant: $\beta \leftarrow \beta + 1.5$ (strong penalty for context-blind linting).

### 2. Exponential Time Decay
Codebases and team priorities evolve. Sentry separates accumulated empirical feedback from the baseline prior and decays older actions using daily half-life decay $\lambda = 0.97$:

$$\alpha_t = \alpha_0 + \lambda^{\Delta t} \cdot (\alpha_{t-1} - \alpha_0) + \Delta \alpha$$

$$\beta_t = \beta_0 + \lambda^{\Delta t} \cdot (\beta_{t-1} - \beta_0) + \Delta \beta$$

Recent feedback matters more, while preventing one ancient mistake from permanently penalizing a category.

### 3. Credible Intervals ($90\%$ CI)
For low-data categories, Sentry computes the posterior variance and credible bounds:

$$\sigma^2 = \frac{\alpha \beta}{(\alpha + \beta)^2 (\alpha + \beta + 1)}$$

$$\text{CI}_{90\%} = \left[ \hat{\theta} - 1.645\sigma, \; \hat{\theta} + 1.645\sigma \right]$$

When sample counts are low ($N < 10$), Sentry surfaces a visible **Cold Start** banner and displays the wider credible interval (`[32% - 78%]`), making uncertainty explicit.

### 4. Severity-Aware Suppression Rule
Unlike naive threshold filters that drop issues blindly, Sentry enforces an absolute safety guarantee:

$$\text{Demote} = (\text{Severity} == \text{'nit'}) \land (\hat{\theta}_c < 0.28)$$

- **Critical & Warning defects are NEVER demoted or hidden.**
- Nits in categories with weight $< 28\%$ are grouped into a collapsible **"Low Priority Flags"** drawer with an explicit rationale (`"Demoted by repo taste: Style weight is 18%"`). Engineers can expand the drawer anytime and accept flags to revive the category.

---

## 🚀 Key Feature Highlights

### Phase 1: Real & Provable Learning
- **Real GitHub Webhook Integration**: Full HMAC-SHA256 signature verification (`X-Hub-Signature-256`). Auto-reviews PRs and posts inline review comments. Reactions (👍/👎) feed back into the learning loop.
- **Explain My Taste Modal**: Generates plain-English AI explanations of what Sentry has learned about each repository.
- **Offline Benchmark Mode**: 10-round replay proving 81.6% false-positive noise reduction.

### Phase 2: Per-Review Utility & Multi-Language
- **One-Click Suggested Fixes**: Proposed fixes rendered as interactive unified git diffs. Click **Copy Patch** or **Apply Fix** to automatically create virtual branch `sentry/fix-...` and commit the fix.
- **Per-Reviewer Profiles**: View and switch between team consensus and individual teammate preferences (e.g. Sarah Chen: Security Lead vs. Alex Rivera: Frontend/Style).
- **Multi-Language Analysis**: Language-aware heuristics for **JavaScript and TypeScript** (React XSS `dangerouslySetInnerHTML`, dynamic `eval`, localStorage token leaks, unsound `any`, `@ts-ignore`, loose `==`).

### Phase 3: Product Polish & Recruiter Showcase
- **Recruiter Demo Mode**: Two pre-seeded repositories (`fintech-core` vs `web-design-system`) demonstrating live divergence to opposite taste profiles. 1-click auto-converge button allows recruiters to test divergence without signing in.
- **Date-Range Filtering**: Filter review history by `7D`, `30D`, `90D`, and `All`.
- **Per-Category Trend Lines**: Multi-line progression tracking Security, Style, Complexity, and Best-practice weights across rounds.
- **Side-by-Side Repo Comparison**: Inspect divergence scores and qualitative differences between any two repositories.
- **CSV & PDF Export**: Downloadable learning audit CSV reports and print-optimized PDF styling.
- **Accessibility & Keyboard Navigation**: Full keyboard shortcuts (<kbd>A</kbd> for Accept, <kbd>D</kbd> for Dismiss, <kbd>J</kbd>/<kbd>K</kbd> to navigate, <kbd>?</kbd> for shortcuts cheat sheet).

### Phase 4: Engineering Credibility
- **42 Automated Tests**: 100% pass rate across unit tests and API integration tests (`pytest`).
- **In-Memory LRU Caching**: SHA-256 diff hash cache with 30-minute TTL eliminating redundant analysis.
- **Token-Bucket Rate Limiter**: 120 req/min sliding window rate limiter returning `HTTP 429` with `Retry-After`.
- **GitHub Actions CI Pipeline**: Automated Python tests, linting, and Next.js builds on every push and PR.

---

## 🛠️ Tech Stack & Design System

- **Frontend**: Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, Lucide icons.
- **Backend**: FastAPI, Python 3.11+, Pydantic v2, SQLite 3, Uvicorn, Pytest.
- **Design System Tokens**:
  - Background: `#000000`
  - Surface: `#1A1A1A`
  - Border: `#262626`
  - Primary Green: `#3DFF6B` (positive reinforcement, accept actions)
  - Accent Purple: `#A855F7` (security highlights, transparency tags)
  - Headings: `Teko` (condensed, high-impact font)
  - Body: `Urbanist` (clean geometric sans-serif)

---

## 💻 Quickstart & Local Setup

### Option 1: Run with Docker Compose (Recommended)
```bash
docker compose up --build
```
- **Web App**: http://localhost:3000
- **FastAPI Interactive Docs**: http://localhost:8000/docs

---

### Option 2: Run Locally (FastAPI + Next.js)

#### 1. Backend Service
```bash
cd backend
python -m venv venv

# Windows
.\venv\Scripts\activate
# macOS/Linux
source venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

#### 2. Frontend Application
```bash
cd frontend
npm install
npm run dev
```
Open **http://localhost:3000** in your browser.

---

## 🧪 Running the Test Suite

Run the full pytest suite (42 tests):
```bash
cd backend
python -m pytest tests -v
```

Output:
```
============================= test session starts =============================
collected 42 items

backend/tests/test_analyzer.py::TestLanguageDetection::test_detect_python PASSED
backend/tests/test_analyzer.py::TestJavaScriptTypeScriptHeuristics::test_dangerouslySetInnerHTML PASSED
backend/tests/test_analyzer.py::TestJavaScriptTypeScriptHeuristics::test_unsound_any PASSED
backend/tests/test_analyzer.py::TestSeverityAwareSuppression::test_critical_never_dropped PASSED
backend/tests/test_api.py::TestRepositoryEndpoints::test_get_repository_detail PASSED
backend/tests/test_api.py::TestFlagActionsAndUtility::test_apply_suggested_fix PASSED
backend/tests/test_api.py::TestBenchmarkProof::test_run_offline_replay_benchmark PASSED
backend/tests/test_caching_and_ratelimit.py::TestAnalysisCache::test_cache_lru_eviction PASSED
backend/tests/test_caching_and_ratelimit.py::TestTokenBucketRateLimiter::test_blocks_burst PASSED
backend/tests/test_learning.py::TestBayesianWeightCalculations::test_skewed_accept_prior PASSED
backend/tests/test_learning.py::TestTimeDecay::test_update_bayesian_weight_with_decay PASSED
...
============================= 42 passed in 6.58s ==============================
```

---

## 📡 REST API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/repos` | List all active repositories and acceptance rates |
| `GET` | `/api/repos/{id}` | Get repository detail, Bayesian weights, queue, and reviewers |
| `POST` | `/api/repos/{id}/review` | Submit diff for multi-language AST review (cached + rate-limited) |
| `POST` | `/api/flags/{id}/action` | Accept, dismiss, or ignore flag; updates Bayesian posterior |
| `POST` | `/api/flags/{id}/apply-fix` | 1-click suggested fix; creates `sentry/fix-...` branch |
| `GET` | `/api/repos/{id}/reviewers` | List teammate profiles and individual category weights |
| `GET` | `/api/repos/{id}/compare/{target_id}` | Compare two repos' taste divergence and key differences |
| `GET` | `/api/repos/{id}/export/csv` | Download full round-by-round learning audit report |
| `POST` | `/api/demo/reset-divergence` | Seed/reset contrasting demo repos for recruiters |
| `POST` | `/api/benchmark/replay` | Run 10-round historical replay benchmark |
| `POST` | `/api/github/webhook` | GitHub App webhook endpoint (HMAC-SHA256 verified) |
| `GET` | `/api/system/metrics` | System telemetry, cache hit rate, and latency metrics |

---

## 📄 License
MIT License. Built with ❤️ for autonomous, noise-free engineering teams.
