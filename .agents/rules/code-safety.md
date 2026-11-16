# Code Safety Rules

These are mandatory safety rules for all code and configuration changes in this repository.

---

## 1. Secrets and Sensitive Data

- **No Secrets in Code**: Never commit, store, or output API keys, passwords, database credentials, Supabase service keys, or tokens in any repository file.
- **Environment Variables**: Access all secrets exclusively through server-side environment variables (`process.env`).
- **Client Key Isolation**: Only public, anonymous keys (e.g., Supabase anon key) intended for client-side use may exist in client JS files.

---

## 2. Forms and Lead Integrity

- **Honeypot Retention**: Never remove or rename the hidden honeypot field (`<input type="text" name="_hp" ...>`) present in lead capture forms.
- **Truthful Success States**: Never display `.form-success` unless the lead was confirmed saved in the backend.
  - If `window.USA_SUPABASE.saveLead()` is unavailable or fails, fall back to a direct `POST` to `/api/submit-lead` (as demonstrated in `insulation-cost-calculator.html`).
  - If the submission fails, render an error message; do not mislead the user.
- **No Real Test Leads**: Never submit real leads or automated test payloads through production endpoints or live forms.

---

## 3. Layout Synchronization

- **Shared Elements**: Do not edit `#navbar-container`, `#footer-container`, or `#sticky-call-button-container` inside individual page HTML files.
- **Single Source of Truth**:
  1. Modify files in `scripts/layout/` (`header.html`, `footer.html`, `sticky-call.html`).
  2. Run `python scripts/sync-layout.py --check` to verify layout differences.
  3. Run `python scripts/sync-layout.py` to synchronize across all HTML pages.

---

## 4. API & Functions Parity

- **Vercel & Netlify Mirroring**: All endpoints in `api/` (`submit-lead.js`, `admin.js`, `auth.js`) are mirrored in `netlify/functions/`.
- **Byte-Identical Requirement**: Whenever modifying an API endpoint, make identical changes to both directories so local Netlify development matches Vercel production.

---

## 5. Hosting and Redirect Configuration

- **Vercel Single Authority**: All redirects, clean URLs, security headers, and rewrite rules must be placed in `vercel.json`.
- **No `_redirects`**: Do not add or edit rules in `_redirects`.
- **No Dashboard Meddling**: Never change environment variables or settings via hosting dashboards.

---

## 6. Git & Deployment Safety

- **No Unauthorized Pushes**: Never run `git push` unless explicitly instructed by the user.
- **Pre-Change Commit**: Create a clean git commit before initiating significant refactors or file rewrites.
- **Scope Restriction**: Only modify the specific files requested. Do not touch other pages, templates, or configs unprompted.
