# AGENTS.md — Insulation Contractor Houston Repository Source of Truth

This repository is a static website for **Insulation Contractor Houston**. This document serves as the absolute source of truth for any AI coding agent working in this codebase.

---

## 1. Stack and Architecture

- **Static HTML Site**: Plain HTML5, CSS, and vanilla JavaScript. No framework, no build tool, no bundler, no compile step.
- **Styling**: Single global CSS file at `assets/global.css`.
- **Client Scripts**:
  - `assets/js/main.js`: Core site interactions, mobile navigation, accordions, and lead form validation/submission.
  - `assets/js/supabase-client.js`: Client-side helper exposing `window.USA_SUPABASE.saveLead()`.
- **Hosting & Configuration**:
  - Hosted on **Vercel**.
  - All routing, redirects, headers, and clean URLs live **strictly** in `vercel.json`.
  - **Never** place redirects or headers in `_redirects`.
- **Serverless / Edge Functions**:
  - `api/`: Vercel edge functions (`submit-lead.js`, `admin.js`, `auth.js`).
  - `netlify/functions/`: Mirrored functions for local Netlify CLI runs.
  - **Rule**: `api/` and `netlify/functions/` must be maintained **byte-identically**. If you change one, update the other identically.

---

## 2. Repository Structure Map

- **26 Public Pages at Root**:
  - Homepage: `index.html`
  - 6 Service Pages:
    - `blown-in-insulation.html`
    - `spray-foam-insulation.html`
    - `injection-foam-insulation.html`
    - `attic-fan-installation.html`
    - `insulation-removal.html`
    - `commercial-insulation.html`
  - 7 Town / Service Area Pages:
    - `cypress-tx-insulation.html`
    - `spring-tx-insulation.html`
    - `conroe-tx-insulation.html`
    - `kingwood-tx-insulation.html`
    - `the-woodlands-tx-insulation.html`
    - `humble-tx-insulation.html`
    - `tomball-tx-insulation.html`
  - Cost, Utility & Legal Pages:
    - `insulation-cost-calculator.html`
    - `about.html`
    - `contact.html`
    - `privacy-policy.html`
    - `terms-of-service.html`
    - `404.html`
- **Blog (`blog/`)**:
  - `blog/index.html`
  - 5 posts:
    - `blog/attic-insulation-kingwood-tx.html`
    - `blog/attic-insulation-spring-tx.html`
    - `blog/blown-in-vs-fiberglass-insulation-cypress-tx.html`
    - `blog/houston-attic-r-value-guide.html`
    - `blog/insulation-contractor-conroe-tx.html`
- **Admin Panel (`admin/`)**:
  - `admin/index.html`, `admin/admin.css`, `admin/admin.js` (Lead management dashboard, set to `noindex`).
- **Shared Layout Components (`scripts/layout/`)**:
  - `scripts/layout/header.html`
  - `scripts/layout/footer.html`
  - `scripts/layout/sticky-call.html`
  - Synced to all pages using `scripts/sync-layout.py`.

---

## 3. Shared Layout System

- Shared elements (header, footer, sticky call button) live inside `scripts/layout/`.
- **Never edit the header, footer, or sticky call button directly inside any page HTML file.**
- To update shared layout:
  1. Edit the component in `scripts/layout/`.
  2. Run `python scripts/sync-layout.py --check` to review drift.
  3. Run `python scripts/sync-layout.py` to sync all pages.

---

## 4. Lead Capture & Submission Flow

1. User fills out an estimate form (e.g., `#hero-request-form`, `#service-area-form`, or calculator form).
2. Form contains a hidden honeypot field: `<input type="text" name="_hp" tabindex="-1" autocomplete="off" style="display:none;" aria-hidden="true" />`.
3. `assets/js/main.js` (`initLeadForms`):
   - Validates input fields.
   - Rejects submissions if honeypot `_hp` is populated.
   - Delegates to `window.USA_SUPABASE.saveLead(leadData)` in `assets/js/supabase-client.js`.
4. `saveLead()` sends a `POST /api/submit-lead` request.
5. `api/submit-lead.js` inserts the lead into the Supabase `leads` table and sends an email notification via Resend if configured.
6. The UI only displays `.form-success` if the save actually succeeded. If `window.USA_SUPABASE.saveLead` is unavailable, fall back to a direct `POST /api/submit-lead`.

---

## 5. Verified Business Facts (Source of Truth)

Agents must strictly adhere to these verified facts and **never** invent pricing, addresses, claims, or hours.

- **Business Name**: Insulation Contractor Houston
- **Address**: Central Park Vista Ln, Houston, TX 77080 (*Note: No house number. Never use Cypress Farms Ranch Rd, Houston, TX 77429*).
- **Phone Number**: `(832) 291-2738`
- **Phone Link**: `tel:+18322912738`
- **Operating Hours**: Monday to Saturday, 8am to 6pm. Sunday closed.
  - Schema on every page must list Monday to Saturday only (08:00 to 18:00).
- **Market Prices (Houston Market Prices as of November 2026, not exact project pricing)**:
  - Blown-in insulation: **$1.00 – $2.50** per sq ft
  - Spray foam insulation: **$2.00 – $4.50** per sq ft
  - Injection foam insulation: **$2.00 – $4.20** per sq ft of wall
  - Attic fan installation: **$299 – $718** per fan
  - Air sealing: **$250 – $740** per attic (separate line, only if leaks are found)
  - Insulation removal: **$1.00 – $1.50** per sq ft (only if needed)
  - Full replacement: **$2.00 – $4.00** per sq ft
  - Inspection / Walkthrough: **Free**
- **Technical & Industry Facts**:
  - Target R-value: **R38, about 15 inches** (Houston Zone 2 standard).
  - ENERGY STAR (EPA): Air sealing and adding insulation saves an average of **15% on heating and cooling costs**, and **11% on total energy costs**. (*Never write 6% or 9%*).
  - Typical job duration: A normal blown-in job takes **more than one day** from walkthrough to final check.
  - Air sealing policy: Air sealing is done **only if leaks are found** on the walkthrough.
  - Guarantees / Licensing: **No rebates, no warranty**. Never write "Licensed & insured" (Texas has no statewide licence for insulation work).
- **Google Reviews**: **5.0 stars from 5 reviews**. Always state the exact count; never inflate.

---

## 6. Hard Agent Rules

1. **Coding Agent Setup Only**: Do not write marketing copy, speculative page content, or SEO fluff. Only make required code, structural, and bugfix changes.
2. **Plan Approval**: Before writing any code, outline a short plan (what will change, which files, and how to verify). Wait for user approval before starting.
3. **Incremental Verification**: Work in small, verifiable steps. After every change, run the checks in `.agents/skills/build-and-test/SKILL.md` and report each pass/fail with file and line.
4. **Git Discipline**: Never push to GitHub unless explicitly instructed. Commit before large changes, but do not push.
5. **Secrets & Security**: Never put secrets, API keys, service role keys, tokens, or passwords in repository files. Use environment variables only.
6. **Form Honesty**: Never show a form success message unless the lead save actually succeeded. Never remove the hidden honeypot (`_hp`). Never submit real forms with test data.
7. **Environment & Dashboard**: Never edit hosting dashboards or live environment variables.
