# Smart Kirana - Store Management System (స్మార్ట్ కిరాణా)

[![Status](https://img.shields.io/badge/status-production--ready-emerald)](https://github.com/VookaKavyaSuma/Smart-Kirana-General-Store-Management-)
[![Tests](https://img.shields.io/badge/tests-137%20passing-brightgreen)](https://github.com/VookaKavyaSuma/Smart-Kirana-General-Store-Management-)
[![PWA](https://img.shields.io/badge/PWA-installable-blue)](https://github.com/VookaKavyaSuma/Smart-Kirana-General-Store-Management-)
[![Bilingual](https://img.shields.io/badge/languages-English%20%7C%20Telugu-orange)](https://github.com/VookaKavyaSuma/Smart-Kirana-General-Store-Management-)

A modern, fast, bilingual (English & Telugu) web and mobile application designed specifically for Indian Kirana and General Store owners to manage inventory, wholesale purchases, customer credit/debts, daily online UPI transactions, and automated bill reading with AI OCR.

---

## 🌟 Key Features

1. **Authentication & Multi-Device Sessions (FR-1)**
   - Registration with automatic lowercase username derivation from shop name (e.g., "Sri Lakshmi Store" $\to$ `srilakshmistores`).
   - Case-insensitive login (`SRILAKSHMISTORES` or `srilakshmistores`).
   - Multi-device active concurrent sessions that never log out unexpectedly.
   - OTP password reset and single-device or all-device logout.

2. **Items & Suppliers Management (FR-2, FR-3)**
   - Automatic supplier filing when adding new items.
   - Live profit per unit and margin percentage calculations.
   - In-browser image compression (target $\le$ 800px, $\le$ 300KB) for instant photo uploads.
   - Low-stock visual alerts and configurable thresholds.

3. **Purchases & Live Unit Conversion (FR-4, FR-5)**
   - Multi-item purchase entry saving historical cost and selling prices.
   - Automatic inventory addition and recalculation upon purchase edit/delete.
   - Live 2-way weight and volume conversion ($\text{kg} \leftrightarrow \text{g}$, $\text{L} \leftrightarrow \text{ml}$) with ready-made price charts (1 kg, 500 g, 250 g, 100 g, and ₹5, ₹10, ₹20, ₹50, ₹100 weights).

4. **Bill Upload & OCR Review (FR-6)**
   - Upload shop bills or online screenshots/PDFs up to 10 MB.
   - Secure private storage with short-lived HMAC signed access links.
   - Vision AI (Gemini / OpenAI) with offline Tesseract OCR fallback for Telugu and English.
   - Side-by-side bill image inspection and editable line-item review before committing to stock.

5. **Fast Fuzzy Search & Voice Commands (FR-7)**
   - Global debounced search powered by PostgreSQL `pg_trgm` index ($< 300\text{ ms}$ for 10,000 items).
   - Frequency-ordered search suggestions that remember previous searches.
   - Web Speech API voice input and text-to-speech feedback in Telugu (`te-IN`) and Indian English (`en-IN`).

6. **Customer Credit & Debt Ledger (FR-10)**
   - Customer account ledger with items taken, dates, and balance due.
   - Prevents credit sales exceeding available stock; restores stock if an entry is deleted.
   - Partial cash and online repayments with automatic credit reconciliation.

7. **Daily Online Payments & Supplier Cash Flow (FR-11)**
   - Daily total online entry with automatic discrepancy alerts against individual transactions.
   - Supplier payments tracking with overdraft warning if payments exceed available online balance.
   - Day-by-day running ledger and monthly totals with CSV export.

8. **Reports & Profit Analytics (FR-8)**
   - 8-metric financial dashboard: Overall cost, total items, stock value, expected profit, earned profit, credit due, and remaining online balance.
   - Month-over-Month profit comparisons.
   - Interactive Recharts data visualizations and one-click PDF/CSV reports.

9. **AI Suggestions & Smart Restocking (FR-9)**
   - Centralized scoring engine: $0.4 \times \text{margin} + 0.4 \times \text{profit} + 0.2 \times \text{velocity}$.
   - 3 actionable lists: Items worth buying more of, Fast-selling running low, and Low-profit/slow items to review.
   - Automatic identification of cheapest wholesale supplier.

10. **Progressive Web App (PWA) & Security (FR-12)**
    - Installable on mobile phones (Android/iOS) and desktop browsers with offline shell caching.
    - Rate-limited login and OTP endpoints (`express-rate-limit`).
    - Helmet security headers and strict multi-tenant isolation.

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 19, Vite 6, Tailwind CSS 4, Lucide React, Recharts, PWA (Service Worker + Manifest) |
| **Backend** | Node.js, Express, TypeScript, Multer, Helmet, Express-Rate-Limit |
| **Database** | PostgreSQL 14+, Prisma ORM 6, `pg_trgm` extension |
| **AI / OCR** | Google Gemini Vision API / OpenAI Vision API, Tesseract.js (Offline Fallback) |
| **Testing** | Vitest (Backend Unit & Security), Playwright (End-to-End E2E) |
| **Deployment**| Vercel / Netlify (Frontend), Render / Railway (Backend), Supabase / Neon (Database) |

---

## 🚀 Local Setup & Installation

### Prerequisites
- [Node.js](https://nodejs.org/) (v18.0.0 or higher)
- [PostgreSQL](https://www.postgresql.org/) (v14 or higher) or a free managed DB (Supabase / Neon)
- [Git](https://git-scm.com/)

### 1. Clone the Repository
```bash
git clone https://github.com/VookaKavyaSuma/Smart-Kirana-General-Store-Management-.git
cd Smart-Kirana-General-Store-Management-
```

### 2. Install Dependencies
```bash
# Install root, backend, and frontend dependencies
npm install
npm --prefix backend install
npm --prefix frontend install
```

### 3. Configure Environment Variables
Create `.env` inside `backend/`:
```bash
cp backend/.env.example backend/.env
```
Edit `backend/.env` with your database credentials:
```env
PORT=5000
NODE_ENV=development
DATABASE_URL="postgresql://postgres:password@localhost:5432/kirana_db?schema=public"
FRONTEND_URL="http://localhost:5173"
SESSION_SECRET="your-super-secret-key-at-least-32-chars"
BILL_SIGN_SECRET="your-bill-signing-secret"
VISION_API_PROVIDER="gemini"
VISION_API_KEY=""
```

Create `.env` inside `frontend/` (optional for local dev):
```bash
cp frontend/.env.example frontend/.env
```

### 4. Push Database Schema
```bash
npm run prisma:push
```

### 5. Start Development Servers
Run backend and frontend concurrently in separate terminals:

**Terminal 1 (Backend API):**
```bash
npm run dev:backend
# API running at http://localhost:5000
```

**Terminal 2 (Frontend App):**
```bash
npm run dev:frontend
# App accessible at http://localhost:5173
```

---

## 🧪 Testing Suite

### Run All Backend Unit & Integration Tests (137 tests across 20 suites)
```bash
npm test
```

### Run Multi-Tenant Store Data Isolation Security Tests
```bash
npm --prefix backend test src/routes/store-isolation.security.test.ts
```

### Run 10,000 Item Search Benchmark Test (< 300 ms target)
```bash
npm --prefix backend test src/services/search-performance.test.ts
```

### Run Playwright End-to-End (E2E) Browser Tests
```bash
npx playwright test
```

---

## 🌐 Production Deployment Guide

### A. Deploy Frontend on Vercel
1. Log into [Vercel](https://vercel.com/) and click **Add New Project**.
2. Import the `Smart-Kirana-General-Store-Management-` repository.
3. Configure the Project:
   - **Framework Preset**: Vite
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Add Environment Variable:
   - `VITE_API_BASE_URL`: `https://your-backend-api.onrender.com/api/v1`
5. Click **Deploy**. Vercel will automatically configure SPA redirects via `frontend/vercel.json`.

### B. Deploy Backend on Render
1. Log into [Render](https://render.com/) and click **New Web Service**.
2. Connect your GitHub repository.
3. Configure the Service:
   - **Root Directory**: `backend`
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npm run prisma:generate && npm run build`
   - **Start Command**: `npm run start`
4. Add Environment Variables:
   - `NODE_ENV`: `production`
   - `PORT`: `5000`
   - `DATABASE_URL`: `your_managed_postgres_url`
   - `FRONTEND_URL`: `https://your-store.vercel.app`
   - `SESSION_SECRET`: *Generate a random 32-character string*
   - `BILL_SIGN_SECRET`: *Generate a random 32-character string*
   - `VISION_API_PROVIDER`: `gemini`
   - `VISION_API_KEY`: *Your Google Gemini API Key*
5. Click **Create Web Service**.

### C. Automated Database Backups
- **Linux/macOS/Cron**: Use `scripts/db-backup.sh`
  ```bash
  # Run daily at 2:00 AM
  0 2 * * * /path/to/scripts/db-backup.sh >> /var/log/kirana_backup.log 2>&1
  ```
- **Windows Task Scheduler**: Use `scripts\db-backup.ps1`
  ```powershell
  powershell -ExecutionPolicy Bypass -File .\scripts\db-backup.ps1
  ```

---

## 📋 Final Manual Checklist

Before launching your store management system into active daily production, complete the following manual setup items:

- [ ] **1. Cloud Accounts & Hosting**
  - [ ] Create account on [Vercel](https://vercel.com/) (Frontend)
  - [ ] Create account on [Render](https://render.com/) or [Railway](https://railway.app/) (Backend)
  - [ ] Create PostgreSQL database on [Supabase](https://supabase.com/) or [Neon](https://neon.tech/)
- [ ] **2. Domain & DNS Records**
  - [ ] Register your custom domain (e.g. `smartkirana.in` on GoDaddy, Namecheap, or Cloudflare)
  - [ ] Point CNAME record `app.smartkirana.in` $\to$ `cname.vercel-dns.com`
  - [ ] Point CNAME record `api.smartkirana.in` $\to$ Render / Railway hostname
- [ ] **3. SMS Gateway & DLT Registration (For Production SMS)**
  - [ ] Register entity on India TRAI DLT Portal (e.g., Vilpower / Jio DLT / Airtel DLT)
  - [ ] Submit Header ID (e.g., `SMTKRN`) and SMS OTP Template
  - [ ] Create account with SMS provider (e.g., Fast2SMS, Twilio, or MSG91) and link API keys
- [ ] **4. AI Vision API Key**
  - [ ] Obtain a Google Gemini API Key from [Google AI Studio](https://aistudio.google.com/) for automatic bill reading and OCR extraction
  - [ ] Set `VISION_API_KEY` in Render / Railway environment variables
- [ ] **5. SSL Certificates & Security**
  - [ ] Ensure HTTPS is enforced on both frontend and backend
  - [ ] Set `secure: true` on cookies in production
  - [ ] Enable daily automated PostgreSQL backups via Render/Supabase or cron job
