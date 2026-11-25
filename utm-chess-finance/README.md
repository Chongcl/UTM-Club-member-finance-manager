# ClubSync — Club Budget, Expense & Operations Portal

**Team Fun — AIROST 26/27 Project (Problem 1: _Club Budget and Expense Tracker_)**

ClubSync is a full-stack, **100% zero-API-cost** web application built to replace fragmented spreadsheets, paper receipts, and unstructured chat approvals with real-time club budget tracking, OCR-assisted receipt reimbursement claims, transparent two-stage audits, and unified club operations.

> **Live Vercel Demo URL:** `https://<your-vercel-deployment-url>.vercel.app` *(update with your deployed Vercel link)*

---

## Key Features

### 1. Authentication & Role-Based Access
- Email and password sign-up, login, and password recovery powered by **Supabase Auth**.
- PIN-protected Admin/Owner mode unlocking (`verify_role_passcode` PostgreSQL RPC) across **`member`**, **`treasurer`** (Admin), and **`owner`** roles.
- Granular per-admin permissions (`can_manage_activities`, `can_manage_finance`, `can_manage_claims_fees`, `can_manage_equipment`, `can_manage_transport`, `can_manage_posters_polls`, `can_manage_members`, `can_view_sensitive_profiles`, `can_manage_public_page`) plus a trigger-protected `public.users` role guard.

### 2. Unified Cashbook Ledger & Real-Time Budget Analytics
- Unified **Bank** & **Cash** running cashbook combining Opening Balances, manual Ledger `IN`/`OUT` entries, Verified Member & Guest Activity Fees, and Approved Claim disbursements.
- Optional **Per-Event Budget Caps (`budgets.allocated_amount`)** with color-coded health progress bars (`< 80%` Healthy, `80%–99%` Near Budget Limit, `>= 100%` Over Budget).
- Collapsible **Visual Spend Breakdown** panel (Spending by Category percentage bars + Income vs. Expense Cashflow Ratio Bar).
- Inline spreadsheet editing, Unpaid Fees tracking, and `.xlsx` multi-sheet Excel import/export with live formulas (**SheetJS `XLSX`**).

### 3. Multi-Receipt OCR Claims & Pre-Claims
- Drag-and-drop and live camera capture (`ReceiptDropzone.tsx`) with multi-receipt vertical JPG stitching and **100% browser-side OCR (`tesseract.js` + `receiptParser.ts`)** extracting merchant, date, total RM, category hints, and verification anomaly flags.
- **Live Remaining-Budget Preview** in both `ClaimFormModal.tsx` (`Current Remaining -> Projected Remaining After Claim`) and `AuditReviewModal.tsx` (`Remaining Before -> After Approving`).
- Automated fuzzy **Duplicate Claim Detection (`duplicateClaimDetector.ts`)**, configurable **Two-Stage Approval** (Treasurer verification + Owner final sign-off), and **Pre-Claim** cash advances with cap settlement.

### 4. Events, Public Registration & Equipment Loans
- Flexible activity formats (In-Person Events, Online Activities, Self-Paced Programs, and Fee Collections) with RSVPs, carpool/transport coordination, and **QR Entry Passes (`jsQR`)**.
- Shareable public guest registration pages (`/e/[slug]`) with receipt uploads, lookup codes, and status tracking.
- Club **Equipment Inventory & QR Borrowing** with stock counts, return dates, and admin approvals.

### 5. Live-Data Chatbot & Communication
- **Club Lounge**, **Direct Messages**, and **Member Directory** inside `FloatingChatDock.tsx`.
- **100% Rule-Based Portal Chatbot (`chatbotEngine.ts`)** bound directly to live Supabase state using exact Ledger math, Malaysian/campus synonym mapping, Levenshtein fuzzy matching, and strict Member financial privacy guards.
- **Admin Trainer Studio (`ChatbotTrainerModal.tsx`):** Manage custom Q&A rules (`chatbot_knowledge`), insert dynamic `{{...}}` placeholders, test live previews, and answer queries from the **Unanswered Questions Inbox**.

### 6. Network & State Resilience
- Persistent `NetworkStatusBanner.tsx` (offline warning, auto-sync reconnect banner, and retry action) across both the main portal and `/e/[slug]`.
- Loading skeletons (`loading.tsx`, `LoadingSkeletons.tsx`), React section `ErrorBoundary`, global `error.tsx`, custom `not-found.tsx` (404), **Supabase Realtime** live sync + budget alerts, and mobile-first PWA support (`manifest.ts`).

---

## Tech Stack
- **Frontend:** Next.js `^15.5.9` (App Router), React `^19.0.0`, TypeScript `^5`, Tailwind CSS `^4.0.9`, Lucide React (`^0.477.0`)
- **Backend & Database:** Supabase (`@supabase/supabase-js ^2.49.1` — PostgreSQL, Auth, Storage, Realtime, RPC, RLS)
- **Browser Processing:** `tesseract.js` (`^6.0.1`), SheetJS (`XLSX`), `jsQR`
- **Hosting & CI/CD:** Vercel & GitHub

---

## Prerequisites
- **Node.js** `v18+` or `v20+` and **npm**
- A free **Supabase** project

---

## Local Setup & Installation Steps

### Step 1: Clone the repository
```bash
git clone <repo-url>
cd utm-chess-finance
```

### Step 2: Install dependencies
```bash
npm install
```

### Step 3: Configure environment variables
Copy `.env.example` to `.env.local` and fill in your Supabase project credentials:
```bash
cp .env.example .env.local
```
Edit `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```
*(No external paid AI or LLM API keys are needed.)*

