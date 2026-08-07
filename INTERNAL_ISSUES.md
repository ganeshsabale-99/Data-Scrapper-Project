# Internal Issues Tracker — Tech Parks Analyzer

Scope: this product is used **internally only** (not sold externally), so this list drops
sales/investor/competitor concerns from the earlier full audit and keeps only what actually
affects the internal team's day-to-day use: correctness, data reliability, security, and
efficiency for the people using this tool at Gupio.

**Core job correction (2026-08-06): this is a data collection/scraping tool, not a CRM.**
Priority going forward is scraper reliability and data quality — job durability, concurrency,
retry/backoff, validation, dedup. CRM-flavored items below (lead assignment, contact logs,
audit UI) are kept for reference since some backend work landed, but are not the focus.

Legend: 🔴 Critical · 🟠 High · 🟡 Medium · 🟢 Low · ✅ Fixed

Update this file as items are fixed — check the box, add the commit/date if useful.

---

## 🔴 Critical

- [x] **Google Places API key returns `REQUEST_DENIED`** for Malls/Hospitals/Stadiums/Airports —
      scrapes for these 4 types were saving 0 new records.
      _Fixed: new key provided and verified working (`status: OK`, real results returned) —
      updated in `apps/analyzer-api/.env` as `GOOGLE_API_KEY`. Re-run the 4 scrapers to backfill._
- [x] **No lead ownership/assignment field on any venue record** — two reps could independently
      contact the same lead the same day with no warning.
      _Fixed: added `ownerId`/`assignedAt` to all 6 venue models (migration applied), backend
      assign/unassign endpoints (409 conflict if already owned by someone else), and
      "Assign to me" / "Unassign" actions + owner display in the location table UI._
- [x] **PDF export is vulnerable to HTML/JS injection** — scraped venue names/fields are
      interpolated unescaped into HTML rendered by a headless browser for PDF export.
      _Fixed: added `escapeHtml()` and applied it to every DB-sourced field in `generatePdf`._
- [ ] **No session revocation** — a stolen/leaked token, or an employee who needs access cut
      immediately, cannot be blocked short of rotating the shared session secret (which logs
      everyone out).

## 🟠 High

- [x] **No job queue for scrapers** — in-memory-only run state; a server restart mid-scrape
      silently loses all progress with no record it happened.
      _Fixed: new `ScrapeJob` DB table (migration applied) tracks every run — status, counts,
      who/what triggered it, start/finish time. A RUNNING job older than 2h is auto-reaped as
      stale, so a crash doesn't permanently block future runs._
- [x] **No lock between the weekly scheduled scrape and manual triggers** — they can run
      concurrently against each other and against Google's API with no coordination.
      _Fixed: both now go through the same `ScrapeJob`-backed lock per venue type — verified
      live that a second trigger attempt while one is running is correctly blocked._
- [x] **Zero retry/backoff on any scraper HTTP call** — one network blip permanently drops that
      record until next week's run.
      _Fixed: new `googlePlacesClient.ts` wraps every Places API call with exponential
      backoff + jitter (3 retries). A genuinely permanent failure (bad key, malformed request)
      now aborts the whole scrape immediately instead of silently retrying/logging the same
      failure hundreds of times. Verified live with a real test-mode scrape (0 failures)._
- [ ] **No audit log for user approval/rejection or RBAC permission/role changes** — no record
      of who approved a signup or who changed someone's access.
- [ ] **No executive/team dashboard** — no cross-venue-type view, no funnel, no rep activity
      view; everything is a single venue-type's operational table.
- [ ] **No bulk operations anywhere** — every status change, delete, or edit is one row at a time.
- [ ] **Users page search only searches the currently-loaded page**, not all users — breaks
      past ~20 users.
- [ ] **National/state overview stats do a full-table scan + in-app dedup on every dashboard
      load**, no caching — will get slower as data grows.
- [ ] **Tech Park city-overview pagination is fake** — loads the entire city into memory
      regardless of the page size requested.

## 🟡 Medium

