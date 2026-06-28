# 📦 Project Context — Tech Parks Analyzer

> ⚠️ This file is for AI reference only. It is listed in `.gitignore` and will NOT be committed to GitHub.
> Paste this file into ChatGPT, Claude, Codex, or any AI platform to give full project context instantly.

---

## 🧠 Project Overview

- **Project Name:** Tech Parks Analyzer V2
- **Purpose:** A full-stack SaaS platform to discover, manage, and analyze tech parks and coworking spaces across India. Admins can track listings, manage contacts, view state/city-level analytics, monitor funding news, and control user access via role-based permissions.
- **Current Status:** In Development / Production
- **Owner / Developer:** Ganesh Sabale (ganesh.s@mygupio.com)
- **Last Updated:** 2026-04-27

---

## 🗂️ Project Structure

```
data-scrapper/                  # Monorepo root (pnpm + Turborepo)
├── apps/
│   ├── analyzer-api/           # Express.js REST API (Node.js + TypeScript)
│   │   ├── src/
│   │   │   ├── controller/     # Route handlers (business logic)
│   │   │   ├── routes/         # Express routers
│   │   │   ├── middleware/     # Auth, rate-limit, CORS, security
│   │   │   ├── utils/          # Shared utilities (city normalization, data scope, etc.)
│   │   │   ├── libs/           # Services (health logger, news scheduler, activity logger)
│   │   │   ├── modules/        # RBAC access control module
│   │   │   └── app.ts          # Express app entry point
│   │   └── scripts/            # One-off scripts (e.g. seedCityAliases.ts)
│   ├── analyzer-web/           # React 19 + Vite frontend (TypeScript + Tailwind)
│   └── gupio-landing/          # Landing page app
├── packages/
│   ├── db/                     # Prisma ORM + schema + migrations
│   │   ├── prisma/
│   │   │   ├── schema.prisma   # Single source of truth for DB schema
│   │   │   └── migrations/     # SQL migration history
│   │   └── .env                # DATABASE_URL, DIRECT_URL for Neon DB
│   ├── ui/                     # Shared React component library (Radix UI + shadcn)
│   ├── eslint-config/          # Shared ESLint config
│   └── typescript-config/      # Shared tsconfig bases
├── emailtemplates/             # Nodemailer email HTML templates
├── render.yaml                 # Render.com deployment config
├── turbo.json                  # Turborepo pipeline config
├── pnpm-workspace.yaml
└── PROJECT_CONTEXT.md          # This file (NOT in git)
```

---

## 🛠️ Tech Stack & Libraries

### Backend (`analyzer-api`)

| Purpose                | Library / Tool                          |
|------------------------|-----------------------------------------|
| Runtime                | Node.js + TypeScript                    |
| Web Framework          | Express.js v5                           |
| ORM                    | Prisma v6 (`engineType = "library"`)    |
| Database               | PostgreSQL via Neon DB (serverless)     |
| Authentication         | JWT (`jsonwebtoken`) + bcryptjs         |
| File Storage           | AWS S3 (`@aws-sdk/client-s3`)           |
| Email                  | Nodemailer (SMTP + Gmail App Password)  |
| SMS / OTP              | Twilio                                  |
| Caching / Rate-limit   | Redis (`redis` v5)                      |
| Scraping               | Cheerio (HTML) + Puppeteer (headless)   |
| HTTP Client            | Axios                                   |
| AI / Enrichment        | Google Gemini (`@google/generative-ai`) |
| Google APIs            | `googleapis` (Sheets, OAuth)            |
| Scheduling             | `node-cron`                             |
| Excel Export           | ExcelJS                                 |
| Environment            | dotenv                                  |

### Frontend (`analyzer-web`)

| Purpose                | Library / Tool                    |
|------------------------|-----------------------------------|
| Framework              | React 19 + Vite                   |
| Routing                | React Router v7                   |
| Data Fetching          | TanStack Query v5                 |
| Tables                 | TanStack Table v8                 |
| Charts                 | Chart.js + react-chartjs-2        |
| UI Components          | Radix UI + shadcn/ui              |
| Styling                | Tailwind CSS v4                   |
| Forms                  | React Hook Form + Zod             |
| Animations             | Framer Motion                     |
| Toasts                 | Sonner                            |

### Infrastructure

| Purpose       | Tool                              |
|---------------|-----------------------------------|
| Monorepo      | Turborepo + pnpm workspaces       |
| DB Hosting    | Neon DB (serverless PostgreSQL)   |
| Deployment    | Render.com                        |
| Storage       | AWS S3                            |

---

## 🗄️ Database Schema (Key Models)

| Model                | Purpose                                              |
|----------------------|------------------------------------------------------|
| `NewTechPark`        | Tech park listings with state/city/status/contacts   |
| `CoworkingSpace`     | Coworking space listings                             |
| `CityCatalog`        | Approved city+state combinations                     |
| `CityAlias`          | Dynamic alias map: suburb/variant → canonical city   |
| `AdminUser`          | Admin users with roles and permissions               |
| `AccessRole`         | RBAC roles                                           |
| `AccessPermission`   | Granular permissions                                 |
| `ContactLog`         | CRM-style contact history per tech park              |
| `FundingNews`        | Startup funding news (scraped)                       |
| `Organization`       | Companies/organizations linked to tech parks         |
| `ActivityLog`        | Audit log for entity changes                         |
| `ExternalApiClient`  | API key management for external integrations         |
| `Task` / `TaskAudit` | Background task tracking                             |

**DB connection:** Neon DB (Postgres), direct URL used for Prisma Studio and migrations.  
Schema lives in `packages/db/prisma/schema.prisma`.  
Migrations: `packages/db/prisma/migrations/`.

---

## 🌐 API Endpoints