### Step 4: Database & Storage setup
Open your **Supabase Dashboard → SQL Editor → New Query** and configure the database and storage:
1. Run the base schema setup scripts (`supabase_phase1_flexible_activities.sql`, `supabase_change_email_rpc.sql`, `supabase_public_event_status_lookup.sql`) and chronological migrations inside `supabase/migrations/` (`20261121_*` through `2026_chatbot_knowledge.sql` and `2026_budget_realtime_polish.sql`).
2. Run `supabase/security_hardening.sql` to verify **Row-Level Security (RLS)** across all public tables, attach the role-escalation protection trigger (`trg_protect_user_role`), lock down `club_settings`, and protect the `receipts` storage bucket.
3. Ensure a storage bucket named **`receipts`** exists under **Supabase Dashboard → Storage** (the SQL policies allow receipt & QR uploads while blocking anonymous updates or deletions).

### Step 5: Run the development server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Build & Deployment Steps

### Production Build Check
```bash
npm run build
npm run start
```
Verify there are zero TypeScript or Next.js build errors before deploying.

### Vercel Deployment
1. Push your repository to **GitHub**.
2. Import the repository into **Vercel** (set **Root Directory** to `utm-chess-finance` if deploying from the outer folder).
3. Under **Project Settings → Environment Variables**, add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Click **Deploy**. Every subsequent push to `main` automatically triggers a new Vercel production build.

---

## Project Structure

```text
utm-chess-finance/
├── .env.example                       # Placeholder environment variables
├── package.json                       # Scripts & dependencies (next, react, supabase-js, tesseract.js)
├── src/
│   ├── app/
│   │   ├── e/[slug]/page.tsx          # Public guest event registration & QR pass lookup page
│   │   ├── error.tsx                  # Global client route error boundary
│   │   ├── globals.css                # Tailwind CSS v4 styles
│   │   ├── layout.tsx                 # Root App Router layout & metadata
│   │   ├── loading.tsx                # App Router transition loading UI
│   │   ├── manifest.ts                # Installable PWA web manifest
│   │   ├── not-found.tsx              # Branded 404 fallback page
│   │   └── page.tsx                   # Main portal entry point
│   ├── components/
│   │   ├── ActivityLogSection.tsx     # Audit trail & soft-delete restore console
│   │   ├── AuditReviewModal.tsx       # Claim review, 2-stage approval & live budget impact
│   │   ├── BudgetModal.tsx            # Activity/event creator with budget cap & fee tiers
│   │   ├── ChatbotTrainerModal.tsx    # Admin rule CRUD, variable picker & unanswered inbox
│   │   ├── CinematicHub.tsx           # Announcements carousel & interactive polls
│   │   ├── ClaimFormModal.tsx         # 3-step claim & pre-claim wizard with OCR & budget preview
│   │   ├── ClubSyncApp.tsx            # Core portal orchestrator & Supabase Realtime listener
│   │   ├── EquipmentSection.tsx       # Club inventory & borrowing management
│   │   ├── ErrorBoundary.tsx          # Per-section React Error Boundary
│   │   ├── EventOperationsModal.tsx   # RSVPs, carpool & QR attendance management
│   │   ├── FloatingChatDock.tsx       # Club Lounge, DMs, People directory & Portal Bot tab
│   │   ├── LedgerSection.tsx          # Unified cashbook, budget bars, spend analytics & Excel export
│   │   ├── LoadingSkeletons.tsx       # Dashboard, Ledger & Claims skeleton loaders
│   │   ├── MemberProfileModal.tsx     # Member summary modal
│   │   ├── MobileBottomNav.tsx        # Responsive bottom navigation bar
│   │   ├── Navbar.tsx                 # Top navigation, role switcher & drawer
│   │   ├── NetworkStatusBanner.tsx    # Offline/reconnecting & query retry banner
│   │   ├── NotificationBell.tsx       # Live reminders (loans, claims, 80%/100% budget alerts)
│   │   ├── PreClaimReviewModal.tsx    # Pre-claim approval & cash advance disbursement review
│   │   ├── ProfileSection.tsx         # Member profile, DuitNow QR & email/password updates
│   │   ├── PublicLandingEditorModal.tsx # Customizer for public landing page sections & FAQs
│   │   ├── PublicLandingPage.tsx      # Public club homepage & sign-in/register portal
│   │   ├── QrScannerModal.tsx         # Camera/image QR attendance & lookup scanner
│   │   ├── ReceiptDropzone.tsx        # Drag-and-drop/camera capture, JPG stitch & Tesseract OCR
│   │   └── RecordHistoryModal.tsx     # Field-level edit diff modal
│   └── lib/
│       ├── activityConfig.ts          # Activity format, schedule & fee-tier helpers
│       ├── chatbotEngine.ts           # Zero-cost rule-based chatbot engine & live data binder
│       ├── duplicateClaimDetector.ts  # Fuzzy duplicate receipt/claim matching
│       ├── equipment.ts               # Equipment normalization & approval helpers
│       ├── history.ts                 # Soft-delete & edit audit trail helpers
│       ├── memberLookup.ts            # Member matching across directory & profiles
│       ├── notifications.ts           # Live reminders builder (equipment, claims, budgets)
│       ├── publicLanding.ts           # Public landing page config defaults & types
│       ├── receiptParser.ts           # Deterministic Malaysian receipt parser & anomaly flags
│       ├── supabase.ts                # Supabase client & core TypeScript interfaces
│       └── whatsapp.ts                # WhatsApp helper utilities
└── supabase/
    ├── security_hardening.sql         # RLS enforcement, role trigger & storage hardening
    └── migrations/                    # Incremental SQL schema & Realtime migrations
```
