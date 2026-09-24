# Sentry — Self-Learning Code Review Agent

[![Stack](https://img.shields.io/badge/Frontend-Next.js%20%7C%20TailwindCSS-black?style=flat-square)](https://nextjs.org/)
[![Backend](https://img.shields.io/badge/Backend-FastAPI%20%7C%20Python-3dff6b?style=flat-square&logoColor=black)](https://fastapi.tiangolo.com/)
[![Database](https://img.shields.io/badge/Storage-SQLite-a855f7?style=flat-square)](https://sqlite.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue?style=flat-square)](https://docker.com)

**Sentry** is an adaptive, self-learning AI code review agent. Unlike static linters that enforce rigid rules uniformly across all codebases, Sentry **learns what categories of issues matter to each specific repository** based on human `Accept`, `Dismiss`, and `Not Relevant` feedback.

---

## ⚡ Core Concept & Adaptive Mechanism

Every time an engineer accepts or dismisses a flag, Sentry updates an isolated, per-repository **Bayesian Beta-Binomial weight model**:

$$\text{Posterior Weight} = \frac{\alpha}{\alpha + \beta}$$

- **Cold-Start Priors**: Defined per category before any feedback exists (Security starts high at 80%, Style starts low at 30%).
- **Accept Action**: Increments $\alpha \leftarrow \alpha + 1.0$. Evidence that the team cares about this issue.
- **Dismiss Action**: Increments $\beta \leftarrow \beta + 1.0$. Evidence that the flag is noise for this repo.
- **Not Relevant Action**: Increments $\beta \leftarrow \beta + 1.5$. Strong signal of irrelevance.
- **Noise Suppression**: When a category's weight drops below the suppression threshold ($< 28\%$), non-critical warnings in that category are automatically suppressed to keep PR reviews noise-free.

---

## 🎨 Design System

Faithfully implemented from the provided [design.html](file:///c:/Users/Asus/Documents/sentry/design.html):

| Token | Value | Purpose |
|---|---|---|
| **Background** | `#000000` | Deep dark mode background |
| **Surface** | `#1A1A1A` | Cards, panels, elevated surfaces |
| **Border** | `#262626` | Card borders and dividers |
| **Primary** | `#3DFF6B` | Accent green — accept actions, positive learning signals |
| **Accent** | `#A855F7` | Accent purple — security tags, badges, secondary actions |
| **Muted** | `#8F8F8F` | Labels, subtitles, secondary metadata |
| **Headings** | **Teko** (Google Fonts) | Bold, condensed, high-impact typography |
| **Body / UI** | **Urbanist** (Google Fonts) | Clean, geometric sans-serif |

### Tasteful Micro-Animations
- **Card Entrance**: Staggered `@keyframes rise` (`.stat-card` reveals sequentially).
- **Chart Curve**: `@keyframes draw` line animation tracing the upward acceptance curve on load.
- **Weight Bars**: Animated `@keyframes grow` and CSS transition width shifts whenever feedback is recorded.
- **Accept Action**: Quick green pulse and checkmark animation before collapsing.
- **Dismiss Action**: Smooth fade-out and slide-right transition.

---

## 📁 Repository Structure

```
sentry/
├── backend/                  # FastAPI backend service
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py           # REST endpoints, CORS, lifespan
│   │   ├── database.py       # SQLite schema & persistence
│   │   ├── learning.py       # Bayesian Beta-Binomial engine & "Explain my taste"
│   │   ├── analyzer.py       # Static AST & pattern analysis + LLM refinement
│   │   ├── seed_data.py      # Pre-seeds api-gateway, design-system & payment-service
│   │   └── models.py         # Pydantic schemas
│   ├── Dockerfile
│   ├── requirements.txt
│   └── .env.example
├── frontend/                 # Next.js 14 + Tailwind CSS application
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx    # Teko & Urbanist fonts, metadata
│   │   │   ├── page.tsx      # Main application page & state coordinator
│   │   │   └── globals.css   # design.html styles, variables & animations
│   │   ├── components/
│   │   │   ├── Header.tsx
│   │   │   ├── DashboardView.tsx   # Direct realization of design.html with live state
│   │   │   ├── ReviewView.tsx      # GitHub-PR-style diff review & agent comments
│   │   │   ├── ReposView.tsx       # Profile comparisons across repos
│   │   │   ├── SettingsView.tsx    # LLM keys & learning parameters
│   │   │   ├── AcceptanceChart.tsx # Animated SVG acceptance curve
│   │   │   ├── CategoryWeightBars.tsx # Animated Bayesian progress bars
│   │   │   └── ExplainTasteModal.tsx # "Explain my taste" AI synthesis modal
│   │   └── lib/
│   │       ├── api.ts              # API client with resilient offline fallbacks
│   │       ├── types.ts            # TypeScript interfaces
│   │       └── sampleDiffs.ts      # Pre-configured test PR diffs
│   ├── Dockerfile
│   ├── package.json
│   ├── tailwind.config.js
│   └── tsconfig.json
├── docker-compose.yml        # Multi-container orchestration
├── sentry-interactive.html   # Standalone zero-install browser-runnable preview
├── design.html               # Reference design specification
└── README.md
```

---

## 🚀 How to Run the Project

You can run Sentry in any of the three modes below:

### Option 1: Instant Browser Preview (Zero Installation)
If you want to view and interact with the application immediately:
1. Double-click or open [sentry-interactive.html](file:///c:/Users/Asus/Documents/sentry/sentry-interactive.html) in your browser (Chrome, Edge, Firefox, Brave).
2. It includes the complete UI matching `design.html`, interactive tabs, live Bayesian weight recalculation on Accept/Dismiss, animated SVG charts, sample diffs, and the "Explain my taste" modal!

---

### Option 2: Run via Docker Compose (Recommended)
Make sure Docker Desktop is installed and running:

```powershell
# In the repository root:
docker compose up --build
```

- **Frontend**: http://localhost:3000
- **Backend API & Swagger Docs**: http://localhost:8000/docs

---

### Option 3: Run Locally (FastAPI + Next.js)

#### 1. Start the Backend (FastAPI):
```powershell
# Open terminal in the backend directory:
cd backend

# Create virtual environment (optional but recommended):
python -m venv venv
.\venv\Scripts\activate

# Install dependencies:
pip install -r requirements.txt

# Run the API server:
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
*The database (`sentry.db`) is automatically initialized and pre-seeded with `api-gateway`, `design-system`, and `payment-service`.*

#### 2. Start the Frontend (Next.js):
```powershell
# Open a second terminal in the frontend directory:
cd frontend

# Install npm dependencies:
npm install

# Run the Next.js development server:
npm run dev
```

Visit **http://localhost:3000** in your browser.

---

## 🎯 Demo Walkthrough

### 1. Two Repos Converged to Opposite Learned Profiles
- **`api-gateway` (Backend)**:
  - Top category: **Security (88%)** and **Complexity (64%)**.
  - **Style (22%)** has been repeatedly dismissed and is suppressed.
  - Acceptance rate: **78%** ($\uparrow$ 34% since round 1).
- **`design-system` (UI / Frontend)**:
  - Top category: **Style (91%)** and **Duplication (82%)**.
  - **Complexity (38%)** is lower priority.
  - Acceptance rate: **86%** ($\uparrow$ 48% since round 1).
- **`payment-service` (Cold Start)**:
  - Starts with neutral baseline cold-start heuristics for demonstration.

### 2. Live Feedback Loop
1. In the **Dashboard** queue, click **Accept** on any card.
2. Watch the card pulse green, the category progress bar animate to its updated percentage, and the acceptance rate recalculate in real time.
3. Click **Dismiss** on a style issue to watch Sentry actively down-weight style flags for that repository.

### 3. "Explain My Taste"
- Click the **"Ask agent: Explain my taste"** button in the header or category weights card.
- Sentry returns a plain-English synthesis explaining what the team values (e.g. *"This repo has learned to prioritize security (88%) and complexity (64%) issues — style nits are surfaced rarely."*) along with data-backed observations.

### 4. Code Review Flow (PR-Style Diff View)
1. Navigate to the **Review** tab in the header.
2. Choose one of the pre-loaded sample diffs (or paste your own Git diff).
3. Click **Review Code Diff** — Sentry parses the hunks, runs AST static checks, applies repo weights, and renders inline comment cards with proposed code fixes.
4. Toggle **Learned Suppression Active** to see how Sentry filters out low-weight noise for that repository.