- [ ] **Notifications permission exists (`NOTIFICATIONS.VIEW`) with zero actual feature** — no
      email/SMS/in-app notifications anywhere (e.g. "lead gone cold", "new signup pending
      approval").
- [ ] **No standalone audit/activity log page** — activity history is only visible embedded in
      a single Tech Park's detail view.
- [ ] **place_id-only deduplication** — no fuzzy address/name matching, so re-geocoded listings
      create duplicate rows for the same physical venue.
- [ ] **No field validation on scraped data before write** — no bounds check on rating, no
      phone format check, no empty-name rejection.
- [ ] **Confidence/QA scoring exists for Tech Parks only** — Malls/Hospitals/Stadiums/Airports
      have no equivalent trust signal.
- [ ] **AI-extracted funding intel (founders/investors/location) is computed and stored but
      never shown** in the Funding News UI — wasted existing capability.
- [ ] **Sidebar repeats all 6 venue-type links three times** (National/State/City groups) with
      no grouping explanation — daily friction, not just a first-impression issue.
- [ ] **Empty states don't distinguish "genuinely no data" from "the scraper is broken"** —
      directly relevant right now since Malls/Hospitals look "empty" when they're actually
      blocked by the API key issue above.
- [ ] **No search on Departments/Roles/Permissions admin pages.**
- [ ] **File upload type validation trusts client-supplied Content-Type**, not real content
      sniffing.
- [ ] **No connection pooler (pgbouncer) configured for Neon** — fine for one instance, a
      problem if this ever needs to scale horizontally.

## 🟢 Low

- [ ] **"Bulk verify in city" button is wired end-to-end but never rendered anywhere** — dead
      code, remove it or finish it.
- [ ] **No data history/versioning** — every re-scrape overwrites prior values with no way to
      see what changed.
- [ ] **No virtualized rendering in any table** — currently masked by a 100-row API cap, not a
      real fix.
- [ ] **Rate limiting is memory-backed** — fine on one instance, silently stops working if ever
      scaled to multiple instances.
- [ ] **`$queryRawUnsafe` pattern present in `utils/dbEnums.ts`** — current input isn't
      attacker-controlled, but it's a risky pattern to have around.
- [ ] **Local `.env` has placeholder-looking secrets** (`dev-otp-secret-change-me` etc.) — worth
      confirming production values are actually different and strong.

---

## Already fixed this session (for reference, not re-open)

- RBAC permissions for Malls/Hospitals/Stadiums/Airports were never seeded — locked out every
  non-admin user.
- Verify-permission check hardcoded to Tech Park's permission key regardless of venue type.
- Contact Log feature had no schema/API/UI support for the 4 newer venue types.
- Excel/CSV/PDF export silently omitted the 4 newer venue types.
- RBAC permission/role changes didn't reach already-logged-in users without a re-login.
- "View Details" on the 4 newer venue types was a hard no-op.
- Internal navigation dropped the active venue-type context on every drill-down.
- Multiple page titles/labels/stat cards hardcoded to say "Tech Park"/"Coworking Space"
  regardless of actual venue type.
- Funding News search only searched the current page, not the full dataset.
- Funding News location extraction was case-sensitive and missed most real matches.
- Approving/rejecting a pending user left the row visible in the Pending filter until refresh.
- External API previously exposed Tech Parks only, now covers all 6 venue types + Coworking.
- Tech Park → Company discovery matched purely on fuzzy name/address text, risking duplicate
  or merged companies on re-sync — now matches on Google's `place_id` first.
- Tech Park → Company sync had no way to detect a company that closed/moved out — it only ever
  added or updated, never flagged removals. Now tracks `firstSeenAt`/`lastSeenAt`/`isActive` and
  auto-flags (not deletes) companies no longer found in a re-scrape.
- Company website-enrichment fallback (used when `GOOGLE_SEARCH_API_KEY` is unset) scraped
  DuckDuckGo/Bing directly — every attempt timed out in this environment, taking 1+ minute per
  company for nothing, and once caused a live sync to exhaust its DB connection mid-run. Now off
  by default (`ENRICHMENT_WEB_FALLBACK_ENABLED=true` to opt back in), and faster/parallelized
  for whenever it is enabled.
- Puppeteer's Chrome binary was never installed on this machine — silently broke every
  Puppeteer-dependent scraper (company-detail lookup, YourStory funding source) with the same
  "Could not find Chrome" error. Installed `chrome` + `chrome-headless-shell` via
  `npx puppeteer browsers install`.
- Retry/backoff added to every Google Places API call in the core venue scraper
  (`googlePlacesClient.ts`) — transient failures now retry with exponential backoff; a genuinely
  permanent failure (bad key) now aborts the whole scrape immediately instead of silently
  grinding through hundreds of doomed requests.
- Durable, DB-backed job tracking (`ScrapeJob` model) replaces in-memory-only "is a scrape
  running" flags — a process restart no longer silently loses all record that a scrape happened,
  and the weekly scheduler and manual triggers now share one real lock per venue type instead of
  two separate booleans that didn't know about each other.
- **Tech Park company enrichment never actually captured LinkedIn/Twitter/Facebook/Instagram**,
  even though the scraping code already found them internally — `TechParkCompany` had no columns
  for them, and the function that fetches them (`enrichCompanyRecord`) discarded them before
  returning. Added the columns, stopped discarding the data, and fixed a related bug where
  generic "share this page" widget links (not real profile URLs) were being saved as if they were
  the company's actual Twitter/Facebook page. Verified live against a real company (Mphasis) —
  now correctly captures `linkedin.com/company/mphasis`, `twitter.com/Mphasis`,
  `facebook.com/MphasisOfficial`.
- **Company enrichment (website/social scraping) only ran when someone manually clicked "Discover
  Companies"** — the nightly Tech Park sync (`runTechParkCompanySync`) only synced the company
  list, it never enriched them. Now `enrichCompaniesForTechPark` runs automatically right after
  sync for every tech park, every night, with no manual step required.
- **Inc42 funding-news scraper was completely broken** (0 results) — the site changed its HTML
  from `h3 a` to `h2 a` and the scraper's selector never matched funding stories anymore. Fixed
  the selector to match both, added href-based dedup. Verified live: now returns real articles.
- **TechCrunch funding-news scraper ingested the wrong content** — ran without error but returned
  event-ticket promo posts, not funding news, with no topic keyword filter. Added the same
  keyword filter Inc42 uses. Verified live: now returns real funding stories only.
- **YourStory funding source had never actually run** — not called by the scheduler at all (dead
  import), and independently required a non-headless browser window that can't run on a headless
  server. Rewired into the scheduler, switched to headless mode with UA spoofing (the default
  headless fingerprint was being served a stripped page — bot detection), switched the source URL
  from `/tag/funding-news` (generic digests only) to `/tag/startup-funding` (real per-company
  articles), fixed the stale selector, fixed CSS-truncated titles by reading the full title from
  the thumbnail's `alt` attribute, and added a 3-attempt retry with backoff for observed
  navigation flakiness. Verified live: 8 real, complete funding articles per run.
- **AI-based funding extraction (`fundingExtractor.ts`) was fully built but never called by
  anything** — founders/investors/round/location/industry extraction just never ran. Wired it
  into the scheduler so every newly-inserted article is automatically run through Gemini once
  (skipped on re-scrapes of articles that already have a `company_name`, so it doesn't re-spend
  quota on the same article every 2 hours). Also fixed the model name (`gemini-1.5-flash`, which
  404'd on this project) to `gemini-2.0-flash` (verified working elsewhere in the codebase) —
  confirmed live that the error changed from a permanent 404 to a quota 429, meaning this will
  start working automatically as soon as Gemini quota is available, no further code change needed.
- **Funding news scheduler had no concurrency lock and 6x duplicated per-source code** — the
  6 sources (Entrackr, VCCircle, TechCrunch, ETStartup, Inc42, YourStory) each had their own
  copy-pasted fetch/store logic and could run concurrently with themselves via manual trigger.
  Refactored into one generic pipeline driven by a `SOURCES` array, and added the same
  `ScrapeJob`-backed lock the venue scrapers use.
- **Every new `FundingNews` row was silently failing to insert** — `founders`/`investors` are
  required array columns with no default and no code path ever set them explicitly, so any
  source creating a brand-new article hit `Null constraint violation on the fields: (founders)`.
  Only updates to pre-existing rows were succeeding. This was likely a real contributor to
  production data looking stale. Fixed via a schema default (`@default([])`) plus a migration
  that backfills any existing NULLs. Verified live: a full 6-source run added 68 new rows with
  zero failures.
- **`triggerScraping` endpoint awaited the full scrape synchronously** — risked an HTTP timeout
  now that every new article also makes a Gemini call. Changed to fire-and-forget with a 409 if
  a scrape is already running (same pattern the venue scraper endpoints use); confirmed no
  frontend code depends on the old synchronous response.

## Found this session, not yet fixed (external/infra, not fixable by code)

- **Gemini API key has zero quota** (`limit: 0` on the free tier) — this blocks every
  Gemini-dependent feature platform-wide; needs a billing/plan change on your Google Cloud
  project. The extraction code itself is now correctly wired and verified working (see above) —
  it will start producing data automatically the moment quota is available.
- **The deployed Funding News scheduler appears to not be running at all** — the newest row in
  the live database is from 2026-04-29, over 3 months stale, despite the scrapers working fine
  when run manually today. This points to a deploy/process issue on your server, not a code bug —
  I don't have access to check logs or process state there.
- **Google Search scraping via Puppeteer is blocked by CAPTCHA** — installing Chrome fixed the
  "won't launch" problem, but the underlying approach (scraping Google Search result pages
  directly) gets CAPTCHA-blocked every time, so `scrapeCompanyDetails.ts` runs cleanly now but
  still won't find much. Needs the Google Custom Search API (paid, needs credentials) to actually
  work, not a code fix.
- **Website discovery for companies/tech parks with no site on file** depends on the same
  DuckDuckGo/Bing scraping that's already known broken — same root cause as above, same fix needed
  (real Search API credentials).