Base URL: `http://localhost:4000` (dev) / Render URL (prod)

| Prefix                  | Description                                      | Auth Required |
|-------------------------|--------------------------------------------------|---------------|
| `GET /health`           | Service health snapshot (DB, Redis, SMTP)        | No            |
| `GET /health/live`      | Simple liveness check                            | No            |
| `/auth`                 | Login, register, OTP, Google OAuth               | No            |
| `/admin`                | Admin user management                            | Yes           |
| `/new-techparks`        | Tech park CRUD, overview, city/state analytics   | Yes           |
| `/coworking-spaces`     | Coworking space CRUD and analytics               | Yes           |
| `/contact-logs`         | CRM contact log per tech park                    | Yes           |
| `/funding-news`         | Funding news list and scrape trigger             | Yes           |
| `/media`                | S3 file upload / presigned URLs                  | Yes           |
| `/rbac`                 | Role and permission management                   | Yes           |
| `/export`               | Excel/CSV export of listings                     | Yes           |
| `/city-aliases`         | CRUD for city alias mappings (dynamic normalization) | Yes       |
| `/v1` / `/external-integration` | External API (API-key auth, for integrations) | API Key  |

---

## 🏙️ City Normalization System

City data coming from scrapers/forms often contains suburb names, typos, or variants (e.g. "Pimpri-Chinchwad", "KharadiPune", "Bangalore Division"). The normalization system maps these to canonical city names (e.g. "Pune", "Bengaluru").

**How it works:**
1. `CityAlias` table stores `alias (lowercase) → canonicalCity` mappings (294+ entries seeded)
2. `getCityAliasMap()` in `cityNormalization.ts` loads from DB with a 5-minute in-memory cache
3. `normalizeCity(raw, aliasMap)` applies: exact alias lookup → substring match → fallback
4. Cache is invalidated via `POST /city-aliases/invalidate-cache`

**Add new aliases** without code changes via `POST /city-aliases` or `POST /city-aliases/bulk`.

---

## 🔐 Environment Variables

### `packages/db/.env`
```env
DATABASE_URL=postgresql://...@neon.tech/neondb?sslmode=require
DIRECT_URL=postgresql://...@neon.tech/neondb?sslmode=require
SEED_SUPER_ADMIN_EMAIL=
SEED_SUPER_ADMIN_PASSWORD=
SEED_SUPER_ADMIN_NAME=
SEED_SUPER_ADMIN_PHONE=
```

### `apps/analyzer-api/.env` (or injected in prod)
```env
# Server
PORT=4000
NODE_ENV=development
TRUST_PROXY=false

# Database
DATABASE_URL=          # Same as packages/db/.env

# Auth
JWT_SECRET=
SESSION_SECRET=
OTP_SECRET=
OTP_TTL_MS=300000
MFA_TOKEN_TTL_MS=

# External API keys
EXTERNAL_API_KEY_PEPPER=

# CORS
CORS_ORIGIN=http://localhost:5173
FRONTEND_URL=http://localhost:5173
WEB_APP_URL=http://localhost:5173

# Email (SMTP or Gmail)
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
SMTP_SECURE=
SMTP_FROM=
NODEMAILER_EMAIL=
NODEMAILER_PASSWORD=
GMAIL_USER=
GMAIL_APP_PASSWORD=

# SMS
SMS_PROVIDER=twilio
SMS_MOCK=false
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=

# AWS S3
AWS_REGION=
AWS_S3_BUCKET_NAME=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=

# Redis (rate limiting)
REDIS_URL=
REDIS_CONNECT_TIMEOUT_MS=
REDIS_COMMAND_TIMEOUT_MS=
API_RATE_LIMIT_STORE=redis
API_RATE_LIMIT_ENABLED=true
API_RATE_LIMIT_WINDOW_MS=
API_RATE_LIMIT_MAX_REQUESTS=

# Google APIs
GOOGLE_API_KEY=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=
GOOGLE_SEARCH_API_KEY=
GOOGLE_SEARCH_CX=

# AI
GEMINI_API_KEY=   # via @google/generative-ai

# Scheduler
NEWS_SCHEDULER_ENABLED=true

# RBAC
RBAC_SINGLE_ORGANIZATION_MODE=false
RBAC_PERMISSION_CACHE_TTL_MS=60000
```

---

## 🚀 Running Locally

```bash
# Install deps
pnpm install

# DB: generate Prisma client
pnpm --filter @repo/db exec prisma generate

# DB: run migrations
pnpm --filter @repo/db exec prisma migrate deploy

# Start all apps (API + Web)
pnpm dev

# API only (port 4000)
pnpm --filter analyzer-api dev

# Web only (port 5173)
pnpm --filter analyzer-web dev

# Prisma Studio (DB browser)
pnpm --filter @repo/db exec prisma studio
```

---

## 🐛 Known Issues / TODOs

### 🟡 In Progress
- [ ] Dynamic city alias management UI on frontend
- [ ] Pagination for `/city-aliases` list endpoint

### 🟢 Planned
- [ ] Scraper modules for automated tech park discovery
- [ ] Dashboard widgets for city alias coverage
- [ ] Unit tests for city normalization logic

---

## 💬 How to Use This File with AI

When starting a new AI chat session, paste this file and say:

> *"Here is my project context. Please read it fully before helping me. I need help with: [your question]"*

**Useful follow-up prompts:**
- `"Based on this context, add a new scraper for [source]."`
- `"Help me add a new field to the NewTechPark model and create a migration."`
- `"Add a new API endpoint to [router] following the existing pattern."`
- `"Review the city normalization logic and suggest improvements."`
- `"Explain the RBAC system and how to add a new permission."`

---

*Last updated: 2026-04-27 | Tech Parks Analyzer V2 — Ganesh Sabale*
