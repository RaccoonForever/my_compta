# 💰 Personal Cash-Flow Accountability App

A minimalist, ergonomic web app to track **incoming/outgoing cash**, **where it sits** (banks, wallets, envelopes), **what it’s for** (categories), and **how it will evolve** (forecast). Built for single‑user personal finance.

---

## 🚀 Product Goals

- Instant clarity on current and projected cash position
- Map money by **accounts/locations** (banks, wallets, envelopes)
- Categorize **inflows and outflows** (income sources, taxes, credit, etc.)
- Make **data entry effortless** (quick add, autocomplete, recurring)
- Provide **annual earnings** and **category analytics**
- Keep the UI **fast, clean, and distraction‑free**

---

## 🧭 Core Navigation

- **Dashboard** – snapshot, forecast, balances, alerts
- **Accounts** – balances by bank/wallet/envelope, transfers
- **Transactions** – list, filters, add, edit, recurring
- **Analytics** – earnings per year, category spend, trends
- **Settings** – categories, accounts, recurring templates

---

## ✅ Feature TODO (MVP → v1.0)

### 1) Dashboard
- [ ] Show **Total Current Cash** (all accounts, multi-currency with base)
- [ ] Show **End-of-Month Projected Cash**
- [ ] Show **Month-to-Date Income / Expenses**
- [ ] **Cashflow Forecast** (30–90 days; include recurring + planned)
- [ ] **Accounts Overview** cards (click → account detail)
- [ ] **Category Breakdown** (pie / horizontal bars)
- [ ] **Alerts** (e.g., “tax payment in 7 days”, “unusual spend”)

### 2) Accounts
- [ ] Accounts list with balances, currency, and last update
- [ ] Account detail: last transactions, mini chart, filters
- [ ] Support **manual** accounts (bank, wallet, envelope, crypto)
- [ ] **Transfer between accounts** (internal, non-categorized)
- [ ] Optional **sub-accounts** / envelopes within an account

### 3) Transactions
- [ ] Transactions table with filters (date, account, category, type)
- [ ] Quick **Add Transaction** modal
  - [ ] Fields: amount, type (income/expense/transfer), date, category, account, notes
  - [ ] **Recurring?** toggle with schedule (daily/weekly/monthly/custom)
  - [ ] **Autocomplete** templates by label (e.g., typing “rent” suggests amount/category/recurrence)
- [ ] Edit / delete transactions
- [ ] Import CSV (future: bank exports)
- [ ] Bulk edit (select + change category/account)

### 4) Recurring Engine
- [ ] Define recurring templates (salary, rent, taxes, subscriptions)
- [ ] Generate upcoming instances into forecast
- [ ] Option: auto-post actual transaction on due date
- [ ] Handle exceptions (skip / pause / amount override)

### 5) Categories
- [ ] Category manager (create, edit, archive)
- [ ] Hierarchy: **Income** / **Expense** roots with custom children
- [ ] Default set (Housing, Taxes, Credit repayment, Subscriptions, Leisure, Transport, etc.)
- [ ] Category colors and icons (optional)

### 6) Analytics & Reporting
- [ ] **Yearly earnings**: total per year + monthly bars
- [ ] **Expenses by category**: monthly & yearly breakdown
- [ ] **Net cashflow over time** (inflow vs outflow vs net)
- [ ] Compare periods (this month vs last; this year vs last)
- [ ] Simple **custom report** filters (e.g., “Taxes in 2025”)
- [ ] Export CSV/PDF of reports (PDF optional for v1)

### 7) Forecasting
- [ ] Project cash balance by day/week for next 30–90 days
- [ ] Include recurring items + planned one‑offs
- [ ] Visual line/area chart with markers (salary, rent, taxes)

### 8) Input Ergonomics
- [ ] Global **“+ Add”** button accessible from all pages
- [ ] Keyboard-first modal, smart defaults (date=today, last account)
- [ ] Stopwatch‑style speed: add a transaction in **< 5 seconds**
- [ ] Quick “repeat last” action
- [ ] Smart suggestions: category, amount, recurrence from label history

### 9) Settings
- [ ] Base currency + currency conversion rules (manual rates)
- [ ] Manage accounts (type, currency, ordering, hide from totals)
- [ ] Manage categories and recurring templates
- [ ] Data export / import (JSON/CSV)
- [ ] Privacy mode (blur amounts on UI toggle)

---

## 🧑‍🤝‍🧑 User Stories & Acceptance Criteria

### Dashboard
- **As a user**, I want to see my **current** and **end‑of‑month projected** cash, so I know if I’m safe.
  - **AC**: Shows Total Cash (base currency), and Projected EOM using recurring items and planned transactions.
- **As a user**, I want to see a **forecast timeline**, so I can anticipate lows.

### Accounts
- **As a user**, I want to split money across multiple **accounts/locations**, so I know where money is.
  - **AC**: Create/manual accounts with currency; balances aggregate to Total Cash (base conversion).

### Transactions
- **As a user**, I want to **quickly add** income/expense with minimal fields.
  - **AC**: Modal with amount, type, date, category, account; default date=today.
- **As a user**, I want to mark a transaction as **recurring**.
  - **AC**: Schedule options (daily/weekly/monthly/custom); visible in upcoming forecast.
- **As a user**, I want **autocomplete** when typing a label.
  - **AC**: Suggests last used amount/category/recurrence by label text.

### Categories
- **As a user**, I want to categorize outflows (taxes, credit), so I can analyze spend.
  - **AC**: Categories editable; expenses must be assigned

### Analytics
- **As a user**, I want to know **how much I earned per calendar year**.
  - **AC**: Earnings report by year with monthly breakdown; supports filters by account/category.
- **As a user**, I want to view **expenses by category** and trends.
  - **AC**: Pie/stacked bars with period selector; comparison vs previous period.

### Forecasting
- **As a user**, I want to see **expected cash in the next 30–90 days**.
  - **AC**: Forecast uses current balance + scheduled recurring + dated future transactions.

---

## 🛠️ Non‑Functional Requirements (MVP)

- **Performance**: Add transaction in < 200 ms UI response; dashboard load < 1.5s with 5k tx
- **Data**: Local-first (browser storage) optional; exportable JSON/CSV
- **Reliability**: No duplicate instances for recurring; idempotent transfer links
- **Usability**: Keyboard navigable; accessible (WCAG AA basics)
- **Privacy**: No external analytics; optional blur mode for screen sharing

---

## 🧩 Data Model (Conceptual)

- **Account**: `{ id, name, type, currency, balance, archived }`
- **Transaction**: `{ id, date, amount, type: 'income'|'expense', accountId, categoryId?, note, label }`
- **Category**: `{ id, name, kind: 'income'|'expense', color? }`
- **RecurringTemplate**: `{ id, label, amount, type, categoryId?, accountId, schedule: { frequency, interval, byDay?, byMonthDay? }, nextRunDate, status }`
- **Settings**: `{ baseCurrency, currencies, privacyMode }`

---
## 🧭 Design Principles

- Minimalist UI; fast interactions; clear typography
- Global “+ Add” always visible
- Charts readable with neutral colors and high contrast
- Amounts in large numerals; secondary info muted

