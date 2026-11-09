# ClubSync Finance — Campus Club Budget & Expense Tracker

A full-stack, real-time web application built with **Next.js (TypeScript & Tailwind CSS)** and **Supabase (PostgreSQL, Auth & Storage)** that streamlines how university club members log out-of-pocket expenses with digital receipts and how club treasurers manage event allocations and review reimbursement requests in real time.

---

## Key Features
1. **Strict Role-Based Access & Protected Treasurer Portal:**
   - Every new user registers strictly as a **Club Member (`member`)** with their Full Name, Matric No., and Phone Number.
   - To prevent unauthorized students from approving claims, **Treasurer Mode (`treasurer`)** is protected by a server-verified **Advisor Authorization PIN (`EXEC-2026`)** validated via a PostgreSQL `SECURITY DEFINER` RPC function.
2. **Interactive Drag-and-Drop Receipt Upload & Cloud Storage:**
   - Students upload JPG, PNG, WEBP, or PDF receipts directly to Supabase Storage (`receipts` bucket).
3. **Bonus AI Feature — Neural OCR Receipt Scanner (`Tesseract.js`):**
   - Automatically scans uploaded receipt images in the browser to extract the **Merchant Name**, **Date**, and **Total RM Amount**, auto-filling the claim form.
4. **Real-Time Event Budget Tracking & Automated PostgreSQL Triggers:**
   - Approving a claim automatically triggers a PostgreSQL function (`recalculate_budget_spent`) that updates the event's spent balance and live progress bar in real time.
5. **Direct WhatsApp Student Contact & 1-Click Audit CSV Export:**
   - Treasurers can inspect receipts, contact claimants via their registered Phone Number on WhatsApp, and export the entire financial ledger to CSV for university audit submission.

---

## Local Setup & Build Instructions

### 1. Clone & Install Dependencies
```bash
git clone <your-github-repo-url>
cd utm-chess-finance
npm install