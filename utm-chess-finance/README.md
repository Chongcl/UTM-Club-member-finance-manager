# ClubSync — Campus Club Budget, Expense & Portal Tracker

A full-stack, zero-API-cost web application built with **Next.js 15 (App Router, TypeScript, Tailwind CSS v4)** and **Supabase (PostgreSQL, Auth, Storage & Realtime)**. Designed for **AIROST 26/27 Problem 1 (Club Budget and Expense Tracker)**, ClubSync replaces fragmented spreadsheets and paper receipts with real-time event budget controls, OCR-assisted claim workflows, transparent dual-stage audits, and unified club operations.

---

## Key Features

### 1. Authentication & Role-Based Access Control
- **Strict Role Separation:** New sign-ups register as **Members (`member`)** with Full Name, Matric No., and Phone Number.
- **Protected Admin / Owner Unlock:** **Treasurer (`treasurer`)** and **Owner (`owner`)** privileges are gated by Supabase Row-Level Security (RLS), granular per-admin permissions, and passcode verification via PostgreSQL `SECURITY DEFINER` RPCs.
- **Graceful Recovery & Profile Management:** Built-in password recovery, DuitNow QR & bank payout details, and self-service activity history.

### 2. Unified Cashbook Ledger & Real-Time Event Budget Tracking
- **Single Source of Truth:** Combines Opening Bank/Cash balances, manual Ledger `IN`/`OUT` entries, Verified Member & Guest Activity Fees, and Approved Claim disbursements (Bank vs. Cash breakdown).
- **Per-Activity Budget Caps (`budgets.allocated_amount`):** Configure an optional RM spending cap per activity and monitor **Allocated**, **Approved Spent**, **Pending Claims**, and **Actual Remaining** funds in the Ledger **By Activity** view.
- **Health Progress Bars:** Automatic utilization indicators:
  - **Healthy (`< 80%`)** — Emerald
  - **Near Budget Limit (`80% – 99%`)** — Amber
  - **Over Budget (`≥ 100%`)** — Red
- **Unpaid Fees & Multi-Sheet Excel Export:** Track pending receivables and export multi-sheet `.xlsx` audit reports cleanly.

### 3. Multi-Receipt Local OCR Claims & Pre-Claims
- **100% Client-Side OCR (`Tesseract.js` + `receiptParser.ts`):** Automatically extracts **Merchant**, **Date**, **Total RM**, suggested expense category, and deterministic verification flags (e.g., low OCR confidence, missing date/total, future date) directly in the browser with zero external API keys or quotas.
- **Multi-Receipt Stitching & Itemized Breakdown:** Snap or upload multiple receipts, stitch them cleanly into a single compressed JPG in Supabase Storage, and itemize shop lines inside **Submit Claim**.
- **Pre-Claims & Cash Advances:** Request spending approval or cash advance before purchasing, then settle against an approved Pre-Claim cap with balance return/top-up calculation.
- **Live Budget Impact Preview:** Shows `Current Remaining Budget → Projected Remaining After This Claim` inside both **Submit Claim** and **Audit Review** before submission or approval.

### 4. Duplicate Claim Detection & Two-Stage Audit
- **Fuzzy Duplicate Detector (`duplicateClaimDetector.ts`):** Flags matching amounts, dates, merchants, file names, or OCR text with side-by-side comparison before submission or approval.
- **Configurable Two-Stage Approval:** Claims above the club threshold require Stage 1 Treasurer verification followed by Stage 2 President/Owner sign-off, complete with payout proof uploads and immutable `activity_logs` edit history.

### 5. Supabase Realtime Sync & Live Threshold Alerts
- **Live Channel (`clubsync-live`):** Subscribes to `claims`, `pre_claims`, `budgets`, and `ledger_entries` with 400ms debounced scoped refreshes.
- **Dynamic In-App Toast Alerts:** Notifies Treasurers/Owners immediately when new claims arrive, notifies claimants upon approval/rejection, and alerts when an activity crosses **80%** or **100%** of its allocated budget cap.

### 6. Live-Data Rule-Based Portal Bot & Admin Trainer
- **Zero-Cost Intelligence (`chatbotEngine.ts`):** Computes real-time financial metrics directly from live Supabase state using exact Ledger math, Malaysian/campus synonym mapping, stop-word filtering, and Levenshtein fuzzy matching.
- **Admin "Train Bot" Studio (`ChatbotTrainerModal.tsx`):** Manage custom Q&A rules with clickable dynamic placeholders (`{{club_balance}}`, `{{bank_balance}}`, `{{upcoming_events_list}}`, etc.), test replies against live state, seed a 5-rule Starter Pack, and train answers directly from the **Unanswered Questions Inbox**.
- **Strict Privacy Guard:** Automatically blocks regular members from querying club-wide treasury balances or other members' financial data.

### 7. Network Resilience & Mobile-First UX
- **Offline & Error Recovery:** Persistent online/offline reconnection banner (`NetworkStatusBanner`), per-section React `ErrorBoundary`, and skeleton loaders (`LoadingSkeletons`).
- **Mobile & Tablet Polished:** Installable PWA manifest, Mobile Bottom Navigation Bar, responsive stacked mobile transaction cards, and touch-safe drawers.

---

## Tech Stack
- **Framework:** Next.js 15 (`^15.5.9`, App Router), React 19, TypeScript 5
- **Styling:** Tailwind CSS v4 (`@tailwindcss/postcss`), `lucide-react`
- **Backend:** Supabase (`@supabase/supabase-js` — PostgreSQL, Auth, Storage, Realtime, RLS)
- **Browser OCR:** `tesseract.js` (`^6.0.1`) + HTML5 Canvas receipt pre-processing & stitching

---

## Local Setup & Build Instructions

### 1. Install Dependencies
```bash
git clone <your-github-repo-url>
cd utm-chess-finance
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env.local` and fill in your Supabase project credentials:
```bash
cp .env.example .env.local
```
Required variables in `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```
*(No external AI or LLM API keys are needed.)*

### 3. Run Database Migrations in Supabase
Open your **Supabase Dashboard → SQL Editor → New Query** and run the SQL scripts in order:
1. Run your base schema setup and `supabase_phase1_flexible_activities.sql` (if upgrading an existing database).
2. Run `supabase/migrations/2026_chatbot_knowledge.sql` (creates `chatbot_knowledge`, `chatbot_unanswered_queries`, RLS policies, and `log_chatbot_unanswered_query` RPC).
3. Run `supabase/migrations/2026_budget_realtime_polish.sql` (ensures `budgets.allocated_amount` defaults to `0` and enables `supabase_realtime` publication on `claims`, `pre_claims`, `budgets`, and `ledger_entries`).

### 4. Start Local Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Verify Production Build
```bash
npx tsc --noEmit
npm run build
```

---

## Deploying to Vercel
1. Push your repository to GitHub.
2. Import the project in **Vercel** and set the **Root Directory** to `utm-chess-finance` (if deploying from the monorepo root).
3. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` under **Project Settings → Environment Variables**.
4. Deploy — Vercel builds the Next.js App Router production bundle automatically on every push to `main`.
